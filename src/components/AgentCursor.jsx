/**
 * Copilot agent cursor - tip-aligned Glint pointer (visible only while agent acts).
 * Asset: /graphics/icons/agent-cursor.svg — tip hotspot at (5, 2).
 */
import { useEffect, useState } from 'react';

const HOTSPOT_X = 5;
const HOTSPOT_Y = 2;
const CURSOR_SRC = '/graphics/icons/agent-cursor.svg';

export default function AgentCursor({ visible, x, y, label, busy, clicking }) {
  const [tapBurst, setTapBurst] = useState(0);

  useEffect(() => {
    if (!clicking || !visible) return;
    setTapBurst((n) => n + 1);
  }, [clicking, visible, x, y]);

  if (!visible || x == null || y == null) return null;

  const coreClass = [
    'glint-agent-cursor-core',
    busy ? 'is-busy' : '',
    clicking ? 'is-clicking' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="glint-agent-cursor pointer-events-none fixed z-[80]"
      style={{
        transform: `translate3d(${x - HOTSPOT_X}px, ${y - HOTSPOT_Y}px, 0)`,
      }}
      aria-hidden
    >
      <div className={coreClass}>
        <img
          className="glint-agent-cursor-img"
          src={CURSOR_SRC}
          width={32}
          height={32}
          alt=""
          draggable={false}
        />
        <span className="glint-agent-cursor-glow" />
        <span className="glint-agent-cursor-ring" />
        {tapBurst > 0 ? (
          <span key={tapBurst} className="glint-agent-cursor-ripple" />
        ) : null}
      </div>
      {label ? <div className="glint-agent-cursor-label">{label}</div> : null}
    </div>
  );
}
