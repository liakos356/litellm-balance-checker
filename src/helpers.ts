// ─── Material Icons (inline SVG) ─────────────────────────────────────────────

/** Material Design-style inline SVG icon. Returns an <svg> string at the given size. */
export function materialIcon(name: string, size = 20): string {
  const paths: Record<string, string> = {
    dashboard:
      "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
    payments:
      "M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z",
    refresh:
      "M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
    palette:
      "M12 3a9 9 0 000 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
    download:
      "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
    health:
      "M10.5 13H8v-3h2.5V7.5h3V10H16v3h-2.5v2.5h-3V13zM12 2 4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z",
    cloud:
      "M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z",
    smart_toy:
      "M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zM7.5 11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S9.83 13 9 13s-1.5-.67-1.5-1.5zM16 17H8v-2h8v2zm-1-4c-.83 0-1.5-.67-1.5-1.5S14.17 10 15 10s1.5.67 1.5 1.5S15.83 13 15 13z",
    key:
      "M12.65 10A5.99 5.99 0 007 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 005.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z",
    trending_up:
      "M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z",
    preview:
      "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
    check_circle:
      "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
    cancel:
      "M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z",
    warning:
      "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
    person:
      "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
    storage:
      "M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z",
    bar_chart:
      "M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z",
    schedule:
      "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z",
    info:
      "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
    build:
      "M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z",
  };

  const d = paths[name];
  if (!d) return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle;flex-shrink:0"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1"/></svg>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle;flex-shrink:0"><path d="${d}"/></svg>`;
}

// ─── Webview Helpers ──────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function usd(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "\u2014";
  return `$${v.toFixed(decimals)}`;
}

/** Get a human-readable relative time string (e.g., "2m ago", "1h ago"). */
export function getRelativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** Format a CSV row, handling commas and quotes. */
export function csvCell(s: string | number | null | undefined): string {
  if (s == null) return "";
  const str = String(s);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/** Trigger a CSV download via the webview. */
export function csvDownloadScript(
  filename: string,
  headers: string[],
  rows: string[][],
): string {
  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
    "\\n",
  );
  return `
<script>
(function() {
  const csv = '${csvContent}';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '${filename}';
  a.click();
  URL.revokeObjectURL(url);
})();
</script>`;
}

// ─── Chart Helpers (SVG) ─────────────────────────────────────────────────────

/** Build an SVG horizontal bar chart. */
export function svgHBarChart(
  items: { label: string; value: number; color?: string }[],
  maxValue: number,
  width = 300,
  barHeight = 18,
  gap = 4,
): string {
  if (items.length === 0) return "";
  const m = maxValue > 0 ? maxValue : 1;
  const totalH = items.length * (barHeight + gap);
  const labelW = 80;
  const valW = 60;
  const barW = width - labelW - valW - 10;
  const colors = [
    "#4ec9b0", "#e2b714", "#f14c4c", "#569cd6",
    "#ce9178", "#6a9955", "#c586c0", "#dcdcaa",
  ];

  const bars = items
    .map((it, i) => {
      const y = i * (barHeight + gap);
      const bw = (it.value / m) * barW;
      const c = it.color || colors[i % colors.length];
      return `<text x="0" y="${y + barHeight - 4}" font-size="11" fill="var(--vscode-foreground)">${escapeHtml(it.label.length > 10 ? it.label.slice(0, 10) + ".." : it.label)}</text>
      <rect x="${labelW}" y="${y}" width="${Math.max(2, bw)}" height="${barHeight}" rx="3" fill="${c}" opacity="0.85"/>
      <text x="${labelW + Math.max(2, bw) + 4}" y="${y + barHeight - 4}" font-size="10" fill="var(--vscode-foreground)">${usd(it.value, 4)}</text>`;
    })
    .join("\n    ");

  return `<svg width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}" style="display:block;margin:8px 0">${bars}</svg>`;
}

/** Build a simple SVG donut chart. */
export function svgDonut(
  items: { label: string; value: number }[],
  size = 140,
  thickness = 28,
): string {
  if (items.length === 0) return "";
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return "";
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const colors = [
    "#4ec9b0", "#569cd6", "#ce9178", "#e2b714",
    "#c586c0", "#6a9955", "#f14c4c", "#dcdcaa",
  ];
  let angle = -90;
  const slices = items.slice(0, 8).map((it, i) => {
    const pct = it.value / total;
    const a = pct * 360;
    const start = angle;
    const end = angle + a;
    angle = end;
    const sr = ((start - 90) * Math.PI) / 180;
    const er = ((end - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(sr);
    const y1 = cy + r * Math.sin(sr);
    const x2 = cx + r * Math.cos(er);
    const y2 = cy + r * Math.sin(er);
    const large = a > 180 ? 1 : 0;
    const color = colors[i % colors.length];
    return `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${color}" opacity="0.85"/>
      <text x="${cx + r * 0.55 * Math.cos(sr + (er - sr) / 2)}" y="${cy + r * 0.55 * Math.sin(sr + (er - sr) / 2)}" font-size="9" fill="#fff" text-anchor="middle" dominant-baseline="central">${(pct * 100).toFixed(0)}%</text>`;
  }).join("\n    ");
  const holeR = r - thickness;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;margin:8px auto">${slices}
    <circle cx="${cx}" cy="${cy}" r="${holeR}" fill="var(--vscode-editor-background)"/>
    <text x="${cx}" y="${cy - 4}" font-size="18" font-weight="700" fill="var(--vscode-foreground)" text-anchor="middle" dominant-baseline="central">${usd(total)}</text>
    <text x="${cx}" y="${cy + 14}" font-size="9" fill="var(--vscode-foreground)" opacity=".6" text-anchor="middle">total</text>
  </svg>`;
}

/** Build an SVG line chart for time-series spend data. */
export function svgLineChart(
  dataPoints: { label: string; value: number }[],
  width = 360,
  height = 140,
): string {
  if (dataPoints.length < 2) return "";
  const maxVal = Math.max(...dataPoints.map((d) => d.value), 1);
  const padding = { top: 10, right: 10, bottom: 24, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const stepX = chartW / (dataPoints.length - 1);
  const points = dataPoints.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + chartH - (d.value / maxVal) * chartH,
    label: d.label,
    value: d.value,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${padding.top + chartH} L ${points[0].x.toFixed(1)} ${padding.top + chartH} Z`;

  const tickStep = Math.max(1, Math.floor(dataPoints.length / 6));
  const xLabels = points
    .filter((_, i) => i % tickStep === 0 || i === dataPoints.length - 1)
    .map(
      (p) =>
        `<text x="${p.x}" y="${height - 4}" font-size="9" fill="var(--vscode-foreground)" opacity=".5" text-anchor="middle">${escapeHtml(p.label)}</text>`,
    )
    .join("\n    ");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;margin:8px 0">
    <defs>
      <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--vscode-focusBorder)" stop-opacity=".25"/>
        <stop offset="100%" stop-color="var(--vscode-focusBorder)" stop-opacity=".02"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#lineGrad)"/>
    <path d="${linePath}" fill="none" stroke="var(--vscode-focusBorder)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${xLabels}
  </svg>`;
}

/** Build an inline SVG sparkline (tiny trend). */
export function svgSparkline(values: number[], width = 60, height = 20): string {
  if (values.length < 2) return "";
  const maxV = Math.max(...values, 1);
  const minV = Math.min(...values, 0);
  const range = maxV - minV || 1;
  const stepX = width / (values.length - 1);
  const pts = values
    .map(
      (v, i) =>
        `${(i * stepX).toFixed(0)},${(height - ((v - minV) / range) * height).toFixed(0)}`,
    )
    .join(" ");
  const color =
    values[values.length - 1] >= values[0]
      ? "var(--vscode-editorGutter-addedForeground,#4ec9b0)"
      : "var(--vscode-errorForeground,#f14c4c)";
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:inline-block;vertical-align:middle;margin:0 4px">
    <polyline fill="none" stroke="${color}" stroke-width="1.5" points="${pts}"/>
  </svg>`;
}

// ─── Theme Overrides ─────────────────────────────────────────────────────────

export function buildThemeOverrides(theme: string): string {
  if (theme === "system" || theme === "vscode") return "";
  if (theme === "light") {
    return `
  body{--vscode-editor-background:#ffffff;--vscode-editor-foreground:#1e1e1e;--vscode-editorWidget-background:#f3f3f3;--vscode-widget-border:#d4d4d4;--vscode-panel-border:#e0e0e0;--vscode-focusBorder:#007acc;--vscode-input-background:#ffffff;--vscode-input-foreground:#1e1e1e;--vscode-input-border:#cecece;--vscode-list-hoverBackground:#e8e8e8;--vscode-badge-background:#c4c4c4;--vscode-badge-foreground:#333;--vscode-progressBar-background:#ccc;--vscode-button-background:#007acc;--vscode-button-foreground:#fff;--vscode-button-hoverBackground:#0062a3;--vscode-editorGutter-addedForeground:#1a7f37;--vscode-editorWarning-foreground:#9a6700;--vscode-errorForeground:#cf222e;--vscode-inputValidation-errorBackground:#ffebe9;--vscode-inputValidation-errorBorder:#cf222e}`;
  }
  if (theme === "dark") {
    return `
  body{--vscode-editor-background:#1e1e1e;--vscode-editor-foreground:#d4d4d4;--vscode-editorWidget-background:#252526;--vscode-widget-border:#3c3c3c;--vscode-panel-border:#3c3c3c;--vscode-focusBorder:#4ec9b0;--vscode-input-background:#3c3c3c;--vscode-input-foreground:#d4d4d4;--vscode-input-border:#555;--vscode-list-hoverBackground:#2a2d2e;--vscode-badge-background:#4d4d4d;--vscode-badge-foreground:#fff;--vscode-progressBar-background:#4d4d4d;--vscode-button-background:#0e639c;--vscode-button-foreground:#fff;--vscode-button-hoverBackground:#1177bb;--vscode-editorGutter-addedForeground:#4ec9b0;--vscode-editorWarning-foreground:#e2b714;--vscode-errorForeground:#f14c4c;--vscode-inputValidation-errorBackground:#5a1d1d;--vscode-inputValidation-errorBorder:#be1100}`;
  }
  if (theme === "hc") {
    return `
  body{--vscode-editor-background:#000;--vscode-editor-foreground:#fff;--vscode-editorWidget-background:#0a0a0a;--vscode-widget-border:#6fc3df;--vscode-panel-border:#6fc3df;--vscode-focusBorder:#f38518;--vscode-input-background:#000;--vscode-input-foreground:#fff;--vscode-input-border:#6fc3df;--vscode-list-hoverBackground:#0a0a0a;--vscode-badge-background:#fff;--vscode-badge-foreground:#000;--vscode-progressBar-background:#fff;--vscode-button-background:#fff;--vscode-button-foreground:#000;--vscode-button-hoverBackground:#ccc;--vscode-editorGutter-addedForeground:#1a7f37;--vscode-editorWarning-foreground:#e2b714;--vscode-errorForeground:#f14c4c;--vscode-inputValidation-errorBackground:#5a1d1d;--vscode-inputValidation-errorBorder:#be1100}`;
  }
  return "";
}

// ─── Loading HTML ────────────────────────────────────────────────────────────

export function buildLoadingHtml(message: string, showCancel = true): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px 20px;color:var(--vscode-foreground);background:var(--vscode-editor-background);text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:40vh}
  .spinner{display:inline-block;width:28px;height:28px;border:3px solid var(--vscode-panel-border);border-top-color:var(--vscode-focusBorder);border-radius:50%;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  p{opacity:.6;margin-top:16px;font-size:.95em}
  .cancel-btn{margin-top:20px;padding:8px 24px;border:1px solid var(--vscode-panel-border);border-radius:6px;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:.85em;font-family:inherit;transition:all .15s;opacity:.7}
  .cancel-btn:hover{opacity:1;background:var(--vscode-list-hoverBackground);border-color:var(--vscode-errorForeground);color:var(--vscode-errorForeground)}
  .skeleton{display:flex;flex-direction:column;gap:12px;width:100%;max-width:400px;margin-top:24px;opacity:.3}
  .skeleton-bar{height:16px;background:var(--vscode-panel-border);border-radius:4px;animation:pulse 1.5s ease-in-out infinite}
  .skeleton-bar:nth-child(2){width:80%;animation-delay:.2s}
  .skeleton-bar:nth-child(3){width:60%;animation-delay:.4s}
  .skeleton-bar:nth-child(4){height:80px;animation-delay:.6s}
  @keyframes pulse{0%,100%{opacity:.3}50%{opacity:.7}}
</style>
</head>
<body>
<div class="spinner"></div>
<p>${escapeHtml(message)}</p>
<div class="skeleton">
  <div class="skeleton-bar"></div>
  <div class="skeleton-bar"></div>
  <div class="skeleton-bar"></div>
  <div class="skeleton-bar" style="height:60px"></div>
</div>
${showCancel ? '<button class="cancel-btn" onclick="cancelLoad()">\u2715 Cancel</button>' : ""}
<script>
const vscode = acquireVsCodeApi();
window.cancelLoad = function() { vscode.postMessage({ type: 'cancel' }); };
</script>
</body>
</html>`;
}

// ─── Common CSS ──────────────────────────────────────────────────────────────

export const COMMON_CSS = `
  *,*::before,*::after{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Helvetica Neue',Arial,sans-serif;padding:20px;color:var(--vscode-foreground);background:var(--vscode-editor-background);margin:0;line-height:1.5}
  h2{margin:0 0 20px 0;font-weight:600;font-size:1.25em;display:flex;align-items:center;gap:10px;flex-wrap:wrap;letter-spacing:-.01em}
  h2 .title-actions{margin-left:auto;display:flex;gap:8px;align-items:center}
  h3{margin:0 0 12px 0;font-weight:600;font-size:.95em;display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--vscode-foreground);opacity:.9}
  h3 .card-actions{margin-left:auto;display:flex;gap:4px}
  .card{background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);border-radius:10px;padding:16px 20px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.06);transition:box-shadow .2s,transform .15s}
  .card:hover{box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
  .stat{text-align:center;padding:8px 4px}
  .stat-value{font-size:1.5em;font-weight:700;line-height:1.2;letter-spacing:-.02em}
  .stat-label{font-size:.72em;opacity:.6;margin-top:4px;text-transform:uppercase;letter-spacing:.04em;font-weight:500}
  .warn{color:var(--vscode-editorWarning-foreground,#e2b714)}
  .err{color:var(--vscode-errorForeground,#f14c4c)}
  .ok{color:var(--vscode-editorGutter-addedForeground,#4ec9b0)}
  table{width:100%;border-collapse:collapse;font-size:.85em}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--vscode-panel-border)}
  th{font-weight:600;opacity:.7;position:sticky;top:0;background:var(--vscode-editor-background);z-index:1;font-size:.78em;text-transform:uppercase;letter-spacing:.04em}
  .badge{display:inline-flex;align-items:center;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);border-radius:10px;padding:2px 8px;font-size:.78em;font-weight:500}
  .badge-success{background:color-mix(in srgb,var(--vscode-editorGutter-addedForeground,#4ec9b0) 90%,#000);color:#fff}
  .badge-warn{background:var(--vscode-editorWarning-foreground,#e2b714);color:#1e1e1e}
  .badge-error{background:color-mix(in srgb,var(--vscode-errorForeground,#f14c4c) 90%,#000);color:#fff}
  .error-box{background:color-mix(in srgb,var(--vscode-inputValidation-errorBackground,#5a1d1d) 80%,transparent);border:1px solid var(--vscode-inputValidation-errorBorder,#be1100);border-radius:8px;padding:12px 16px;margin-bottom:12px;font-size:.85em;line-height:1.5;display:flex;align-items:flex-start;gap:8px}
  .footer{margin-top:24px;padding:14px;text-align:center;font-size:.72em;opacity:.45;border-top:1px solid var(--vscode-panel-border);background:var(--vscode-editorWidget-background);border-radius:0 0 10px 10px;display:flex;justify-content:center;gap:20px;flex-wrap:wrap}
  .bar-container{height:6px;background:color-mix(in srgb,var(--vscode-progressBar-background,#333) 30%,transparent);border-radius:3px;overflow:hidden;margin:8px 0 0 0}
  .bar-fill{height:100%;border-radius:3px;transition:width .8s cubic-bezier(.4,0,.2,1)}
  .bar-fill.green{background:linear-gradient(90deg,#43a047,#66bb6a)}
  .bar-fill.yellow{background:linear-gradient(90deg,#f9a825,#fdd835)}
  .bar-fill.red{background:linear-gradient(90deg,#e53935,#ef5350)}
  .chart-row{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start;justify-content:center}
  .legend{font-size:.75em;margin-top:4px;display:flex;flex-wrap:wrap;gap:8px}
  .legend-item{display:inline-flex;align-items:center;white-space:nowrap;font-size:.82em;opacity:.85;gap:5px}
  .legend-dot{display:inline-block;width:9px;height:9px;border-radius:50%;flex-shrink:0}
  .toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:16px;padding:12px 16px;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);border-radius:10px;position:sticky;top:0;z-index:10}
  .toolbar-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border:1px solid var(--vscode-panel-border);border-radius:8px;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:.82em;font-family:inherit;transition:all .15s ease;white-space:nowrap;font-weight:500}
  .toolbar-btn:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:translateY(-1px);box-shadow:0 2px 6px rgba(0,0,0,.08)}
  .toolbar-btn:active{transform:translateY(0)}
  .toolbar-btn.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background);font-weight:600}
  .toolbar-btn.active:hover{background:var(--vscode-button-hoverBackground)}
  .toolbar-btn.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background);font-weight:600}
  .toolbar-btn.primary:hover{background:var(--vscode-button-hoverBackground);box-shadow:0 3px 10px rgba(0,0,0,.15)}
  .toolbar-sep{width:1px;height:24px;background:var(--vscode-panel-border);margin:0 8px;flex-shrink:0}
  .toolbar-label{font-size:.78em;opacity:.65;font-weight:500}
  .toolbar-date{background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:6px;padding:4px 10px;font-size:.82em;font-family:inherit}
  .summary-bar{display:flex;flex-wrap:wrap;gap:0;margin-bottom:18px;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  .summary-item{flex:1;min-width:100px;padding:14px 14px;text-align:center;border-right:1px solid var(--vscode-panel-border);transition:background .15s}
  .summary-item:last-child{border-right:none}
  .summary-item:hover{background:var(--vscode-list-hoverBackground)}
  .summary-value{font-size:1.2em;font-weight:700;line-height:1.3;letter-spacing:-.01em}
  .summary-label{font-size:.68em;opacity:.55;text-transform:uppercase;letter-spacing:.05em;margin-top:3px;font-weight:500}
  .trend-up{color:var(--vscode-errorForeground,#f14c4c)}
  .trend-down{color:var(--vscode-editorGutter-addedForeground,#4ec9b0)}
  .empty-state{padding:36px 16px;text-align:center;opacity:.45}
  .empty-state .empty-icon{font-size:2.4em;margin-bottom:12px;display:block;opacity:.5}
  .empty-state .empty-text{font-size:.88em;line-height:1.6}
  .table-wrap{overflow-x:auto;margin:0 -4px;padding:0 4px}
  .search-bar{display:flex;gap:10px;margin-bottom:14px;align-items:center}
  .search-input{flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:8px;padding:8px 12px;font-size:.85em;font-family:inherit;outline:none;transition:border-color .2s}
  .search-input:focus{border-color:var(--vscode-focusBorder);box-shadow:0 0 0 2px color-mix(in srgb,var(--vscode-focusBorder) 25%,transparent)}
  .search-input::placeholder{opacity:.4}
  .copy-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border:1px solid var(--vscode-panel-border);border-radius:6px;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:.76em;font-family:inherit;transition:all .15s;opacity:.55;font-weight:500}
  .copy-btn:hover{opacity:1;background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder)}
  .copy-btn.copied{background:var(--vscode-editorGutter-addedForeground,#4ec9b0);color:#fff;border-color:var(--vscode-editorGutter-addedForeground,#4ec9b0);opacity:1}
  tbody tr{cursor:default;transition:background .12s}
  tbody tr:hover{background:var(--vscode-list-hoverBackground)}
  .match-count{font-size:.75em;opacity:.5;white-space:nowrap;font-weight:500}
  .copyable{display:inline-flex;align-items:center;gap:4px;cursor:pointer;padding:2px 6px;border-radius:4px;transition:background .12s}
  .copyable:hover{background:var(--vscode-list-hoverBackground)}
  .copyable .copy-icon{opacity:0;font-size:.7em;transition:opacity .12s}
  .copyable:hover .copy-icon{opacity:.4}
  .rel-time{font-size:.78em;opacity:.5;margin-left:6px;white-space:nowrap}
  .theme-btn{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0;border:1px solid var(--vscode-panel-border);border-radius:8px;background:transparent;color:var(--vscode-foreground);cursor:pointer;transition:all .15s;opacity:.65}
  .theme-btn:hover{opacity:1;background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder);transform:rotate(15deg)}
  .theme-btn.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background);opacity:1}
  .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:10px 24px;border-radius:8px;font-size:.84em;font-weight:500;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);box-shadow:0 8px 24px rgba(0,0,0,.18);opacity:0;transition:opacity .25s;z-index:100;pointer-events:none}
  .toast.show{opacity:1}
  .refresh-spin{display:inline-block;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}

  /* Tab bar */
  .tab-bar{display:flex;gap:0;margin-bottom:20px;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05)}
  .tab-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:11px 16px;border:none;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:.83em;font-family:inherit;transition:all .15s;border-right:1px solid var(--vscode-panel-border);white-space:nowrap;opacity:.65;font-weight:500}
  .tab-btn:last-child{border-right:none}
  .tab-btn:hover{opacity:1;background:var(--vscode-list-hoverBackground)}
  .tab-btn.active{opacity:1;background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-weight:600;box-shadow:inset 0 -2px 0 rgba(255,255,255,.2)}
  .tab-content{display:none}
  .tab-content.active{display:block;animation:fadeIn .2s ease}
  @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}

  /* Health cards */
  .health-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
  .health-card{padding:16px;border-radius:10px;text-align:center;transition:transform .15s}
  .health-card:hover{transform:translateY(-1px)}
  .health-card.healthy{background:color-mix(in srgb,var(--vscode-editorGutter-addedForeground,#4ec9b0) 12%,transparent);border:1px solid color-mix(in srgb,var(--vscode-editorGutter-addedForeground,#4ec9b0) 35%,transparent)}
  .health-card.unhealthy{background:color-mix(in srgb,var(--vscode-errorForeground,#f14c4c) 12%,transparent);border:1px solid color-mix(in srgb,var(--vscode-errorForeground,#f14c4c) 35%,transparent)}
  .health-card .endpoint-name{font-family:'SF Mono',Monaco,'Cascadia Code',monospace;font-size:.84em;word-break:break-all}
  .health-icon svg{opacity:.85}

  /* Permissions banner */
  .admin-banner{background:color-mix(in srgb,var(--vscode-editorWarning-foreground,#e2b714) 12%,transparent);border:1px solid color-mix(in srgb,var(--vscode-editorWarning-foreground,#e2b714) 35%,transparent);border-radius:8px;padding:12px 16px;margin-bottom:14px;font-size:.84em;line-height:1.5;color:var(--vscode-editorWarning-foreground,#e2b714);display:flex;align-items:flex-start;gap:8px}
  .admin-banner .admin-banner-link{text-decoration:underline;cursor:pointer;font-weight:600;white-space:nowrap}
  .admin-banner .admin-banner-link:hover{opacity:.8}
`;