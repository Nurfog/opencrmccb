pub const DEAL_SELECT: &str = "SELECT d.id, d.title, d.value, d.currency, d.stage, d.position, d.contact_id, d.company_id, d.pipeline_id, d.pipeline_stage_id, d.expected_close_date, d.notes, CONCAT(c.first_name, ' ', c.last_name) as contact_name, co.name as company_name, d.created_at, d.updated_at FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id LEFT JOIN companies co ON d.company_id = co.id";

pub const DEAL_SELECT_BY_ID: &str = "SELECT d.id, d.title, d.value, d.currency, d.stage, d.position, d.contact_id, d.company_id, d.pipeline_id, d.pipeline_stage_id, d.expected_close_date, d.notes, CONCAT(c.first_name, ' ', c.last_name) as contact_name, co.name as company_name, d.created_at, d.updated_at FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id LEFT JOIN companies co ON d.company_id = co.id WHERE d.id = $1";

pub const DEAL_COUNT: &str = "SELECT COUNT(*) FROM deals";

pub const DEAL_COUNT_SEARCH: &str = "SELECT COUNT(*) FROM deals WHERE title ILIKE $1 ESCAPE '\\'";
