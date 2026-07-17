# OpenCRM - Roadmap

## Estado Actual: Producto Completo ✅

---

## ✅ Completado (v1.0)

### Backend (Rust + Axum)
- [x] Proyecto Rust con edición 2024, compilación clean con clippy -D warnings
- [x] Framework web Axum 0.8 con tower middleware
- [x] Conexión a PostgreSQL 17 con pool de conexiones SQLx
- [x] 21 migraciones de base de datos (users, companies, contacts, deals, activities, documents, audit_log, webhooks)
- [x] Endpoints REST API:
  - **Auth:** register, login, refresh (rate limited), logout, profile, change password
  - **Contacts:** CRUD, bulk delete, CSV export/import
  - **Companies:** CRUD, CSV export/import
  - **Deals:** CRUD, stage update (DnD), CSV export/import
  - **Activities:** CRUD con paginación y filtros
  - **Dashboard:** stats, pipeline, top deals, recent activities
  - **Search:** global cross-entity (contacts, companies, deals)
  - **Documents:** list, upload, download, delete
  - **Reports:** pipeline report, win/loss analysis
  - **Audit:** list, entity history
  - **Users:** list, delete, update role (admin)
  - **Webhooks:** CRUD (admin)
  - **Monitoring:** Prometheus metrics, health check
- [x] Middleware de autenticación JWT con role claims
- [x] RBAC - Admin-only endpoints y middleware
- [x] Rate limiting in-memory (5 req/min/IP en auth)
- [x] Input validation con `validator` crate en todos los modelos
- [x] Paginación server-side con búsqueda y sorting (columnas mapeadas)
- [x] CSV export/import con parsing RFC 4180 (csv crate)
- [x] LIKE injection prevention (escape %, _, \)
- [x] CORS configurable por entorno
- [x] Auth failure logging con `tracing`
- [x] Hashing de contraseñas con bcrypt (costo 12)
- [x] Email notifications con `lettre` (starttls)
- [x] Prometheus metrics (request count, duration histogram)
- [x] Refresh token rotation con SHA-256 hashing
- [x] OAuth 2.0 social login (Google, Microsoft, GitHub)
- [x] Token expiry configurabil (access 15min, refresh 30 días)
- [x] Enums de base de datos mapeados con sqlx (deal_stage, activity_type, webhook_event)
- [x] Webhook delivery system completo:
  - Worker background con tokio::spawn (polling 5s, batch 50)
  - Retry con backoff lineal (3 intentos: 1min → 5min → 1h)
  - HMAC-SHA256 signatures en delivery
  - Endpoint PATCH /webhooks/:id (toggle active, editar URL/secret)
  - Endpoint GET /webhooks/:id/deliveries (log de entregas)
  - Error logging en enqueue_event (tracing::warn)

### Frontend (Next.js 15 + Tailwind CSS 3.4)
- [x] Diseño estética Salesforce Lightning (SLDS) con CSS custom
- [x] Sidebar de navegación colapsable en móvil
- [x] Header global con búsqueda por Enter
- [x] Menú "New" desplegable (Contact, Company, Deal)
- [x] Dark mode toggle persistente (localStorage)
- [x] Language switcher ES/EN persistente
- [x] Componentes UI reutilizables:
  - Modal, ConfirmDialog, Pagination
  - Formularios (Contact, Company, Deal, ChangePassword)
  - Badge, Card, Button, Input, Table
  - Skeleton, EmptyState
  - ThemeToggle, LanguageSwitcher
  - Breadcrumbs
  - CompanyAsyncSelect (búsqueda async + quick-create)
  - Timeline (Audit Log + Activities combinados)
- [x] Charts:
  - PipelineBarChart (Recharts con soporte dark mode)
- [x] Kanban DnD:
  - KanbanBoard, KanbanColumn, KanbanCard (@dnd-kit)
  - Stage filtering por columna
- [x] Calendar view (FullCalendar con dayGrid, timeGrid, interaction)
- [x] Páginas implementadas:
  - Dashboard - 4 llamadas paralelas (stats, pipeline, top deals, activities)
  - Contacts - CRUD + paginación + sorting + CSV export + Vista 360° (sidebar + Timeline)
  - Companies - CRUD + paginación + Vista 360° (sidebar + Timeline)
  - Deals - Kanban DnD + vista tabla + stage filter + detail modal con historial
  - Activities - Calendar view + crear/ver actividades
  - Reports - Pipeline + Win/Loss desde endpoints reales
  - Documents - Upload drag & drop + lista + download + delete
  - Settings - Profile, Security, Notifications, Appearance, Language
  - Audit - Timeline + entity filter
  - Login - Con show/hide password
  - Register - Admin/auto first user
  - Forgot Password - UI placeholder
  - Help - FAQ
- [x] Quick-create contact/company inline en formulario de deal
- [x] Autenticación JWT completa:
  - Login/Register con tokens
  - ProtectedRoute component
  - API client centralizado con auth headers
  - Auto-refresh interceptor (401 → refresh → retry)
  - AuthProvider en root layout
- [x] UX/UI mejoras:
  - Toast notifications (success/error/warning/info)
  - Skeleton loading states
  - Responsive design (mobile-first)
  - Paginación con clamp
  - Empty states con acción
  - Animaciones CSS (fade-in, hover effects)
  - Keyboard shortcuts (Ctrl+K search)
  - Stage filtering en deals
  - Column sorting en contacts

### Internacionalización (i18n)
- [x] Soporte Español/Inglés con archivos JSON
- [x] Selector de idioma en header
- [x] Persistencia de preferencia (localStorage)
- [x] 150+ traducciones
- [x] Fallback a key si no hay traducción

### Infraestructura (Docker)
- [x] Docker Compose con 9 servicios:
  - `backend` - Rust API (puerto 8000)
  - `frontend` - Next.js standalone (puerto 3000)
  - `db` - PostgreSQL 17 + pgvector (puerto 5432)
  - `redis` - Redis 7 (puerto 6379)
  - `nginx` - Reverse proxy (puerto 80)
  - `prometheus` - Monitoring (puerto 9090)
  - `loki` - Log aggregation (puerto 3100)
  - `promtail` - Log shipping
  - `grafana` - Dashboards (puerto 3001)
- [x] Dockerfiles multi-stage optimizados
- [x] Migraciones automáticas al iniciar DB
- [x] Health checks para servicios críticos
- [x] Volúmenes para persistencia de datos
- [x] Prometheus scrape config
- [x] Grafana auto-provisioning (datasources + dashboards)
- [x] Backup scripts (pg_dump + restore con rotación)

### Testing & CI/CD
- [x] 35 tests unitarios (validation, pagination, CSV)
- [x] API documentation (OpenAPI 3.0 - ~750 líneas)
- [x] CI/CD pipeline (GitHub Actions):
  - Backend: cargo test + clippy + rustfmt
  - Frontend: npm build + lint
  - Docker build en main
- [x] Docker Compose para tests

### Seguridad
- [x] JWT con HS256 + role claims + refresh token rotation
- [x] Rate limiting en auth (5 req/min/IP)
- [x] Input validation (email, length, range) en todos los modelos
- [x] LIKE injection prevention (escape %, _, \)
- [x] CORS configurable por entorno
- [x] Auth failure logging (tracing::warn)
- [x] File size limits en uploads (10MB)
- [x] SQL injection prevention (parameterized queries SQLx)
- [x] Admin self-delete prevention

---

## 🔄 En Progreso

_(nada en progreso actualmente — ver hallazgos arquitectónicos en /tmp/opencode/architecture-review-*.html)_

---

## 📋 Mejoras Identificadas (Backlog)

### Prioridad Alta
- [x] Logout debe invalidar refresh token en servidor
- [x] Actividades CRUD completo (update, delete, complete)
  - [x] Detail views para contacts y companies (Vista 360)
  - [x] Layout con sidebar de info y tabs (Timeline, Deals, Documents)
  - [x] Componente `Timeline` combinando Audit Log + Activities
  - [x] Tabla compacta de Deals asociados
  - [x] Fetch paralelo de dependencias
- [x] Company selector con búsqueda asíncrona al crear contactos
  - [x] Crear componente reutilizable `CompanyAsyncSelect`
  - [x] Integrar el nuevo selector en el modal/página de "Nuevo Contacto"
- [x] Filtro real en contacts page (por compañía, industria, etc.)
- [x] **Repository layer** — Separar acceso a datos de handlers HTTP
  - [x] Crear `PgContactRepo` y `PgDealRepo` con SQL centralizado
  - [x] Refactorizar handlers para usar repositorios
- [x] **SQL queries consolidadas** — Módulo `queries/` por entidad
  - [x] Constantes `DEAL_SELECT`, `DEAL_SELECT_BY_ID` en `deal_queries.rs`
  - [x] Eliminar duplicación de SQL en deals.rs (8 copias → 1)
- [x] **Cross-cutting concerns centralizados** — Audit + Webhooks como traits
  - [x] `AuditPort` y `WebhookPort` traits en `domain_events.rs`
  - [x] `PgAuditAdapter` y `PgWebhookAdapter` concretos
  - [x] `DomainEventBus` para orquestar side-effects

### Prioridad Media
- [x] Pruebas end-to-end con Playwright
  - [x] Configurar fixtures de prueba (auth API, test-data)
  - [x] 25 tests: auth, contacts, companies, deals, leads, dashboard, settings
  - [x] CI pipeline con jobs backend, frontend, e2e
- [x] Tags/labels personalizables para entities
  - [x] Crear tabla `tags` (color, nombre) y tabla polymórfica `entity_tags`
  - [x] Añadir componente UI `TagsInput` con autocomplete y creación inline
  - [x] RBAC permissions para tags (migration 030)
  - [x] Integración en contact, company, deal y lead detail pages
- [ ] Notificaciones in-app en tiempo real
  - [ ] Implementar capa de WebSockets en Axum (o Server-Sent Events)
  - [ ] Conectar la UI del header para escuchar eventos y sumar contador (badge red)
- [ ] Import CSV dinámico (mapping de columnas)
  - [ ] Modificar endpoint de upload para leer cabeceras sin insertar
  - [ ] Añadir paso intermedio en UI donde el usuario mapee las columnas del archivo a la DB
  - [ ] Ejecutar el batch insert final
- [ ] Drag & drop reorder en Kanban (posición persistente)
  - [ ] Añadir campo `position` (integer) a los Deals
  - [ ] Endpoint `PATCH /api/v1/deals/reorder` que actualice los índices
- [ ] Multi-file upload en documentos
  - [ ] Ajustar el dropzone de UI para aceptar `multiple={true}`
  - [ ] Ejecutar peticiones concurrentes o modificar endpoint backend para recibir array de multipart
- [ ] Pipeline forecast basado en expected_close_date
  - [ ] Query SQL para proyectar "Revenue" por mes/trimestre
  - [ ] Renderizar gráfico "Forecast" en el Dashboard (Recharts)
- [ ] Actividad historial automática al crear/editar entidades
  - [ ] Conectar el Audit Log o disparar inserciones en la tabla `activities` (tipo 'System') en el backend
- [ ] Rate limiter distribuido con Redis (persistente)
  - [ ] Reemplazar limiter in-memory de Axum por comandos incrementales en Redis
- [x] Health check endpoint que verifique DB
- [x] **Frontend API split** — Dividir `api.ts` (1313 líneas) en módulos
  - [x] `api-client.ts` con lógica de request y refresh
  - [x] Módulos `api/auth.ts`, `api/contacts.ts`, `api/deals.ts`, `api/companies.ts`
  - [x] Tipos en `types/` (auth, contact, deal, company, activity)
- [x] **Config monolith descompuesto** — Sub-structs agrupados
  - [x] `DatabaseConfig`, `ServerConfig`, `AuthConfig`, `SmtpConfig`, `UploadConfig`, `OAuthProvidersConfig`
  - [x] Cada grupo con `from_env()` propio
  - [x] main.rs simplificado (eliminada copia manual de 30+ campos)
- [x] **UserPermissions cacheada** — 1 DB query por request (no N)
  - [x] Permisos cargados en `auth_middleware` y adjuntados a request extensions
  - [x] `UserPermissions` extractor lee de extensions, no de DB

### Prioridad Baja
- [ ] Temas visuales adicionales
- [ ] Avatar upload para usuarios
- [ ] Actividades recurrentes
- [ ] Email templates editables
- [x] Export PDF real con jspdf
- [ ] Modo oscuro automático según horario
- [ ] Atajos de teclado adicionales (Ctrl+E editar, Ctrl+D eliminar)
- [ ] Página 404 personalizada
- [ ] Tooltips en gráficos del dashboard
- [ ] Breadcrumbs dinámicos

### Técnico / Deuda
- [ ] Eliminar pgvector del schema si no se usa
- [ ] Migrar de `version: '3.8'` en docker-compose (obsoleto)
- [x] Agregar graceful shutdown al backend (ya implementado en main.rs)
- [ ] Cachear búsquedas frecuentes con Redis
- [ ] Agregar tests de integración para handlers
- [ ] Frontend: reemplazar `any` types en forms con tipos concretos
- [x] Frontend: httpOnly cookies (eliminado localStorage fallback)
- [x] Frontend: mutex para refresh concurrente en 401

---

## 📊 Métricas del Proyecto

| Componente | Líneas de Código | Estado |
|------------|------------------|--------|
| Backend Rust | ~5,000 | ✅ Compila + Clippy clean (repository + queries + domain events) |
| Frontend TSX | ~13,000 | ✅ Build + TypeScript clean (API modular) |
| Tests | ~400 | ✅ 35 tests |
| API Docs | ~750 | ✅ OpenAPI 3.0 |
| Traducciones (i18n) | ~600 | ✅ ES/EN |
| CSS/Styles | ~800 | ✅ Dark mode |
| Docker | ~250 | ✅ 9 servicios |
| CI/CD | ~100 | ✅ GitHub Actions |
| Monitoring | ~100 | ✅ Prometheus + Grafana |
| Scripts | ~100 | ✅ Backup/Restore |
| **Total** | **~20,100** | **Producto Completo + Arquitectura Mejorada** |

---

## 🛠 Stack Tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| Backend | Rust + Axum | 1.88 / 0.8 |
| Frontend | Next.js + React | 15.1 / 19 |
| CSS | Tailwind CSS | 3.4 |
| Charts | Recharts | 2.x |
| Calendar | FullCalendar | 6.x |
| DnD | @dnd-kit | 6.x / 10.x |
| i18n | Context API + JSON | - |
| Database | PostgreSQL | 17 |
| Vector Search | pgvector | 0.8.3 |
| ORM | SQLx | 0.8 |
| Auth | jsonwebtoken + bcrypt | 9 / 0.16 |
| Validation | validator | 0.19 |
| CSV | csv crate | 1.3 |
| Email | lettre | 0.11 |
| Metrics | prometheus | 0.13 |
| Logging | tracing + Loki | - |
| Monitoring | Prometheus + Grafana | 2.51 / latest |
| CI/CD | GitHub Actions | - |
| Container | Docker + Compose | 9 services |

---

*Última actualización: 17 de Julio, 2026*
