# CoreLLM

> **Monitor your LiteLLM API key balance, budget, and usage — right from the VS Code status bar.**

![status](https://img.shields.io/badge/status-active-green)
![version](https://img.shields.io/badge/version-0.1.0-blue)

---

## ✨ Features

- **Status bar balance** — shows remaining budget or total spend at a glance
- **Auto-refresh** — configurable polling interval (default: 60s)
- **Rich tooltip** — hover to see spend, max budget, usage %, user ID, team, models
- **Budget warnings** — color changes when remaining budget drops below threshold
- **Multiple auth modes** — API key, admin key, or username/password login
- **Budget Overview panel** — full dashboard with:
  - Daily spend bar chart (customizable range: 1h / 24h / 7d / 30d / custom)
  - Provider budget bars
  - Model usage donut chart
  - Recent spend logs table
  - Cost efficiency metrics (cost/req, cost/token)
  - Export to CSV
- **Spend Logs panel** — browse latest 50 spend entries with search & cost/token
- **Key List panel** — all keys with spend/budget bars, search, over-budget highlight
- **Global Spend panel** — proxy-wide spend broken down by key, model, and team with SVG charts
- **Teams panel** — team budgets, spend, members, models, blocked status
- **Activity panel** — proxy activity timeline with spend trend line chart
- **Model Info panel** — model catalog with pricing, capabilities, providers (searchable)
- **Spend by Tags panel** — cost tracking by custom spend tags with bar chart
- **Key Health panel** — key health status, last access, and models

---

## 📦 Installation

### Via VSIX

```bash
# Download from GitHub Releases or build locally, then:
code --install-extension corellm-0.1.0.vsix
```

Or in VS Code: `Extensions` → `...` → `Install from VSIX...`

### From source

```bash
git clone https://github.com/core-innovation/litellm-balance-checker.git
cd litellm-balance-checker
npm install
npm run compile
npx @vscode/vsce package
code --install-extension corellm-0.1.0.vsix
```

Press `F5` in VS Code for an Extension Development Host window.

---

## ⚙️ Settings

Open VS Code settings (`Cmd+,`) and search for `corellm`.

### Option A: Direct API key

```json
"corellm.apiKey": "sk-your-key-here"
```

### Option B: Username / Password (auto-login)

```json
"corellm.username": "you@company.com",
"corellm.password": "your-password"
```

Logs in via `POST /login`, extracts the embedded `sk-...` key from the JWT session.

### Option C: Separate admin key

```json
"corellm.apiKey": "sk-your-llm-key",
"corellm.adminKey": "sk-proxy-master-key"
```

### All settings

| Setting | Default | Description |
|---------|---------|-------------|
| `apiKey` | `""` | LiteLLM API key (fallback auth) |
| `adminKey` | `""` | Proxy admin key for management API calls |
| `username` | `""` | UI username — logs in and extracts session key |
| `password` | `""` | UI password |
| `endpoint` | `http://localhost:4000` | LiteLLM proxy base URL |
| `refreshInterval` | `60` | Polling interval in seconds (min 5, 0 = off) |
| `showKeyAlias` | `true` | Show key alias next to the balance |
| `showSpendLogs` | `false` | Append recent spend total to status bar |
| `budgetWarningThreshold` | `20` | Warning color when remaining budget % is below this |
| `keyToQuery` | `""` | Query a specific key (uses auth settings for credentials) |
| `reportDuration` | `"7d"` | Time range for budget spend charts (`1h`, `24h`, `7d`, `30d`, `custom`) |
| `reportCustomStart` | `""` | Custom start date (YYYY-MM-DD) when `reportDuration=custom` |
| `reportCustomEnd` | `""` | Custom end date (YYYY-MM-DD) when `reportDuration=custom` |
| `updateCheckInterval` | `24` | Hours between GitHub update checks |
| `webviewTheme` | `"vscode"` | Theme override for panels (vscode/light/dark/hc) |
| `showTeamSpend` | `false` | Show team-level spend in the status bar |
| `showGlobalSpend` | `false` | Show global spend totals in the status bar |
| `showModelSpend` | `false` | Show per-model spend breakdown in panels |
| `cacheResults` | `true` | Cache API results to reduce network requests |
| `spendAlertThreshold` | `0` | Alert threshold in USD (0 = disabled) |
| `enableActivityMonitoring` | `false` | Auto-refresh activity monitoring panels |
| `teamFilter` | `""` | Filter data by specific team ID |
| `defaultPanelTab` | `"overview"` | Default panel tab (overview/global/teams/activity) |
| `statusBarDisplayMode` | `"cycle"` | Default display mode (cycle/remaining/spend/usage-bar/budget) |

---

## 🚀 Commands

| Command | Description |
|---------|-------------|
| `CoreLLM: Refresh Balance` | Manually refresh the status bar |
| `CoreLLM: Show Budget Overview` | Open full dashboard with charts |
| `CoreLLM: Show Spend Logs` | Open paginated spend logs panel |
| `CoreLLM: List All Keys` | List all keys with spend & budget |
| `CoreLLM: Show Global Spend` | Global spend breakdown by key, model, and team |
| `CoreLLM: Show Teams` | Team budgets, spend, members, and models |
| `CoreLLM: Show Activity` | Proxy activity timeline with spend trend chart |
| `CoreLLM: Show Model Info` | Model catalog with pricing and capabilities |
| `CoreLLM: Show Spend by Tags` | Cost tracking by custom spend tags |
| `CoreLLM: Show Key Health` | Key health status and last access |
| `CoreLLM: Toggle Auto-Refresh` | Enable/disable polling |
| `CoreLLM: Enable Auto-Refresh` | Start auto-refresh polling |
| `CoreLLM: Disable Auto-Refresh` | Stop auto-refresh polling |
| `CoreLLM: Set Report Duration` | Choose time range for charts (1h/24h/7d/30d/custom) |
| `CoreLLM: Cycle Status Bar Display` | Cycle through remaining, usage bar, spend, budget |
| `CoreLLM: Open Settings` | Jump to extension settings |
| `CoreLLM: Check for Updates` | Check for new version on GitHub |
| `CoreLLM: About` | Show extension version info |

---

## 🔌 API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /login` | Login with username/password (auth method B) |
| `GET /key/info` | Key spend, budget, metadata |
| `GET /key/list` | All keys with spend/budget |
| `GET /key/health` | Key health status |
| `GET /provider/budgets` | Per-provider spend & budget limits |
| `GET /global/spend/report` | Daily spend by team |
| `GET /global/spend/keys` | Global spend breakdown by key |
| `GET /global/spend/models` | Global spend breakdown by model |
| `GET /global/spend/teams` | Global spend breakdown by team |
| `GET /global/activity` | Global proxy activity |
| `GET /spend/logs` | Recent spend log entries |
| `GET /spend/tags` | Spend breakdown by custom tags |
| `GET /team/list` | List all teams with budgets |
| `GET /team/info` | Detailed team info |
| `GET /model/info` | Detailed model info with pricing |
| `GET /v1/models` | Accessible models |

---

## 🛠️ Dev

```bash
npm install
npm run compile   # tsc -p ./
npm run watch     # tsc --watch
npx @vscode/vsce package   # build .vsix
```

## 📄 License

MIT
