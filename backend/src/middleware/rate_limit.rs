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
use std::time::Instant;
use tokio::sync::RwLock;
use tower::{Layer, Service};

const MAX_REQUESTS: usize = 5;
const WINDOW_SECS: u64 = 60;
const CLEANUP_INTERVAL_SECS: u64 = 120;

#[derive(Clone)]
pub struct RateLimiter {
    inner: Arc<RateLimiterInner>,
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
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RateLimiterInner::Memory {
                state: Arc::new(RwLock::new(MemoryRateLimitState {
                    requests: HashMap::new(),
                    last_cleanup: Instant::now(),
                })),
            }),
        }
    }

    pub async fn with_redis(redis_url: &str) -> Self {
        let client = match redis::Client::open(redis_url) {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!(
                    "Failed to create Redis client, falling back to memory: {}",
                    e
                );
                return Self::new();
            }
        };

        match redis::aio::ConnectionManager::new(client).await {
            Ok(conn) => {
                tracing::info!("Redis rate limiter connected");
                Self {
                    inner: Arc::new(RateLimiterInner::Redis { conn }),
                }
            }
            Err(e) => {
                tracing::warn!("Redis connection failed, falling back to memory: {}", e);
                Self::new()
            }
        }
    }

    pub async fn is_rate_limited(&self, ip: IpAddr) -> bool {
        match &*self.inner {
            RateLimiterInner::Redis { conn } => {
                let key = format!("rate_limit:{}", ip);
                let now = Instant::now();
                let window_start_ms = (now - Duration::from_secs(WINDOW_SECS))
                    .elapsed()
                    .as_millis() as u64;
                let now_ms = now.elapsed().as_millis() as u64;

                let mut conn = conn.clone();
                // Remove expired entries, add current, set TTL, count
                let _: () = conn
                    .zrembyscore(&key, 0, window_start_ms)
                    .await
                    .unwrap_or(());
                let _: () = conn.zadd(&key, &key, now_ms).await.unwrap_or(());
                let _: () = conn.expire(&key, WINDOW_SECS as i64).await.unwrap_or(());
                let count: i64 = conn.zcard(&key).await.unwrap_or(0);

                count >= MAX_REQUESTS as i64
            }
            RateLimiterInner::Memory { state } => {
                let mut state = state.write().await;
                let now = Instant::now();
                let window_start = now - Duration::from_secs(WINDOW_SECS);

                let timestamps = state.requests.entry(ip).or_insert_with(Vec::new);
                timestamps.retain(|t| *t > window_start);

                if timestamps.len() >= MAX_REQUESTS {
                    return true;
                }

                timestamps.push(now);

                // Periodic cleanup
                if now - state.last_cleanup > Duration::from_secs(CLEANUP_INTERVAL_SECS) {
                    let cutoff = now - Duration::from_secs(WINDOW_SECS * 2);
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
        let trusted_hops: usize = std::env::var("TRUSTED_PROXY_HOPS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);

        if trusted_hops == 0 {
            if let Some(real_ip) = req.headers().get("x-real-ip")
                && let Ok(s) = real_ip.to_str()
                && let Ok(ip) = s.parse::<IpAddr>()
            {
                return ip;
            }
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
            if limiter.check_ip(ip).await.is_err() {
                return Ok(StatusCode::TOO_MANY_REQUESTS.into_response());
            }
            inner.call(req).await
        })
    }
}
