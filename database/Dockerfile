FROM pgvector/pgvector:pg17

# Copy initialization scripts
COPY migrations/ /docker-entrypoint-initdb.d/

# Set environment variables
ENV POSTGRES_DB=crm_db
ENV POSTGRES_USER=crm_user
ENV POSTGRES_PASSWORD=crm_password
