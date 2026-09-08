# Project Rules

This project is governed by the Universal Web Application Project Rules:
https://github.com/tpoirier1969/Web-App-Standards/blob/main/UNIVERSAL_PROJECT_RULES.md

## Non-negotiable universal rules

- `main` is the canonical application.
- Fix canonical source. Do not create patch, correction, override, hotfix, or runtime-repair layers as permanent fixes.
- Maintain exactly one authoritative application version source; all displays and release checks derive from it.
- Preserve existing user data and stable identifiers.
- Read the universal rules before modifying this project.

## Recipe Tracker specifics

- Canonical repository: `tpoirier1969/recipe_tracker`.
- Production: `https://tpoirier1969.github.io/recipe_tracker/`, published from `main` by GitHub Pages.
- `development` is the single persistent working branch. It is not a deployment or an alternate application.
- `backup/stable` is a rolling rollback pointer. Before merging a release candidate, move it to the current verified working `main` commit. Never develop on it.
- Complete developer-side validation on `development`, then merge through a pull request to `main`. Owner acceptance testing happens only on the canonical GitHub Pages deployment from `main`.
- The sole application-version literal lives in `version.js` and uses semantic `major.minor.patch` format. All asset cache keys, displays, and deployed-version checks derive from it.
- There is no build step. Run `node --test tests/*.test.mjs` before every release and perform a non-destructive production smoke test after GitHub Pages deploys.
- Supabase is the only writable recipe store. Do not use production recipes as disposable test fixtures and do not clear or reset the production library for testing.
- Recipe records live in `recipe_tracker_recipes`; new project-owned images live in `recipe_tracker_assets`. Preserve existing recipe IDs, stored data, and readable legacy-image references during changes.
- Client configuration is in `config.js`. Secrets belong only in protected Supabase configuration or Edge Function secrets, never in browser code or source control.
