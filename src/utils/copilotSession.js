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
/** Per-tab: survive reload/HMR until user hits Close on Copilot. */
const PERSIST_KEY = 'glint.copilot.tab.v1';

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

function tabStorage() {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

function readPersistedSession() {
  const store = tabStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(PERSIST_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.enabled || !data?.pairCode || !data?.token || !data?.tabId) return null;
    return data;
  } catch {
    return null;
  }
}

function writePersistedSession(snapshot) {
  const store = tabStorage();
  if (!store) return;
  try {
    if (!snapshot?.enabled) {
      store.removeItem(PERSIST_KEY);
      return;
    }
    store.setItem(PERSIST_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota / private mode */
  }
}

/**
 * @param {{ getCtx: () => object, onDirty?: () => void, getMeta?: () => object }} opts
 */
export function createCopilotSession({ getCtx, onDirty, getMeta } = {}) {
  const restored = readPersistedSession();
  let enabled = !!restored?.enabled;
  let paused = restored ? !!restored.paused : true;
  let token = restored?.token || null;
  let pairCode = restored?.pairCode || null;
  let tabId = restored?.tabId || newTabId();
  let generation = Number.isFinite(restored?.generation) ? restored.generation : 0;
  let applying = false;
  let status = null;
  let baseTitle = typeof document !== 'undefined' ? document.title : '';
  const listeners = new Set();
  let heartbeat = null;

  const persist = () => {
    writePersistedSession(
      enabled
        ? { enabled: true, paused, token, pairCode, tabId, generation }
        : null,
    );
  };

  const startHeartbeat = () => {
    if (heartbeat) clearInterval(heartbeat);
    if (!enabled) return;
    heartbeat = setInterval(() => publishRegistry(), 8_000);
  };

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
      persist();
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
      persist();
      publishRegistry(true);
      startHeartbeat();
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

    /** User Close - stop agent access for this tab. */
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
      writePersistedSession(null);
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

    /**
     * React unmount / HMR - keep Allow-agent intent in sessionStorage.
     * Does not clear pair code; next mount restores.
     */
    hibernate() {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      persist();
    },

    pause() {
      paused = true;
      persist();
      publishRegistry();
      emit({ phase: 'session', enabled, paused: true, token, pairCode, generation, at: Date.now() });
    },

    resume() {
      if (!enabled) return false;
      paused = false;
      persist();
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
        paceMs = 420,
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

      // Present match across frames with the agent cursor (not a silent bulk apply).
      if (op === 'matchDeviceTransform' && present) {
        return runBoardMatch(ctx, args, { paceMs });
      }
      // Board-wide bezel / chrome: sidebar first, then one artboard at a time under the cursor.
      if (op === 'setDeviceBezel' && present && args.frameIndex == null) {
        return runPresentedBoardWalk(ctx, {
          op,
          args,
          paceMs,
          uiTarget: `device-frame:${args.bezelId ?? args.frameId ?? args.id ?? 'none'}`,
          uiLabel: describeOp(op, args),
          perFrame: (frameIndex) => runCanvasOp(ctx, 'setDeviceBezel', { ...args, frameIndex }),
        });
      }
      if (op === 'setScreenshotStyle' && present && args.frameIndex == null) {
        const theme = args.statusBarTheme || args.patch?.statusBarTheme;
        const uiTarget = theme
          ? `status-bar-theme:${theme}`
          : args.statusBarEnabled != null || args.patch?.statusBarEnabled != null
            ? 'status-bar-toggle'
            : 'tab-device';
        return runPresentedBoardWalk(ctx, {
          op,
          args,
          paceMs,
          uiTarget,
          uiLabel: describeOp(op, args),
          perFrame: (frameIndex) => runCanvasOp(ctx, 'setScreenshotStyle', { ...args, frameIndex }),
        });
      }
      if (op === 'remapColors' && present && args.frameIndex == null) {
        return runPresentedBoardWalk(ctx, {
          op,
          args,
          paceMs,
          uiTarget: 'tab-colors',
          uiLabel: describeOp(op, args),
          // Color remap is global; walk artboards under the cursor after one apply.
          beforeWalk: () => runCanvasOp(ctx, 'remapColors', args),
          perFrame: async () => ({ ok: true }),
        });
      }

      return runPresentedOp(ctx, op, args, { present, paceMs });
    },

    /**
     * Match active (or source) frame transform across the board with cursor travel.
     * Shared knowledge: one source → all other frames, left to right.
     */
    async boardPass(opts = {}) {
      const state = await api.getEditorState();
      if (!state.ok) return state;
      const sourceIndex =
        opts.sourceIndex != null
          ? opts.sourceIndex
          : state.state?.activeIndex >= 0
            ? state.state.activeIndex
            : 0;
      return api.dispatch(
        'matchDeviceTransform',
        {
          sourceIndex,
          targetIndexes: opts.targetIndexes ?? null,
        },
        {
          present: true,
          paceMs: opts.paceMs ?? 440,
          token: opts.token,
          pairCode: opts.pairCode ?? pairCode,
          expectedGeneration: opts.expectedGeneration ?? generation,
        },
      );
    },
  };

  async function runPresentedBoardWalk(ctx, {
    op,
    args,
    paceMs,
    uiTarget,
    uiLabel,
    beforeWalk,
    perFrame,
  }) {
    applying = true;
    const frames = ctx.getFrames?.() || [];
    const count = frames.length;

    if (uiTarget) {
      emit({
        phase: 'select',
        op,
        args,
        label: uiLabel || describeOp(op, args),
        uiTarget,
        present: true,
        generation,
        pairCode,
        at: Date.now(),
      });
      if (paceMs > 0) await sleep(paceMs);
      if (paused) {
        applying = false;
        emit({ phase: 'aborted', op, reason: 'paused', at: Date.now() });
        return { ok: false, error: 'paused' };
      }
      emit({
        phase: 'apply',
        op,
        args,
        label: uiLabel || describeOp(op, args),
        uiTarget,
        present: true,
        generation,
        pairCode,
        at: Date.now(),
      });
      if (paceMs > 0) await sleep(Math.round(paceMs * 0.4));
    }

    let prelude = { ok: true };
    if (beforeWalk) {
      try {
        prelude = await beforeWalk();
      } catch (err) {
        applying = false;
        emit({ phase: 'error', op, error: String(err?.message || err), at: Date.now() });
        return { ok: false, error: 'op_threw', detail: String(err?.message || err) };
      }
      if (!prelude?.ok) {
        applying = false;
        emit({ phase: 'error', op, error: prelude?.error || 'failed', at: Date.now() });
        return { ...prelude, generation, pairCode };
      }
    }

    const applied = [];
    for (let frameIndex = 0; frameIndex < count; frameIndex++) {
      if (paused) {
        applying = false;
        emit({ phase: 'aborted', op, reason: 'paused', applied, at: Date.now() });
        return { ok: false, error: 'paused', applied, generation, pairCode };
      }

      emit({
        phase: 'select',
        op,
        args: { ...args, frameIndex },
        label: `Frame ${frameIndex + 1}`,
        frameIndex,
        present: true,
        generation,
        pairCode,
        at: Date.now(),
      });
      await runCanvasOp(ctx, 'selectFrame', { frameIndex });
      if (paceMs > 0) await sleep(Math.round(paceMs * 0.45));

      emit({
        phase: 'apply',
        op,
        args: { ...args, frameIndex },
        label: `${uiLabel || describeOp(op, args)} · Frame ${frameIndex + 1}`,
        frameIndex,
        present: true,
        generation,
        pairCode,
        at: Date.now(),
      });

      let result;
      try {
        result = await perFrame(frameIndex);
      } catch (err) {
        applying = false;
        emit({ phase: 'error', op, error: String(err?.message || err), frameIndex, at: Date.now() });
        return { ok: false, error: 'op_threw', detail: String(err?.message || err), applied };
      }
      if (result?.ok) applied.push({ frameIndex, ...result });
      if (paceMs > 0) await sleep(Math.round(paceMs * 0.35));
    }

    generation += 1;
    onDirty?.();
    persist();
    publishRegistry();
    applying = false;
    const result = { ok: true, applied, ...(prelude?.ok ? {} : { prelude }) };
    emit({
      phase: 'done',
      op,
      args,
      label: uiLabel || describeOp(op, args),
      result,
      generation,
      pairCode,
      at: Date.now(),
    });
    return { ...result, generation, pairCode };
  }

  async function runPresentedOp(ctx, op, args, { present, paceMs }) {
    const label = describeOp(op, args);
    const frameIndex = args.frameIndex ?? args.index ?? args.sourceIndex;
    applying = true;
    emit({
      phase: 'select',
      op,
      args,
      label,
      frameIndex,
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
      frameIndex,
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
      frameIndex,
      generation,
      pairCode,
      at: Date.now(),
    });

    return { ...result, generation, pairCode };
  }

  async function runBoardMatch(ctx, args, { paceMs }) {
    const sourceIndex = Math.max(0, Math.round(args.sourceIndex ?? 0));
    applying = true;
    emit({
      phase: 'select',
      op: 'matchDeviceTransform',
      label: `Read Frame ${sourceIndex + 1} as source`,
      frameIndex: sourceIndex,
      present: true,
      generation,
      pairCode,
      at: Date.now(),
    });

    const srcSel = await runCanvasOp(ctx, 'selectDevice', { frameIndex: sourceIndex });
    if (!srcSel.ok) {
      applying = false;
      emit({ phase: 'error', op: 'matchDeviceTransform', error: srcSel.error, at: Date.now() });
      return { ...srcSel, generation, pairCode };
    }
    if (paceMs > 0) await sleep(paceMs);
    if (paused) {
      applying = false;
      emit({ phase: 'aborted', op: 'matchDeviceTransform', reason: 'paused', at: Date.now() });
      return { ok: false, error: 'paused' };
    }

    const scalePct = srcSel.scalePct;
    const angle = srcSel.angle;
    const frames = ctx.getFrames?.() || [];
    const targets = (args.targetIndexes == null
      ? frames.map((_, i) => i).filter((i) => i !== sourceIndex)
      : args.targetIndexes
    ).map((i) => Math.round(i)).filter((i) => i !== sourceIndex && i >= 0 && i < frames.length);

    // Left-to-right board order so the cursor walks each frame in sequence.
    targets.sort((a, b) => a - b);

    const applied = [];
    for (const ti of targets) {
      if (paused) {
        applying = false;
        emit({ phase: 'aborted', op: 'matchDeviceTransform', reason: 'paused', at: Date.now() });
        return { ok: false, error: 'paused', applied, generation, pairCode };
      }

      emit({
        phase: 'select',
        op: 'matchDeviceTransform',
        label: `Frame ${ti + 1} ← match`,
        frameIndex: ti,
        present: true,
        generation,
        pairCode,
        at: Date.now(),
      });
      await runCanvasOp(ctx, 'selectFrame', { frameIndex: ti });
      if (paceMs > 0) await sleep(Math.round(paceMs * 0.55));

      emit({
        phase: 'apply',
        op: 'setDeviceScale',
        label: `Frame ${ti + 1} scale ${scalePct}%`,
        frameIndex: ti,
        present: true,
        generation,
        pairCode,
        at: Date.now(),
      });
      const scaleRes = await runCanvasOp(ctx, 'setDeviceScale', { frameIndex: ti, pct: scalePct });
      if (paceMs > 0) await sleep(Math.round(paceMs * 0.45));

      emit({
        phase: 'apply',
        op: 'setDeviceAngle',
        label: `Frame ${ti + 1} rotate ${angle}°`,
        frameIndex: ti,
        present: true,
        generation,
        pairCode,
        at: Date.now(),
      });
      const angleRes = await runCanvasOp(ctx, 'setDeviceAngle', { frameIndex: ti, degrees: angle });
      if (scaleRes.ok && angleRes.ok) {
        applied.push({ frameIndex: ti, scalePct, angle });
      }
      if (paceMs > 0) await sleep(Math.round(paceMs * 0.35));
    }

    generation += 1;
    onDirty?.();
    publishRegistry();
    applying = false;
    const result = {
      ok: true,
      sourceIndex,
      scalePct,
      angle,
      applied,
    };
    emit({
      phase: 'done',
      op: 'matchDeviceTransform',
      label: `Matched ${applied.length} frames from Frame ${sourceIndex + 1}`,
      result,
      frameIndex: sourceIndex,
      generation,
      pairCode,
      at: Date.now(),
    });
    return { ...result, generation, pairCode };
  }

  if (enabled && pairCode) {
    if (typeof document !== 'undefined') {
      baseTitle = document.title.replace(/^\[Glint [A-Z0-9]{4}\]\s*/, '');
      syncTitle();
    }
    publishRegistry(true);
    startHeartbeat();
    emit({
      phase: 'session',
      enabled: true,
      paused,
      token,
      pairCode,
      generation,
      restored: true,
      at: Date.now(),
    });
  }

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
    case 'remapColors':
      return `Remap ${Array.isArray(args.pairs) ? args.pairs.length : 1} theme color(s)`;
    case 'setBackground':
      return `Background → ${args.value ?? args.color ?? args.type}`;
    case 'setDeviceBezel':
      return `Device → ${args.bezelId ?? args.frameId ?? 'none'}`;
    case 'setScreenshotStyle':
      return args.statusBarTheme
        ? `Status bar → ${args.statusBarTheme}`
        : 'Update screenshot chrome';
    case 'setText':
      return `Edit text on Frame ${(args.frameIndex ?? 0) + 1}`;
    case 'addText':
      return 'Add text';
    case 'extractTheme':
      return 'Extract theme from screenshots';
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
    /** Board pass: cursor walks every frame; shared transform from source. */
    boardPass: (opts) => session.boardPass(opts),
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
    // Keep Allow-agent across HMR / remount - only Close clears it.
    session.hibernate();
  };
}
