# Contributing

1. Branch from `main` as `feat/<area>` (or `fix/<area>`).
2. Keep `src/game/sim` pure — see [AGENTS.md](AGENTS.md).
3. Run `pnpm lint && pnpm typecheck && pnpm test` before pushing; CI also builds, checks size
   budgets and runs the Playwright smoke tests.
4. Use [conventional commits](https://www.conventionalcommits.org/).
5. Open a PR describing what changed and how it was tested, with a screenshot or GIF and the
   Vercel preview link. PRs are squash-merged once CI is green.
