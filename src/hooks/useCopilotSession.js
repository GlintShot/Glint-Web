import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createCopilotSession, installCopilotBridge } from '../utils/copilotSession.js';

/**
 * Bind a Copilot session to the live Editor canvas map.
 */
export function useCopilotSession({
  getFrames,
  getCanvas,
  getActiveIndex,
  setActiveIndex,
  getDeviceFrame,
  getWhiteScreenshot,
  updateFrame,
  onDirty,
  getMeta,
}) {
  const [ui, setUi] = useState({
    enabled: false,
    paused: true,
    token: null,
    pairCode: null,
    generation: 0,
    status: null,
  });

  const ctxRef = useRef({});
  ctxRef.current = {
    getFrames,
    getCanvas,
    getActiveIndex,
    setActiveIndex,
    getDeviceFrame,
    getWhiteScreenshot,
    updateFrame,
  };

  const metaRef = useRef(getMeta);
  metaRef.current = getMeta;

  const session = useMemo(
    () =>
      createCopilotSession({
        getCtx: () => ctxRef.current,
        onDirty,
        getMeta: () => metaRef.current?.() || {},
      }),
    [onDirty],
  );

  useEffect(() => {
    const unsub = session.subscribe((event) => {
      setUi({
        enabled: session.enabled,
        paused: session.paused,
        token: session.token,
        pairCode: session.pairCode,
        generation: session.generation,
        status: event,
      });
    });
    const uninstall = installCopilotBridge(session);
    return () => {
      unsub();
      uninstall();
    };
  }, [session]);

  const enable = useCallback(() => session.enable(), [session]);
  const disable = useCallback(() => session.disable(), [session]);
  const pause = useCallback(() => session.pause(), [session]);
  const resume = useCallback(() => session.resume(), [session]);
  const bump = useCallback((reason) => session.bump(reason), [session]);
  const dispatch = useCallback(
    (op, args, opts) => session.dispatch(op, args, opts),
    [session],
  );
  const getEditorState = useCallback(() => session.getEditorState(), [session]);
  const copyPairCode = useCallback(async () => {
    const code = session.pairCode;
    if (!code || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return false;
    }
    try {
      await navigator.clipboard.writeText(code);
      return true;
    } catch {
      return false;
    }
  }, [session]);

  return {
    ...ui,
    enable,
    disable,
    pause,
    resume,
    bump,
    dispatch,
    getEditorState,
    copyPairCode,
    session,
  };
}
