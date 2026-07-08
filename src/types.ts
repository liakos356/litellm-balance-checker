// ─── LiteLLM API Response Types ───────────────────────────────────────────────

export interface KeyInfoResponse {
  key?: string;
  key_alias?: string;
  key_name?: string;
  spend?: number;
  max_budget?: number | null;
  budget_duration?: string | null;
  budget_reset_at?: string | null;
  models?: string[];
  user_id?: string;
  team_id?: string;
  token?: string;
  [key: string]: unknown;
}

export interface SpendLogEntry {
  request_id?: string;
  api_key?: string;
  model?: string;
  spend?: number;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  startTime?: string;
  endTime?: string;
  call_type?: string;
  [key: string]: unknown;
}

export interface SpendLogsResponse {
  logs?: SpendLogEntry[];
  total?: number;
  page?: number;
  page_size?: number;
  [key: string]: unknown;
}

export interface ProviderBudgetEntry {
  budget_limit?: number | null;
  time_period?: string | null;
  spend?: number;
  budget_reset_at?: string | null;
  [key: string]: unknown;
}

export interface ProviderBudgetResponse {
  providers?: Record<string, ProviderBudgetEntry>;
  [key: string]: unknown;
}

export interface GlobalSpendReportEntry {
  "group-by-day"?: string;
  teams?: Array<{
    team_name?: string;
    spend?: number;
    keys?: Array<{
      key?: string;
      usage?: Record<
        string,
        {
          cost?: number;
          input_tokens?: number;
          output_tokens?: number;
          requests?: number;
        }
      >;
    }>;
  }>;
  [key: string]: unknown;
}

export interface KeyListItem {
  key?: string;
  key_alias?: string;
  key_name?: string;
  spend?: number;
  max_budget?: number | null;
  user_id?: string;
  team_id?: string;
  models?: string[];
  [key: string]: unknown;
}

export interface KeyListResponse {
  keys?: KeyListItem[];
  total_count?: number;
  [key: string]: unknown;
}

export interface GlobalSpendEntry {
  api_key?: string;
  key_alias?: string;
  key_name?: string;
  total_spend?: number;
  total_tokens?: number;
  count?: number;
  [key: string]: unknown;
}

export interface GlobalSpendKeysResponse {
  keys?: GlobalSpendEntry[];
  total_spend?: number;
  [key: string]: unknown;
}

export interface GlobalSpendModelEntry {
  model?: string;
  total_spend?: number;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  count?: number;
  [key: string]: unknown;
}

export interface GlobalSpendModelsResponse {
  models?: GlobalSpendModelEntry[];
  total_spend?: number;
  [key: string]: unknown;
}

export interface GlobalSpendTeamEntry {
  team_name?: string;
  team_id?: string;
  total_spend?: number;
  total_tokens?: number;
  count?: number;
  [key: string]: unknown;
}

export interface GlobalSpendTeamsResponse {
  teams?: GlobalSpendTeamEntry[];
  total_spend?: number;
  [key: string]: unknown;
}

export interface GlobalSpendProviderEntry {
  provider?: string;
  total_spend?: number;
  total_tokens?: number;
  count?: number;
  [key: string]: unknown;
}

export interface GlobalSpendProvidersResponse {
  providers?: GlobalSpendProviderEntry[];
  total_spend?: number;
  [key: string]: unknown;
}

export interface GlobalSpendEndUserEntry {
  end_user?: string;
  total_spend?: number;
  total_tokens?: number;
  count?: number;
  [key: string]: unknown;
}

export interface GlobalSpendEndUsersResponse {
  end_users?: GlobalSpendEndUserEntry[];
  total_spend?: number;
  [key: string]: unknown;
}

export interface GlobalActivityExceptionEntry {
  model?: string;
  exception_type?: string;
  count?: number;
  total_spend?: number;
  [key: string]: unknown;
}

export interface GlobalActivityExceptionsResponse {
  exceptions?: GlobalActivityExceptionEntry[];
  [key: string]: unknown;
}

export interface GlobalActivityModelEntry {
  model?: string;
  total_spend?: number;
  total_tokens?: number;
  count?: number;
  [key: string]: unknown;
}

export interface GlobalActivityModelResponse {
  data?: GlobalActivityModelEntry[];
  [key: string]: unknown;
}

export interface TeamInfoResponse {
  team_id?: string;
  team_alias?: string;
  team_name?: string;
  spend?: number;
  max_budget?: number | null;
  budget_duration?: string | null;
  models?: string[];
  members_with_roles?: Array<{ user_id?: string; role?: string }>;
  metadata?: Record<string, unknown>;
  blocked?: boolean;
  [key: string]: unknown;
}

export interface TeamListResponse {
  teams?: TeamInfoResponse[];
  total_count?: number;
  [key: string]: unknown;
}

export interface ModelInfoEntry {
  id?: string;
  model_name?: string;
  model_info?: {
    input_cost_per_token?: number;
    output_cost_per_token?: number;
    max_tokens?: number;
    mode?: string;
    litellm_provider?: string;
    supports_function_calling?: boolean;
    supports_vision?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ModelInfoResponse {
  data?: ModelInfoEntry[];
  [key: string]: unknown;
}

export interface SpendTagEntry {
  tag_name?: string;
  total_spend?: number;
  total_tokens?: number;
  count?: number;
  [key: string]: unknown;
}

export interface SpendTagsResponse {
  tags?: SpendTagEntry[];
  total_spend?: number;
  [key: string]: unknown;
}

export interface ActivityEntry {
  day?: string;
  hour?: string;
  api_key?: string;
  total_spend?: number;
  total_tokens?: number;
  count?: number;
  [key: string]: unknown;
}

export interface ActivityResponse {
  data?: ActivityEntry[];
  total_spend?: number;
  [key: string]: unknown;
}

export interface KeyHealthResponse {
  key?: string;
  key_alias?: string;
  key_name?: string;
  health?: string;
  last_accessed?: string;
  spend?: number;
  max_budget?: number | null;
  models?: string[];
  [key: string]: unknown;
}

export interface HealthEndpoint {
  model?: string;
  api_base?: string;
  [key: string]: unknown;
}

export interface HealthResponse {
  healthy_endpoints?: HealthEndpoint[];
  unhealthy_endpoints?: HealthEndpoint[];
  healthy_count?: number;
  unhealthy_count?: number;
  [key: string]: unknown;
}

export interface ReadinessResponse {
  status?: string;
  db?: string;
  cache?: string | null;
  litellm_version?: string;
  success_callbacks?: string[];
  last_updated?: string;
  [key: string]: unknown;
}

export interface UserInfoResponse {
  user_id?: string;
  user_email?: string;
  user_alias?: string;
  spend?: number;
  max_budget?: number | null;
  models?: string[];
  teams?: string[];
  organization_id?: string;
  [key: string]: unknown;
}

export interface UserListResponse {
  users?: UserInfoResponse[];
  total?: number;
  total_count?: number;
  [key: string]: unknown;
}

export interface GuardrailInfo {
  guardrail_name?: string;
  litellm_params?: {
    guardrail?: string;
    mode?: string;
    [key: string]: unknown;
  };
  guardrail_info?: {
    guardrail_name?: string;
    [key: string]: unknown;
  };
  default_on?: boolean;
  [key: string]: unknown;
}

export interface GuardrailsListResponse {
  guardrails?: GuardrailInfo[];
  [key: string]: unknown;
}

export interface ConfigYamlResponse {
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TokenCountResponse {
  total_tokens?: number;
  request_tokens?: number;
  response_tokens?: number;
  [key: string]: unknown;
}

// ─── Internal Types ──────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface RequestLogEntry {
  id: number;
  timestamp: string;
  method: string;
  path: string;
  fullUrl: string;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  responseStatus: number;
  responseBody: string;
  durationMs: number;
  error?: string;
}

export interface StatusBarDisplay {
  text: string;
  tooltip: string;
  color?: string;
}

export type ReportDuration = "1h" | "24h" | "7d" | "30d" | "custom";

export const DURATION_LABELS: Record<ReportDuration, string> = {
  "1h": "Last hour",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  custom: "Custom range",
};

export const DURATION_MS: Record<ReportDuration, number | null> = {
  "1h": 3600000,
  "24h": 86400000,
  "7d": 604800000,
  "30d": 2592000000,
  custom: null,
};

export interface ExtensionConfig {
  // ── Auth & Connection ──
  apiKey: string;
  adminKey: string;
  username: string;
  password: string;
  endpoint: string;

  // ── Polling & Caching ──
  /** Auto-refresh polling interval in seconds (0 = disabled). */
  refreshInterval: number;
  /** Cache API results in memory (TTL = refreshInterval). */
  cacheResults: boolean;

  // ── Status Bar ──
  /** Show key alias/name alongside balance in the status bar. */
  showKeyAlias: boolean;
  /** Append recent spend info to the status bar tooltip. */
  showSpendLogs: boolean;
  /** Append team-level spend to the status bar tooltip. */
  showTeamSpend: boolean;
  /** Append global spend totals to the status bar tooltip. */
  showGlobalSpend: boolean;
  /** Status bar display mode: cycle | remaining | spend | usage-bar | budget. */
  statusBarDisplayMode: string;
  /** Use a compact single-number status bar instead of the full label. */
  compactStatusBar: boolean;

  // ── Key & Team Targeting ──
  /** Specific key ID to query (leave empty to query the authenticated key). */
  keyToQuery: string;
  /** Only show data for this team ID (leave empty for all teams). */
  teamFilter: string;

  // ── Budget & Spend Thresholds ──
  /** Warning when REMAINING budget falls below this percent of max_budget (0-100). */
  budgetWarningThreshold: number;
  /** Alert when budget USAGE exceeds this percent (1-100). Separate from budgetWarningThreshold which is remaining-based. */
  budgetAlertThreshold: number;
  /** Show a VS Code notification when any single API request exceeds this USD amount (0 = disabled). */
  spendAlertThreshold: number;

  // ── Reports ──
  /** Time range label for spend reports: 1h | 24h | 7d | 30d | custom. */
  reportDuration: ReportDuration;
  /** Custom start date (YYYY-MM-DD) when reportDuration = custom. */
  reportCustomStart: string;
  /** Custom end date (YYYY-MM-DD) when reportDuration = custom. */
  reportCustomEnd: string;

  // ── Dashboards & Views ──
  /** Default tab when opening a dashboard panel: overview | global | teams | activity. */
  defaultPanelTab: string;
  /** Per-model spend breakdown in panel views. */
  showModelSpend: boolean;
  /** Per-provider spend breakdowns (OpenAI, Anthropic, etc.) in panels. */
  enableProviderBreakdown: boolean;
  /** Show CoreLLM sidebar tree view for quick access. */
  enableTreeView: boolean;
  /** Auto-refresh tree view data on each poll. */
  treeViewAutoRefresh: boolean;
  /** Theme override for webview panels: vscode | light | dark | hc. */
  webviewTheme: string;

  // ── Monitoring ──
  /** Continuously poll /health endpoints for model availability. */
  enableHealthMonitoring: boolean;
  /** Health check polling interval in seconds (minimum 30). */
  healthCheckInterval: number;
  /** Show a VS Code notification when any model endpoint becomes unhealthy. */
  healthAlertOnUnhealthy: boolean;
  /** Poll /global/activity endpoints for proxy-wide activity data. */
  enableActivityMonitoring: boolean;

  // ── Forecasting ──
  /** Project future spend in the Dashboard based on recent usage. */
  enableSpendForecast: boolean;
  /** Number of recent days to use as basis for spend forecasting (1-90). */
  forecastDays: number;

  // ── Alerts & Notifications ──
  /** Show VS Code notifications when budget thresholds are crossed. */
  enableBudgetAlerts: boolean;
  /** Alert when daily spend exceeds this USD amount (0 = disabled). */
  dailySpendAlertThreshold: number;
  /** Enable the daily spend alert check. */
  enableDailySpendAlert: boolean;

  // ── Miscellaneous ──
  /** Date/time display format: relative | absolute | iso. */
  dateFormat: string;
  /** Log raw HTTP request/response text for debugging (view via Show Request Logs command). */
  enableRequestLogging: boolean;
}
