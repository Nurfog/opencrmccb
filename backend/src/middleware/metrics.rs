use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::response::{IntoResponse, Response};
use prometheus::{
    Encoder, HistogramOpts, HistogramVec, IntCounterVec, Registry, TextEncoder, opts,
    register_histogram_vec_with_registry, register_int_counter_vec_with_registry,
};
use std::sync::Arc;
use std::time::Instant;

#[derive(Clone)]
pub struct Metrics {
    pub registry: Registry,
    pub http_requests_total: IntCounterVec,
    pub http_request_duration_seconds: HistogramVec,
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}

impl Metrics {
    pub fn new() -> Self {
        let registry = Registry::new();

        let http_requests_total = register_int_counter_vec_with_registry!(
            opts!("http_requests_total", "Total number of HTTP requests"),
            &["method", "path", "status"],
            registry
        )
        .unwrap();

        let http_request_duration_seconds = register_histogram_vec_with_registry!(
            HistogramOpts::new(
                "http_request_duration_seconds",
                "HTTP request duration in seconds"
            ),
            &["method", "path", "status"],
            registry
        )
        .unwrap();

        Self {
            registry,
            http_requests_total,
            http_request_duration_seconds,
        }
    }

    pub fn render(&self) -> String {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();
        encoder.encode(&metric_families, &mut buffer).unwrap();
        String::from_utf8(buffer).unwrap()
    }
}

pub async fn metrics_handler(
    axum::extract::Extension(metrics): axum::extract::Extension<Arc<Metrics>>,
    req: Request<Body>,
) -> Response {
    // Optional bearer gate: set METRICS_TOKEN to stop exposing traffic
    // shapes publicly. Unset = open (warned at startup), Prometheus default.
    if let Ok(expected) = std::env::var("METRICS_TOKEN")
        && !expected.is_empty()
    {
        let authed = req
            .headers()
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
            .is_some_and(|h| h == format!("Bearer {expected}"));
        if !authed {
            return StatusCode::UNAUTHORIZED.into_response();
        }
    }
    let body = metrics.render();
    (
        StatusCode::OK,
        [("content-type", "text/plain; version=0.0.4; charset=utf-8")],
        body,
    )
        .into_response()
}

/// Collapse high-cardinality path segments (UUIDs, numeric IDs) so
/// `/contacts/{uuid}` doesn't create one series per entity.
fn normalize_path(path: &str) -> String {
    path.split('/')
        .map(|seg| {
            if seg.is_empty() {
                String::new()
            } else if seg.parse::<uuid::Uuid>().is_ok()
                || (!seg.is_empty() && seg.bytes().all(|b| b.is_ascii_digit()))
            {
                "{id}".to_string()
            } else {
                seg.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("/")
}

pub async fn track_metrics(
    axum::extract::Extension(metrics): axum::extract::Extension<Arc<Metrics>>,
    req: Request<Body>,
    next: axum::middleware::Next,
) -> Response {
    let method = req.method().to_string();
    let path = normalize_path(req.uri().path());
    let start = Instant::now();

    let response = next.run(req).await;

    let elapsed = start.elapsed().as_secs_f64();
    let status = response.status().as_u16().to_string();

    metrics
        .http_requests_total
        .with_label_values(&[&method, &path, &status])
        .inc();
    metrics
        .http_request_duration_seconds
        .with_label_values(&[&method, &path, &status])
        .observe(elapsed);

    response
}
