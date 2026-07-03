FROM pgvector/pgvector:pg17

# Copy initialization scripts
COPY migrations/ /docker-entrypoint-initdb.d/

# DB config is passed via docker-compose environment, not hardcoded here
