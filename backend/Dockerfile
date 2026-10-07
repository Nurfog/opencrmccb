FROM rust:1.88-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./

RUN mkdir src && \
    echo 'fn main() {}' > src/main.rs && \
    cargo build --release --locked && \
    rm -rf src

FROM rust:1.88-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/target/release /app/target/release
COPY Cargo.toml Cargo.lock ./

COPY src ./src

RUN touch src/main.rs && cargo build --release --locked

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

COPY --from=builder /app/target/release/crm-backend .

# Upload dir must be writable by appuser; a named volume is mounted here in
# compose (uploads survive `down`/rebuilds). Ownership is copied into a fresh
# volume on first mount.
RUN mkdir -p /app/uploads && chown appuser:appuser /app/crm-backend /app/uploads

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["./crm-backend"]
