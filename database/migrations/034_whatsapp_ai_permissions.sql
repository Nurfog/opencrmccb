-- ─── RBAC: permisos de WhatsApp e IA ─────────────────────────────
-- Antes de esta migración, los handlers de WhatsApp exigían `contacts.view`
-- (cualquier vendedor podía rotar el api_token) y los de IA exigían `ai.use`,
-- permiso que nunca se sembraba (endpoints IA devolvían 403 a todos).
--
-- `whatsapp.view`: operativa diaria (ver config sin secreto, enviar, leer
--   mensajes, conversaciones, asignación de leads).
-- `whatsapp.manage`: rotar api_token y cambiar la estrategia de asignación.
-- `ai.use`: operativa (ver config sin api_key, extracciones).
-- `ai.manage`: cambiar provider/modelo/api_key.

-- Administrador: todo
INSERT INTO profile_permissions (profile_id, permission)
SELECT p.id, v.permission
FROM profiles p
CROSS JOIN (VALUES
  ('whatsapp.view'), ('whatsapp.manage'),
  ('ai.use'), ('ai.manage')
) AS v(permission)
WHERE p.name = 'Administrador'
ON CONFLICT DO NOTHING;

-- Vendedor: operativa, sin gestión de secretos
INSERT INTO profile_permissions (profile_id, permission)
SELECT p.id, v.permission
FROM profiles p
CROSS JOIN (VALUES
  ('whatsapp.view'),
  ('ai.use')
) AS v(permission)
WHERE p.name = 'Vendedor'
ON CONFLICT DO NOTHING;

-- Ejecutivo de cuentas: operativa, sin gestión de secretos
INSERT INTO profile_permissions (profile_id, permission)
SELECT p.id, v.permission
FROM profiles p
CROSS JOIN (VALUES
  ('whatsapp.view'),
  ('ai.use')
) AS v(permission)
WHERE p.name = 'Ejecutivo de cuentas'
ON CONFLICT DO NOTHING;
