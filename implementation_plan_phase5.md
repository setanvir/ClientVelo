# Phase 5 - Local Web Dashboard Implementation Plan

This phase introduces a professional, responsive, local web dashboard for the ClientVelo Engine to review and approve outreach, without modifying the underlying JSON backend logic. 

## User Review Required

> [!WARNING]
> **Data Concurrency (`updateJson`)**
> The spec requires using `updateJson` for *every dashboard write*, but also strictly requires reusing existing functions like `approveDraft` without changing their signatures. 
> To satisfy both, I will internally refactor the existing store-mutating functions (e.g., in `drafts.ts` and `suppression.ts`) to utilize the new concurrency-safe `updateJson` lockfile utility under the hood. Their external API and CLI behavior will remain identical, ensuring 100% backward compatibility and passing tests. 

## Proposed Changes

### Phase 5A: Server Setup, Security, and Read-Only API
- **`src/store.ts`**: Add `updateJson<T>(filePath, schema, updaterFn)` using a file-based lock (`wx` flag) with a stale-lock timeout (e.g., 5 seconds) to guarantee safe read-modify-write cycles between CLI runs and the dashboard. Keep existing `writeJsonArray` for atomic renames. Refactor `suppression.ts` and `drafts.ts` internally to use `updateJson`.
- **`package.json`**: Add `express`, `@types/express` as new dependencies. Add `"serve": "tsx src/cli.ts serve"`.
- **`src/server.ts` & `src/server-routes.ts`**: Bootstrap Express 5 on `127.0.0.1:PORT`. 
  - Host header validation to reject anything other than `127.0.0.1:PORT` or `localhost:PORT`.
  - Security headers via middleware (CSP, X-Content-Type-Options, Referrer-Policy, X-Frame-Options).
  - Validation middleware for `X-CV-Token` (required on mutating routes).
  - Add read-only API routes (`GET /api/status`, `/api/stats`, `/api/leads`, `/api/drafts`, `/api/screenshots/:leadId`).
- **`src/cli.ts`**: Implement the `serve [--demo]` command. When `--demo` is set, populate a temporary data folder with placeholder data and override `store.PATHS`. It will print the local URL with a query param: `http://127.0.0.1:3000/?t=<TOKEN>`.
- **UI Shell (`public/index.html`, `public/js/app.js`, `public/styles.css`)**: 
  - Implement Vanilla JS routing, ES modules, and Tailwind CSS (via CDN).
  - Store token from URL in memory and clean up the address bar via `history.replaceState`.
  - Add standard layout: Left sidebar, top bar with DRY RUN badge. 
  - Build the **Overview** dashboard and **Leads** table view.

### Phase 5B: Review Workspace & Mutating APIs
- **Backend**: Implement mutating routes (`PATCH /api/drafts/:id`, `POST /api/drafts/:id/approve`, `POST /api/drafts/:id/revoke`, `POST /api/suppression/:action`) mapped directly to Zod-validated schemas and the existing business logic. 
- **Frontend (Review Workspace)**: Split-screen visual approval workspace.
  - Left panel: Draft queue list.
  - Center panel: Plain-text editable email preview with real-time validation error rendering.
  - Right panel: Phone-frame (390x844) displaying the screenshot, evidence text, and validation checklist.
- **Frontend Shortcuts**: Implement keyboard handlers for J/K (navigation), A (approve), S (skip), and E (edit). Use safe DOM manipulation (`textContent`, `createElement`) to prevent XSS.

### Phase 5C: Manual Outreach, Dispatch Logs, Polish
- **Backend**: Expose `/api/manual/export` and `/api/dispatch`.
- **Frontend**: 
  - **Manual Outreach View**: Queue for phone-only leads, including a prefilled `wa.me` WhatsApp link generator.
  - **Dispatch View**: Live polling log of the dispatch queue, expanding rows for SMTP response details.
- **Polish**: Finalize "ClientVelo Slate" design system adherence. Update `README.md` with instructions on how to use the dashboard and the `--demo` mode.

## Verification Plan

### Automated Tests
- Full existing test suite (`npm test`) must pass to prove the CLI and engine backend were not broken by `updateJson` refactors.
- New unit tests for `store.updateJson` to verify lockfile creation, conflict resolution, and stale lock timeouts.
- New unit tests for `server.ts` to ensure Host header rejection, missing token rejection, and CSP header presence.

### Manual Verification
- Run `npm run cli serve --demo`.
- Verify the URL token logic and CSS load without errors.
- Perform a live review using keyboard shortcuts and approve a draft in the UI.
- Verify that a simultaneous CLI write during a UI write correctly respects the lockfile without corruption.
