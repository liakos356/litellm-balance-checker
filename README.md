# LiteLLM Balance Checker

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
- **Budget Overview panel** (`Ctrl+Shift+B`) — full dashboard with:
  - Daily spend bar chart
  - Provider budget bars
  - Model usage donut chart
  - Recent spend logs table
- **Spend Logs panel** — browse latest 50 spend entries
- **Key List panel** — all keys with spend/budget bars

---

## 📦 Installation

### Via VSIX

```bash
# Download from GitHub Releases or build locally, then:
code --install-extension litellm-balance-checker-0.1.0.vsix
```

Or in VS Code: `Extensions` → `...` → `Install from VSIX...`

### From source

```bash
git clone https://github.com/liakos356/litellm-balance-checker.git
cd litellm-balance-checker
npm install
npm run compile
npx @vscode/vsce package
code --install-extension litellm-balance-checker-0.1.0.vsix
```

Press `F5` in VS Code for an Extension Development Host window.

---

## ⚙️ Settings

Open VS Code settings (`Cmd+,`) and search for `litellm-balance-checker`.

### Option A: Direct API key

```json
"litellm-balance-checker.apiKey": "sk-your-key-here"
```

### Option B: Username / Password (auto-login)

```json
"litellm-balance-checker.username": "you@company.com",
"litellm-balance-checker.password": "your-password"
```

Logs in via `POST /login`, extracts the embedded `sk-...` key from the JWT session.

### Option C: Separate admin key

```json
"litellm-balance-checker.apiKey": "sk-your-llm-key",
"litellm-balance-checker.adminKey": "sk-proxy-master-key"
```

### All settings

| Setting | Default | Description |
|---------|---------|-------------|
| `apiKey` | `""` | LiteLLM API key (fallback auth) |
| `adminKey` | `""` | Proxy admin key for management API calls |
| `username` | `""` | UI username — logs in and extracts session key |
| `password` | `""` | UI password |
| `endpoint` | `http://core.llm` | LiteLLM proxy base URL |
| `refreshInterval` | `60` | Polling interval in seconds (min 5, 0 = off) |
| `showKeyAlias` | `true` | Show key alias next to the balance |
| `showSpendLogs` | `false` | Append recent spend total to status bar |
| `budgetWarningThreshold` | `20` | Warning color when remaining budget % is below this |
| `keyToQuery` | `""` | Query a specific key (uses auth settings for credentials) |

---

## 🚀 Commands

| Command | Description |
|---------|-------------|
| `LiteLLM: Refresh Balance` | Manually refresh the status bar |
| `LiteLLM: Show Budget Overview` | Open full dashboard with charts |
| `LiteLLM: Show Spend Logs` | Open paginated spend logs panel |
| `LiteLLM: List All Keys` | List all keys with spend & budget |
| `LiteLLM: Toggle Auto-Refresh` | Enable/disable polling |
| `LiteLLM: Open Settings` | Jump to extension settings |

---

## 🔌 API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /login` | Login with username/password (auth method B) |
| `GET /key/info` | Key spend, budget, metadata |
| `GET /key/list` | All keys with spend/budget |
| `GET /provider/budgets` | Per-provider spend & budget limits |
| `GET /global/spend/report` | Daily spend by team |
| `GET /spend/logs` | Recent spend log entries |
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
