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
  apiKey: string;
  adminKey: string;
  username: string;
  password: string;
  endpoint: string;
  refreshInterval: number;
  showKeyAlias: boolean;
  showSpendLogs: boolean;
  budgetWarningThreshold: number;
  keyToQuery: string;
  reportDuration: ReportDuration;
  reportCustomStart: string;
  reportCustomEnd: string;
  updateCheckInterval: number;
  webviewTheme: string;
  showTeamSpend: boolean;
  showGlobalSpend: boolean;
  showModelSpend: boolean;
  cacheResults: boolean;
  spendAlertThreshold: number;
  enableActivityMonitoring: boolean;
  teamFilter: string;
  defaultPanelTab: string;
  statusBarDisplayMode: string;
  healthCheckInterval: number;
  enableHealthMonitoring: boolean;
  healthAlertOnUnhealthy: boolean;
  enableSpendForecast: boolean;
  forecastDays: number;
  enableBudgetAlerts: boolean;
  budgetAlertThreshold: number;
  enableDailySpendAlert: boolean;
  dailySpendAlertThreshold: number;
  enableProviderBreakdown: boolean;
  compactStatusBar: boolean;
  dateFormat: string;
  enableTreeView: boolean;
  treeViewAutoRefresh: boolean;
}
