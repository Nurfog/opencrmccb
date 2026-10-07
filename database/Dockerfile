# Pinned pgvector version (0.8.3-pg17 exists on Docker Hub; if pull fails, revert to pgvector/pgvector:pg17)
FROM pgvector/pgvector:0.8.3-pg17

# Copy initialization scripts
COPY migrations/ /docker-entrypoint-initdb.d/

# DB config is passed via docker-compose environment, not hardcoded here
