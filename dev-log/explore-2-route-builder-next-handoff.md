# Handoff — after Explore-2 (route builder) — CLOSED OUT

*Written 2026-07-16, superseded same day. Predecessor:
`dev-log/explore-2-route-builder-closeout.md`.*

## Status: done, not a live handoff anymore

This doc originally asked the next session to add a Stadia key and run the sim
smoke test. That happened later the same day: the key was added to
`.env.local`, the dev client was rebuilt, and all four builds (snapped, river,
free-line, both save doors, offline follow) were verified live — see the
closeout doc's updated "Sim smoke test" section for the full readout, including
a real bug found and fixed (`app/route/[id].tsx`'s `sourceLabel()` mislabeled
snapped/river routes as "Plotted"; fixed in `4b92b29`).

Separately, **Forecast-3 (windgram)** — this doc's "next roadmap item" — was
also completed and closed out the same day. Its own handoff prompt is in
`dev-log/forecast-f3-windgram.md` and is the current live handoff; read that
one, not this one, for what's actually next.

Everything from this pass through F3 was pushed to `origin/main` 2026-07-16 at
Dylan's request.

## Watch-outs / open flags (still live, carried forward)

- **Offline tile-pack is deferred** (⚑4 — MapTiler bulk-download terms; clean
  end-state self-hosted Protomaps). If/when built: `OfflineManager.createPack`
  keyed on a route's bbox; resolve the tile-terms question first.
- **Sections**: shape recorded in `core/src/route.ts` as a doc-note
  (`sections?: {name,startIdx,endIdx}[]`), NO UI built — lands migration-free when
  specced (open question E5).
- **Commercial scaling**: Stadia free tier is non-commercial. At launch, flip
  `EXPO_PUBLIC_ROUTING_URL` to a paid Stadia plan or a self-hosted Valhalla — the
  provider is abstracted so it's a config change, no app-code rewrite.
- **River clip** is best-effort (stitch + free-line fallback); interior-waypoint
  joins can kink a few metres (cosmetic, left intentionally).

## Do not

- Add a migration (016 is untouched; `kind`/`source`/Sections all ride JSON).
