# Moderation & legal starter — App Store compliance, content policy, privacy & ToS drafts

v1 — 2026-07-11. Planning pass commissioned alongside `social-expansion-plan.md` §2.7 (the
moderation floor / App Store gate) and `supabase-backend-spec.md`. Research current as of
2026-07-11: Apple guideline text verified against the live guidelines page (last revised
2026-06-08), Google Play against live support pages, privacy law against primary sources.
No code, no schema changes — planning only.

> **⚠️ THIS IS NOT LEGAL ADVICE.** This document was drafted by an AI assistant, not a
> lawyer. It is a *starting draft* — a researched map of what needs to exist, honest draft
> text where drafting is safe (product copy, policy structure), and explicit **TODO(lawyer)**
> markers everywhere a licensed professional's judgment is actually required. Nothing here
> has been reviewed by counsel. Before real users — especially EU/UK/California/Washington
> users — the privacy policy and terms need a real generator and/or lawyer pass (§3, §4,
> ⚑L2). Where this doc states what Apple/Google/regulators require, it cites the source and
> marks its confidence; where it picks a number or a position, that's a recommendation to
> react to, not settled law.

## 0. What this doc is for

Four deliverables, in order: (1) the concrete App Store compliance checklist that must exist
before submitting a build with social live, mapped onto the S-pass ladder; (2) a first-draft
content policy / community guidelines in the app's own voice; (3) a privacy-policy outline
with draft content per section; (4) a lighter terms-of-service outline. Then the genuine
founder calls (§5) and sources (§6).

The single biggest compliance asset this app has is architectural, decided before this doc
existed: **upload-on-share** (`supabase-backend-spec.md` §9.1 — "local SQLite remains the
single source of truth for the owner's own data; the server holds identity, the social
graph, and published copies of exactly what the user Shared"). The privacy story is one true
sentence — *private data never leaves your phone* — and un-share/delete is real server
deletion with cascades (§9.4). Most fitness apps have to write policies that paper over
their architecture; this one gets to write policies that just describe it.

---

## 1. App Store compliance checklist

Two parts: **A** — required for *any* public App Store build (some items bind before social
ships, because food photos already go to a third-party AI); **B** — the additional gate for
the **first build with social live** (the S1+ binary). Each item says where it lands on the
`social-expansion-plan.md` §6 ladder.

### 1A. Baseline — any public App Store submission

| # | Requirement | Source | Status / where it lands |
|---|---|---|---|
| A1 | **Privacy policy link** in App Store Connect metadata AND in-app, easily accessible. Must identify data collected, uses, third-party access, retention/deletion, consent revocation. | Guideline 5.1.1(i), verified verbatim 2026-07-11 | Not yet written — §3 is the outline. In-app link goes in Settings. |
| A2 | **App Privacy "nutrition label"** in App Store Connect. Today's honest answers: with the local-first architecture, on-device data is *not* "collected" (Apple: "Data that is processed only on device is not 'collected'"). But food photos transmitted to the Claude API and conditions queries (coordinates → Open-Meteo/USGS) are transmissions — the photo case arguably falls under real-time servicing, but the safe course is to declare Photos as collected (Not Linked, App Functionality). | [App privacy details](https://developer.apple.com/app-store/app-privacy-details/) | Fill out at first submission; **re-do at S1/S2** (see B10). |
| A3 | **Third-party AI disclosure + explicit permission** — Guideline 5.1.2(i) (added Nov 2025): "you must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so." Food photos → Anthropic is exactly this. The current camera purpose string ("Scan a barcode or photograph a meal to log it") does **not** disclose the AI hop. | Guideline 5.1.2(i) | Needs: one-time in-app disclosure/consent before first photo-log + privacy-policy naming of Anthropic. Small UI item, pre-social. |
| A4 | **HealthKit rules (5.1.3):** privacy policy must disclose the *specific* health data types read (steps, sleep, workouts incl. swim); no health data for advertising/data-mining; never store personal health information in iCloud (Supabase is fine — it isn't iCloud); no disclosure to third parties without express permission, and even then only to parties providing the user a health/fitness service. | Guideline 5.1.3, verified verbatim | Policy content in §3.6. The existing `NSHealthShare/UpdateUsageDescription` strings in app.json are good and honest — keep. |
| A5 | **Privacy manifest (PrivacyInfo.xcprivacy).** Required-reason API declarations enforced since 2024-05-01 (ITMS-91053); missing *SDK* manifests a hard rejection since 2025-02-12 (ITMS-91061). Expo SDK packages ship their own manifests, but Expo documents that Apple doesn't reliably parse static-pod manifests — duplicate required-reason entries at app level via `expo.ios.privacyManifests`. | [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files), [Expo guide](https://docs.expo.dev/guides/apple-privacy/) | Verify at first EAS production build; fix whatever the post-upload email lists. |
| A6 | **Location purpose strings + background mode.** Strings must "clearly and completely describe your use of the data" (5.1.1(ii)). Current strings are excellent and honest. While-Using + `UIBackgroundModes: location` for record-in-background is Apple's *preferred* pattern (no Always auth needed; no demo-video regime — that's Google Play, not Apple). Keep the record feature discoverable for review; note it in App Review notes. | Guidelines 2.5.4, 5.1.1, 5.1.5 | Already correct. **But see B11 — one current string becomes false later.** |
| A7 | **Graceful denial** — app must not require location/notifications to function (5.1.2(i)). | Guideline 5.1.2(i) | Already the architecture (manual logging works without GPS). Keep it true. |
| A8 | **Age rating questionnaire** (new 2025 system: 4+/9+/13+/16+/18+; mandatory since 2026-01-31 for updates). Pre-social, "Medical or wellness topics" questions apply to a fitness tracker; expect a low rating pre-social. | [Apple news 2025-07-24](https://developer.apple.com/news/?id=ks775ehf) | At first submission. Re-answered at social launch (B8). |

### 1B. The social launch gate — first binary with S1+ live

Apple Guideline 1.2 (UGC), quoted verbatim from the live page (2026-07-11): apps with UGC or
social networking services **must include**:

> - A method for filtering objectionable material from being posted to the app
> - A mechanism to report offensive content and timely responses to concerns
> - The ability to block abusive users from the service
> - Published contact information so users can easily reach you

Plus a new paragraph added 2026-06-08: *"It is your responsibility to remove content that
violates this guideline, your terms of service, or your community standards. If we find such
content, we will ask you to remove it, and provide a plan to improve your compliance…
Egregious or repeated behavior is grounds for immediate removal of your app from the App
Store, and from the Apple Developer Program."*

And the well-attested App Review **rejection boilerplate** (not published guideline text, but
enforced in practice — [dev forums](https://developer.apple.com/forums/thread/116703)):
require users to **agree to terms (EULA)** with explicit zero-tolerance language, and **act
on objectionable-content reports within 24 hours** by removing the content and ejecting the
offending user. Plan as if mandatory.

**Verdict on the planned S1 moderation floor** (`social-expansion-plan.md` §2.7: block,
remove-follower, report → owner-monitored queue): **it covers 2 of Apple's 4 bullets (report,
block). Four gaps must be added to S1 scope:**

| # | Item | S1 floor? | Gap / action | Lands |
|---|---|---|---|---|
| B1 | **Report** — per-content + per-user report affordance, delivered to an owner-monitored queue with a stated response practice | ✅ specced | Confirm the queue alerts immediately (push/email on every report — a solo founder can't poll a dashboard). Report must exist on **every** UGC surface as it ships: profiles/handles/avatars (S1), captions (S2), feed entries (S3), comments/kudos (S4), chat messages (S5). | S1 + rider on every later pass |
| B2 | **Block** — severs follow both ways, prevents follow/tag/DM/comment/re-share, hides content both directions | ✅ specced | None — the §2.7 spec is already stronger than Apple's bullet. | S1 (B1 backend) |
| B3 | **Filtering method** | ❌ **gap** | Cheapest credible package that passes review for small apps: (a) word-list/profanity filter on user-entered text surfaces (handle, display name, bio at S1; caption at S2; comments at S4; chat at S5); (b) reported content auto-hidden pending review; (c) optionally Apple's on-device [Sensitive Content Analysis](https://developer.apple.com/documentation/sensitivecontentanalysis) framework on incoming images when photo feed/chat ship — free, on-device, and a credible review-notes signal. Proactive AI moderation is NOT required at this scale — report-and-remove workflows plus a text filter is what passes (dev-forum consensus; medium confidence, reviewer-dependent). | Add to S1; extend per pass |
| B4 | **Published contact info** | ❌ **gap** | A real support email + a public contact/support URL, in App Store Connect metadata AND reachable in-app (Settings → "Contact & support"). Trivial to build; easy to forget. | Add to S1 |
| B5 | **ToS acceptance gate** | ❌ **gap** | Explicit "I Agree" action over the terms at account creation (passive "by signing up you agree…" text has been rejected). Terms must contain the zero-tolerance objectionable-content language (§4 draft). Google Play independently requires the same gate ("Requires users accept the app's terms of use… before users can create or upload UGC"). | Add to S1 signup flow (B1 auth) |
| B6 | **Removal + eject tooling (the 24-hour muscle)** | ⚠️ partial | The queue is specced; the *enforcement half* isn't: an admin path to (a) remove any piece of server-side content and (b) suspend/ban an account, executable within 24h from anywhere (even a documented Supabase-dashboard runbook is honest at MVP — but write the runbook and test it before launch). The 2026-06-08 guideline paragraph makes developer removal responsibility explicit. | Add to S1/B1 |
| B7 | **In-app account deletion** — 5.1.1(v): "If your app supports account creation, you must also offer account deletion within the app." Temporary deactivation is insufficient. Also 5.1.1(v)'s other half — "let people use it without a login" — is already the architecture ("No account = the full app, forever"): keep it true. | ❌ not explicit in S1 | Full account deletion (auth user + profiles + follows + grants + observations mirror + media objects + chat memberships) as an S1/B1 work item. The §9.4 cascade design makes this cheap — extend un-share teardown to whole-account teardown. Google Play will additionally want a **web deletion-request link** when Android ships (§1C). | Add to S1/B1 |
| B8 | **Age rating re-answer at social launch.** The "Social Media" capability ("interaction with user-generated content through a social feed…") forces **13+ minimum** under Apple's published definitions. Feed + follows + comments + DMs realistically = **13+** (16+ only if unrestricted web browser or frequent mature themes are added — they aren't). Declare honestly; a 4+ social app is a flagged review mistake. Match the ToS minimum age (§4) so the story is coherent. | — | At the social-launch submission |
| B9 | **Neutral age gate at signup** (birth-date entry, no steering) to back the 13+ ToS floor and COPPA posture (§3.9). Plus: **verify at S1 build time** the then-current status of state age-assurance laws — Texas's App Store Accountability Act has been enforced by Apple since 2026-06-04 (Declared Age Range API, PermissionKit significant-change handling, consent-revocation server notifications for Texas minor accounts); Utah pushed to 2027-05-06, Louisiana to 2027-07-01. This landscape was shifting all H1 2026 — **TODO(verify at S1)**: what Apple actually requires of a small dev whose app rates 13+. | — | S1 signup + build-time check |
| B10 | **Privacy label update.** The moment upload-on-share ships, everything synced becomes "collected" and "Linked to You" (keyed to account): User ID, Other User Content (shared sessions, comments), Photos (shared), Health & Fitness (a Shared session sourced from HealthKit), Messages (S5). Precise Location stays un-collected until geometry sharing ships (the v1 projection has no geometry field — `supabase-backend-spec.md` §5.3), then flips. Labels update in App Store Connect without a binary. "Data Used to Track You" stays empty (no ads, no brokers) — no ATT prompt needed. | [App privacy details](https://developer.apple.com/app-store/app-privacy-details/) | S1/S2, again when zones/geometry ship |
| B11 | **Purpose-string & UI-copy truth sweep.** Two strings become false at the backend era: the location purpose string's "your route stays on your device" (true until geometry sharing ships — revise no later than the zones/S7 era) and the Settings privacy copy "Private. Nothing you log is shared with anyone. Sharing controls arrive…" (must change at S1). Also the promised "One-button JSON export lands with the storage layer" — build it by S1 (it's also the GDPR export answer, §3.7). | 5.1.1(ii) honesty | S1 sweep + zones-era sweep |
| B12 | **Review-day items:** demo account with populated social features (Guideline 2.1 completeness); support URL live before submission; App Review notes explaining the moderation stack and that DMs are named-profile, mutual-follow-gated (1.2 red-flags "random or anonymous chat" — mutual-follow DMs are the safe framing, and §1.5's reachability rule already is that). | Guideline 2.1, 1.2 | Social-launch submission |
| B13 | **HealthKit × Share seam — TODO(lawyer-or-Apple-clarity).** A Shared session *sourced from HealthKit* uploads HealthKit-derived data (sport, duration, times) to Supabase and displays it to followers. Reading of 5.1.3: user-directed sharing with express permission is permitted (the prohibitions are ads/data-mining/iCloud/brokers, and disclosure requires the third party to provide the user a health/fitness service — other users arguably aren't "third parties" in that sense; Supabase is a processor). This is the standard Strava-class pattern and almost certainly fine, but it is an inference, not an Apple sentence. Mitigation that costs nothing: the express-consent screen (§3.6) names this case explicitly. | Guideline 5.1.3 | Consent screen at S1/S2; flag for the eventual lawyer pass |

**Not applicable (checked, so nobody re-litigates):** Guideline 1.2.1(a) creator-content age
mechanisms (aimed at Roblox/TikTok-style creator platforms, not an ordinary social feed);
Guideline 4.8 login services (Sign in with Apple + own email-code system already satisfies
it — and an own-system-only auth would be exempt entirely); ATT/tracking (no ads, ever).

### 1C. Google Play (brief — for whenever Android ships)

Functionally the same floor, plus four Play-specific items. Same feature set satisfies both
stores; build once.

- **UGC policy** ([source](https://support.google.com/googleplay/android-developer/answer/9876937)):
  ToS acceptance gate before creating/uploading UGC (non-skippable), a definition of
  objectionable content, in-app reporting AND blocking of both content and users, action on
  reports. Covered by 1B above.
- **Data safety form**: declare Precise location, Photos, Health info, Fitness info,
  Personal info — including what third-party SDKs transmit. Upload-on-share = "collected."
- **Health apps declaration** (mandatory since 2024-08-31, even for apps with no health
  features — a fitness tracker declares under "Activity and Fitness"); Health Connect
  data-type justifications if Health Connect is ever integrated.
- **Account deletion**: in-app path AND a **web link** usable without reinstalling the app
  (declared in the Data safety form). The web page can be trivial; it must exist.
- **⚠️ Child Safety Standards policy** (enforced since 2025-03-19): any app self-declared in
  the **"Social" category** must publish CSAE (child sexual abuse and exploitation)
  standards on a public web page, name a child-safety contact, and self-certify — regardless
  of whether children use the app. Categorizing as **Health & Fitness** (with social
  features) likely avoids the trigger, but that's a categorization judgment — ⚑L6.
- **IARC content-rating questionnaire**: "users interact" / UGC / location-sharing answers
  raise the rating; answer honestly, target-audience declaration 13+ or higher (never
  include children's age bands — that triggers the full Families policy).

---

## 2. Content policy / community guidelines — first draft

Real draft text, in the app's plain register. This is product copy, safe to draft (it's a
statement of house rules, not a contract) — but **TODO(lawyer)**: have counsel read it once
alongside the ToS (§4) so the two documents use consistent defined terms, and confirm the
CSAM reporting line (see rule 6) matches current federal obligations.

---

**Community guidelines**

**The short version.** This app is a place to log what you actually did and, if you choose,
share it. Be straight with people. Don't make anyone feel unsafe. If you see something that
crosses a line, report it — a human reads every report.

**1. Harassment.** Don't target people. No bullying, threats, pile-ons, or unwanted repeated
contact. If someone blocks you, that's the end of the conversation — attempting to get
around a block is itself a violation.

**2. Hate.** No attacks on people for who they are — race, ethnicity, religion, gender,
sexuality, disability, body, or anything else about their identity. Zero tolerance: this is
the fastest way to lose your account.

**3. Comments are about the training, not the body.** This is a training app. Commentary on
someone's body — even "compliments" — is off-limits unless they invited it. Body-shaming of
any kind is treated as harassment.

**4. Other people's privacy.** Never share someone else's private information: their home
location, where they train from, their routes or tracks, screenshots of their private
sessions or messages, or anything they shared with you privately. In an app where sessions
carry GPS, someone's start point can be their front door — treat other people's location
data like it's your own.

**5. Be who you are.** No impersonating other people, brands, or coaches. Parody is fine if
it's obviously parody; pretending to be someone in order to mislead people is not.

**6. Absolutely no sexual content involving minors.** Zero tolerance, immediate permanent
ban, and we report it to the authorities. *(TODO(lawyer): confirm the exact reporting
obligation and language — US providers have a federal duty to report apparent CSAM to
NCMEC (18 U.S.C. § 2258A); the Play Child Safety Standards page, if required (§1C), should
state the same standard.)*

**7. No spam.** No bulk-following to farm follows, no repetitive promotional posting, no
link-spam in comments or messages. Sharing your own coaching business on your own profile is
fine; carpet-bombing other people's sessions with it is not.

**8. Nothing illegal.** Don't use the app to do, sell, or arrange anything illegal.

**How reporting works.** Every profile, shared session, comment, and message has a Report
action. Reports go straight to us — a person, not an algorithm. **We act on reports of
content that violates these guidelines within 24 hours**, usually much faster: the content
comes down while we look, and if it violates the rules it stays down. The team behind this
app is currently one person — reports are read by the founder, and that's a feature, not an
apology.

**How blocking works.** Block is instant and silent. The blocked person can't follow you,
see your content, message you, comment on your sessions, or find you in search — and you
can't see them. They aren't notified. You can also **remove a follower** without blocking
them — they just stop seeing your content, and they aren't notified either.

**What happens to violators.** Depending on severity: content removal → warning → temporary
suspension → permanent ban. Rules 2 and 6 skip the ladder. If you think we got it wrong,
reply to the enforcement email — appeals are read by a human too.

---

*Drafting notes (not part of the policy):* the 24-hour commitment is deliberately Apple's
de-facto review bar (§1B) — committing to less invites rejection, committing to more is
unrealistic solo; ⚑L1 asks Dylan to accept it. "Dangerous activity" is deliberately **not**
banned — this is an app for whitewater, paragliding, and alpine sports; policing risk
content would ban the product's own subject matter. The assumption-of-risk problem is
handled in the ToS (§4), where it belongs.

---

## 3. Privacy policy — first-draft outline

Section headers + a paragraph of honest draft content each. **This outline is a skeleton
for a generator/lawyer pass, not a shippable policy** — every section needs jurisdiction-
correct language before real users (⚑L2, and the generator recommendation below). The app's
architecture makes the honest version unusually short; resist letting a generator bloat it
into boilerplate that no longer describes the actual system.

**Generator to point the founder at:** the research pass compared Termly, iubenda,
TermsFeed, GetTerms, and Termageddon. **Recommendation: iubenda** (Essentials ~$6/mo to
start) — lawyer-maintained clause library keyed to actual mobile SDKs/services, per-app
policies, the strongest mobile-app + GDPR mechanics. **Termageddon** (~$119/yr) is the
credible alternative whose strength is auto-updating for new US state laws. One caveat from
the research: **no generator reliably produces the Washington MHMDA standalone consumer
health data policy (§3.10) — hand-write that one page using
[Strava's](https://www.strava.com/legal/consumer-health-data-policy) as the model.**

### 3.1 Who we are & how to reach us
Draft: "This app is built and operated by **TODO(founder): legal name or entity (see ⚑L3 —
decide entity before social launch)**, based in **TODO: city, state**. Privacy questions or
requests: **TODO: support email** — the same inbox that handles reports, read by the
founder." *(Apple 1.2's "published contact information" and GDPR Art. 13's controller
identity are the same line item — one email address satisfies both.)*

### 3.2 The one-paragraph summary
Draft: "This app is local-first. Everything you log — sessions, GPS routes, food, weight,
photos, data from Apple Health — lives on your phone. If you never create an account, none
of it ever leaves your phone, and you can use the entire app that way, forever. If you
create an account, our servers store your account details and your social activity; your
logged data reaches our servers **only** when you deliberately tap Share on a specific
session. Un-sharing or deleting removes it from our servers — actually removes it, not
hides it. We show no ads, and we never sell your data."

### 3.3 Data we collect — and data we deliberately don't
Draft, itemized: **(a) Stays on your phone** (no account, or account without sharing):
training sessions, GPS tracks, food logs and photos of meals, weigh-ins, notes, gear, Apple
Health data (steps, sleep, workouts). **(b) On our servers with an account:** email address,
handle, display name, avatar, account settings, who you follow and who follows you, blocks
and reports, push notification tokens. **(c) On our servers when you Share a session:** the
session's shared fields (sport, date, duration, stats you allowed — never your private
notes), its caption, its photos (with location metadata already stripped on your phone
before anything is stored), kudos and comments on it. **(d) Messages** you send (S5+).
**(e) Service logs** (basic technical logs for security/debugging — TODO(generator):
standard log-retention clause). *(TODO at geometry era: when route-sharing behind privacy
zones ships, add the shared-geometry item and flip the Apple privacy label — §1B B10.)*

### 3.4 What we use it for
Draft: "To run the app: your account data to operate your account; shared content to show
it to the people your sharing settings allow; push tokens to deliver notifications you've
turned on (all social notifications are per-type toggleable, and we never send engagement
or 'we miss you' notifications — a notification only ever means a person did something).
We do not use your data for advertising, we do not build advertising profiles, we do not
sell or rent personal data to anyone, and we never use health data for marketing."
*(That last clause is an Apple 5.1.3 requirement as much as a promise.)*

### 3.5 Third parties (processors & services) — name them all
Draft table, one honest line each — **TODO(generator): expand each into the standard
processor clause; TODO(founder): execute the Supabase DPA before S1 launch (it exists at
[supabase.com/legal/dpa](https://supabase.com/legal/dpa) but must actually be requested and
signed — an unsigned DPA on their website satisfies nothing).**
- **Supabase, Inc.** — hosting/database for accounts, social graph, shared content, chat,
  push tokens. Region: **TODO(founder): pick deliberately at project creation; Frankfurt
  (eu-central-1) simplifies the EU story at zero cost, and the choice is effectively
  one-way** (⚑L4). SOC 2 Type 2 / ISO 27001; DPA with SCCs available.
- **Anthropic (Claude API)** — when you photograph a meal or label, the photo is sent to
  Anthropic's API to estimate the food, then discarded; it is not stored by us. *(Apple
  5.1.2(i) also requires in-app disclosure + explicit permission for this — §1A A3.)*
- **MapTiler** — map tiles; tile requests carry your IP and the map area you're viewing.
- **Open-Meteo / USGS** — weather and river conditions; requests carry the coordinates of
  the spot being checked.
- **Expo (push notification service)** — delivers push notifications; holds push tokens.
- **Apple** — Sign in with Apple (if used); Apple Health data is read on-device and is
  never written to iCloud by us.

### 3.6 Health data (Apple Health / HealthKit) — its own section, deliberately
Draft: "With your permission, the app reads **steps, sleep, and workouts (including swim
data)** from Apple Health. This data stays on your phone. It reaches our servers in exactly
one case: if you tap **Share** on a session that came from Apple Health, its shared fields
(sport, date, duration) are published like any other shared session. We never use Apple
Health data for advertising or marketing, never sell it, never store it in iCloud, and
never share it with anyone except the people your own sharing settings choose."
**TODO(build, S1/S2):** a one-time explicit-consent screen when the first HealthKit-sourced
session is Shared (or at account creation) — one screen covers Apple 5.1.3 express
permission, GDPR Art. 9 explicit consent, and Washington MHMDA consent simultaneously
(§3.10); withdrawal path in Settings. **TODO(lawyer):** confirm the single-screen approach
is sufficient for all three regimes.

### 3.7 Your rights: export, deletion, correction
Draft: "**Export:** Settings → Export gives you your complete data as JSON — everything,
not a summary. *(TODO(build): this is promised in the current Settings copy and must
actually ship by S1 — it is also the GDPR Art. 15/20 access + portability answer.)*
**Deletion:** deleting a shared session or un-sharing it deletes it from our servers
(kudos and comments on it go with it). Deleting your account in Settings deletes your
account and everything server-side. Data that never left your phone is deleted by deleting
the app. **Correction:** edit anything you logged at any time; edits to shared sessions
propagate. We respond to rights requests at **TODO: support email** — and we answer them;
ignored requests are how small apps get complaints." *(GDPR Art. 15/17/20 + CCPA-style
rights in one section; the architecture makes them real features, not process promises.
**Never ignore a rights email — that is the actual enforcement vector at this scale.**)*

### 3.8 Retention & security
Draft: "Server data is kept while your account exists and deleted on account deletion
(backups age out within **TODO: Supabase backup window — verify**). Data on your phone is
yours and follows your device's own backup settings. Transport is TLS; server access is
gated by row-level security so even our own queries resolve your privacy settings."
**TODO(generator):** standard breach-notification language (GDPR Art. 33/34 — 72 hours to
authority; keep the one-page internal breach plan the research recommends).

### 3.9 Children
Draft: "This app is not for children. You must be **13 or older** to use it, and **16 or
older in the EEA/UK** *(TODO(lawyer): confirm this age split vs a flat 16+ — GDPR consent
age is a per-country patchwork of 13–16, and our health-data processing rests on
consent)*. We don't knowingly keep accounts of users under these ages; we delete them when
we learn of them." *(Backed by the neutral age gate at signup — §1B B9 — and the 13+ Apple
rating — B8.)*

### 3.10 US state health-data laws — the standalone policy ⚠️
**The sleeper finding of the whole research pass:** Washington's **My Health My Data Act**
has **no small-business revenue floor**, defines "consumer health data" broadly enough to
cover fitness/exercise/diet/weight data, carries a **private right of action** (plaintiffs'
firms are actively recruiting), and expects a **standalone Consumer Health Data Privacy
Policy** as its own distinct link — separate from the main policy — plus opt-in consent for
collection beyond what's necessary for the service the user requested, separate consent for
sharing, and deletion rights that reach into backups. Nevada's SB 370 is a near-twin.
Whether a global App Store listing with incidental WA users is "conducting business in WA"
is untested — but the compliance pattern is public, short, and cheap (Strava's page is the
template). **Recommendation (⚑L5): hand-write the one extra page and link it beside the
privacy policy at S1.** The §3.6 consent screen and §3.7 deletion rights already do the
mechanical half. **TODO(lawyer): the standalone policy page itself — this is the one
document where template-following without review is riskiest, because of the private right
of action.**

### 3.11 International users / GDPR posture
Draft: honest one-paragraph GDPR section (controller identity, lawful bases — contract for
core features, consent for social/health data, legitimate interest for security logs —
plus the Art. 15/17/20 rights pointing at §3.7, and supervisory-authority complaint
right). **The realistic indie posture, stated so it's chosen, not drifted into** (⚑L4):
GDPR almost certainly applies once EU users have accounts (the EDPB's "monitoring" test
explicitly lists geo-localisation and "personalised diet and health analytics" — that is
this app), and the cheap-basics stack (this policy, the consent screen, export, deletion,
signed Supabase DPA, a one-tab ROPA spreadsheet, a one-page breach plan) is all buildable
solo. The one item deliberately deferred: an **Art. 27 EU representative** (~€100–1,000/yr
rep-as-a-service) — technically required, near-universally skipped by pre-revenue indies,
revisit at EU traction or revenue. **TODO(lawyer at traction): EU rep + UK rep decision.**

### 3.12 Changes to this policy
Standard clause — TODO(generator).

---

## 4. Terms of service — first-draft outline

Lighter than §3, as briefed. Headers + draft position per section. **TODO(lawyer) applies
to this entire section more strongly than anywhere else in this doc** — ToS are a contract,
and two clauses (4.7, 4.8) genuinely need counsel, not a generator (⚑L2).

### 4.1 Acceptance
Explicit "I Agree" gate at account creation (required in practice by Apple review and by
Google Play policy — §1B B5). The terms state plainly: **there is zero tolerance for
objectionable content or abusive behavior; violating the community guidelines (§2) can end
your account.** *(That sentence, or one like it, is what App Review looks for.)*

### 4.2 Eligibility
13+ (16+ EEA/UK), consistent with §3.9 and the App Store rating. One account per person;
accurate signup info.

### 4.3 Your account
You're responsible for what happens under your account; keep access to your sign-in email.
We can suspend or terminate accounts that violate these terms (see 4.6). You can delete
your account at any time in Settings, effective immediately.

### 4.4 Your content — ownership and license
Draft position (the brief's shape, confirmed): **"You own everything you create in this
app.** By tapping Share on a session (or posting a caption, comment, photo, or message),
you grant us a **non-exclusive, worldwide, royalty-free license to host, store, display,
and distribute that content — only as your sharing settings direct, and only for operating
the service.** The license ends when you delete the content, un-share it, or delete your
account, because we actually delete it from our servers." *(That last clause is true by
architecture — `supabase-backend-spec.md` §9.4 — and is a differentiator most ToS can't
honestly offer.)* **TODO(lawyer): the exact license wording — scope, sublicense-to-CDN
language, and survival carve-outs below.**

**The two survival carve-outs that must be drafted honestly (real product nuance, not
boilerplate):**
1. **Program-grab (S6):** when another user saves your shared split/program to their
   library, they keep a **copy** as a draft — deleting your original doesn't reach into
   their library. The license must say a grabbed template copy survives (e.g., "when you
   share a training template, you grant other users a perpetual license to keep and use
   copies they saved while it was shared"). **TODO(lawyer): wording.**
2. **Ephemera:** kudos/comments others left on your content are deleted with your content
   (true — cascades); your comments on *others'* content are deleted when you delete them
   or your account.

### 4.5 Acceptable use
Incorporates the community guidelines (§2) by reference; adds the standard mechanical
list — no unauthorized access, scraping, reverse engineering **TODO(lawyer/founder): note
the repo is public, so "reverse engineering" language should be checked against the actual
open-source posture and license of the codebase**, no automated bulk activity.

### 4.6 Enforcement & termination
We may remove content and suspend/terminate accounts for violations (the §2 ladder), with
immediate effect for zero-tolerance categories. Effect of termination: server-side data
deleted per §3.7; these terms' liability sections survive.

### 4.7 ⚠️ Assumption of risk — THE clause that needs a real lawyer
This app records and hosts content about **objectively dangerous activities** — whitewater
kayaking, paragliding, wingfoiling, alpine sports. Users can grab another user's training
program (S6), view others' routes (post-zones era), and check live river/weather conditions
surfaced by the app. Draft *position* only: "The app is a logbook and a mirror, not a
coach, guide, or safety device. Conditions data comes from third-party sources and can be
wrong or stale. Another athlete's shared program or route is what *they* did, not advice
for you. You alone judge whether an activity, location, or conditions are safe for you."
**TODO(lawyer, pre-social-launch, non-negotiable (⚑L2)): a real assumption-of-risk /
disclaimer-of-warranties / limitation-of-liability stack drafted by counsel.** This is the
single place in this document where paying a lawyer *before* launch is clearly worth it —
the app's subject matter is exactly the kind where a boilerplate limitation clause fails
someone's real-world worst day.

### 4.8 Not medical advice
"Nothing in this app is medical advice. TDEE, trends, and every derived number describe
your own logged data; consult a professional for medical decisions." Consistent with the
constitution's summoned-coach rule ("Programming suggestions, never diagnosis or
treatment"). **TODO(lawyer): standard wellness-app disclaimer language.**

### 4.9 Service changes; warranty disclaimer; limitation of liability; indemnity
All TODO(lawyer/generator) — deliberately not drafted here; invented limitation-of-
liability language dressed as settled text is exactly what this doc promised not to do.

### 4.10 Governing law & disputes
**TODO(founder + lawyer) — ⚑L3:** governing law/venue (founder's home state is the
default), arbitration y/n, class-waiver y/n. Genuine calls with real trade-offs; do not
template.

### 4.11 Platform pass-throughs
Apple/Google standard third-party-beneficiary clauses (generators handle these correctly).

---

## 5. ⚑ Flags for Dylan — the genuine calls

- **⚑L1 — The 24-hour commitment.** The content policy (§2) commits to acting on
  objectionable-content reports within 24 hours. That's Apple's de-facto review bar, so
  the alternative is basically "don't ship social" — but it's *your* pager. Accepting it
  means: push/email alert on every report, an enforcement runbook you can run from a
  phone, and a thought about coverage when you're on a river with no signal for a weekend.
  Recommendation: accept it, wire the alerting into S1 (B1/B6), and keep a trusted
  second person's break-glass access in mind for later.
- **⚑L2 — What gets a real lawyer pre-launch vs post-traction.** Recommendation: spend
  real money pre-social-launch on exactly two things — (1) the **assumption-of-risk /
  liability stack** (§4.7 — dangerous-sports app hosting other people's programs and
  conditions data), and (2) **entity formation** (see ⚑L3). Everything else — privacy
  policy, generic ToS clauses, MHMDA page — ships on generator + this doc's structure and
  gets a full legal review at traction/revenue. The one exception pulling the other way:
  the MHMDA standalone policy (⚑L5) has a private right of action, so if the lawyer
  session happens anyway, put it in the reviewed pile.
- **⚑L3 — Entity + jurisdiction.** Hosting other people's content, taking on moderation
  duties, and publishing a dangerous-sports app as a **personally-liable individual** is a
  real risk posture. TODO(lawyer): whether to form an LLC (or equivalent) before the
  social launch, plus §4.10's governing-law/arbitration calls, plus Section 230-adjacent
  questions about platform liability for user content. Founder call on timing; the
  recommendation is to at least *ask* a lawyer this specific question before S1 ships.
- **⚑L4 — EU posture, decided not drifted.** Options: (a) ship globally + the cheap-basics
  GDPR stack (§3.11) with the Art. 27 rep consciously deferred — what nearly every indie
  does; (b) exclude EU storefronts in App Store Connect until there's revenue to fund
  compliance — the only clean opt-out. Sub-decision either way: Supabase region (Frankfurt
  is the free simplification, and it's one-way). Recommendation: (a) + Frankfurt.
- **⚑L5 — Washington MHMDA standalone policy: do it.** One hand-written page modeled on
  Strava's, linked beside the main policy at S1. Cheapest insurance in this doc against
  the only privacy law that plausibly reaches a pre-revenue fitness app *today*.
- **⚑L6 — Play category, when Android ships.** "Health & Fitness" vs "Social" — the Social
  category self-declaration triggers Google's published-CSAE-standards + named-contact
  obligations. Health & Fitness is the honest primary category anyway; decide with eyes
  open when Android is real.

## 6. Sources (all verified live 2026-07-11 by the research pass)

- Apple App Review Guidelines (rev. 2026-06-08): https://developer.apple.com/app-store/review/guidelines/ — §1.2 UGC, 1.2.1, 2.5.4, 4.8, 5.1.1, 5.1.2(i), 5.1.3, 5.6
- Apple guideline change notes: https://developer.apple.com/news/?id=a233fmpw (2026-06), https://developer.apple.com/news/?id=ey6d8onl (2025-11)
- Apple 1.2 rejection boilerplate (EULA + 24h — reviewer practice, medium confidence): https://developer.apple.com/forums/thread/116703
- Apple age ratings overhaul: https://developer.apple.com/news/?id=ks775ehf; definitions: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/
- Texas age-assurance / Declared Age Range API: https://developer.apple.com/news/?id=2ezb6jhj
- App privacy details (nutrition labels): https://developer.apple.com/app-store/app-privacy-details/
- Privacy manifests: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files; Expo guide: https://docs.expo.dev/guides/apple-privacy/
- Account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- HealthKit privacy: https://developer.apple.com/documentation/healthkit/protecting-user-privacy
- Sensitive Content Analysis framework: https://developer.apple.com/documentation/sensitivecontentanalysis
- Google Play UGC policy: https://support.google.com/googleplay/android-developer/answer/9876937; Data safety: https://support.google.com/googleplay/android-developer/answer/10787469; account deletion: https://support.google.com/googleplay/android-developer/answer/13327111; Health apps: https://support.google.com/googleplay/android-developer/answer/14738291; Child Safety Standards: https://support.google.com/googleplay/android-developer/answer/14747720
- EDPB Guidelines 3/2018 (GDPR territorial scope): https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_3_2018_territorial_scope_after_public_consultation_en_1.pdf
- ICO special-category data (fitness trackers = health data): https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/
- CCPA thresholds (CPPA official, $26,625,000): https://cppa.ca.gov/regulations/cpi_adjustment.html
- Washington MHMDA: https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true; Strava's standalone policy (the template): https://www.strava.com/legal/consumer-health-data-policy
- COPPA 2025 amendments: https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule
- Supabase DPA / security / regions: https://supabase.com/legal/dpa, https://supabase.com/security, https://supabase.com/docs/guides/platform/regions
- Strava privacy policy + health-data consent pattern: https://www.strava.com/legal/privacy

---

## Summary & key flags

**The S1 moderation floor (block / remove-follower / report) covers half of Apple's
Guideline 1.2 gate.** Four additions make it pass-ready: a text filtering method (word
filter + auto-hide-on-report), published contact info, an explicit ToS "I Agree" gate with
zero-tolerance language, and admin remove-content/ban tooling that can honor a 24-hour SLA
(⚑L1). In-app account deletion (5.1.1(v)) and a 13+ age rating with a neutral age gate ride
the same pass. Two items bind **before** social: the third-party-AI disclosure for food
photos (5.1.2(i)) and the privacy-policy link every app needs.

**The privacy story is architecturally strong** — upload-on-share means the policy's core
sentence ("private data never leaves your phone; un-share actually deletes") is true, and
the planned JSON export + deletion cascades are the GDPR-rights mechanics already. The
realistic indie stack: generator policy (iubenda or Termageddon) + hand-written Washington
MHMDA standalone health-data page (⚑L5 — the sleeper law with no revenue floor and a
private right of action) + one explicit health-data consent screen + signed Supabase DPA +
deliberate region choice (⚑L4) + a ROPA spreadsheet — with the EU representative
consciously deferred, and rights emails never ignored.

**Where a real lawyer is non-negotiable pre-launch (⚑L2):** the assumption-of-risk /
liability stack for a dangerous-sports app (§4.7) and the entity-formation question (⚑L3).
Everything else in §3/§4 is marked TODO where legal judgment is required rather than
invented here.

> **Reminder, as promised at the top: this document is not legal advice and its drafts are
> not reviewed legal text.** It exists to make the eventual generator/lawyer pass fast,
> cheap, and grounded in what this app actually does — not to substitute for it.
