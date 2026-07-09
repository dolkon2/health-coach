# Sky Dimension — Research Track B: Session Shapes, Flight Detection, Gear Specs

**Date:** 2026-07-05
**Scope:** Schema + algorithm decisions (not UI) for the Sky dimension: Paragliding (XC/thermal), Hike & Fly, Speedflying, Parakiting. Tracks are `GeoPoint[] = {lat, lng, tsSec, eleM?}`. Ingest: IGC import (XC primary) + live phone GPS (everything else).
**Method:** 4 research questions, each researched from multiple angles, then adversarially verified (every load-bearing claim re-checked against independent sources; refuted claims corrected below and excluded from recommendations).

---

## 1. TL;DR — decisions

**Q1 — Parakite session shape: DECIDED (a) spot-session, with run-grouping kept derivable.** A parakite outing is a kitesurf-style spot session — park at a dune/site, fly dynamically for hours, with routine multiple ground↔air transitions (touch-and-gos, top-landings, beach kiting, repositioning). It is emphatically not one-launch-one-landing. One session owns a single continuous GPS track segmented into 0..n air segments interleaved with *active* ground segments. Snow/ski parakiting is community-real and run-shaped (the sport's first competition, Birday at Val d'Isère, is a timed ski+fly descent), so segments must be groupable into descent runs later — but no first-class lap entity is needed now. Honest session stats: total airtime, air-segment count, longest air segment, top speed. No swoop counter, no XC distance scoring.

**Q2 — Takeoff/landing detector: DECIDED — hysteresis state machine over 10 s moving averages of groundspeed + |vertical speed|, with asymmetric enter/exit thresholds, duration gates, and an activity-dependent ground-gap merge window.** Concrete recipe with cited parameter values in §3b (base numbers from igc-xc-score, corroborated by XCSoar, igc_lib, Flytec, Flymaster, Flyskyhy). Hiking separates cleanly from flight; **skiing provably does not** — ski descent (34.9 ± 13.6 km/h) sits exactly on the paraglider trim band and satisfies every published speed+vario flight condition, so ski-vs-air needs altitude-above-terrain (DEM) or a user tag. Detected boundaries are stored as editable indices on a retained raw track, never destructive trims — even Naviter ships a landing-confirmation UI because auto-detection can't be guaranteed.

**Q3 — Speedfly structure: DECIDED — flight is the atomic record; a session/day groups 1..N flights and derives run count.** Speedflyers think in laps/runs but log in flights: the community's own formal currency (USHPA SOP 12-02, verified against the primary PDF) is logged flights + flying days; every free-flight logbook product is per-flight with zero lap concept; no dedicated speedfly logging app exists anywhere. N ranges 1 (dawn hike & fly) to 40+ (lift-served resort laps at Valfréjus), and flight duration is bimodal (~1–3 min descents up to hours of speed-soaring) — don't hard-code either. Critically (verification overturned the first draft): lap volume is driven by **ascent mode** (lift/shuttle vs hike), *not* by the speedriding-vs-speedflying axis — model ascent mode as a session attribute, don't hard-code "speedriding = multi-lap."

**Q4 — Parakite gear: DECIDED — parakite wings live in the shared `wing` gear category with a handful of added fields; no new mandatory categories.** Key fields: control system type + pulley mixing ratio (nullable — one wing is a 2-liner), certification enum that includes `load-test-only (EN 926-1)` **and `CCC`** (competition class — verification caught this omission), optional weight range (Flare publishes none; sizing is wingload-based), and the same hours/trim-check tracking as paragliders — parakites detrim *faster* (Flare mandates 24 mo / 200 h checks; expert practice retrims ~every 50 h). Harness gets a subtype attribute (no-seat-plate norm), reserve is a separate optional item (often not carried at dune heights), skis are optional cross-linked gear.

---

## 2. Question detail

### Q1. Parakite session shape

**Decision: (a) spot-session** — one session per outing at a spot, containing 0..n airborne segments; degenerates gracefully to (b) one flight when there's a single air segment, and supports later (c) run-grouping on snow without schema change.

**Evidence (verified):**
- Community voice is uniformly spot-and-play: pilots "intentionally pull out of the lift band, dive down to almost ground level... and simply pop back up," fly "a few hours on the Albatroxx... back to back with the M-Pro 18m," "as long as the wind blows — sometimes for hours." Forum quotes verified verbatim via permalink re-fetch. ([paraglidingforum.com t=113584](https://www.paraglidingforum.com/viewtopic.php?t=113584), [parakiting.com dune soaring](https://parakiting.com/en/what-is-dune-soaring/), [Cloudbase Mayhem #226 — Flare inventor Benni Bölli](https://www.cloudbasemayhem.com/226-benni-bolli-and-the-art-of-flaring/))
- Multiple ground↔air transitions are core, *taught*, and *marketed*: "ground-to-air transitions" is a named curriculum skill ([flyparakite.com Dune du Pilat course](https://flyparakite.com/en/parakite-course-dune-du-pilat/)); "touch and goes, active riding without collapses, riding without taking off" ([speedflyingschool.com Parakite Week](https://speedflyingschool.com/parakiteweek/)); "Touch and gos are easier then ever" and wingtip fabric reinforced for "wingtip touches whilst soaring" ([speedflyingschool Moustache page](https://speedflyingschool.com/product/flare-moustache/), [flyaboveall.store](https://flyaboveall.store/products/flare-moustache)). Foot drags/waggas are *seconds-long* ground contacts at flying speed → detector needs hysteresis + minimum dwell so one flight doesn't fragment into dozens of micro-segments.
- Ground time is active practice, not pause: kiting in strong wind, ground handling, "riding without taking off" are first-class session content; Flare even sells a wing-killer accessory for standing on the ground in wind ([go-flare.com](https://go-flare.com/product/moustache2/), [speedfly.com/flare-moustache](https://www.speedfly.com/flare-moustache)).
- Multiple wings per outing is common (quiver + wind-band matching, kitesurf-style): "Most pilots who regularly fly low dunes... own at least two gliders and in many cases more than that," with mid-outing swaps — independently confirmed by [XCMag's Dutch dunes article](https://xcmag.com/fly-better/paragliding-techniques-paramotoring-skills/strong-wind-soaring-the-dutch-sand-dunes/). Casual outings are still often single-wing → wing attachment should be optional/multi, not required-multiple.
- Stats culture = airtime (the primary currency: "In one weekend at the coast, you often get more airtime than in an entire week in the mountains"), top speed (reviewers publish per-size stall/top-speed tables, e.g. Bandit 22: ~23–59 km/h → Bandit 10: ~37–88 km/h), proximity/energy management (qualitative, video-flexed). The community's own tracker app **Parakiter** ([parakiter.com](https://parakiter.com)) logs exactly: takeoff/landing segments, track, personal bests, running airtime total — no swoop counter, no XC distance. Strong independent confirmation of the derived-stat set.
- Not a thermal/XC discipline: Moustache "not made for thermal flying"; parakites concede distance performance ([xcmag Moustache review intro](https://xcmag.com/gear-guide/paraglider-reviews/flare-moustache-review-parakite/)). IGC import is irrelevant for parakite; live GPS is the ingest path.
- Conditions: laminar onshore wind onto the dune face is the gate; band ~15–20 km/h soaring minimum up to 40+ km/h; parakiting targets ~20–40+ km/h vs paragliding's ~5–25 ([paraglidingshop.com.au explainer](https://paraglidingshop.com.au/en-au/blogs/news/parakiting-vs-paragliding-what-is-the-difference-between-parakiting-and-paragliding)). Flare's wind-range charts split by **flat vs steep dunes** → terrain steepness modulates usable band. No standard numeric band-per-size table exists anywhere → free numeric wind fields, not enums.

**Refuted/corrected in verification:**
- ❌ *"Ski framing exists only in manufacturer copy; don't build any run model"* — **REFUTED.** Parakiting's first-ever competition is a ski-fly event: Birday, Val d'Isère 2025–26, organized by Leo Taillefer; Heat 1 is a *timed top-to-bottom ski+fly descent* ([xcmag coverage](https://xcmag.com/magazine-articles/watch-parakitings-first-ski-fly-comp/), [yowfly.com analysis](https://www.yowfly.com/2026/04/18/birday-how-a-new-competition-format-could-define-parakiting-as-a-sport/)). A Les Arcs school teaches parakite on snow as "go up, take off, repeat... chain multiple runs" ([speedriding-school.com](https://www.speedriding-school.com/en/learn-parakite/)). Corrected guidance: air/ground segments remain the atomic primitive (a ski-down IS a ground segment), but segments must be *groupable into descent runs* later — don't foreclose the derivation path. No first-class lap entity needed now (no evidence of everyday GPS lap instrumentation by recreational parakiters).

**Remaining unknowns:** typical touchdown/relaunch count per session (2 vs 20 — segmentation thresholds need tuning on real tracks); whether ground-kiting time counts as "session" for airtime accounting (recommend: show session duration and airtime as separate honest numbers); typical recreational session duration (only "hours," no numbers); no stats/leaderboard culture exists yet — this app would define the conventions first. Also note the naming hazard: "parakiting.com" is a Dutch *paragliding* dune school; the word is overloaded.

### Q2. Takeoff/landing detection thresholds

**Decision: shared detection module (one codebase for IGC import and live GPS — the XCSoar/SkyLines precedent), implemented as a hysteresis state machine over 10 s centered moving averages, with the parameter set in §3b.**

**Evidence — real numbers from real tools (all verified against primary source, most fetched at raw-code level):**

| Tool | Takeoff | Landing | Notes |
|---|---|---|---|
| [igc-xc-score `flight.js`](https://raw.githubusercontent.com/mmomtchev/igc-xc-score/main/src/flight.js) | 10 s MA: h > 5 m/s AND \|v\| > 0.9 m/s; sustain h > 1.5 AND \|v\| > 0.05 for 60 s | h < 2.5 AND \|v\| < 0.1 m/s for 20 s | Verbatim constants verified on two mirrors. Multi-launch/landing + hiking segments supported; `trim` option. |
| [XCSoar `FlyingComputer.cpp`](https://raw.githubusercontent.com/XCSoar/XCSoar/master/src/Computer/FlyingComputer.cpp) | speed ≥ Vmin/2 (PG ≈ 4.5–5 m/s) for 10 s | below takeoff_speed/2 for 30 s | AGL ≥ 300 m sustains flying regardless of speed (needs terrain). Landing threshold halved *specifically* to avoid ridge-soaring false landings. Fallback takeoff speed with no polar: 10 m/s. |
| [igc_lib](https://raw.githubusercontent.com/marcin-osowski/igc_lib/master/igc_lib.py) | groundspeed > 15 km/h, two-state Viterbi (0.9995 stay) | 300 s idle before landing declared | Ground touches < 5 min never split a flight (merge semantics). Battle-tested vs hundreds of thousands of IGCs. |
| [LK8000](https://raw.githubusercontent.com/LK8000/LK8000/master/Common/Source/LKProfileInitRuntime.cpp) | PG default 5 km/h for 10 s | counter decay to 0 | 5 km/h straddles walking pace — unusable as-is for hike&fly splitting; PG landing can lag by up to ~10 min (counter clamp 600). |
| Flytec 6030 (official Flytec AG manual V3.21) | GPS speed > 10 km/h **sustained 60 s** OR altitude delta ~**30 m** | speed < 10 km/h AND \|vario\| < 0.1 m/s for 60 s; records +1 min; pre-takeoff buffer retained | ⚠ Corrected in verification — see below. Flights < 3 min not logged. |
| [Flymaster GPS SD manual](https://dnl.flymaster.net/Flymaster%20GPS%20SD%20manual%20EN%20v3.pdf) | 3D fix AND speed > 8 km/h AND avg vario > ±0.15 m/s (baro) | — | Vendor moved from momentary 10 km/h to *averaged* 5 km/h ([xcmag](https://xcmag.com/news/flymaster-b1-nav-upgrades/)) — averaging is essential. |
| [Flyskyhy FAQ](https://flyskyhy.com/faq.html) | > 3 m/s (10 km/h) for ~10 s, **includes 30 s pre-roll** | — | Documents its own failure mode: strong-wind cliff soaring at near-zero groundspeed never triggers. Multi Flight mode = one log per flight; Hike & Fly mode = one continuous log. |
| [SkyDrop FAQ](https://paraglidingequipment.com/skydrop-faq/) | ±4 m baro altitude change | altitude stable for timeout | Baro-only recipe; ±4 m is inside phone-GPS vertical noise → portable to phones only via barometer. |
| [GliderSK USAGE](https://raw.githubusercontent.com/cedric-dufour/connectiq-app-glidersk/master/USAGE) | Start Speed | Stop Speed (enforced Start > Stop) | The anti-flapping hysteresis pattern to copy. |
| [Naviter](https://naviter.com/2022/10/landing-confirmation/) | glider: 50 km/h / 10 s; PG: unpublished "many more checks" | ships a landing-**confirmation UI** | Market leader admits reliable auto-landing detection is impossible → user-editable boundaries are industry practice, not a cop-out. |
| [XCTrack](https://www.fly-air3.com/en/support/air3-xctrack-manual/xctrack-manual/preferences3/) | user-adjustable takeoff speed | Automatic ("speed and lift") / Manual / Off; relaunch → new IGC | H&F comp guide sets takeoff = 1 km/h + detection OFF: the hike&fly community records everything and splits downstream ([hikeandfly.app](https://www.hikeandfly.app/docs-content/integrations/xctrack.html)). |

- **Batch = live precedent (corrected):** XCSoar's batch IGC analysis replays files through the *same* FlyingComputer (`DebugReplay.cpp` → `flying_computer.Compute(...)`); SkyLines consumes it via the Python bindings compiled from **`python/src/Flight/`** (`FlightTimes.cpp` does the detection) — *not* `test/src/AnalyseFlight.cpp` as first attributed (that's a sibling test binary; the shared-detector precedent holds, cite the right path). ([XCSoar python/src/Flight](https://github.com/XCSoar/XCSoar/tree/master/python/src/Flight), [skylines analysis.py](https://github.com/skylines-project/skylines/blob/master/skylines/lib/xcsoar_/analysis.py))
- **Noise handling:** every surveyed tool smooths before thresholding (10 s MAs, Viterbi stickiness, accumulation clocks) — none compares single fixes. Phone reality (peer-reviewed, dGNSS truth, ski slopes): median horizontal error 4.53 m, median speed error 0.52 m/s (~1.9 km/h), vertical error 2–5× horizontal ([PLOS One](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0327896)). Consequences: speed thresholds below ~5 km/h are unreliable on phones; GPS-only vario thresholds under ~±0.5 m/s are fabrication — use the phone barometer for the vertical co-condition where available.
- **What speed genuinely cannot discriminate:** (1) **Skiing vs flying** — recreational skiing averages 34.9 ± 13.6 km/h (advanced 44.5) ([ScienceDirect, 4,164 obs](https://www.sciencedirect.com/science/article/pii/S2772696723000145)), exactly on the paraglider trim band (35–45 km/h) and inside the speedwing band; descending ski slopes also produce |vertical| > 0.9 m/s, satisfying igc-xc-score's flight trigger (its own author names "a car climbing a twisty mountain road" as a confounder). No open-source ski-vs-air segmentation exists anywhere (verified by exhaustive GitHub/web search). Disambiguators: altitude-above-terrain vs DEM, or user tag. Whether DEM-AGL reliably separates *speedriding* (flying 1–30 m over steep slopes, within combined DEM+GPS vertical error) is unproven — honest fallback is the user tag. (2) **Strong-wind ridge soaring at near-zero groundspeed** — defeats speed-only landing detection; the vario AND-condition plus a long dwell is what saves it (Flytec/XCTrack/XCSoar all use it).
- **Hiking separates cleanly:** 3–7 km/h (0.83–1.94 m/s) sits below the 2.5 m/s ground ceiling and far below the 5 m/s flight trigger; hiking |vario| fails the 0.9 m/s co-condition. Naismith's rule (~5 km/h flat) confirms the ascent rarely false-fires a 10–12 km/h sustained threshold; residual risk is downhill jogging — which the vertical co-condition rejects.

**Refuted/corrected in verification:**
- ❌ *Flytec 6030 defaults "10 km/h (instantaneous) / 20 m"* — **REFUTED.** The official Flytec AG manual (V3.21) + firmware release notes say: speed > 10 km/h **sustained ≥ 60 s**, OR altitude difference **~30 m** (up or down, within ~60 s). The 20 m figure came from a Flytec USA rewrite. The 60 s debounce and 30 m delta are the load-bearing values.
- ❌ *`test/src/AnalyseFlight.cpp` is the SkyLines binding* — corrected above (pattern holds, path was wrong).
- ⚠ LK8000 minor corrections: the AGL<300 glider branch *gates* decay rather than accelerating it; "5 km/h below hiking speed" overstated — walking speeds straddle it (conclusion unchanged: unusable for hike&fly split).

**Remaining unknowns:** XCTrack's shipped default takeoff speed; Naviter's actual PG criteria (unpublished); Flymaster's averaging window length; Skytraxx/Syride exact numbers (manuals publish behavior, not thresholds); igc-xc-score's 0.05 m/s stay floor was designed for baro-quality IGC data — its robustness on phone-GPS elevation is untested and may need a larger floor or baro substitution; Expo/phone barometer API characteristics (sampling, latency) on iOS/Android not established.

### Q3. Speedflying session structure

**Decision: flight = atomic record (one launch → one landing, own GeoPoint[] track); session/day = grouping of 1..N flights at a site with derived run count, cumulative vertical, top speed. N=1 must be the frictionless default. No first-class lap entity.**

**Evidence (verified):**
- Community genuinely thinks in laps — "take the lift up and do laps," "spin laps in Mineral Basin all day," "lapping and tens of thousands of vertical a day" (all three quotes verified verbatim; independent corroboration: Kronplatz "more than 10 flights a day... a lot of laps on the same line," NZ school "5+ flights in during a day's training"). ([paraglidingforum t=72660](https://www.paraglidingforum.com/viewtopic.php?t=72660), [wasatchmag.com](https://wasatchmag.com/salt-lake-speed-riders/), [newschoolers thread](https://www.newschoolers.com/forum/thread/638266/First-Speedriding-Speedflying-School-in-California))
- But they *log* in flights: **USHPA SOP 12-02 verified against the primary PDF** — Mini-Wing 1 = ≥25 logged flights; M2 = 250 flights, 5 flights at 5 sites, ≥20 flights with ≥1,000 ft descent each, ≥5 different wings, ≥80 flying days ([rgsa.info SOP mirror](https://www.rgsa.info/documents/USHPA/ushpa-pilot-proficiency-system.pdf), [southwestairsports.com mirror](https://www.southwestairsports.com/faqs-tips/USHPA/SOP-12-02.pdf)). Note M1/M2 are Special Skill endorsements on a P2–P5 rating, not standalone ratings. The M2 spec incidentally tells you what the schema must derive: per-flight vertical descent, distinct-site count, distinct-wing count, flying-day count.
- Every incumbent logbook is per-flight with no lap concept: Gaggle (its Auto Start Recordings feature handles a multi-lap day by producing *separate flight logs*), Wingman (month/year grouping only), Rogallo (monthly/yearly flight counts). Flight count is the headline stat. ([flygaggle.com](https://flygaggle.com/), [Wingman](https://apps.apple.com/us/app/paragliding-tracker-wingman/id1563883190), [rogallo.app](https://rogallo.app/RogalloFlightLog/))
- No dedicated speedfly/speedride logging app exists (verified via app-store API queries, EN+FR searches, community archives — zero counterexamples). Strava has no air-sport type at all ([supported sports](https://support.strava.com/en-us/articles/15402005-supported-sport-types-on-strava), open [feature request](https://communityhub.strava.com/t5/ideas/add-activity-type-free-flying-skydiving-paragliding-hang-gliding/idi-p/5951)); Garmin has no free-flight profile; XContest requires G-record IGCs and has no speedfly class. The nearest run/lap products are ski trackers (Slopes, Ski Tracks) with beloved auto lift/run detection — but no evidence speedriders actually use them. Tracking culture is GoPro-video-centric (Pulse.tv = telemetry overlay for video, not a logbook).
- The wingsuit analog (BASEline/FlySight) is also one-record-per-descent with cross-descent profile comparison instead of session grouping ([baseline.ws/help](https://baseline.ws/help)).
- Competition precedent for the run unit exists (Speed Flying Pro Les Arcs: timed run down a fixed line), reinforcing run-as-derived-grouping.

**Refuted/corrected in verification:**
- ❌ *"N ranges 1 to 15–20"* — **REFUTED upper bound.** Valfréjus officially advertises up to **40 rotations/flights per day** off its fast chairlift. Don't cap or size UI around ~20.
- ❌ *"Typically ~2 minutes top-to-bottom"* — **overstated.** Duration is bimodal: ~1–3 min small-hill descents, 10–20+ min big-alpine descents, and *hours* of speed-soaring on the same wings (the claim's own source says so). Schema must tolerate sub-minute to multi-hour flights.
- ❌ *"Speedriding vs speedflying changes session volume"* — **REFUTED as a causal axis.** The Wasatch quote was about ski-launch riders (US speedriding is tour-constrained after resort bans); European summer *foot-launch* speedflying is gondola-lapped. Volume is a function of **ascent mode + site access/regulation**, orthogonal to ski-vs-foot launch. What *does* differ by discipline (confirmed): a speedriding run may alternate on-snow ski segments and airborne segments within one descent (touch-and-go on skis); a foot-launch speedfly run is one continuous airborne descent. So: ascent mode = session attribute; within-run ski/air segmentation = capability of the segment model (same primitive as parakite).
- ⚠ One cited page (speedfly.com/learn-to-speedfly) does not actually contain the flight-count figures attributed to it; the USHPA numbers stand on the SOP PDFs instead.

**Remaining unknowns:** whether a mid-run ski touch counts as one run or two in pilots' heads (recommend: re-*ascent*, not mere ground contact, ends a run); what fraction of speedflyers log anything; whether European speedriders use ski apps for lap counts; recreational (non-school) runs-per-day median.

### Q4. Parakite gear spec fields

**Decision: parakite wings share the `wing` gear category. Add: control-system fields, wingload-first sizing, a certification enum with `load-test-only` and `CCC`, optional wind range, optional line material. Hours/trim tracking ON, same fields as paragliders. Harness subtype attribute; reserve optional; skis cross-linked.**

**Evidence (verified, largely from primary sources — official Moustache 2 manual PDF text-extracted, manufacturer spec tables fetched):**
- **Market is multi-brand (12+):** Flare (Moustache/Moustache 2, Bandit, Prop, Line), Flow (Mullet/Mullet 2/Mullet X, Albatroxx), Dune Rider (Hopper, Scraper), Little Cloud (La Mouette), Level Wings (Fuze, Fierce), Dudek (Touch), Ozone (Vapor), Niviuk (Jester), U-Turn (Razorblade), Swing (WAVE RS), Vril (Raptor, Crank), Windtech (Dune, Hydro) — every one independently confirmed on manufacturer/retailer sites. Plus universal **kiterisers** (Infexion, Little Cloud KiteRisers) that convert any standard paraglider → the kiteriser can be its own gear item paired with a standard wing. Free-form brand/model, not an enum. ([Kälin multi-brand review](https://speedflyingschool.com/2025/06/11/parakite-review-by-beni-kalin-speedflyingschool/), [infexion.eu](https://infexion.eu))
- **Manufacturer-published spec superset** (verified verbatim from the [official Moustache 2 manual PDF](https://go-flare.com/wp-content/uploads/sites/2/2026/03/MOUSTACHE2-Manual-en.pdf) + [Flow Mullet 2 table](https://www.flowparagliders.com.au/product/mullet-2/)): size/flat area (primary ID), projected area, cells, flat span, max chord, flat + projected AR, glider weight, materials, wind-range charts. Moustache 2 exact: 13/15/18/22/26 m², 52 cells, flat AR 5.1–6.0, projected 11.14–22.28 m², 3.0–4.9 kg.
- **Weight range is weak; wingload is the operative number.** Flare's tech table has NO takeoff-weight row; sizing is a wingload matrix (takeoff kg ÷ flat m²) with behavior bands: 3–3.5 flies like a normal PG, 3.5–4.5 sports, 4.5–5.5 miniwing, 5.5–6.5 speedflyer, >6.5 tiny speedflyer. Flow publishes a nearly constant 50–120 kg for five of six sizes (no information). Keep the field optional, labeled *manufacturer-recommended* (not "certified"), and derive `wingLoading = takeoffWeightKg / flatAreaM2`.
- **Control system is a real spec with a quantifiable value:** system type (kiteriser/pitch-control vs standard PG risers) + brake mixing ratio. FLARE System = pulley matrix on B/C mixed into brakes, C at 1/3 and B at 1/6 of brake travel (manual, verbatim); competitors: 1:4 (Fuze — no bottom pulley), 1:5 (Line, Albatroxx, Mullet 2, Jester — the *modal* value), 1:6 (Moustache 2, Bandit — the FLARE reference standard), 1:9 (La Mouette — confirmed by Little Cloud's own page); Vril Crank is a 2-liner → **ratio must be nullable**. Higher ratio = stall at deeper brake travel with *more* progressive warning.
- **Hours/trim tracking: YES, and more urgent than PG.** Flare mandates a check at **24 months OR 200 flight hours** (whichever first), sooner with sand/salt exposure (manual, verbatim); deep-stall-from-porosity warning present. Expert practice: retrim ~every **50 h** — kiteriser pulley cords shrink up to 10%, Dyneema > Kevlar, and A-only loading leaves B/C slack (Kälin; echoed on forums; also A-riser stretch under G-load contributes). Line material (sheathed Dyneema vs unsheathed Kevlar/aramid) correlates with detrim rate → optional field that feeds check-interval features.
- **Certification:** Moustache 2 is EN 926-1 only ("underwent only a shock- and load test" — verbatim; 'LOAD TESTED ONLY' is literally the standard-mandated label text). Verified only for Flare — other brands' parakites unchecked, some may pursue EN.
- **Harness:** manual permits "all certified harnesses of the GH type (harnesses without solid cross-bracing)" — standard no-seatboard PG harnesses. Flare's parakite harnesses: Contour (unisize, EN 1651, PERMAIR LTF 91/09 protector **included as standard** — verification corrected "optional"; certification is EN 1651 alone, +LTF 91/09 when flown with protector; accepts reserve installation) and Proxy (S/M/L, EN 1651/2018, 120 kg, non-certified foam buffer, no reserve container). Community norm: no seat plate. → subtype/attributes on the existing harness category: style, protector type + certification, reserve-capable y/n.
- **Reserve: optional in practice.** "Due to the low heights commonly used in parakiting, a reserve may not always be effective"; Parakite Week: not required, recommended only for high-altitude practice ($10/day rental); DHV's parakite insurance conditions require *no* rescue device. Yet Flare's manual still references rescue-chute attachments/deployment → separate optional gear item, attachable per session, never assumed.
- **Snow:** first-class intended mode (manual cover: "SOARING | SPEEDFLYING | SNOWKITING"; 5 snow loops sewn into the sail; harnesses marketed for snowkiting; schools specify freeride skis 105–120 mm + touring bindings + avalanche kit). No evidence anyone *logs* ski hours → cross-link to existing ski gear entities, no new mandatory category. Prohibited uses worth surfacing in gear notes: flying in rain/snowfall, kitesurfing on water.

**Refuted/corrected in verification:**
- ❌ *Certification enum {EN-A..D, load-test-only, uncertified} "covers paraglider + parakite wings"* — **REFUTED.** **CCC** (CIVL Competition Class, e.g. Ozone Enzo 3) is a real category that is none of those. Enum: `{EN-A, EN-B, EN-C, EN-D, CCC, load-test-only (EN 926-1), uncertified}`. Harness certification (EN 1651) is a separate field on harness gear, not a wing enum value.
- ❌ *Contour protector "optional"* — **corrected:** included as standard (delivered as a complete system; no protector-less variant).
- ⚠ Moustache 2 wingload matrix decodes to implicit per-size spans (13/15 ≈ 50–120, 18 ≈ 55–120, 22 ≈ 65–120, 26 ≈ 80–135 kg) and the manual does prohibit flying outside recommended min/max — "no weight range" means *not published as a spec row*, not "no limits."

**Remaining unknowns:** whether other manufacturers mandate Flare's 24 mo/200 h cadence (their manuals unfetched); the 50 h retrim figure is one expert's advice (who designed the Moustache — manufacturer-adjacent), not policy; Proxy reserve-container option unconfirmed; per-size numeric wind ranges live only in image charts; Ozone Vapor release status/specs; whether skis are ever community-logged.

---

## 3. Schema consequences

### (a) Flight/session record shape per activity

One shared segment-based model, parameterized per activity:

```
SkySession {
  id, activity: 'paragliding' | 'hikeAndFly' | 'speedflying' | 'parakiting',
  startTsSec, endTsSec, spotId?,             // spot = launch/dune/resort
  track: GeoPoint[],                          // RAW, retained forever; never trimmed destructively
  trackSource: 'igc' | 'liveGps',
  segments: Segment[],                        // ordered, derived, EDITABLE
  gearRefs: GearUse[],                        // 0..n; parakite allows multiple wings, per-segment optional
  conditions?: { windSpeedKmh?, windDirDeg?, spotAspectDeg?, notes? },   // free numeric, no enums
  userTags?: [...]
}

Segment {
  kind: 'air' | 'ground' | 'hike' | 'lift',   // ground is ACTIVE by default (kiting ≠ pause)
  startIdx, endIdx,                            // indices into track (Flytec pre-buffer precedent)
  provenance: 'auto' | 'userConfirmed' | 'userEdited',   // honest-data: detected, not asserted
  runGroupId?                                  // nullable; groups segments into a descent run (ski parakite / speedriding) — derivable later, no schema change needed to start
}
```

Per-activity mapping:
- **Paragliding (XC):** typically 1 air segment; IGC import trims to launch/landing via the detector with the *large* merge window; XC stats (distance, duration, alt gain) computed over the air segment. `Flight` view = session with one air segment.
- **Hike & Fly:** ONE session, one continuous track, segments = hike + air(+hike) (the Flyskyhy Hike & Fly model; the H&F comp community records everything and splits downstream). Hike stats (ascent, time) and flight stats come from segment kinds. The hike/flight boundary is user-visible and editable.
- **Speedflying:** flight = atomic record ⇒ each air segment (with its run-up/pre-roll) materializes as a Flight child record; the session derives `flightCount` ("runs"), cumulative vertical, top speed, plus rating-relevant rollups (per-flight vertical drop, distinct sites, distinct wings, flying days — the USHPA M2 field set). `ascentMode: 'hike' | 'lift' | 'shuttle' | 'tour'` is a **session attribute**, not implied by discipline. Speedriding runs may contain ski(ground)+air alternation within one `runGroupId`.
- **Parakiting:** session-wide stats over 0..n air segments: `totalAirtimeSec`, `airSegmentCount`, `longestAirSegmentSec`, `topSpeedKmh`, and session duration shown separately from airtime. No swoop counter, no XC-distance scoring. Multiple wings per session supported via `GearUse[]` (existing quiver primitive). Snow sessions get `runGroupId` derivation when ascent/lift cycles are detectable.

### (b) Takeoff/landing detector — recommended algorithm

**Shape:** one shared module for IGC import and live GPS (XCSoar/SkyLines precedent — same code, same constants for both paths). Hysteresis state machine `GROUND ⇄ AIR` over **10 s centered moving averages** of horizontal speed `h` (m/s) and vertical speed magnitude `|v|` (m/s, from barometer when available, else GPS elevation with a widened floor). Never compare single fixes.

**Parameters (base = igc-xc-score, verbatim-verified; adjustments cited):**

| Parameter | Value | Source/justification |
|---|---|---|
| Smoothing window | 10 s centered MA | igc-xc-score `maPeriod`; every surveyed tool smooths |
| AIR trigger | `h > 5 m/s (18 km/h) AND |v| > 0.9 m/s` | igc-xc-score `definitionFlight {xt:5, zt:0.9}`; the AND rejects downhill jogging; 18 km/h clears hiking and phone speed noise (0.52 m/s) with margin |
| AIR confirm | sustain `h > 1.5 AND |v| > 0.05` for 60 s | igc-xc-score `{x0:1.5, z0:0.05, t:60}`; on phone-GPS-only vario, raise the 0.05 floor to ~0.3–0.5 (PLOS One noise data) or use baro |
| Takeoff OR-path | cumulative altitude departure > ~30 m from pre-trigger baseline within ~60 s | Flytec 6030 official manual (corrected value); catches strong-wind ridge launches at near-zero groundspeed (Flyskyhy's documented failure mode) |
| GROUND trigger | `h < 2.5 m/s AND |v| < 0.1 m/s` sustained 20 s | igc-xc-score `definitionGround`; hysteresis (2.5 < 5) is the GliderSK start>stop pattern; the vario AND is what keeps slow ridge soaring airborne (Flytec/XCTrack) |
| Landing dwell floor | don't declare landed from a brief lull; XCSoar uses 30 s below half takeoff speed | XCSoar `CheckLandingSpeed(takeoff_speed/2)` — threshold halved *specifically* for ridge/wave soaring |
| AGL override | if DEM available and AGL ≥ 300 m → sustain AIR regardless of speed | XCSoar `CheckAltitudeAGL` |
| Pre-roll | keep 30 s ring buffer before the trigger; boundaries are indices into the retained raw track | Flyskyhy 30 s pre-roll; Flytec 27-point pre-buffer — detection fires late by design |
| Post-roll | extend air segment ~60 s past landing instant | Flytec records +1 min |
| Junk filter | discard auto air segments < 60 s (surface for confirmation rather than silently keep) | Syride <1-min auto-delete; Flytec doesn't log <3 min flights |
| **Merge window (activity-dependent — the key insight)** | XC trim / hike&fly: merge ground gaps < **300 s** into one flight (igc_lib `min_landing_time`). Parakite / speedfly touch-and-go: keep gaps ≥ **20–60 s** as segment boundaries (igc-xc-score 20 s ground; XCTrack new-IGC-per-relaunch); sub-20 s contacts (foot drags, waggas, ski touches) never split | igc_lib vs igc-xc-score divergence is precisely this parameter |

**Edge cases:**
- *Ridge soaring near stall / into wind:* handled by the vario AND-condition + dwell + AGL override + takeoff OR-path — never by lowering speed thresholds.
- *Touch-and-go:* handled by the merge window, not thresholds. For speedfly run counting: a new **run** starts on re-*ascent* (sustained climb / lift segment), not on mere ground contact.
- *Ski vs air (speedriding, snow parakite):* **not solvable by speed+vario** — skiing satisfies every published flight condition. Use DEM AGL where the margin exceeds combined DEM+GPS vertical error; otherwise fall back to activity context + user tag, and mark such segments' provenance accordingly. Do not fabricate a discrimination the data can't support.
- *Phone noise:* thresholds < 5 km/h are unreliable (1.9 km/h speed noise floor); GPS-only |vario| tests < ±0.5 m/s are noise — require the baro or widen floors.
- *Honesty rule:* all detected boundaries are `provenance:'auto'` and user-editable (Naviter ships a confirmation UI; the H&F comp community turns auto-detection off entirely). Auto-detection proposes; it never silently asserts.

### (c) Speedfly run/lap modeling

- **No lap entity.** `Flight` (atomic, own track slice) + `Session` (day-at-site container) + derived `runsCount = flights.length`.
- `ascentMode` on the session ('hike' | 'lift' | 'shuttle' | 'tour') — the real driver of volume; never inferred from speedriding-vs-speedflying.
- Support 1..40+ flights/session (Valfréjus) and flight durations from <1 min to hours (speed-soaring) — no assumptions baked into detection or display.
- Speedriding: allow ski(ground)/air alternation *within* one flight's run via segments sharing a `runGroupId`; re-ascent closes the run.
- Session rollups: flight count, cumulative vertical, top speed, longest flight — plus the USHPA-derivable set (per-flight vertical drop ≥1,000 ft flag, distinct sites, distinct wings, flying-day count) since that's the community's only formal logging currency.

### (d) Parakite gear spec fields

On the shared `wing` category (all optional unless noted):

```
wing: {
  brand, model, sizeLabel,            // required-ish; free-form (12+ manufacturers)
  flatAreaM2,                         // primary size identifier
  projectedAreaM2, cells, flatSpanCm, maxChordCm, flatAR, projectedAR, gliderWeightKg,
  certification: 'EN-A'|'EN-B'|'EN-C'|'EN-D'|'CCC'|'load-test-only (EN 926-1)'|'uncertified',
  recommendedWeightRangeKg?: {min,max},        // optional; labeled RECOMMENDED not certified
  controlSystem?: { type: 'standard'|'kiteriser', name?, brakeMixRatio?: number|null },  // null for 2-liners
  lineMaterial?: 'sheathed-dyneema'|'unsheathed-aramid'|...,   // feeds retrim-cadence hints
  windRange?: { minKt?, maxKt?, note? },       // free numeric; manufacturers publish image charts only
  // maintenance (same fields as paraglider wings, tracking ON):
  hoursTotal (derived from sessions), lastCheckDate, lastTrimDate, checkIntervalNote
}
derived: wingLoading = sessionTakeoffWeightKg / flatAreaM2   // the operative parakite sizing number
```

- **Kiteriser** as its own gear item type (Infexion/Little Cloud convert standard PGs) pair-able with a standard wing.
- **Harness:** existing category + `{style: 'loop-strap'|'seat-shell'|'standard-pg'|'pod', protectorType?, protectorCert?, reserveCapable?: bool, cert?: 'EN 1651'...}`.
- **Reserve:** existing (shared with paragliding) category; optional per-session attachment; never assumed for parakite/speedfly.
- **Skis/board:** no new category — cross-link to ski-sport gear entities when present (the 17-sport quiver primitive already covers this).
- Maintenance defaults for parakite wings: check due at 24 mo OR 200 h (Flare policy), with a soft "consider retrim" nudge configurable around ~50 h — descriptive nudge, never prescriptive (constitution clause 1).

---

## 4. Flagged for Dylan ⚑

1. **⚑ Parakite merge window (touch-and-go split threshold).** Evidence gives a defensible *range* (keep ground gaps ≥ 20–60 s as segment boundaries; never split under 20 s) but no community-quantified touchdown counts exist — 2 vs 20 air segments per session is unknown. Ship 30 s as the default and tune on your own dune tracks? Your call on the starting value, since you'll be the first real user.
2. **⑀⚑ Ski-vs-air fallback UX.** Speed+vario provably can't split skiing from flying, and DEM-AGL is unproven on steep slopes. Options: (a) user tag per session ("this was on skis") that switches the detector to DEM/tag mode, (b) always-ask on ambiguous segments, (c) leave ski parakite/speedriding segments unclassified (honest-absent). Recommendation is (a)+(c), but this touches your honest-data philosophy directly.
3. **⚑ Does ground-kiting time count as "training"?** Session duration vs airtime will diverge hugely in parakiting (hours at the dune, maybe 40 min airborne). Recommended display: both numbers, separately, no conflation — but whether *effort/load* accounting (Body dimension crossover) counts ground-kiting is a product decision, not a research answer.
4. **⚑ Speedfly Flight-record materialization.** Research supports flight-as-atomic-record (USHPA currency, every logbook app). But for a 40-lap Valfréjus day, 40 Flight records vs 1 session with 40 air segments is a real data-model fork. Recommendation: materialize Flights for speedfly only (matches community mental model), keep parakite as segments-in-session. Confirm you're happy with the two activities diverging here.
5. **⚑ Retrim nudge at ~50 h for parakites.** The figure comes from one expert (Beni Kälin — who is also the Moustache's designer, i.e. manufacturer-adjacent); Flare's official policy is only 24 mo/200 h. Ship the 200 h official interval only, or add the soft 50 h trim nudge? (Descriptive-by-default constitution suggests: show hours since last trim, let the user set their own nudge threshold.)
6. **⚑ Wind conditions capture.** Free numeric wind speed + direction + spot aspect is the evidence-backed schema (no standard bands exist). But manual weather entry is friction — auto-fill from a weather API at session time/location would fabricate precision the honest-data rule dislikes. Manual-optional, API-prefill-marked-as-estimate, or skip entirely?
7. **⚑ Run grouping on snow — build now or later?** Verification proved ski parakite/speedriding runs are community-real (Birday comp, Les Arcs school), and the schema keeps `runGroupId` derivable. Recommendation: schema field now, derivation algorithm later (needs lift/re-ascent detection you'll get for free from the speedfly ascentMode work). Confirm deferral.

---

## 5. Resolved — Dylan's decisions (2026-07-08)

All 7 flags from §4 have a disposition. Build against these; don't re-litigate.

1. **Merge window: ship the 30 s default**, tune later on real dune tracks. Not fully understood conceptually by Dylan yet (what "a touch" means operationally) but low-stakes — proceed with the default rather than blocking on it.
2. **Ski-vs-air: (a), a simple per-session "this was on skis" tag.** No DEM/auto-detect fallback needed — confirmed.
3. **Ground-kiting effort: show session duration and airtime as two separate numbers.** No conflation. Whether ground time counts as training "effort" (Body-dimension crossover) stays explicitly deferred — do not build any load/effort accounting for it.
4. **Speedfly = materialized Flight records; parakite = segments inside one session.** Confirmed — the two activities are allowed to diverge on this.
5. **Retrim nudge: ship across the whole Sky dimension** (not parakite-only), but **only when the user has explicitly logged a trim date** — never inferred or defaulted. Passive display only (hours-since-trim, "past your mark" style line, same pattern as Earth's `gearStatusLine`) — **never a push notification.**
6. **Wind conditions: freeze a point-in-time snapshot at save (same pattern as Earth/Water's conditions freeze), editable after the fact.** The full multi-hour forecast-reference idea (letting a pilot see what was forecast across an hours-long flight window) is a real feature but **out of scope for this build** — it belongs to a separate forecasting spec still in brainstorming. Don't build toward it now; just do the standard freeze-and-edit.
7. **Snow run-grouping: do not build the field at all this pass** — not even as a placeholder. This flag surfaced a deeper unresolved question that supersedes it: **flight category may need to key off flying style, not equipment** (a parakite wing flown point-to-point reads as speedflying, not parakiting; parakiting proper is dune/soaring-specific). For this build, category stays user-selected per session — no auto-classification. The style-vs-equipment classification question is now its own open item (see below), separate from run-grouping.

**New open item spun off from #7 (not blocking, needs its own future pass):** should Sky's flight/session category be inferred from flying style rather than fixed by which gear category (wing) was used? E.g. a parakite wing flown as a point-to-point descent vs. dune-soaring are arguably different "activities" despite identical gear. No decision yet — flag for a future session once there's real usage data to look at.

---

## Source index (fetched/verified primary sources only)

**Detectors (source code):** [igc-xc-score flight.js](https://raw.githubusercontent.com/mmomtchev/igc-xc-score/main/src/flight.js) · [XCSoar FlyingComputer.cpp](https://raw.githubusercontent.com/XCSoar/XCSoar/master/src/Computer/FlyingComputer.cpp) · [XCSoar python/src/Flight](https://github.com/XCSoar/XCSoar/tree/master/python/src/Flight) · [igc_lib.py](https://raw.githubusercontent.com/marcin-osowski/igc_lib/master/igc_lib.py) · [LK8000 TakeoffLanding.cpp](https://raw.githubusercontent.com/LK8000/LK8000/master/Common/Source/Calc/TakeoffLanding.cpp) · [GliderSK USAGE](https://raw.githubusercontent.com/cedric-dufour/connectiq-app-glidersk/master/USAGE)
**Detectors (vendor docs):** [Flytec 6030 official manual V3.21](https://downloads.naviter.com/flytec/6030/Manuals/Flytec6030_EN_V321.pdf) · [Flymaster GPS SD manual](https://dnl.flymaster.net/Flymaster%20GPS%20SD%20manual%20EN%20v3.pdf) · [Flyskyhy FAQ](https://flyskyhy.com/faq.html) · [SkyDrop FAQ](https://paraglidingequipment.com/skydrop-faq/) · [Naviter landing confirmation](https://naviter.com/2022/10/landing-confirmation/) · [XCTrack/AIR3 manual](https://www.fly-air3.com/en/support/air3-xctrack-manual/xctrack-manual/preferences3/) · [hikeandfly.app XCTrack guide](https://www.hikeandfly.app/docs-content/integrations/xctrack.html)
**Measurements:** [PLOS One phone-GNSS ski study](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0327896) · [ScienceDirect skiing speeds](https://www.sciencedirect.com/science/article/pii/S2772696723000145) · [xcmag paraglider speed tests](https://xcmag.com/magazine-articles/how-fast-does-it-go-testing-paraglider-speeds/)
**Parakite:** [Moustache 2 manual PDF](https://go-flare.com/wp-content/uploads/sites/2/2026/03/MOUSTACHE2-Manual-en.pdf) · [Kälin parakite review](https://speedflyingschool.com/2025/06/11/parakite-review-by-beni-kalin-speedflyingschool/) · [Cloudbase Mayhem #226](https://www.cloudbasemayhem.com/226-benni-bolli-and-the-art-of-flaring/) · [paraglidingforum t=113584](https://www.paraglidingforum.com/viewtopic.php?t=113584) · [Flow Mullet 2](https://www.flowparagliders.com.au/product/mullet-2/) · [Birday ski-fly comp (xcmag)](https://xcmag.com/magazine-articles/watch-parakitings-first-ski-fly-comp/) · [yowfly Birday analysis](https://www.yowfly.com/2026/04/18/birday-how-a-new-competition-format-could-define-parakiting-as-a-sport/) · [speedriding-school.com parakite](https://www.speedriding-school.com/en/learn-parakite/) · [XCMag Dutch dunes](https://xcmag.com/fly-better/paragliding-techniques-paramotoring-skills/strong-wind-soaring-the-dutch-sand-dunes/) · [Parakiter app](https://parakiter.com)
**Speedfly:** [USHPA SOP 12-02 (rgsa mirror)](https://www.rgsa.info/documents/USHPA/ushpa-pilot-proficiency-system.pdf) · [flygaggle.com](https://flygaggle.com/) · [baseline.ws/help](https://baseline.ws/help) · [Strava sport types](https://support.strava.com/en-us/articles/15402005-supported-sport-types-on-strava) · [wasatchmag Salt Lake speed riders](https://wasatchmag.com/salt-lake-speed-riders/) · [newschoolers CA school thread](https://www.newschoolers.com/forum/thread/638266/First-Speedriding-Speedflying-School-in-California) · [Wikipedia speed flying](https://en.wikipedia.org/wiki/Speed_flying_and_speed_riding)
