# Tangible positions workspace

[Open the live website](https://dawidskinder.github.io/tangible/)

This repository contains the interactive implementation of a Senior UX/UI Designer assignment for Tangible. The work redesigns an advisor's private-market positions grid so the advisor can locate a client position, understand its liquidity state, and enter the correct next workflow with less ambiguity.

The implementation extends the requested grid deliverable into a responsive website. It uses deterministic synthetic data and does not connect to Tangible systems.

## Included capabilities

- Search across position, manager, client, and account identifiers
- Operational views for new, sell-ready, in-progress, review, blocked, and monitored positions
- Advanced filtering, stable sorting, configurable columns, density controls, and pagination
- Valuation evidence, permission-aware action states, and a separate Sell-flow handoff
- Desktop table, tablet table, and mobile card compositions
- DS Tangible plus four visual-system comparisons over one shared product model
- Keyboard-accessible controls, focus management, Axe checks, and operator diagnostics
- CSV export with query context and a synthetic-data declaration

## Run locally

Requirements: Node.js 20.19+, 22.12+, or 24+.

```bash
npm ci
npm run dev
```

Vite prints the local URL, normally `http://127.0.0.1:5173`.

## Validate

```bash
npm run validate:inner
npm run validate:ci
npm run validate
```

- `validate:inner` runs formatting, lint, type checking, and unit tests.
- `validate:ci` adds the production build, publication audit, search-exclusion check, browser behavior, and automated accessibility checks.
- `validate` adds the complete local Chrome/WebKit and visual-regression gate.

See [- START.md](./-%20START.md) for setup, operation, diagnostics, and troubleshooting.

## Repository map

- `src/`: application state, rendering, interaction, motion, themes, and styles
- `public/`: local runtime assets, fonts, icons, and license notices
- `tests/`: unit, DOM, browser, accessibility, privacy, and visual-regression checks
- `scripts/`: publication-boundary audit
- `.github/workflows/`: CI and GitHub Pages deployment

## Boundaries

- All position, client, account, valuation, and workflow records are synthetic fixtures.
- Row actions demonstrate state and handoff behavior. They do not execute transactions.
- Market ranges, permissions, lifecycle rules, and backend contracts require validation against Tangible's production model.
- Search engines receive explicit no-index directives because this is an assessment prototype.

Tangible received the complete design rationale, Figma guide, change matrix, engineering handover, data contract, validation evidence, and a frozen copy of this source through a separate private handover repository.
