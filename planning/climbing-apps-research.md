# Climbing Apps — Research (v0.1)

*Resolves the standing open item from `training-logging-spec.md` § Climbing ("deep dive into climbing apps before finalizing the climbing logging surface") and the Phase-4 backlog entries (Kaya / Crux / Toplogger / Mountain Project deep dive; Mountain Project import). Research run 2026-07-01; every load-bearing data-access claim below was adversarially fact-checked against live endpoints and current docs — several were corrected in the process, noted inline. Companion to `outdoor-integrations.md` (the adapter pattern + other sports) and `outdoor-sports-master-plan.md`.*

---

## The headline finding: the space already agrees

Indoor, outdoor, and board apps — fifteen of them — converged independently on the **same core ascent record**. That's the strongest possible signal for what our climbing surface should capture, because it's not one app's opinion; it's what climbers keep asking every app for:

- **Route reference** — name + gym/crag + optional canonical ID; for boards, identity = layout + holds + **angle** (explicit)
- **Grade as entered, with its system tag** — V / Font / YDS / French; never silently converted
- **Personal grade opinion beside the consensus grade** — two fields (TopLogger, 8a.nu's soft/hard flags); dissent is data, not vandalism
- **Style on two axes** — gear style (boulder / TR / lead / follow / solo) × outcome (onsight / flash / redpoint / pinkpoint / fell-hung / attempt) — the Mountain Project two-column model, and theCrag's richer version (hang dog, all-free-with-rest, retreat, **working**)
- **Attempts count** — with optional one-tap per-attempt logging (Stokt's "Quick Attempt" is the UX benchmark: one tap mid-session, reconciled at the send)
- **Quality stars + free-text comment**
- **Pitches** (outdoor routes) / **mirror flag** (boards) / **benchmark flag** (boards)

And training work converged separately, exactly the way `training-logging-spec.md` already guessed: **protocol as template, user logs only the variables** — protocol name, edge size (mm), added/removed weight (±kg), hang/rest durations, sets — plus session RPE (Lattice) and notes (Crimpd). Set-shaped atoms, housed under Climbing identity. The existing spec's instinct holds.

**The one place the current spec needs revision:** `training-logging-spec.md` says indoor bouldering is *session-level* logging ("logging every attempt would be hostile UX"). The market says climbers want **per-climb records with an attempts count, and optionally per-attempt taps** — KAYA paywalls attempt-logging and people pay for it; Kilter/Tension/Stokt all log per-attempt. The resolution is a ladder, not a fork: session envelope (always) → notable sends (cheap) → per-climb ticks (standard) → per-attempt taps (available, never required). Fidelity captures which rung was used. ⚑ Flagged for the surface-finalization decision, not applied here.

---

## Per-app read (what to borrow, what to refuse)

### Training apps

| App | Logs | Access | Take |
| :-- | :-- | :-- | :-- |
| **Crimpd** (free / $4.99mo+) | Per-workout vs a 200+ library; hangboard params live in the workout definition, user logs weight/effort/notes; workload minutes by category | CSV export **paywalled** behind Crimpd+ | Borrow: workload-by-category; protocol-as-template. Reject: peer comparisons; paywalling the user's own data |
| **Lattice** (£22.99/mo) | Per-workout against a prescribed adaptive plan; session RPE; standardized assessments (max hang @ 20mm) | **No export, no API** — data lives inside the plan engine | Borrow: RPE as first-class; a standardized assessment = a clean tier-1 benchmark Observation with frozen protocol. Reject: the entire adaptive-prescription posture |

### Gym / social loggers

| App | Logs | Access | Take |
| :-- | :-- | :-- | :-- |
| **KAYA** (free / PRO $9.99mo) | Per-climb sends + attempts, beta videos, sessions | CSV **import only** — no export, no API. A data cul-de-sac | Borrow: attempts-to-send as honest tier-2; import-any-CSV posture. Reject: **paywalling attempt history on unsent projects** — the clearest anti-pattern found |
| **Crux** (free) | Sends grouped into sessions; climbs carry grade/wall/setter/hold-drawing | **Best-in-class**: documented free API, any user self-generates a Bearer token in settings; webhooks | Borrow: self-service API token as the portability pattern we should *offer*, someday. No attempt records though |
| **TopLogger** (free, EU gyms) | Flash/redpoint checks, attempts, toprope-vs-lead, grade opinion vs gym grade | No official export. REST v1 is **dead** (verified July 2026 — empty 200s); unofficial GraphQL only. Fragile | Borrow: grade-opinion-vs-gym-grade dual record; climbs tied to an ephemeral gym set → freeze climb metadata at log time. Reject: gym leaderboards |
| **Vertical-Life / 8a.nu** | Per-ascent: type, attempts, grade proposal, quality, comment; gym + outdoor in one logbook | **Free self-serve CSV export of full logbook** (profile → edit → Logbook Export) — the de facto interchange format; theCrag and KAYA both import it | Borrow: the export exists at all; grade-proposal + quality + comment trio. Reject: 8a scorecard points/rankings — the original climbing leaderboard |

### Board apps

| App | Logs | Access | Take |
| :-- | :-- | :-- | :-- |
| **Kilter** (new app, post-Aurora split) | Per-attempt + per-ascent on climb@angle; perceived difficulty | **No API** (Keycloak + PowerSync); old logbooks recovered via JSON-upload form at kilterboard.io/claim (5–7 days) | The Aurora shutdown (Mar 2026) stranded logbooks mid-flight — the loudest possible vindication of freeze-at-log-time |
| **Tension (Aurora)** | Full per-ascent record incl. mirror flag | No official export, but **BoardLib** dumps the full logbook CSV with the user's own credentials — stable for years | Its 14-field CSV is the best convergent schema in the space — adopt nearly wholesale |
| **MoonBoard** | Per-ascent on fixed layouts; benchmarks | No export; BoardLib support actively decaying | Borrow: the benchmark concept (community-verified anchors). Reject: global ranking as the motivation loop |
| **Stokt** | Per-climb AND per-attempt ("Quick Attempt" one-tap) | No export; walls expire if the owner stops paying | Borrow: Quick Attempt UX. Reject: records held hostage to a gym's subscription |

**BoardLib** (MIT, active, v0.15.1 Mar 2026) is the tooling that matters: `boardlib logbook` → CSV `[board, angle, climb_name, date, logged_grade, displayed_grade, is_benchmark, tries, is_mirror, sessions_count, tries_total, is_repeat, is_ascent, comment]` for all Aurora boards, using only the user's own credentials. Kilter support died with the split; MoonBoard is flaky. Port the request flow to TypeScript if we ever want live pull — but **pin our parser to the CSV, not their endpoints**.

### Outdoor logbooks / route databases

| Source | Access | Take |
| :-- | :-- | :-- |
| **Mountain Project** | API dead since 2020, onX still declining requests (2026). **But per-user CSV tick export is alive** — verified live 2026-07-01, `/user/{id}/{name}/tick-export`, no auth gate at all | THE import path for US climbers: full tick history with grade, two-axis style, pitches, location path, canonical route URL. Scraping the route DB = DMCA risk (onX C&D'd OpenBeta in 2021) — don't |
| **OpenBeta** | GraphQL API at api.openbeta.io, free, **no key for reads**; all climbing content **CC0 public domain**; active (Jan 2026 release) | The only license-safe route reference DB. Stable UUIDs, multi-system grades, lat/lon. US-strong, international sparse — always allow freeform fallback |
| **@openbeta/sandbag** (npm) | MIT, TypeScript, zero deps, runs client-side — verified working (v0.0.55) | Grade parsing/validation/conversion (YDS↔French, V↔Font). Cross-discipline conversion deliberately disallowed; Font support has edge-case bugs — keep native string as the fact |
| **theCrag** | Own-logbook CSV/XLS export free. API content is **CC BY-NC-SA + negotiated ~50/50 rev-share** for commercial use; site 403s anonymous fetchers | Import format #2 (best for AU/EU; richest tick vocabulary survives in export). **Cannot** be our reference DB — the NC-SA license contaminates |
| **8a.nu** | Free CSV export (above); no API (staff-confirmed) | Import format #3 (EU sport/boulder) |
| **27 Crags** | Full-account JSON dump via GDPR-shaped self-export; no tick-specific export | Low-priority fallback import |

---

## Import strategy (all client-side, all gate-free)

1. **CSV parsers, one per format**: Mountain Project, 8a.nu/Vertical-Life, theCrag, BoardLib. Each row → one Observation, `source: import:{platform}`, original row frozen verbatim for audit. This is the food-logging fidelity story again: imported ticks are tier-1 self-reports with source-tagged fidelity.
2. **Route tagging**: resolve against OpenBeta when matchable (freeze the returned snapshot — consensus grade, lat/lon, UUID — onto the tick), freeform text otherwise. **Never block a log on DB coverage.**
3. **Grade handling**: native grade string = the tier-1 fact, always preserved. Normalized numeric score via sandbag = tier-2 derived, carries fidelity (circuit-color ranges = low). Personal grade opinion is its own field, not an overwrite.
4. **HealthKit envelope**: `HKWorkoutActivityType.climbing` gives session start/end/HR/energy — zero tick semantics (no bouldering split either). Pair the envelope Observation with tick Observations from the same session. Board/gym apps generally don't write climbs to HealthKit; envelope + app-native detail is the model.

## What we refuse (constitution check)

Scorecard points, global/gym leaderboards, CPR-style modeled performance ratings presented as achievement, percentile comparisons against a vendor dataset, paywalled access to your own history, wall-expiry-as-billing. Every one of these showed up in the research; every one is already forbidden by spine rules 2/5/8. The climbing community is *especially* saturated with ranking culture (8a.nu built the genre) — which makes the honest private logbook a sharper differentiator here, not a weaker one.

## ⚑ Decisions this research tees up (not made here)

1. **Finalize the climbing logging surface** — adopt the converged tick + the granularity ladder (session → sends → per-climb → per-attempt), which means revising `training-logging-spec.md` § Climbing's "session-level only" stance for indoor bouldering. Spec edit; bless first.
2. **Import scope for the first climbing pass** — recommend Mountain Project + 8a.nu + BoardLib CSVs (covers US outdoor, EU, boards); Crux API and theCrag CSV as fast-follows.
3. **OpenBeta as reference dependency** — CC0 kills the license risk; the residual risk is uptime/coverage, mitigated by freeze-at-log-time + freeform fallback. Recommend yes.
4. **Hangboard assessments as benchmarks** — a standardized max-hang protocol is a natural Benchmark (`benchmarks-spec.md`) with frozen protocol metadata; connects climbing training to the existing benchmark machinery rather than inventing anything new.
