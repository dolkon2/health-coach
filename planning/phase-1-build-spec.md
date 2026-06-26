# Phase 1 Build Spec — The Minimum Useful Loop (v0.1)

*The first thing you can use daily for real. Everything in Phase 1 is in service of getting you logging weight and lifts against the existing engine, on your own device, this week.*

*Companion to `claude-md`, `product-overview.md`, `data-model.md`, `brand-kit.md`.*

---

## Goal

Ship an app to your own device that does this loop end-to-end:

1. You open it. You see today.  
2. You log a weigh-in (single number, takes 5 seconds).  
3. You log a workout (sets, reps, weights — no template needed yet).  
4. You can swipe over and see a smoothed weight trend and your weekly stimulus ledger.  
5. You close it.

That's it. No food yet. No HealthKit sync. No Garmin. No AI. No social. No fancy onboarding. Just the engine plus the two cheapest, highest-value inputs.

If this loop feels good — if you actually want to open the app the next morning — every later phase is downstream of confirming that. If it feels bad, no amount of features fixes it.

---

## What's in Phase 1

### Tabs

Two only. Today and Reflect.

(Training, Nutrition, Plan, and Cohorts arrive in later phases. The four-tab IA is the *destination*; Phase 1 is two-tab because that's all the data we have.)

### Screens

**Today**

- Date header (the user's local day)  
- Weigh-in card  
  - If logged today: show today's number \+ a one-line trend delta ("trend: 153.2 kg, ↓ 0.4 over 14 days")  
  - If not logged: a single tap-to-enter input  
  - Fidelity indicator (always 1.0 for manual weigh-ins, shown anyway for visual consistency)  
- Today's sessions list  
  - If logged: show modality, duration, RPE (if entered), and a "what this contributed" line drawn from the stimulus engine (e.g. "upper-pull · 16 sets · 4,200 kg volume load")  
  - If none: a single tap-to-add button  
- Active benchmarks (if any)  
  - User-written sentence, with the date pinned  
  - Tap to edit / archive

**Log Weigh-in** (modal from Today)

- Single number input (kg or lb based on user setting)  
- Optional body-fat % if you measure it  
- Save → returns to Today, weight appears

**Log Session** (modal from Today, or accessed from Today's "+" affordance)

- Pick modality (gym / run / ride / climb / paddle / hike / other)  
- Duration (auto-computed if you tap "start" / "stop", or manual entry)  
- For gym modality: a set logger  
  - Add exercise (free-text or pick from a small starter list)  
  - Tag movement pattern (required — this is what the engine needs)  
  - Sets table: weight, reps, RIR  
- For other modalities: lighter form — duration, distance if relevant, RPE  
- Notes field at the bottom  
- Save → returns to Today

**Reflect**

- Weight trend chart  
  - Last 90 days by default, scrollable back  
  - Smooth trend line \+ raw weigh-in dots  
  - Confidence band per the engine  
  - Display the inferred TDEE *only if* there's enough data; otherwise honestly say "needs more data" (don't fake a number)  
- Stimulus ledger  
  - Current week \+ 7 prior weeks, grouped by movement pattern  
  - Bar chart per pattern showing weekly volume  
  - Tap a pattern → drill into the sessions that contributed  
- That's it. No correlation step yet (that's the next engine piece per CLAUDE.md). No plateau forensics yet (no consultant yet).

**Settings** (top-right gear icon, not a tab)

- Units (kg/lb, km/mi)  
- Theme (dark default, light secondary)  
- Modality picker (Garmin-style add/remove — but Phase 1 ships with all enabled by default; the picker is a Phase 3 thing once ingestion forces choices)  
- Export data (JSON dump — important from day one; you own your data)

### What's explicitly out of Phase 1

- Food logging. (Phase 2.)  
- HealthKit / Health Connect / Garmin ingestion. (Phase 3.)  
- Workout templates / library. (Phase 4.)  
- Correlation step / benchmarks-as-mechanic / plateau forensics. (Phase 5.)  
- Plan / calendar tab. (Phase 6.)  
- AI consultant (Ask). (Phase 7.)  
- Cohorts / social. (Phase 8.)  
- Onboarding. Phase 1 is for you. You don't need an onboarding flow to use your own app. Add one only when someone else needs it.  
- Authentication. Local-only. No accounts.

---

## Engine wiring

The existing core/ modules are sufficient for Phase 1 with no new engine work:

- `observation.ts` — used as-is. Every weigh-in and session becomes an Observation.  
- `timeline.ts` — used as-is. Orders the day's view on Today.  
- `trend.ts` — used as-is. Powers the Reflect trend chart.  
- `expenditure.ts` — used *partially*. Without food data, TDEE can't be inferred. Reflect shows "needs intake data" honestly.  
- `stimulus.ts` — used as-is. Powers the Reflect ledger view.

The new code in Phase 1 is **all UI and storage**. No engine changes. This is the discipline: ship the engine you already have, on the cheapest possible loop.

---

## Storage

- SQLite via Expo SQLite (or WatermelonDB if reactive sync is preferred — but plain SQLite is simpler for Phase 1).  
- Schema mirrors `data-model.md` types.  
- Migration tooling set up from day one.  
- One-button JSON export accessible from Settings. (You own your data. Always.)

---

## Architecture (Phase 1\)

app/

  (expo router or react-navigation)

  screens/

    Today.tsx

    Reflect.tsx

    LogWeighIn.tsx

    LogSession.tsx

    Settings.tsx

  components/

    WeightTrendChart.tsx

    StimulusLedger.tsx

    FidelityIndicator.tsx

    SessionCard.tsx

  theme/

    tokens.ts         // brand-kit values as TS constants

    ThemeProvider.tsx

  storage/

    db.ts             // SQLite init \+ migrations

    observations.ts   // CRUD for Observation table

    benchmarks.ts     // CRUD for Benchmark table

  adapters/

    (empty in Phase 1; populated in Phase 3\)

core/                 // existing TS package, untouched

  src/

    observation.ts

    timeline.ts

    trend.ts

    expenditure.ts

    stimulus.ts

The `core/` package stays platform-agnostic. The `app/` consumes it through imports. No coupling.

---

## Acceptance criteria

Phase 1 is "done" when:

1. You can install the app on your iPhone (via Expo Go or a TestFlight build — your call).  
2. You log a weigh-in and a workout, close the app, reopen tomorrow, and they're still there.  
3. After 7+ weigh-ins, the Reflect trend shows a smoothed curve with a meaningful confidence band.  
4. After 4+ sessions in a week, the Reflect stimulus ledger shows volume by pattern.  
5. The visual language matches the brand kit. Dark mode is the default. The first time you see the app, it doesn't look generic.  
6. You actually want to open it the next day.

Number 6 is the only one that matters. The others are how you'd know.

---

## Open questions for Phase 1

- **Charting library.** Victory Native, react-native-chart-kit, or roll a thin custom SVG renderer? The custom path is more work but the brand-kit fidelity rules (dashed strokes, opacity by fidelity, confidence bands) are hard to retrofit onto a library that wasn't designed for them. Recommend custom from day one — it's the visual differentiator.  
- **Free-text exercise names vs. picker.** Phase 1 can ship with free-text \+ a small starter list. The full library is Phase 4\.  
- **Movement pattern tagging UX.** This is the one bit of friction in session logging that's non-negotiable for the engine to work. Worth thinking through how to make it feel like a fact about the exercise, not a tax on logging.  
- **iCloud / encrypted backup.** Local-only is fine for Phase 1, but losing 6 months of data to a phone wipe would suck. Maybe wire up encrypted iCloud backup of the SQLite file as a Phase 2 add. Decide later.

