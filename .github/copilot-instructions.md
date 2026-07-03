# CoreLLM — Copilot Instructions

> Guidelines for AI coding assistants (Copilot, Claude, etc.) working on this extension.

## Project Overview

**CoreLLM** is a VS Code extension that monitors LiteLLM API key balances, budgets, and usage from the status bar.

- **Language:** TypeScript (compiled to CommonJS)
- **Runtime:** VS Code Extension Host (Node.js)
- **Target VS Code:** `^1.85.0`
- **No bundler** — plain `tsc` compilation (`src/` → `out/`)
- **No test framework** currently configured

## Architecture

```
src/
├── extension.ts   # Main entry point (~3400 lines)
│   ├── Types & interfaces        (KeyInfoResponse, SpendLogEntry, etc.)
│   ├── getConfig()               # Reads all VS Code settings
│   ├── CoreLLMApiClient          # HTTP client (fetch-based) with caching + auth
│   ├── BalanceStatusBarManager   # Status bar + all webview panels + commands
│   ├── HTML builders             # Inline webview HTML generators
│   ├── checkForUpdates()         # GitHub release/tag polling
│   ├── activate() / deactivate() # Extension lifecycle
│   └── CURRENT_VERSION           # Single source of truth for version
└── tutorial.ts    # Tutorial & changelog HTML builders (~850 lines)
```

### Key Design Decisions

1. **Single-file architecture** — `extension.ts` contains everything except tutorial HTML. When adding features, follow this pattern unless the file becomes unmaintainable.
2. **Inline HTML** — All webview panels generate HTML via template literals. No external CSS/JS files. Use `acquireVsCodeApi()` for messaging.
3. **fetch-based HTTP** — Uses the global `fetch` API (available in VS Code 1.85+). No `axios` or `node-fetch` dependency.
4. **Config-driven** — All user-configurable behavior lives in `package.json` `contributes.configuration` and is read via `getConfig()`.
5. **Caching** — `CoreLLMApiClient` has an in-memory TTL cache (default 30s) controlled by `corellm.cacheResults`.

## Build & Run

```bash
npm install          # Install dependencies
npm run compile      # One-time compile (tsc -p ./)
npm run watch        # Watch mode (background task, default build task)
npm run lint         # ESLint
npx @vscode/vsce package  # Build .vsix (use Node 20+)
```

**Run the extension:** Press `F5` in VS Code (launches Extension Development Host with watch task).

## Coding Conventions

### TypeScript

- **Strict mode** is on (`"strict": true` in tsconfig.json).
- **Target:** ES2021, **Module:** CommonJS.
- Use `interface` for API response shapes — always include an index signature `[key: string]: unknown` for forward-compat.
- Prefer `async/await` over `.then()` chains.
- Use `vscode.Disposable` pattern — push all disposables to `context.subscriptions` or `this.disposables`.

### VS Code API Patterns

- **Commands:** Register with `vscode.commands.registerCommand('corellm.<name>', ...)`. Always add the command to `package.json` `contributes.commands`.
- **Settings:** Add new settings to `package.json` `contributes.configuration.properties` with `type`, `default`, and `description`. Read them in `getConfig()`.
- **Webview panels:** Use `vscode.window.createWebviewPanel`. Set `enableScripts: true`. Handle messages via `panel.webview.onDidReceiveMessage`.
- **Status bar:** Use `vscode.window.createStatusBarItem`. Always set `.name` for accessibility.

### Webview HTML

- Use template literals (backticks) for HTML generation.
- Escape user-provided strings with `escapeHtml()`.
- Theme support: read `corellm.webviewTheme` setting, generate CSS overrides via `buildThemeOverrides()`.
- Message passing: `vscode.postMessage({ type: '...', ... })` → `panel.webview.onDidReceiveMessage`.

### Error Handling

- API errors: catch and show user-friendly messages via `vscode.window.showErrorMessage`.
- 403 errors: detect "not allowed to call this route" and suggest using `adminKey`.
- Network errors: show "Are you online?" style messages.
- Never crash the extension host — always wrap async operations in try/catch.

## Version Management

- **`CURRENT_VERSION`** in `extension.ts` (line ~3221) is the single source of truth.
- **`CURRENT_VERSION`** in `tutorial.ts` (line ~7) must match.
- **`package.json`** `"version"` must match.
- When bumping version: update all three, add a `CHANGELOG.md` entry, tag with `vX.Y.Z`, and rebuild the VSIX.

## LiteLLM API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/key/info` | GET | Key balance, budget, models |
| `/key/list` | GET | All keys (admin) |
| `/spend/logs` | GET | Recent spend entries |
| `/global/spend/report` | GET | Daily spend by team/key |
| `/global/spend/keys` | GET | Spend by key |
| `/global/spend/models` | GET | Spend by model |
| `/provider/budgets` | GET | Provider budget limits |
| `/v1/models` | GET | Available models |
| `/login` | POST | Username/password auth (JWT) |

Auth priority: login-derived key → `adminKey` → `apiKey`.

## Common Tasks

### Adding a new command

1. Add to `package.json` → `contributes.commands` with `command: "corellm.<name>"` and `title: "CoreLLM: <Title>"`.
2. Register in `BalanceStatusBarManager.registerCommands()`.
3. If it opens a panel, add a `private open<Name>(): void` method and a panel field.

### Adding a new setting

1. Add to `package.json` → `contributes.configuration.properties` as `corellm.<name>`.
2. Add field to `ExtensionConfig` interface.
3. Read it in `getConfig()` with proper default.
4. If it affects live behavior, handle it in `watchConfigChanges()`.

### Adding a new panel

1. Add a `private <name>Panel: vscode.WebviewPanel | undefined` field.
2. Write a `private open<Name>(): void` method following the existing pattern (dispose on close, reuse if visible).
3. Write an HTML builder function (inline or as a method).
4. Register the command and add to `package.json`.

## Do NOT

- ❌ Do not add bundlers (webpack, esbuild) — the project uses plain `tsc`.
- ❌ Do not add runtime dependencies — keep the extension zero-dependency (devDeps only).
- ❌ Do not use `node-fetch` — use the global `fetch` API.
- ❌ Do not commit `.vsix` files to the repo root (they bloat the repo; use GitHub Releases).
- ❌ Do not commit `out/` or `node_modules/`.
- ❌ Do not use `any` — use `unknown` with type guards or proper interfaces.
- ❌ Do not forget to dispose resources (timers, panels, listeners).

## Git Workflow

- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- After successful changes: commit and push to `main`.
- Before final commit: rebuild VSIX with `npx @vscode/vsce package` (Node 20+).
- Tag releases as `vX.Y.Z` and force-push tags if re-tagging.
