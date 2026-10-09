# Milestone 2 Todo

## Quotations

- [x] Add validated transactional quotation editing; preserve order snapshots and block edits after conversion.
- [x] Build quotation create/edit form with client selection, editable line items, discounts, dates, terms, and live totals.
- [x] Add quotation detail view and status workflow (draft, sent, accepted, rejected, expired, cancelled).
- [x] Convert accepted quotations into orders from the UI and verify duplicate conversion behavior.

## Orders, tasks, and payments

- [x] Build order creation and status workflow screens, including due dates, requirements, and priorities.
- [x] Build linked and independent task list/create/status screens.
- [x] Build order payment entry and payment history views with remaining balance shown.
- [x] Refresh dashboard and related lists after changes; show loading, validation, empty, and API error states.

## Quality and documentation

- [x] Add API tests for quotation edits, conversion safeguards, and the new workflows.
- [x] Run the production build and automated tests where the runtime permits; record sandbox limitations.
- [x] Update README with the completed Milestone 2 UI and API behavior.
- [x] Mark completed items here and list any real limitations.

## Verification note

TypeScript checking and a Vite production build pass. The test suite passes database initialization/migration checks; API integration cases are skipped when the managed runtime denies loopback TCP with `EACCES`. Run `npm test` in a local environment with loopback access to execute the full integration suite.
