import {
  Plus, Copy, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useRef, useState } from 'react';
import FrameCanvas from './FrameCanvas';
import { MAX_FRAMES, MIN_FRAMES } from '../hooks/useFrames';
import { readDroppedScreenshotUrl } from '../utils/assetLibrary';

/**
 * AppLaunchpad-style board: horizontal row of clipped Frame artboards.
 * Scrolls horizontally when zoomed in; no vertical pan.
 */
export default function FrameBoard({
  frames,
  activeIndex,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
  onCanvasReady,
  onDeviceContextMenu,
  canvasWidth = 1080,
  canvasHeight = 1920,
  themes = {},
  fitScale = 20,
  padLeft = 0,
  padRight = 0,
  padBottom = 52,
  onDropScreenshot,
  onClearSelection,
  showFrameChrome = false,
  /** Frame index the Copilot agent is currently acting on (telepresence). */
  agentFrameIndex = null,
}) {
  const sizeLabel = `${canvasWidth}×${canvasHeight}`;
  const scale = fitScale / 100;
  const displayW = Math.max(1, Math.round(canvasWidth * scale));
  const displayH = Math.max(1, Math.round(canvasHeight * scale));
  const frameGap = Math.max(4, Math.round(displayW * 0.035));
  const boardPadX = Math.max(12, Math.round(displayW * 0.06));
  const scrollRef = useRef(null);
  const [dropTarget, setDropTarget] = useState(null);

  const handleFrameDragOver = (e, index) => {
    const types = Array.from(e.dataTransfer?.types || []);
    const hasShot = types.includes('application/x-glint-screenshot');
    const hasFiles = types.includes('Files');
    if (!hasShot && !hasFiles) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setDropTarget(index);
  };

  const handleFrameDrop = async (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const url = readDroppedScreenshotUrl(e.dataTransfer);
    if (url) {
      await onDropScreenshot?.(index, url);
      return;
    }
    const file = Array.from(e.dataTransfer.files || []).find((f) => f.type.startsWith('image/'));
    if (file && onDropScreenshot) {
      const blobUrl = URL.createObjectURL(file);
      await onDropScreenshot(index, blobUrl, { id: `drop-${Date.now()}`, name: file.name, url: blobUrl });
    }
  };

  const handleBoardPointerDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('[data-frame-column]')) return;
    onClearSelection?.();
  };

  /** Trackpad vertical wheel → horizontal scroll when board overflows. */
  const handleBoardWheel = (e) => {
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  };

  return (
    <div
      ref={scrollRef}
      className="h-full w-full overflow-x-auto overflow-y-hidden frame-board-scroll overscroll-y-none"
      style={{ paddingBottom: padBottom }}
      onMouseDown={handleBoardPointerDown}
      onWheel={handleBoardWheel}
    >
      <div
        className="inline-flex h-full items-center shrink-0"
        style={{
          gap: frameGap,
          paddingLeft: Math.max(12, padLeft + boardPadX),
          paddingRight: Math.max(12, padRight + boardPadX),
        }}
      >
        {frames.map((frame, i) => {
          const selected = i === activeIndex;
          const agentFocus = agentFrameIndex === i;
          const chromeVisible = showFrameChrome || selected || agentFocus;
          return (
            <div
              key={frame.id}
              data-frame-column
              data-frame-index={i}
              className={`relative flex flex-col items-center shrink-0 group ${
                selected ? 'cursor-default' : 'cursor-pointer'
              }`}
              onClick={() => onSelect(i)}
              onDragLeave={() => setDropTarget((t) => (t === i ? null : t))}
              onDragOver={(e) => handleFrameDragOver(e, i)}
              onDrop={(e) => handleFrameDrop(e, i)}
            >
              <div
                className={`flex items-center gap-0.5 mb-2 shrink-0 transition-opacity ${
                  chromeVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <CtrlBtn
                  title="Add frame after"
                  disabled={frames.length >= MAX_FRAMES}
                  onClick={(e) => { e.stopPropagation(); onAdd(i); }}
                >
                  <Plus size={14} />
                </CtrlBtn>
                <CtrlBtn
                  title="Duplicate"
                  disabled={frames.length >= MAX_FRAMES}
                  onClick={(e) => { e.stopPropagation(); onDuplicate(i); }}
                >
                  <Copy size={14} />
                </CtrlBtn>
                <CtrlBtn
                  title="Delete"
                  disabled={frames.length <= MIN_FRAMES}
                  onClick={(e) => { e.stopPropagation(); onDelete(i); }}
                >
                  <Trash2 size={14} />
                </CtrlBtn>
                <CtrlBtn
                  title="Move left"
                  disabled={i === 0}
                  onClick={(e) => { e.stopPropagation(); onMove(i, -1); }}
                >
                  <ChevronLeft size={14} />
                </CtrlBtn>
                <CtrlBtn
                  title="Move right"
                  disabled={i === frames.length - 1}
                  onClick={(e) => { e.stopPropagation(); onMove(i, 1); }}
                >
                  <ChevronRight size={14} />
                </CtrlBtn>
              </div>

              <div
                data-frame-artboard
                className={`relative overflow-hidden rounded-md bg-glint-surface shrink-0 transition-[box-shadow,opacity,ring] duration-150 ${
                  dropTarget === i
                    ? 'ring-2 ring-glint-accent ring-offset-2 ring-offset-glint-bg shadow-lg shadow-glint-accent/30'
                    : agentFocus
                      ? 'ring-2 ring-glint-accent glint-copilot-pulse shadow-lg shadow-glint-accent/40'
                    : selected
                      ? 'ring-2 ring-glint-accent shadow-lg shadow-glint-accent/25'
                      : 'ring-1 ring-glint-border shadow-xl opacity-90 hover:opacity-100'
                }`}
                style={{ width: displayW, height: displayH }}
              >
                <FrameCanvas
                  frameId={frame.id}
                  design={frame.design}
                  screenshotUrl={frame.screenshotUrl}
                  fabricJson={frame.fabricJson || null}
                  canvasWidth={canvasWidth}
                  canvasHeight={canvasHeight}
                  displayScale={scale}
                  themes={themes}
                  editable={selected}
                  onCanvasReady={onCanvasReady}
                  onDeviceContextMenu={onDeviceContextMenu}
                  paintKey={frame.fabricRestoreKey || frame.design?.id || 'nodesign'}
                />
              </div>

              <div className="mt-2 text-center shrink-0">
                <div className={`text-xs font-semibold ${
                  agentFocus || selected ? 'text-glint-accent' : 'text-glint-text-secondary'
                }`}>
                  #{i + 1}
                  {agentFocus ? (
                    <span className="ml-1 text-[9px] font-medium uppercase tracking-wide text-glint-accent/80">
                      agent
                    </span>
                  ) : null}
                </div>
                <div className="text-[10px] text-glint-text-tertiary tabular-nums">{sizeLabel}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CtrlBtn({ children, onClick, disabled, title }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="p-1.5 rounded-md bg-glint-surface border border-glint-border text-glint-text-secondary hover:text-glint-text hover:bg-glint-surface-2 disabled:opacity-30 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}
