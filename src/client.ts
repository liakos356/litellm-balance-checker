import {
  CacheEntry,
  ExtensionConfig,
  KeyInfoResponse,
  SpendLogEntry,
  SpendLogsResponse,
  ProviderBudgetResponse,
  GlobalSpendReportEntry,
  KeyListResponse,
  KeyListItem,
  GlobalSpendKeysResponse,
  GlobalSpendModelsResponse,
  GlobalSpendTeamsResponse,
  GlobalSpendProvidersResponse,
  GlobalSpendEndUsersResponse,
  GlobalActivityExceptionsResponse,
  GlobalActivityModelResponse,
  TeamListResponse,
  TeamInfoResponse,
  ModelInfoResponse,
  SpendTagsResponse,
  ActivityResponse,
  KeyHealthResponse,
  HealthResponse,
  ReadinessResponse,
  UserInfoResponse,
  UserListResponse,
  GuardrailsListResponse,
  ConfigYamlResponse,
  TokenCountResponse,
  RequestLogEntry,
} from "./types";

export class CoreLLMApiClient {
  private config: ExtensionConfig;
  private cachedJwtKey: string | undefined;
  private loginPromise: Promise<string | null> | undefined;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private static requestLogs: RequestLogEntry[] = [];
  private static logCounter = 0;
  private static MAX_LOG_ENTRIES = 200;
  private enableRequestLogging: boolean;

  constructor(config: ExtensionConfig) {
    this.config = config;
    this.enableRequestLogging = config.enableRequestLogging;
  }

  /** Update logging state (called when config changes). */
  setRequestLogging(enabled: boolean): void {
    this.enableRequestLogging = enabled;
  }

  /** Get all buffered request logs. */
  static getRequestLogs(): RequestLogEntry[] {
    return CoreLLMApiClient.requestLogs;
  }

  /** Clear all buffered request logs. */
  static clearRequestLogs(): void {
    CoreLLMApiClient.requestLogs = [];
    CoreLLMApiClient.logCounter = 0;
  }

  /** Get or set cached data with a configurable TTL (default 30s). */
  getCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  setCache<T>(key: string, data: T, ttl = 30000): void {
    if (!this.config.cacheResults) return;
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }

  /** Clear all cached data */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Login with username/password and extract the embedded API key from JWT.
   */
  private async loginAndGetKey(): Promise<string | null> {
    if (this.cachedJwtKey) return this.cachedJwtKey;
    if (!this.config.username || !this.config.password) return null;

    if (!this.loginPromise) {
      this.loginPromise = (async () => {
        try {
          const url = `${this.config.endpoint}/login`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `username=${encodeURIComponent(this.config.username)}&password=${encodeURIComponent(this.config.password)}`,
            redirect: "manual",
          });
          const setCookie = res.headers.get("set-cookie") || "";
          const jwtMatch = setCookie.match(/token=([^;]+)/);
          if (!jwtMatch) throw new Error("No token cookie returned");
          const jwt = jwtMatch[1];

          const payloadB64 = jwt
            .split(".")[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/");
          const jsonStr = atob(payloadB64);
          const payload = JSON.parse(jsonStr);
          const embeddedKey: string = payload.key || "";
          if (embeddedKey.startsWith("sk-")) {
            this.cachedJwtKey = embeddedKey;
            return embeddedKey;
          }
          throw new Error("No valid sk- key in JWT");
        } catch (err) {
          this.loginPromise = undefined;
          throw err;
        }
      })();
    }
    return this.loginPromise;
  }

  private async resolveAuthKey(): Promise<string | null> {
    if (this.config.username) {
      try {
        const key = await this.loginAndGetKey();
        if (key) return key;
      } catch {
        /* fall through */
      }
    }
    return this.config.adminKey || this.config.apiKey || null;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const authKey = await this.resolveAuthKey();
    if (authKey) {
      headers["Authorization"] = `Bearer ${authKey}`;
      headers["x-litellm-api-key"] = authKey;
    }
    return headers;
  }

  // ── Generic GET / POST helpers ──────────────────────────────────────────

  /** Redact sensitive header values (auth tokens, API keys) before logging. */
  private static REDACT_HEADERS = new Set([
    "authorization",
    "x-litellm-api-key",
    "cookie",
    "set-cookie",
    "x-api-key",
    "proxy-authorization",
  ]);

  private static redactHeaders(headers: Record<string, string>): Record<string, string> {
    const redacted: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (CoreLLMApiClient.REDACT_HEADERS.has(k.toLowerCase())) {
        redacted[k] = v.length > 20 ? v.slice(0, 8) + "..." + v.slice(-4) : "***REDACTED***";
      } else {
        redacted[k] = v;
      }
    }
    return redacted;
  }

  /** Redact sensitive fields from JSON response bodies (e.g. API keys in /key/info). */
  private static SENSITIVE_JSON_KEYS = new Set([
    "key", "token", "api_key", "apiKey", "secret", "password",
    "master_key", "proxy_master_key", "litellm_master_key",
  ]);

  private static redactJsonBody(body: string): string {
    try {
      const obj = JSON.parse(body);
      CoreLLMApiClient.redactJsonObject(obj);
      return JSON.stringify(obj);
    } catch {
      // Not valid JSON — return as-is (it's already truncated anyway)
      return body;
    }
  }

  private static redactJsonObject(obj: unknown, depth = 0): void {
    if (depth > 10 || obj == null || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) CoreLLMApiClient.redactJsonObject(item, depth + 1);
      return;
    }
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (CoreLLMApiClient.SENSITIVE_JSON_KEYS.has(k) && typeof v === "string" && v.length > 0) {
        (obj as Record<string, unknown>)[k] = v.length > 20 ? v.slice(0, 8) + "..." + v.slice(-4) : "***REDACTED***";
      } else if (typeof v === "object") {
        CoreLLMApiClient.redactJsonObject(v, depth + 1);
      }
    }
  }

  private logRequest(
    method: string,
    path: string,
    fullUrl: string,
    reqHeaders: Record<string, string>,
    reqBody: string | undefined,
    resStatus: number,
    resBody: string,
    durationMs: number,
    error?: string,
  ): void {
    if (!this.enableRequestLogging) return;
    CoreLLMApiClient.logCounter++;
    // Redact sensitive data before storing in memory
    const safeHeaders = CoreLLMApiClient.redactHeaders(reqHeaders);
    const safeResBody = CoreLLMApiClient.redactJsonBody(resBody);
    CoreLLMApiClient.requestLogs.unshift({
      id: CoreLLMApiClient.logCounter,
      timestamp: new Date().toISOString(),
      method,
      path,
      fullUrl,
      requestHeaders: safeHeaders,
      requestBody: reqBody,
      responseStatus: resStatus,
      responseBody: safeResBody,
      durationMs,
      error,
    });
    if (CoreLLMApiClient.requestLogs.length > CoreLLMApiClient.MAX_LOG_ENTRIES) {
      CoreLLMApiClient.requestLogs.length = CoreLLMApiClient.MAX_LOG_ENTRIES;
    }
  }

  async apiGet<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${this.config.endpoint}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v) url.searchParams.set(k, v);
      }
    }
    const headers = await this.getHeaders();
    const fullUrl = url.toString();
    const startTime = Date.now();
    let resStatus = 0;
    let resText = "";
    try {
      const res = await fetch(fullUrl, {
        method: "GET",
        headers,
      });
      resStatus = res.status;
      resText = await res.text();
      if (!res.ok) {
        const snippet = resText.slice(0, 300);
        this.logRequest("GET", path, fullUrl, headers, undefined, resStatus, snippet, Date.now() - startTime);
        if (
          res.status === 403 &&
          snippet.includes("not allowed to call this route")
        ) {
          throw new Error(
            `Your API key lacks management permissions (403 on ${path}). ` +
              `Use an admin/proxy master key in the "adminKey" setting.`,
          );
        }
        throw new Error(`API ${res.status} on ${path}: ${snippet}`);
      }
      this.logRequest("GET", path, fullUrl, headers, undefined, resStatus, resText.slice(0, 2000), Date.now() - startTime);
      return JSON.parse(resText) as T;
    } catch (err) {
      if (err instanceof SyntaxError) {
        // JSON parse error — response was not JSON
        this.logRequest("GET", path, fullUrl, headers, undefined, resStatus, resText.slice(0, 2000), Date.now() - startTime, `Parse error: ${err.message}`);
        throw new Error(`Invalid JSON from ${path}: ${resText.slice(0, 200)}`);
      }
      // Re-throw if already an Error we created above
      if (err instanceof Error && err.message.startsWith("API ") || err instanceof Error && err.message.startsWith("Invalid JSON") || err instanceof Error && err.message.startsWith("Your API key")) {
        throw err;
      }
      this.logRequest("GET", path, fullUrl, headers, undefined, resStatus || 0, resText.slice(0, 500), Date.now() - startTime, String(err));
      throw err;
    }
  }

  async apiPost<T>(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = new URL(`${this.config.endpoint}${path}`);
    const headers = await this.getHeaders();
    const fullUrl = url.toString();
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const startTime = Date.now();
    let resStatus = 0;
    let resText = "";
    try {
      const res = await fetch(fullUrl, {
        method: "POST",
        headers,
        body: bodyStr,
      });
      resStatus = res.status;
      resText = await res.text();
      if (!res.ok) {
        const snippet = resText.slice(0, 300);
        this.logRequest("POST", path, fullUrl, headers, bodyStr, resStatus, snippet, Date.now() - startTime);
        throw new Error(`API ${res.status} on ${path}: ${snippet}`);
      }
      this.logRequest("POST", path, fullUrl, headers, bodyStr, resStatus, resText.slice(0, 2000), Date.now() - startTime);
      return JSON.parse(resText) as T;
    } catch (err) {
      if (err instanceof SyntaxError) {
        this.logRequest("POST", path, fullUrl, headers, bodyStr, resStatus, resText.slice(0, 2000), Date.now() - startTime, `Parse error: ${err.message}`);
        throw new Error(`Invalid JSON from ${path}: ${resText.slice(0, 200)}`);
      }
      if (err instanceof Error && (err.message.startsWith("API ") || err.message.startsWith("Invalid JSON"))) {
        throw err;
      }
      this.logRequest("POST", path, fullUrl, headers, bodyStr, resStatus || 0, resText.slice(0, 500), Date.now() - startTime, String(err));
      throw err;
    }
  }

  // ── Key Management ──────────────────────────────────────────────────────

  /** GET /key/info */
  async fetchKeyInfo(): Promise<KeyInfoResponse> {
    return this.apiGet<KeyInfoResponse>(
      "/key/info",
      this.config.keyToQuery ? { key: this.config.keyToQuery } : undefined,
    );
  }

  /** GET /key/list */
  async fetchKeyList(page = 1, size = 50): Promise<KeyListResponse> {
    return this.apiGet<KeyListResponse>("/key/list", {
      page: String(page),
      size: String(size),
      return_full_object: "true",
    });
  }

  /** GET /key/aliases */
  async fetchKeyAliases(
    page = 1,
    size = 50,
    search?: string,
  ): Promise<{ aliases?: KeyListItem[]; total?: number }> {
    const params: Record<string, string> = {
      page: String(page),
      size: String(size),
    };
    if (search) params.search = search;
    return this.apiGet("/key/aliases", params);
  }

  /** GET /key/health */
  async fetchKeyHealth(): Promise<KeyHealthResponse> {
    const cacheKey = "keyHealth";
    const cached = this.getCache<KeyHealthResponse>(cacheKey);
    if (cached) return cached;
    const data = await this.apiGet<KeyHealthResponse>("/key/health");
    this.setCache(cacheKey, data, 60000);
    return data;
  }

  // ── Spend Tracking ──────────────────────────────────────────────────────

  /** GET /spend/logs */
  async fetchSpendLogs(limit = 5): Promise<SpendLogEntry[]> {
    const params: Record<string, string> = { page_size: String(limit) };
    if (this.config.keyToQuery) params.api_key = this.config.keyToQuery;
    const data = await this.apiGet<SpendLogEntry[] | SpendLogsResponse>(
      "/spend/logs",
      params,
    );
    if (Array.isArray(data)) return data;
    if (data && Array.isArray((data as SpendLogsResponse).logs))
      return (data as SpendLogsResponse).logs!;
    return [];
  }

  /** GET /spend/tags */
  async fetchSpendTags(
    startDate?: string,
    endDate?: string,
  ): Promise<SpendTagsResponse> {
    const cacheKey = `spendTags_${startDate}_${endDate}`;
    const cached = this.getCache<SpendTagsResponse>(cacheKey);
    if (cached) return cached;
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const data = await this.apiGet<SpendTagsResponse>("/spend/tags", params);
    this.setCache(cacheKey, data, 60000);
    return data;
  }

  /** GET /spend/keys */
  async fetchSpendKeys(
    startDate?: string,
    endDate?: string,
  ): Promise<GlobalSpendKeysResponse> {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return this.apiGet<GlobalSpendKeysResponse>("/spend/keys", params);
  }

  /** GET /spend/users */
  async fetchSpendUsers(
    startDate?: string,
    endDate?: string,
  ): Promise<{ users?: Array<{ user_id?: string; total_spend?: number }> }> {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return this.apiGet("/spend/users", params);
  }

  /** POST /spend/calculate */
  async calculateSpend(params: {
    model?: string;
    messages?: Array<{ role: string; content: string }>;
    prompt?: string;
    completion?: string;
  }): Promise<{ cost?: number; tokens?: number }> {
    return this.apiPost("/spend/calculate", params as Record<string, unknown>);
  }

  // ── Global Spend ────────────────────────────────────────────────────────

  /** GET /global/spend/report */
  async fetchGlobalSpendReport(
    startDate: string,
    endDate: string,
  ): Promise<GlobalSpendReportEntry[]> {
    return this.apiGet<GlobalSpendReportEntry[]>("/global/spend/report", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  /** GET /global/spend/keys */
  async fetchGlobalSpendKeys(
    startDate?: string,
    endDate?: string,
  ): Promise<GlobalSpendKeysResponse> {
    const cacheKey = `globalSpendKeys_${startDate}_${endDate}`;
    const cached = this.getCache<GlobalSpendKeysResponse>(cacheKey);
    if (cached) return cached;
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const data = await this.apiGet<GlobalSpendKeysResponse>(
      "/global/spend/keys",
      params,
    );
    this.setCache(cacheKey, data, 60000);
    return data;
  }

  /** GET /global/spend/models */
  async fetchGlobalSpendModels(
    startDate?: string,
    endDate?: string,
  ): Promise<GlobalSpendModelsResponse> {
    const cacheKey = `globalSpendModels_${startDate}_${endDate}`;
    const cached = this.getCache<GlobalSpendModelsResponse>(cacheKey);
    if (cached) return cached;
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const data = await this.apiGet<GlobalSpendModelsResponse>(
      "/global/spend/models",
      params,
    );
    this.setCache(cacheKey, data, 60000);
    return data;
  }

  /** GET /global/spend/teams */
  async fetchGlobalSpendTeams(
    startDate?: string,
    endDate?: string,
  ): Promise<GlobalSpendTeamsResponse> {
    const cacheKey = `globalSpendTeams_${startDate}_${endDate}`;
    const cached = this.getCache<GlobalSpendTeamsResponse>(cacheKey);
    if (cached) return cached;
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (this.config.teamFilter) params.team_id = this.config.teamFilter;
    const data = await this.apiGet<GlobalSpendTeamsResponse>(
      "/global/spend/teams",
      params,
    );
    this.setCache(cacheKey, data, 60000);
    return data;
  }

  /** GET /global/spend/provider — NEW */
  async fetchGlobalSpendProviders(
    startDate?: string,
    endDate?: string,
  ): Promise<GlobalSpendProvidersResponse> {
    const cacheKey = `globalSpendProviders_${startDate}_${endDate}`;
    const cached = this.getCache<GlobalSpendProvidersResponse>(cacheKey);
    if (cached) return cached;
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const data = await this.apiGet<GlobalSpendProvidersResponse>(
      "/global/spend/provider",
      params,
    );
    this.setCache(cacheKey, data, 60000);
    return data;
  }

  /** GET /global/spend/end_users — NEW */
  async fetchGlobalSpendEndUsers(
    startDate?: string,
    endDate?: string,
  ): Promise<GlobalSpendEndUsersResponse> {
    const cacheKey = `globalSpendEndUsers_${startDate}_${endDate}`;
    const cached = this.getCache<GlobalSpendEndUsersResponse>(cacheKey);
    if (cached) return cached;
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const data = await this.apiGet<GlobalSpendEndUsersResponse>(
      "/global/spend/end_users",
      params,
    );
    this.setCache(cacheKey, data, 60000);
    return data;
  }

  /** GET /global/spend/all_tag_names — NEW */
  async fetchAllTagNames(): Promise<{ tags?: string[] }> {
    return this.apiGet("/global/spend/all_tag_names");
  }

  /** GET /global/spend/tags — NEW */
  async fetchGlobalSpendTags(
    startDate?: string,
    endDate?: string,
  ): Promise<SpendTagsResponse> {
    const cacheKey = `globalSpendTags_${startDate}_${endDate}`;
    const cached = this.getCache<SpendTagsResponse>(cacheKey);
    if (cached) return cached;
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const data = await this.apiGet<SpendTagsResponse>(
      "/global/spend/tags",
      params,
    );
    this.setCache(cacheKey, data, 60000);
    return data;
  }

  // ── Activity ────────────────────────────────────────────────────────────

  /** GET /global/activity */
  async fetchGlobalActivity(
    startDate?: string,
    endDate?: string,
  ): Promise<ActivityResponse> {
    const cacheKey = `globalActivity_${startDate}_${endDate}`;
    const cached = this.getCache<ActivityResponse>(cacheKey);
    if (cached) return cached;
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const data = await this.apiGet<ActivityResponse>(
      "/global/activity",
      params,
    );
    this.setCache(cacheKey, data, 60000);
    return data;
  }

  /** GET /global/activity/model — NEW */
  async fetchGlobalActivityModel(
    startDate?: string,
    endDate?: string,
  ): Promise<GlobalActivityModelResponse> {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return this.apiGet<GlobalActivityModelResponse>(
      "/global/activity/model",
      params,
    );
  }

  /** GET /global/activity/exceptions — NEW */
  async fetchGlobalActivityExceptions(
    startDate?: string,
    endDate?: string,
  ): Promise<GlobalActivityExceptionsResponse> {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return this.apiGet<GlobalActivityExceptionsResponse>(
      "/global/activity/exceptions",
      params,
    );
  }

  /** GET /global/activity/exceptions/deployment — NEW */
  async fetchGlobalActivityExceptionsDeployment(
    startDate?: string,
    endDate?: string,
  ): Promise<GlobalActivityExceptionsResponse> {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return this.apiGet<GlobalActivityExceptionsResponse>(
      "/global/activity/exceptions/deployment",
      params,
    );
  }

  // ── Teams ───────────────────────────────────────────────────────────────

  /** GET /team/list */
  async fetchTeamList(): Promise<TeamListResponse> {
    const cacheKey = "teamList";
    const cached = this.getCache<TeamListResponse>(cacheKey);
    if (cached) return cached;
    const data = await this.apiGet<TeamListResponse>("/team/list");
    this.setCache(cacheKey, data, 120000);
    return data;
  }

  /** GET /team/info */
  async fetchTeamInfo(teamId: string): Promise<TeamInfoResponse> {
    return this.apiGet<TeamInfoResponse>("/team/info", { team_id: teamId });
  }

  // ── Users ───────────────────────────────────────────────────────────────

  /** GET /user/info */
  async fetchUserInfo(userId?: string): Promise<UserInfoResponse> {
    return this.apiGet<UserInfoResponse>(
      "/user/info",
      userId ? { user_id: userId } : undefined,
    );
  }

  /** GET /user/list */
  async fetchUserList(): Promise<UserListResponse> {
    const cacheKey = "userList";
    const cached = this.getCache<UserListResponse>(cacheKey);
    if (cached) return cached;
    const data = await this.apiGet<UserListResponse>("/user/list");
    this.setCache(cacheKey, data, 60000);
    return data;
  }

  /** GET /user/daily/activity */
  async fetchUserDailyActivity(userId?: string): Promise<unknown> {
    return this.apiGet(
      "/user/daily/activity",
      userId ? { user_id: userId } : undefined,
    );
  }

  // ── Models ──────────────────────────────────────────────────────────────

  /** GET /v1/models */
  async fetchModels(): Promise<string[]> {
    try {
      const data = await this.apiGet<{ data?: Array<{ id?: string }> }>(
        "/v1/models",
      );
      return data?.data?.map((m) => m.id ?? "").filter(Boolean) ?? [];
    } catch {
      return [];
    }
  }

  /** GET /model/info */
  async fetchModelInfo(): Promise<ModelInfoResponse> {
    const cacheKey = "modelInfo";
    const cached = this.getCache<ModelInfoResponse>(cacheKey);
    if (cached) return cached;
    const data = await this.apiGet<ModelInfoResponse>("/model/info");
    this.setCache(cacheKey, data, 300000);
    return data;
  }

  // ── Provider Budgets ────────────────────────────────────────────────────

  /** GET /provider/budgets */
  async fetchProviderBudgets(): Promise<ProviderBudgetResponse> {
    return this.apiGet<ProviderBudgetResponse>("/provider/budgets");
  }

  // ── Health ──────────────────────────────────────────────────────────────

  /** GET /health */
  async fetchHealth(): Promise<HealthResponse> {
    const cacheKey = "health";
    const cached = this.getCache<HealthResponse>(cacheKey);
    if (cached) return cached;
    const data = await this.apiGet<HealthResponse>("/health");
    this.setCache(cacheKey, data, 30000);
    return data;
  }

  /** GET /health/readiness */
  async fetchReadiness(): Promise<ReadinessResponse> {
    const cacheKey = "readiness";
    const cached = this.getCache<ReadinessResponse>(cacheKey);
    if (cached) return cached;
    const data = await this.apiGet<ReadinessResponse>("/health/readiness");
    this.setCache(cacheKey, data, 15000);
    return data;
  }

  /** GET /health/liveliness */
  async fetchLiveliness(): Promise<string> {
    try {
      const url = new URL(`${this.config.endpoint}/health/liveliness`);
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: await this.getHeaders(),
      });
      if (!res.ok) throw new Error(`API ${res.status} on /health/liveliness`);
      return await res.text();
    } catch {
      return "";
    }
  }

  // ── Guardrails ──────────────────────────────────────────────────────────

  /** GET /guardrails/list */
  async fetchGuardrails(): Promise<GuardrailsListResponse> {
    const cacheKey = "guardrails";
    const cached = this.getCache<GuardrailsListResponse>(cacheKey);
    if (cached) return cached;
    const data = await this.apiGet<GuardrailsListResponse>("/guardrails/list");
    this.setCache(cacheKey, data, 120000);
    return data;
  }

  // ── Config ──────────────────────────────────────────────────────────────

  /** GET /config/yaml */
  async fetchConfigYaml(): Promise<ConfigYamlResponse> {
    return this.apiGet<ConfigYamlResponse>("/config/yaml");
  }

  // ── Token Counter ───────────────────────────────────────────────────────

  /** POST /utils/token_counter */
  async countTokens(
    model: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<TokenCountResponse> {
    const url = new URL(`${this.config.endpoint}/utils/token_counter`);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify({ model, messages }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `API ${res.status} on /utils/token_counter: ${text.slice(0, 300)}`,
      );
    }
    return res.json() as Promise<TokenCountResponse>;
  }
}
