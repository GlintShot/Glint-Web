/**
 * Copilot agent cursor - tip-aligned Glint pointer (visible only while agent acts).
 * Hotspot is the tip of the arrow (~6,4) so translate positions the tip, not the box.
 */
const HOTSPOT_X = 6;
const HOTSPOT_Y = 4;

export default function AgentCursor({ visible, x, y, label, busy }) {
  if (!visible || x == null || y == null) return null;

  return (
    <div
      className="glint-agent-cursor pointer-events-none fixed z-[80]"
      style={{
        transform: `translate3d(${x - HOTSPOT_X}px, ${y - HOTSPOT_Y}px, 0)`,
      }}
      aria-hidden
    >
      <div className={`glint-agent-cursor-core ${busy ? 'is-busy' : ''}`}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <defs>
            <linearGradient id="glintCursorFill" x1="6" y1="2" x2="24" y2="28" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f0d78c" />
              <stop offset="1" stopColor="#c9a227" />
            </linearGradient>
          </defs>
          <path
            d="M7 4.5c0-.9 1-.4 1.5-.1l14.2 9.1c.7.4.5 1.5-.3 1.6l-6.3.7 2.9 8.1c.2.6-.5 1.1-1 .7l-4.4-3.4-3.6 3.5c-.6.6-1.6.1-1.6-.7V4.5Z"
            fill="url(#glintCursorFill)"
            stroke="rgba(26,28,31,0.28)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <circle cx="11.5" cy="11.5" r="2.2" fill="rgba(255,255,255,0.55)" />
        </svg>
        <span className="glint-agent-cursor-ring" />
        <span className="glint-agent-cursor-glow" />
      </div>
      {label ? <div className="glint-agent-cursor-label">{label}</div> : null}
    </div>
  );
}
