DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_whatsapp_msg_id') THEN
        ALTER TABLE whatsapp_messages ADD CONSTRAINT uq_whatsapp_msg_id UNIQUE (message_id);
    END IF;
END $$;
