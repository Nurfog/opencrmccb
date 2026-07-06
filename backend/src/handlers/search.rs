use axum::Json;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};

use crate::AppState;
use crate::middleware::auth::UserPermissions;
use crate::models::escape_like;

#[derive(Debug, Deserialize)]
pub struct SearchParams {
    pub q: String,
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub id: String,
    #[serde(rename = "entity_type")]
    pub entity_type: String,
    pub label: String,
    pub subtitle: String,
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub contacts: Vec<SearchResult>,
    pub companies: Vec<SearchResult>,
    pub deals: Vec<SearchResult>,
}

pub async fn global_search(
    State(state): State<AppState>,
    Query(params): Query<SearchParams>,
    perms: UserPermissions,
) -> Result<Json<SearchResponse>, StatusCode> {
    perms
        .require("search.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let query = params.q.trim();
    if query.is_empty() {
        return Ok(Json(SearchResponse {
            contacts: vec![],
            companies: vec![],
            deals: vec![],
        }));
    }

    let search_pattern = format!("%{}%", escape_like(query));
    let limit: i64 = 5;

    let contacts = sqlx::query_as::<_, (uuid::Uuid, String, String, Option<String>)>(
        r#"
        SELECT id, first_name, last_name, email
        FROM contacts
        WHERE first_name ILIKE $1 ESCAPE '\'
           OR last_name ILIKE $1 ESCAPE '\'
           OR email ILIKE $1 ESCAPE '\'
        ORDER BY first_name ASC
        LIMIT $2
        "#,
    )
    .bind(&search_pattern)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .into_iter()
    .map(|(id, first_name, last_name, email)| {
        let label = format!("{} {}", first_name, last_name);
        let subtitle = email.unwrap_or_default();
        SearchResult {
            id: id.to_string(),
            entity_type: "contact".to_string(),
            label,
            subtitle,
        }
    })
    .collect();

    let companies = sqlx::query_as::<_, (uuid::Uuid, String, Option<String>)>(
        r#"
        SELECT id, name, industry
        FROM companies
        WHERE name ILIKE $1 ESCAPE '\'
           OR industry ILIKE $1 ESCAPE '\'
        ORDER BY name ASC
        LIMIT $2
        "#,
    )
    .bind(&search_pattern)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .into_iter()
    .map(|(id, name, industry)| {
        let subtitle = industry.unwrap_or_default();
        SearchResult {
            id: id.to_string(),
            entity_type: "company".to_string(),
            label: name,
            subtitle,
        }
    })
    .collect();

    let deals = sqlx::query_as::<_, (uuid::Uuid, String, f64, String)>(
        r#"
        SELECT id, title, value, stage::text
        FROM deals
        WHERE title ILIKE $1 ESCAPE '\'
        ORDER BY created_at DESC
        LIMIT $2
        "#,
    )
    .bind(&search_pattern)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .into_iter()
    .map(|(id, title, value, stage)| {
        let subtitle = format!("${:.0} - {}", value, stage);
        SearchResult {
            id: id.to_string(),
            entity_type: "deal".to_string(),
            label: title,
            subtitle,
        }
    })
    .collect();

    Ok(Json(SearchResponse {
        contacts,
        companies,
        deals,
    }))
}
