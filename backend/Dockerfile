# Pinned to the same toolchain CI tests (see .github/workflows/ci.yml).
ARG RUST_VERSION=1.97.1
FROM rust:${RUST_VERSION}-slim AS deps

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

FROM rust:${RUST_VERSION}-slim AS builder

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

RUN chown appuser:appuser /app/crm-backend

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["./crm-backend"]
