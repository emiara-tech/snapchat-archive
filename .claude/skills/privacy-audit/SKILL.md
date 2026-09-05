---
name: privacy-audit
description: Independently audit Goodbye Chat against its own privacy charter and values, and write a dated verdict to .notes/privacy-audits/. Use when the user asks to run the privacy audit, check the values, ask "are we still local-first", verify the privacy policy is still true, or wants a baseline before shipping a feature that touches user data or a remote service.
---

# Privacy audit

You are auditing **Goodbye Chat** against the promises it makes to its users.

This app exists because its author did not trust a company with his teenage
memories. Every finding here is measured against that. The product's whole moral
claim is that it is different from the thing it is helping people leave — so a
privacy gap here is not a bug, it is a broken promise.

## Your stance

**Audit, do not reassure.** Your job is to find the gap between what the app
*claims* and what the code *does*. A clean report that missed a real leak is
worse than useless — it launders the problem.

Rules:

1. **Every verdict cites `file:line`.** A claim you did not verify against the
   source is not a finding, it is a guess. Say "not verified" instead.
2. **Never mark a claim UPHELD because it was upheld last time.** Re-run the
   check. The point of the time series is catching drift.
3. **Report inconvenient findings first.** If the most awkward finding is that a
   shipped feature contradicts the privacy page, that goes at the top.
4. **Do not fix anything during the audit.** Findings only. Fixes are a separate
   decision the author makes with the report in hand. Offer at the end.
5. **Intent does not count.** "Planned to be local" is BROKEN if it ships remote.
   Judge the code on `main`/`dev` as it stands, not the roadmap.

## The charter

These are the promises, phrased as testable claims. They are derived from
`.notes/VISION.md` (Principles), `CLAUDE.md` (Core Priorities), and the live
`src/views/PrivacyView.vue`. **This list is also the skeleton of the final
privacy policy** — a claim may only appear in the published policy while its
audit verdict is UPHELD.

| # | Claim (user-facing wording) | Where it comes from |
|---|---|---|
| C1 | Your archive never leaves your device. | VISION Principles; PrivacyView "How your archive is processed" |
| C2 | There are no accounts, analytics, telemetry, or crash reporting. | PrivacyView "What we collect" |
| C3 | Nothing persists after you close the tab — no localStorage, no cookies, no cache of your archive. | PrivacyView "Data retention" |
| C4 | No third party is contacted while you use the app. | PrivacyView "Third parties" |
| C5 | Exports are written to your machine; we never receive a copy. | PrivacyView "Exports" |
| C6 | Where remote compute is unavoidable, you choose it with full awareness. | VISION Principles ("Opinionated, not coercive") |
| C7 | Parsing never silently drops, misreads, or rewrites your data. | CLAUDE.md Core Priorities 1–2 |
| C8 | No personal archive data is committed to the repository. | CLAUDE.md Repo Boundaries |

## Procedure

Run every tier. Record the command output you relied on — a verdict without
evidence gets downgraded to "not verified".

### Tier 1 — Egress (C1, C4)

```bash
cd "$(git rev-parse --show-toplevel)"
# Direct network calls
grep -rnE "fetch\(|XMLHttpRequest|axios|WebSocket|sendBeacon|EventSource|navigator\.connection" src/
# Any absolute URL that will be requested at runtime
grep -rnoE "https?://[a-zA-Z0-9./_?=&%,:-]+" src/ index.html | grep -viE "w3\.org|schema\.org"
# Remote assets in HTML and CSS (fonts, CDNs, preconnect)
grep -rnE "@import|<link|preconnect|dns-prefetch|crossorigin" index.html src/**/*.css src/style.css 2>/dev/null
```

For each hit, classify: **user data out** (worst), **metadata out** (an IP and
User-Agent revealed to a third party by a font or CDN request — still a C4
break), **inbound asset only**, or **inert** (a link the user clicks, an XML
namespace, a `mailto:`).

A link the user deliberately clicks is not egress. A request the browser makes
on page load without asking is.

### Tier 2 — Persistence (C3)

```bash
grep -rnE "localStorage|sessionStorage|indexedDB|openDatabase|document\.cookie|caches\.|CacheStorage|showSaveFilePicker|OPFS|navigator\.storage" src/
# Service workers cache across sessions — check for registration and PWA plugins
grep -rniE "serviceWorker|workbox|vite-plugin-pwa|registerSW" src/ vite.config.ts package.json
```

Anything found here must be reconciled with C3's absolute wording. Note that a
service worker or a PWA plugin breaks C3 even if it never touches the archive,
because C3 promises the *session* ends with the tab.

### Tier 3 — Third parties and supply chain (C2, C4)

```bash
python3 -c "import json;d=json.load(open('package.json'));print('deps:',*d.get('dependencies',{}).items(),sep='\n  ')"
grep -rniE "analytics|gtag|googletagmanager|plausible|posthog|sentry|mixpanel|segment|hotjar|clarity|datadog|bugsnag" src/ index.html package.json
```

For each runtime dependency, answer: does it phone home, and does it ship user
data anywhere? Bundled data packages (e.g. `cities.json`) are fine — that is the
*good* pattern, a local lookup table replacing a geocoding API. Call it out as a
positive so the pattern gets repeated.

### Tier 4 — Truthfulness (the important one)

Read `src/views/PrivacyView.vue` in full. For **every sentence** that asserts a
fact about behaviour, find the code that makes it true or false.

This tier catches the failure mode that matters most: the policy page keeps
saying something after the code stopped doing it. A privacy page that is
*sincere but stale* is still a false statement to a user who trusted it.

Flag any sentence that is:
- **False** — the code contradicts it.
- **Overbroad** — true in spirit, too absolute as written ("no third-party
  scripts" while a third-party font request goes out on load).
- **Unverifiable** — asserts something the code cannot demonstrate.

### Tier 5 — Repo hygiene (C8)

```bash
git ls-files | grep -viE "^(src|tests|public|\.notes|\.claude)/" | head -40
git ls-files -- '*.zip' '*.json' '*.jpg' '*.jpeg' '*.png' '*.mp4' '*.mp3' '*.m4a' | head -40
git log --oneline --name-only -20 | grep -iE "export|archive|memories|chat_history|snap" | head
cat .gitignore
```

Confirm real archives and personal media are ignored, and that nothing personal
is already committed. Check `.notes/` too — it is tracked, and drafts there can
carry real names, transcripts, or media.

### Tier 6 — Consent and remote services (C6)

Only applies once any remote provider is wired in. Until then mark N/A, but
**still record the current stated position** so the drift is visible later.

If a remote provider exists in the code:
- Is the user told, before the first call, **which company** receives **what
  content**?
- Can they use the app fully without it?
- Is the provider on a vetted allowlist, or does the app accept any endpoint?
- Are privacy-preserving flags set by default (e.g. `enable_logging=false`,
  `store=false`)?
- Does any archive-derived content reach the provider, or only text the user
  authored in that moment? **These are very different promises.**

Two BYOK traps that no code can detect from an API key alone — the app must
disclose both rather than pretend to guarantee around them:

- **Google Gemini's free tier trains on input and permits human review**; the
  paid tier does not. Same key format.
- **xAI runs an opt-in program trading free credits for training rights.** A
  user who accepted it has training on.

Provider terms as verified 2026-09-05 — **re-verify, do not trust this table**:

| Provider | Trains on API data | Retention | Source |
|---|---|---|---|
| xAI | No, without explicit permission | 30d, ZDR in Team Settings | `docs.x.ai/developers/faq/security` |
| Anthropic | No, without express permission | ~30d, ZDR by agreement | `platform.claude.com/docs/en/manage-claude/api-and-data-retention` |
| OpenAI | No, opt-in only | up to 30d | `openai.com/policies/how-your-data-is-used-to-improve-model-performance/` |
| Google (paid) | No | limited, safety only | `ai.google.dev/gemini-api/terms` |
| Google (free) | **Yes**, plus human review | — | same |
| ElevenLabs | No, contractually | ZRM available | `elevenlabs.io/docs/eleven-api/resources/zero-retention-mode` |

### Tier 7 — Data fidelity (C7)

```bash
pnpm run test
```

Parser and archive tests are a privacy control, not just a correctness one:
silently dropping a chat rewrites someone's history. Note failures or thin
coverage on `src/lib/snapchatParsers.ts`, `snapArchive.ts`, `snapZip.ts`.

## Verdicts

Per claim, exactly one:

- **UPHELD** — verified true today, with evidence.
- **AT RISK** — true now, but something in the tree makes it easy to break, or
  the wording is more absolute than the code warrants.
- **BROKEN** — the code contradicts the claim.
- **N/A** — not yet applicable (nothing to audit).
- **NOT VERIFIED** — you could not check it. Say why.

Headline valuation, one word, from the worst claim:

- **SOUND** — all applicable claims UPHELD.
- **DRIFTING** — one or more AT RISK, none BROKEN.
- **COMPROMISED** — any claim BROKEN.

Do not invent a numeric score. The claim table *is* the score, and it stays
comparable across runs.

## Output

Write to `.notes/privacy-audits/YYYY-MM-DD.md`, using today's real date. Never
overwrite a previous audit — the series is the product. If a file for today
exists, append a second run with a time-stamped heading.

```markdown
# Privacy audit — YYYY-MM-DD

**Valuation: SOUND | DRIFTING | COMPROMISED**
Commit: `<short sha>` on `<branch>`
One-paragraph summary. Lead with the most inconvenient finding.

## Claims

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| C1 | ... | UPHELD | `src/lib/snapZip.ts:42` — ... |

## Findings

### F1. <Short title> — <claim(s) affected>
**What:** ... **Where:** `file:line` **Why it matters:** ...
**Options:** (do not pick one — that is the author's call)

## Changed since last audit
New, resolved, or regressed since the previous report. Omit on first run.

## Privacy policy status
Which charter claims are currently safe to publish verbatim, and which sentences
in `src/views/PrivacyView.vue` need softening or removal *today*.
```

Then tell the user the valuation, the top finding, and the report path. Offer to
fix — do not fix unasked.

## Building the privacy policy from this

When the author is ready to publish, the policy is assembled from audit history,
not written fresh:

1. Include only claims with a standing **UPHELD** verdict.
2. Narrow any claim that has ever been AT RISK to wording the code can carry
   permanently — prefer "the app makes no network requests except X" over "no
   third parties", because the first survives adding a font and the second does
   not.
3. Every absolute word — *never*, *nothing*, *no one*, *entirely* — must trace
   to a check in this skill. If no tier tests it, do not print it.
4. State remote services by name, with what is sent and what the provider's terms
   commit to. Link their policy; never claim a guarantee on their behalf.
5. Keep the reading level of the current page. It is short and plain, and that is
   a feature — a policy someone actually reads is worth more than one that is
   comprehensive and skipped.
