/**
 * Floating tooltip for map-canvas hover targets. Single shared element
 * appended to document.body on first use, positioned at viewport
 * coordinates (the caller passes screen-space x/y from the Pixi event's
 * globalX / globalY).
 *
 * Default anchor: above-and-centred on the hovered point. If there
 * isn't room above (near the top of the viewport), it flips below.
 * Horizontal overflow is clamped so the tooltip stays inside the
 * viewport even when the hovered point is near a screen edge.
 *
 * Styled as a floating panel via map-tooltip.css to match the rest of
 * the app. Pointer-events disabled so the tooltip never intercepts the
 * hover that's keeping it open.
 */

const ANCHOR_GAP = 8;
const VIEWPORT_PADDING = 8;

let tooltipEl: HTMLDivElement | null = null;

function ensureElement(): HTMLDivElement {
  if (tooltipEl) return tooltipEl;
  const el = document.createElement("div");
  el.className = "map-tooltip";
  document.body.appendChild(el);
  tooltipEl = el;
  return el;
}

export interface MapTooltipContent {
  /** Top line, rendered in the Audiowide display font in accent colour. */
  header: string;
  /** Body lines, rendered in IBM Plex Mono. */
  lines: string[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function showMapTooltip(
  screenX: number,
  screenY: number,
  content: MapTooltipContent,
): void {
  const el = ensureElement();
  const headerHtml = `<div class="map-tooltip-header">${escapeHtml(content.header)}</div>`;
  const linesHtml = content.lines
    .map((l) => `<div class="map-tooltip-line">${escapeHtml(l)}</div>`)
    .join("");
  el.innerHTML = headerHtml + linesHtml;

  // Make visible so getBoundingClientRect returns layout dimensions.
  // The tooltip is pointer-events: none so this can't trap the hover.
  el.classList.add("map-tooltip-visible");

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = el.getBoundingClientRect();

  // Default: above-and-centred. Flip below if no room above.
  let left = screenX - rect.width / 2;
  let top = screenY - rect.height - ANCHOR_GAP;
  if (top < VIEWPORT_PADDING) {
    top = screenY + ANCHOR_GAP;
  }

  // Horizontal clamp.
  const maxLeft = vw - VIEWPORT_PADDING - rect.width;
  if (left > maxLeft) left = maxLeft;
  if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;

  // Vertical clamp — only triggers if neither above nor below fully fit.
  const maxTop = vh - VIEWPORT_PADDING - rect.height;
  if (top > maxTop) top = maxTop;
  if (top < VIEWPORT_PADDING) top = VIEWPORT_PADDING;

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

export function hideMapTooltip(): void {
  if (!tooltipEl) return;
  tooltipEl.classList.remove("map-tooltip-visible");
}
