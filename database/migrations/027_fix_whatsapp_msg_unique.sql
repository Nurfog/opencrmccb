-- Replace the UNIQUE constraint on message_id (which allows multiple NULLs)
-- with a partial unique index that only enforces uniqueness for non-null values.
DROP INDEX IF EXISTS uq_whatsapp_msg_id;
ALTER TABLE whatsapp_messages DROP CONSTRAINT IF EXISTS uq_whatsapp_msg_id;
CREATE UNIQUE INDEX uq_whatsapp_msg_id_notnull ON whatsapp_messages(message_id) WHERE message_id IS NOT NULL;
