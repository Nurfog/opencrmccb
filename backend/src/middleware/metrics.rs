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
) -> Response {
    let body = metrics.render();
    (
        StatusCode::OK,
        [("content-type", "text/plain; version=0.0.4; charset=utf-8")],
        body,
    )
        .into_response()
}

pub async fn track_metrics(
    axum::extract::Extension(metrics): axum::extract::Extension<Arc<Metrics>>,
    req: Request<Body>,
    next: axum::middleware::Next,
) -> Response {
    let method = req.method().to_string();
    let raw_path = req.uri().path().to_string();
    // Normalize to route templates to bound cardinality (no UUID/int explosion).
    let path = normalize_path(&raw_path);
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

/// Normalize a request path to its route template for metrics labels:
/// replaces UUIDs and pure-integer segments with `:id`.
/// e.g. `/api/v1/contacts/550e8400-...` → `/api/v1/contacts/:id`.
pub fn normalize_path(path: &str) -> String {
    path.split('/')
        .map(|seg| {
            if seg.is_empty() {
                return String::new();
            }
            // Pure integers → :id
            if !seg.is_empty() && seg.bytes().all(|b| b.is_ascii_digit()) {
                return ":id".to_string();
            }
            // UUIDs (8-4-4-4-12 hex) → :id (cheap check without regex dep)
            if is_uuid_like(seg) {
                return ":id".to_string();
            }
            seg.to_string()
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn is_uuid_like(s: &str) -> bool {
    if s.len() != 36 {
        return false;
    }
    let b = s.as_bytes();
    // 8-4-4-4-12 with dashes at 8,13,18,23, all other hex
    if b[8] != b'-' || b[13] != b'-' || b[18] != b'-' || b[23] != b'-' {
        return false;
    }
    for (i, &c) in b.iter().enumerate() {
        if i == 8 || i == 13 || i == 18 || i == 23 {
            continue;
        }
        if !c.is_ascii_hexdigit() {
            return false;
        }
    }
    true
}
