# Plan: Improve auto-update

1. Add `corellm.updateCheckInterval` setting (hours, default 24)
2. Pass `context` to update checker for globalState persistence
3. Store `lastNotifiedVersion` to avoid duplicate notifications
4. Set up interval timer for periodic checks
5. Clean up timer on deactivation
