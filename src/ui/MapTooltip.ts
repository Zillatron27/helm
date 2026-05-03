/**
 * Floating tooltip for map-canvas hover targets. Single shared element
 * appended to document.body on first use, positioned at viewport
 * coordinates (the caller passes screen-space x/y from the Pixi event's
 * globalX / globalY). Anchored bottom-centre so the body sits above and
 * centred on the hovered point.
 *
 * Styled as a floating panel via panel-common.css to match the rest of
 * the app. Pointer-events disabled so the tooltip never intercepts the
 * hover that's keeping it open.
 */

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
  el.style.left = `${screenX}px`;
  el.style.top = `${screenY}px`;
  el.classList.add("map-tooltip-visible");
}

export function hideMapTooltip(): void {
  if (!tooltipEl) return;
  tooltipEl.classList.remove("map-tooltip-visible");
}
