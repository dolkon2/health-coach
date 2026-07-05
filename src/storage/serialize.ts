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
import type { GearItem, GearSpec } from '@core/gear';

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

// ─── GearItem ───────────────────────────────────────────────────────────────

export type GearRow = {
  id: string;
  category: string; // queryable copy of spec.category (the discriminator)
  name: string;
  spec: string; // JSON
  acquiredAt: string | null;
  retiredAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * createdAt/updatedAt are storage bookkeeping, not entity fields — GearItem
 * carries no timestamps — so the storage layer passes them in alongside.
 */
export function gearToRow(g: GearItem, createdAt: string, updatedAt: string): GearRow {
  return {
    id: g.id,
    category: g.spec.category,
    name: g.name,
    spec: JSON.stringify(g.spec),
    acquiredAt: g.acquiredAt ?? null,
    retiredAt: g.retiredAt ?? null,
    notes: g.notes ?? null,
    createdAt,
    updatedAt,
  };
}

export function rowToGear(r: GearRow): GearItem {
  return {
    id: r.id,
    name: r.name,
    ...(r.acquiredAt != null ? { acquiredAt: r.acquiredAt } : {}),
    ...(r.retiredAt != null ? { retiredAt: r.retiredAt } : {}),
    ...(r.notes != null ? { notes: r.notes } : {}),
    spec: JSON.parse(r.spec) as GearSpec,
  };
}
