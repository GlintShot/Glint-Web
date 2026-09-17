import { describe, expect, it, beforeEach } from 'vitest';
import {
  copySelectionToClipboard,
  cutSelectionToClipboard,
  pasteClipboardToCanvas,
  hasClipboard,
  __resetClipboard,
} from '../objectClipboard.js';

function makeObj(role, props = {}) {
  return {
    glintRole: role,
    left: props.left ?? 10,
    top: props.top ?? 20,
    opacity: 1,
    toJSON: () => ({
      type: 'rect',
      left: props.left ?? 10,
      top: props.top ?? 20,
      glintRole: role,
    }),
    set(p) {
      Object.assign(this, p);
    },
    setCoords() {},
    bringToFront() {},
  };
}

describe('objectClipboard', () => {
  beforeEach(() => {
    __resetClipboard();
  });

  it('copies transferable objects and skips devices', () => {
    const graphic = makeObj('graphic');
    const device = makeObj('framed-screenshot');
    const canvas = {
      getActiveObject: () => ({ type: 'activeSelection', getObjects: () => [graphic, device] }),
    };
    expect(copySelectionToClipboard(canvas)).toEqual({ ok: true, count: 1 });
    expect(hasClipboard()).toBe(true);
  });

  it('cut removes only transferable objects', () => {
    const graphic = makeObj('graphic');
    let removed = null;
    const canvas = {
      getActiveObject: () => graphic,
      discardActiveObject: () => {},
      remove: (o) => {
        removed = o;
      },
      requestRenderAll: () => {},
    };
    expect(cutSelectionToClipboard(canvas).ok).toBe(true);
    expect(removed).toBe(graphic);
  });

  it('rejects empty clipboard on paste', async () => {
    const res = await pasteClipboardToCanvas({});
    expect(res.ok).toBe(false);
    expect(res.error).toBe('clipboard_empty');
  });
});
