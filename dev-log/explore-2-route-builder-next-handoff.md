# Handoff — after Explore-2 (route builder)

*Written 2026-07-16. Predecessor: `dev-log/explore-2-route-builder-closeout.md`.
Branch `main`, HEAD `1bf3be2`, 34 commits ahead of `origin/main`, unpushed.*

## Start here — finish Explore-2's verification (the one gap)

Everything is green except the on-device smoke test, which needs setup this
session couldn't do:

1. **Add the Stadia key.** Create a free account at stadiamaps.com, get an API
   key, and put it in `~/Projects/health-coach/.env.local` (gitignored — copy by
   hand into any fresh worktree):
   ```
   EXPO_PUBLIC_STADIA_API_KEY=<key>
   ```
   Without it the builder still runs but **every snapped segment falls back to
   free-line** — so a real snap test needs the key first. (River uses keyless
   Overpass; free-line/paragliding need nothing.)
2. **Launch a dev build** (from `~/Projects/health-coach`, not `~/Claude Set up`)
   and run the smoke test:
   - Build a **snapped** route: Explore → "Build a route" → a foot/bike sport →
     drop 3–4 points → the line should follow trails/roads; label "along trails".
   - Build a **free-line paragliding** route: sport = Paraglide → straight
     segments, toggle shows "Free-line"; label "as plotted — trails may be longer".
   - Build a **river** route: sport = Kayak/Whitewater on a mapped river → the
     line snaps to the waterway; where no river is found it free-lines with the
     "no river found" caveat.
   - **Follow OFFLINE**: save a route, go to My Map, airplane-mode, open the route
     → the *line* renders from local geometry (basemap picture may be blank — tile
     caching was deferred this pass; that's expected, not a bug).
   - **Both save doors**: Explore "Build a route" (door 2) AND Training/Routes
     "+ New Route" (door 1, `build=1` deep-link). Confirm each saved route lands
     on My Map with the right element tint.
3. If all pass, the closeout's "Sim smoke test: NOT YET RUN" line can flip to done.

## Then — next roadmap item

Per the roadmap (map-reframe memory): after Explore-1 + Explore-2, next is
**Forecast-3 (windgram)** — unless Dylan redirects. Confirm scope before building.

## Watch-outs / open flags (from the closeout)

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

- Push without asking (34 commits sit local).
- Add a migration (016 is untouched; `kind`/`source`/Sections all ride JSON).
