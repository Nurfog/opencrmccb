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
    let path = req.uri().path().to_string();
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
