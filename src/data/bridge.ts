/**
 * Helm Extension bridge — reception layer.
 *
 * Receives bridge envelopes from the Helm Extension via window.postMessage,
 * validates origin and version compatibility, and exposes snapshot state via
 * the state.ts subscription pattern.
 *
 * Both tiers use postMessage. Helm never calls chrome.runtime directly:
 *   - Tier 3 (embedded in APEX iframe): post to / receive from window.parent.
 *   - Tier 2 (standalone tab): post to / receive from window.self; the
 *     extension's helm.content.ts content script bridges same-window posts
 *     to/from the background service worker.
 *
 * See helm-extension-bridge-protocol.md §3 (handshake) and §4 (envelopes).
 */

import { PROTOCOL_VERSION, checkProtocolCompatibility } from "./protocol.js";
import { setBridgeSnapshot, getBridgeSnapshot } from "../ui/state.js";
import type {
  BridgeSnapshot,
  HelmExtensionHelloMessage,
  HelmInitMessage,
  HelmUpdateMessage,
} from "./bridge-types.js";

const APEX_ORIGINS = ["https://apex.prosperousuniverse.com"];

// Envelope types Helm should accept inbound (extension → Helm).
// Helm only sends helm-extension-hello-ack in Phase 3, so the inbound
// whitelist is sufficient to drop tier-2 same-window outbound echoes.
//
// Phase 4 note: when Helm starts emitting helm-settings-update, this
// whitelist alone won't distinguish Helm's own outbound echoes (in tier 2
// same-window post) from legitimate inbound. At that point either tag
// outbound with __sender:'helm' (envelope-field pollution accepted by
// helm.content.ts since isBridgeEnvelope ignores extra fields), or change
// the extension to use a wrapped format that the content script unwraps.
const INBOUND_TYPES = new Set<string>([
  "helm-extension-hello",
  "helm-init",
  "helm-update",
]);

const HANDSHAKE_DIAGNOSTIC_TIMEOUT_MS = 3000;

let initialized = false;
let parentSource: Window | null = null;
let parentOrigin: string | null = null;
let handshakeComplete = false;

function detectTier(): 2 | 3 {
  return window.self !== window.top ? 3 : 2;
}

interface BridgeBootstrap {
  drain: () => MessageEvent[];
}

export function initBridge(): void {
  if (initialized) return;
  initialized = true;

  // Drain any envelopes buffered by the inline bootstrap in index.html
  // before attaching the real listener. The bootstrap's own listener is
  // removed inside drain(), so there's no double-dispatch window.
  const w = window as unknown as { __helmBridgeBootstrap?: BridgeBootstrap };
  const buffered = w.__helmBridgeBootstrap?.drain() ?? [];
  delete w.__helmBridgeBootstrap;

  window.addEventListener("message", handleMessage);

  for (const ev of buffered) handleMessage(ev);

  // Local diagnostic timer — NOT a protocol timeout. The protocol §3.3
  // timeout is enforced extension-side. Distinguishes three cases at the
  // 3s mark: handshake completed, bridge active via replay (hello missed
  // but init arrived), or genuinely no extension.
  setTimeout(() => {
    if (handshakeComplete) return;
    if (getBridgeSnapshot() !== null) {
      console.log(
        "[Helm Bridge] bridge active but hello was not acked — extension detected via replay",
      );
      return;
    }
    console.log(
      "[Helm Bridge] no extension detected after 3s (tier-1 standalone path)",
    );
  }, HANDSHAKE_DIAGNOSTIC_TIMEOUT_MS);
}

function handleMessage(event: MessageEvent): void {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  const type = (data as { type?: unknown }).type;
  if (typeof type !== "string") return;

  if (!INBOUND_TYPES.has(type)) return;

  const tier = detectTier();
  if (tier === 3) {
    if (event.source !== window.parent) return;
    if (!APEX_ORIGINS.includes(event.origin)) return;
  } else {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
  }

  if (type === "helm-extension-hello") {
    handleHello(event, data as HelmExtensionHelloMessage);
  } else if (type === "helm-init") {
    handleInit(data as HelmInitMessage);
  } else if (type === "helm-update") {
    handleUpdate(data as HelmUpdateMessage);
  }
}

function handleHello(event: MessageEvent, msg: HelmExtensionHelloMessage): void {
  const compat = checkProtocolCompatibility(msg.version);
  if (compat.kind === "unparseable") {
    console.error(
      "[Helm Bridge] unparseable protocol version from extension:",
      compat.raw,
    );
    return;
  }
  if (compat.kind === "major-mismatch") {
    console.error(
      `[Helm Bridge] protocol MAJOR mismatch — local=${PROTOCOL_VERSION} remote=v${compat.remote.major}.${compat.remote.minor}.${compat.remote.patch}; aborting handshake`,
    );
    return;
  }
  if (compat.kind === "minor-mismatch") {
    console.warn(
      `[Helm Bridge] protocol MINOR mismatch — local=${PROTOCOL_VERSION} remote=v${compat.remote.major}.${compat.remote.minor}.${compat.remote.patch}; proceeding`,
    );
  }

  const tier = detectTier();
  // Capture parent reply target from the inbound hello (tier 3 only).
  // Avoids depending on document.referrer, which can be blank under
  // Referrer-Policy: no-referrer.
  if (tier === 3) {
    parentSource = event.source as Window;
    parentOrigin = event.origin;
  }

  console.log(
    `[Helm Bridge] received helm-extension-hello ${msg.version}; replying ack tier=${tier}`,
  );
  sendAck(tier);
  handshakeComplete = true;
}

function sendAck(tier: 2 | 3): void {
  // Always include explicit tier — extension's handshake.ts defaults missing
  // tier to 3, which would mis-classify a tier-2 standalone tab.
  const ack = {
    type: "helm-extension-hello-ack" as const,
    version: PROTOCOL_VERSION,
    tier,
  };
  if (tier === 3 && parentSource && parentOrigin) {
    parentSource.postMessage(ack, parentOrigin);
  } else {
    window.postMessage(ack, window.location.origin);
  }
}

function handleInit(msg: HelmInitMessage): void {
  console.log("[Helm Bridge] received helm-init", msg.snapshot);
  setBridgeSnapshot(msg.snapshot);
}

function handleUpdate(msg: HelmUpdateMessage): void {
  const current = getBridgeSnapshot();
  if (!current) {
    console.warn(
      "[Helm Bridge] received helm-update before helm-init; ignoring",
    );
    return;
  }
  console.log(
    `[Helm Bridge] received helm-update entityType=${msg.update.entityType}`,
  );
  const merged = {
    ...current,
    [msg.update.entityType]: msg.update.data,
    timestamp: msg.update.timestamp,
  } as BridgeSnapshot;
  setBridgeSnapshot(merged);
}
