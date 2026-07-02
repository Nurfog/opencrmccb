# AGENTS.md

## Quick Commands

### Backend (Rust + Axum)
```bash
cd backend
cargo check                              # compile check
cargo test                               # unit tests (needs running Postgres)
cargo clippy -- -D warnings              # lint (zero warnings enforced)
cargo fmt -- --check                     # format check
```

### Frontend (Next.js 15 + React 19 + Tailwind 3.4)
```bash
cd frontend
npm ci                                   # install deps
npm run build                            # production build
npm run lint                             # ESLint
npm run dev                              # dev server on :3000
```

### Database
```bash
# Migrations run on container start. To run manually:
for f in database/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

### Docker
```bash
docker compose up                        # full stack (9 services)
docker compose -f docker-compose.test.yml up  # test DB on :5433
```

### CI Verification Order
`cargo fmt --check` → `cargo clippy -- -D warnings` → `cargo test` → `npm run build` → `npm run lint`

## Architecture

- **Backend**: Rust edition 2024, Axum 0.8, SQLx 0.8, entry at `backend/src/main.rs`
- **Frontend**: Next.js 15.1, React 19, Zustand for state, Tailwind 3.4 with CSS custom properties for theming
- **DB**: PostgreSQL 17 + pgvector. 18 numbered migrations in `database/migrations/`. Auto-run on `docker compose up`.
- **API**: All routes under `/api/v1/`. Route definitions in `backend/src/routes.rs`. Auth via JWT (HS256) + refresh token rotation.
- **Auth/RBAC**: `auth_routes()` applies JWT middleware. `admin_routes()` wraps with `admin_only_middleware` (role == "admin").
- **i18n**: JSON files in `frontend/src/lib/i18n/`. Language stored in localStorage. Context provider at app root.

## Conventions

- Backend: Rust snake_case, `thiserror` for errors, `validator` crate for input validation
- Frontend: kebab-case filenames, Tailwind utility classes, Radix UI primitives under `frontend/src/components/ui/`
- All API responses: `{ data: T }` on success, `{ error: string }` on failure
- Dark mode: CSS class-based (`darkMode: ["class"]`), toggled via `ThemeToggle` component
- Frontend API client: `frontend/src/lib/api.ts` — handles auth headers, auto-refresh on 401

## Key Files

| Purpose | Path |
|---------|------|
| API routes | `backend/src/routes.rs` |
| Server entry / AppState | `backend/src/main.rs` |
| Config (env vars) | `backend/src/config.rs` |
| API client (fetch wrapper) | `frontend/src/lib/api.ts` |
| Translations | `frontend/src/lib/i18n/` |
| Migrations | `database/migrations/*.sql` (numbered 001–018) |
| Docker stack | `docker-compose.yml` (9 services) |
| CI pipeline | `.github/workflows/ci.yml` |
| Env template | `.env.example` (copy to `.env`) |

## Gotchas

- **Edition 2024**: Backend requires a recent stable Rust toolchain (1.85+). If `cargo check` fails with edition errors, update rustup.
- **`network_mode: host`**: All Docker services run on localhost. Ports are real host ports, not mapped.
- **Test DB is separate**: `docker-compose.test.yml` runs Postgres on port 5433. `docker-compose.yml` dev DB is on 5432.
- **`jspdf` in package.json**: Dead dependency — not imported anywhere. Safe to ignore or remove.
- **pgvector in Dockerfile**: Extension installed but no vector columns used yet. Don't add vector features without confirming pgvector version compatibility.
- **`NEXT_PUBLIC_API_URL`**: Must be set in frontend env. Defaults to `http://localhost:8000`.
- **Migrations are non-destructive numbered SQL**: Never rename a migration file. Append new ones with next number.
- **No frontend test runner**: `npm test` is not configured. CI only runs `build` + `lint` for frontend.
