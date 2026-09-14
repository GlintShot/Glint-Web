/**
 * Copilot board registry (same-origin tabs via localStorage).
 * Agents list boards / match a short pair code instead of guessing which of N tabs.
 */
export const REGISTRY_KEY = 'glint.copilot.boards.v1';
export const BOARD_MAX_AGE_MS = 60_000;

function readMap(storage) {
  try {
    const raw = storage.getItem(REGISTRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(storage, map) {
  storage.setItem(REGISTRY_KEY, JSON.stringify(map));
}

/** Short code humans can say to an agent (e.g. K7MP). */
export function newPairCode(randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(4);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function upsertBoard(storage, entry) {
  if (!entry?.tabId) return null;
  const map = readMap(storage);
  map[entry.tabId] = {
    ...map[entry.tabId],
    ...entry,
    updatedAt: entry.updatedAt ?? Date.now(),
  };
  writeMap(storage, map);
  return map[entry.tabId];
}

export function removeBoard(storage, tabId) {
  const map = readMap(storage);
  if (map[tabId]) {
    delete map[tabId];
    writeMap(storage, map);
    return true;
  }
  return false;
}

export function listBoards(storage, { maxAgeMs = BOARD_MAX_AGE_MS, now = Date.now() } = {}) {
  const map = readMap(storage);
  let dirty = false;
  const boards = [];
  for (const [id, row] of Object.entries(map)) {
    if (!row?.enabled || !row.pairCode) {
      delete map[id];
      dirty = true;
      continue;
    }
    if (now - (row.updatedAt || 0) > maxAgeMs) {
      delete map[id];
      dirty = true;
      continue;
    }
    boards.push(row);
  }
  if (dirty) writeMap(storage, map);
  boards.sort((a, b) => {
    if (a.focused !== b.focused) return a.focused ? -1 : 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  return boards;
}

export function findBoard(storage, pairCode, opts) {
  if (!pairCode) return null;
  const code = String(pairCode).trim().toUpperCase();
  return listBoards(storage, opts).find((b) => b.pairCode === code) || null;
}

const TITLE_MARK = /^\[Glint [A-Z0-9]{4}\]\s*/;

export function applyTitlePair(title, pairCode) {
  const base = String(title || '').replace(TITLE_MARK, '');
  return pairCode ? `[Glint ${pairCode}] ${base}` : base;
}
