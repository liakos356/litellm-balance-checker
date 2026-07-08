import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { materialIcon } from './helpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Tutorial / Getting Started Panel HTML ───────────────────────────────────

const CURRENT_VERSION = '0.8.10';

export function buildTutorialHtml(activeTheme?: string): string {
  const theme = activeTheme || 'vscode';
  const themeOverride = buildThemeOverrides(theme);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  ${COMMON_CSS}
  ${themeOverride}
</style>
</head>
<body>

<!-- ─── Header ─────────────────────────────────────────────────────────── -->
<div class="hero">
  <div class="hero-icon">${materialIcon("dashboard", 48)}</div>
  <h1>CoreLLM <span class="version-badge">v${CURRENT_VERSION}</span></h1>
  <p class="hero-subtitle">Monitor your LiteLLM API key balances, budgets, and usage — right from the VS Code status bar.</p>
  <div class="hero-actions">
    <button class="toolbar-btn" onclick="openSettings()">${materialIcon("build", 16)} Open Settings</button>
    <button class="toolbar-btn" onclick="openBudget()">${materialIcon("dashboard", 16)} Budget Overview</button>
    <button class="toolbar-btn" id="themeBtn">${materialIcon("palette", 16)} Toggle Theme</button>
  </div>
</div>

<!-- ─── Table of Contents ──────────────────────────────────────────────── -->
<div class="card toc-card">
  <h3>${materialIcon("preview", 18)} Quick Navigation</h3>
  <div class="toc-grid">
    <a href="#quickstart" class="toc-item">${materialIcon("info", 16)} Quick Start</a>
    <a href="#auth" class="toc-item">${materialIcon("key", 16)} Authentication</a>
    <a href="#statusbar" class="toc-item">${materialIcon("dashboard", 16)} Status Bar</a>
    <a href="#commands" class="toc-item">${materialIcon("preview", 16)} Commands</a>
    <a href="#panels" class="toc-item">${materialIcon("preview", 16)} Panels</a>
    <a href="#settings" class="toc-item">${materialIcon("build", 16)} Settings</a>
    <a href="#tips" class="toc-item">${materialIcon("info", 16)} Tips &amp; Best Practices</a>
    <a href="#faq" class="toc-item">${materialIcon("info", 16)} FAQ</a>
  </div>
</div>

<!-- ─── Quick Start ────────────────────────────────────────────────────── -->
<div class="card" id="quickstart">
  <h3>${materialIcon("info", 18)} Quick Start</h3>
  <div class="step-list">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <strong>Install the extension</strong> from the VS Code Marketplace or via VSIX.
        <div class="code-block">code --install-extension corellm-*.vsix</div>
      </div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <strong>Configure your LiteLLM endpoint</strong> and authentication.
        Open settings (<kbd>Cmd+,</kbd>) and search for <code>corellm</code>.
        <div class="code-block">"corellm.endpoint": "http://localhost:4000"<br>"corellm.apiKey": "sk-your-key-here"</div>
      </div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-body">
        <strong>Check the status bar</strong> \u2014 your balance appears instantly.
        Hover for a rich tooltip with spend, budget, user, and model info.
      </div>
    </div>
    <div class="step">
      <div class="step-num">4</div>
      <div class="step-body">
        <strong>Explore the panels</strong> via the Command Palette (<kbd>Cmd+Shift+P</kbd>):
        <ul>
          <li><code>CoreLLM: Show Budget Overview</code> \u2014 full dashboard with charts</li>
          <li><code>CoreLLM: Show Spend Logs</code> \u2014 browse recent spend entries</li>
          <li><code>CoreLLM: List All Keys</code> \u2014 overview of all API keys</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<!-- ─── Authentication ─────────────────────────────────────────────────── -->
<div class="card" id="auth">
  <h3>${materialIcon("key", 18)} Authentication Methods</h3>
  <p>CoreLLM supports three ways to authenticate with your LiteLLM proxy. Choose the one that fits your setup.</p>

  <div class="auth-methods">
    <div class="auth-card">
      <div class="auth-icon">${materialIcon("key", 28)}</div>
      <h4>Direct API Key</h4>
      <p>Simplest method for personal use with a single API key.</p>
      <div class="code-block">"corellm.apiKey": "sk-your-key-here"<br>"corellm.endpoint": "http://localhost:4000"</div>
      <div class="check-item">${materialIcon("check_circle", 14)} Best for: Single key, personal usage</div>
      <div class="check-item">${materialIcon("check_circle", 14)} Shows spend, budget, and models</div>
      <div class="cross-item">${materialIcon("cancel", 14)} Limited: standard LLM keys may not access <code>/spend/logs</code> or <code>/key/list</code></div>
    </div>
    <div class="auth-card">
      <div class="auth-icon">${materialIcon("build", 28)}</div>
      <h4>Admin / Proxy Master Key</h4>
      <p>Full access to all management endpoints. Recommended for admins.</p>
      <div class="code-block">"corellm.apiKey": "sk-your-llm-key"<br>"corellm.adminKey": "sk-proxy-master-key"</div>
      <div class="check-item">${materialIcon("check_circle", 14)} Full access to all API endpoints</div>
      <div class="check-item">${materialIcon("check_circle", 14)} Can query specific keys via <code>keyToQuery</code></div>
      <div class="check-item">${materialIcon("check_circle", 14)} Access to provider budgets &amp; global reports</div>
    </div>
    <div class="auth-card">
      <div class="auth-icon">${materialIcon("person", 28)}</div>
      <h4>Username / Password Login</h4>
      <p>Automatically logs into the LiteLLM UI and extracts the embedded session key.</p>
      <div class="code-block">"corellm.username": "you@company.com"<br>"corellm.password": "your-password"<br>"corellm.endpoint": "http://localhost:4000"</div>
      <div class="check-item">${materialIcon("check_circle", 14)} No need to manage raw API keys</div>
      <div class="check-item">${materialIcon("check_circle", 14)} Key is extracted from JWT session cookie</div>
      <div class="cross-item">${materialIcon("cancel", 14)} Requires <code>POST /login</code> to be enabled on your proxy</div>
    </div>
  </div>

  <div class="tip-box">
    <strong>${materialIcon("info", 14)} Pro tip:</strong> If your standard LLM key shows <span class="err">"not allowed to call this route"</span>,
    configure an <code>adminKey</code> (proxy master key) for management endpoints
    while keeping your LLM key in <code>apiKey</code> for usage tracking.
  </div>
</div>

<!-- ─── Status Bar ─────────────────────────────────────────────────────── -->
<div class="card" id="statusbar">
  <h3>${materialIcon("dashboard", 18)} Status Bar Display</h3>
  <p>The status bar shows your LiteLLM balance at a glance. Click it to cycle through display modes.</p>

  <div class="display-modes">
    <div class="mode-card">
      <div class="mode-icon">${materialIcon("storage", 22)}</div>
      <div class="mode-label">Remaining Budget</div>
      <div class="mode-desc">Shows how much budget is left. Color shifts to warning when below threshold.</div>
    </div>
    <div class="mode-card">
      <div class="mode-icon">${materialIcon("bar_chart", 22)}</div>
      <div class="mode-label">Usage Bar</div>
      <div class="mode-desc">ASCII bar chart + percentage used: <code>[██████░░░░] 60.5%</code></div>
    </div>
    <div class="mode-card">
      <div class="mode-icon">${materialIcon("payments", 22)}</div>
      <div class="mode-label">Total Spend</div>
      <div class="mode-desc">Displays the total amount spent so far.</div>
    </div>
    <div class="mode-card">
      <div class="mode-icon">${materialIcon("build", 22)}</div>
      <div class="mode-label">Budget Total</div>
      <div class="mode-desc">Shows the configured max budget amount.</div>
    </div>
  </div>

  <div class="tooltip-preview">
    <h4>${materialIcon("preview", 16)} Tooltip Preview</h4>
    <p>Hover over the status bar to see a detailed tooltip with:</p>
    <div class="preview-grid">
      <div class="preview-item">${materialIcon("key", 14)} Key alias / name</div>
      <div class="preview-item">${materialIcon("payments", 14)} Spend &amp; remaining budget</div>
      <div class="preview-item">${materialIcon("dashboard", 14)} Usage percentage + bar</div>
      <div class="preview-item">${materialIcon("person", 14)} User ID &amp; Team ID</div>
      <div class="preview-item">${materialIcon("preview", 14)} Accessible models</div>
      <div class="preview-item">${materialIcon("schedule", 14)} Budget duration &amp; reset</div>
    </div>
  </div>
</div>

<!-- ─── Commands ───────────────────────────────────────────────────────── -->
<div class="card" id="commands">
  <h3>${materialIcon("preview", 18)} All Commands</h3>
  <p>Access any command via the Command Palette (<kbd>Cmd+Shift+P</kbd>) and type <code>CoreLLM</code>.</p>
  <div class="table-wrap"><table class="cmd-table">
    <thead><tr><th style="width:200px">Command</th><th>Description</th><th style="width:100px">Shortcut</th></tr></thead>
    <tbody>
      <tr><td><code>CoreLLM: Refresh Balance</code></td><td>Manually refresh the status bar balance</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: Show Budget Overview</code></td><td>Open full dashboard with daily spend charts, provider budgets, model breakdown</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: Show Spend Logs</code></td><td>Open paginated spend logs with search &amp; filter</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: List All Keys</code></td><td>List all API keys with spend, budgets, and usage bars</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: Toggle Auto-Refresh</code></td><td>Enable or disable automatic polling</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: Enable Auto-Refresh</code></td><td>Start auto-refresh (configured interval)</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: Disable Auto-Refresh</code></td><td>Stop auto-refresh polling</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: Set Report Duration</code></td><td>Choose time range for budget charts (1h/24h/7d/30d/custom)</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: Open Settings</code></td><td>Jump directly to CoreLLM extension settings</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: Check for Updates</code></td><td>Check GitHub for newer versions</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: About</code></td><td>Show version info</td><td>\u2014</td></tr>
      <tr class="cmd-highlight"><td><code>CoreLLM: Show Tutorial</code></td><td>Open this getting started guide</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: Show Global Spend</code></td><td>Global spend breakdown by key, model, and team</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: Show Teams</code></td><td>Team budgets, spend, members, and models</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: Show Activity</code></td><td>Proxy activity timeline with spend trend chart</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: Show Model Info</code></td><td>Model catalog with pricing, capabilities, and providers</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: Show Spend by Tags</code></td><td>Cost tracking broken down by custom spend tags</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: Show Key Health</code></td><td>Key health status, last access, and models</td><td>\u2014</td></tr>
      <tr><td><code>CoreLLM: Cycle Status Bar Display</code></td><td>Cycle through remaining, usage bar, spend, and budget modes</td><td>\u2014</td></tr>
    </tbody>
  </table></div>
</div>

<!-- ─── Panels ─────────────────────────────────────────────────────────── -->
<div class="card" id="panels">
  <h3>${materialIcon("preview", 18)} Panels Deep Dive</h3>

  <h4>${materialIcon("dashboard", 16)} Budget Overview</h4>
  <p>The main dashboard. Shows a summary bar with total spend, usage %, remaining budget, request count, provider count, and cost efficiency metrics. Includes:</p>
  <ul>
    <li><strong>Date range selector</strong> \u2014 switch between 1h, 24h, 7d, 30d, or custom dates</li>
    <li><strong>Key info card</strong> \u2014 spend, budget, remaining, usage bar, copy key button</li>
    <li><strong>Provider budgets</strong> \u2014 per-provider spend &amp; limits with progress bars</li>
    <li><strong>Daily spend chart</strong> \u2014 SVG bar chart and line chart of spend over time</li>
    <li><strong>Model spend breakdown</strong> \u2014 donut chart showing spend by model</li>
    <li><strong>Cost efficiency</strong> \u2014 avg cost per request, per token, tokens per request</li>
    <li><strong>Recent spend logs</strong> \u2014 latest entries with cost/token</li>
    <li><strong>Export</strong> \u2014 download data as CSV</li>
    <li><strong>Theme toggle</strong> \u2014 switch between VS Code, light, dark, and high-contrast</li>
  </ul>

  <h4>${materialIcon("preview", 16)} Spend Logs</h4>
  <p>Browse the latest 50 spend entries with search filtering. Each row shows timestamp, model, call type, spend amount, tokens used, and cost per token. Summary bar shows totals and averages.</p>

  <h4>${materialIcon("key", 16)} Key List</h4>
  <p>View all API keys with their spend, max budget, usage percentage (with bar), user ID, and team ID. Keys over budget are highlighted with a red border. Search by alias, user, or team.</p>

  <h4>${materialIcon("cloud", 16)} Global Spend</h4>
  <p>Proxy-wide spend analytics broken down by three dimensions:</p>
  <ul>
    <li><strong>By Key</strong> \u2014 spend, tokens, and requests per API key</li>
    <li><strong>By Model</strong> \u2014 spend, input/output tokens, and requests per model</li>
    <li><strong>By Team</strong> \u2014 spend, tokens, and requests per team</li>
  </ul>
  <p>All views include SVG bar charts and sortable tables. Export to CSV.</p>

  <h4>${materialIcon("person", 16)} Teams</h4>
  <p>Team budget management dashboard. Each team card shows spend, max budget, remaining budget, usage percentage with progress bar, models, and members. Blocked teams are highlighted. Optionally filter by team via the <code>teamFilter</code> setting.</p>

  <h4>${materialIcon("schedule", 16)} Activity</h4>
  <p>Proxy activity timeline showing daily spend, tokens, and requests. Includes an SVG line chart for spend trends over the selected date range. Enable automatic updates via the <code>enableActivityMonitoring</code> setting.</p>

  <h4>${materialIcon("dashboard", 16)} Model Info</h4>
  <p>Model catalog with pricing details: input/output cost per token, max tokens, provider, mode (chat/completion/embedding), and capability flags (function calling, vision). Searchable table with sortable columns. Export to CSV.</p>

  <h4>${materialIcon("info", 16)} Spend by Tags</h4>
  <p>Cost tracking broken down by custom spend tags. Shows tag name, spend, tokens, and requests with an SVG bar chart. Useful for cost allocation and chargebacks.</p>

  <h4>${materialIcon("build", 16)} Key Health</h4>
  <p>Key health monitoring showing status (healthy/unhealthy), spend, budget, last access time, and associated models.</p>
</div>

<!-- ─── Settings Reference ─────────────────────────────────────────────── -->
<div class="card" id="settings">
  <h3>${materialIcon("build", 18)} Settings Reference</h3>
  <p>Open VS Code settings (<kbd>Cmd+,</kbd>) and search for <code>corellm</code> to configure.</p>
  <div class="table-wrap"><table class="settings-table">
    <thead><tr><th>Setting</th><th>Default</th><th>Description</th></tr></thead>
    <tbody>
      <tr><td><code>apiKey</code></td><td><code>""</code></td><td>Your LiteLLM API key (fallback auth)</td></tr>
      <tr><td><code>adminKey</code></td><td><code>""</code></td><td>Proxy admin key for management endpoints</td></tr>
      <tr><td><code>username</code></td><td><code>""</code></td><td>UI username (login-based auth)</td></tr>
      <tr><td><code>password</code></td><td><code>""</code></td><td>UI password (stored securely)</td></tr>
      <tr><td><code>endpoint</code></td><td><code>http://localhost:4000</code></td><td>LiteLLM proxy base URL</td></tr>
      <tr><td><code>refreshInterval</code></td><td><code>60</code></td><td>Polling interval in seconds (min 5, 0 = off)</td></tr>
      <tr><td><code>showKeyAlias</code></td><td><code>true</code></td><td>Show key alias next to balance in status bar</td></tr>
      <tr><td><code>showSpendLogs</code></td><td><code>false</code></td><td>Append recent spend total to status bar</td></tr>
      <tr><td><code>budgetWarningThreshold</code></td><td><code>20</code></td><td>Warning color when remaining budget % is below this</td></tr>
      <tr><td><code>keyToQuery</code></td><td><code>""</code></td><td>Query a specific key (different from auth key)</td></tr>
      <tr><td><code>reportDuration</code></td><td><code>"7d"</code></td><td>Time range for budget spend charts</td></tr>
      <tr><td><code>reportCustomStart</code></td><td><code>""</code></td><td>Custom start date (YYYY-MM-DD)</td></tr>
      <tr><td><code>reportCustomEnd</code></td><td><code>""</code></td><td>Custom end date (YYYY-MM-DD)</td></tr>
      <tr><td><code>updateCheckInterval</code></td><td><code>24</code></td><td>Hours between GitHub update checks</td></tr>
      <tr><td><code>webviewTheme</code></td><td><code>"vscode"</code></td><td>Theme override for panels (vscode/light/dark/hc)</td></tr>
      <tr><td><code>showTeamSpend</code></td><td><code>false</code></td><td>Show team-level spend in the status bar</td></tr>
      <tr><td><code>showGlobalSpend</code></td><td><code>false</code></td><td>Show global spend totals in the status bar</td></tr>
      <tr><td><code>showModelSpend</code></td><td><code>false</code></td><td>Show per-model spend breakdown in panels</td></tr>
      <tr><td><code>cacheResults</code></td><td><code>true</code></td><td>Cache API results to reduce network requests</td></tr>
      <tr><td><code>spendAlertThreshold</code></td><td><code>0</code></td><td>Alert threshold in USD (0 = disabled)</td></tr>
      <tr><td><code>enableActivityMonitoring</code></td><td><code>false</code></td><td>Auto-refresh activity monitoring panels</td></tr>
      <tr><td><code>teamFilter</code></td><td><code>""</code></td><td>Filter data by specific team ID</td></tr>
      <tr><td><code>defaultPanelTab</code></td><td><code>"overview"</code></td><td>Default panel tab (overview/global/teams/activity)</td></tr>
      <tr><td><code>statusBarDisplayMode</code></td><td><code>"cycle"</code></td><td>Default display mode (cycle/remaining/spend/usage-bar/budget)</td></tr>
    </tbody>
  </table></div>
</div>

<!-- ─── Tips ───────────────────────────────────────────────────────────── -->
<div class="card" id="tips">
  <h3>${materialIcon("info", 18)} Tips &amp; Best Practices</h3>
  <div class="tip-grid">
    <div class="tip-item">
      <div class="tip-icon">${materialIcon("refresh", 18)}</div>
      <div class="tip-body">
        <strong>Auto-Refresh</strong><br>
        Set <code>refreshInterval</code> to your preferred polling rate (minimum 5s).
        It\u2019s off by default until you enable it via the toggle command.
      </div>
    </div>
    <div class="tip-item">
      <div class="tip-icon">${materialIcon("preview", 18)}</div>
      <div class="tip-body">
        <strong>Search Spend Logs</strong><br>
        The Spend Logs panel has a live search bar. Filter by model name, call type, or
        any text in the log entry.
      </div>
    </div>
    <div class="tip-item">
      <div class="tip-icon">${materialIcon("key", 18)}</div>
      <div class="tip-body">
        <strong>Query a Specific Key</strong><br>
        Use <code>keyToQuery</code> to monitor a key different from your auth key.
        Keep your admin key in <code>adminKey</code> for management access.
      </div>
    </div>
    <div class="tip-item">
      <div class="tip-icon">${materialIcon("download", 18)}</div>
      <div class="tip-body">
        <strong>Export Data</strong><br>
        Every panel has an Export CSV button. Use it to download data for
        external analysis or reporting.
      </div>
    </div>
    <div class="tip-item">
      <div class="tip-icon">${materialIcon("palette", 18)}</div>
      <div class="tip-body">
        <strong>Panel Themes</strong><br>
        Each panel has a theme toggle button. You can cycle through VS Code,
        Light, Dark, and High-Contrast themes independent of your editor theme.
      </div>
    </div>
    <div class="tip-item">
      <div class="tip-icon">${materialIcon("warning", 18)}</div>
      <div class="tip-body">
        <strong>Budget Warnings</strong><br>
        Set <code>budgetWarningThreshold</code> (default 20%) to get a visual
        warning in the status bar when remaining budget gets low.
      </div>
    </div>
    <div class="tip-item">
      <div class="tip-icon">${materialIcon("schedule", 18)}</div>
      <div class="tip-body">
        <strong>Custom Date Ranges</strong><br>
        In Budget Overview, set <code>reportDuration</code> to <code>"custom"</code>
        and fill in <code>reportCustomStart</code> / <code>reportCustomEnd</code>
        for arbitrary date ranges. Or use the date picker directly in the panel.
      </div>
    </div>
    <div class="tip-item">
      <div class="tip-icon">${materialIcon("cloud", 18)}</div>
      <div class="tip-body">
        <strong>Offline / Proxy Setup</strong><br>
        The extension works with any LiteLLM proxy. If you use a custom domain,
        just update <code>endpoint</code> to your proxy URL (e.g. <code>https://llm-proxy.mycompany.com</code>).
      </div>
    </div>    <div class="tip-item">
      <div class="tip-icon">${materialIcon("cloud", 18)}</div>
      <div class="tip-body">
        <strong>Global Spend Analytics</strong><br>
        Use <code>CoreLLM: Show Global Spend</code> to see spend broken down
        by key, model, and team across the entire proxy.
      </div>
    </div>
    <div class="tip-item">
      <div class="tip-icon">${materialIcon("person", 18)}</div>
      <div class="tip-body">
        <strong>Team Budget Tracking</strong><br>
        Open <code>CoreLLM: Show Teams</code> to monitor budgets per team.
        Set <code>teamFilter</code> to focus on a specific team.
      </div>
    </div>
    <div class="tip-item">
      <div class="tip-icon">${materialIcon("info", 18)}</div>
      <div class="tip-body">
        <strong>Tag-Based Cost Tracking</strong><br>
        Use <code>CoreLLM: Show Spend by Tags</code> to allocate costs by
        custom spend tags. Great for chargebacks and project tracking.
      </div>
    </div>
    <div class="tip-item">
      <div class="tip-icon">${materialIcon("dashboard", 18)}</div>
      <div class="tip-body">
        <strong>Model Pricing Reference</strong><br>
        <code>CoreLLM: Show Model Info</code> shows pricing per token,
        max tokens, and capability flags for all models on your proxy.
      </div>
    </div>
    <div class="tip-item">
      <div class="tip-icon">${materialIcon("warning", 18)}</div>
      <div class="tip-body">
        <strong>Spend Alerts</strong><br>
        Set <code>spendAlertThreshold</code> to get notifications when a
        single spend entry exceeds the specified amount.
      </div>
    </div>
    <div class="tip-item">
      <div class="tip-icon">${materialIcon("refresh", 18)}</div>
      <div class="tip-body">
        <strong>Status Bar Display Modes</strong><br>
        Click the CoreLLM status bar item to cycle through display modes:
        remaining budget, usage bar, total spend, and budget total.
      </div>
    </div>  </div>
</div>

<!-- ─── FAQ ────────────────────────────────────────────────────────────── -->
<div class="card" id="faq">
  <h3>${materialIcon("info", 18)} Frequently Asked Questions</h3>

  <div class="faq-item">
    <div class="faq-q" onclick="toggleFaq(this)">\u25B6 Why does my status bar show "LLM key (limited)"?</div>
    <div class="faq-a">Your API key is a standard LLM key that cannot access management endpoints
    like <code>/key/info</code> or <code>/spend/logs</code>. Set an <code>adminKey</code> (proxy master key)
    in the settings to unlock full functionality. The extension will still work \u2014 it just won\u2019t show
    balance or budget data.</div>
  </div>

  <div class="faq-item">
    <div class="faq-q" onclick="toggleFaq(this)">\u25B6 How do I monitor a different key than my auth key?</div>
    <div class="faq-a">Use the <code>keyToQuery</code> setting. Set it to the key you want to monitor,
    and keep your admin/proxy key in <code>adminKey</code> for authentication to management endpoints.</div>
  </div>

  <div class="faq-item">
    <div class="faq-q" onclick="toggleFaq(this)">\u25B6 Can I use this with a remote LiteLLM proxy?</div>
    <div class="faq-a">Yes. Set the <code>endpoint</code> setting to your proxy\u2019s full URL.
    The extension works with any reachable LiteLLM proxy, whether local, on a network, or on the internet.</div>
  </div>

  <div class="faq-item">
    <div class="faq-q" onclick="toggleFaq(this)">\u25B6 Why don\u2019t I see any spend data?</div>
    <div class="faq-a">This can happen if your API key doesn\u2019t have access to <code>/global/spend/report</code>
    or if there\u2019s no usage yet. Try using an admin key, or check the Command Palette for
    <code>CoreLLM: Refresh Balance</code>. If using a key with <code>keyToQuery</code>,
    make sure the auth key has admin privileges.</div>
  </div>

  <div class="faq-item">
    <div class="faq-q" onclick="toggleFaq(this)">\u25B6 How do I update the extension?</div>
    <div class="faq-a">Run <code>CoreLLM: Check for Updates</code> from the Command Palette.
    If a new version is available, you can download it directly or install it with one click.
    You can also check the <a href="https://github.com/core-innovation/litellm-balance-checker/releases" target="_blank">GitHub Releases</a> page.</div>
  </div>

  <div class="faq-item">
    <div class="faq-q" onclick="toggleFaq(this)">\u25B6 My settings aren\u2019t taking effect. What\u2019s wrong?</div>
    <div class="faq-a">Settings take effect immediately when changed. If something seems off,
    try running <code>CoreLLM: Refresh Balance</code> manually. If the issue persists,
    check that your <code>endpoint</code> URL is correct and reachable from your network.</div>
  </div>

  <div class="faq-item">
    <div class="faq-q" onclick="toggleFaq(this)">\u25B6 Is my API key secure?</div>
    <div class="faq-a">Your keys are stored in VS Code\u2019s secure settings storage (GlobalState),
    the same way VS Code stores all extension settings. The <code>password</code> field is
    marked with <code>editPresentation: "password"</code> so it\u2019s masked in the UI.
    Keys are only sent to the LiteLLM proxy endpoint you configure.</div>
  </div>

  <div class="faq-item">
    <div class="faq-q" onclick="toggleFaq(this)">\u25B6 What\u2019s the difference between Budget Overview and Global Spend?</div>
    <div class="faq-a"><strong>Budget Overview</strong> focuses on a single key\u2019s spend, budget, and usage with provider budgets and model breakdowns. <strong>Global Spend</strong> shows proxy-wide analytics across all keys, models, and teams \u2014 great for admins managing the entire proxy.</div>
  </div>

  <div class="faq-item">
    <div class="faq-q" onclick="toggleFaq(this)">\u25B6 How do I track costs by team?</div>
    <div class="faq-a">Open <code>CoreLLM: Show Teams</code> from the Command Palette to see all teams, their budgets, and spend. You can also set <code>teamFilter</code> in settings to focus on a single team. Team costs are also visible in the Global Spend panel.</div>
  </div>

  <div class="faq-item">
    <div class="faq-q" onclick="toggleFaq(this)">\u25B6 Can I get notified of high spend?</div>
    <div class="faq-a">Yes. Set <code>spendAlertThreshold</code> to a USD value (e.g., <code>0.50</code>). You\u2019ll get a notification whenever a single spend entry exceeds that amount, with a link to view the full spend logs.</div>
  </div>

  <div class="faq-item">
    <div class="faq-q" onclick="toggleFaq(this)">\u25B6 How do I see model pricing and capabilities?</div>
    <div class="faq-a">Run <code>CoreLLM: Show Model Info</code> from the Command Palette. This shows a searchable table with input/output cost per token, max tokens, provider, mode, and capability flags (function calling, vision) for all models on your proxy.</div>
  </div>

  <div class="faq-item">
    <div class="faq-q" onclick="toggleFaq(this)">\u25B6 What are spend tags and how do I use them?</div>
    <div class="faq-a">Spend tags are custom labels you can attach to API requests in LiteLLM for cost allocation. Run <code>CoreLLM: Show Spend by Tags</code> to see spend broken down by tag. This is useful for chargebacks, project tracking, or departmental budgets.</div>
  </div>
</div>

<!-- ─── Footer ─────────────────────────────────────────────────────────── -->
<div class="footer">
  <span>CoreLLM v${CURRENT_VERSION}</span>
  <span>\u00B7</span>
  <span><a href="https://github.com/core-innovation/litellm-balance-checker" target="_blank">GitHub</a></span>
  <span>\u00B7</span>
  <span><a href="https://github.com/core-innovation/litellm-balance-checker/issues" target="_blank">Report Issue</a></span>
  <span>\u00B7</span>
  <span>MIT License</span>
</div>

<script>
(function() {
  const vscode = acquireVsCodeApi();
  const themes = ['vscode', 'light', 'dark', 'hc'];
  let currentThemeIdx = themes.indexOf('${theme}');
  if (currentThemeIdx < 0) currentThemeIdx = 0;

  document.getElementById('themeBtn').addEventListener('click', function() {
    currentThemeIdx = (currentThemeIdx + 1) % themes.length;
    vscode.postMessage({ type: 'setTheme', theme: themes[currentThemeIdx] });
  });

  window.openSettings = function() {
    vscode.postMessage({ type: 'openSettings' });
  };
  window.openBudget = function() {
    vscode.postMessage({ type: 'openBudgetOverview' });
  };

  // FAQ toggle
  window.toggleFaq = function(el) {
    const answer = el.nextElementSibling;
    const isOpen = answer.classList.contains('faq-open');
    // Close all
    document.querySelectorAll('.faq-a').forEach(a => {
      a.classList.remove('faq-open');
      a.style.maxHeight = '0';
    });
    document.querySelectorAll('.faq-q').forEach(q => {
      q.innerHTML = q.innerHTML.replace('\u25BC', '\u25B6');
    });
    if (!isOpen) {
      answer.classList.add('faq-open');
      answer.style.maxHeight = answer.scrollHeight + 'px';
      el.innerHTML = el.innerHTML.replace('\u25B6', '\u25BC');
    }
  };

  // Smooth scroll for TOC links
  document.querySelectorAll('.toc-item').forEach(a => {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Keyboard: Escape closes
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') vscode.postMessage({ type: 'close' });
  });
})();
</script>
</body>
</html>`;
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

const COMMON_CSS = `
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px 24px 40px;color:var(--vscode-foreground);background:var(--vscode-editor-background);margin:0;max-width:900px;margin:0 auto;font-size:14px;line-height:1.6}
  h1{font-size:2em;font-weight:700;margin:0 0 4px;display:flex;align-items:center;gap:12px}
  h2{margin-top:0;font-weight:600}
  h3{margin:24px 0 12px;font-weight:600;font-size:1.15em;border-bottom:1px solid var(--vscode-panel-border);padding-bottom:6px}
  h4{margin:16px 0 8px;font-weight:500;font-size:1em}
  p{margin:0 0 10px;opacity:.88}
  a{color:var(--vscode-textLink-foreground,#3794ff);text-decoration:none}
  a:hover{text-decoration:underline}
  kbd{display:inline-block;padding:2px 6px;font-size:.82em;font-family:inherit;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-panel-border);border-radius:4px;box-shadow:0 1px 0 var(--vscode-panel-border)}
  code{font-family:SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;font-size:.88em;background:var(--vscode-editorWidget-background);padding:1px 5px;border-radius:3px}
  .code-block{background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-panel-border);border-radius:6px;padding:10px 14px;font-family:SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;font-size:.82em;line-height:1.5;margin:8px 0;overflow-x:auto;white-space:pre}
  .card{background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);border-radius:10px;padding:16px 20px;margin-bottom:16px}
  .footer{margin-top:28px;padding:14px;text-align:center;font-size:.78em;opacity:.55;border-top:1px solid var(--vscode-panel-border);display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
  .version-badge{font-size:.5em;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);padding:3px 10px;border-radius:20px;font-weight:500;vertical-align:middle}
  .err{color:var(--vscode-errorForeground,#f14c4c)}
  .toolbar-btn{padding:5px 14px;border:1px solid var(--vscode-panel-border);border-radius:5px;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:.82em;font-family:inherit;transition:all .15s ease;white-space:nowrap}
  .toolbar-btn:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder)}
  .toolbar-btn.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background);font-weight:500}
  .toolbar-btn.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background)}
  .toolbar-btn.primary:hover{background:var(--vscode-button-hoverBackground)}
  .table-wrap{overflow-x:auto;margin:8px -4px 0;padding:0 4px}
  table{width:100%;border-collapse:collapse;font-size:.85em}
  th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--vscode-panel-border)}
  th{font-weight:600;opacity:.8;position:sticky;top:0;background:var(--vscode-editorWidget-background);z-index:1}
  tbody tr{transition:background .1s}
  tbody tr:hover{background:var(--vscode-list-hoverBackground)}
  ul{margin:6px 0;padding-left:20px}
  li{margin-bottom:4px}

  /* Hero */
  .hero{text-align:center;padding:32px 16px 20px;margin-bottom:20px}
  .hero-icon{font-size:3em;margin-bottom:8px}
  .hero-subtitle{font-size:1.05em;opacity:.7;max-width:560px;margin:8px auto 18px;line-height:1.5}
  .hero-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}

  /* TOC */
  .toc-card{padding:16px 20px}
  .toc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-top:8px}
  .toc-item{display:block;padding:8px 12px;background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);border-radius:6px;font-size:.85em;font-weight:500;cursor:pointer;transition:all .15s;text-decoration:none;color:var(--vscode-foreground)}
  .toc-item:hover{border-color:var(--vscode-focusBorder);background:var(--vscode-list-hoverBackground);text-decoration:none}

  /* Steps */
  .step-list{display:flex;flex-direction:column;gap:14px}
  .step{display:flex;gap:14px;align-items:flex-start}
  .step-num{flex-shrink:0;width:30px;height:30px;border-radius:50%;background:var(--vscode-button-background);color:var(--vscode-button-foreground);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9em;margin-top:2px}
  .step-body{flex:1}
  .step-body ul{margin:4px 0 0;padding-left:18px}

  /* Auth cards */
  .auth-methods{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:12px 0}
  .auth-card{background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);border-radius:8px;padding:14px 16px}
  .auth-icon{font-size:1.6em;margin-bottom:6px}
  .auth-card h4{margin:0 0 6px;font-size:.95em}
  .auth-card p{font-size:.82em;opacity:.75;margin:0 0 8px}
  .auth-card .code-block{font-size:.75em;padding:8px 10px;margin:4px 0 10px}
  .check-item{font-size:.8em;opacity:.8;margin:3px 0}
  .cross-item{font-size:.8em;opacity:.6;margin:3px 0}

  /* Display modes */
  .display-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:12px 0}
  .mode-card{background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);border-radius:8px;padding:12px;text-align:center}
  .mode-icon{font-size:1.5em;margin-bottom:4px}
  .mode-label{font-weight:600;font-size:.88em;margin-bottom:4px}
  .mode-desc{font-size:.78em;opacity:.7;line-height:1.4}

  /* Tooltip preview */
  .tooltip-preview{background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);border-radius:8px;padding:14px 16px;margin-top:12px}
  .tooltip-preview h4{margin:0 0 6px;font-size:.9em}
  .preview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:6px;margin-top:6px}
  .preview-item{font-size:.82em;opacity:.8;padding:4px 0}

  /* Settings table */
  .settings-table td:first-child{font-family:SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;font-size:.8em;white-space:nowrap}
  .settings-table td:nth-child(2){font-family:SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;font-size:.78em;opacity:.7;white-space:nowrap}

  /* Tips grid */
  .tip-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-top:8px}
  .tip-item{display:flex;gap:10px;padding:10px 12px;background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);border-radius:8px;align-items:flex-start}
  .tip-icon{flex-shrink:0;font-size:1.2em;margin-top:1px}
  .tip-body{font-size:.82em;line-height:1.5}
  .tip-body strong{font-size:.95em}

  /* Tip box */
  .tip-box{background:color-mix(in srgb,var(--vscode-editorWarning-foreground,#e2b714) 10%,transparent);border:1px solid color-mix(in srgb,var(--vscode-editorWarning-foreground,#e2b714) 40%,transparent);border-radius:8px;padding:12px 16px;margin:12px 0;font-size:.85em;line-height:1.5}

  /* FAQ */
  .faq-item{border-bottom:1px solid var(--vscode-panel-border);margin:0}
  .faq-item:last-child{border-bottom:none}
  .faq-q{padding:12px 0;cursor:pointer;font-weight:500;font-size:.9em;display:flex;align-items:center;gap:8px;transition:color .15s}
  .faq-q:hover{color:var(--vscode-textLink-foreground)}
  .faq-a{max-height:0;overflow:hidden;transition:max-height .3s ease;padding:0 0 0 24px;font-size:.84em;opacity:.8;line-height:1.6}

  /* Commands table highlight */
  .cmd-highlight td{font-weight:500}
  .cmd-highlight td:first-child code{color:var(--vscode-editorGutter-addedForeground,#4ec9b0)}

  /* Toast */
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:8px 20px;border-radius:6px;font-size:.82em;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);box-shadow:0 4px 12px rgba(0,0,0,.15);opacity:0;transition:opacity .25s;z-index:100;pointer-events:none}
  .toast.show{opacity:1}
`;

// ─── Changelog / What's New Panel HTML ───────────────────────────────────────

interface ChangelogEntry {
  version: string;
  items: string[];
}

/** Fallback data used when CHANGELOG.md cannot be read from disk. */
const FALLBACK_CHANGELOG: ChangelogEntry[] = [
  { version: '0.7.2', items: ['Fixed: "Check for Updates" crash \u2014 replaced AbortSignal.timeout() with manual AbortController + setTimeout'] },
  { version: '0.7.1', items: ['Fixed: apiKey and adminKey settings now masked as password fields in Settings UI', 'Docs: Version bump and push workflow now mandatory for every change/feature'] },
  { version: '0.7.0', items: ['New: Tutorial/Getting Started panel', 'New: Changelog panel \u2014 auto-shown on version upgrade', 'New: Key Health panel', 'New: Model Info panel', 'New: Spend by Tags panel', 'New: Teams panel', 'New: Activity panel', 'New: Global Spend panel', 'Improved: Budget Overview \u2014 daily cost trend line chart with interactive date pickers', 'Improved: Budget Overview \u2014 cost efficiency metrics', 'Improved: Spend Logs \u2014 cost-per-token column and summary stats', 'Improved: Key List \u2014 over-budget keys highlighted with red border', 'Improved: Status bar \u2014 clickable cycle through 4 display modes', 'Improved: Error handling \u2014 better messages for 403 errors'] },
  { version: '0.6.0', items: ['New: Budget Overview dashboard with daily spend chart, provider budgets, model donut', 'New: Spend Logs panel with search filtering', 'New: Key List panel with spend/budget bars and CSV export', 'New: Theme toggle \u2014 panels support vscode/light/dark/high-contrast themes', 'New: Budget warnings in status bar', 'New: Auto-refresh with toggle commands', 'New: Update checker with one-click install from GitHub', 'New: Login-based auth with JWT session key extraction', 'New: Display cycling \u2014 click status bar to cycle views', 'Improved: Rich status bar tooltip with key info, spend, models', 'Improved: Auth fallback to /key/list'] },
  { version: '0.5.0', items: ['New: Status bar balance display', 'New: Auto-refresh (configurable interval)', 'New: Rich hover tooltip with spend, budget, usage %, user/team, models', 'New: Multiple auth modes (API key, admin key, login)', 'New: Budget warnings with color change', 'New: API endpoint support for /key/info, /spend/logs, /provider/budgets, /global/spend/report, /key/list, /v1/models'] },
  { version: '0.4.0', items: ['New: Status bar balance display', 'New: Auto-refresh (configurable interval)', 'New: Rich hover tooltip with spend, budget, usage %, user/team, models', 'New: Multiple auth modes (API key, admin key, login)', 'New: Budget warnings with color change', 'New: API endpoint support for /key/info, /spend/logs, /provider/budgets, /global/spend/report, /key/list, /v1/models'] },
  { version: '0.3.0', items: ['Initial release with basic LiteLLM proxy connection and balance checking'] },
];

/**
 * Parse CHANGELOG.md from disk into structured entries.
 * Automatically stays in sync with the markdown file — no manual data updates needed.
 */
function parseChangelog(): ChangelogEntry[] {
  try {
    const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
    const content = fs.readFileSync(changelogPath, 'utf-8');
    const entries: ChangelogEntry[] = [];
    const lines = content.split('\n');
    let currentVersion = '';
    let currentItems: string[] = [];

    for (const line of lines) {
      const versionMatch = line.match(/^##\s+(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        if (currentVersion && currentItems.length > 0) {
          entries.push({ version: currentVersion, items: currentItems });
        }
        currentVersion = versionMatch[1];
        currentItems = [];
      } else if (currentVersion && line.trim().startsWith('- ')) {
        let item = line.trim().slice(2).trim();
        // Strip markdown bold (**word:** → word:) so icon detection works
        item = item.replace(/^\*\*([^*]+)\*\*:/, '$1:');
        if (item) currentItems.push(item);
      }
    }
    if (currentVersion && currentItems.length > 0) {
      entries.push({ version: currentVersion, items: currentItems });
    }
    return entries.length > 0 ? entries : FALLBACK_CHANGELOG;
  } catch {
    return FALLBACK_CHANGELOG;
  }
}

export function buildChangelogHtml(activeTheme?: string): string {
  const theme = activeTheme || 'vscode';
  const themeOverride = buildThemeOverrides(theme);
  const data = parseChangelog();
  const currentVer = data[0].version;

  const versionCards = data.map((entry, idx) => {
    const isLatest = idx === 0;
    const badges = entry.items.map(item => {
      const icon = item.startsWith('New:') ? '\u2728' : item.startsWith('Improved:') ? '\u{1F527}' : item.startsWith('Fixed:') ? '\u2705' : '\u{1F4A1}';
      return `<div class="cl-item"><span class="cl-icon">${icon}</span>${escapeHtml(item)}</div>`;
    }).join('\n      ');
    return `
    <div class="card cl-version${isLatest ? ' cl-latest' : ''}">
      <h3 class="cl-version-header">
        <span>v${escapeHtml(entry.version)}</span>
        ${isLatest ? '<span class="cl-badge">Latest</span>' : ''}
      </h3>
      <div class="cl-items">${badges}</div>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  ${CHANGELOG_CSS}
  ${themeOverride}
</style>
</head>
<body>
<div class="hero">
  <div class="hero-icon">\u{1F389}</div>
  <h1>What\u2019s New <span class="version-badge">v${currentVer}</span></h1>
  <p class="hero-subtitle">Stay up to date with the latest CoreLLM features and improvements.</p>
  <div class="hero-actions">
    <button class="toolbar-btn primary" onclick="openTutorial()">\u{1F4D6} Getting Started</button>
    <button class="toolbar-btn" id="themeBtn">\u{1F3A8} Toggle Theme</button>
  </div>
</div>
${versionCards}
<div class="footer">
  <span>CoreLLM v${currentVer}</span>
  <span>\u00B7</span>
  <a href="https://github.com/core-innovation/litellm-balance-checker/blob/main/CHANGELOG.md" target="_blank">Full Changelog</a>
  <span>\u00B7</span>
  <a href="https://github.com/core-innovation/litellm-balance-checker/releases" target="_blank">Releases</a>
</div>
<script>
(function() {
  const vscode = acquireVsCodeApi();
  const themes = ['vscode', 'light', 'dark', 'hc'];
  let currentThemeIdx = themes.indexOf('${theme}');
  if (currentThemeIdx < 0) currentThemeIdx = 0;

  document.getElementById('themeBtn').addEventListener('click', function() {
    currentThemeIdx = (currentThemeIdx + 1) % themes.length;
    vscode.postMessage({ type: 'setTheme', theme: themes[currentThemeIdx] });
  });

  window.openTutorial = function() {
    vscode.postMessage({ type: 'openTutorial' });
  };

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') vscode.postMessage({ type: 'close' });
  });
})();
</script>
</body>
</html>`;
}

// ─── Changelog CSS ───────────────────────────────────────────────────────────

const CHANGELOG_CSS = `
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px 24px 40px;color:var(--vscode-foreground);background:var(--vscode-editor-background);margin:0;max-width:800px;margin:0 auto;font-size:14px;line-height:1.6}
  h1{font-size:2em;font-weight:700;margin:0 0 4px;display:flex;align-items:center;gap:12px}
  h3{margin:0 0 12px;font-weight:600;font-size:1.05em}
  a{color:var(--vscode-textLink-foreground,#3794ff);text-decoration:none}
  a:hover{text-decoration:underline}
  .card{background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);border-radius:10px;padding:16px 20px;margin-bottom:14px}
  .footer{margin-top:28px;padding:14px;text-align:center;font-size:.78em;opacity:.55;border-top:1px solid var(--vscode-panel-border);display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
  .version-badge{font-size:.5em;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);padding:3px 10px;border-radius:20px;font-weight:500;vertical-align:middle}
  .toolbar-btn{padding:5px 14px;border:1px solid var(--vscode-panel-border);border-radius:5px;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:.82em;font-family:inherit;transition:all .15s ease;white-space:nowrap}
  .toolbar-btn:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder)}
  .toolbar-btn.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background)}
  .toolbar-btn.primary:hover{background:var(--vscode-button-hoverBackground)}

  .hero{text-align:center;padding:28px 16px 16px;margin-bottom:16px}
  .hero-icon{font-size:3em;margin-bottom:8px}
  .hero-subtitle{font-size:1em;opacity:.7;max-width:480px;margin:8px auto 16px;line-height:1.5}
  .hero-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}

  .cl-version-header{display:flex;align-items:center;gap:10px}
  .cl-badge{font-size:.7em;background:var(--vscode-editorGutter-addedForeground,#4ec9b0);color:#1e1e1e;padding:2px 10px;border-radius:20px;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
  .cl-latest{border-color:color-mix(in srgb,var(--vscode-editorGutter-addedForeground,#4ec9b0) 50%,transparent)}
  .cl-items{display:flex;flex-direction:column;gap:6px}
  .cl-item{display:flex;align-items:flex-start;gap:8px;font-size:.85em;line-height:1.5;padding:2px 0}
  .cl-icon{flex-shrink:0;font-size:.9em;margin-top:2px;width:18px;text-align:center}
`;

function buildThemeOverrides(theme: string): string {
  if (theme === 'system' || theme === 'vscode') return '';
  if (theme === 'light') {
    return `
  body{--vscode-editor-background:#ffffff;--vscode-editor-foreground:#1e1e1e;--vscode-editorWidget-background:#f3f3f3;--vscode-widget-border:#d4d4d4;--vscode-panel-border:#e0e0e0;--vscode-focusBorder:#007acc;--vscode-input-background:#ffffff;--vscode-input-foreground:#1e1e1e;--vscode-input-border:#cecece;--vscode-list-hoverBackground:#e8e8e8;--vscode-badge-background:#c4c4c4;--vscode-badge-foreground:#333;--vscode-progressBar-background:#ccc;--vscode-button-background:#007acc;--vscode-button-foreground:#fff;--vscode-button-hoverBackground:#0062a3;--vscode-editorGutter-addedForeground:#1a7f37;--vscode-editorWarning-foreground:#9a6700;--vscode-errorForeground:#cf222e;--vscode-textLink-foreground:#007acc}`;
  }
  if (theme === 'dark') {
    return `
  body{--vscode-editor-background:#1e1e1e;--vscode-editor-foreground:#d4d4d4;--vscode-editorWidget-background:#252526;--vscode-widget-border:#3c3c3c;--vscode-panel-border:#3c3c3c;--vscode-focusBorder:#4ec9b0;--vscode-input-background:#3c3c3c;--vscode-input-foreground:#d4d4d4;--vscode-input-border:#555;--vscode-list-hoverBackground:#2a2d2e;--vscode-badge-background:#4d4d4d;--vscode-badge-foreground:#fff;--vscode-progressBar-background:#4d4d4d;--vscode-button-background:#0e639c;--vscode-button-foreground:#fff;--vscode-button-hoverBackground:#1177bb;--vscode-editorGutter-addedForeground:#4ec9b0;--vscode-editorWarning-foreground:#e2b714;--vscode-errorForeground:#f14c4c;--vscode-textLink-foreground:#3794ff}`;
  }
  if (theme === 'hc') {
    return `
  body{--vscode-editor-background:#000;--vscode-editor-foreground:#fff;--vscode-editorWidget-background:#0a0a0a;--vscode-widget-border:#6fc3df;--vscode-panel-border:#6fc3df;--vscode-focusBorder:#f38518;--vscode-input-background:#000;--vscode-input-foreground:#fff;--vscode-input-border:#6fc3df;--vscode-list-hoverBackground:#0a0a0a;--vscode-badge-background:#fff;--vscode-badge-foreground:#000;--vscode-progressBar-background:#fff;--vscode-button-background:#fff;--vscode-button-foreground:#000;--vscode-button-hoverBackground:#ccc;--vscode-editorGutter-addedForeground:#1a7f37;--vscode-editorWarning-foreground:#e2b714;--vscode-errorForeground:#f14c4c;--vscode-textLink-foreground:#6fc3df}`;
  }
  return '';
}
