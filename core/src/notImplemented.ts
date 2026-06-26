/**
 * Honest placeholder. The constitution forbids fabricated numbers — so an
 * engine that hasn't been built yet must fail loudly, never return a plausible
 * lie. Each engine is implemented in the pass noted at its call site.
 */
export function notImplemented(engine: string, pass: string): never {
  throw new Error(
    `[core] ${engine} is not implemented yet — built in ${pass}. ` +
      `This is a deliberate honest placeholder, not a bug to paper over with a fake value.`
  );
}
