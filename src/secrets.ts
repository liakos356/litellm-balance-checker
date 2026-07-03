import * as vscode from "vscode";
import { ExtensionConfig } from "./types";
import { getConfig } from "./config";

/** Secret keys used in SecretStorage (OS keychain). */
export const SECRET_API_KEY = "corellm.apiKey";
export const SECRET_ADMIN_KEY = "corellm.adminKey";
export const SECRET_PASSWORD = "corellm.password";

/** All credential secret keys. */
export const CREDENTIAL_KEYS = [
  SECRET_API_KEY,
  SECRET_ADMIN_KEY,
  SECRET_PASSWORD,
] as const;

/** Maps secret keys to ExtensionConfig field names. */
const SETTING_KEY_MAP: Record<string, keyof ExtensionConfig> = {
  [SECRET_API_KEY]: "apiKey",
  [SECRET_ADMIN_KEY]: "adminKey",
  [SECRET_PASSWORD]: "password",
};

/**
 * Resolve config by reading VS Code settings and overriding credential
 * fields with values stored in SecretStorage (OS keychain).
 *
 * If a secret exists in SecretStorage it takes priority over settings.json.
 */
export async function resolveConfig(
  secrets: vscode.SecretStorage,
): Promise<ExtensionConfig> {
  const config = getConfig();

  for (const secretKey of CREDENTIAL_KEYS) {
    const settingKey = SETTING_KEY_MAP[secretKey];
    if (!settingKey) continue;

    try {
      const stored = await secrets.get(secretKey);
      if (stored) {
        (config as unknown as Record<string, unknown>)[settingKey] = stored;
      }
    } catch {
      // If secret read fails, fall back to settings value
    }
  }

  return config;
}

/**
 * Store a credential in SecretStorage (OS keychain) and clear the
 * corresponding value from VS Code settings.json to avoid plaintext
 * storage on disk.
 */
export async function storeSecret(
  secrets: vscode.SecretStorage,
  secretKey: string,
  value: string,
): Promise<void> {
  await secrets.store(secretKey, value);

  // Clear the corresponding setting to avoid plaintext on disk
  const settingKey = SETTING_KEY_MAP[secretKey];
  if (settingKey) {
    const cfg = vscode.workspace.getConfiguration("corellm");
    const current = cfg.get<string>(settingKey, "");
    if (current) {
      await cfg.update(settingKey, "", vscode.ConfigurationTarget.Global);
    }
  }
}

/**
 * Remove a credential from SecretStorage.
 */
export async function clearSecret(
  secrets: vscode.SecretStorage,
  secretKey: string,
): Promise<void> {
  await secrets.delete(secretKey);
}

/**
 * Migrate credentials from VS Code settings.json to SecretStorage.
 *
 * Only migrates values that exist in settings but not yet in secrets.
 * Returns true if any values were migrated.
 */
export async function migrateFromSettings(
  secrets: vscode.SecretStorage,
): Promise<boolean> {
  const cfg = vscode.workspace.getConfiguration("corellm");
  let migrated = false;

  for (const secretKey of CREDENTIAL_KEYS) {
    const settingKey = SETTING_KEY_MAP[secretKey];
    if (!settingKey) continue;

    const existingSecret = await secrets.get(secretKey);
    if (existingSecret) continue; // Already migrated

    const settingValue = cfg.get<string>(settingKey, "");
    if (settingValue) {
      await storeSecret(secrets, secretKey, settingValue);
      migrated = true;
    }
  }

  return migrated;
}
