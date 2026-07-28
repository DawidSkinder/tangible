# Tangible website runbook

Tangible commissioned the redesign of its advisor positions workspace. This repository contains the interactive reference implementation, which uses synthetic data and does not connect to Tangible production systems.

## Prerequisites

- Node.js 20.19+, 22.12+, or 24+
- Google Chrome
- Playwright WebKit for the complete local browser gate

No secrets or environment variables are required.

## First-time setup

```bash
npm run setup
```

The command installs the locked Node dependencies and Playwright WebKit.

## Normal start

```bash
npm run dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173`.

The layout control in the top-right corner switches between desktop and mobile compositions without requiring a browser resize.

## Stop and restart

- Stop the server with `Control-C`.
- Restart it with `npm run dev`.

## Production build and preview

```bash
npm run build
npm run preview
```

Vite writes the build to `dist/`.

## Tests and checks

Fast inner-loop gate:

```bash
npm run validate:inner
```

GitHub-compatible gate without macOS visual baselines:

```bash
npm run validate:ci
```

Complete local release gate:

```bash
npm run validate
```

Targeted commands:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run test:webkit
npm run test:visual
npm run privacy:check
npm run release:audit
```

Browser tests start and stop their own Vite server. The complete gate uses installed Google Chrome and Playwright WebKit. The CI gate uses Playwright Chromium and WebKit and excludes host-specific visual baselines.

## GitHub Pages

The `pages.yml` workflow validates `main`, builds with the `/tangible/` base path, and deploys the `dist/` artifact. The public website URL is:

<https://dawidskinder.github.io/tangible/>

## Operator diagnostics

Press `Shift+D` while focus is outside a text field. The diagnostics panel reports:

- build and effective layout;
- total and visible synthetic rows;
- active-filter count and page;
- browser information;
- the latest captured runtime error.

Use **Copy report** to create a compact diagnostic payload for a Codex task.

## Troubleshooting

- **Port in use:** stop the other Vite process or run `npm run dev -- --port 5174`.
- **Chrome missing:** install Google Chrome, then rerun `npm run test:e2e`.
- **WebKit missing:** run `npx playwright install webkit`, then rerun `npm run test:webkit`.
- **A control does not respond:** press `Shift+D`, copy the report, and attach it to a Codex task.
- **A visual snapshot changed:** inspect the diff in `test-results/`. Update a baseline only after confirming the intended design change.
