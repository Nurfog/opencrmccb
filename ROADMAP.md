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
- [x] Charts:
  - PipelineBarChart (Recharts con soporte dark mode)
- [x] Kanban DnD:
  - KanbanBoard, KanbanColumn, KanbanCard (@dnd-kit)
  - Stage filtering por columna
- [x] Calendar view (FullCalendar con dayGrid, timeGrid, interaction)
- [x] Páginas implementadas:
  - Dashboard - 4 llamadas paralelas (stats, pipeline, top deals, activities)
  - Contacts - CRUD + paginación + sorting + CSV export
  - Companies - CRUD + paginación
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

_(nada en progreso actualmente)_

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
- [ ] Company selector con búsqueda asíncrona al crear contactos
  - [ ] Crear componente reusable `CompanyAsyncSelect` 
  - [ ] Integrar el nuevo selector en el modal/página de "Nuevo Contacto"
- [x] Filtro real en contacts page (por compañía, industria, etc.)

### Prioridad Media
- [ ] Pruebas end-to-end con Playwright
  - [ ] Configurar fixtures de prueba
  - [ ] Escribir smoke test del ciclo de creación de Deal
- [ ] Tags/labels personalizables para entities
  - [ ] Crear tabla `tags` (color, nombre) y tablas de join (ej. `contact_tags`)
  - [ ] Añadir componente UI para seleccionar y crear tags dinámicamente
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
- [ ] Agregar graceful shutdown al backend
- [ ] Cachear búsquedas frecuentes con Redis
- [ ] Agregar tests de integración para handlers
- [ ] Frontend: reemplazar `any` types en forms con tipos concretos

---

## 📊 Métricas del Proyecto

| Componente | Líneas de Código | Estado |
|------------|------------------|--------|
| Backend Rust | ~4,000 | ✅ Compila + Clippy clean |
| Frontend TSX | ~12,000 | ✅ Build + TypeScript clean |
| Tests | ~400 | ✅ 35 tests |
| API Docs | ~750 | ✅ OpenAPI 3.0 |
| Traducciones (i18n) | ~600 | ✅ ES/EN |
| CSS/Styles | ~800 | ✅ Dark mode |
| Docker | ~250 | ✅ 9 servicios |
| CI/CD | ~100 | ✅ GitHub Actions |
| Monitoring | ~100 | ✅ Prometheus + Grafana |
| Scripts | ~100 | ✅ Backup/Restore |
| **Total** | **~19,100** | **Producto Completo** |

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

*Última actualización: 22 de Junio, 2026*
