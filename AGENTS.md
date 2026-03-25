# AGENTS.md

## Cursor Cloud specific instructions

### Overview
**Agenda Pro Max** is a zero-dependency, vanilla JavaScript PWA (Progressive Web App) — a professional agenda manager in Brazilian Portuguese. No build step, no package manager, no transpilation. All `.js` and `.css` files are served directly as static assets.

### Running the app
Serve the repository root with any static HTTP server:
```
npx serve -l 3000 .
```
Then open `http://localhost:3000/` in Chrome.

### Testing
The only automated test is a Node.js smoke check (no npm dependencies required):
```
node smoke-check.js
```
This verifies critical files exist and that `index.html` contains required function signatures. It runs in CI via GitHub Actions with Node 20.

### Linting
There is no linter configured in this project. The codebase uses vanilla JS with no ESLint, Prettier, or similar tools.

### Key architecture notes
- **Single HTML entry point**: `index.html` is the entire app (~10k+ lines), with global-scope JS modules loaded via `<script>` tags in specific order.
- **Offline-first**: Service Worker (`sw.js`) pre-caches all core assets. The app works fully offline.
- **Client storage**: Dual-write to `localStorage` + IndexedDB. No server-side database required.
- **Optional cloud sync**: Supabase integration is user-configured opt-in via the app's sync settings UI. Not required for local development.
