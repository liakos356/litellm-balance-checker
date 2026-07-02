# LiteLLM Balance Checker

A VS Code extension that displays your LiteLLM API key balance and usage in the status bar.

![Screenshot](https://img.shields.io/badge/status-active-green)

## Features

- ✅ **Real-time balance** in the VS Code status bar — shows remaining budget or total spend
- ✅ **Auto-refresh** — configurable interval (default: 60s)
- ✅ **Key info tooltip** — hover to see spend, max budget, usage %, user ID, team, models
- ✅ **Budget warnings** — color changes when remaining budget drops below threshold
- ✅ **Multiple keys** — query a specific key's info while authenticating with admin key
- ✅ **Commands** — refresh manually, toggle auto-refresh, open settings

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `litellm-balance-checker.apiKey` | `""` | Your LiteLLM API key |
| `litellm-balance-checker.adminKey` | `""` | Admin/proxy master key (if different from apiKey) |
| `litellm-balance-checker.endpoint` | `http://core.llm` | LiteLLM proxy URL |
| `litellm-balance-checker.refreshInterval` | `60` | Auto-refresh interval in seconds (≥5) |
| `litellm-balance-checker.showKeyAlias` | `true` | Show key alias next to balance |
| `litellm-balance-checker.showSpendLogs` | `false` | Append recent spend to status bar |
| `litellm-balance-checker.budgetWarningThreshold` | `20` | Warning when remaining budget % falls below this |
| `litellm-balance-checker.keyToQuery` | `""` | Query a specific key (uses apiKey/adminKey for auth) |

## API Endpoints Used

- `GET /key/info` — Fetch key balance, spend, and budget info
- `GET /spend/logs` (optional) — Fetch recent spend logs

## Development

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch a new Extension Development Host window.

## Packaging

```bash
vsce package
```

This produces a `.vsix` file that can be shared or installed manually.
