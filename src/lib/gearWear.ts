/**
 * gearWear.ts — the quiver's descriptive wear read models (P9, display-only).
 *
 * Wires core's never-before-called Sky gear math (paragliderTotalHours,
 * retrimStatus, repackDueAt) to real session Observations, plus the airtime
 * aggregation those functions declare as caller-supplied. Everything here is
 * derived-on-read and stated as a fact against the user's OWN mark — no
 * stored totals, no reminders, no imperatives (constitution; profile spec ⚑7
 * keeps notification mechanics unruled and therefore unbuilt).
 *
 * Airtime rule matches skyLedger.ts: segments present → summed 'air' segment
 * time (ground time never counts); a hand-logged session with no track has no
 * segment breakdown, so its whole manual duration IS the flight time by
 * convention — the same USHPA-flagged caveat that convention carries there.
 * A SkyGearUse with segmentIds narrows accrual to exactly those segments
 * (positional, stringified — segments carry no id of their own).
 */
import type { ObservationOf, SkySegment } from '@core/observation';
import {
  paragliderTotalHours,
  repackDueAt,
  retrimStatus,
  type ParagliderSpec,
  type ReserveSpec,
} from '@core/gear';
import { localDayOf } from '@core/timeline';
import type { LocalDate } from '@core/observation';
import { daysBetween } from './date';

type SkySession = ObservationOf<'session'>;

/** Airtime a single session contributes to one gear item, in minutes. */
function sessionAirtimeMinFor(gearId: string, s: SkySession): number {
  const sky = s.payload.sky;
  const ref = sky?.gearRefs?.find((r) => r.gearId === gearId);
  if (!ref) return 0;

  const track = sky?.track;
  const segments = sky?.segments;
  if (track != null && segments != null && segments.length > 0) {
    const counted: SkySegment[] =
      ref.segmentIds != null
        ? segments.filter((seg, i) => ref.segmentIds!.includes(String(i)))
        : segments;
    return (
      counted
        .filter((seg) => seg.kind === 'air')
        .reduce((sum, seg) => sum + (track[seg.endIdx].tsSec - track[seg.startIdx].tsSec), 0) / 60
    );
  }
  // No track → the manual duration is the flight time by convention
  // (skyLedger.ts's rule, USHPA caveat and all).
  return s.payload.durationMin ?? 0;
}

/**
 * Total tracked airtime for a gear item across sky sessions, in hours.
 * `onOrAfterDay` gates by the session's own civil day (e.g. "hours flown
 * since the last trim date"). 0 is a legitimate measured zero here — the
 * record was consulted and contained no flights.
 */
export function skyAirtimeHrFor(
  gearId: string,
  sessions: SkySession[],
  onOrAfterDay?: LocalDate
): number {
  let min = 0;
  for (const s of sessions) {
    if (onOrAfterDay != null && localDayOf(s.occurredAt, s.tz) < onOrAfterDay) continue;
    min += sessionAirtimeMinFor(gearId, s);
  }
  return min / 60;
}

const round = (n: number) => Math.round(n);

/**
 * A paraglider's wear lines, descriptive only. Empty array when the record
 * has nothing honest to say (no baseline, nothing tracked, no trim logged) —
 * absence over a fabricated 0, per paragliderTotalHours' own contract.
 */
export function paragliderWearLines(
  gearId: string,
  spec: ParagliderSpec | undefined,
  sessions: SkySession[]
): string[] {
  const lines: string[] = [];
  const tracked = skyAirtimeHrFor(gearId, sessions);
  const total = paragliderTotalHours(spec ?? { style: 'xc' }, tracked);
  if (total != null) {
    lines.push(
      spec?.hoursBaseline != null
        ? `${round(total)} hr on the wing (${spec.hoursBaseline} hr pre-app baseline)`
        : `${round(total)} hr tracked on the wing`
    );
  }
  if (spec != null) {
    const trim = retrimStatus(spec, skyAirtimeHrFor(gearId, sessions, spec.lastTrimDate?.slice(0, 10)));
    if (trim != null) {
      const since = `${round(trim.hoursSinceTrim)} hr since your ${spec.lastTrimDate!.slice(0, 10)} trim`;
      lines.push(
        trim.pastMark == null
          ? since
          : trim.pastMark
            ? `${since} — past your ${spec.trimNudgeHours} hr mark`
            : `${since}, of your ${spec.trimNudgeHours} hr mark`
      );
    }
  }
  return lines;
}

/**
 * A reserve's repack standing — the same threshold shape as a wear mark,
 * keyed by date instead of hours (profile spec §2). Shows the date and
 * days-elapsed; whether this may ever *remind* is ⚑7, unruled, so nothing
 * here fires — it renders only when the quiver is opened. Undefined when no
 * repack was ever logged: the question was never asked, nothing to report.
 */
export function reserveRepackLine(
  spec: ReserveSpec | undefined,
  today: LocalDate
): string | undefined {
  const last = spec?.lastRepackAt?.slice(0, 10);
  if (spec == null || last == null || Number.isNaN(Date.parse(last))) return undefined;
  const elapsed = daysBetween(last, today);
  const base = `Repacked ${last} — ${elapsed} day${elapsed === 1 ? '' : 's'} ago`;
  const due = repackDueAt(spec);
  if (due == null) return base;
  return today >= due
    ? `${base} — past your ${due} repack date`
    : `${base} · your ${spec.repackIntervalMonths}-month interval marks ${due}`;
}
