/** Yield to the browser so it can paint a frame. Uses rAF to guarantee
 *  the yield aligns with the paint cycle (setTimeout doesn't guarantee paint). */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
