/**
 * spot.ts — the named-place primitive.
 *
 * A Spot is where condition sources hang: a whitewater river section carries
 * its home gauge (picked once per river, then every session on that section
 * freezes from the same gauge); a wind launch carries the coordinates the
 * wind snapshot is fetched for. Session blocks denormalize the names they
 * display, so a renamed or deleted spot never rewrites history.
 */

export interface Spot {
  id: string;
  name: string; // "White Salmon — Green Truss", "Hood River sandbar"
  kind: 'river-section' | 'launch';
  /** Required in practice for 'launch' spots — the wind fetch needs coords. */
  lat?: number;
  lng?: number;
  /** River-section spots. */
  riverName?: string;
  sectionName?: string;
  /** Home gauge, agency-prefixed ('USGS-14123500'). */
  gaugeSiteId?: string;
  notes?: string;
  createdAt: string; // ISO instant
}
