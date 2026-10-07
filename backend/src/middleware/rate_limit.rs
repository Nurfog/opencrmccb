use std::collections::HashMap;
use std::future::Future;
use std::net::IpAddr;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::Duration;

use axum::{
    extract::Request,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use redis::AsyncCommands;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use tower::{Layer, Service};

/// Strict brute-force budget for login/register/refresh (shared by all
/// callers of `RateLimiter::new()` / `with_redis()`).
const STRICT_MAX_REQUESTS: usize = 5;
const STRICT_WINDOW_SECS: u64 = 60;
/// Lenient budget for normal authenticated traffic: a single dashboard mount
/// fires ~5 parallel requests, so the strict budget would lock users out.
const GENERAL_MAX_REQUESTS: usize = 300;
const GENERAL_WINDOW_SECS: u64 = 60;
const CLEANUP_INTERVAL_SECS: u64 = 120;

#[derive(Clone)]
pub struct RateLimiter {
    inner: Arc<RateLimiterInner>,
    max_requests: usize,
    window_secs: u64,
}

enum RateLimiterInner {
    Redis {
        conn: redis::aio::ConnectionManager,
    },
    Memory {
        state: Arc<RwLock<MemoryRateLimitState>>,
    },
}

struct MemoryRateLimitState {
    requests: HashMap<IpAddr, Vec<Instant>>,
    last_cleanup: Instant,
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

impl RateLimiter {
    /// Strict limiter (5 req/min): login/register/refresh brute-force guard.
    pub fn new() -> Self {
        Self::with_limits(STRICT_MAX_REQUESTS, STRICT_WINDOW_SECS)
    }

    /// Custom-budget in-memory limiter (e.g. general authenticated traffic).
    pub fn with_limits(max_requests: usize, window_secs: u64) -> Self {
        Self {
            inner: Arc::new(RateLimiterInner::Memory {
                state: Arc::new(RwLock::new(MemoryRateLimitState {
                    requests: HashMap::new(),
                    last_cleanup: Instant::now(),
                })),
            }),
            max_requests,
            window_secs,
        }
    }

    /// General limiter (300 req/min) backed by memory.
    pub fn new_general() -> Self {
        Self::with_limits(GENERAL_MAX_REQUESTS, GENERAL_WINDOW_SECS)
    }

    /// Build from env: Redis when `REDIS_URL` is set, memory otherwise.
    /// Pass `general = true` for the lenient authenticated-traffic budget.
    pub async fn from_env(general: bool) -> Self {
        let (max, window) = if general {
            (GENERAL_MAX_REQUESTS, GENERAL_WINDOW_SECS)
        } else {
            (STRICT_MAX_REQUESTS, STRICT_WINDOW_SECS)
        };
        if let Ok(redis_url) = std::env::var("REDIS_URL") {
            Self::with_redis_and_limits(&redis_url, max, window).await
        } else {
            Self::with_limits(max, window)
        }
    }

    pub async fn with_redis(redis_url: &str) -> Self {
        Self::with_redis_and_limits(redis_url, STRICT_MAX_REQUESTS, STRICT_WINDOW_SECS).await
    }

    pub async fn with_redis_and_limits(
        redis_url: &str,
        max_requests: usize,
        window_secs: u64,
    ) -> Self {
        let make_memory = || Self::with_limits(max_requests, window_secs);
        let client = match redis::Client::open(redis_url) {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!(
                    "Failed to create Redis client, falling back to memory: {}",
                    e
                );
                return make_memory();
            }
        };

        match redis::aio::ConnectionManager::new(client).await {
            Ok(conn) => {
                tracing::info!("Redis rate limiter connected");
                Self {
                    inner: Arc::new(RateLimiterInner::Redis { conn }),
                    max_requests,
                    window_secs,
                }
            }
            Err(e) => {
                tracing::warn!("Redis connection failed, falling back to memory: {}", e);
                make_memory()
            }
        }
    }

    pub async fn is_rate_limited(&self, ip: IpAddr) -> bool {
        let max_requests = self.max_requests;
        let window_secs = self.window_secs;
        match &*self.inner {
            RateLimiterInner::Redis { conn } => {
                let key = format!("rate_limit:{}", ip);
                // Use wall-clock time so window math is correct across processes.
                let now_ms = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                let window_start_ms = now_ms.saturating_sub(window_secs * 1000);
                // Unique member per request so ZCARD actually counts requests.
                let member = format!("{}-{}", now_ms, uuid::Uuid::new_v4());

                let mut conn = conn.clone();
                // Remove expired entries, add current, set TTL, count
                let _: () = conn
                    .zrembyscore(&key, 0, window_start_ms)
                    .await
                    .unwrap_or(());
                let _: () = conn.zadd(&key, member, now_ms).await.unwrap_or(());
                let _: () = conn.expire(&key, window_secs as i64).await.unwrap_or(());
                let count: i64 = conn.zcard(&key).await.unwrap_or(0);

                count > max_requests as i64
            }
            RateLimiterInner::Memory { state } => {
                let mut state = state.write().await;
                let now = Instant::now();
                let window_start = now - Duration::from_secs(window_secs);

                let timestamps = state.requests.entry(ip).or_insert_with(Vec::new);
                timestamps.retain(|t| *t > window_start);

                if timestamps.len() >= max_requests {
                    return true;
                }

                timestamps.push(now);

                // Periodic cleanup
                if now - state.last_cleanup > Duration::from_secs(CLEANUP_INTERVAL_SECS) {
                    let cutoff = now - Duration::from_secs(window_secs * 2);
                    state.requests.retain(|_, ts| {
                        ts.retain(|t| *t > cutoff);
                        !ts.is_empty()
                    });
                    state.last_cleanup = now;
                }

                false
            }
        }
    }

    pub fn extract_client_ip(req: &Request) -> IpAddr {
        // How many right-most X-Forwarded-For hops to trust.
        // Default is 1 (single reverse proxy / load balancer in front).
        // Set TRUSTED_PROXY_HOPS=0 to never trust spoofable headers (fail-closed,
        // all direct connections share one bucket). Set higher if multiple
        // trusted proxies prepend hops.
        let trusted_hops: usize = std::env::var("TRUSTED_PROXY_HOPS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(1);

        // With zero trusted proxies, never trust spoofable headers.
        // Every direct connection shares one bucket (fail-closed, no bypass).
        if trusted_hops == 0 {
            return "127.0.0.1".parse().unwrap();
        }

        if let Some(forwarded) = req.headers().get("x-forwarded-for")
            && let Ok(s) = forwarded.to_str()
        {
            let hops: Vec<&str> = s.split(',').map(|h| h.trim()).collect();
            let idx = hops.len().saturating_sub(trusted_hops);
            if let Some(ip_str) = hops.get(idx)
                && let Ok(ip) = ip_str.parse::<IpAddr>()
            {
                return ip;
            }
        }

        if let Some(real_ip) = req.headers().get("x-real-ip")
            && let Ok(s) = real_ip.to_str()
            && let Ok(ip) = s.trim().parse::<IpAddr>()
        {
            return ip;
        }

        "127.0.0.1".parse().unwrap()
    }

    pub async fn check_ip(&self, ip: IpAddr) -> Result<(), StatusCode> {
        if self.is_rate_limited(ip).await {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
        Ok(())
    }

    pub fn layer(&self) -> RateLimitLayer {
        RateLimitLayer {
            limiter: self.clone(),
        }
    }
}

#[derive(Clone)]
pub struct RateLimitLayer {
    limiter: RateLimiter,
}

impl<S> Layer<S> for RateLimitLayer {
    type Service = RateLimitService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        RateLimitService {
            inner,
            limiter: self.limiter.clone(),
        }
    }
}

#[derive(Clone)]
pub struct RateLimitService<S> {
    inner: S,
    limiter: RateLimiter,
}

impl<S> Service<Request> for RateLimitService<S>
where
    S: Service<Request, Response = Response> + Send + Clone + 'static,
    S::Future: Send,
{
    type Response = Response;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request) -> Self::Future {
        let limiter = self.limiter.clone();
        let mut inner = self.inner.clone();
        let ip = RateLimiter::extract_client_ip(&req);

        Box::pin(async move {
            let window_secs = limiter.window_secs;
            if limiter.check_ip(ip).await.is_err() {
                let body = serde_json::json!({ "error": "Too many requests" });
                let mut resp = (StatusCode::TOO_MANY_REQUESTS, axum::Json(body)).into_response();
                // Tell clients when to retry (mirrors the fixed window).
                if let Ok(v) = window_secs.to_string().parse() {
                    resp.headers_mut().insert("Retry-After", v);
                }
                return Ok(resp);
            }
            inner.call(req).await
        })
    }
}
