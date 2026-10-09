-- ─── RBAC: completar permisos operativos por perfil ────────────────
-- Los handlers exigen permisos (leads.*, calendar.*, documents.*, email.*,
-- webhooks.*, dashboard.view, search.view, audit.view, …) que ninguna
-- migración anterior sembraba: cualquier usuario —incluido el administrador—
-- recibía 403 en esos módulos aunque el menú los mostrara.
--
-- Administrador: todo (incluye gestión).
-- Vendedor: operativa completa de ventas (leads, calendario, documentos,
--   email) + lectura de dashboard/búsqueda; sin gestión de webhooks ni auditoría.
-- Ejecutivo de cuentas: solo lectura.

-- Administrador: todos los permisos operativos que exigen los handlers
INSERT INTO profile_permissions (profile_id, permission)
SELECT p.id, v.permission
FROM profiles p
CROSS JOIN (VALUES
  ('leads.view'), ('leads.create'), ('leads.edit'), ('leads.delete'), ('leads.convert'),
  ('calendar.view'), ('calendar.create'), ('calendar.edit'), ('calendar.delete'),
  ('documents.view'), ('documents.upload'), ('documents.delete'),
  ('email.view'), ('email.send'),
  ('webhooks.view'), ('webhooks.manage'),
  ('notifications.manage'),
  ('audit.view'),
  ('dashboard.view'),
  ('search.view')
) AS v(permission)
WHERE p.name = 'Administrador'
ON CONFLICT DO NOTHING;

-- Vendedor: operativa de ventas + lectura
INSERT INTO profile_permissions (profile_id, permission)
SELECT p.id, v.permission
FROM profiles p
CROSS JOIN (VALUES
  ('leads.view'), ('leads.create'), ('leads.edit'), ('leads.delete'), ('leads.convert'),
  ('calendar.view'), ('calendar.create'), ('calendar.edit'), ('calendar.delete'),
  ('documents.view'), ('documents.upload'),
  ('email.view'), ('email.send'),
  ('dashboard.view'),
  ('search.view')
) AS v(permission)
WHERE p.name = 'Vendedor'
ON CONFLICT DO NOTHING;

-- Ejecutivo de cuentas: solo lectura
INSERT INTO profile_permissions (profile_id, permission)
SELECT p.id, v.permission
FROM profiles p
CROSS JOIN (VALUES
  ('leads.view'),
  ('calendar.view'),
  ('documents.view'),
  ('email.view'),
  ('dashboard.view'),
  ('search.view')
) AS v(permission)
WHERE p.name = 'Ejecutivo de cuentas'
ON CONFLICT DO NOTHING;
