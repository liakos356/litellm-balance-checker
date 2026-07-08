import { COMMON_CSS, buildThemeOverrides, escapeHtml, usd, materialIcon } from "../helpers";
import { UserInfoResponse } from "../types";

interface UserManagerData {
  users: UserInfoResponse[];
  error: string | null;
  activeTheme?: string;
}

export function buildUserManagerHtml(data: UserManagerData): string {
  const { users, error, activeTheme } = data;
  const theme = activeTheme || "vscode";
  const themeOverride = buildThemeOverrides(theme);

  const totalSpend = users.reduce((s, u) => s + (u.spend ?? 0), 0);
  const usersWithBudget = users.filter(
    (u) => u.max_budget != null && u.max_budget > 0,
  ).length;
  const blockedCount = users.filter((u) => u.models && u.models.length === 0).length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${COMMON_CSS}${themeOverride}</style>
</head>
<body>
<h2>${materialIcon("person", 22)} CoreLLM User Manager
  <span class="title-actions">
    <span class="theme-btn" id="themeBtn" title="Toggle theme">${materialIcon("palette", 18)}</span>
    <button class="toolbar-btn" id="exportCsvBtn" title="Export as CSV">${materialIcon("download", 16)} CSV</button>
    <button class="toolbar-btn primary" id="refreshBtn" title="Refresh">${materialIcon("refresh", 16)} Refresh</button>
  </span>
</h2>
${error ? `<div class="error-box">${materialIcon("warning", 16)} ${escapeHtml(error)}</div>` : ""}

<div class="summary-bar">
  <div class="summary-item"><div class="summary-value">${users.length}</div><div class="summary-label">Users</div></div>
  <div class="summary-item"><div class="summary-value">${usd(totalSpend, 4)}</div><div class="summary-label">Total Spend</div></div>
  <div class="summary-item"><div class="summary-value">${usersWithBudget}</div><div class="summary-label">With Budget</div></div>
</div>

${
  users.length > 0
    ? `
<div class="search-bar">
      <input type="text" class="search-input" id="userSearch" placeholder="${materialIcon("preview", 14)} Filter by email, alias, or ID…">
  <span class="match-count" id="matchCount">Showing ${users.length}</span>
</div>
<div class="card">
  <div class="table-wrap"><table id="userTable"><thead><tr><th>User</th><th>Spend</th><th>Budget</th><th>Used</th><th>Teams</th><th>Models</th></tr></thead>
  <tbody>${users
    .map((u, idx) => {
      const s = u.spend ?? 0;
      const mb = u.max_budget;
      const pct = mb && mb > 0 ? (s / mb) * 100 : 0;
      const barColor = pct > 80 ? "red" : pct > 50 ? "yellow" : "green";
      const alias = u.user_alias || u.user_email || u.user_id || "unknown";
      const searchData = `${alias} ${u.user_email || ""} ${u.organization_id || ""}`;
      return `<tr data-idx="${idx}" data-search="${escapeHtml(searchData.toLowerCase())}">
    <td>
      <strong>${escapeHtml(alias)}</strong>
      ${u.user_email ? `<div style="font-size:.78em;opacity:.6">${escapeHtml(u.user_email)}</div>` : ""}
    </td>
    <td>${usd(s, 4)}</td>
    <td>${usd(mb)}</td>
    <td>${mb && mb > 0 ? pct.toFixed(1) + "%" : "\u2014"}${mb && mb > 0 ? `<div class="bar-container"><div class="bar-fill ${barColor}" style="width:${Math.min(100, pct)}%"></div></div>` : ""}</td>
    <td>${(u.teams ?? []).length > 0 ? u.teams!.map((t) => `<span class="badge">${escapeHtml(t)}</span>`).join(" ") : "\u2014"}</td>
    <td>${(u.models ?? []).length > 0 ? u.models!.slice(0, 3).join(", ") + (u.models!.length > 3 ? ` +${u.models!.length - 3}` : "") : "\u2014"}</td>
  </tr>`;
    })
    .join("")}</tbody></table></div>
</div>`
    : '<div class="empty-state"><span class="empty-icon">${materialIcon("person", 32)}</span><div class="empty-text">No users found.</div></div>'
}

<div class="footer">
  <span>CoreLLM \u00B7 ${users.length} user(s)</span>
  <span>Spend: ${usd(totalSpend, 4)}</span>
  <span>${usersWithBudget} with budget</span>
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
  document.getElementById('refreshBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'refresh' });
  });
  document.getElementById('exportCsvBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'exportCsv' });
  });

  const input = document.getElementById('userSearch');
  const table = document.getElementById('userTable');
  const matchCount = document.getElementById('matchCount');
  if (input && table) {
    input.addEventListener('input', function() {
      const q = this.value.toLowerCase().trim();
      const rows = table.querySelectorAll('tbody tr');
      let visible = 0;
      rows.forEach(row => {
        const searchData = row.getAttribute('data-search') || '';
        const match = !q || searchData.includes(q);
        row.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      matchCount.textContent = q ? 'Showing ' + visible + ' of ' + rows.length : 'Showing ' + rows.length;
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') vscode.postMessage({ type: 'close' });
  });
})();
</script>
</body>
</html>`;
}
