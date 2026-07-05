# Body dimension build — ⚑ judgment calls awaiting Dylan

> Appended by each build pass of the Body dimension (spec: `planning/dimension-body-build.md`).
> One line per call: what was decided and why. Blessing or veto happens in review — nothing
> here silently reinterprets the spec.

⚑ [P1a] Hold sets store `reps: 0` (LiftingBlock keeps required `reps`, no discriminated union) — 0 is the honest rep count for a pure isometric hold, and volume math (weightKg × reps) then contributes nothing by construction.
⚑ [P1a] Hold sets count toward per-pattern set counts + a new `holdSecByPattern` seconds aggregate, ZERO volumeLoadKg — inventing a load-equivalent for holds would be fabricated volume (spec-carried ⚑, recorded here for review).
⚑ [P1a] revealLifting: a hold-only session says "N s held" and drops the volume-load segment; any rep work (even 0 kg bodyweight) keeps the "kg volume load" figure exactly as before — "0 kg volume load" on a pure-hold session would read as no work done.
⚑ [P1a] On a hold set an EMPTY weight field = strict bodyweight (stored 0 kg added load); the rep-set rule is unchanged (weight must still be typed, 0 = bodyweight) — loosening the rep-set rule too would silently change existing validation behavior.
⚑ [P1a] breathwork + pt land on modality 'mobility' (spec-carried ⚑) — identity-level distinctness is what matters; 'mobility' is the nearest coarse engine bucket and nothing downstream needs a dedicated value.
⚑ [P1a] New-activity details: breathwork icon 'wind' / tags ['mindfulness']; pt label "PT" / icon 'heart-pulse' / tags ['recovery'] — label + tags deliberately avoid rehab*/rx*/therapy wording (FDA wellness naming rules, pt-model.md).
⚑ [P1a] headlineActivities filters deprecated ids even from a stored preference list, not just the defaults — a stale saved headline row can't resurface martial-arts in a picker.
