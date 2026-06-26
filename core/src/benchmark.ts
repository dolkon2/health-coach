/**
 * benchmark.ts — The user's stated intent.
 *
 * Benchmarks are first-class records but NOT Observations — they're user-authored
 * goals in the user's own words. No category picker, no "lose weight / build
 * muscle" menu (constitution: "Goals are yours, not ours"). The engine relates
 * inputs to each other, not to a prescribed target.
 *
 * Today foregrounds active benchmarks; past benchmarks become the archive.
 */
import type { ISOInstant, LocalDate, Modality } from './observation';

export type Benchmark = {
  id: string;
  createdAt: ISOInstant;
  resolvedAt?: ISOInstant; // when the user marked it done/abandoned/changed
  status: 'active' | 'achieved' | 'abandoned' | 'paused';
  title: string; // user's own words
  description?: string;
  targetDate?: LocalDate; // optional — for race-style deadlines
  relatedModalities?: Modality[]; // hint to the engine; user-set
};
