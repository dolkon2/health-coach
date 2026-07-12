/**
 * serialize.ts — pure conversions between typed domain objects and SQLite rows.
 *
 * The storage layer reads rows from SQLite and *hydrates* them into the typed
 * shapes the engine expects (constitution: the engine never touches SQLite).
 * JSON columns (source, payload, relatedModalities) are stringified on the way
 * in and parsed on the way out. No I/O here — trivially unit-testable.
 */
import type {
  Observation,
  ObservationSource,
  ObservationPayload,
  Tier,
  Modality,
} from '@core/observation';
import type { Benchmark, BehaviorFace, OutcomeFace } from '@core/benchmark';
import type {
  SessionTemplate,
  TemplateShape,
  TemplateSurface,
} from '@core/sessionTemplate';
import type { SkyGearItem, SkyGearSpec } from '@core/gear';
import type { Spot } from '@core/spot';
import type { Route, RoutePoint, RouteSource } from '@core/route';
import type { SkyConditionsSnapshot } from '@core/skyConditions';

// ─── Observation ────────────────────────────────────────────────────────────

export type ObservationRow = {
  id: string;
  kind: string;
  occurredAt: string;
  loggedAt: string;
  tz: string;
  tier: number;
  fidelity: number;
  source: string; // JSON
  payload: string; // JSON
  notes: string | null;
  supersedes: string | null;
};

export function observationToRow(o: Observation): ObservationRow {
  return {
    id: o.id,
    kind: o.kind,
    occurredAt: o.occurredAt,
    loggedAt: o.loggedAt,
    tz: o.tz,
    tier: o.tier,
    fidelity: o.fidelity,
    source: JSON.stringify(o.source),
    payload: JSON.stringify(o.payload),
    notes: o.notes ?? null,
    supersedes: o.supersedes ?? null,
  };
}

export function rowToObservation(r: ObservationRow): Observation {
  return {
    id: r.id,
    kind: r.kind as Observation['kind'],
    occurredAt: r.occurredAt,
    loggedAt: r.loggedAt,
    tz: r.tz,
    tier: r.tier as Tier,
    fidelity: r.fidelity,
    source: JSON.parse(r.source) as ObservationSource,
    payload: JSON.parse(r.payload) as ObservationPayload,
    ...(r.notes != null ? { notes: r.notes } : {}),
    ...(r.supersedes != null ? { supersedes: r.supersedes } : {}),
  };
}

// ─── Benchmark ──────────────────────────────────────────────────────────────

export type BenchmarkRow = {
  id: string;
  createdAt: string;
  resolvedAt: string | null;
  status: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  relatedModalities: string | null; // JSON array
  behavior: string | null; // JSON BehaviorFace — the face you control
  outcome: string | null; // JSON OutcomeFace — the face you watch
  pinned: number; // 0 | 1
};

export function benchmarkToRow(b: Benchmark): BenchmarkRow {
  // The v0.4 existence gate: a benchmark IS its faces — writing one with
  // neither is a bug upstream, never a row.
  if (!b.behavior && !b.outcome) {
    throw new Error(`benchmark ${b.id} has neither a behavior nor an outcome face`);
  }
  return {
    id: b.id,
    createdAt: b.createdAt,
    resolvedAt: b.resolvedAt ?? null,
    status: b.status,
    title: b.title,
    description: b.description ?? null,
    targetDate: b.targetDate ?? null,
    relatedModalities: b.relatedModalities ? JSON.stringify(b.relatedModalities) : null,
    behavior: b.behavior ? JSON.stringify(b.behavior) : null,
    outcome: b.outcome ? JSON.stringify(b.outcome) : null,
    pinned: b.pinned ? 1 : 0,
  };
}

export function rowToBenchmark(r: BenchmarkRow): Benchmark {
  return {
    id: r.id,
    createdAt: r.createdAt,
    ...(r.resolvedAt != null ? { resolvedAt: r.resolvedAt } : {}),
    status: r.status as Benchmark['status'],
    title: r.title,
    ...(r.description != null ? { description: r.description } : {}),
    ...(r.targetDate != null ? { targetDate: r.targetDate } : {}),
    ...(r.relatedModalities != null
      ? { relatedModalities: JSON.parse(r.relatedModalities) as Modality[] }
      : {}),
    ...(r.behavior != null ? { behavior: JSON.parse(r.behavior) as BehaviorFace } : {}),
    ...(r.outcome != null ? { outcome: JSON.parse(r.outcome) as OutcomeFace } : {}),
    pinned: r.pinned === 1,
  };
}

// ─── SessionTemplate ────────────────────────────────────────────────────────

export type SessionTemplateRow = {
  id: string;
  name: string;
  surface: string;
  activity: string;
  shape: string; // JSON
  dayAssignment: number | null;
  isActive: number; // 0 | 1
  createdAt: string;
  updatedAt: string;
};

export function sessionTemplateToRow(t: SessionTemplate): SessionTemplateRow {
  return {
    id: t.id,
    name: t.name,
    surface: t.surface,
    activity: t.activity,
    shape: JSON.stringify(t.shape),
    dayAssignment: t.dayAssignment ?? null,
    isActive: t.isActive ? 1 : 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export function rowToSessionTemplate(r: SessionTemplateRow): SessionTemplate {
  return {
    id: r.id,
    name: r.name,
    surface: r.surface as TemplateSurface,
    activity: r.activity,
    shape: JSON.parse(r.shape) as TemplateShape,
    ...(r.dayAssignment != null ? { dayAssignment: r.dayAssignment } : {}),
    isActive: r.isActive === 1,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// ─── Sky gear (SkyGearItem view — see storage/gear.ts for the others) ───────

export type GearRow = {
  id: string;
  category: string; // top-level discriminator (column name unchanged by the flatten)
  name: string;
  spec: string; // JSON — bespoke fields only; category no longer duplicated inside
  acquiredOn: string | null;
  retiredOn: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null; // nullable in the canonical table (only Sky's API stamps it)
};

/**
 * createdAt/updatedAt are storage bookkeeping, not entity fields — SkyGearItem
 * carries no timestamps — so the storage layer passes them in alongside.
 * `spec` is optional on SkyGearItem (matches earth/water); an absent spec
 * serializes to '{}' (Sky's original NOT NULL convention, harmless now).
 */
export function gearToRow(g: SkyGearItem, createdAt: string, updatedAt: string): GearRow {
  return {
    id: g.id,
    category: g.category,
    name: g.name,
    spec: JSON.stringify(g.spec ?? {}),
    acquiredOn: g.acquiredOn ?? null,
    retiredOn: g.retiredOn ?? null,
    notes: g.notes ?? null,
    createdAt,
    updatedAt,
  };
}

export function rowToGear(r: GearRow): SkyGearItem {
  const parsed = r.spec != null ? (JSON.parse(r.spec) as SkyGearSpec) : null;
  const hasSpec = parsed !== null && typeof parsed === 'object' && Object.keys(parsed).length > 0;
  return {
    id: r.id,
    name: r.name,
    category: r.category as SkyGearItem['category'],
    ...(hasSpec ? { spec: parsed } : {}),
    ...(r.acquiredOn != null ? { acquiredOn: r.acquiredOn } : {}),
    ...(r.retiredOn != null ? { retiredOn: r.retiredOn } : {}),
    ...(r.notes != null ? { notes: r.notes } : {}),
  } as SkyGearItem;
}

// ─── Spot ───────────────────────────────────────────────────────────────────

export type SpotRow = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  kind: string;
  sport: string | null; // migration 015
  meta: string | null; // JSON
  riverName: string | null;
  sectionName: string | null;
  gaugeSiteId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * createdAt/updatedAt are storage bookkeeping — the storage layer passes them
 * in alongside (a Spot read back from the table carries createdAt; a fresh
 * one may not).
 */
export function spotToRow(s: Spot, createdAt: string, updatedAt: string): SpotRow {
  return {
    id: s.id,
    name: s.name,
    lat: s.lat ?? null,
    lng: s.lng ?? null,
    kind: s.kind,
    sport: s.sport ?? null,
    meta: s.meta ? JSON.stringify(s.meta) : null,
    riverName: s.riverName ?? null,
    sectionName: s.sectionName ?? null,
    gaugeSiteId: s.gaugeSiteId ?? null,
    notes: s.notes ?? null,
    createdAt,
    updatedAt,
  };
}

export function rowToSpot(r: SpotRow): Spot {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    // Omit-when-absent — a spot without coords stays coord-less (null ≠ 0).
    ...(r.lat !== null ? { lat: r.lat } : {}),
    ...(r.lng !== null ? { lng: r.lng } : {}),
    ...(r.sport ? { sport: r.sport } : {}),
    ...(r.meta != null ? { meta: JSON.parse(r.meta) as Record<string, unknown> } : {}),
    ...(r.riverName ? { riverName: r.riverName } : {}),
    ...(r.sectionName ? { sectionName: r.sectionName } : {}),
    ...(r.gaugeSiteId ? { gaugeSiteId: r.gaugeSiteId } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    createdAt: r.createdAt,
  };
}

// ─── Route ──────────────────────────────────────────────────────────────────

export type RouteRow = {
  id: string;
  name: string;
  activityId: string;
  source: string;
  points: string; // JSON RoutePoint[]
  visibility: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export function routeToRow(r: Route, createdAt: string, updatedAt: string): RouteRow {
  return {
    id: r.id,
    name: r.name,
    activityId: r.activityId,
    source: r.source,
    points: JSON.stringify(r.points),
    visibility: r.visibility,
    notes: r.notes ?? null,
    createdAt,
    updatedAt,
  };
}

export function rowToRoute(r: RouteRow): Route {
  return {
    id: r.id,
    name: r.name,
    activityId: r.activityId,
    source: r.source as RouteSource,
    points: JSON.parse(r.points) as RoutePoint[],
    visibility: r.visibility,
    ...(r.notes ? { notes: r.notes } : {}),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// ─── ConditionsSnapshot ─────────────────────────────────────────────────────

export type SkyConditionsSnapshotRow = {
  id: string;
  spotId: string;
  capturedAt: string;
  dateLocal: string;
  source: string;
  surface: string | null; // JSON
  aloft: string | null; // JSON
};

export function conditionsSnapshotToRow(s: SkyConditionsSnapshot): SkyConditionsSnapshotRow {
  return {
    id: s.id,
    spotId: s.spotId,
    capturedAt: s.capturedAt,
    dateLocal: s.dateLocal,
    source: s.source,
    surface: s.surface ? JSON.stringify(s.surface) : null,
    aloft: s.aloft ? JSON.stringify(s.aloft) : null,
  };
}

export function rowToSkyConditionsSnapshot(r: SkyConditionsSnapshotRow): SkyConditionsSnapshot {
  return {
    id: r.id,
    spotId: r.spotId,
    capturedAt: r.capturedAt,
    dateLocal: r.dateLocal,
    source: r.source as SkyConditionsSnapshot['source'],
    ...(r.surface != null
      ? { surface: JSON.parse(r.surface) as SkyConditionsSnapshot['surface'] }
      : {}),
    ...(r.aloft != null ? { aloft: JSON.parse(r.aloft) as SkyConditionsSnapshot['aloft'] } : {}),
  };
}
