# Changelog

All notable changes to the CoreLLM VS Code extension.
## 0.8.14 (2026-07-08)

- **Chore:** Moved copilot prompts to `.github/prompts/` directory for better organization
## 0.8.13

- **Improved:** All settings now logically grouped with VS Code's `order` property — Auth & Connection, Status Bar, Dashboards, Monitoring, Alerts, Advanced
- **Improved:** Every setting description rewritten to be more meaningful — includes usage examples, edge cases, and cross-references to related settings
- **Improved:** `markdownDescription` used for complex settings with bullet points, code formatting, and examples
- **Fixed:** Confusing `budgetWarningThreshold` vs `budgetAlertThreshold` — descriptions now clearly distinguish remaining-based vs usage-based thresholds
- **Fixed:** `spendAlertThreshold` description now clarifies it's per-request, not cumulative
## 0.8.13

- **Removed:** GitHub-based update check mechanism (`checkForUpdates`, release/tag polling, `updateCheckInterval` setting) — updates now delivered through the VS Code Marketplace
- **Removed:** `CoreLLM: Check for Updates` command
- **Removed:** `corellm.updateCheckInterval` configuration setting
- **Updated:** FAQ and tutorial reflect Marketplace-based updates

## 0.8.11

- **Added:** Welcome screen — shown automatically on first install with quick-start steps, feature overview, and action buttons
- **Added:** `CoreLLM: Show Welcome Screen` command to re-open the welcome screen at any time

## 0.8.10

- **Docs:** Comprehensive README rewrite — better organization, quick start guide, FAQ, contributing section, security highlights, badges, architecture diagram
- **Marketplace:** Enhanced `package.json` metadata — improved description, keywords, gallery banner, homepage, bug tracker, categories (Data Science + Visualization), badges, pricing
- **License:** Updated copyright year and entity

## 0.8.9

- **Security:** Redact sensitive headers (Authorization, API keys, cookies) from Request Logs to prevent credential exposure
- **Security:** Redact sensitive JSON fields (key, token, password) from logged response bodies
- **Security:** Change default endpoint from `http://core.llm` to `http://localhost:4000` to prevent accidental connections to an external domain

## 0.8.8

- **Changed:** Extension icon now uses `docs/logo.png`

## 0.8.7

- **Added:** PDF export button (`📄 PDF`) on all panels — uses `window.print()` to open the OS print dialog where users can save as PDF
- **Added:** `@media print` CSS rules to format all panels cleanly for PDF/print output (hides toolbars, buttons, search bars; adjusts colors for print)
- **Added:** CSV export buttons on Health Dashboard and Key Health panels (previously missing)
- PDF export available on: Budget Overview, Spend Logs, Key List, Global Spend, Teams, Activity, Spend Tags, Model Info, Key Health, Health Dashboard, Provider Spend, User Manager, and Unified Dashboard

## 0.8.6

- **Added:** Request Logs panel (`CoreLLM: Show Request Logs`) — view raw HTTP request/response text for debugging
- **Added:** `corellm.enableRequestLogging` setting to toggle request/response logging (off by default)
- Each log entry shows method, URL, headers, body, response status, response body, and duration
- Logs are expandable/collapsible with copy-to-clipboard buttons

## 0.8.5

- **Improved:** Replaced all emoji icons with Material Design SVG icons across all panels for a more polished, professional look
- **Improved:** Redesigned CSS with Material-inspired styling — refined spacing, typography, shadows, button hover effects, and card transitions
- **Improved:** Enhanced tab bar with fade-in animation and better active state styling
- **Improved:** Summary bar items now have hover feedback and refined typography
- **Improved:** Toast notifications, error boxes, and toolbar buttons now have more consistent Material-like styling

## 0.8.4

- **Fixed:** Cancel button on loading screens now actually closes the panel instead of doing nothing

## 0.8.3

- **Removed:** Admin-only budget features (Provider Budgets, Global Spend Report) from the Budget Overview panel — non-admin users no longer see auth error boxes
- **Improved:** Budget Overview now only uses `/key/info` and `/spend/logs` endpoints, which work with a simple user API key
- **Simplified:** Removed date range selector and admin permissions banner from Budget Overview

## 0.8.2

- **Fixed:** Update checker only checked GitHub Releases (v0.8.0), missing newer git tags (v0.8.1). Now always checks tags too and uses whichever is newer.

## 0.8.1

- **Fixed:** Dashboard total spend now correctly shows key spend instead of 0 when global report is unavailable for non-admin users
- **Fixed:** Non-admin users no longer see permission error boxes in Dashboard and Budget Overview — a friendly banner now points them to configure admin credentials
- **Improved:** Added `/key/list` fallback in Dashboard to populate spend data when the key itself has no recorded spend

## 0.8.0

- **Security:** Credentials (`apiKey`, `adminKey`, `password`) are now stored in the OS keychain via VS Code's `SecretStorage` API instead of plaintext `settings.json`
- **New:** `CoreLLM: Set API Key (Secure)` — store API key in OS keychain
- **New:** `CoreLLM: Set Admin Key (Secure)` — store admin key in OS keychain
- **New:** `CoreLLM: Set Password (Secure)` — store password in OS keychain
- **New:** `CoreLLM: Clear All Stored Credentials` — remove all secrets from keychain
- **Migration:** Existing credentials in `settings.json` are automatically migrated to the OS keychain on first launch

## 0.7.4

- **Fixed:** Update checker was broken — repo had tags but no GitHub Releases. Created releases for all tags and improved `checkForUpdates` to handle rate limiting, download failures, network errors, and the "no VSIX asset" case gracefully.

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
