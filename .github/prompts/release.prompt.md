---
name: Release
description: Bump the version, update changelog, build VSIX, and open Marketplace for deployment.
---

# Release — Version Bump & Deploy

You are performing a release for the **CoreLLM** VS Code extension. Follow these steps exactly.

## 1. Determine the bump type

Ask the user what kind of bump this is:
- `patch` (0.0.X) — fixes, tweaks, minor improvements
- `minor` (0.X.0) — new features
- `major` (X.0.0) — breaking changes

If the user already specified the bump type in their message, use that. Otherwise ask.

## 2. Read current version

Read the CURRENT_VERSION from **all three** of these files:
- `src/extension.ts` — `const CURRENT_VERSION = "X.Y.Z"`
- `src/tutorial.ts` — `const CURRENT_VERSION = "X.Y.Z"`
- `package.json` — `"version": "X.Y.Z"`

Confirm all three match. If they don't, fix the mismatch first (use the package.json version as source of truth).

## 3. Calculate new version

Parse the current `MAJOR.MINOR.PATCH` and increment the appropriate segment. Reset lower segments to 0 as needed:
- `patch`: `X.Y.(Z+1)`
- `minor`: `X.(Y+1).0`
- `major`: `(X+1).0.0`

## 4. Update all version locations

Update the version string in all three files to the new version:
- `src/extension.ts` — `const CURRENT_VERSION = "<NEW_VERSION>"`
- `src/tutorial.ts` — `const CURRENT_VERSION = "<NEW_VERSION>"`
- `package.json` — `"version": "<NEW_VERSION>"`

## 5. Update CHANGELOG.md

Add a new entry at the top of `CHANGELOG.md`:

```markdown
## <NEW_VERSION> (YYYY-MM-DD)

- <brief description of changes>
```

Use today's date. If the user provided a description, use that. Otherwise summarize from git diff or ask.

## 6. Compile

Run `npm run compile` and confirm it passes with no errors.

## 7. Run deploy-local.sh

Run `./deploy-local.sh`. This will:
- Clean old `.vsix` files
- Build a new `.vsix` with `npx @vscode/vsce package`
- Open Brave Browser to the Marketplace publisher page

## 8. Install locally (no Marketplace wait)

Install the freshly built VSIX directly into VS Code so the user gets the update immediately, without waiting for Marketplace approval:

```bash
code --install-extension corellm-<NEW_VERSION>.vsix
```

Then tell the user to **reload VS Code** (Cmd+Shift+P → `Developer: Reload Window`) to activate the new version.

> **Note:** This installs the extension for immediate local use. The Marketplace upload (step 7) is still needed for other users to receive the update.

## 9. Git commit & tag

```bash
git add -A
git commit -m "chore: bump to v<NEW_VERSION>"
git tag v<NEW_VERSION>
```

Do NOT push automatically — let the user confirm first.
