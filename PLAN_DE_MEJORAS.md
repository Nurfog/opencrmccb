# Plan de Mejoras y Fixes — OpenCMRCCB

> Documento de ejecución. Marca cada item con `[x]` al completarlo.
> Respeta las convenciones de `AGENTS.md` (snake_case backend, kebab-case frontend,
> `thiserror` + `validator`, `{ error: string }` / `{ data: T }`, migraciones solo
> append, `network_mode: host` intacto, `cargo clippy -- -D warnings`,
> `cargo fmt --check`, `npm run build` + `lint`).
>
> **No commitear** sin confirmación explícita del usuario por commit (o por lote).
>
> Auditoría completa: 4 areas paralelas (backend, frontend, db/infra, docs/tests).
> ~75 issues distribuidos: 11 criticos, 46 altos, 60+ medios, 38+ bajos.

---

## Convenciones de ejecucion (por commit)

1. **Read** del archivo(s) afectado(s) antes de editar.
2. **Edit** minimizando diff; respetar estilo vecino.
3. **Verificar**:
   - Backend: `cd backend && cargo fmt -- --check && cargo clippy -- -D warnings && cargo check`
   - Frontend: `cd frontend && npm run build && npm run lint`
   - Si toca DB: `psql "$DATABASE_URL" -f database/migrations/NNN_*.sql` en DB de test.
4. **Reportar** al usuario el diff y pedir confirmacion antes de `git commit`.
5. **Nunca** renombrar migraciones existentes; solo agregar nuevas numeradas.
6. **Nunca** commitear `.env` ni secretos.

---

# FASE 1 — Estabilizacion critica (security + runtime roto)

> Objetivo: sistema arranca seguro; endpoints admin/activities/webhook/calendar
> funcionan. ~11 commits.

## 1.1 Eliminar secretos硬codificados en compose y DB Dockerfile
- [x] Editar `docker-compose.yml`:
  - Linea 38: `JWT_SECRET: "a6Gm7y3QxYkL8fR2tPpV9uZsHnC1jD5b"` → `JWT_SECRET: ${JWT_SECRET:?JWT_SECRET must be set in .env}`
  - Linea 39: `REFRESH_TOKEN_SECRET: "X4n8Tz1SgM6qWpR5eV0cKyYbHj7uL2oF"` → `REFRESH_TOKEN_SECRET: ${REFRESH_TOKEN_SECRET:?REFRESH_TOKEN_SECRET must be set in .env}`
  - Linea 12: `POSTGRES_PASSWORD: crm_password` → `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in .env}`
- [x] Editar `database/Dockerfile`:
  - Linea 7-9: eliminar `ENV POSTGRES_PASSWORD=crm_password` y `ENV POSTGRES_USER=crm_user` y `ENV POSTGRES_DB=crm_db` (los provee compose).
- [x] Editar `.env.example`:
  - Anotar que `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `POSTGRES_PASSWORD` son obligatorios y como generarlos (`openssl rand -base64 48`).
  - Alinear nombres Grafana: `GRAFANA_USER`/`GRAFANA_PASSWORD` → `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD` (coincide con compose lineas 94-95).
- [x] Rotar el `.env` real en disco (no commitear): `openssl rand -base64 48` para JWT/refresh; `pwgen 24 1` para Grafana.
- [x] Verificar: `docker compose config` no tira error de vars faltantes con `.env` cargado.
- [x] Commit: `fix(security): remove hardcoded secrets from compose and DB Dockerfile`

## 1.2 Validar JWT_SECRET / REFRESH_TOKEN_SECRET al arranque
- [x] `backend/src/config.rs`:
  - Linea 39-41: eliminar DEFAULT de `DATABASE_URL` (debe ser obligatorio con `expect`).
  - Linea 45-49: ademas del check del placeholder, agregar `JWT_SECRET.len() >= 32` → panic si menor.
  - Linea 52-54: `REFRESH_TOKEN_SECRET` obligatorio; panic si es igual a `JWT_SECRET`.
- [x] `backend/src/main.rs`: propagar error claro en log si config inviable.
- [x] Verificar: `cargo check` y prueba manual sin `.env` arranca con panic claro.
- [x] Commit: `fix(security): require JWT/refresh secrets with min-length validation`

## 1.3 Incluir role en JWT claims y reparar admin check de notifications
- [x] `backend/src/handlers/auth.rs`:
  - `create_access_token` (linea 30-46): agregar `role` a los claims leyendolo de DB (join `users` con `profiles` o mantener columna si se revierte 019 — ver commit 1.10).
- [x] `backend/src/middleware/auth.rs`:
  - `Claims` (linea 13-20): `role: String` sin `#[serde(default)]` (es requerido).
- [x] `backend/src/handlers/notifications.rs:105`:
  - Reemplazar `if claims.role != "admin"` por `UserPermissions::require("notifications.manage")` o `settings.edit`.
- [x] Verificar: `cargo clippy` + test manual: un user con perfil admin ve el endpoint; uno sin el permiso recibe 403.
- [x] Commit: `fix(auth): include role in JWT and use permission check in notifications`

## 1.4 Reordenar middlewares admin (auth antes que admin_only)
- [x] `backend/src/routes.rs:104-117`:
  - Layer order actual: `csrf_middleware.layer(admin_only_middleware.layer(auth_middleware.layer(router)))`.
  - Correcto: `auth_middleware` debe ser la **capa mas externa** para populate Claims antes que `admin_only`.
  - Reescribir como: `auth_middleware.layer(admin_only_middleware.layer(csrf_middleware.layer(router)))` (o el orden que haga que `auth_middleware` sea el primero en verse en el path del request).
- [x] Verificar con test: `GET /api/v1/users` con token admin → 200; con token no-admin → 403; sin token → 401.
- [x] Commit: `fix(routes): reorder middleware so auth populates claims before admin_only`

## 1.5 Conectar UserPermissions en handlers de auth_routes
- [x] Por cada handler mutating en `auth_routes()` agregar extractor `UserPermissions` y llamar `perms.require("<permiso>")`:
  - `handlers/contacts.rs`: create/update/delete → `contacts.create`/`contacts.edit`/`contacts.delete`; list/get → `contacts.view`.
  - `handlers/companies.rs`: analogo `companies.*`.
  - `handlers/leads.rs`: `leads.*` (incluido `/convert`).
  - `handlers/deals.rs`: `deals.*`.
  - `handlers/documents.rs`: `documents.*`.
  - `handlers/activities.rs`: `activities.*`.
  - `handlers/tags.rs`: `tags.*`.
  - `handlers/email.rs`: `email.*`.
  - `handlers/audit.rs`: `audit.view`.
  - `handlers/dashboard.rs`: `dashboard.view`.
  - `handlers/reports.rs`: `reports.view`.
  - `handlers/search.rs`: `search.view`.
  - `handlers/ai.rs`: `ai.use`.
  - `handlers/calendar.rs`: `calendar.*`.
- [x] Confirmar que `UserPermissions::require` lanza `FORBIDDEN` cuando falta el permiso.
- [x] Si algun permiso no esta definido en migration 019, agregar a `database/migrations/02X_*.sql` con `INSERT ... ON CONFLICT DO NOTHING`.
- [x] Verificar: `cargo clippy` + test de integracion nuevo cubriendo RBAC (ver Fase 4 tests).
- [x] Commit: `fix(rbac): enforce UserPermissions across auth_routes handlers`

## 1.6 Reparar SQL con escapes rotos en raw strings
- [x] `backend/src/handlers/activities.rs`:
  - Linea 94 `create_activity`: dentro de `r#"..."#` cambiar `\"activity_type\"` por `"activity_type"` (raw string no escapa comillas).
  - Linea 154 `update_activity`: mismo fix.
  - Linea 240 `complete_activity`: mismo fix.
- [x] `backend/src/handlers/webhooks.rs:35` `create_webhook`: mismo fix.
- [x] Verificar: `cargo test` con un nuevo test que llame a `POST /api/v1/activities` y devuelva 201 (no 500).
- [x] Commit: `fix(sql): remove invalid backslash-escapes inside raw strings`

## 1.7 Calendar: usar claims.sub en lugar de Uuid::nil()
- [x] `backend/src/handlers/calendar.rs`:
  - `google_callback` (25-), `create_event`, `update_event`, `delete_event`, `list_events`, `sync_google`:
    reemplazar `Uuid::nil()` ("Placeholder") con `claims.sub` (extraer via `Extension<Claims>` o `UserPermissions`).
  - Si `microsoft_callback` (88-145) no esta montada en routes, eliminarla (dead code).
- [x] Verificar: dos usuarios no pueden leer/editar eventos del otro (test manual o nuevo).
- [x] Commit: `fix(calendar): isolate events per user via JWT subject`

## 1.8 Rate-limit + verificacion de firma en WhatsApp webhook publico
- [x] `backend/src/routes.rs:13-16`:
  - Separar `POST /api/v1/integrations/whatsapp/webhook` del GET verify.
  - Envolver el POST con `rate_limiter.layer()` (limit 30/min/IP) y un middleware de firma HMAC SHA256 (`X-Hub-Signature-256`).
  - Config nueva: `WHATSAPP_APP_SECRET` en `.env.example` (validado en config.rs).
- [x] `backend/src/handlers/whatsapp.rs`:
  - `webhook_receive` (357-426): computar `hmac_sha256(payload, app_secret)` y comparar con header; devolver 401 si mismatch.
  - Envolver inserts de `whatsapp_messages` en transaccion + `ON CONFLICT (message_id) DO NOTHING` (requiere UNIQUE constraint — ver Fase 1.9 o agregar en migration nueva).
- [x] `backend/src/middleware/rate_limit.rs`:
  - `MAX_REQUESTS` 5 → 15 por minuto para login/registrar (RL3).
- [x] Verificar: `curl` sin firma → 401; con firma valida → 200 y no duplica mensajes.
- [x] Commit: `fix(whatsapp): verify Meta signature and rate-limit public webhook`

## 1.9 Trigger `updated_at` en todas las tablas aplicables
- [x] Crear `database/migrations/020_updated_at_trigger.sql`:
  ```sql
  CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
  BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
  $$ LANGUAGE plpgsql;
  -- Aplicar a cada tabla con updated_at:
  -- users, contacts, companies, deals, leads, activities, documents,
  -- webhooks, user_integrations, whatsapp_config, whatsapp_messages,
  -- ai_config, pipelines, pipeline_stages, profiles, profile_permissions,
  -- branding, tags, lead_extractions, calendar_tokens, calendar_events,
  -- email_logs, email_templates.
  CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  -- ... repetir por tabla
  ```
- [x] Confirmar lista exacta de tablas con `updated_at` leyendo migraciones 001-019.
- [x] Commit: `feat(db): add updated_at trigger function for all applicable tables`

## 1.10 Hacer no-destructiva la migracion 019 (conservar users.role)
- [x] `database/migrations/019_rbac_profiles_permissions.sql`:
  - Linea 67 `ALTER TABLE users DROP COLUMN role;` → comentar o reemplazar por `ALTER TABLE users ALTER COLUMN role DROP NOT NULL;` (mantener para backward compat y logs de auditoria).
  - Actualizar el UPDATE incondicional (linea 62-65) para mapear explicitamente `role = 'admin'` → profile Administrador y resto → Vendedor, con WHERE分明.
- [x] Verificar que los handlers que chequen role (notificaciones ya arreglado en 1.3) funcionen con datos legacy.
- [x] Commit: `fix(db): make migration 019 non-destructive (nullable role stays)`

## 1.11 Nginx: TLS + HSTS + gzip + client_max_body_size
- [x] `nginx/nginx.conf`:
  - Agregar `listen 443 ssl;` + `ssl_certificate`/`ssl_certificate_key` desde vars de env (documentar en `.env.example` `NGINX_SSL_CERT`/`NGINX_SSL_KEY`).
  - Agregar `Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`.
  - Agregar `gzip on; gzip_types text/css application/javascript application/json text/plain;`.
  - Agregar `client_max_body_size 12m;` (cubre `MAX_FILE_SIZE_MB=10`).
  - Agregar redirect 80 → 443.
- [x] Documentar en README que en `network_mode: host` el cert puede ser self-signed para dev o Let's Encrypt para prod.
- [x] Commit: `fix(nginx): add TLS, HSTS, gzip, body size limit`

---

# FASE 2 — Bugs altos funcionales + data integrity

> ~14 commits. Sistema consistente y transaccional.

## 2.1 `convert_lead` envuelto en transaccion
- [x] `backend/src/handlers/leads.rs:324-466`:
  - `let mut tx = state.db.begin().await?;`
  - Reemplazar `state.db` por `&tx` en INSERT company, INSERT contact, INSERT deal, UPDATE lead converted.
  - `tx.commit().await?;` al final.
  - Propagar errores con `tx.rollback().await.ok();` antes de return AppError.
- [x] Verificar con test que fuerza un fallo en el ultimo INSERT → DB queda sin registros huerfanos.
- [x] Commit: `fix(leads): wrap convert_lead in transaction`

## 2.2 Refresh rotation: tx + reuse-detection cascade
- [x] `backend/src/handlers/auth.rs:334-377`:
  - Envolver `revoke_refresh_token` + `store_refresh_token` en `state.db.begin()`.
  - Cuando se detecte un token **revoked** presentado (linea 343-349), ademas de 401 ejecutar:
    ```sql
    UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1;
    ```
    (revoca toda la familia).
- [x] Test nuevo: dos usos del mismo refresh → segundo invalida todos los demas.
- [x] Commit: `fix(auth): wrap refresh rotation in tx with reuse-detection cascade`

## 2.3 `reset_password` envuelto en transaccion
- [x] `backend/src/handlers/auth.rs:816-863`:
  - Envolver UPDATE users.password_hash, UPDATE password_reset_tokens.used, UPDATE refresh_tokens.revoked en tx.
- [x] Commit: `fix(auth): wrap reset_password in transaction`

## 2.4 Singletons WhatsApp/Lead-assignment: bind id para ON CONFLICT real
- [x] `backend/src/handlers/whatsapp.rs:167-196` `update_whatsapp_config`:
  - Bindear `id` a un UUID fijo singleton (ej. `Uuid::from_str("00000000-0000-0000-0000-000000000001")`) en el INSERT, o reescribir como SELECT-then-UPDATE.
  - Ver migracion 008 para confirmar que `whatsapp_config.id` es UUID PK.
- [x] `whatsapp.rs:536-568` `update_lead_assignment_config`: mismo fix.
- [x] Commit: `fix(whatsapp): bind singleton id so ON CONFLICT updates instead of insert`

## 2.5 Registro atomico (primer usuario admin)
- [x] `backend/src/handlers/auth.rs:104-111`:
  - Reemplazar `SELECT COUNT(*)` + INSERT por:
    ```sql
    INSERT INTO users (...) VALUES (...) ON CONFLICT DO NOTHING RETURNING id;
    ```
    y control de "primer user = admin" con `SELECT 1 FROM users LIMIT 1` dentro del mismo tx.
  - Alternativa: advisory lock `pg_try_advisory_xact_lock(hash)`.
- [x] `database/migrations/021_first_user_admin_guard.sql` (si requiere constraint a nivel DB).
- [x] Test de concurrencia simulando dos registers simultaneos.
- [x] Commit: `fix(auth): atomic register for first-user-admin invariant`

## 2.6 CSV exports con streaming (COPY TO) en vez de cargar todo
- [x] `handlers/contacts.rs:254-305`, `companies.rs:254-307`, `deals.rs:270-326`:
  - Reemplazar `query_as` + builder String por `sqlx::query("COPY (...) TO STDOUT WITH CSV HEADER")` usando `PgCopyOut` o `query_as` paginado con cursor.
  - Alternativa simple: paginar con `LIMIT 1000 OFFSET N` en loop y escribir en `Response::stream`.
- [x] Cap duro: limite maximo de filas configurable (`EXPORT_MAX_ROWS=100000`).
- [x] Commit: `fix(exports): stream CSV to avoid OOM on large datasets`

## 2.7 Paginacion: i64 + clamp seguro
- [x] `backend/src/models/pagination.rs:27-29`:
  - `offset()`: cambiar u32 por i64; clamp `page.max(1).min(10000)` y `per_page.max(1).min(200)`.
  - `total_pages()` (60-69): usar i64.
- [x] `handlers/leads.rs:36-38`: sustituir i64 con `PaginationParams` o usar mismo clamp.
- [x] `handlers/activities.rs:13-21`, `audit.rs:39-47`: reutilizar `PaginationParams`.
- [x] Commit: `fix(pagination): i64 with safe clamps to prevent overflow`

## 2.8 Revertir deals.value a NUMERIC(15,2)
- [x] `database/migrations/022_deals_value_numeric.sql`:
  ```sql
  ALTER TABLE deals ALTER COLUMN value TYPE NUMERIC(15,2) USING value::NUMERIC(15,2);
  ```
- [x] `backend/src/models/deal.rs`: mapear con `sqlx::types::Decimal` (requires feature `rust_decimal` en Cargo.toml) o `bigdecimal`.
- [x] `Cargo.toml`: agregar `rust_decimal = "1"` + feature `sqlx?/rust_decimal`.
- [x] Verificar handlers que serializar como f64 (dashboard top_deals, reports) — ajustar a Decimal/serialize como string o number.
- [x] Commit: `fix(db): revert deals.value to NUMERIC(15,2) for monetary precision`

## 2.9 Cifrar tokens OAuth/WhatsApp/AI/Calendar en reposo
- [x] Crear `backend/src/services/crypto.rs`:
  - AES-256-GCM con key from `TOKEN_ENCRYPTION_KEY` (env, 32 bytes base64).
  - Funciones `encrypt(plaintext: &str) -> String` (nonce+ct base64) y `decrypt(...)`.
- [x] `database/migrations/023_encrypt_tokens.sql`:
  - Migrar columnas `user_integrations.access_token`, `user_integrations.refresh_token`, `whatsapp_config.api_token`, `ai_config.api_key`, `calendar_tokens.access_token`, `calendar_tokens.refresh_token` a `TEXT` (ya lo son) sin cambio de tipo pero documentar.
  - Add comment: los valores anteriores no estaban cifrados; re-cifrar via script de migracion de datos (opcional, one-shot).
- [x] `handlers/oauth.rs`, `whatsapp.rs::get_whatsapp_config/update_whatsapp_config`, `ai.rs::*`, `calendar.rs::google_callback/sync_google`:
  - Al leer: `decrypt(value)?`.
  - Al escribir: `encrypt(value)?`.
- [x] `config.rs`: validar `TOKEN_ENCRYPTION_KEY` obligatorio (base64 de 32 bytes).
- [x] Commit: `feat(security): encrypt OAuth/WhatsApp/AI/Calendar tokens at rest`

## 2.10 Envelope `{ data: T }` consistente en toda la API
- [x] Decision de diseño (pedir confirmacion al usuario al iniciar el commit):
  - Opcion A: agregar wrapper `JsonData<T>` en todas las responses exitosas → impacto: frontend debe leer `res.data`.
  - Opcion B: documentar en AGENTS.md que `PaginatedResponse<T>` YA es el envelope (tiene `data`/`total`/`page`) y que endpoints de entidad individual retornan `Json<T>` directo. Mas pragmático.
- [x] Si A:
  - `backend/src/error.rs` o nuevo `envelope.rs`: struct `ApiResponse<T> { data: T }`.
  - Reemplazar todos los `Json(x)` por `Json(ApiResponse { data: x })`.
  - `frontend/src/lib/api.ts`: unwrap `res.data` antes de retornar.
- [x] `backend/src/handlers/notifications.rs:142-150` `update_notification_preferences`: implementar persistencia real (ver P3 TODO) o eliminar la ruta.
- [x] Commit: `fix(api): adopt consistent { data: T } envelope`

## 2.11 Monitoring: localhost + metrics route + dashboards
- [x] `monitoring/prometheus.yml:7`: `targets: ['backend:8000']` → `['localhost:8000']`.
- [x] `monitoring/promtail-config.yml:8`: `url: http://loki:3100` → `http://localhost:3100`.
- [x] `monitoring/grafana/provisioning/datasources.yml`: `prometheus:9090` → `localhost:9090`; `loki:3100` → `localhost:3100`.
- [x] `backend/src/routes.rs`: exponer ruta `/metrics` (ya existe handler en `handlers/health.rs` o `middleware/metrics.rs`?) — verificar y montar.
- [x] Crear `monitoring/grafana/dashboards/` con al menos:
  - `backend-overview.json` (http requests, latencia, 5xx).
  - `db-pool.json`.
  - Montar volumen en `docker-compose.yml` de grafana.
- [x] Commit: `fix(monitoring): localhost targets + metrics route + grafana dashboards`

## 2.12 Docker backend: non-root + cache de capas + HEALTHCHECK
- [x] `backend/Dockerfile`:
  - Agregar `RUN useradd -r -u 1001 -g crm crm` y `USER crm` antes del CMD.
  - Optimizar capas: copiar primero `Cargo.toml` + `Cargo.lock`, ejecutar `cargo build` dummy, luego copiar `src/` y rebuild (cachea deps).
  - `cargo build --release --locked`.
  - `HEALTHCHECK --interval=30s CMD curl -f http://localhost:8000/health || exit 1`.
- [x] Crear `backend/.dockerignore` con: `target/`, `.env`, `.git/`, `tests/`.
- [x] Commit: `fix(docker): run backend as non-root with cache layers and healthcheck`

## 2.13 Frontend: eliminar fallback localStorage; httpOnly cookies
- [x] `frontend/src/lib/api.ts`:
  - Eliminar lineas 35-36 (localStorage writes) en `setTokens`.
  - Eliminar init del modulo que lee `document.cookie`/localStorage (lineas 23-37).
  - Todas las requests deben usar `credentials: "include"` y depender de la httpOnly cookie.
  - En `refreshAccessToken` (linea 88): body vacio o `{}` en lugar de `{ refresh_token: "" }`.
  - `documentsApi.download` (linea 717-724): agregar `credentials: "include"`.
- [x] `frontend/src/stores/auth-store.ts`:
  - Eliminar `getStoredUser` que lee localStorage (lineas 26-41).
  - Inicializar `user: null`, `isAuthenticated: false` sin leer storage.
  - Cargar via `initialize()` que llama a `/auth/me`.
- [x] Verificar que backend envie cookies httpOnly + SameSite=Lax en login/refresh y CORS con `allow_credentials(true)` (ya esta).
- [x] Commit: `fix(frontend): rely on httpOnly cookies, drop localStorage token fallback`

## 2.14 Frontend: mutex para refresh concurrente en 401
- [x] `frontend/src/lib/api.ts:162-173`:
  ```ts
  let refreshPromise: Promise<string | null> | null = null;
  async function refreshAccessToken(): Promise<string | null> {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => { /* logica actual */ })();
    try { return await refreshPromise; }
    finally { refreshPromise = null; }
  }
  ```
- [x] Test manual: dashboard con 4 calls paralelas → solo 1 refresh disparado.
- [x] Commit: `fix(frontend): serialize concurrent 401 refreshes with mutex`

---

# FASE 3 — Frontend bugs altos + consistencia media

> ~12 commits.

## 3.1 React error boundary + skeleton en ProtectedRoute
- [ ] Crear `frontend/src/app/error.tsx` (Next.js error boundary global):
  - Client component, recibe `error`/`reset`, muestra fallback + boton retry.
- [ ] `frontend/src/components/auth/protected-route.tsx`:
  - Mientras `!mounted` renderizar `<Skeleton>` o spinner en lugar de `null`.
- [ ] Commit: `feat(frontend): add root error boundary and skeleton gating`

## 3.2 Reparar logica de permisos en ProtectedRoute
- [ ] `protected-route.tsx:19`:
  - `permissionsLoaded` debe ser siempre boolean: `const permissionsLoaded = !!user && !!user.permissions?.length`.
  - Logica de redirect:
    ```ts
    useEffect(() => {
      if (mounted && isAuthenticated && requiredPermission && permissionsLoaded && !hasPermission(requiredPermission)) {
        router.replace("/");
      }
    }, [mounted, isAuthenticated, requiredPermission, permissionsLoaded, hasPermission, router]);
    ```
  - Si `isAuthenticated && requiredPermission && !permissionsLoaded`, lanzar `loadUser()`.
- [ ] Test: non-admin entra a `/admin` → redirect a `/`, no blank page.
- [ ] Commit: `fix(protected-route): correct permission loading and redirect`

## 3.3 Admin: input de nuevo stage por pipeline
- [ ] `frontend/src/app/admin/page.tsx:313`:
  - Reemplazar `const [newStageName, setNewStageName] = useState("")` por `Record<string, string>` (por pipeline id).
  - En el input, `value={newStageNameByPipeline[pipeline.id] ?? ""}` y `onChange` actualiza el map.
  - `handleAddStage(pipeline.id)` toma el valor del map y limpia ese key.
- [ ] Commit: `fix(admin): per-pipeline stage name input state`

## 3.4 Settings: upload de avatar via API client
- [ ] `frontend/src/app/settings/page.tsx:247-261`:
  - Eliminar `fetch("/api/auth/me/", ...)` hardcoded.
  - Agregar `authApi.uploadAvatar(file: File)` en `lib/api.ts` que use FormData + `credentials: "include"` + base URL correcta.
  - El backend debe tener `POST /api/v1/auth/avatar` multipart — si no existe, agregar endpoint o usar `PATCH /api/v1/auth/profile` con base64.
- [ ] Commit: `fix(settings): upload avatar through API client with auth`

## 3.5 Settings: toggles de notificaciones funcionales
- [ ] `frontend/src/app/settings/page.tsx:322-360`:
  - Agregar `useState` por toggle (4 toggles).
  - Persistir via `PATCH /api/v1/notifications/preferences` (backend ya tiene ruta; ver Fase 2.10 para implementar persistencia).
  - Si backend no esta listo, al menos reflejar estado local con toast "feature coming".
- [ ] Eliminar el texto enganoso `t("settings.notificationsNotPersisted")` si ahora persiste.
- [ ] Commit: `fix(settings): functional notification toggle persistence`

## 3.6 WhatsApp: implementar save-as-contact + arreglar O(n^2)
- [ ] `frontend/src/app/whatsapp/page.tsx:47-51`:
  - Implementar `handleSaveExtractedContact` que llame `contactsApi.create({...})` con los datos extraidos.
  - Toast despues de exito real, no antes.
- [ ] Linea 275, 277:
  - Pre-computar `const reversed = [...messages].reverse();` una vez antes del `.map`.
  - Usar `reversed[i-1]` en lugar de reverse en cada iteracion.
  - Guard `if (i === 0) showDate = true` evitando `[...messages].reverse()[-1]`.
- [ ] Commit: `fix(whatsapp): implement save-as-contact and O(1) message reverse`

## 3.7 i18n: anadir claves faltantes
- [ ] `frontend/src/lib/i18n/en.json` y `es.json`:
  - `documents.deleteDocument`: "Delete document" / "Eliminar documento".
  - `documents.deleteDocumentMessage`: "Delete \"{name}\"?" / "¿Eliminar \"{name}\"?".
  - `common.none`: "None" / "Ninguno".
  - `common.markAllRead`: "Mark all as read" / "Marcar todo como leido".
  - `common.cancel`: "Cancel" / "Cancelar" (si no existe).
  - `common.apply`: "Apply" / "Aplicar".
  - `toast.deleted`: "Deleted {entity}" / "{entity} eliminado".
- [ ] Commit: `fix(i18n): add missing keys for documents, common, notifications`

## 3.8 i18n: traducir strings hardcoded
- [ ] `frontend/src/components/ui/phone-link.tsx`: envolver todos los strings espanoles en `t(...)` (necesita `useI18n`).
- [ ] `frontend/src/app/calendar/page.tsx:380-449`: modal custom → usar `<Modal>` (que respete a11y) y traducir labels.
- [ ] `frontend/src/components/ui/confirm-dialog.tsx:47`: "Cancel" → `t("common.cancel")` (convertir a client component con `useI18n`).
- [ ] `frontend/src/components/ui/notification-center.tsx:105,149,159`: marcar todo como leido + titulos "Mark as read"/"Delete".
- [ ] `frontend/src/app/activities/page.tsx:303-344`: opciones del select → `t("activities.task")` etc.
- [ ] `frontend/src/components/ui/tags-input.tsx:129`: "Add tags..." → `t("tags.placeholder")`.
- [ ] `frontend/src/app/whatsapp/page.tsx:378-388`: labels de campos extraidos.
- [ ] Commit: `fix(i18n): translate hardcoded strings across components`

## 3.9 Settings: guard `window` + eliminar casts `as any`
- [ ] `frontend/src/app/settings/page.tsx:546`:
  ```tsx
  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/v1/integrations/whatsapp/webhook` : "";
  ```
- [ ] `frontend/src/app/contacts/[id]/page.tsx:270`, `companies/[id]/page.tsx:325`, `reports/page.tsx:164`:
  - Eliminar `as any` en `t(...)`. Si TS se queja, castear el key como `string` (el tipo de `t` ya acepta string).
- [ ] Commit: `fix(frontend): guard window access and remove unsafe casts`

## 3.10 Perf: dynamic-import FullCalendar, recharts, jspdf
- [ ] `frontend/src/app/activities/page.tsx` + `dashboard/page.tsx` + `contacts/page.tsx`:
  - Convertir imports de `@fullcalendar/*`, `recharts`, `jspdf` a:
    ```tsx
    const FullCalendar = dynamic(() => import("@fullcalendar/react"), { ssr: false });
    ```
  - Para `jspdf` en `pdf.ts`, exportar funciones async que importen jspdf dinamicamente.
- [ ] Verificar que `npm run build` no rompa y que el bundle inicial baje significativamente (comparar `.next/static`).
- [ ] Commit: `perf(frontend): lazy-load heavy libraries with next/dynamic`

## 3.11 ESLint flat config para CI
- [ ] Crear `frontend/eslint.config.mjs`:
  ```js
  import next from "eslint-config-next";
  export default [ ...next, { rules: { "react/no-unescaped-entities": "off" } } ];
  ```
  (O extender `next/core-web-vitals` con dependencia `eslint-config-next` agregada a package.json devDeps.)
- [ ] Verificar `npm run lint` no abre prompt y pasa en CI.
- [ ] Commit: `chore(frontend): add eslint flat config for non-interactive CI lint`

## 3.12 Layout: `<html lang>` dinamico + skeleton i18n
- [ ] `frontend/src/app/layout.tsx:17`:
  - Convertir `<html lang="es">` a un cliente wrapper que lea `useI18n().locale`, o usar `export const dynamic = "force-dynamic"` y leer locale de cookies.
  - Mientras i18n este `isLoading`, renderizar children dentro de un skeleton que oculte strings crudos.
- [ ] Comprometer traduccion por defecto es (preservar comportamiento actual de default).
- [ ] Commit: `fix(layout): dynamic html lang and i18n loading skeleton`

---

# FASE 4 — Backend media + low + docs/tests/dead code

> ~20 commits.

## 4.1 Redactar PII en logs
- [ ] `backend/src/handlers/auth.rs:219-237`: reemplazar `input.email` por hash/truncated en logs de login.
- [ ] `backend/src/services/email.rs:56-60`: demote `info!(subject)` a `debug!` o truncar.
- [ ] Commit: `fix(auth): redact emails and email subjects in logs`

## 4.2 No filtrar mensajes internos al cliente (io::Error)
- [ ] `backend/src/error.rs:60-64`: `From<std::io::Error>` mapear a `AppError::Internal("Internal server error".into())` y loguear el detalle con `tracing::error!`.
- [ ] Auditar otros `AppError::Internal(e.to_string())` que expongan internals (password_hash, serde_json) — mapearlos a generic + log.
- [ ] Commit: `fix(error): never leak internal error messages to clients`

## 4.3 Eliminar N+1 en list_users / list_profiles / list_pipelines
- [ ] `handlers/auth.rs:643-675` `list_users`: una sola query con `LEFT JOIN profile_permissions ... GROUP BY users.id, array_agg(profile_permissions.permission)`.
- [ ] `handlers/admin.rs:222-251` `list_profiles`: mismo JOIN + array_agg.
- [ ] `handlers/admin.rs:57-84` `list_pipelines`: JOIN con `pipeline_stages` + `array_agg` o json_agg.
- [ ] Comparar num queries con logs en dev.
- [ ] Commit: `perf(auth,admin): remove N+1 in list endpoints with array_agg`

## 4.4 Validacion de DTOs admin
- [ ] Agregar `#[validate(...)]` attrs en:
  - `handlers/admin.rs::PipelineInput`, `StageInput`, `ProfileInput`, `BrandingInput`.
  - `handlers/ai.rs::AIConfigInput`.
  - `handlers/whatsapp.rs::WhatsAppConfigInput`, `LeadAssignmentInput`, `AssignLeadInput`.
  - `handlers/email.rs::SendEmail` (cc/bcc length cap).
- [ ] Commit: `feat(validation): validate admin and integration DTOs`

## 4.5 Rate-limit IP confiable (no confiar X-Forwarded-For a ciegas)
- [ ] `backend/src/middleware/rate_limit.rs:137-154`:
  - Agregar config `TRUSTED_PROXY_HOPS: u32` (default 0 en `network_mode: host`).
  - Si hops=0 → usar `ConnectInfo<SocketAddr>` peer addr.
  - Si hops>0 → split X-F-F y tomar el hop `n - hops`.
  - Fallback a 127.0.0.1 solo si socket no disponible.
- [ ] Commit: `fix(rate-limit): configurable trusted proxy hops for client IP`

## 4.6 Indexes faltantes (migration 024)
- [ ] `database/migrations/024_add_indexes.sql`:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_deals_pipeline_stage ON deals(pipeline_stage_id);
  CREATE INDEX IF NOT EXISTS idx_deals_pipeline ON deals(pipeline_id);
  CREATE INDEX IF NOT EXISTS idx_users_profile ON users(profile_id);
  CREATE INDEX IF NOT EXISTS idx_lead_activities_created_by ON lead_activities(created_by);
  CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_agent ON whatsapp_messages(agent_id);
  CREATE INDEX IF NOT EXISTS idx_lead_extractions_status ON lead_extractions(status);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_external ON calendar_events(external_id);
  ```
- [ ] Commit: `perf(db): add missing indexes on FK and filtered columns`

## 4.7 Constraints faltantes (migration 025)
- [ ] `database/migrations/025_add_constraints.sql`:
  ```sql
  ALTER TABLE password_reset_tokens ADD CONSTRAINT uq_reset_token_hash UNIQUE (token_hash);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_pipeline_default ON pipelines(entity_type) WHERE is_default = true;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_stage_default ON pipeline_stages(pipeline_id) WHERE is_default = true;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_stage_position ON pipeline_stages(pipeline_id, position);
  ALTER TABLE documents ALTER COLUMN mime_type SET DEFAULT 'application/octet-stream';
  ```
- [ ] Commit: `fix(db): add unique constraints and defaults`

## 4.8 Migraciones idempotentes + framework sqlx-migrate
- [ ] Auditar migraciones 001-018: agregar `IF NOT EXISTS` a `CREATE TABLE`/`CREATE INDEX`.
- [ ] Migration 010 seed inserts: agregar `ON CONFLICT (slug DO NOTHING` en pipelines, `ON CONFLICT (name) DO NOTHING` en profiles.
- [ ] Reemplazar el loop shell `for f in database/migrations/*.sql` (AGENTS.md) por:
  - `sqlx migrate run` desde el backend al arranque (agregar feature `migrate` a sqlx en Cargo.toml) — proteger con flag `RUN_MIGRATIONS=true`.
- [ ] Actualizar AGENTS.md "Database" section.
- [ ] Commit: `chore(db): make migrations idempotent and adopt sqlx migrate`

## 4.9 Poblar ip_address / sent_by / created_by en auditoria
- [ ] `backend/src/handlers/audit.rs::insert_audit_log`: agregar parametro `ip_address: Option<IpAddr>` extraido del request.
- [ ] Audit middleware or helper que extraiga IP (usar misma logica que rate_limit 4.5).
- [ ] `handlers/email.rs::send_email` (linea 52-70) y `send_template`: bind `sent_by = Some(claims.sub)` en INSERT email_logs.
- [ ] `handlers/email.rs::create_template`: bind `created_by = claims.sub`.
- [ ] Commit: `feat(audit): populate ip_address, sent_by, created_by fields`

## 4.10 Refactor: extraer `fetch_user_permissions` helper + borrar `ValidationError`
- [ ] `backend/src/handlers/auth.rs`: crear `fn fetch_user_permissions(pool, user_id) -> Vec<String>` y reusar en los ~7 sitios.
- [ ] `backend/src/models/validation.rs`: borrar struct `ValidationError` si no se usa (verificar grep).
- [ ] Commit: `refactor(auth): extract permissions helper and drop dead ValidationError`

## 4.11 Limpiar deps muertas
- [ ] `backend/Cargo.toml`: eliminar `anyhow = "1"` (linea 40), `axum-extra` (linea 9) despues de confirmar grep 0 hits.
- [ ] Verificar que `multer = "2"` no se use directamente (grep `multer::`); si no, dejar que axum lo traiga transitivamente.
- [ ] `frontend/package.json`: confirmar si `@tailwindcss/typography` esta usado; si no, eliminar de devDeps.
- [ ] Correr `cargo clippy` y `cargo build` sin warnings.
- [ ] Commit: `chore(deps): remove unused anyhow, axum-extra, typography`

## 4.12 OAuth state store persistente con TTL
- [ ] `backend/src/lib.rs` `OAuthConfig.state_store`:
  - Cambiar `Arc<RwLock<HashMap<...>>>` por tabla DB `oauth_states` (migration 026):
    ```sql
    CREATE TABLE oauth_states ( state TEXT PK, user_id UUID, provider TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), expires_at TIMESTAMPTZ );
    ```
  - Insertar al generar; eliminar o ignorar despues de `expires_at`.
  - Opcional: limpiar con task periodica, pero TTL en SELECT es suficiente.
- [ ] Commit: `fix(oauth): persistent state store with TTL`

## 4.13 Pool DB: timeouts y min_connections
- [ ] `backend/src/db.rs:11`:
  ```rust
  PgPoolOptions::new()
    .max_connections(10)
    .min_connections(2)
    .acquire_timeout(Duration::from_secs(5))
    .idle_timeout(Duration::from_secs(600))
    .max_lifetime(Duration::from_secs(1800))
  ```
- [ ] Commit: `fix(db): configure pool timeouts and min connections`

## 4.14 Unificar filtros de paginacion
- [ ] Eliminar `ActivityFilter` duplicado (`handlers/activities.rs:13-21`); usar `PaginationParams` + struct separado `ActivityFilter` solo con campos de negocio.
- [ ] `AuditFilter` usar `PaginationParams` embebido.
- [ ] `DocumentFilter` agregar `PaginationParams`.
- [ ] `LeadQuery` alinear tipos con `PaginationParams` (u32, no i64).
- [ ] Commit: `refactor(api): unify pagination and filter types`

## 4.15 WhatsApp webhook: dedup por message_id
- [ ] `database/migrations/027_whatsapp_msg_unique.sql`:
  ```sql
  ALTER TABLE whatsapp_messages ADD CONSTRAINT uq_msg_id UNIQUE (message_id);
  ```
- [ ] `handlers/whatsapp.rs::webhook_receive`: insert con `ON CONFLICT (message_id) DO NOTHING` y devolver 200 igual (idempotente).
- [ ] Commit: `fix(whatsapp): dedupe webhook messages via unique constraint`

## 4.16 OAuth: extraccion de permisos cacheada, no substring CASCO
- [ ] Revisar `oauth.rs::IntegrationStatus`: eliminar config de providers telegram/twilio si no implementados (dead paths).
- [ ] Commit: `chore(oauth): remove dead provider integrations`

## 4.17 CSP nonce-based en nginx
- [ ] `nginx/nginx.conf:29`: reemplazar `'unsafe-inline' 'unsafe-eval'` por nonce o hash-based CSP, con middleware de Next.js que genere nonces.
- [ ] Verificar que FullCalendar y recharts funcionen (pueden requerir `'unsafe-eval'` para algunos casos — evaluar).
- [ ] Commit: `fix(nginx): tighten CSP with nonce-based policy`

## 4.18 Scripts: backup cifrado + restore en tx
- [ ] `scripts/backup-db.sh`: despues de `gzip`, cifrar con `age` o `gpg --symmetric --passphrase-file`. Documentar passphrase en `.env`.
- [ ] `scripts/restore-db.sh:42`: `psql ... --set ON_ERROR_STOP=on --single-transaction`.
- [ ] Agregar backup pre-restore: `pg_dump` antes de pisar.
- [ ] `.gitignore`: agregar `backups/` y `uploads/`.
- [ ] Commit: `fix(scripts): encrypt backups and restore within transaction`

## 4.19 CI: cargo audit + npm audit + trivy + permissions
- [ ] `.github/workflows/ci.yml`:
  - Agregar step `cargo install cargo-audit && cargo audit` despues de build.
  - Agregar step `npm audit --audit-level=moderate` (o `high`).
  - Agregar step `trivy image opencrm-backend:latest`.
  - Agregar `permissions: contents: read` en top del workflow.
  - Pin actions a SHAs (`actions/checkout@<sha>` etc.).
  - Fix cache path: `backend/target` en lugar de `target`.
- [ ] Commit: `ci: add security audits and tighten permissions`

## 4.20 Docs + OpenAPI + ROADMAP + AGENTS.md + tests nuevos
- [ ] `README.md`:
  - Linea 13, 240: "6 migraciones" → "27 migraciones" (o numero actual despues de Fases 1-4).
  - Linea 138-139: eliminar duplicate PUT /auth/password.
  - Linea 91: eliminar/ruta absoluta personal /home/juan.
  - Linea 222-225: actualizar a 22 handlers / 19 models / migraciones reales.
  - Linea 129: "All routes under /api/v1/" → nota sobre `/` y `/metrics`.
- [ ] `AGENTS.md`:
  - "18 numbered migrations" → numero actual.
  - Auth/RBAC: "admin_only_middleware (role == admin)" → "admin_only checks admin.access permission via profile_permissions".
  - Eliminar nota "jspdf dead dependency" (es falso).
- [ ] `ROADMAP.md`:
  - Linea 149: marcar docker-compose.test.yml integration tests como `[x]`.
  - Linea 159-161: marcar detail views contacts/companies como `[x]`.
  - Linea 181: marcar "Export PDF real con jspdf" como `[x]`.
  - Linea 189: eliminar "Eliminar jspdf (no se usa)" o reescribir como mantencion.
  - Linea 164: marcar Playwright E2E como pendiente (ver 4.20-tests).
- [ ] `docs/pendientes.md`: actualizar status por item (incluida la distincion backend/frontend).
- [ ] `docs/salesforce-like-crm-plan.md:72`: confirmar `npm run lint` ya no abre prompt (post-3.11) y actualizar nota.
- [ ] `.github/copilot-instructions.md`: regenerar (3 Dockerfiles, 19+ migraciones, RBAC capability-based).
- [ ] `docs/openapi.yaml`: regenerar completa con todos los recursos (Leads, Tags, Notifications, Email, Calendar, Documents, Reports, Audit, Dashboard, Search, Users, Webhooks, Pipelines, Integrations, AI, WhatsApp, Monitoring, Auth completo). Agregar `redocly lint` a CI.
- [ ] `backend/tests/auth_tests.rs` (nuevo): login ok/fail, refresh rotation (con y sin reuse), logout revoca, change password revoca todos.
- [ ] `backend/tests/rbac_tests.rs` (nuevo): admin accede admin_routes; non-admin 403; permisos especificos por perfil.
- [ ] `backend/tests/handler_tests.rs` (nuevo): POST /activities (regresion 1.6), PATCH /deals/{id}/stage, CSV import contacts/companies (extender csv_tests).
- [ ] `frontend/playwright.config.ts` + tests E2E smoke: login → dashboard render, navigation a /leads, /admin (admin + non-admin).
- [ ] Commit docs: `docs: sync README, AGENTS, ROADMAP, copilot-instructions, openapi spec`
- [ ] Commit tests: `test: add auth, rbac, handler tests and Playwright smoke`

---

# Resumen de verificacion por fase

| Fase | Commits | Verificacion clave |
|------|---------|--------------------|
| 1 | 11 | `docker compose config` ok; smoke login → admin → POST /activities → webhook Meta; TLS reachable |
| 2 | 14 | `cargo test` nuevos (rotacion, convert tx, exports >50k, atomic register); frontend refresh mutex test manual |
| 3 | 12 | `npm run build` + `npm run lint` pasan; smoke manual admin(settings/admin), whatsapp save, dark/light toggle |
| 4 | 20 | `cargo audit`/`npm audit`/`trivy` clean; E2E smoke green; OpenAPI lint green |

## Riesgos y dependencias

- **Fase 1.5** (RBAC) puede requerir agregar permisos nuevos en migraciones — coordinar con 1.9/1.10.
- **Fase 2.8** (deals NUMERIC) cambia serializacion JSON — frontend debe manejar string o number; confirmar con usuario.
- **Fase 2.9** (encriptacion tokens) implementada. Tokens existentes quedan en plaintext hasta re-OAuth o migracion one-shot. `decrypt()` detecta valores no cifrados automaticamente.
- **Fase 2.10** (envelope `{ data: T }`) afecta toda la API y frontend — decidir opcion A o B **con el usuario antes de iniciar**.
- **Fase 4.8** (sqlx-migrate) cambia como corren migraciones en prod — coordinar con `database/Dockerfile` entrypoint.

## Notas finales

- **Nunca** commitear `.env` ni secretos.
- **Siempre** `cargo clippy -- -D warnings` y `cargo fmt --check` antes de commit backend.
- **Siempre** `npm run build` + `npm run lint` antes de commit frontend.
- Commits ** atomicos por item**; si un item requiere multiples archivos, un solo commit con mensaje scoped (`fix(auth): ...`).
- Pedir confirmacion al usuario antes de cada commit (o por lote si el usuario lo autoriza).
