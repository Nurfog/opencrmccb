-- Add 'lead' to entity_tags CHECK constraint
ALTER TABLE entity_tags DROP CONSTRAINT IF EXISTS entity_tags_entity_type_check;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entity_tags_entity_type_check') THEN
        ALTER TABLE entity_tags ADD CONSTRAINT entity_tags_entity_type_check CHECK (entity_type IN ('contact', 'company', 'deal', 'lead'));
    END IF;
END $$;
