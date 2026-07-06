use crate::AppState;
use crate::handlers;
use axum::{
    Router,
    routing::{delete, get, patch, post, put},
};

pub fn public_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(handlers::health::health_check))
        .route("/api/v1/health", get(handlers::health::health_check))
        .route("/metrics", get(crate::middleware::metrics::metrics_handler))
        .route(
            "/api/v1/integrations/whatsapp/webhook",
            get(handlers::whatsapp::webhook_verify),
        )
        .route("/api/v1/branding", get(handlers::admin::get_branding))
}

pub fn whatsapp_webhook_routes() -> Router<AppState> {
    Router::new().route(
        "/api/v1/integrations/whatsapp/webhook",
        post(handlers::whatsapp::webhook_receive),
    )
}

pub fn login_routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/auth/login", post(handlers::auth::login))
        .route(
            "/api/v1/auth/forgot-password",
            post(handlers::auth::forgot_password),
        )
        .route(
            "/api/v1/auth/reset-password",
            post(handlers::auth::reset_password),
        )
}

pub fn register_routes() -> Router<AppState> {
    Router::new().route("/api/v1/auth/register", post(handlers::auth::register))
}

pub fn refresh_routes() -> Router<AppState> {
    Router::new().route("/api/v1/auth/refresh", post(handlers::auth::refresh_token))
}

pub fn integration_callback_routes() -> Router<AppState> {
    Router::new().route(
        "/api/v1/integrations/{provider}/callback",
        get(handlers::oauth::callback),
    )
}

pub fn auth_routes() -> Router<AppState> {
    Router::new()
        // Search
        .route("/api/v1/search", get(handlers::search::global_search))
        // Tags
        .route(
            "/api/v1/tags",
            get(handlers::tags::list_tags).post(handlers::tags::create_tag),
        )
        .route(
            "/api/v1/tags/{id}",
            put(handlers::tags::update_tag).delete(handlers::tags::delete_tag),
        )
        .route("/api/v1/tags/assign", post(handlers::tags::assign_tag))
        .route(
            "/api/v1/tags/{tag_id}/{entity_type}/{entity_id}",
            delete(handlers::tags::remove_tag),
        )
        .route(
            "/api/v1/tags/{entity_type}/{entity_id}",
            get(handlers::tags::get_entity_tags),
        )
        // Contacts
        .route(
            "/api/v1/contacts",
            get(handlers::contacts::list_contacts).post(handlers::contacts::create_contact),
        )
        .route(
            "/api/v1/contacts/{id}",
            get(handlers::contacts::get_contact)
                .put(handlers::contacts::update_contact)
                .delete(handlers::contacts::delete_contact),
        )
        .route(
            "/api/v1/contacts/export",
            get(handlers::contacts::export_contacts),
        )
        .route(
            "/api/v1/contacts/import",
            post(handlers::contacts::import_contacts),
        )
        .route(
            "/api/v1/contacts/bulk-delete",
            post(handlers::contacts::bulk_delete_contacts),
        )
        // Contact related
        .route(
            "/api/v1/contacts/{id}/deals",
            get(handlers::related::get_contact_deals),
        )
        .route(
            "/api/v1/contacts/{id}/activities",
            get(handlers::related::get_contact_activities),
        )
        .route(
            "/api/v1/companies",
            get(handlers::companies::list_companies).post(handlers::companies::create_company),
        )
        .route(
            "/api/v1/companies/{id}",
            get(handlers::companies::get_company)
                .put(handlers::companies::update_company)
                .delete(handlers::companies::delete_company),
        )
        .route(
            "/api/v1/companies/export",
            get(handlers::companies::export_companies),
        )
        .route(
            "/api/v1/companies/import",
            post(handlers::companies::import_companies),
        )
        // Company related
        .route(
            "/api/v1/companies/{id}/contacts",
            get(handlers::related::get_company_contacts),
        )
        .route(
            "/api/v1/companies/{id}/deals",
            get(handlers::related::get_company_deals),
        )
        .route(
            "/api/v1/companies/{id}/revenue",
            get(handlers::related::get_company_revenue),
        )
        // Deals
        .route(
            "/api/v1/deals",
            get(handlers::deals::list_deals).post(handlers::deals::create_deal),
        )
        .route(
            "/api/v1/deals/{id}",
            get(handlers::deals::get_deal)
                .put(handlers::deals::update_deal)
                .delete(handlers::deals::delete_deal),
        )
        .route(
            "/api/v1/deals/{id}/stage",
            patch(handlers::deals::update_deal_stage),
        )
        // Deal related
        .route(
            "/api/v1/deals/{id}/activities",
            get(handlers::related::get_deal_activities),
        )
        .route("/api/v1/deals/export", get(handlers::deals::export_deals))
        .route("/api/v1/deals/import", post(handlers::deals::import_deals))
        // Activities
        .route(
            "/api/v1/activities",
            get(handlers::activities::list_activities).post(handlers::activities::create_activity),
        )
        .route(
            "/api/v1/activities/{id}",
            put(handlers::activities::update_activity)
                .delete(handlers::activities::delete_activity),
        )
        .route(
            "/api/v1/activities/{id}/complete",
            post(handlers::activities::complete_activity),
        )
        // Dashboard
        .route(
            "/api/v1/dashboard/stats",
            get(handlers::dashboard::get_dashboard_stats),
        )
        .route(
            "/api/v1/dashboard/pipeline",
            get(handlers::dashboard::get_pipeline),
        )
        .route(
            "/api/v1/dashboard/top-deals",
            get(handlers::dashboard::get_top_deals),
        )
        .route(
            "/api/v1/dashboard/recent-activities",
            get(handlers::dashboard::get_recent_activities),
        )
        // Documents
        .route(
            "/api/v1/documents",
            get(handlers::documents::list_documents),
        )
        .route(
            "/api/v1/documents/upload",
            post(handlers::documents::upload_document),
        )
        .route(
            "/api/v1/documents/{id}/download",
            get(handlers::documents::download_document),
        )
        .route(
            "/api/v1/documents/{id}",
            delete(handlers::documents::delete_document),
        )
        // Audit
        .route("/api/v1/audit", get(handlers::audit::list_audit_logs))
        .route(
            "/api/v1/audit/entity/{type}/{id}",
            get(handlers::audit::get_entity_history),
        )
        // Profile
        .route("/api/v1/auth/me", get(handlers::auth::get_profile))
        .route("/api/v1/auth/profile", put(handlers::auth::update_profile))
        .route(
            "/api/v1/auth/password",
            put(handlers::auth::change_password),
        )
        .route("/api/v1/auth/logout", post(handlers::auth::logout))
        // Notifications
        .route(
            "/api/v1/notifications/test",
            post(handlers::notifications::send_test_email),
        )
        .route(
            "/api/v1/notifications/preferences",
            get(handlers::notifications::get_notification_preferences)
                .put(handlers::notifications::update_notification_preferences),
        )
        .route(
            "/api/v1/notifications",
            get(handlers::notifications::list_notifications),
        )
        .route(
            "/api/v1/notifications/unread-count",
            get(handlers::notifications::get_unread_count),
        )
        .route(
            "/api/v1/notifications/{id}/read",
            put(handlers::notifications::mark_as_read),
        )
        .route(
            "/api/v1/notifications/read-all",
            put(handlers::notifications::mark_all_as_read),
        )
        .route(
            "/api/v1/notifications/{id}",
            delete(handlers::notifications::delete_notification),
        )
        // Reports
        .route(
            "/api/v1/reports/pipeline",
            get(handlers::reports::get_pipeline_report),
        )
        .route(
            "/api/v1/reports/win-loss",
            get(handlers::reports::get_win_loss_report),
        )
        // Email
        .route("/api/v1/email/send", post(handlers::email::send_email))
        .route("/api/v1/email/logs", get(handlers::email::list_email_logs))
        .route(
            "/api/v1/email/logs/{id}",
            get(handlers::email::get_email_log),
        )
        .route(
            "/api/v1/email/templates",
            get(handlers::email::list_templates).post(handlers::email::create_template),
        )
        .route(
            "/api/v1/email/templates/{id}",
            put(handlers::email::update_template).delete(handlers::email::delete_template),
        )
        .route(
            "/api/v1/email/send-from-template/{template_id}",
            post(handlers::email::send_from_template),
        )
        // Calendar
        .route(
            "/api/v1/calendar/status",
            get(handlers::calendar::connection_status),
        )
        .route(
            "/api/v1/calendar/events",
            get(handlers::calendar::list_events).post(handlers::calendar::create_event),
        )
        .route(
            "/api/v1/calendar/events/{id}",
            put(handlers::calendar::update_event).delete(handlers::calendar::delete_event),
        )
        .route(
            "/api/v1/calendar/auth/{provider}",
            get(handlers::calendar::get_auth_url),
        )
        .route(
            "/api/v1/calendar/{provider}/callback",
            get(handlers::calendar::google_callback),
        )
        .route(
            "/api/v1/calendar/microsoft/callback",
            get(handlers::calendar::microsoft_callback),
        )
        .route(
            "/api/v1/calendar/sync/google",
            post(handlers::calendar::sync_google),
        )
        // Pipelines (read-only)
        .route("/api/v1/pipelines", get(handlers::admin::list_pipelines))
        // Integrations
        .route(
            "/api/v1/integrations",
            get(handlers::oauth::list_integrations),
        )
        .route(
            "/api/v1/integrations/{provider}/connect",
            get(handlers::oauth::connect),
        )
        .route(
            "/api/v1/integrations/{provider}/disconnect",
            delete(handlers::oauth::disconnect),
        )
        // WhatsApp
        .route(
            "/api/v1/integrations/whatsapp/config",
            get(handlers::whatsapp::get_whatsapp_config)
                .put(handlers::whatsapp::update_whatsapp_config),
        )
        .route(
            "/api/v1/integrations/whatsapp/send",
            post(handlers::whatsapp::send_whatsapp_message),
        )
        .route(
            "/api/v1/integrations/whatsapp/messages",
            get(handlers::whatsapp::get_messages),
        )
        .route(
            "/api/v1/integrations/whatsapp/conversations",
            get(handlers::whatsapp::list_conversations),
        )
        // Lead assignment
        .route(
            "/api/v1/settings/lead-assignment",
            get(handlers::whatsapp::get_lead_assignment_config)
                .put(handlers::whatsapp::update_lead_assignment_config),
        )
        .route(
            "/api/v1/settings/lead-assignment/assign",
            post(handlers::whatsapp::assign_lead),
        )
        // Leads
        .route(
            "/api/v1/leads",
            get(handlers::leads::list_leads).post(handlers::leads::create_lead),
        )
        .route("/api/v1/leads/stats", get(handlers::leads::lead_stats))
        .route(
            "/api/v1/leads/{id}",
            get(handlers::leads::get_lead)
                .put(handlers::leads::update_lead)
                .delete(handlers::leads::delete_lead),
        )
        .route(
            "/api/v1/leads/{id}/convert",
            post(handlers::leads::convert_lead),
        )
        .route(
            "/api/v1/leads/{id}/activities",
            get(handlers::leads::list_lead_activities).post(handlers::leads::create_lead_activity),
        )
        .route(
            "/api/v1/leads/{lead_id}/activities/{activity_id}",
            post(handlers::leads::complete_lead_activity)
                .delete(handlers::leads::delete_lead_activity),
        )
        // AI
        .route(
            "/api/v1/settings/ai",
            get(handlers::ai::get_ai_config).put(handlers::ai::update_ai_config),
        )
        .route("/api/v1/leads/extract", post(handlers::ai::extract_lead))
        .route(
            "/api/v1/leads/extractions",
            get(handlers::ai::get_extractions),
        )
}

pub fn admin_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/users",
            get(handlers::auth::list_users).post(handlers::auth::create_user),
        )
        .route("/api/v1/users/{id}", delete(handlers::auth::delete_user))
        .route(
            "/api/v1/users/{id}/profile",
            put(handlers::auth::update_user_profile),
        )
        .route(
            "/api/v1/admin/pipelines",
            post(handlers::admin::create_pipeline),
        )
        .route(
            "/api/v1/admin/pipelines/{id}",
            put(handlers::admin::update_pipeline).delete(handlers::admin::delete_pipeline),
        )
        .route(
            "/api/v1/admin/pipelines/{pipeline_id}/stages",
            post(handlers::admin::create_stage),
        )
        .route(
            "/api/v1/admin/pipelines/{pipeline_id}/stages/{stage_id}",
            delete(handlers::admin::delete_stage),
        )
        .route(
            "/api/v1/admin/profiles",
            get(handlers::admin::list_profiles).post(handlers::admin::create_profile),
        )
        .route(
            "/api/v1/admin/profiles/{id}",
            put(handlers::admin::update_profile),
        )
        .route(
            "/api/v1/admin/branding",
            put(handlers::admin::update_branding),
        )
        // Webhooks
        .route(
            "/api/v1/webhooks",
            get(handlers::webhooks::list_webhooks).post(handlers::webhooks::create_webhook),
        )
        .route(
            "/api/v1/webhooks/{id}",
            delete(handlers::webhooks::delete_webhook),
        )
}

pub async fn admin_only_middleware(
    axum::extract::State(state): axum::extract::State<crate::AppState>,
    mut request: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, axum::http::StatusCode> {
    let claims = request
        .extensions()
        .get::<crate::middleware::auth::Claims>()
        .cloned()
        .ok_or(axum::http::StatusCode::UNAUTHORIZED)?;

    let user_id =
        uuid::Uuid::parse_str(&claims.sub).map_err(|_| axum::http::StatusCode::UNAUTHORIZED)?;

    let permissions: Vec<String> = sqlx::query_scalar(
        "SELECT pp.permission FROM profile_permissions pp \
         JOIN users u ON u.profile_id = pp.profile_id \
         WHERE u.id = $1",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let has_admin = permissions.iter().any(|p| p.as_str() == "admin.access");
    if !has_admin {
        return Err(axum::http::StatusCode::FORBIDDEN);
    }

    request
        .extensions_mut()
        .insert(crate::middleware::auth::UserPermissions(permissions));

    Ok(next.run(request).await)
}
