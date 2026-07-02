# OpenCMRCCB Salesforce-like CRM Plan

## Summary

OpenCMRCCB should evolve toward a Salesforce-like CRM: modular, configurable, dense in business information, and centered on daily sales operations. The direction is not to clone Salesforce at once, but to move gradually from a functional CRM into a configurable CRM console with strong object pages, permissions, reporting, communication tools, and automation-ready architecture.

The first implementation phase should improve maintainability and UX without breaking current API contracts.

## Product Direction

- Build around core CRM objects: leads, contacts, companies/accounts, deals/opportunities, activities, documents, email, calendar, reports, and admin configuration.
- Prefer a console-style UX: dense tables, record headers, related lists, activity timelines, quick actions, tabs, filters, and batch workflows.
- Keep configuration central: pipelines, stages, profiles, permissions, branding, integrations, lead assignment, and AI settings should feel like admin-managed CRM metadata.
- Preserve current usability while gradually making screens more consistent and modular.

## Key Improvements

### CRM Console UX

- Standardize object pages with reusable patterns: page header, primary actions, filters, table/list view, detail view, related records, and activity history.
- Refactor large pages into focused modules, starting with email, settings, calendar, and documents.
- Make list-heavy screens responsive and operational: horizontal table overflow where needed, clear empty/loading states, stable buttons, and consistent action placement.
- Keep visual style restrained and enterprise-focused: dense, readable, predictable, and consistent with existing `slds-*` conventions.

### Configuration and Admin

- Strengthen admin as the control center for profiles, permissions, pipelines, stages, branding, and integrations.
- Move toward capability-based RBAC where possible, reducing hardcoded role checks over time.
- Keep integrations, WhatsApp, AI, calendar, email, and lead assignment as configurable modules.
- Prepare for future metadata-driven fields and object configuration, but avoid a large schema rewrite in the first phase.

### Backend Maintainability

- Reduce repeated handler logic in imports, exports, list views, pagination, validation, and row normalization.
- Extract pure parsing and normalization helpers for CSV imports, starting with deals, contacts, and companies.
- Keep existing routes and payloads stable under `/api/v1/*`.
- Preserve the current `deals` API naming for compatibility, even if the UI later presents deals as opportunities.

### Quality and Testing

- Add backend unit tests for pure logic: CSV parsing, import row normalization, pagination, validation, and permission helpers.
- Use existing verification as the baseline:
  - `cargo fmt -- --check`
  - `cargo clippy -- -D warnings`
  - `cargo test`
  - `npm run build`
  - `npm run lint`
- Treat frontend test infrastructure as a separate follow-up. If added, use it first for extracted console components and high-value flows.

## First Implementation Phase

1. Modularize `frontend/src/app/email/page.tsx` into compose, logs, templates, and status components while preserving behavior.
2. Modularize `frontend/src/app/settings/page.tsx` by settings tab and integration/configuration domain.
3. Extract CSV import helpers from backend handlers into pure, tested model/service functions.
4. Improve responsive behavior in operational pages that use tables, grids, and cards.
5. Verify with frontend build and backend focused tests before expanding scope.

## Public Interface Constraints

- Do not change public routes, request payloads, response shapes, or auth flow in the first phase.
- Do not add database migrations unless a later feature explicitly requires them.
- Do not rename backend concepts such as `deals` to `opportunities` yet; handle Salesforce-like terminology at the UI/product layer first.
- Do not introduce complex automation or metadata-field systems until the modular UI and admin/RBAC base is cleaner.

## Current Progress Notes

- `frontend/src/app/email/page.tsx` has started moving toward a modular console structure.
- Backend CSV import normalization has started with deals via pure helpers and unit tests.
- `npm run build` passed after the email modularization.
- `cargo test --test csv_tests` passed after CSV helper extraction.
- `cargo check` passed, with existing warnings unrelated to this plan still present.
- `npm run lint` currently opens the Next.js ESLint setup prompt instead of running non-interactively; lint configuration should be addressed before relying on it in CI.

