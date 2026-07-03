# Morning smoke test — expenditure + nutrition benchmarks (built overnight)

*For Dylan, on-device or sim. Work top to bottom; anything that fails or feels
wrong, just note it — the fix session picks this file up. The overnight session's
own dev-logs list any ⚑ flags it left; skim those too.*

## 1 · Baseline TDEE (the cold-start)
- [ ] Open the profile/settings surface → enter height, age, sex (skip bodyfat first).
- [ ] A TDEE appears **with a range** and reads clearly as *predicted / the weak kind* —
      never a bare confident number.
- [ ] Add bodyfat % → the number updates and the **range tightens** (Katch–McArdle).
- [ ] Change activity level → number moves sensibly; still labeled predicted.
- [ ] Before entering metrics: honest empty state (no fabricated number).

## 2 · Fidelity tiers (capture method)
- [ ] Log a bare macro ("42g protein") → reads as **T1 / incomplete**.
- [ ] Log via describe → **T2**. (Photo also T2.)
- [ ] Log weighed or scanned → **T3**.
- [ ] The method/tier is visible on the entry and feels right, not noisy.

## 3 · Measured expenditure (will be data-starved — that's the test)
- [ ] The measured-TDEE surface says **"not enough data yet"** honestly (you don't have
      weeks of intake+trend on device). No fake number, no population fallback dressed
      up as measurement.
- [ ] Baseline still shows meanwhile, labeled predicted.

## 4 · Nutrition benchmarks (the family)
- [ ] Create a **cadence** benchmark ("log food 6 days/week") → Today card shows a
      day count; days with no/partial logs read as **unknowable (hazed)**, not missed.
- [ ] Create a **protein** benchmark — the target field comes **pre-filled with a
      suggestion but editable** (veto point #1: is pre-filled right, or should it be
      suggest-on-tap?).
- [ ] Create a **fidelity** benchmark ("80% at T2+") → it counts capture methods.
- [ ] Pin/unpin → Today updates; Reflect keeps all active as lenses.
- [ ] Reflect: nutrition lens recomposes the tab; rhythm bars show the three-valued
      days (hit / missed / hazed-unknowable).
- [ ] Energy-balance outcome exists but says not-enough-data (veto point #2: OK that
      it's visible, or hide until ready?).

## 5 · Regression sweep (the old stuff still works)
- [ ] Training benchmarks: gym-split card still counts sessions on Today.
- [ ] Weight chart still renders w/ dashed target line; benchmarks list intact.
- [ ] Log a meal the normal ways (search/describe/scan) — nothing regressed.

## 6 · Gut checks
- [ ] Nothing anywhere grades you (no red days, no celebration, no guilt copy).
- [ ] Nowhere does training *predict* the expenditure number.
- [ ] Copy passes the "mirror, not coach" sniff test.
