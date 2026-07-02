ALTER TABLE deals ADD COLUMN position INTEGER DEFAULT 0;

CREATE INDEX idx_deals_stage_position ON deals(stage, position);
