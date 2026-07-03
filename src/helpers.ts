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
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:16px;color:var(--vscode-foreground);background:var(--vscode-editor-background);margin:0}
  h2{margin-top:0;font-weight:600;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  h2 .title-actions{margin-left:auto;display:flex;gap:6px;align-items:center}
  h3{margin:20px 0 8px;font-weight:500;border-bottom:1px solid var(--vscode-panel-border);padding-bottom:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  h3 .card-actions{margin-left:auto;display:flex;gap:4px}
  .card{background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);border-radius:8px;padding:12px 16px;margin-bottom:12px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
  .stat{text-align:center}
  .stat-value{font-size:1.6em;font-weight:700}
  .stat-label{font-size:.8em;opacity:.75;margin-top:2px}
  .warn{color:var(--vscode-editorWarning-foreground,#e2b714)}
  .err{color:var(--vscode-errorForeground,#f14c4c)}
  .ok{color:var(--vscode-editorGutter-addedForeground,#4ec9b0)}
  table{width:100%;border-collapse:collapse;font-size:.85em}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--vscode-panel-border)}
  th{font-weight:600;opacity:.8;position:sticky;top:0;background:var(--vscode-editor-background);z-index:1}
  .badge{display:inline-block;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);border-radius:4px;padding:1px 6px;font-size:.8em;font-weight:500}
  .badge-success{background:var(--vscode-editorGutter-addedForeground,#4ec9b0);color:#fff}
  .badge-warn{background:var(--vscode-editorWarning-foreground,#e2b714);color:#1e1e1e}
  .badge-error{background:var(--vscode-errorForeground,#f14c4c);color:#fff}
  .error-box{background:color-mix(in srgb,var(--vscode-inputValidation-errorBackground,#5a1d1d) 80%,transparent);border:1px solid var(--vscode-inputValidation-errorBorder,#be1100);border-radius:6px;padding:10px 14px;margin-bottom:10px;font-size:.85em;line-height:1.5}
  .footer{margin-top:20px;padding:12px;text-align:center;font-size:.72em;opacity:.5;border-top:1px solid var(--vscode-panel-border);background:var(--vscode-editorWidget-background);border-radius:0 0 8px 8px;display:flex;justify-content:center;gap:16px;flex-wrap:wrap}
  .bar-container{height:8px;background:color-mix(in srgb,var(--vscode-progressBar-background,#333) 60%,transparent);border-radius:4px;overflow:hidden;margin:8px 0}
  .bar-fill{height:100%;border-radius:4px;transition:width .8s cubic-bezier(.4,0,.2,1)}
  .bar-fill.green{background:linear-gradient(90deg,var(--vscode-editorGutter-addedForeground,#4ec9b0),#6dd8c0)}
  .bar-fill.yellow{background:linear-gradient(90deg,var(--vscode-editorWarning-foreground,#e2b714),#f0c929)}
  .bar-fill.red{background:linear-gradient(90deg,var(--vscode-errorForeground,#f14c4c),#f06060)}
  .chart-row{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;justify-content:center}
  .legend{font-size:.75em;margin-top:4px;display:flex;flex-wrap:wrap;gap:6px}
  .legend-item{display:inline-flex;align-items:center;margin-right:8px;white-space:nowrap;font-size:.82em;opacity:.85}
  .legend-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle;flex-shrink:0}
  .toolbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:14px;padding:10px 14px;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);border-radius:8px;position:sticky;top:0;z-index:10}
  .toolbar-btn{padding:5px 14px;border:1px solid var(--vscode-panel-border);border-radius:5px;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:.82em;font-family:inherit;transition:all .15s ease;white-space:nowrap}
  .toolbar-btn:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder)}
  .toolbar-btn.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background);font-weight:500}
  .toolbar-btn.active:hover{background:var(--vscode-button-hoverBackground)}
  .toolbar-btn.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background)}
  .toolbar-btn.primary:hover{background:var(--vscode-button-hoverBackground)}
  .toolbar-sep{width:1px;height:24px;background:var(--vscode-panel-border);margin:0 6px;flex-shrink:0}
  .toolbar-label{font-size:.78em;opacity:.7;margin-right:2px}
  .toolbar-date{background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:4px;padding:3px 8px;font-size:.82em;font-family:inherit}
  .summary-bar{display:flex;flex-wrap:wrap;gap:0;margin-bottom:14px;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);border-radius:8px;overflow:hidden}
  .summary-item{flex:1;min-width:100px;padding:10px 12px;text-align:center;border-right:1px solid var(--vscode-panel-border)}
  .summary-item:last-child{border-right:none}
  .summary-value{font-size:1.15em;font-weight:700;line-height:1.3}
  .summary-label{font-size:.7em;opacity:.65;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}
  .trend-up{color:var(--vscode-errorForeground,#f14c4c)}
  .trend-down{color:var(--vscode-editorGutter-addedForeground,#4ec9b0)}
  .empty-state{padding:28px 16px;text-align:center;opacity:.5}
  .empty-state .empty-icon{font-size:2em;margin-bottom:10px;display:block;opacity:.6}
  .empty-state .empty-text{font-size:.88em;line-height:1.6}
  .table-wrap{overflow-x:auto;margin:0 -4px;padding:0 4px}
  .search-bar{display:flex;gap:8px;margin-bottom:12px;align-items:center}
  .search-input{flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:5px;padding:6px 10px;font-size:.85em;font-family:inherit;outline:none;transition:border-color .15s}
  .search-input:focus{border-color:var(--vscode-focusBorder)}
  .search-input::placeholder{opacity:.45}
  .copy-btn{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border:1px solid var(--vscode-panel-border);border-radius:4px;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:.76em;font-family:inherit;transition:all .15s;opacity:.6}
  .copy-btn:hover{opacity:1;background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder)}
  .copy-btn.copied{background:var(--vscode-editorGutter-addedForeground,#4ec9b0);color:#fff;border-color:var(--vscode-editorGutter-addedForeground,#4ec9b0);opacity:1}
  tbody tr{cursor:default;transition:background .12s}
  tbody tr:hover{background:var(--vscode-list-hoverBackground)}
  .copyable{display:inline-flex;align-items:center;gap:4px;cursor:pointer;padding:2px 4px;border-radius:3px;transition:background .12s}
  .copyable:hover{background:var(--vscode-list-hoverBackground)}
  .copyable .copy-icon{opacity:0;font-size:.7em;transition:opacity .12s}
  .copyable:hover .copy-icon{opacity:.5}
  .rel-time{font-size:.78em;opacity:.6;margin-left:4px;white-space:nowrap}
  .theme-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid var(--vscode-panel-border);border-radius:5px;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:.78em;font-family:inherit;transition:all .15s;opacity:.7}
  .theme-btn:hover{opacity:1;background:var(--vscode-list-hoverBackground)}
  .theme-btn.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background)}
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:8px 20px;border-radius:6px;font-size:.82em;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);box-shadow:0 4px 12px rgba(0,0,0,.15);opacity:0;transition:opacity .25s;z-index:100;pointer-events:none}
  .toast.show{opacity:1}
  .refresh-spin{display:inline-block;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}

  /* Tab bar for unified dashboard */
  .tab-bar{display:flex;gap:0;margin-bottom:16px;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);border-radius:8px;overflow:hidden}
  .tab-btn{flex:1;padding:10px 16px;border:none;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:.85em;font-family:inherit;transition:all .15s;border-right:1px solid var(--vscode-panel-border);white-space:nowrap;opacity:.7}
  .tab-btn:last-child{border-right:none}
  .tab-btn:hover{opacity:1;background:var(--vscode-list-hoverBackground)}
  .tab-btn.active{opacity:1;background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-weight:600}
  .tab-btn .tab-badge{margin-left:6px;font-size:.75em;opacity:.8}
  .tab-content{display:none}
  .tab-content.active{display:block}

  /* Health dashboard styles */
  .health-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
  .health-card{padding:14px;border-radius:8px;text-align:center}
  .health-card.healthy{background:color-mix(in srgb,var(--vscode-editorGutter-addedForeground,#4ec9b0) 15%,transparent);border:1px solid color-mix(in srgb,var(--vscode-editorGutter-addedForeground,#4ec9b0) 40%,transparent)}
  .health-card.unhealthy{background:color-mix(in srgb,var(--vscode-errorForeground,#f14c4c) 15%,transparent);border:1px solid color-mix(in srgb,var(--vscode-errorForeground,#f14c4c) 40%,transparent)}
  .health-card .endpoint-name{font-family:monospace;font-size:.85em;word-break:break-all}
  .health-icon{font-size:2em;margin-bottom:4px}

  /* Admin permissions banner */
  .admin-banner{background:color-mix(in srgb,var(--vscode-editorWarning-foreground,#e2b714) 15%,transparent);border:1px solid color-mix(in srgb,var(--vscode-editorWarning-foreground,#e2b714) 40%,transparent);border-radius:6px;padding:10px 14px;margin-bottom:12px;font-size:.85em;line-height:1.5;color:var(--vscode-editorWarning-foreground,#e2b714)}
  .admin-banner .admin-banner-link{text-decoration:underline;cursor:pointer;font-weight:500}
  .admin-banner .admin-banner-link:hover{opacity:.8}
`;