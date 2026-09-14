/**
 * Assert-based check for copilotRegistry (node-friendly).
 * Run: node src/utils/copilotRegistry.check.js
 */
import assert from 'node:assert/strict';
import {
  applyTitlePair,
  findBoard,
  listBoards,
  newPairCode,
  removeBoard,
  upsertBoard,
} from './copilotRegistry.js';

function memStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

const code = newPairCode(() => Uint8Array.from([1, 2, 3, 4]));
assert.equal(code.length, 4);
assert.match(code, /^[A-Z0-9]{4}$/);

const storage = memStorage();
const now = 1_000_000;
upsertBoard(storage, {
  tabId: 't1',
  pairCode: 'K7MP',
  token: 'tok-1',
  href: 'http://localhost/editor',
  frameCount: 5,
  enabled: true,
  focused: false,
  updatedAt: now,
});
upsertBoard(storage, {
  tabId: 't2',
  pairCode: 'AB12',
  token: 'tok-2',
  href: 'http://localhost/editor',
  frameCount: 3,
  enabled: true,
  focused: true,
  updatedAt: now,
});

const boards = listBoards(storage, { now, maxAgeMs: 60_000 });
assert.equal(boards.length, 2);
assert.equal(boards[0].pairCode, 'AB12', 'focused board sorts first');
assert.equal(findBoard(storage, 'k7mp', { now })?.tabId, 't1');

listBoards(storage, { now: now + 120_000, maxAgeMs: 60_000 });
assert.equal(listBoards(storage, { now: now + 120_000 }).length, 0, 'stale boards drop');

upsertBoard(storage, {
  tabId: 't3',
  pairCode: 'ZZ99',
  token: 'tok-3',
  enabled: true,
  focused: true,
  updatedAt: now,
});
removeBoard(storage, 't3');
assert.equal(findBoard(storage, 'ZZ99', { now }), null);

assert.equal(applyTitlePair('Glint Web', 'K7MP'), '[Glint K7MP] Glint Web');
assert.equal(applyTitlePair('[Glint AB12] Glint Web', 'K7MP'), '[Glint K7MP] Glint Web');

console.log('copilotRegistry.check.js: ok');
