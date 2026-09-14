/**
 * Copilot session - generation lock, pause/takeover, telepresence events.
 * Agents attach to a board by short pairCode (not by opening a new tab).
 */
import { CANVAS_AGENT_OPS, runCanvasOp } from './canvasAgent.js';
import {
  applyTitlePair,
  findBoard,
  listBoards,
  newPairCode,
  removeBoard,
  upsertBoard,
} from './copilotRegistry.js';

const CHANNEL = 'glint-copilot';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function newToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `copilot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function newTabId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function storage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ getCtx: () => object, onDirty?: () => void, getMeta?: () => object }} opts
 */
export function createCopilotSession({ getCtx, onDirty, getMeta } = {}) {
  let enabled = false;
  let paused = true;
  let token = null;
  let pairCode = null;
  let tabId = newTabId();
  let generation = 0;
  let applying = false;
  let status = null;
  let baseTitle = typeof document !== 'undefined' ? document.title : '';
  const listeners = new Set();
  let heartbeat = null;

  const emit = (event) => {
    status = event;
    for (const fn of listeners) {
      try {
        fn(event);
      } catch {
        /* ignore listener errors */
      }
    }
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(CHANNEL);
        bc.postMessage({ type: 'glint-copilot-event', ...event });
        bc.close();
      }
    } catch {
      /* SSR / restricted */
    }
  };

  const publishRegistry = (focused) => {
    const store = storage();
    if (!store || !enabled || !pairCode) return;
    const meta = getMeta?.() || {};
    upsertBoard(store, {
      tabId,
      pairCode,
      token,
      href: typeof location !== 'undefined' ? location.href : '',
      title: typeof document !== 'undefined' ? document.title : '',
      frameCount: meta.frameCount ?? null,
      templateId: meta.templateId ?? null,
      enabled: true,
      focused: focused ?? (typeof document !== 'undefined' ? document.hasFocus() : true),
      updatedAt: Date.now(),
    });
  };

  const clearRegistry = () => {
    const store = storage();
    if (!store) return;
    removeBoard(store, tabId);
  };

  const syncTitle = () => {
    if (typeof document === 'undefined') return;
    document.title = applyTitlePair(baseTitle || document.title, enabled ? pairCode : null);
  };

  const api = {
    get enabled() {
      return enabled;
    },
    get paused() {
      return paused;
    },
    get token() {
      return token;
    },
    get pairCode() {
      return pairCode;
    },
    get tabId() {
      return tabId;
    },
    get generation() {
      return generation;
    },
    get applying() {
      return applying;
    },
    get status() {
      return status;
    },
    get ops() {
      return [...CANVAS_AGENT_OPS];
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Human (or successful agent) mutate - agents must re-getEditorState. */
    bump(reason = 'edit') {
      generation += 1;
      publishRegistry();
      emit({ phase: 'generation', generation, reason, pairCode, at: Date.now() });
      return generation;
    },

    enable() {
      enabled = true;
      paused = false;
      token = newToken();
      pairCode = newPairCode();
      if (typeof document !== 'undefined') baseTitle = document.title.replace(/^\[Glint [A-Z0-9]{4}\]\s*/, '');
      syncTitle();
      publishRegistry(true);
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = setInterval(() => publishRegistry(), 8_000);
      emit({
        phase: 'session',
        enabled: true,
        paused: false,
        token,
        pairCode,
        generation,
        at: Date.now(),
      });
      return { token, pairCode, generation };
    },

    disable() {
      enabled = false;
      paused = true;
      token = null;
      pairCode = null;
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      clearRegistry();
      syncTitle();
      emit({
        phase: 'session',
        enabled: false,
        paused: true,
        token: null,
        pairCode: null,
        generation,
        at: Date.now(),
      });
    },

    pause() {
      paused = true;
      publishRegistry();
      emit({ phase: 'session', enabled, paused: true, token, pairCode, generation, at: Date.now() });
    },

    resume() {
      if (!enabled) return false;
      paused = false;
      publishRegistry(true);
      emit({ phase: 'session', enabled: true, paused: false, token, pairCode, generation, at: Date.now() });
      return true;
    },

    setFocused(focused) {
      if (!enabled) return;
      publishRegistry(!!focused);
    },

    getState() {
      return {
        ok: true,
        generation,
        enabled,
        paused,
        token: enabled ? token : null,
        pairCode: enabled ? pairCode : null,
        tabId,
        ops: [...CANVAS_AGENT_OPS],
      };
    },

    async getEditorState() {
      const ctx = getCtx?.();
      if (!ctx) return { ok: false, error: 'no_ctx', generation };
      const res = await runCanvasOp(ctx, 'getEditorState', {});
      return { ...res, generation, enabled, paused, pairCode, tabId };
    },

    /**
     * @param {string} op
     * @param {object} args
     * @param {{ present?: boolean, paceMs?: number, expectedGeneration?: number, token?: string, pairCode?: string }} opts
     */
    async dispatch(op, args = {}, opts = {}) {
      const {
        present = true,
        paceMs = 380,
        expectedGeneration = null,
        token: callerToken = null,
        pairCode: callerPair = null,
      } = opts;

      if (!enabled) return { ok: false, error: 'session_disabled' };
      if (paused) return { ok: false, error: 'paused' };
      if (callerToken && callerToken !== token) return { ok: false, error: 'bad_token' };
      if (callerPair && String(callerPair).toUpperCase() !== pairCode) {
        return { ok: false, error: 'bad_pair_code', pairCode };
      }
      if (expectedGeneration != null && expectedGeneration !== generation) {
        return {
          ok: false,
          error: 'stale_generation',
          generation,
          expectedGeneration,
        };
      }

      const ctx = getCtx?.();
      if (!ctx) return { ok: false, error: 'no_ctx' };

      const label = describeOp(op, args);
      applying = true;
      emit({
        phase: 'select',
        op,
        args,
        label,
        frameIndex: args.frameIndex ?? args.index ?? args.sourceIndex,
        present,
        generation,
        pairCode,
        at: Date.now(),
      });

      if (present && paceMs > 0) await sleep(paceMs);

      if (paused) {
        applying = false;
        emit({ phase: 'aborted', op, reason: 'paused', at: Date.now() });
        return { ok: false, error: 'paused' };
      }

      emit({
        phase: 'apply',
        op,
        args,
        label,
        frameIndex: args.frameIndex ?? args.index ?? args.sourceIndex,
        present,
        generation,
        pairCode,
        at: Date.now(),
      });

      let result;
      try {
        result = await runCanvasOp(ctx, op, args);
      } catch (err) {
        applying = false;
        emit({ phase: 'error', op, error: String(err?.message || err), at: Date.now() });
        return { ok: false, error: 'op_threw', detail: String(err?.message || err) };
      }

      if (result?.ok && op !== 'getEditorState' && op !== 'selectFrame' && op !== 'selectDevice') {
        generation += 1;
        onDirty?.();
        publishRegistry();
      }

      applying = false;
      emit({
        phase: 'done',
        op,
        args,
        label,
        result,
        generation,
        pairCode,
        at: Date.now(),
      });

      return { ...result, generation, pairCode };
    },
  };

  return api;
}

function describeOp(op, args) {
  switch (op) {
    case 'selectFrame':
      return `Select Frame ${(args.frameIndex ?? args.index ?? 0) + 1}`;
    case 'selectDevice':
      return `Select device on Frame ${(args.frameIndex ?? args.index ?? 0) + 1}`;
    case 'setDeviceScale':
      return `Scale → ${args.pct ?? args.scalePct}%`;
    case 'setDeviceAngle':
      return `Rotation → ${args.degrees ?? args.angle}°`;
    case 'setScreenshot':
      return args.url ? 'Replace screenshot' : 'Clear screenshot';
    case 'matchDeviceTransform':
      return `Match transform from Frame ${(args.sourceIndex ?? 0) + 1}`;
    case 'getEditorState':
      return 'Read editor state';
    default:
      return op;
  }
}

/** Attach a stable bridge on window for local agents / browser tools / future MCP. */
export function installCopilotBridge(session) {
  if (typeof window === 'undefined') return () => {};

  const bridge = {
    channel: CHANNEL,
    /** Prefer this: list open Allow-agent boards in this browser profile. */
    listBoards: () => {
      const store = storage();
      return store ? listBoards(store) : [];
    },
    findBoard: (pairCode) => {
      const store = storage();
      return store ? findBoard(store, pairCode) : null;
    },
    /**
     * True if this tab owns the pair code. Agents must drive THIS tab's window,
     * not open a new Glint Web URL.
     */
    isThisBoard: (pairCode) =>
      !!(session.enabled && pairCode && String(pairCode).toUpperCase() === session.pairCode),
    get enabled() {
      return session.enabled;
    },
    get generation() {
      return session.generation;
    },
    get pairCode() {
      return session.enabled ? session.pairCode : null;
    },
    getToken: () => (session.enabled ? session.token : null),
    getState: () => session.getState(),
    getEditorState: () => session.getEditorState(),
    dispatch: (op, args, opts) => session.dispatch(op, args, opts),
    ops: () => session.ops,
  };

  window.__GLINT_COPILOT__ = bridge;

  const onFocus = () => session.setFocused?.(true);
  const onBlur = () => session.setFocused?.(false);
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);

  return () => {
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('blur', onBlur);
    if (window.__GLINT_COPILOT__ === bridge) delete window.__GLINT_COPILOT__;
    session.disable();
  };
}
