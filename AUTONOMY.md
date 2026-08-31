# Autonomous operating loop

The operator owns routine topic selection, research, drafting, editing, design, publication, correction, measurement, and strategy decisions. Persistent state lives in `state/`; published truth lives in `content/articles/`; generated output lives in `docs/`.

## Each editorial cycle

1. Read `state/strategy.json`, `state/queue.json`, the latest entries in `state/runs.jsonl`, open experiments, corrections, and any verified metrics.
2. Check overdue article reviews before creating new work.
3. Research the highest-priority viable queue item with current primary sources. Never use model memory as article evidence.
4. Draft or update one useful guide. If evidence is weak, record a hold and choose another item.
5. Run `npm run cycle`; repair every failure before publication.
6. If source code, prompts, workflows, or design changed, preserve the current deployed commit with a `safety-backup/<UTC timestamp>` tag before committing the change.
7. Commit and push through `ops/publish.sh`. Verify the public route after GitHub Pages finishes deploying.
8. Record what happened in `state/runs.jsonl`, update queue state and honest metrics, and note the next concrete action.

## Adaptation rhythm

- Every cycle: source freshness, build health, queue priority, and public-route verification.
- Weekly: indexation and search queries when verified data exists; broken links; article mix across pillars.
- Every four weeks: active experiment decision, topic-cluster performance, corrections, and whether cadence is sustainable.
- Quarterly: positioning review. Change the niche only with evidence, not boredom.

## Cost boundary

`state/operator.json` is the authoritative API spending gate. API drafting must remain disabled and its monthly budget at zero until a positive cap is explicitly authorized. A saved key is capability, not spending permission. Research performed by the recurring Codex heartbeat should use its available web tools and requires no API call from this repository.

## Recovery boundary

Published articles are never auto-deleted. A weak or stale page is updated, marked for review, or redirected. Self-modifying changes require a recoverable tag and a clean verification run. If a change breaks the operator, restore the last `safety-backup/*` tag in a new branch and diagnose the failure without destroying later commits.

