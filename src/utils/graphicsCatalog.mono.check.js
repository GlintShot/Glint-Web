/** Self-check: mono vs color catalog flags + asset files on disk. Run: node src/utils/graphicsCatalog.mono.check.js */
import {
  ICONS, BRANDS, SHAPES_SVG, BLOBS, BADGES, HANDS, CHARTS, COLOR_ICONS, STICKERS,
  illustrationsByCollection,
} from './graphicsCatalog.js';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../public/graphics');
const assert = (c, m) => { if (!c) throw new Error(m); };

assert(ICONS.every((g) => g.mono === true), 'icons mono');
assert(COLOR_ICONS.every((g) => g.mono === false), 'color icons keep color');
assert(HANDS.concat(CHARTS, BADGES, BLOBS, STICKERS).every((g) => g.mono === false), 'accents keep color');
assert(illustrationsByCollection('Humaaans').every((g) => g.mono === false), 'humaaans keep color');

for (const g of [...HANDS, ...CHARTS, ...COLOR_ICONS, ...BADGES, ...STICKERS]) {
  assert(existsSync(join(root, g.src)), `missing ${g.src}`);
}
console.log('graphicsCatalog.mono.check: ok');
