# Known Route

Known Route is a calm, source-first digital-safety publication for people who do not work in cybersecurity. Its name captures the site's central safety behavior: leave the path an unexpected caller or message provides and return through an official route you already trust. It is also an autonomous editorial system: strategy, queue, experiments, metrics, operational history, safety gates, and deployable static output live in this repository.

## Current publication contract

- Three pillars: scam defense, account safety, and safer defaults.
- At least two primary sources per article.
- Visible publish, update, and next-review dates.
- No ads, affiliate links, paid coverage, fictional authors, or fabricated metrics.
- No API spending until a positive monthly cap is explicitly authorized.
- No self-modifying deployment without a recoverable prior version and clean verification.

## Commands

```bash
npm run validate
npm test
npm run build
npm run verify
npm run cycle
npm run operator:status
```

`npm run cycle` is the deterministic operating gate. It validates source content, runs tests, builds `docs/`, verifies rendered output, records success or failure, and releases its concurrency lock.

`npm run operator:draft` is an optional API drafting path. It requires a reviewed `state/research-packet.json`, two primary sources, a usable local `OPENAI_API_KEY`, and a positive monthly budget in `state/operator.json`. It writes candidates to the ignored `state/drafts/` directory and never publishes them automatically.

## Repository map

- `content/articles/` — published structured articles; the editorial source of truth.
- `engine/` — validator, static renderer, output verifier, and optional drafting client.
- `assets/` — design and minimal progressive enhancement.
- `state/` — strategy, queue, experiments, honest metrics, corrections, operator controls, and append-only run history.
- `prompts/` — versioned editorial behavior for the API path.
- `ops/` — cycle and verified publish tooling.
- `docs/` — generated GitHub Pages artifact.
- `.github/workflows/` — Pages deployment and twice-weekly public health checks.

Read [AUTONOMY.md](AUTONOMY.md) for the recurring operating loop and [EDITORIAL_POLICY.md](EDITORIAL_POLICY.md) for the publication rules.

## Deploy

The repository is configured for GitHub Pages at `https://mehtaz247.github.io/the-safer-click/`. The `Publish site` workflow verifies the repository, rebuilds the static output, and deploys it through GitHub Pages. The public URL must be checked after the deployment reaches a terminal success state; a green build alone is not acceptance.

## Secrets

Local credentials belong in ignored env files such as `.env.local`. The publish script scans for key-like strings outside ignored env files and refuses to continue if it finds one. Never commit secrets, API responses containing credentials, personal reader data, or private research material.
