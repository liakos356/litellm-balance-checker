import { COMMON_CSS, buildThemeOverrides, materialIcon } from "../helpers";

const CURRENT_VERSION = "0.8.13";

export function buildWelcomeHtml(activeTheme?: string): string {
  const theme = activeTheme || "vscode";
  const themeOverride = buildThemeOverrides(theme);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  ${COMMON_CSS}
  ${themeOverride}

  /* ── Welcome-specific styles ────────────────────────────────────── */
  .welcome-hero {
    text-align: center;
    padding: 48px 24px 36px;
    background: linear-gradient(135deg, var(--vscode-editorWidget-background) 0%, var(--vscode-editor-background) 100%);
    border: 1px solid var(--vscode-widget-border);
    border-radius: 14px;
    margin-bottom: 24px;
    position: relative;
    overflow: hidden;
  }
  .welcome-hero::before {
    content: "";
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(ellipse at 30% 20%, var(--vscode-focusBorder) 0%, transparent 70%);
    opacity: 0.04;
    pointer-events: none;
  }
  .welcome-logo {
    font-size: 56px;
    margin-bottom: 12px;
    display: inline-block;
    animation: welcomeFadeIn .6s ease-out;
  }
  .welcome-logo svg {
    width: 64px;
    height: 64px;
    color: var(--vscode-focusBorder);
  }
  @keyframes welcomeFadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .welcome-title {
    font-size: 1.8em;
    font-weight: 700;
    margin: 0 0 8px;
    letter-spacing: -.02em;
    animation: welcomeFadeIn .6s ease-out .1s both;
  }
  .welcome-version {
    display: inline-block;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    border-radius: 10px;
    padding: 2px 10px;
    font-size: .7em;
    font-weight: 600;
    vertical-align: middle;
    margin-left: 6px;
  }
  .welcome-subtitle {
    font-size: 1.05em;
    color: var(--vscode-foreground);
    opacity: .7;
    max-width: 520px;
    margin: 0 auto 24px;
    line-height: 1.6;
    animation: welcomeFadeIn .6s ease-out .15s both;
  }
  .welcome-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
    animation: welcomeFadeIn .6s ease-out .2s both;
  }
  .welcome-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 22px;
    border-radius: 8px;
    font-size: .92em;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    border: 1px solid var(--vscode-panel-border);
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    transition: all .15s ease;
    text-decoration: none;
  }
  .welcome-btn:hover {
    filter: brightness(1.15);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,.15);
  }
  .welcome-btn.secondary {
    background: transparent;
    color: var(--vscode-foreground);
    border-color: var(--vscode-panel-border);
  }
  .welcome-btn.secondary:hover {
    background: var(--vscode-list-hoverBackground);
    border-color: var(--vscode-focusBorder);
  }
  .welcome-btn .btn-icon {
    display: flex;
    align-items: center;
  }

  /* ── Feature grid ───────────────────────────────────────────────── */
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }
  .feature-card {
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-widget-border);
    border-radius: 10px;
    padding: 20px;
    transition: all .15s ease;
    cursor: default;
  }
  .feature-card:hover {
    border-color: var(--vscode-focusBorder);
    box-shadow: 0 2px 8px rgba(0,0,0,.08);
    transform: translateY(-2px);
  }
  .feature-icon {
    font-size: 28px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
  }
  .feature-icon svg {
    color: var(--vscode-focusBorder);
  }
  .feature-title {
    font-weight: 600;
    font-size: .95em;
    margin-bottom: 4px;
  }
  .feature-desc {
    font-size: .82em;
    opacity: .65;
    line-height: 1.5;
  }

  /* ── Quick start steps ──────────────────────────────────────────── */
  .steps-card {
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-widget-border);
    border-radius: 10px;
    padding: 20px 24px;
    margin-bottom: 24px;
  }
  .steps-card h3 {
    margin-bottom: 16px;
  }
  .step-item {
    display: flex;
    gap: 14px;
    margin-bottom: 16px;
    align-items: flex-start;
  }
  .step-item:last-child { margin-bottom: 0; }
  .step-num {
    width: 28px;
    height: 28px;
    min-width: 28px;
    border-radius: 50%;
    background: var(--vscode-focusBorder);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: .82em;
  }
  .step-body {
    line-height: 1.55;
  }
  .step-body strong {
    display: block;
    margin-bottom: 2px;
  }
  .step-body .hint {
    font-size: .82em;
    opacity: .6;
    margin-top: 2px;
  }

  /* ─── Tip box ───────────────────────────────────────────────────── */
  .tip-box {
    background: var(--vscode-inputValidation-infoBackground, rgba(0,122,204,.1));
    border: 1px solid var(--vscode-inputValidation-infoBorder, var(--vscode-focusBorder));
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 24px;
    font-size: .88em;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    line-height: 1.5;
  }
  .tip-box svg {
    flex-shrink: 0;
    margin-top: 1px;
    opacity: .7;
  }
  .tip-box code {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    border-radius: 4px;
    padding: 1px 6px;
    font-size: .88em;
  }
  .tip-box kbd {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    border-radius: 4px;
    padding: 1px 6px;
    font-size: .88em;
    border: 1px solid var(--vscode-widget-border);
  }

  /* ─── Footer ────────────────────────────────────────────────────── */
  .welcome-footer {
    text-align: center;
    padding: 20px 0 8px;
    font-size: .8em;
    opacity: .5;
    line-height: 1.6;
  }
  .welcome-footer a {
    color: var(--vscode-focusBorder);
    text-decoration: none;
  }
  .welcome-footer a:hover { text-decoration: underline; }
</style>
</head>
<body>

<!-- ─── Hero ───────────────────────────────────────────────────────────── -->
<div class="welcome-hero">
  <div class="welcome-logo">${materialIcon("smart_toy", 64)}</div>
  <h1 class="welcome-title">Welcome to CoreLLM<span class="welcome-version">v${CURRENT_VERSION}</span></h1>
  <p class="welcome-subtitle">
    Monitor your LiteLLM API key balances, budgets, and usage — right from the VS Code status bar.
    Track spend, explore dashboards, and manage your LLM costs without leaving your editor.
  </p>
  <div class="welcome-actions">
    <button class="welcome-btn" onclick="openSettings()">
      <span class="btn-icon">${materialIcon("build", 18)}</span> Configure
    </button>
    <button class="welcome-btn" onclick="openBudget()">
      <span class="btn-icon">${materialIcon("dashboard", 18)}</span> Open Dashboard
    </button>
    <button class="welcome-btn secondary" onclick="openTutorial()">
      <span class="btn-icon">${materialIcon("info", 18)}</span> Tutorial
    </button>
  </div>
</div>

<!-- ─── Tip ─────────────────────────────────────────────────────────────── -->
<div class="tip-box">
  ${materialIcon("info", 18)}
  <div>
    <strong>Heads up:</strong> Set your API key in <code>Settings</code> to get started, or press <kbd>Cmd+Shift+P</kbd> and type <code>CoreLLM</code> to explore all commands.
  </div>
</div>

<!-- ─── Features ────────────────────────────────────────────────────────── -->
<div class="feature-grid">
  <div class="feature-card">
    <div class="feature-icon">${materialIcon("dashboard", 28)}</div>
    <div class="feature-title">Status Bar Monitoring</div>
    <div class="feature-desc">Real-time spend, remaining budget, and usage percentage at a glance. Click to cycle display modes.</div>
  </div>
  <div class="feature-card">
    <div class="feature-icon">${materialIcon("bar_chart", 28)}</div>
    <div class="feature-title">Rich Dashboards</div>
    <div class="feature-desc">Budget overview, spend logs, global spend, team budgets, model info — all with charts and CSV/PDF export.</div>
  </div>
  <div class="feature-card">
    <div class="feature-icon">${materialIcon("health", 28)}</div>
    <div class="feature-title">Health Monitoring</div>
    <div class="feature-desc">Track proxy health endpoints, key health status, and get alerts when things go wrong.</div>
  </div>
  <div class="feature-card">
    <div class="feature-icon">${materialIcon("key", 28)}</div>
    <div class="feature-title">Key Management</div>
    <div class="feature-desc">List all API keys, view per-key spend and budgets, manage users and teams.</div>
  </div>
  <div class="feature-card">
    <div class="feature-icon">${materialIcon("schedule", 28)}</div>
    <div class="feature-title">Auto-Refresh</div>
    <div class="feature-desc">Configurable polling intervals keep your data fresh. Budget alerts warn you before limits are hit.</div>
  </div>
  <div class="feature-card">
    <div class="feature-icon">${materialIcon("cloud", 28)}</div>
    <div class="feature-title">Provider Breakdown</div>
    <div class="feature-desc">See spend by provider (OpenAI, Anthropic, etc.) with budget tracking and usage charts.</div>
  </div>
</div>

<!-- ─── Quick Start ─────────────────────────────────────────────────────── -->
<div class="steps-card">
  <h3>${materialIcon("trending_up", 18)} Quick Start in 3 Steps</h3>

  <div class="step-item">
    <div class="step-num">1</div>
    <div class="step-body">
      <strong>Set your LiteLLM endpoint and API key</strong>
      Open Settings and configure <code>corellm.endpoint</code> and <code>corellm.apiKey</code>.
      <div class="hint">For full access, add an <code>corellm.adminKey</code> too.</div>
    </div>
  </div>

  <div class="step-item">
    <div class="step-num">2</div>
    <div class="step-body">
      <strong>Check the status bar</strong>
      Your balance appears instantly in the VS Code status bar. Hover for a detailed tooltip.
    </div>
  </div>

  <div class="step-item">
    <div class="step-num">3</div>
    <div class="step-body">
      <strong>Explore the dashboards</strong>
      Open the Command Palette (<kbd>Cmd+Shift+P</kbd>) and type <code>CoreLLM</code> to see all available panels.
    </div>
  </div>
</div>

<!-- ─── Footer ──────────────────────────────────────────────────────────── -->
<div class="welcome-footer">
  CoreLLM v${CURRENT_VERSION} &middot;
  <a href="https://github.com/core-innovation/litellm-balance-checker">GitHub</a> &middot;
  <a href="https://github.com/core-innovation/litellm-balance-checker/discussions">Discussions</a>
</div>

<script>
(function() {
  const vscode = acquireVsCodeApi();
  const themes = ['vscode', 'light', 'dark', 'hc'];
  let currentThemeIdx = themes.indexOf('${theme}');
  if (currentThemeIdx < 0) currentThemeIdx = 0;

  window.openSettings = function() {
    vscode.postMessage({ type: 'openSettings' });
  };
  window.openBudget = function() {
    vscode.postMessage({ type: 'openBudgetOverview' });
  };
  window.openTutorial = function() {
    vscode.postMessage({ type: 'openTutorial' });
  };

  // Keyboard shortcut: Ctrl/Cmd+T to toggle theme
  document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 't') {
      e.preventDefault();
      currentThemeIdx = (currentThemeIdx + 1) % themes.length;
      vscode.postMessage({ type: 'setTheme', theme: themes[currentThemeIdx] });
    }
  });
})();
</script>
</body>
</html>`;
}
