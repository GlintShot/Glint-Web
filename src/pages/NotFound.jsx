import { Link } from 'react-router-dom';

/**
 * Shared shell for 404 / crash screens — brand first, one composition.
 */
export function StatusScreen({
  code,
  title,
  detail,
  primaryTo = '/',
  primaryLabel = 'Back to Studio',
  onPrimary,
  secondaryTo,
  secondaryLabel,
  onSecondary,
  /** Larger floating code + staggered entrance (404). */
  animated = false,
}) {
  const primaryClass =
    'px-5 py-2.5 rounded-xl bg-glint-accent text-glint-text-on-accent text-sm font-semibold hover:bg-glint-accent-hover transition-colors';
  const secondaryClass =
    'px-5 py-2.5 rounded-xl border border-glint-border bg-glint-surface/70 text-sm font-semibold text-glint-text hover:border-glint-accent/40 transition-colors';

  return (
    <div className="min-h-screen glint-gradient-bg flex flex-col items-center justify-center px-6 text-center selection:bg-glint-accent/30 selection:text-glint-text overflow-hidden">
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.22em] text-glint-accent mb-2 ${
          animated ? 'glint-status-rise' : ''
        }`}
        style={animated ? { animationDelay: '0.05s' } : undefined}
      >
        Glint Studio
      </p>
      {code ? (
        <p
          className={
            animated
              ? 'glint-status-code mb-4'
              : 'text-6xl sm:text-7xl font-extrabold tabular-nums tracking-tight text-glint-text/15 leading-none mb-3'
          }
          aria-hidden={animated ? 'true' : undefined}
        >
          {code}
        </p>
      ) : null}
      <h1
        className={`text-2xl sm:text-3xl font-bold text-glint-text tracking-tight max-w-md ${
          animated ? 'glint-status-rise' : ''
        }`}
        style={animated ? { animationDelay: '0.18s' } : undefined}
      >
        {title}
      </h1>
      {detail ? (
        <p
          className={`mt-3 text-sm text-glint-text-secondary max-w-sm leading-relaxed ${
            animated ? 'glint-status-rise' : ''
          }`}
          style={animated ? { animationDelay: '0.3s' } : undefined}
        >
          {detail}
        </p>
      ) : null}
      <div
        className={`mt-8 flex flex-wrap items-center justify-center gap-3 ${
          animated ? 'glint-status-rise' : ''
        }`}
        style={animated ? { animationDelay: '0.42s' } : undefined}
      >
        {onPrimary ? (
          <button type="button" onClick={onPrimary} className={primaryClass}>
            {primaryLabel}
          </button>
        ) : (
          <Link to={primaryTo} className={primaryClass}>
            {primaryLabel}
          </Link>
        )}
        {onSecondary ? (
          <button type="button" onClick={onSecondary} className={secondaryClass}>
            {secondaryLabel}
          </button>
        ) : secondaryTo && secondaryLabel ? (
          <Link to={secondaryTo} className={secondaryClass}>
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      title="This page isn’t on the board"
      detail="The link may be mistyped, or the frame you’re looking for moved."
      primaryTo="/"
      primaryLabel="Back to Studio"
      secondaryTo="/editor"
      secondaryLabel="Open editor"
      animated
    />
  );
}
