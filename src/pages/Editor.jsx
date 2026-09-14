import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sun, Moon, PanelLeftClose, PanelLeft, PanelRightClose, PanelRight,
  ZoomIn, ZoomOut, Type, Trash2, Download, Upload, Undo2, Redo2,
  RotateCcw,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import FrameBoard from '../components/FrameBoard';
import TemplateGallery from '../components/TemplateGallery';
import SessionImporter from '../components/SessionImporter';
import FrameScreenshotsPanel from '../components/FrameScreenshotsPanel';
import AssetLibraryPanel from '../components/AssetLibraryPanel';
import FramesPanel from '../components/FramesPanel';
import ExportPanel from '../components/ExportPanel';
import PropertiesPanel from '../components/PropertiesPanel';
import UploadZone from '../components/UploadZone';
import DeviceContextMenu from '../components/DeviceContextMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import { useGLINTBridge } from '../hooks/useGlintBridge';
import {
  useFrames,
  framesFromTemplate,
  framesFromScreenshots,
  stripFramesToDevices,
} from '../hooks/useFrames';
import { loadThemePresets, loadAllTemplates } from '../utils/templateLoader';
import {
  addTextOverlay,
  deleteActiveObjects,
  setBackground,
  replaceDeviceScreenshot,
  replaceDeviceFrame,
  stripDeviceFrame,
  restyleScreenshot,
} from '../utils/canvasEngine';
import { DEFAULT_SCREENSHOT_STYLE, resolveFrameForStore } from '../utils/frameMeta';
import { EXPORT_PRESETS, resolveStoreKey } from '../utils/exportHelper';
import { getStoreTarget } from '../utils/storeCatalog';
import { getWhiteScreenshot } from '../utils/placeholderScreenshots';
import {
  computeBoardZoomBounds,
  clampBoardScale,
  stepBoardScale,
  boardFrameGap,
} from '../utils/boardZoom';
import { restoreCustomFonts, ensureFontReady } from '../utils/fontLibrary';
import { restoreAllCachedScreenshots, removeCachedScreenshot, clearAllCachedScreenshots } from '../utils/screenshotStore';
import { mergeAssetItems, isUserScreenshot } from '../utils/assetLibrary';
import {
  getTemplatePalette,
  remapCanvasColors,
  remapDesignColors,
} from '../utils/templatePalette';
import {
  buildPaletteRemap,
  extractThemeFromUrls,
} from '../utils/screenshotTheme';
import { captureEditorSnapshot, createEditorHistory } from '../hooks/editorHistory';
import { parseGlint, isGlintFile } from '../utils/projectPack';
import CopyToFrameModal from '../components/CopyToFrameModal';
import CopilotBar from '../components/CopilotBar';
import { copySelectionToFrame } from '../utils/copyObjectToFrame';
import { useCopilotSession } from '../hooks/useCopilotSession';

const LEFT_W = 280;
const RIGHT_W = 300;
/** Room for zoom toolbar + Copilot bar so frame labels stay visible. */
const BOARD_TOOLBAR_RESERVE = 100;
const LAST_TEMPLATE_KEY = 'glint.lastTemplateId';
/** ~8% per +/- click - discrete steps avoid trackpad-style rebuild jitter. */
const ZOOM_STEP = 1.08;

export default function Editor() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialTemplate = location.state?.template || null;
  const initialScreenshots = location.state?.screenshots || [];
  const initialAssetItems = location.state?.assetItems?.length
    ? location.state.assetItems
    : initialScreenshots
        .filter(isUserScreenshot)
        .map((url, i) => ({ id: `init-${i}`, url, name: `Screenshot ${i + 1}` }));

  const initialFrames = useMemo(() => {
    if (initialTemplate) return framesFromTemplate(initialTemplate, initialScreenshots);
    if (initialScreenshots.length) return framesFromScreenshots(initialScreenshots);
    // Blank until an enabled gallery pack is applied (avoids fake charcoal+Pixel scratch).
    return framesFromScreenshots([]);
  }, []);

  const {
    frames,
    setFrames,
    activeIndex,
    setActiveIndex,
    activeFrame,
    addFrame,
    duplicateFrame,
    deleteFrame,
    moveFrame,
    updateFrame,
    applyTemplatePack,
    mapScreenshots,
  } = useFrames(initialFrames);

  const [session, setSession] = useState(location.state?.session || null);
  const [background, setBackgroundState] = useState({ label: 'Charcoal', type: 'solid', value: '#1C1C1E' });
  const [deviceFrame, setDeviceFrame] = useState(null);
  const [screenshotStyle, setScreenshotStyle] = useState({ ...DEFAULT_SCREENSHOT_STYLE });
  const [template, setTemplate] = useState(initialTemplate);
  const [textOverlay, setTextOverlay] = useState({ text: '', style: {} });
  const [exportPreset, setExportPreset] = useState(
    resolveStoreKey(session?.store ?? initialTemplate?.store ?? 'play/phone'),
  );
  const [dirty, setDirty] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [stripConfirmOpen, setStripConfirmOpen] = useState(false);
  const dirtyRef = useRef(false);
  const bootstrappingRef = useRef(true);

  const copilotBumpRef = useRef(null);
  const copilotApplyingRef = useRef(false);
  const markDirty = useCallback(() => {
    if (bootstrappingRef.current) return;
    dirtyRef.current = true;
    setDirty(true);
    // Human edits bump Copilot generation so agents must re-read state.
    if (!copilotApplyingRef.current) copilotBumpRef.current?.('human');
  }, []);
  const [fontFamily, setFontFamily] = useState('Space Grotesk');
  const [themes, setThemes] = useState({});
  const [bridgeToken, setBridgeToken] = useState('');
  const [leftTab, setLeftTab] = useState(initialAssetItems.length ? 'assets' : 'templates');
  const [assetLibrary, setAssetLibrary] = useState(initialAssetItems);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [boardScale, setBoardScale] = useState(20);
  const [scaleBounds, setScaleBounds] = useState({ minScale: 20, maxScale: 20 });
  const userScaleRef = useRef(false);
  const [deviceMenu, setDeviceMenu] = useState(null);
  const [copyToFrameOpen, setCopyToFrameOpen] = useState(false);
  const canvasMapRef = useRef({});
  const framesRef = useRef(frames);
  framesRef.current = frames;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const templateRef = useRef(template);
  templateRef.current = template;
  const backgroundRef = useRef(background);
  backgroundRef.current = background;
  const deviceFrameRef = useRef(deviceFrame);
  deviceFrameRef.current = deviceFrame;
  const screenshotStyleRef = useRef(screenshotStyle);
  screenshotStyleRef.current = screenshotStyle;
  const fontFamilyRef = useRef(fontFamily);
  fontFamilyRef.current = fontFamily;
  const historyRef = useRef(createEditorHistory());
  const restoringRef = useRef(false);
  const pushHistoryRef = useRef(() => {});
  const canvasGestureRef = useRef(new WeakSet());
  const [historyTick, setHistoryTick] = useState(0);
  const styleApplyTimerRef = useRef(0);
  const styleApplyRafRef = useRef(0);
  const styleApplyGenRef = useRef(0);
  const [activeCanvas, setActiveCanvas] = useState(null);
  const deviceFileRef = useRef(null);
  const glintFileRef = useRef(null);
  const boardRef = useRef(null);
  const bridge = useGLINTBridge();
  const { theme, toggle } = useTheme();

  const preset = EXPORT_PRESETS[resolveStoreKey(exportPreset)] ?? EXPORT_PRESETS['play/phone'];
  const canvasW = template?.canvas?.width ?? preset.width;
  const canvasH = template?.canvas?.height ?? preset.height;

  useEffect(() => {
    loadThemePresets().then(setThemes);
    restoreCustomFonts().catch(() => {});
  }, []);

  useEffect(() => () => {
    if (styleApplyTimerRef.current) clearTimeout(styleApplyTimerRef.current);
    if (styleApplyRafRef.current) cancelAnimationFrame(styleApplyRafRef.current);
    styleApplyGenRef.current += 1;
  }, []);

  const addAssets = useCallback((items) => {
    if (!items?.length) return;
    setAssetLibrary((prev) => mergeAssetItems(prev, items));
  }, []);

  const handleCanvasReady = useCallback((frameId, canvas) => {
    if (!frameId) return;
    if (canvas) {
      canvasMapRef.current[frameId] = canvas;
      if (!canvasGestureRef.current.has(canvas)) {
        canvasGestureRef.current.add(canvas);
        let gesturing = false;
        canvas.on('mouse:down', (opt) => {
          if (!opt.target || restoringRef.current) return;
          if (!gesturing) {
            gesturing = true;
            pushHistoryRef.current();
          }
        });
        canvas.on('mouse:up', () => {
          gesturing = false;
        });
      }
    } else {
      delete canvasMapRef.current[frameId];
    }
  }, []);

  useEffect(() => {
    const id = frames[activeIndex]?.id;
    setActiveCanvas(id ? canvasMapRef.current[id] || null : null);
  }, [activeIndex, frames]);

  const copilot = useCopilotSession({
    getFrames: () => framesRef.current,
    getCanvas: (frameId) => canvasMapRef.current[frameId] || null,
    getActiveIndex: () => activeIndexRef.current,
    setActiveIndex,
    getDeviceFrame: () => deviceFrameRef.current,
    getWhiteScreenshot,
    updateFrame,
    onDirty: markDirty,
    getMeta: () => ({
      frameCount: framesRef.current.length,
      templateId: template?.id || null,
    }),
  });

  useEffect(() => {
    copilotBumpRef.current = (reason) => {
      if (!copilot.session.applying) copilot.bump(reason);
    };
    return copilot.session.subscribe(() => {
      copilotApplyingRef.current = copilot.session.applying;
    });
  }, [copilot]);

  const loadTemplate = (t) => {
    setTemplate(t);
    const storeKey = t?.store ? resolveStoreKey(t.store) : exportPreset;
    if (t?.store) setExportPreset(storeKey);
    if (t) {
      try {
        sessionStorage.setItem(LAST_TEMPLATE_KEY, t.id);
      } catch {
        /* ignore */
      }
      applyTemplatePack(t, { resizeToPack: true });
    }
  };

  const handleSelectTemplate = (t) => {
    if (!t) return;
    if (template?.id && t.id !== template.id) {
      setPendingTemplate(t);
      return;
    }
    loadTemplate(t);
    markDirty();
  };

  const confirmReplaceTemplate = () => {
    if (pendingTemplate) {
      pushHistoryRef.current();
      loadTemplate(pendingTemplate);
      markDirty();
    }
    setPendingTemplate(null);
  };

  const requestLeaveEditor = () => {
    if (dirtyRef.current) {
      setLeaveOpen(true);
      return;
    }
    navigate('/');
  };

  const confirmLeaveEditor = () => {
    dirtyRef.current = false;
    setDirty(false);
    setLeaveOpen(false);
    navigate('/');
  };

  // Reload / bare /editor: restore last pack or first enabled gallery template.
  // (location.state is lost on refresh - that charcoal+Pixel board was the empty fallback.)
  useEffect(() => {
    if (initialTemplate) {
      try {
        sessionStorage.setItem(LAST_TEMPLATE_KEY, initialTemplate.id);
      } catch {
        /* ignore */
      }
      bootstrappingRef.current = false;
      return;
    }
    if (location.state?.glintPack || location.state?.screenshots?.length) {
      bootstrappingRef.current = false;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const packs = await loadAllTemplates({ enabledOnly: true });
        if (cancelled || !packs.length) return;
        let savedId = null;
        try {
          savedId = sessionStorage.getItem(LAST_TEMPLATE_KEY);
        } catch {
          /* ignore */
        }
        const pick =
          packs.find((t) => t.id === savedId) ||
          packs.find((t) => resolveStoreKey(t.store) === 'play/phone') ||
          packs[0];
        if (!cancelled && pick) loadTemplate(pick);
        const cached = await restoreAllCachedScreenshots();
        if (!cancelled && cached.length) {
          setAssetLibrary((prev) => mergeAssetItems(prev, cached));
          if (!framesRef.current.some((f) => isUserScreenshot(f.screenshotUrl))) {
            mapScreenshots(cached.map((c) => c.url), pick);
          }
        }
      } catch {
        /* keep blank board */
      } finally {
        if (!cancelled) bootstrappingRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally once on mount for bare editor entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Trap browser back while dirty - confirm before leaving editor.
  useEffect(() => {
    if (!dirty) return undefined;
    const push = () => window.history.pushState({ glintEditorGuard: 1 }, '');
    push();
    const onPop = () => {
      push();
      setLeaveOpen(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [dirty]);

  const templatePalette = useMemo(() => getTemplatePalette(template), [template]);

  const getSnapshot = useCallback(
    () =>
      captureEditorSnapshot({
        frames: framesRef.current,
        template: templateRef.current,
        background: backgroundRef.current,
        deviceFrame: deviceFrameRef.current,
        screenshotStyle: screenshotStyleRef.current,
        fontFamily: fontFamilyRef.current,
        canvasMap: canvasMapRef.current,
      }),
    [],
  );

  const applySnapshot = useCallback(
    (snap) => {
      if (!snap) return;
      restoringRef.current = true;
      setTemplate(snap.template);
      if (snap.background) setBackgroundState(snap.background);
      if (snap.deviceFrame !== undefined) setDeviceFrame(snap.deviceFrame);
      if (snap.screenshotStyle) setScreenshotStyle({ ...snap.screenshotStyle });
      if (snap.fontFamily) setFontFamily(snap.fontFamily);
      setFrames(snap.frames);
      markDirty();
      requestAnimationFrame(() => {
        restoringRef.current = false;
      });
    },
    [markDirty, setFrames],
  );

  const pushHistory = useCallback(() => {
    if (restoringRef.current || bootstrappingRef.current) return;
    historyRef.current.push(getSnapshot());
    setHistoryTick((t) => t + 1);
  }, [getSnapshot]);

  pushHistoryRef.current = pushHistory;

  const canUndo = useMemo(() => historyRef.current.canUndo(), [historyTick]);
  const canRedo = useMemo(() => historyRef.current.canRedo(), [historyTick]);

  const handleUndo = useCallback(() => {
    if (!historyRef.current.canUndo()) return;
    const prev = historyRef.current.undo(getSnapshot());
    applySnapshot(prev);
    setHistoryTick((t) => t + 1);
  }, [getSnapshot, applySnapshot]);

  const handleRedo = useCallback(() => {
    if (!historyRef.current.canRedo()) return;
    const next = historyRef.current.redo(getSnapshot());
    applySnapshot(next);
    setHistoryTick((t) => t + 1);
  }, [getSnapshot, applySnapshot]);

  const handleBackgroundChange = useCallback(
    (bg) => {
      pushHistory();
      setBackgroundState(bg);
      if (activeCanvas && bg) setBackground(activeCanvas, bg.type, bg.value);
      markDirty();
    },
    [activeCanvas, markDirty, pushHistory],
  );

  const handlePaletteColorChange = useCallback(
    (fromColor, toColor) => {
      if (!fromColor || !toColor || fromColor.toUpperCase() === toColor.toUpperCase()) return;
      pushHistory();
      Object.values(canvasMapRef.current).forEach((c) => remapCanvasColors(c, fromColor, toColor));
      setFrames((prev) =>
        prev.map((frame) => {
          if (!frame.design) return frame;
          return { ...frame, design: remapDesignColors(frame.design, fromColor, toColor) };
        }),
      );
      setTemplate((prev) => (prev ? remapDesignColors(prev, fromColor, toColor) : prev));
      const bgSlot = template?.palette?.find((s) => s.id === 'background');
      if (bgSlot && bgSlot.color?.toUpperCase() === fromColor.toUpperCase()) {
        setBackgroundState({ label: 'Custom', type: 'solid', value: toColor.toUpperCase() });
      }
      markDirty();
    },
    [markDirty, setFrames, template, pushHistory],
  );

  const applyPaletteRemaps = useCallback(
    (pairs) => {
      if (!pairs?.length) return;
      Object.values(canvasMapRef.current).forEach((c) => {
        pairs.forEach(([from, to]) => remapCanvasColors(c, from, to));
      });
      setFrames((prev) =>
        prev.map((frame) => {
          if (!frame.design) return frame;
          let design = frame.design;
          pairs.forEach(([from, to]) => {
            design = remapDesignColors(design, from, to);
          });
          return { ...frame, design };
        }),
      );
      setTemplate((prev) => {
        if (!prev) return prev;
        let next = prev;
        pairs.forEach(([from, to]) => {
          next = remapDesignColors(next, from, to);
        });
        return next;
      });
      const bgSlot = template?.palette?.find((s) => s.id === 'background');
      const bgPair = pairs.find(
        ([from]) => bgSlot && bgSlot.color?.toUpperCase() === from.toUpperCase(),
      );
      if (bgPair) {
        setBackgroundState({ label: 'Custom', type: 'solid', value: bgPair[1].toUpperCase() });
      }
      markDirty();
    },
    [markDirty, setFrames, template],
  );

  const handleExtractThemeNow = useCallback(async () => {
    const urls = [
      ...assetLibrary.map((a) => a.url),
      ...frames.map((f) => f.screenshotUrl),
    ].filter(isUserScreenshot);
    const palette = getTemplatePalette(template);
    if (!template || !palette.length || !urls.length) return;
    try {
      const theme = await extractThemeFromUrls(urls, palette);
      const pairs = buildPaletteRemap(palette, theme);
      if (pairs.length) {
        pushHistory();
        applyPaletteRemaps(pairs);
      }
    } catch {
      /* ignore */
    }
  }, [assetLibrary, frames, template, applyPaletteRemaps, pushHistory]);

  useEffect(() => {
    if (bridge.screenshots.length > 0) {
      const items = bridge.screenshots.map((url, i) => ({
        id: `bridge-${Date.now()}-${i}`,
        url,
        name: `Capture ${i + 1}`,
      }));
      addAssets(items);
      mapScreenshots(bridge.screenshots, template);
      setLeftTab('assets');
    }
  }, [bridge.screenshots, mapScreenshots, addAssets, template]);

  const handleScreenshotStyleChange = useCallback((patch) => {
    markDirty();
    setScreenshotStyle((prev) => {
      const next = { ...prev, ...patch };
      // Debounce canvas work - slider ticks must not stack full-board restyles.
      const radiusOnlyRebuild = Object.prototype.hasOwnProperty.call(patch, 'cornerRadius');
      const delay = radiusOnlyRebuild ? 120 : 0;

      if (styleApplyTimerRef.current) clearTimeout(styleApplyTimerRef.current);
      const gen = ++styleApplyGenRef.current;

      const apply = async () => {
        if (gen !== styleApplyGenRef.current) return;
        const board = framesRef.current;
        for (const frame of board) {
          if (gen !== styleApplyGenRef.current) return;
          const canvas = canvasMapRef.current[frame.id];
          if (!canvas) continue;
          const targets = canvas
            .getObjects()
            .filter((o) => o.glintRole === 'framed-screenshot' || o.glintRole === 'screenshot');
          for (const obj of [...targets]) {
            if (gen !== styleApplyGenRef.current) return;
            await restyleScreenshot(obj, next);
          }
        }
      };

      if (delay > 0) {
        styleApplyTimerRef.current = setTimeout(apply, delay);
      } else {
        // Stroke / shadow: sync, cheap in-place updates - still coalesce via rAF.
        if (styleApplyRafRef.current) cancelAnimationFrame(styleApplyRafRef.current);
        styleApplyRafRef.current = requestAnimationFrame(() => {
          styleApplyRafRef.current = 0;
          apply();
        });
      }
      return next;
    });
  }, [markDirty]);

  const handleDeviceFrameChange = useCallback(async (nextId) => {
    const target = getStoreTarget(exportPreset);
    const frameId = resolveFrameForStore(nextId, target, null);
    if (nextId != null && frameId !== nextId) return;
    setDeviceFrame(frameId);
    markDirty();
    // Cancel in-flight status-bar / chrome restyles so they can't rebake the old bezel after us.
    styleApplyGenRef.current += 1;
    if (styleApplyTimerRef.current) clearTimeout(styleApplyTimerRef.current);
    if (styleApplyRafRef.current) cancelAnimationFrame(styleApplyRafRef.current);

    const board = framesRef.current;
    for (let i = 0; i < board.length; i++) {
      const frame = board[i];
      const canvas = canvasMapRef.current[frame.id];
      if (!canvas) continue;

      const shotUrl = frame.screenshotUrl;
      const devices = canvas.getObjects().filter((o) => o.glintRole === 'framed-screenshot');
      const bare = canvas.getObjects().filter((o) => o.glintRole === 'screenshot');

      try {
        if (!frameId) {
          // None - strip every bezel into a styled screenshot.
          for (const device of [...devices]) {
            if (!device.glintScreenshotUrl && shotUrl) {
              device.set({ glintScreenshotUrl: shotUrl });
            }
            await stripDeviceFrame(device, screenshotStyleRef.current);
          }
          continue;
        }

        // Apply / swap bezel on framed devices.
        for (const device of [...devices]) {
          if (!device.glintScreenshotUrl && shotUrl) {
            device.set({ glintScreenshotUrl: shotUrl });
          }
          const url = shotUrl || device.glintScreenshotUrl;
          const ok = await replaceDeviceFrame(
            device,
            frameId,
            url,
            screenshotStyleRef.current,
          );
          if (!ok && url) {
            device.set({ glintScreenshotUrl: url });
            await replaceDeviceFrame(device, frameId, url, screenshotStyleRef.current);
          }
        }

        // Wrap bare screenshots (after stripping None) back into a bezel.
        for (const shot of [...bare]) {
          if (!shot.glintScreenshotUrl && shotUrl) {
            shot.set({ glintScreenshotUrl: shotUrl });
          }
          await replaceDeviceFrame(
            shot,
            frameId,
            shotUrl || shot.glintScreenshotUrl,
            screenshotStyleRef.current,
          );
        }
      } catch (err) {
        console.error('Glint: device frame swap failed', frame.id, err);
      }
    }

    // Persist bezel id into slide designs so a later paint keeps the swap.
    if (frameId) {
      setFrames((prev) =>
        prev.map((f) => {
          if (!f.design?.layers?.some((l) => l.type === 'device')) return f;
          const design = {
            ...f.design,
            layers: f.design.layers.map((l) =>
              l.type === 'device' ? { ...l, frame: frameId } : l,
            ),
          };
          return { ...f, design };
        }),
      );
    }

    const live = canvasMapRef.current[framesRef.current[activeIndex]?.id];
    if (live) {
      const refreshed = live.getObjects().find((o) => {
        if (frameId) {
          return o.glintRole === 'framed-screenshot' && o.glintFrameId === frameId;
        }
        return o.glintRole === 'screenshot' || o.glintRole === 'framed-screenshot';
      });
      if (refreshed) {
        live.setActiveObject(refreshed);
        live.requestRenderAll();
      }
    }
  }, [activeIndex, exportPreset, markDirty, setFrames]);

  /** Drop illegal bezels when store size changes (e.g. iPhone → Play TV). */
  useEffect(() => {
    const target = getStoreTarget(exportPreset);
    const next = resolveFrameForStore(deviceFrame, target, null);
    if (next !== deviceFrame) {
      handleDeviceFrameChange(next);
    }
    // Clamp only when the store target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportPreset]);

  const handleAddText = useCallback(async () => {
    if (!activeCanvas) return;
    pushHistory();
    await ensureFontReady(fontFamily, '700');
    addTextOverlay(activeCanvas, 'Your headline', {
      fill: background?.type === 'solid' && isLight(background.value) ? '#1A1A1A' : '#FFFFFF',
      fontFamily,
      fontSize: 48,
    });
    markDirty();
  }, [activeCanvas, background, fontFamily, markDirty, pushHistory]);

  const handleDelete = useCallback(() => {
    if (!activeCanvas) return;
    if (!activeCanvas.getActiveObjects?.()?.length) return;
    pushHistory();
    deleteActiveObjects(activeCanvas);
    markDirty();
  }, [activeCanvas, markDirty, pushHistory]);

  const handleSessionImport = ({ screenshots: imported, session: importedSession }) => {
    setSession(importedSession);
    setExportPreset(resolveStoreKey(importedSession.store ?? 'play/phone'));
    const items = imported.map((url, i) => ({
      id: `session-${Date.now()}-${i}`,
      url,
      name: `Screen ${i + 1}`,
    }));
    addAssets(items);
    mapScreenshots(imported, template);
    setLeftTab('assets');
    markDirty();
  };

  const handleProjectImport = (pack) => {
    setSession(pack.session);
    setExportPreset(resolveStoreKey(pack.session?.store ?? 'play/phone'));
    if (pack.editor?.background) setBackgroundState(pack.editor.background);
    if (pack.editor?.deviceFrame !== undefined) {
      const storeKey = resolveStoreKey(pack.session?.store ?? 'play/phone');
      setDeviceFrame(
        resolveFrameForStore(pack.editor.deviceFrame, getStoreTarget(storeKey), null),
      );
    }
    if (pack.editor?.screenshotStyle) setScreenshotStyle({ ...pack.editor.screenshotStyle });
    if (pack.editor?.fontFamily) setFontFamily(pack.editor.fontFamily);
    if (pack.templateMeta) {
      setTemplate({
        ...pack.templateMeta,
        slides: pack.frames.map((f) => f.design).filter(Boolean),
      });
    }
    const packFrames = pack.frames.map((f) => ({
      id: f.id,
      design: f.design,
      screenshotUrl: f.screenshotUrl,
      fabricJson: f.fabricJson,
      fabricRestoreKey: f.fabricRestoreKey,
    }));
    setFrames(packFrames);
    addAssets(
      packFrames
        .filter((f) => isUserScreenshot(f.screenshotUrl))
        .map((f, i) => ({ id: `pack-${f.id}`, url: f.screenshotUrl, name: `Screen ${i + 1}` })),
    );
    setActiveIndex(0);
    setLeftTab('assets');
    markDirty();
  };

  useEffect(() => {
    const pack = location.state?.glintPack;
    if (!pack) return;
    handleProjectImport(pack);
    navigate(location.pathname, { replace: true, state: {} });
    // one-shot hydrate from Home
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = (ingested) => {
    addAssets(ingested);
    const urls = ingested.map((x) => x.url);
    mapScreenshots(urls, template);
    setLeftTab('assets');
    markDirty();
  };

  const handleGlintFileImport = async (file) => {
    if (!file || !isGlintFile(file)) {
      alert('Not a valid .glint file');
      return;
    }
    try {
      const pack = await parseGlint(file);
      handleProjectImport(pack);
    } catch (err) {
      console.error('Import failed:', err);
      alert(`Import failed: ${err.message || err}`);
    }
  };

  const handleGlintFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleGlintFileImport(file);
    e.target.value = '';
  };

  const handleGlintDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file && isGlintFile(file)) {
      handleGlintFileImport(file);
    }
  }, []);

  const handleGlintDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const swapFrameDevices = useCallback(async (index, url) => {
    updateFrame(index, { screenshotUrl: url });
    const frame = framesRef.current[index];
    const canvas = frame ? canvasMapRef.current[frame.id] : null;
    if (!canvas) return;
    const devices = canvas.getObjects().filter((o) => o.glintRole === 'framed-screenshot');
    const bare = canvas.getObjects().filter((o) => o.glintRole === 'screenshot');
    if (devices.length) {
      if (devices.length === 1) {
        await replaceDeviceScreenshot(devices[0], url);
        return;
      }
      const primary = devices.find((d) => (d.glintSlot ?? 0) === 0) || devices[0];
      await replaceDeviceScreenshot(primary, url);
      return;
    }
    if (bare.length) {
      const primary = bare[0];
      await restyleScreenshot(primary, screenshotStyle, { forceRebuild: true, screenshotUrl: url });
    }
  }, [updateFrame, screenshotStyle]);

  const handleCopyToFrame = useCallback(async (targetFrameId) => {
    const sourceCanvas = canvasMapRef.current[frames[activeIndex]?.id];
    const targetCanvas = canvasMapRef.current[targetFrameId];
    if (!sourceCanvas || !targetCanvas) return;

    const activeObj = sourceCanvas.getActiveObject();
    if (!activeObj) return;

    const objects = activeObj.type === 'activeSelection'
      ? activeObj.getObjects()
      : [activeObj];

    const offset = { x: 0, y: 0 };
    await copySelectionToFrame(sourceCanvas, targetCanvas, objects, offset);
    pushHistory();
    setCopyToFrameOpen(false);
  }, [activeIndex, frames, pushHistory]);

  const assignScreenshotToFrame = useCallback(async (index, url, assetItem = null) => {
    if (!isUserScreenshot(url)) return;
    if (assetItem) addAssets([assetItem]);
    await swapFrameDevices(index, url);
    setActiveIndex(index);
    markDirty();
  }, [addAssets, swapFrameDevices, markDirty]);

  const removeAsset = useCallback((id) => {
    setAssetLibrary((prev) => {
      const item = prev.find((a) => a.id === id);
      if (item) {
        removeCachedScreenshot(id, item.url).catch((err) => {
          console.warn('Glint: failed to remove cached screenshot', err);
        });
      }
      return prev.filter((a) => a.id !== id);
    });
    markDirty();
  }, [markDirty]);

  const clearAllAssets = useCallback(() => {
    setAssetLibrary((prev) => {
      for (const item of prev) {
        if (item.url?.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(item.url);
          } catch {
            /* ignore */
          }
        }
      }
      clearAllCachedScreenshots().catch((err) => {
        console.warn('Glint: failed to clear screenshot cache', err);
      });
      return [];
    });
    markDirty();
  }, [markDirty]);

  const handleReplaceScreenshot = async (index, urlOrFile) => {
    const url = typeof urlOrFile === 'string' ? urlOrFile : URL.createObjectURL(urlOrFile);
    await assignScreenshotToFrame(index, url);
  };

  const handleClearScreenshot = async (index) => {
    await swapFrameDevices(index, getWhiteScreenshot());
    markDirty();
  };

  const screenshotList = frames.map((f) => f.screenshotUrl).filter(Boolean);

  const recomputeBoardScale = useCallback(() => {
    const el = boardRef.current;
    if (!el) return { minScale: 20, maxScale: 20 };
    const leftPad = leftOpen ? LEFT_W : 0;
    const rightPad = rightOpen ? RIGHT_W : 0;
    const params = {
      boardWidth: el.clientWidth - leftPad - rightPad,
      boardHeight: Math.max(200, el.clientHeight - BOARD_TOOLBAR_RESERVE),
      canvasWidth: canvasW,
      canvasHeight: canvasH,
      frameCount: frames.length,
      gap: boardFrameGap(Math.round(canvasW * 0.16)),
    };
    const bounds = computeBoardZoomBounds(params);
    setScaleBounds(bounds);
    setBoardScale((prev) => {
      if (userScaleRef.current) return clampBoardScale(prev, bounds.minScale, bounds.maxScale);
      return bounds.minScale;
    });
    return bounds;
  }, [leftOpen, rightOpen, canvasW, canvasH, frames.length]);

  const zoomIn = () => {
    userScaleRef.current = true;
    setBoardScale((s) => stepBoardScale(s, ZOOM_STEP, scaleBounds.minScale, scaleBounds.maxScale));
  };
  const zoomOut = () => {
    userScaleRef.current = true;
    setBoardScale((s) => stepBoardScale(s, 1 / ZOOM_STEP, scaleBounds.minScale, scaleBounds.maxScale));
  };

  const canZoomIn = boardScale < scaleBounds.maxScale - 0.05;
  const canZoomOut = boardScale > scaleBounds.minScale + 0.05;

  // Re-fit when sidebars / frame pack / export size change (after layout paints)
  useEffect(() => {
    userScaleRef.current = false;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      recomputeBoardScale();
    };
    run();
    const raf = requestAnimationFrame(() => requestAnimationFrame(run));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [recomputeBoardScale]);

  // Keep bounds updated on window/board resize (respect manual scale)
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recomputeBoardScale());
    ro.observe(el);
    return () => ro.disconnect();
  }, [recomputeBoardScale]);

  // Recalc Fabric pointer offsets after CSS display size changes.
  useEffect(() => {
    let innerId = 0;
    const outerId = requestAnimationFrame(() => {
      innerId = requestAnimationFrame(() => {
        Object.values(canvasMapRef.current).forEach((c) => c?.calcOffset?.());
      });
    });
    return () => {
      cancelAnimationFrame(outerId);
      if (innerId) cancelAnimationFrame(innerId);
    };
  }, [boardScale, canvasW, canvasH, frames.length, template?.id]);

  const handleDeviceContextMenu = useCallback((payload) => {
    const idx = frames.findIndex((f) => f.id === payload.frameId);
    if (idx >= 0) setActiveIndex(idx);
    setDeviceMenu(payload);
  }, [frames, setActiveIndex]);

  const closeDeviceMenu = () => setDeviceMenu(null);

  const clearCanvasSelection = useCallback(() => {
    closeDeviceMenu();
    const canvas = activeCanvas;
    if (canvas) {
      canvas.discardActiveObject?.();
      canvas.requestRenderAll?.();
    }
    setActiveIndex(-1);
  }, [activeCanvas, setActiveIndex]);

  /** Strip every frame to the simple extra slide + blank device screens. */
  const confirmStripToDeviceFrames = useCallback(() => {
    pushHistory();
    const white = getWhiteScreenshot();
    const stamp = Date.now();
    setFrames((prev) => stripFramesToDevices(prev, template, white, stamp));
    setActiveIndex(-1);
    setStripConfirmOpen(false);
    markDirty();
  }, [template, setFrames, markDirty, pushHistory]);

  const pendingDeviceRef = useRef(null);

  // Close device action menu when user selects another layer or clears selection.
  useEffect(() => {
    if (!activeCanvas) return;
    const syncMenu = () => {
      const obj = activeCanvas.getActiveObject?.();
      if (!obj || (obj.glintRole !== 'framed-screenshot' && obj.glintRole !== 'screenshot')) {
        setDeviceMenu(null);
      }
    };
    activeCanvas.on('selection:created', syncMenu);
    activeCanvas.on('selection:updated', syncMenu);
    activeCanvas.on('selection:cleared', syncMenu);
    return () => {
      activeCanvas.off('selection:created', syncMenu);
      activeCanvas.off('selection:updated', syncMenu);
      activeCanvas.off('selection:cleared', syncMenu);
    };
  }, [activeCanvas]);

  const handleDeviceImportClick = () => {
    pendingDeviceRef.current = deviceMenu;
    closeDeviceMenu();
    // Defer so the menu unmounts before the file dialog opens
    requestAnimationFrame(() => deviceFileRef.current?.click());
  };

  const handleDeviceFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const ctx = pendingDeviceRef.current || deviceMenu;
    pendingDeviceRef.current = null;
    if (!file || !ctx?.device) return;
    const url = URL.createObjectURL(file);
    const idx = frames.findIndex((f) => f.id === ctx.frameId);
    await replaceDeviceScreenshot(ctx.device, url);
    if (idx >= 0) updateFrame(idx, { screenshotUrl: url });
    markDirty();
  };

  const handleDeviceClear = async () => {
    if (!deviceMenu?.device) return;
    const url = getWhiteScreenshot();
    const idx = frames.findIndex((f) => f.id === deviceMenu.frameId);
    await replaceDeviceScreenshot(deviceMenu.device, url);
    if (idx >= 0) updateFrame(idx, { screenshotUrl: url });
    closeDeviceMenu();
    markDirty();
  };

  const handleDeviceResetTransform = () => {
    const device = deviceMenu?.device;
    if (!device) return;
    device.set({ scaleX: 1, scaleY: 1, angle: 0 });
    device.setCoords?.();
    device.canvas?.requestRenderAll?.();
    closeDeviceMenu();
    markDirty();
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && activeCanvas?.getActiveObjects()?.length) {
        e.preventDefault();
        handleDelete();
      }
      if (typing) return;
      if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (
        ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && e.shiftKey)
        || ((e.key === 'y' || e.key === 'Y') && (e.metaKey || e.ctrlKey))
      ) {
        e.preventDefault();
        handleRedo();
      }
      if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey) handleAddText();
      if (e.key === '\\' && !e.metaKey && !e.ctrlKey) {
        setLeftOpen((v) => !v);
        setRightOpen((v) => !v);
      }
      if (e.key === 'ArrowLeft' && !e.metaKey) setActiveIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight' && !e.metaKey) setActiveIndex((i) => Math.min(frames.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeCanvas, handleAddText, handleDelete, handleUndo, handleRedo, frames.length, setActiveIndex]);

  const getLiveCanvases = () =>
    frames.map((f) => canvasMapRef.current[f.id]).filter(Boolean);

  const getCanvasForFrame = useCallback((frameId) => canvasMapRef.current[frameId] || null, []);

  const openExportSidebar = () => {
    setLeftOpen(true);
    setLeftTab('export');
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-glint-bg flex flex-col">
      <header className="h-12 bg-glint-surface border-b border-glint-border px-3 flex items-center justify-between shrink-0 z-40">
        <div className="flex items-center gap-2">
          <button onClick={requestLeaveEditor} className="hover:opacity-80 transition-opacity" title="Home">
            <img src="/logo.png" alt="Glint" className="w-7 h-7 rounded-md" />
          </button>
          <div className="w-px h-4 bg-glint-border-strong" />
          <button
            onClick={() => setLeftOpen((v) => !v)}
            className="p-1.5 rounded-md hover:bg-glint-surface-2 text-glint-text-secondary hover:text-glint-text"
            title={leftOpen ? 'Collapse left panel' : 'Expand left panel'}
          >
            {leftOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>
          <div className="w-px h-4 bg-glint-border-strong" />
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-md hover:bg-glint-surface-2 text-glint-text-secondary hover:text-glint-text disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-md hover:bg-glint-surface-2 text-glint-text-secondary hover:text-glint-text disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={16} />
          </button>
          <span className="text-sm font-semibold text-glint-text">Editor</span>
          <span className="text-[10px] text-glint-text-tertiary">
            {frames.length} frame{frames.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {bridge.error && !bridge.connected && (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Bridge token"
                value={bridgeToken}
                onChange={(e) => setBridgeToken(e.target.value)}
                className="px-2 py-1 border border-glint-border rounded text-[11px] w-24 bg-glint-bg text-glint-text"
              />
              <button
                onClick={() => bridge.connect(bridgeToken)}
                className="px-2 py-1 bg-glint-accent text-glint-text-on-accent rounded text-[11px] hover:bg-glint-accent-hover"
              >
                Pair
              </button>
            </div>
          )}
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              bridge.connected
                ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                : bridge.pairing
                  ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
                  : 'bg-glint-surface-2 text-glint-text-secondary'
            }`}
          >
            {bridge.connected ? 'Connected' : bridge.pairing ? 'Pairing...' : 'Offline'}
          </span>
          <button
            type="button"
            onClick={openExportSidebar}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold glint-btn-primary"
            title="Export"
          >
            <Download size={14} />
            Export
          </button>
          <button
            onClick={toggle}
            className="p-1.5 rounded-md hover:bg-glint-surface-2"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun size={15} className="text-glint-text-secondary" /> : <Moon size={15} className="text-glint-text-secondary" />}
          </button>
          <button
            onClick={() => setRightOpen((v) => !v)}
            className="p-1.5 rounded-md hover:bg-glint-surface-2 text-glint-text-secondary hover:text-glint-text"
            title={rightOpen ? 'Collapse right panel' : 'Expand right panel'}
          >
            {rightOpen ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
          </button>
        </div>
      </header>

      <div
        className="flex-1 min-h-0 relative overflow-hidden"
        onDrop={handleGlintDrop}
        onDragOver={handleGlintDragOver}
      >
        <main ref={boardRef} className="absolute inset-0 overflow-hidden bg-glint-bg">
          <FrameBoard
            frames={frames}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            onAdd={(i) => addFrame(i, template)}
            onDuplicate={duplicateFrame}
            onDelete={deleteFrame}
            onMove={moveFrame}
            onCanvasReady={handleCanvasReady}
            onDeviceContextMenu={handleDeviceContextMenu}
            canvasWidth={canvasW}
            canvasHeight={canvasH}
            themes={themes}
            fitScale={boardScale}
            padLeft={leftOpen ? LEFT_W : 0}
            padRight={rightOpen ? RIGHT_W : 0}
            padBottom={BOARD_TOOLBAR_RESERVE}
            onDropScreenshot={assignScreenshotToFrame}
            onClearSelection={clearCanvasSelection}
            showFrameChrome={!canZoomIn}
            agentFrameIndex={
              copilot.enabled && !copilot.paused && typeof copilot.status?.frameIndex === 'number'
                ? copilot.status.frameIndex
                : null
            }
          />

          <div
            className="absolute bottom-4 z-20 flex flex-col items-center gap-2 pointer-events-none transition-[left,transform] duration-200 ease-out"
            style={{
              left: `calc(50% + ${(leftOpen ? LEFT_W : 0) / 2}px - ${(rightOpen ? RIGHT_W : 0) / 2}px)`,
              transform: 'translateX(-50%)',
            }}
          >
            <CopilotBar
              enabled={copilot.enabled}
              paused={copilot.paused}
              pairCode={copilot.pairCode}
              status={copilot.status}
              onEnable={copilot.enable}
              onDisable={copilot.disable}
              onPause={copilot.pause}
              onResume={copilot.resume}
              onCopyPair={copilot.copyPairCode}
            />
            <div className="pointer-events-auto flex items-center gap-0.5 bg-glint-surface/95 backdrop-blur-md border border-glint-border rounded-xl px-1.5 py-1 shadow-2xl">
            <ToolBtn onClick={handleAddText} title="Add text (T)">
              <Type size={15} />
            </ToolBtn>
            <ToolBtn onClick={handleDelete} title="Delete selected">
              <Trash2 size={15} />
            </ToolBtn>
            <Sep />
            <ToolBtn onClick={zoomOut} title="Zoom out (show all frames)" disabled={!canZoomOut}>
              <ZoomOut size={15} />
            </ToolBtn>
            <ToolBtn onClick={zoomIn} title="Zoom in (up to ~2.5 frames)" disabled={!canZoomIn}>
              <ZoomIn size={15} />
            </ToolBtn>
            <Sep />
            <button
              type="button"
              onClick={() => setStripConfirmOpen(true)}
              title="Clear styling and screenshots - device frames only"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-glint-text-secondary hover:text-glint-danger hover:bg-glint-danger/10 transition-colors"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
            </div>
          </div>
        </main>

        <aside
          className="absolute left-0 top-0 bottom-0 z-30 bg-glint-surface/95 backdrop-blur-md border-r border-glint-border shadow-2xl flex flex-col overflow-hidden transition-[width,opacity] duration-200 ease-out"
          style={{
            width: leftOpen ? LEFT_W : 0,
            opacity: leftOpen ? 1 : 0,
            pointerEvents: leftOpen ? 'auto' : 'none',
          }}
        >
          <div className="w-[280px] h-full flex flex-col">
            <div className="flex border-b border-glint-border shrink-0">
              {[
                { id: 'templates', label: 'Templates' },
                { id: 'assets', label: 'Assets' },
                { id: 'frames', label: 'Frames' },
                { id: 'export', label: 'Export' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setLeftTab(tab.id)}
                  className={`flex-1 px-1.5 py-2.5 text-[11px] font-medium transition-colors ${
                    leftTab === tab.id
                      ? 'text-glint-accent border-b-2 border-glint-accent'
                      : 'text-glint-text-secondary hover:text-glint-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4 hide-scrollbar">
              {leftTab === 'templates' && (
                <TemplateGallery onChange={handleSelectTemplate} activeStore={exportPreset} />
              )}
              {leftTab === 'assets' && (
                <>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-glint-text-secondary text-[10px] uppercase tracking-wider">
                      Import
                    </h3>
                    <UploadZone onUpload={handleUpload} compact />
                    <button
                      onClick={() => glintFileRef.current?.click()}
                      className="w-full px-3 py-1.5 border border-glint-border rounded-lg text-xs text-glint-text-secondary hover:text-glint-text hover:border-glint-accent transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Upload size={12} />
                      Import .glint
                    </button>
                    <input
                      ref={glintFileRef}
                      type="file"
                       accept=".glint,.glint.zip"
                      onChange={handleGlintFileInput}
                      className="hidden"
                    />
                  </div>
                  <SessionImporter
                    onImport={handleSessionImport}
                    onProjectImport={handleProjectImport}
                  />
                  {bridge.connected && (
                    <button
                      onClick={() => bridge.captureSingle()}
                      className="w-full px-3 py-1.5 glint-btn-primary rounded-lg text-xs"
                    >
                      Capture from Device
                    </button>
                  )}
                  <AssetLibraryPanel
                    assets={assetLibrary}
                    frameCount={frames.length}
                    onAssign={assignScreenshotToFrame}
                    onRemove={removeAsset}
                    onClearAll={clearAllAssets}
                  />
                  <FrameScreenshotsPanel
                    frames={frames}
                    onReplace={handleReplaceScreenshot}
                    onClear={handleClearScreenshot}
                    onAssetAdded={addAssets}
                  />
                </>
              )}
              {leftTab === 'frames' && (
                <>
                  <p className="text-[10px] text-glint-text-tertiary">
                    Select a frame and reorder layers. Device bezels live in Design (right).
                  </p>
                  <FramesPanel
                    frames={frames}
                    activeIndex={activeIndex}
                    onSelectFrame={setActiveIndex}
                    canvas={activeCanvas}
                    getCanvasForFrame={getCanvasForFrame}
                    canvasWidth={canvasW}
                    canvasHeight={canvasH}
                  />
                </>
              )}
              {leftTab === 'export' && (
                <ExportPanel
                  frames={frames}
                  getLiveCanvases={getLiveCanvases}
                  exportPreset={exportPreset}
                  setExportPreset={setExportPreset}
                  themes={themes}
                  canvasWidth={canvasW}
                  canvasHeight={canvasH}
                  session={session}
                  template={template}
                  activeCanvas={activeCanvas}
                  screenshotList={screenshotList}
                  background={background}
                  deviceFrame={deviceFrame}
                  screenshotStyle={screenshotStyle}
                  textOverlay={textOverlay}
                  fontFamily={fontFamily}
                />
              )}
            </div>
          </div>
        </aside>

        <aside
          className="absolute right-0 top-0 bottom-0 z-30 bg-glint-surface/95 backdrop-blur-md border-l border-glint-border shadow-2xl overflow-hidden transition-[width,opacity] duration-200 ease-out"
          style={{
            width: rightOpen ? RIGHT_W : 0,
            opacity: rightOpen ? 1 : 0,
            pointerEvents: rightOpen ? 'auto' : 'none',
          }}
        >
          <div className="w-[300px] h-full">
            <PropertiesPanel
              canvas={activeCanvas}
              getCanvases={getLiveCanvases}
              background={background}
              onBackgroundChange={handleBackgroundChange}
              frame={deviceFrame}
              onFrameChange={handleDeviceFrameChange}
              onFrameHighlight={setDeviceFrame}
              screenshotStyle={screenshotStyle}
              onScreenshotStyleChange={handleScreenshotStyleChange}
              fontFamily={fontFamily}
              onFontFamilyChange={setFontFamily}
              onAddText={handleAddText}
              onDelete={handleDelete}
              store={exportPreset}
              templatePalette={templatePalette}
              onPaletteColorChange={handlePaletteColorChange}
              onExtractThemeNow={handleExtractThemeNow}
              canExtractTheme={
                !!template
                && templatePalette.length > 0
                && (assetLibrary.some((a) => isUserScreenshot(a.url))
                  || frames.some((f) => isUserScreenshot(f.screenshotUrl)))
              }
              onDeviceTransform={markDirty}
              onDeviceScaleAdjustStart={pushHistory}
              onCopyToFrame={() => setCopyToFrameOpen(true)}
              hasSelection={!!activeCanvas?.getActiveObject()}
              theme={theme}
            />
          </div>
        </aside>
      </div>

      {deviceMenu && (
        <DeviceContextMenu
          x={deviceMenu.clientX}
          y={deviceMenu.clientY}
          hasScreenshot={isUserScreenshot(
            deviceMenu.device?.glintScreenshotUrl
              || frames.find((f) => f.id === deviceMenu.frameId)?.screenshotUrl,
          )}
          onImport={handleDeviceImportClick}
          onClear={handleDeviceClear}
          onClose={closeDeviceMenu}
        />
      )}
      <CopyToFrameModal
        open={copyToFrameOpen}
        frames={frames}
        activeIndex={activeIndex}
        onCopy={handleCopyToFrame}
        onClose={() => setCopyToFrameOpen(false)}
        getCanvasForFrame={(id) => canvasMapRef.current[id]}
      />
      <input
        ref={deviceFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleDeviceFileChange}
      />

      <ConfirmDialog
        open={!!pendingTemplate}
        title="Replace template?"
        message="Frame layouts and text from the current pack will be replaced. Your screenshots stay on the board."
        confirmLabel="Replace"
        cancelLabel="Cancel"
        enterConfirms
        onConfirm={confirmReplaceTemplate}
        onCancel={() => setPendingTemplate(null)}
      />

      <ConfirmDialog
        open={stripConfirmOpen}
        title="Clear all frames?"
        message="Removes template styling and screenshots from every frame. Device bezels stay with blank screens."
        confirmLabel="Clear all"
        cancelLabel="Cancel"
        danger
        enterConfirms
        onConfirm={confirmStripToDeviceFrames}
        onCancel={() => setStripConfirmOpen(false)}
      />

      <ConfirmDialog
        open={leaveOpen}
        title="Leave editor?"
        message="Unsaved changes will be lost. Download a .glint file first if you want to keep editing later."
        confirmLabel="Leave"
        cancelLabel="Stay"
        danger
        onConfirm={confirmLeaveEditor}
        onCancel={() => setLeaveOpen(false)}
      />
    </div>
  );
}

function ToolBtn({ children, onClick, active, title, disabled, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-2 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none ${
        danger
          ? 'bg-glint-danger text-white hover:opacity-90'
          : active
            ? 'bg-glint-accent text-glint-text-on-accent'
            : 'text-glint-text-secondary hover:bg-glint-surface-2'
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-glint-border-strong mx-1" />;
}

function isLight(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return false;
  const c = hex.slice(1);
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}
