## Summary

<!-- Brief description of what this PR does and why -->

## Type of change

- [ ] Bug fix (`fix:`)
- [ ] New feature (`feat:`)
- [ ] Refactor / cleanup (`refactor:`)
- [ ] Documentation (`docs:`)
- [ ] Chore / tooling (`chore:`)

## Checklist

- [ ] `npm run compile` passes with no errors
- [ ] `npm run lint` passes with no new warnings
- [ ] New commands are registered in `package.json` → `contributes.commands`
- [ ] New settings are added to `package.json` → `contributes.configuration` and read in `getConfig()`
- [ ] All `CURRENT_VERSION` references updated (if version bumped): `extension.ts`, `tutorial.ts`, `package.json`
- [ ] `CHANGELOG.md` entry added (if user-facing change)
- [ ] No `.vsix` files committed to the repo
- [ ] No `any` types — use `unknown` with type guards or proper interfaces
- [ ] All disposables (timers, panels, listeners) are properly disposed
- [ ] Tested in Extension Development Host (`F5`)
