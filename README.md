# CoreLLM — VS Code Extension

<p align="center">
  <img src="docs/logo.png" alt="CoreLLM Logo" width="128" />
</p>

<p align="center">
  <strong>Monitor your LiteLLM proxy — balances, budgets, spend, keys, teams, and activity — directly from the VS Code status bar.</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=CoreInnovation.corellm"><img src="https://img.shields.io/badge/VS%20Code-Marketplace-blue?logo=visualstudiocode" alt="VS Code Marketplace" /></a>
  <a href="https://github.com/core-innovation/litellm-balance-checker"><img src="https://img.shields.io/badge/GitHub-repo-black?logo=github" alt="GitHub" /></a>
  <img src="https://img.shields.io/badge/version-0.8.9-blue" alt="Version" />
  <img src="https://img.shields.io/badge/vscode-%5E1.85.0-blue?logo=visualstudiocode" alt="VS Code" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-green?logo=nodedotjs" alt="Node.js" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

---

## Why CoreLLM?

Running a LiteLLM proxy? You need to know **who's spending what, when, and how much budget is left** — without constantly switching to a browser or running `curl` commands.

CoreLLM puts all of that in your editor:

- See your **remaining budget or total spend** in the VS Code status bar at a glance, with auto-refresh.
- Get **color-coded warnings** when budgets run low.
- Dive into **rich dashboards** for spend breakdowns, key health, team budgets, model pricing, activity timelines, and more.
- **Zero dependencies** — uses the VS Code `fetch` API, no bundler, no runtime deps.
- **Secure by default** — credentials stored in the OS keychain, never in plaintext settings.

---

## ✨ Features

### Status Bar Monitor
- **Balance display** — remaining budget, total spend, or usage bar, click to cycle modes
- **Auto-refresh** — configurable polling interval (default 60s, min 5s)
- **Rich tooltip** — hover for spend, max budget, usage %, user ID, team, model list
- **Budget warnings** — status bar turns yellow/orange/red as budget depletes
- **Key alias** — optionally show the key alias/name alongside the balance

### Rich Dashboards (Webview Panels)
| Panel | Description |
|-------|-------------|
| **Dashboard** | Unified overview — spend summary, recent logs, key health at a glance |
| **Budget Overview** | Daily spend bar chart, model donut chart, recent spend logs table, cost efficiency metrics, CSV/PDF export |
| **Spend Logs** | Browse recent spend entries with search & cost/token columns |
| **Key List** | All keys with spend/budget bars, search, over-budget highlighting |
| **Global Spend** | Proxy-wide spend broken down by key, model, and team with SVG charts |
| **Teams** | Team budgets, spend, members, models, blocked status |
| **Activity** | Proxy activity timeline with spend trend line chart |
| **Model Info** | Model catalog with pricing, capabilities, providers (searchable) |
| **Spend by Tags** | Cost tracking by custom spend tags with bar chart |
| **Key Health** | Key health status, last access time, model assignments |
| **Health Dashboard** | Aggregated health overview across all keys |
| **Provider Spend** | Per-provider spend & budget limit tracking |
| **User Manager** | User management interface for your LiteLLM proxy |
| **Request Logs** | Raw HTTP request/response debugging (opt-in) |

### Security
- **OS Keychain storage** — `apiKey`, `adminKey`, and `password` stored via VS Code `SecretStorage`, never in plaintext `settings.json`
- **Auto-migration** — existing plaintext credentials migrated to keychain on first launch
- **Request log redaction** — sensitive headers and JSON fields redacted in Request Logs panel

### Authentication
- **Direct API key** — set your LiteLLM API key
- **Login-based** — username/password login via `POST /login`, extracts JWT session key
- **Admin key** — separate proxy master key for admin-only endpoints
- **Auth priority:** login-derived key → admin key → API key

### Export
- **CSV export** on all panels
- **PDF export** via browser print dialog on all panels

---

## 📋 Requirements

- **VS Code** `1.85.0` or later
- **Node.js** `18` or later (for building from source)
- A running [LiteLLM proxy](https://docs.litellm.ai/docs/proxy/quick_start)

---

## 📦 Installation

### VS Code Marketplace

Search for **"CoreLLM"** in the VS Code Extensions view (`Cmd+Shift+X`), or install directly:

```
ext install CoreInnovation.corellm
```

### From VSIX (manual)

Download the latest `.vsix` from [GitHub Releases](https://github.com/core-innovation/litellm-balance-checker/releases), then:

```bash
code --install-extension corellm-0.8.9.vsix
```

Or in VS Code: `Extensions` → `...` → `Install from VSIX...`

### From Source

```bash
git clone https://github.com/core-innovation/litellm-balance-checker.git
cd litellm-balance-checker
npm install
npm run compile
npx @vscode/vsce package
code --install-extension corellm-0.8.9.vsix
```

---

## 🚀 Quick Start

1. Install the extension
2. Open the Command Palette (`Cmd+Shift+P`) → **CoreLLM: Set API Key (Secure)**
3. Enter your LiteLLM API key (stored in OS keychain)
4. (Optional) Set your endpoint in Settings if not `http://localhost:4000`
5. Check your status bar — your balance appears automatically!

For admin features (key management, global spend, teams), also run **CoreLLM: Set Admin Key (Secure)**.

New to CoreLLM? Run **CoreLLM: Show Tutorial** for an interactive walkthrough.

---

## ⚙️ Configuration

Open VS Code Settings (`Cmd+,`) and search for `corellm`, or run **CoreLLM: Open Settings**.

### Authentication

| Setting | Default | Description |
|---------|---------|-------------|
| `corellm.apiKey` | `""` | LiteLLM API key (fallback auth) |
| `corellm.adminKey` | `""` | Proxy admin/master key for management endpoints |
| `corellm.username` | `""` | UI username — logs in via `/login` and extracts session key |
| `corellm.password` | `""` | UI password (for login-based auth) |

> **Security note:** Use the **Set API Key (Secure)** / **Set Admin Key (Secure)** / **Set Password (Secure)** commands to store credentials in your OS keychain instead of `settings.json`.

### Connection

| Setting | Default | Description |
|---------|---------|-------------|
| `corellm.endpoint` | `http://localhost:4000` | LiteLLM proxy base URL |
| `corellm.keyToQuery` | `""` | Query a specific key (different from auth key) |

### Display

| Setting | Default | Description |
|---------|---------|-------------|
| `corellm.refreshInterval` | `60` | Polling interval in seconds (min 5, 0 = off) |
| `corellm.showKeyAlias` | `true` | Show key alias next to the balance |
| `corellm.showSpendLogs` | `false` | Append recent spend total to status bar |
| `corellm.showTeamSpend` | `false` | Show team-level spend in status bar |
| `corellm.showGlobalSpend` | `false` | Show global spend totals in status bar |
| `corellm.showModelSpend` | `false` | Show per-model spend in panels |
| `corellm.statusBarDisplayMode` | `"cycle"` | Default display: `cycle`, `remaining`, `spend`, `usage-bar`, or `budget` |
| `corellm.budgetWarningThreshold` | `20` | Warning color when remaining budget % drops below this |

### Reports

| Setting | Default | Description |
|---------|---------|-------------|
| `corellm.reportDuration` | `"7d"` | Chart time range: `1h`, `24h`, `7d`, `30d`, or `custom` |
| `corellm.reportCustomStart` | `""` | Custom start date (`YYYY-MM-DD`) for `custom` duration |
| `corellm.reportCustomEnd` | `""` | Custom end date (`YYYY-MM-DD`) for `custom` duration |

### Panel & Behavior

| Setting | Default | Description |
|---------|---------|-------------|
| `corellm.webviewTheme` | `"vscode"` | Panel theme: `vscode`, `light`, `dark`, or `hc` |
| `corellm.cacheResults` | `true` | Cache API results (30s TTL) to reduce network requests |
| `corellm.spendAlertThreshold` | `0` | Alert when single spend entry exceeds this USD amount (0 = off) |
| `corellm.enableActivityMonitoring` | `false` | Auto-refresh activity panels |
| `corellm.teamFilter` | `""` | Filter data by specific team ID |
| `corellm.defaultPanelTab` | `"overview"` | Default panel tab: `overview`, `global`, `teams`, or `activity` |
| `corellm.updateCheckInterval` | `24` | Hours between GitHub update checks |
| `corellm.enableRequestLogging` | `false` | Log raw HTTP requests/responses for debugging |

---

## ⌨️ Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `CoreLLM: Refresh Balance` | Manually refresh the status bar |
| `CoreLLM: Toggle Auto-Refresh` | Enable/disable polling |
| `CoreLLM: Enable Auto-Refresh` | Start auto-refresh polling |
| `CoreLLM: Disable Auto-Refresh` | Stop auto-refresh polling |
| `CoreLLM: Cycle Status Bar Display` | Cycle through remaining, usage bar, spend, budget |
| `CoreLLM: Set Report Duration` | Choose time range for charts (1h/24h/7d/30d/custom) |
| `CoreLLM: Open Settings` | Jump to extension settings |

### Dashboard Panels

| Command | Panel |
|---------|-------|
| `CoreLLM: Show Dashboard` | Unified overview dashboard |
| `CoreLLM: Show Budget Overview` | Daily spend charts, model usage, spend logs |
| `CoreLLM: Show Spend Logs` | Paginated spend entries with search |
| `CoreLLM: List All Keys` | All keys with spend & budget bars |
| `CoreLLM: Show Global Spend` | Breakdown by key, model, and team |
| `CoreLLM: Show Teams` | Team budgets, spend, members, models |
| `CoreLLM: Show Activity` | Proxy activity timeline with trend chart |
| `CoreLLM: Show Model Info` | Model catalog with pricing & capabilities |
| `CoreLLM: Show Spend by Tags` | Cost tracking by custom spend tags |
| `CoreLLM: Show Key Health` | Key health status and last access |
| `CoreLLM: Show Health Dashboard` | Aggregated health across all keys |
| `CoreLLM: Show Provider Spend` | Per-provider budget tracking |
| `CoreLLM: Show User Manager` | User management interface |
| `CoreLLM: Show Request Logs` | Raw HTTP request/response debugging |

### Security

| Command | Description |
|---------|-------------|
| `CoreLLM: Set API Key (Secure)` | Store API key in OS keychain |
| `CoreLLM: Set Admin Key (Secure)` | Store admin key in OS keychain |
| `CoreLLM: Set Password (Secure)` | Store password in OS keychain |
| `CoreLLM: Clear All Stored Credentials` | Remove all secrets from keychain |

### Help & Updates

| Command | Description |
|---------|-------------|
| `CoreLLM: Show Tutorial` | Interactive getting-started guide |
| `CoreLLM: Show Changelog` | View recent changes |
| `CoreLLM: Check for Updates` | Check GitHub for new versions |
| `CoreLLM: About` | Version and extension info |

---

## 🔌 Supported LiteLLM API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/key/info` | GET | Key spend, budget, metadata |
| `/key/list` | GET | All keys with spend/budget |
| `/key/health` | GET | Key health status |
| `/provider/budgets` | GET | Per-provider spend & budget limits |
| `/global/spend/report` | GET | Daily spend by team/key |
| `/global/spend/keys` | GET | Global spend breakdown by key |
| `/global/spend/models` | GET | Global spend breakdown by model |
| `/global/spend/teams` | GET | Global spend breakdown by team |
| `/global/activity` | GET | Global proxy activity |
| `/spend/logs` | GET | Recent spend log entries |
| `/spend/tags` | GET | Spend breakdown by custom tags |
| `/team/list` | GET | List all teams with budgets |
| `/team/info` | GET | Detailed team info |
| `/model/info` | GET | Detailed model info with pricing |
| `/v1/models` | GET | Accessible model list |
| `/login` | POST | UI username/password auth (JWT) |

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Compile TypeScript (one-time)
npm run compile

# Watch mode (auto-recompile on changes)
npm run watch

# Lint
npm run lint

# Build VSIX package (requires Node 20+)
npx @vscode/vsce package

# Install the VSIX locally
code --install-extension corellm-0.8.9.vsix
```

Press `F5` in VS Code to launch an Extension Development Host window.

### Architecture

```
src/
├── extension.ts          # Main entry: activate/deactivate, status bar, commands
├── tutorial.ts           # Tutorial & changelog HTML builders
├── types.ts              # TypeScript interfaces
├── config.ts             # VS Code settings reader
├── client.ts             # HTTP client with caching + auth
├── helpers.ts            # Shared utilities (HTML, escaping, formatting)
├── secrets.ts            # OS keychain credential storage
└── panels/
    ├── unifiedDashboard.ts   # Unified overview dashboard
    ├── healthDashboard.ts    # Key health dashboard
    ├── providerSpend.ts      # Provider spend tracker
    └── userManager.ts        # User management panel
```

- **Zero runtime dependencies** — uses VS Code's built-in `fetch` API
- **No bundler** — plain `tsc` compilation (`src/` → `out/`)
- **Inline HTML** — all webview panels use template literals, no external CSS/JS
- **Config-driven** — all user behavior controlled via `package.json` contributions

---

## ❓ FAQ

**Q: Why do some panels show "permission denied"?**
A: Admin-only endpoints (global spend, provider budgets, team list) require an admin key. Use **CoreLLM: Set Admin Key (Secure)** to configure your proxy master key.

**Q: Can I use this without an admin key?**
A: Yes! Basic features (balance, spend logs, budget overview) work with a regular API key. Only admin features need the admin key.

**Q: Where are my credentials stored?**
A: In your operating system's keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) via VS Code's `SecretStorage` API. They are NOT stored in `settings.json`.

**Q: Does it work with a remote LiteLLM proxy?**
A: Yes — set `corellm.endpoint` to your proxy URL (e.g., `https://litellm.yourcompany.com`).

**Q: How do I turn off auto-refresh?**
A: Set `corellm.refreshInterval` to `0` in Settings, or run **CoreLLM: Disable Auto-Refresh**.

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the [repository](https://github.com/core-innovation/litellm-balance-checker)
2. Create a feature branch
3. Make your changes (see `.github/copilot-instructions.md` for conventions)
4. Submit a pull request

Please follow the coding conventions in [copilot-instructions.md](.github/copilot-instructions.md).

---

## 📄 License

MIT © 2025-2026 Core Innovation. See [LICENSE](LICENSE) for details.
