use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::handlers::audit::insert_audit_log;
use crate::middleware::auth::{Claims, UserPermissions};
use crate::models::{Company, CreateCompany, PaginatedResponse, PaginationParams, UpdateCompany};
use crate::models::{ImportResult, escape_csv, escape_like, parse_csv_rows};

pub async fn list_companies(
    State(state): State<AppState>,
    perms: UserPermissions,
    Query(params): Query<PaginationParams>,
) -> Result<Json<PaginatedResponse<Company>>, StatusCode> {
    perms
        .require("companies.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let sort_col = params.sort_column();
    let sort_dir = params.sort_direction();

    let search_filter = params
        .search
        .as_ref()
        .map(|s| format!("%{}%", escape_like(s)));

    let count_query = if let Some(ref _search) = search_filter {
        "SELECT COUNT(*) FROM companies WHERE name ILIKE $1 ESCAPE '\\' OR industry ILIKE $1 ESCAPE '\\' OR city ILIKE $1 ESCAPE '\\' OR country ILIKE $1 ESCAPE '\\'".to_string()
    } else {
        "SELECT COUNT(*) FROM companies".to_string()
    };

    let data_query = if let Some(ref _search) = search_filter {
        format!(
            "SELECT id, name, industry, website, phone, email, address, city, country, notes, created_at, updated_at
             FROM companies
             WHERE name ILIKE $1 ESCAPE '\\' OR industry ILIKE $1 ESCAPE '\\' OR city ILIKE $1 ESCAPE '\\' OR country ILIKE $1 ESCAPE '\\'
             ORDER BY {} {}
             LIMIT $2 OFFSET $3",
            sort_col, sort_dir
        )
    } else {
        format!(
            "SELECT id, name, industry, website, phone, email, address, city, country, notes, created_at, updated_at
             FROM companies
             ORDER BY {} {}
             LIMIT $1 OFFSET $2",
            sort_col, sort_dir
        )
    };

    let total: (i64,) = if let Some(ref search) = search_filter {
        sqlx::query_as(&count_query)
            .bind(search)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        sqlx::query_as(&count_query)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let companies = if let Some(ref search) = search_filter {
        sqlx::query_as::<_, Company>(&data_query)
            .bind(search)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        sqlx::query_as::<_, Company>(&data_query)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    Ok(Json(PaginatedResponse::new(
        companies, total.0, page, per_page,
    )))
}

pub async fn create_company(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Json(input): Json<CreateCompany>,
) -> Result<(StatusCode, Json<Company>), StatusCode> {
    perms
        .require("companies.create")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    input
        .validate()
        .map_err(|_| StatusCode::UNPROCESSABLE_ENTITY)?;

    let company = sqlx::query_as::<_, Company>(
        r#"
        INSERT INTO companies (name, industry, website, phone, email, address, city, country, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, name, industry, website, phone, email, address, city, country, notes, created_at, updated_at
        "#,
    )
    .bind(&input.name)
    .bind(&input.industry)
    .bind(&input.website)
    .bind(&input.phone)
    .bind(&input.email)
    .bind(&input.address)
    .bind(&input.city)
    .bind(&input.country)
    .bind(&input.notes)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let _ = insert_audit_log(
        &state.db,
        user_id,
        "created",
        "company",
        company.id,
        None,
        Some(serde_json::to_value(&company).unwrap_or_default()),
    )
    .await;

    Ok((StatusCode::CREATED, Json(company)))
}

pub async fn get_company(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<Json<Company>, StatusCode> {
    perms
        .require("companies.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let company = sqlx::query_as::<_, Company>(
        "SELECT id, name, industry, website, phone, email, address, city, country, notes, created_at, updated_at FROM companies WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(company))
}

pub async fn update_company(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateCompany>,
) -> Result<Json<Company>, StatusCode> {
    perms
        .require("companies.edit")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    input
        .validate()
        .map_err(|_| StatusCode::UNPROCESSABLE_ENTITY)?;

    let old = sqlx::query_as::<_, Company>(
        "SELECT id, name, industry, website, phone, email, address, city, country, notes, created_at, updated_at FROM companies WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let company = sqlx::query_as::<_, Company>(
        r#"
        UPDATE companies
        SET name = COALESCE($2, name),
            industry = COALESCE($3, industry),
            website = COALESCE($4, website),
            phone = COALESCE($5, phone),
            email = COALESCE($6, email),
            address = COALESCE($7, address),
            city = COALESCE($8, city),
            country = COALESCE($9, country),
            notes = COALESCE($10, notes),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, industry, website, phone, email, address, city, country, notes, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&input.name)
    .bind(&input.industry)
    .bind(&input.website)
    .bind(&input.phone)
    .bind(&input.email)
    .bind(&input.address)
    .bind(&input.city)
    .bind(&input.country)
    .bind(&input.notes)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let _ = insert_audit_log(
        &state.db,
        user_id,
        "updated",
        "company",
        company.id,
        Some(serde_json::to_value(&old).unwrap_or_default()),
        Some(serde_json::to_value(&company).unwrap_or_default()),
    )
    .await;

    Ok(Json(company))
}

pub async fn delete_company(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    perms
        .require("companies.delete")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let old = sqlx::query_as::<_, Company>(
        "SELECT id, name, industry, website, phone, email, address, city, country, notes, created_at, updated_at FROM companies WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result = sqlx::query("DELETE FROM companies WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    if let Some(company) = old {
        let user_id = Uuid::parse_str(&claims.sub).ok();
        let _ = insert_audit_log(
            &state.db,
            user_id,
            "deleted",
            "company",
            company.id,
            Some(serde_json::to_value(&company).unwrap_or_default()),
            None,
        )
        .await;
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn export_companies(
    State(state): State<AppState>,
    perms: UserPermissions,
    Query(params): Query<PaginationParams>,
) -> Result<(HeaderMap, String), StatusCode> {
    perms
        .require("companies.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let search_filter = params
        .search
        .as_ref()
        .map(|s| format!("%{}%", escape_like(s)));

    let companies = if let Some(ref search) = search_filter {
        sqlx::query_as::<_, Company>(
            "SELECT id, name, industry, website, phone, email, address, city, country, notes, created_at, updated_at FROM companies WHERE name ILIKE $1 ESCAPE '\\' OR industry ILIKE $1 ESCAPE '\\' OR city ILIKE $1 ESCAPE '\\' OR country ILIKE $1 ESCAPE '\\' ORDER BY created_at DESC LIMIT 100000"
        )
        .bind(search)
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        sqlx::query_as::<_, Company>(
            "SELECT id, name, industry, website, phone, email, address, city, country, notes, created_at, updated_at FROM companies ORDER BY created_at DESC LIMIT 100000"
        )
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let mut csv = String::from("name,industry,website,phone,email,address,city,country,notes\n");
    for c in &companies {
        csv.push_str(&format!(
            "{},{},{},{},{},{},{},{},{}\n",
            escape_csv(&c.name),
            escape_csv(c.industry.as_deref().unwrap_or("")),
            escape_csv(c.website.as_deref().unwrap_or("")),
            escape_csv(c.phone.as_deref().unwrap_or("")),
            escape_csv(c.email.as_deref().unwrap_or("")),
            escape_csv(c.address.as_deref().unwrap_or("")),
            escape_csv(c.city.as_deref().unwrap_or("")),
            escape_csv(c.country.as_deref().unwrap_or("")),
            escape_csv(c.notes.as_deref().unwrap_or(""))
        ));
    }

    let mut headers = HeaderMap::new();
    headers.insert(
        "Content-Type",
        HeaderValue::from_static("text/csv; charset=utf-8"),
    );
    headers.insert(
        "Content-Disposition",
        HeaderValue::from_static("attachment; filename=\"companies.csv\""),
    );

    Ok((headers, csv))
}

pub async fn import_companies(
    State(state): State<AppState>,
    perms: UserPermissions,
    body: String,
) -> Result<Json<ImportResult>, StatusCode> {
    perms
        .require("companies.create")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let rows = parse_csv_rows(&body);

    let mut imported = 0;
    let mut errors = Vec::new();

    for (row_num, fields) in rows.iter().enumerate() {
        if fields.is_empty() {
            errors.push(format!("Línea {}: formato inválido", row_num + 2));
            continue;
        }

        let name = fields[0].trim().to_string();
        let industry = fields
            .get(1)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let website = fields
            .get(2)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let phone = fields
            .get(3)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let email = fields
            .get(4)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let address = fields
            .get(5)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let city = fields
            .get(6)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let country = fields
            .get(7)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let notes = fields
            .get(8)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let result = sqlx::query_as::<_, Company>(
            r#"
            INSERT INTO companies (name, industry, website, phone, email, address, city, country, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, name, industry, website, phone, email, address, city, country, notes, created_at, updated_at
            "#,
        )
        .bind(&name)
        .bind(&industry)
        .bind(&website)
        .bind(&phone)
        .bind(&email)
        .bind(&address)
        .bind(&city)
        .bind(&country)
        .bind(&notes)
        .fetch_one(&state.db)
        .await;

        match result {
            Ok(_) => imported += 1,
            Err(e) => errors.push(format!("Línea {}: {}", row_num + 2, e)),
        }
    }

    Ok(Json(ImportResult { imported, errors }))
}
