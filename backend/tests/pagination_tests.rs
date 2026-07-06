use crm_backend::models::pagination::{PaginatedResponse, PaginationParams, escape_like};

fn make_params(
    page: Option<i64>,
    per_page: Option<i64>,
    sort_by: Option<&str>,
    sort_order: Option<&str>,
) -> PaginationParams {
    PaginationParams {
        page,
        per_page,
        search: None,
        sort_by: sort_by.map(String::from),
        sort_order: sort_order.map(String::from),
    }
}

#[test]
fn default_page_and_per_page() {
    let params = make_params(None, None, None, None);
    assert_eq!(params.page(), 1);
    assert_eq!(params.per_page(), 20);
    assert_eq!(params.offset(), 0);
}

#[test]
fn custom_page_and_per_page() {
    let params = make_params(Some(3), Some(10), None, None);
    assert_eq!(params.page(), 3);
    assert_eq!(params.per_page(), 10);
    assert_eq!(params.offset(), 20);
}

#[test]
fn per_page_capped_at_200() {
    let params = make_params(None, Some(500), None, None);
    assert_eq!(params.per_page(), 200);
}

#[test]
fn per_page_min_is_1() {
    let params = make_params(None, Some(0), None, None);
    assert_eq!(params.per_page(), 1);
}

#[test]
fn page_min_is_1() {
    let params = make_params(Some(0), None, None, None);
    assert_eq!(params.page(), 1);
    assert_eq!(params.offset(), 0);
}

#[test]
fn sort_column_returns_valid_columns() {
    let params = make_params(None, None, Some("name"), None);
    assert_eq!(params.sort_column(), "first_name");

    let params = make_params(None, None, Some("email"), None);
    assert_eq!(params.sort_column(), "email");

    let params = make_params(None, None, Some("phone"), None);
    assert_eq!(params.sort_column(), "phone");

    let params = make_params(None, None, Some("position"), None);
    assert_eq!(params.sort_column(), "position");

    let params = make_params(None, None, Some("created_at"), None);
    assert_eq!(params.sort_column(), "created_at");
}

#[test]
fn sort_column_defaults_to_created_at() {
    let params = make_params(None, None, Some("bogus"), None);
    assert_eq!(params.sort_column(), "created_at");

    let params = make_params(None, None, None, None);
    assert_eq!(params.sort_column(), "created_at");
}

#[test]
fn sort_direction_asc_or_desc() {
    let params = make_params(None, None, None, Some("asc"));
    assert_eq!(params.sort_direction(), "ASC");

    let params = make_params(None, None, None, Some("desc"));
    assert_eq!(params.sort_direction(), "DESC");

    let params = make_params(None, None, None, None);
    assert_eq!(params.sort_direction(), "DESC");
}

#[test]
fn total_pages_calculation() {
    let resp = PaginatedResponse::new(vec![1, 2, 3], 10, 1, 3);
    assert_eq!(resp.total_pages, 4);

    let resp = PaginatedResponse::new(vec![1, 2, 3], 9, 1, 3);
    assert_eq!(resp.total_pages, 3);

    let resp: PaginatedResponse<i32> = PaginatedResponse::new(vec![], 0, 1, 20);
    assert_eq!(resp.total_pages, 0);

    let resp = PaginatedResponse::new(vec![1], 1, 1, 10);
    assert_eq!(resp.total_pages, 1);
}

#[test]
fn escape_like_special_characters() {
    assert_eq!(escape_like("hello"), "hello");
    assert_eq!(escape_like("100%"), "100\\%");
    assert_eq!(escape_like("a_b"), "a\\_b");
    assert_eq!(escape_like("a\\b"), "a\\\\b");
    assert_eq!(escape_like("%_\\all"), "\\%\\_\\\\all");
}
