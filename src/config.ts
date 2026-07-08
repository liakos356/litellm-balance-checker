import * as vscode from "vscode";
import { ExtensionConfig, ReportDuration, DURATION_MS } from "./types";

export function getConfig(): ExtensionConfig {
  const cfg = vscode.workspace.getConfiguration("corellm");
  return {
    apiKey: cfg.get<string>("apiKey", ""),
    adminKey: cfg.get<string>("adminKey", ""),
    username: cfg.get<string>("username", ""),
    password: cfg.get<string>("password", ""),
    endpoint: cfg
      .get<string>("endpoint", "http://core.llm")
      .replace(/\/+$/, ""),
    refreshInterval: cfg.get<number>("refreshInterval", 60),
    showKeyAlias: cfg.get<boolean>("showKeyAlias", true),
    showSpendLogs: cfg.get<boolean>("showSpendLogs", false),
    budgetWarningThreshold: cfg.get<number>("budgetWarningThreshold", 20),
    keyToQuery: cfg.get<string>("keyToQuery", ""),
    reportDuration: cfg.get<ReportDuration>("reportDuration", "7d"),
    reportCustomStart: cfg.get<string>("reportCustomStart", ""),
    reportCustomEnd: cfg.get<string>("reportCustomEnd", ""),
    updateCheckInterval: cfg.get<number>("updateCheckInterval", 24),
    webviewTheme: cfg.get<string>("webviewTheme", "vscode"),
    showTeamSpend: cfg.get<boolean>("showTeamSpend", false),
    showGlobalSpend: cfg.get<boolean>("showGlobalSpend", false),
    showModelSpend: cfg.get<boolean>("showModelSpend", false),
    cacheResults: cfg.get<boolean>("cacheResults", true),
    spendAlertThreshold: cfg.get<number>("spendAlertThreshold", 0),
    enableActivityMonitoring: cfg.get<boolean>(
      "enableActivityMonitoring",
      false,
    ),
    teamFilter: cfg.get<string>("teamFilter", ""),
    defaultPanelTab: cfg.get<string>("defaultPanelTab", "overview"),
    statusBarDisplayMode: cfg.get<string>("statusBarDisplayMode", "cycle"),
    healthCheckInterval: cfg.get<number>("healthCheckInterval", 300),
    enableHealthMonitoring: cfg.get<boolean>("enableHealthMonitoring", false),
    healthAlertOnUnhealthy: cfg.get<boolean>("healthAlertOnUnhealthy", true),
    enableSpendForecast: cfg.get<boolean>("enableSpendForecast", true),
    forecastDays: cfg.get<number>("forecastDays", 7),
    enableBudgetAlerts: cfg.get<boolean>("enableBudgetAlerts", true),
    budgetAlertThreshold: cfg.get<number>("budgetAlertThreshold", 80),
    enableDailySpendAlert: cfg.get<boolean>("enableDailySpendAlert", false),
    dailySpendAlertThreshold: cfg.get<number>("dailySpendAlertThreshold", 10),
    enableProviderBreakdown: cfg.get<boolean>("enableProviderBreakdown", true),
    compactStatusBar: cfg.get<boolean>("compactStatusBar", false),
    dateFormat: cfg.get<string>("dateFormat", "relative"),
    enableTreeView: cfg.get<boolean>("enableTreeView", true),
    treeViewAutoRefresh: cfg.get<boolean>("treeViewAutoRefresh", true),
    enableRequestLogging: cfg.get<boolean>("enableRequestLogging", false),
  };
}

export function getDateRange(
  duration: ReportDuration,
  customStart: string,
  customEnd: string,
): { start: string; end: string } {
  const end = new Date();
  if (duration === "custom") {
    return {
      start:
        customStart ||
        new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      end: customEnd || end.toISOString().slice(0, 10),
    };
  }

  const ms = DURATION_MS[duration];
  if (ms) {
    return {
      start: new Date(Date.now() - ms).toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }

  return {
    start: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
