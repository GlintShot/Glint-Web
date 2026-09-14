import { Bot, Copy, Pause, Play, X } from 'lucide-react';
import { useState } from 'react';

/**
 * Compact Copilot control: Allow → board code + play/pause + close.
 */
export default function CopilotBar({
  enabled,
  paused,
  pairCode,
  status,
  onEnable,
  onDisable,
  onPause,
  onResume,
  onCopyPair,
}) {
  const [copied, setCopied] = useState(false);
  const busy = status?.phase === 'select' || status?.phase === 'apply';
  const liveHint = busy ? status?.label : paused ? 'Paused' : 'Live';

  const handleCopy = async () => {
    const ok = onCopyPair ? await onCopyPair() : false;
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={onEnable}
        className="pointer-events-auto group inline-flex items-center gap-2 rounded-full border border-glint-border/80 bg-glint-surface/95 backdrop-blur-md pl-1.5 pr-3.5 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:border-glint-accent/50 hover:shadow-[0_8px_30px_rgba(201,162,39,0.18)] transition-all"
        title="Let your coding agent drive this board with you"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-glint-accent text-glint-text-on-accent shadow-sm">
          <Bot size={14} strokeWidth={2.25} />
        </span>
        <span className="text-[12px] font-semibold tracking-tight text-glint-text">
          Allow agent
        </span>
      </button>
    );
  }

  return (
    <div
      className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-glint-border/80 bg-glint-surface/95 backdrop-blur-md p-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
      title={liveHint || 'Copilot'}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full ${
          paused
            ? 'bg-glint-surface-2 text-glint-text-secondary'
            : busy
              ? 'bg-glint-accent-muted text-glint-accent animate-pulse'
              : 'bg-glint-accent-muted text-glint-accent'
        }`}
        aria-hidden
      >
        <Bot size={14} strokeWidth={2.25} />
      </span>

      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex h-8 min-w-[4.5rem] items-center justify-center gap-1.5 rounded-full px-2.5 font-mono text-[12px] font-bold tracking-[0.14em] text-glint-text hover:bg-glint-surface-2 transition-colors"
        title="Board ID - copy and give this to your agent"
      >
        {copied ? (
          <span className="tracking-normal text-glint-accent text-[11px] font-semibold">Copied</span>
        ) : (
          <>
            <span>{pairCode}</span>
            <Copy size={11} className="opacity-50" />
          </>
        )}
      </button>

      <span className="mx-0.5 h-4 w-px bg-glint-border/80" aria-hidden />

      {paused ? (
        <IconBtn onClick={onResume} title="Resume agent" label="Play">
          <Play size={14} fill="currentColor" />
        </IconBtn>
      ) : (
        <IconBtn onClick={onPause} title="Pause - you take over" label="Pause">
          <Pause size={14} fill="currentColor" />
        </IconBtn>
      )}

      <IconBtn onClick={onDisable} title="Disconnect agent" label="Close" danger>
        <X size={14} strokeWidth={2.25} />
      </IconBtn>
    </div>
  );
}

function IconBtn({ onClick, title, label, children, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
        danger
          ? 'text-glint-text-tertiary hover:bg-red-500/10 hover:text-red-500'
          : 'text-glint-text-secondary hover:bg-glint-surface-2 hover:text-glint-text'
      }`}
    >
      {children}
    </button>
  );
}
