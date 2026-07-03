# Pendientes por Implementar

> Generado desde auditoría de features el 2026-07-02.
> Para implementar en una sesión futura.

---

## ALTA prioridad

### 1. Propuestas/Cotizaciones (módulo completo)
- [ ] Migration: `proposals` table (id, deal_id FK, title, status [draft/sent/accepted/rejected], total, currency, valid_until, notes, created_by, created_at, updated_at)
- [ ] Migration: `proposal_items` table (id, proposal_id FK, description, quantity, unit_price, total)
- [ ] Model: `Proposal`, `ProposalItem`, `CreateProposal`, `UpdateProposal`
- [ ] Handler: CRUD (list, get, create, update, delete, send, accept, reject)
- [ ] Routes: `/api/v1/proposals` (auth_routes)
- [ ] Frontend: `/proposals` page con tabla + create/edit modal
- [ ] Frontend: `/proposals/[id]` detail page con items + status workflow
- [ ] Vincular proposal a deal (deal detail page muestra proposal asociada)
- [ ] Export proposal como PDF (reutilizar jspdf)

### 2. Notifications UI + preferences persistence
- [ ] Frontend: campanita en header con badge de unread count
- [ ] Frontend: dropdown con lista de notificaciones + "mark all read"
- [ ] Frontend: polling cada 30s para unread count
- [ ] Backend: crear tabla `notification_preferences` (user_id, email_enabled, push_enabled, weekly_digest, marketing_emails)
- [ ] Backend: implementar `update_notification_preferences` (actualmente es no-op)
- [ ] Backend: implementar `get_notification_preferences` real desde DB
- [ ] Frontend: Settings → Notification toggles wired a API real

### 3. Dashboard top deals expected_close_date
- [ ] Frontend: `dashboard/page.tsx` — renderizar `deal.expected_close_date` en vez de "-"
- [ ] Verificar que el backend devuelve el campo en `get_top_deals`

---

## MEDIA prioridad

### 4. Microsoft Calendar sync
- [ ] Backend: registrar route para `microsoft_callback` en `routes.rs`
- [ ] Frontend: conectar Microsoft en calendar page

### 5. Multi-file document upload
- [ ] Backend: aceptar múltiples archivos en `upload_document`
- [ ] Frontend: input `multiple` + upload progresivo

### 6. Report export (PDF/CSV)
- [ ] Frontend: botones de export en reports page
- [ ] Backend: endpoints de export (o reutilizar datos existentes con jspdf)

### 7. CSV import buttons en companies/deals/leads
- [ ] Frontend: botones de import en list pages
- [ ] Ya hay API methods, solo falta UI

### 8. Pipeline forecast
- [ ] Backend: endpoint que calcule forecast basado en `expected_close_date` y stage probabilities
- [ ] Frontend: sección de forecast en dashboard o reports

### 9. Webhook delivery
- [ ] Backend: dispatch events cuando se crean/actualizan/borran entities
- [ ] Backend: queue de delivery con retry

### 10. Avatar upload
- [ ] Backend: endpoint `POST /api/v1/auth/avatar` (accept multipart, store in uploads/)
- [ ] Frontend: reemplazar TODO con llamada real al API

### 11. Rate limiter Redis persistente
- [ ] Rate limiter actual usa HashMap in-memory
- [ ] Migrar a Redis-backed rate limiting (ya hay `redis` crate en deps)

---

## BAJA prioridad

### 12. Recurring activities
- [ ] Backend: lógica de recurrence (daily/weekly/monthly)
- [ ] Frontend: selector de recurrence en activity form

### 13. Custom 404 page
- [ ] Crear `frontend/src/app/not-found.tsx`

### 14. Remove pgvector
- [ ] Eliminar `CREATE EXTENSION vector` de migration 001 si no se usa

### 15. Playwright E2E tests
- [ ] Instalar `@playwright/test`
- [ ] Tests de smoke: login → dashboard → contacts → deals

### 16. Dynamic breadcrumbs
- [ ] Componente que lea la ruta y genere breadcrumbs automáticamente

### 17. Dashboard chart tooltips
- [ ] Agregar tooltips a recharts charts

### 18. Replace `any` types
- [ ] Form components: tipar `onSubmit` e `initialData` correctamente

---

## Notas de implementación

- **Propuestas**: seguid el patrón de `handlers/deals.rs` + `models/deal.rs` para la estructura
- **Notificaciones UI**: usar `components/ui/notification-center.tsx` que ya existe pero no está conectado al header
- **Dashboard fix**: solo cambiar 1 línea en `dashboard/page.tsx`
- Migraciones: append-only, numeradas (las actuales llegan a 024)
- Convenciones: snake_case backend, kebab-case frontend, `{ data: T }` envelope
