# Changelog

All notable changes to the CoreLLM VS Code extension.

## 0.7.3

- **Improved:** Changelog "What's New" panel now parses `CHANGELOG.md` at runtime — no more manually keeping hardcoded data in sync, future entries appear automatically

## 0.7.2

- **Fixed:** "Check for Updates" crash — replaced `AbortSignal.timeout()` (unavailable in VS Code's bundled Node) with manual `AbortController` + `setTimeout`

## 0.7.1

- **Fixed:** `apiKey` and `adminKey` settings now masked as password fields in Settings UI (eye-toggle supported)
- **Docs:** Version bump and push workflow now mandatory for every change/feature

## 0.7.0

- **New: Tutorial/Getting Started panel** (`CoreLLM: Show Tutorial`) — interactive guide covering quick start, authentication, status bar, commands, panels, settings, tips, and FAQ with theme toggle
- **New: Changelog panel** (`CoreLLM: Show Changelog`) — view what's new after each update, auto-shown on version upgrade
- **New: Key Health panel** (`CoreLLM: Show Key Health`) — health status for all API keys
- **New: Model Info panel** (`CoreLLM: Show Model Info`) — model catalog with provider, pricing, capabilities
- **New: Spend by Tags panel** (`CoreLLM: Show Spend by Tags`) — spending breakdown by tag
- **New: Teams panel** (`CoreLLM: Show Teams`) — team-level spend overview
- **New: Activity panel** (`CoreLLM: Show Activity`) — user activity feed
- **New: Global Spend panel** (`CoreLLM: Show Global Spend`) — organization-wide spend report
- **Improved: Budget Overview** — added daily cost trend line chart with interactive date pickers
- **Improved: Budget Overview** — added cost efficiency metrics (cost/req, cost/token, tokens/req)
- **Improved: Spend Logs** — added cost-per-token column and summary stats
- **Improved: Key List** — over-budget keys highlighted with red border and "OVER" badge
- **Improved: Status bar** — clickable cycle through 4 display modes (remaining, usage bar, spend, budget)
- **Improved: Error handling** — better messages for 403 management permission errors
- **Improved: Tooltip** — rich markdown tooltip with ASCII usage bar, models, budget info

## 0.5.0

- **New: Budget Overview dashboard** — full webview panel with daily spend bar chart, provider budgets, model donut chart, and recent spend logs
- **New: Spend Logs panel** — paginated table with search filtering
- **New: Key List panel** — all keys with spend/budget bars, search, and export
- **New: CSV export** — every panel includes an export button
- **New: Theme toggle** — panels support vscode/light/dark/high-contrast themes
- **New: Budget warnings** — status bar color changes when remaining budget drops below threshold
- **New: Auto-refresh** — configurable polling interval with toggle commands
- **New: Update checker** — automatic GitHub release checks with one-click install
- **New: Login-based auth** — username/password login with JWT session key extraction
- **New: Display cycling** — click status bar to cycle between remaining/spend/usage/budget views
- **Improved: Status bar tooltip** — rich hover info with key alias, spend, budget, models, user/team IDs
- **Improved: Auth fallback** — falls back to /key/list if /key/info returns zero spend
- **Improved: Configuration UI** — all settings with descriptions and validation
- **Fixed: 403 handling** — graceful degradation when LLM key lacks management permissions

## 0.4.0

- **New: Status bar balance display** — shows remaining budget or total spend
- **New: Auto-refresh** — configurable interval (default 60s)
- **New: Rich tooltip** — hover to see spend, max budget, usage %, user ID, team, models
- **New: Multiple auth modes** — API key, admin key, or username/password login
- **New: Budget warnings** — color changes when remaining budget drops below threshold
- **New: Key alias display** — shows key alias/name next to balance
- **New: API endpoint support** — /key/info, /spend/logs, /provider/budgets, /global/spend/report, /key/list, /v1/models

## 0.3.0

- Initial release with basic LiteLLM proxy connection and balance checking
