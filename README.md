# OpenCRM - Customer Relationship Management System

A full-featured CRM system built with Rust (Axum), Next.js 15, PostgreSQL with pgvector, Recharts, FullCalendar, and full internationalization support (ES/EN).

## Tech Stack

- **Backend**: Rust with Axum web framework (Edition 2024)
- **Frontend**: Next.js 15 with Salesforce Lightning Design System (SLDS)
- **Database**: PostgreSQL 17 with pgvector extension
- **Charts**: Recharts
- **Calendar**: FullCalendar
- **Drag & Drop**: @dnd-kit
- **Email**: lettre (SMTP)
- **Monitoring**: Prometheus + Grafana + Loki
- **i18n**: Spanish & English support
- **Containerization**: Docker & Docker Compose (9 services)

## Features

### Core CRM
- Contact management with CRUD, bulk delete, CSV export/import
- Company management with industry tracking
- Deal pipeline with Kanban drag & drop (6 stages)
- Quick-create contact/company inline in deal form
- Activity calendar view (FullCalendar) with full CRUD + mark complete
- Document management with drag & drop upload
- User authentication (JWT with refresh token rotation)
- External integrations: Google, Microsoft, WhatsApp, Telegram, Twilio (OAuth 2.0 connection management)
- Admin user management

### Dashboard & Analytics
- Real-time stats (contacts, companies, deals, revenue)
- Pipeline bar chart (Recharts)
- Top deals by value
- Recent activities feed
- Pipeline report with conversion rates
- Win/loss analysis

### Data Management
- Server-side pagination with search and sorting
- CSV export/import with RFC 4180 parsing
- Bulk delete with transactional safety
- Global search across all entities

### UI/UX
- Salesforce Lightning Design System aesthetic
- Dark mode toggle
- Interactive dashboard with Recharts
- Kanban board with drag & drop (@dnd-kit)
- Calendar view for activities (FullCalendar)
- Toast notifications (success/error/warning/info)
- Skeleton loading states
- Responsive design (mobile-first)
- Tooltips, Breadcrumbs, Empty states
- Keyboard shortcuts (Ctrl+K search)
- Audit log timeline with automatic entity tracking

### Security
- JWT authentication with refresh token rotation
- Role-based access control (admin, user)
- Rate limiting on auth endpoints (5 req/min/IP)
- Input validation on all endpoints
- LIKE injection prevention
- CORS configurable per environment
- Auth failure logging
- File size limits on uploads

### Monitoring & Observability
- Prometheus metrics (request count, duration)
- Grafana dashboards (auto-provisioned)
- Loki log aggregation
- Auth failure/success logging

### Internationalization
- Español / English
- Language switcher in header
- 150+ translated strings
- Persistent language preference

## Prerequisites

- Docker & Docker Compose
- Rust 1.88+ (for local development)
- Node.js 20+ (for frontend development)

## Quick Start

1. Navigate to the project directory:

```bash
cd opencmrccb
```

2. Start all services:

```bash
docker compose up -d
```

3. Access the applications:

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | CRM Interface |
| Backend API | http://localhost:8000 | REST API |
| Nginx | http://localhost | Reverse Proxy |
| PostgreSQL | localhost:5432 | Database |
| Grafana | http://localhost:3001 | Dashboards (admin/admin) |
| Prometheus | http://localhost:9090 | Metrics |
| Loki | http://localhost:3100 | Logs |

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/dashboard` | Real metrics, pipeline chart, top deals |
| Contacts | `/contacts` | CRUD + sorting + pagination + CSV export/import |
| Companies | `/companies` | CRUD + sorting + pagination + CSV export/import |
| Deals | `/deals` | Kanban drag & drop + quick-create contact/company |
| Activities | `/activities` | Calendar view (FullCalendar) with full CRUD + mark complete |
| Reports | `/reports` | Pipeline + Win/Loss analytics |
| Documents | `/documents` | File upload with drag & drop |
| Settings | `/settings` | Profile, password, appearance, notifications |
| Audit | `/audit` | Audit log timeline |
| Help | `/help` | FAQ and support |
| Login | `/login` | Authentication with refresh tokens + OAuth (Google/Microsoft/GitHub) |
| Register | `/register` | User registration (setup only; then admin-only invite) |

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register (setup only: first user = admin; blocked after, rate limited)
- `POST /api/v1/auth/login` - Login (rate limited, returns access + refresh tokens)
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Revoke all refresh tokens
- `GET /api/v1/auth/me` - Get current user profile
- `PUT /api/v1/auth/profile` - Update profile
- `PUT /api/v1/auth/password` - Change password (revokes all refresh tokens)

### Integrations (authenticated)
- `GET /api/v1/integrations` - List connected integrations
- `GET /api/v1/integrations/{provider}/connect` - Get OAuth authorize URL
- `DELETE /api/v1/integrations/{provider}/disconnect` - Disconnect integration
- `GET /api/v1/integrations/{provider}/callback` - OAuth callback (public)

### Contacts
- `GET /api/v1/contacts` - List (paginated, searchable, sortable)
- `POST /api/v1/contacts` - Create
- `GET /api/v1/contacts/:id` - Get by ID
- `PUT /api/v1/contacts/:id` - Update
- `DELETE /api/v1/contacts/:id` - Delete
- `POST /api/v1/contacts/bulk-delete` - Bulk delete
- `GET /api/v1/contacts/export` - Export CSV
- `POST /api/v1/contacts/import` - Import CSV

### Companies
- `GET /api/v1/companies` - List (paginated, searchable, sortable)
- `POST /api/v1/companies` - Create
- `GET /api/v1/companies/:id` - Get by ID
- `PUT /api/v1/companies/:id` - Update
- `DELETE /api/v1/companies/:id` - Delete
- `GET /api/v1/companies/export` - Export CSV
- `POST /api/v1/companies/import` - Import CSV

### Deals
- `GET /api/v1/deals` - List (paginated, searchable, sortable)
- `POST /api/v1/deals` - Create
- `GET /api/v1/deals/:id` - Get by ID
- `PUT /api/v1/deals/:id` - Update
- `DELETE /api/v1/deals/:id` - Delete
- `PATCH /api/v1/deals/:id/stage` - Update stage (for DnD)
- `GET /api/v1/deals/export` - Export CSV
- `POST /api/v1/deals/import` - Import CSV

### Dashboard
- `GET /api/v1/dashboard/stats` - Statistics
- `GET /api/v1/dashboard/pipeline` - Pipeline by stage
- `GET /api/v1/dashboard/top-deals` - Top deals
- `GET /api/v1/dashboard/recent-activities` - Recent activities

### Search
- `GET /api/v1/search?q=term` - Global search across contacts, companies, deals

### Documents
- `GET /api/v1/documents` - List documents
- `POST /api/v1/documents/upload` - Upload file (multipart)
- `GET /api/v1/documents/:id/download` - Download file
- `DELETE /api/v1/documents/:id` - Delete document

### Reports
- `GET /api/v1/reports/pipeline` - Pipeline report with totals by stage
- `GET /api/v1/reports/win-loss` - Win/loss analysis

### Audit
- `GET /api/v1/audit` - List audit logs
- `GET /api/v1/audit/entity/:type/:id` - Entity history

### Admin
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user (admin only)
- `DELETE /api/v1/users/:id` - Delete user
- `PUT /api/v1/users/:id/role` - Update user role
- `GET /api/v1/webhooks` - List webhooks
- `POST /api/v1/webhooks` - Create webhook
- `DELETE /api/v1/webhooks/:id` - Delete webhook

### Monitoring
- `GET /metrics` - Prometheus metrics
- `GET /api/v1/health` - Health check (includes DB connectivity status)

## Project Structure

```
opencmrccb/
├── backend/                    # Rust API (Axum)
│   ├── src/
│   │   ├── main.rs            # App state, routes, middleware
│   │   ├── lib.rs             # Library exports
│   │   ├── config.rs          # Environment configuration
│   │   ├── db.rs              # Database connection pool
│   │   ├── handlers/          # 14 handler modules
│   │   ├── middleware/        # Auth, rate limiting, metrics
│   │   ├── models/            # 13 model modules
│   │   └── services/          # Email service
│   ├── tests/                 # 35 unit tests
│   ├── Cargo.toml
│   └── Dockerfile
├── frontend/                   # Next.js 15 + Tailwind
│   ├── src/
│   │   ├── app/               # 13 pages (App Router)
│   │   ├── components/        # UI, charts, kanban, auth
│   │   ├── contexts/          # i18n, toast, theme, auth
│   │   ├── hooks/             # Keyboard shortcuts
│   │   ├── lib/               # API client, utils, i18n
│   │   └── stores/            # Zustand auth store
│   ├── package.json
│   └── Dockerfile
├── database/
│   └── migrations/            # 24 SQL migrations
├── monitoring/
│   ├── prometheus.yml
│   ├── promtail-config.yml
│   └── grafana/provisioning/
├── scripts/
│   ├── backup-db.sh
│   └── restore-db.sh
├── nginx/
│   └── nginx.conf
├── docs/
│   └── openapi.yaml
├── .github/workflows/ci.yml
├── docker-compose.yml         # 9 services
├── docker-compose.test.yml
├── .env.example
├── ROADMAP.md
└── README.md
```

## Security

| Feature | Implementation |
|---------|---------------|
| Authentication | JWT with HS256 + refresh token rotation |
| Authorization | Role-based (admin, user) |
| Rate Limiting | 5 requests/min/IP on auth |
| Input Validation | email, length, range on all models |
| SQL Injection | Parameterized queries (SQLx) |
| LIKE Injection | Escaped special characters (%, _, \) |
| CORS | Configurable per environment |
| Password Hashing | bcrypt with default cost |
| CSV Parsing | RFC 4180 compliant (csv crate) |
| Auth Logging | Failed/successful attempts logged |
| File Upload | Size limits (10MB) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://crm_user:crm_password@localhost:5432/crm_db` | PostgreSQL connection |
| `JWT_SECRET` | **required** | JWT signing secret |
| `REFRESH_TOKEN_SECRET` | falls back to JWT_SECRET | Refresh token secret |
| `ACCESS_TOKEN_EXPIRY_MINUTES` | `15` | Access token TTL |
| `REFRESH_TOKEN_EXPIRY_DAYS` | `30` | Refresh token TTL |
| `SERVER_HOST` | `0.0.0.0` | Backend bind address |
| `SERVER_PORT` | `8000` | Backend port |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed CORS origins |
| `SMTP_HOST` | `localhost` | SMTP server |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | `""` | SMTP username |
| `SMTP_PASSWORD` | `""` | SMTP password |
| `SMTP_FROM` | `noreply@crm.local` | Sender address |
| `EMAIL_ENABLED` | `false` | Toggle email |
| `UPLOAD_DIR` | `./uploads` | File upload directory |
| `MAX_FILE_SIZE_MB` | `10` | Max upload size |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API URL |

## Local Development

### Backend

```bash
cd backend
JWT_SECRET=your-secret-key cargo run
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Tests

```bash
cd backend
cargo test
```

### Backup

```bash
# Create backup
./scripts/backup-db.sh

# Restore from backup
./scripts/restore-db.sh backups/crm_db_20260620_120000.sql.gz
```

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed project roadmap.

## License

MIT
