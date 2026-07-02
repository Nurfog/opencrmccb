# Pendientes

## Leads Kanban / Funnel visual
Agregar una vista kanban en `/leads` que muestre las etapas del lead:

```
new → contacted → qualified → converted
```

Cada columna muestra los leads en esa etapa con opción de arrastrar (DnD) a la siguiente etapa.

## Lead detail page — status progression
En la página `/leads/[id]` agregar botones para avanzar de etapa:
- Si está en `new`: botón "Contactar" → cambia a `contacted`
- Si está en `contacted`: botón "Calificar" → cambia a `qualified`
- Si está en `qualified`: botón "Convertir" → abre ConvertLeadDialog
- Mostrar historial de cambios de etapa
