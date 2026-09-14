-- Migration 033: Add FK constraint on email_logs.template_id
-- This column was added in M018 without a FOREIGN KEY, allowing orphaned references.

ALTER TABLE email_logs
    ADD CONSTRAINT fk_email_logs_template
    FOREIGN KEY (template_id) REFERENCES email_templates(id)
    ON DELETE SET NULL;
