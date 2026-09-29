import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { loadAllTemplates, loadThemePresets, loadTemplate } from '../utils/templateLoader';
import { framesFromTemplate } from '../hooks/useFrames';
import { applyDesignToFrame } from '../utils/templateEngine';
import { createCanvas } from '../utils/canvasEngine';
import {
  buildExportFilenames,
  buildZipBlob,
  EXPORT_PRESETS,
  resolveStoreKey,
  zipFileName,
} from '../utils/exportHelper';

/**
 * Headless / agent export page.
 * Query: ?template=blink-play
 * PostMessage or window.__GLINT_HEADLESS__ with { screenshots: string[] } (data URLs or http URLs).
 * Sets window.__GLINT_EXPORT_READY__ = { ok, zipBase64, filenames, error }.
 */
export default function HeadlessExport() {
  const [params] = useSearchParams();
  const templateId = params.get('template') || 'blink-play';
  const exportName = params.get('name') || 'glint';
  const fastlane = params.get('layout') === 'fastlane';
  const locale = params.get('locale') || null;
  const [status, setStatus] = useState('Waiting for screenshots…');

  const done = (payload) => {
    window.__GLINT_EXPORT_READY__ = payload;
    window.dispatchEvent(new CustomEvent('glint-export-ready', { detail: payload }));
  };

  useEffect(() => {
    let cancelled = false;

    const run = async (screenshotUrls) => {
      try {
        setStatus('Loading template…');
        const themes = await loadThemePresets();
        let template;
        try {
          template = await loadTemplate(templateId);
        } catch {
          const templates = await loadAllTemplates({ enabledOnly: false });
          template = templates.find((t) => t.id === templateId) || templates[0];
        }
        if (!template) throw new Error(`Template not found: ${templateId}`);

        const store = resolveStoreKey(template.store || 'play/phone');
        const preset = EXPORT_PRESETS[store] ?? EXPORT_PRESETS['play/phone'];
        const canvasW = template.canvas?.width || preset.width;
        const canvasH = template.canvas?.height || preset.height;

        const board = framesFromTemplate(template, screenshotUrls || []);
        setStatus(`Rendering ${board.length} frame(s)…`);
        const dataUrls = [];
        for (let i = 0; i < board.length; i++) {
          if (cancelled) return;
          const frame = board[i];
          const el = document.createElement('canvas');
          const canvas = createCanvas(el, canvasW, canvasH);
          try {
            await applyDesignToFrame(canvas, frame.design, frame.screenshotUrl, {
              canvasWidth: canvasW,
              canvasHeight: canvasH,
              themes,
              editable: false,
            });
            dataUrls.push(canvas.toDataURL({ format: 'png', multiplier: 1 }));
          } finally {
            canvas.dispose();
          }
        }

        const filenames = buildExportFilenames(dataUrls.length, { format: 'png', fastlane, locale, store });
        const blob = await buildZipBlob(dataUrls, filenames);
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const zipBase64 = btoa(binary);

        if (cancelled) return;
        setStatus(`OK · ${dataUrls.length} PNGs · Glint-ss.zip`);
        done({
          ok: true,
          zipBase64,
          zipName: 'Glint-ss.zip',
          filenames,
          count: dataUrls.length,
          store,
          templateId: template.id,
        });
      } catch (err) {
        const message = err?.message || String(err);
        setStatus(`Error: ${message}`);
        done({ ok: false, error: message });
      }
    };

    const onMessage = (ev) => {
      const data = ev.data;
      if (!data || data.type !== 'glint-export') return;
      run(data.screenshots || []);
    };

    window.addEventListener('message', onMessage);

    // Auto-run if screenshots already injected
    const boot = () => {
      const injected = window.__GLINT_HEADLESS__?.screenshots;
      if (Array.isArray(injected) && injected.length) {
        run(injected);
      } else {
        setStatus('Ready - post { type: "glint-export", screenshots: [...] } or set __GLINT_HEADLESS__');
        done({ ok: false, error: 'awaiting_screenshots', pending: true });
      }
    };
    boot();

    return () => {
      cancelled = true;
      window.removeEventListener('message', onMessage);
    };
  }, [templateId, exportName, fastlane, locale]);

  const hint = useMemo(
    () => `template=${templateId} · ${fastlane ? `fastlane/${locale || 'en-US'}` : 'Frame_1.png …'}`,
    [templateId, fastlane, locale],
  );

  return (
    <div className="min-h-screen bg-glint-bg text-glint-text p-8 font-mono text-sm">
      <h1 className="text-lg font-semibold mb-2">Glint headless export</h1>
      <p className="text-glint-text-secondary mb-4">{hint}</p>
      <p data-testid="headless-status">{status}</p>
    </div>
  );
}
