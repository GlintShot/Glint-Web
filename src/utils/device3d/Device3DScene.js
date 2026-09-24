/**
 * Company-grade procedural device renderer (WebGL, no Three.js required).
 * Screen hole matches FRAME_INSETS for the active frameId so Flat PNG and Live 3D share one id.
 * Optional GLB at /frames/3d/{frameId}.glb is reserved for a future loader; procedural is production-ready.
 */

import { FRAME_INSETS, getFrameMeta } from '../frameMeta.js';

const VERT = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec2 aUv;
attribute float aKind; /* 0=body 1=screen 2=chrome 3=shadow */
uniform mat4 uMVP;
uniform mat4 uModel;
varying vec3 vN;
varying vec3 vW;
varying vec2 vUv;
varying float vKind;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(uModel) * aNormal);
  vUv = aUv;
  vKind = aKind;
  gl_Position = uMVP * vec4(aPos, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying vec3 vN;
varying vec3 vW;
varying vec2 vUv;
varying float vKind;
uniform sampler2D uTex;
uniform float uHasTex;
uniform vec3 uBody;
uniform vec3 uAccent;
uniform vec3 uLightDir;
uniform vec3 uCamPos;

void main() {
  vec3 N = normalize(vN);
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(uCamPos - vW);
  float ndl = max(dot(N, L), 0.0);
  float wrap = ndl * 0.72 + 0.28;
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 48.0);

  if (vKind > 2.5) {
    /* soft contact shadow disc */
    float d = length(vUv - vec2(0.5));
    float a = smoothstep(0.5, 0.05, d) * 0.45;
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
    return;
  }

  if (vKind > 1.5) {
    /* camera island / buttons — darker metal */
    vec3 col = uAccent * (0.35 + wrap * 0.55) + vec3(spec * 0.35);
    gl_FragColor = vec4(col, 1.0);
    return;
  }

  if (vKind > 0.5) {
    /* screen */
    vec3 base = vec3(0.04, 0.045, 0.055);
    if (uHasTex > 0.5) {
      vec4 t = texture2D(uTex, vUv);
      base = mix(base, t.rgb, t.a);
    }
    /* glass fresnel */
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    base += vec3(0.55, 0.62, 0.72) * fres * 0.18;
    /* subtle vignette */
    vec2 c = vUv - 0.5;
    base *= 1.0 - dot(c, c) * 0.35;
    gl_FragColor = vec4(base, 1.0);
    return;
  }

  /* body — brushed titanium / glass back */
  vec3 col = uBody * wrap;
  col += vec3(spec) * 0.55;
  /* rim light */
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.2);
  col += uAccent * rim * 0.25;
  gl_FragColor = vec4(col, 1.0);
}
`;

function mat4() {
  return new Float32Array(16);
}
function identity(out) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}
function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}
function multiply(out, a, b) {
  const r = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      r[col * 4 + row] =
        a[row] * b[col * 4] +
        a[4 + row] * b[col * 4 + 1] +
        a[8 + row] * b[col * 4 + 2] +
        a[12 + row] * b[col * 4 + 3];
    }
  }
  out.set(r);
  return out;
}
function translate(out, x, y, z) {
  identity(out);
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}
function rotateY(out, rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  identity(out);
  out[0] = c;
  out[2] = s;
  out[8] = -s;
  out[10] = c;
  return out;
}
function rotateX(out, rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  identity(out);
  out[5] = c;
  out[6] = s;
  out[9] = -s;
  out[10] = c;
  return out;
}
function rotateZ(out, rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  identity(out);
  out[0] = c;
  out[1] = s;
  out[4] = -s;
  out[5] = c;
  return out;
}

function deg(n) {
  return (n * Math.PI) / 180;
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) || 'shader');
  }
  return s;
}

function makeProgram(gl) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || 'link');
  }
  return p;
}

/** Scene units: height ≈ 2.0; width from frame aspect. */
export function phoneLayoutForFrame(frameId) {
  const meta = getFrameMeta(frameId) || FRAME_INSETS.pixel9;
  const aspect = meta.width / meta.height;
  const H = 2.0;
  const W = H * aspect;
  const D = frameId?.includes('ipad') ? 0.055 : 0.085;
  const insetL = (meta.left / meta.width) * W;
  const insetR = (meta.right / meta.width) * W;
  const insetT = (meta.top / meta.height) * H;
  const insetB = (meta.bottom / meta.height) * H;
  const rxBody = Math.min(W, H) * 0.12;
  const rxScreen = (meta.rx / meta.width) * W * 0.55;
  const family = frameId?.includes('ipad')
    ? 'tablet'
    : frameId?.includes('iphone')
      ? 'iphone'
      : 'android';
  const finish =
    family === 'iphone'
      ? { body: [0.62, 0.63, 0.65], accent: [0.35, 0.36, 0.38] }
      : family === 'tablet'
        ? { body: [0.18, 0.18, 0.2], accent: [0.12, 0.12, 0.14] }
        : { body: [0.08, 0.09, 0.1], accent: [0.2, 0.22, 0.24] };
  return {
    W,
    H,
    D,
    insetL,
    insetR,
    insetT,
    insetB,
    rxBody,
    rxScreen,
    family,
    finish,
    screenW: W - insetL - insetR,
    screenH: H - insetT - insetB,
  };
}

function pushV(buf, x, y, z, nx, ny, nz, u, v, kind) {
  buf.pos.push(x, y, z);
  buf.nor.push(nx, ny, nz);
  buf.uv.push(u, v);
  buf.kind.push(kind);
}

function pushTri(buf, i0, i1, i2) {
  buf.idx.push(i0, i1, i2);
}

function pushQuad(buf, a, b, c, d) {
  pushTri(buf, a, b, c);
  pushTri(buf, a, c, d);
}

/** Rounded-rect extrusion (body shell). */
function addRoundedBox(buf, W, H, D, rx, kind, z0, z1) {
  const segments = 10;
  const hw = W / 2;
  const hh = H / 2;
  const r = Math.min(rx, hw * 0.95, hh * 0.95);

  // Front & back faces as triangle fans from rounded outline
  const ring = [];
  const corners = [
    { cx: hw - r, cy: hh - r, a0: 0, a1: Math.PI / 2 },
    { cx: -hw + r, cy: hh - r, a0: Math.PI / 2, a1: Math.PI },
    { cx: -hw + r, cy: -hh + r, a0: Math.PI, a1: (3 * Math.PI) / 2 },
    { cx: hw - r, cy: -hh + r, a0: (3 * Math.PI) / 2, a1: 2 * Math.PI },
  ];
  for (const c of corners) {
    for (let i = 0; i <= segments; i++) {
      const t = c.a0 + ((c.a1 - c.a0) * i) / segments;
      ring.push({ x: c.cx + Math.cos(t) * r, y: c.cy + Math.sin(t) * r });
    }
  }

  const n = ring.length;
  // Front
  const frontCenter = buf.pos.length / 3;
  pushV(buf, 0, 0, z1, 0, 0, 1, 0.5, 0.5, kind);
  const frontStart = buf.pos.length / 3;
  for (const p of ring) {
    pushV(buf, p.x, p.y, z1, 0, 0, 1, (p.x / W) + 0.5, (p.y / H) + 0.5, kind);
  }
  for (let i = 0; i < n; i++) {
    pushTri(buf, frontCenter, frontStart + i, frontStart + ((i + 1) % n));
  }
  // Back
  const backCenter = buf.pos.length / 3;
  pushV(buf, 0, 0, z0, 0, 0, -1, 0.5, 0.5, kind);
  const backStart = buf.pos.length / 3;
  for (const p of ring) {
    pushV(buf, p.x, p.y, z0, 0, 0, -1, (p.x / W) + 0.5, (p.y / H) + 0.5, kind);
  }
  for (let i = 0; i < n; i++) {
    pushTri(buf, backCenter, backStart + ((i + 1) % n), backStart + i);
  }
  // Side band
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p0 = ring[i];
    const p1 = ring[j];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dy / len;
    const ny = -dx / len;
    const i0 = buf.pos.length / 3;
    pushV(buf, p0.x, p0.y, z1, nx, ny, 0, 0, 0, kind);
    pushV(buf, p1.x, p1.y, z1, nx, ny, 0, 1, 0, kind);
    pushV(buf, p1.x, p1.y, z0, nx, ny, 0, 1, 1, kind);
    pushV(buf, p0.x, p0.y, z0, nx, ny, 0, 0, 1, kind);
    pushQuad(buf, i0, i0 + 1, i0 + 2, i0 + 3);
  }
}

function addScreen(buf, layout) {
  const { W, H, D, insetL, insetR, insetT, insetB } = layout;
  const z = D / 2 + 0.004;
  const x0 = -W / 2 + insetL;
  const x1 = W / 2 - insetR;
  const y0 = -H / 2 + insetB;
  const y1 = H / 2 - insetT;
  const i0 = buf.pos.length / 3;
  pushV(buf, x0, y0, z, 0, 0, 1, 0, 1, 1);
  pushV(buf, x1, y0, z, 0, 0, 1, 1, 1, 1);
  pushV(buf, x1, y1, z, 0, 0, 1, 1, 0, 1);
  pushV(buf, x0, y1, z, 0, 0, 1, 0, 0, 1);
  pushQuad(buf, i0, i0 + 1, i0 + 2, i0 + 3);
}

function addIsland(buf, layout) {
  if (layout.family !== 'iphone') return;
  const { W, H, D, insetT } = layout;
  const z = D / 2 + 0.006;
  const iw = W * 0.28;
  const ih = Math.min(insetT * 0.55, H * 0.035);
  const cx = 0;
  const cy = H / 2 - insetT * 0.55;
  const x0 = cx - iw / 2;
  const x1 = cx + iw / 2;
  const y0 = cy - ih / 2;
  const y1 = cy + ih / 2;
  const i0 = buf.pos.length / 3;
  pushV(buf, x0, y0, z, 0, 0, 1, 0, 0, 2);
  pushV(buf, x1, y0, z, 0, 0, 1, 1, 0, 2);
  pushV(buf, x1, y1, z, 0, 0, 1, 1, 1, 2);
  pushV(buf, x0, y1, z, 0, 0, 1, 0, 1, 2);
  pushQuad(buf, i0, i0 + 1, i0 + 2, i0 + 3);
}

function addPunchHole(buf, layout) {
  if (layout.family !== 'android') return;
  const { W, H, D, insetT } = layout;
  const z = D / 2 + 0.006;
  const r = Math.min(W, H) * 0.018;
  const cx = 0;
  const cy = H / 2 - insetT * 0.45;
  const segs = 16;
  const center = buf.pos.length / 3;
  pushV(buf, cx, cy, z, 0, 0, 1, 0.5, 0.5, 2);
  const start = buf.pos.length / 3;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pushV(buf, cx + Math.cos(a) * r, cy + Math.sin(a) * r, z, 0, 0, 1, 0, 0, 2);
  }
  for (let i = 0; i < segs; i++) {
    pushTri(buf, center, start + i, start + i + 1);
  }
}

function addSideButtons(buf, layout) {
  const { W, H, D } = layout;
  const z0 = -D * 0.15;
  const z1 = D * 0.15;
  const x = W / 2 + 0.008;
  const buttons = [
    { y: H * 0.22, h: H * 0.06 },
    { y: H * 0.08, h: H * 0.1 },
    { y: -H * 0.05, h: H * 0.1 },
  ];
  for (const b of buttons) {
    const y0 = b.y - b.h / 2;
    const y1 = b.y + b.h / 2;
    const i0 = buf.pos.length / 3;
    pushV(buf, x, y0, z1, 1, 0, 0, 0, 0, 2);
    pushV(buf, x, y1, z1, 1, 0, 0, 1, 0, 2);
    pushV(buf, x, y1, z0, 1, 0, 0, 1, 1, 2);
    pushV(buf, x, y0, z0, 1, 0, 0, 0, 1, 2);
    pushQuad(buf, i0, i0 + 1, i0 + 2, i0 + 3);
  }
}

function addContactShadow(buf, layout) {
  const { W, H } = layout;
  const y = -H / 2 - 0.02;
  const sw = W * 1.15;
  const sd = layout.D * 8;
  const i0 = buf.pos.length / 3;
  pushV(buf, -sw / 2, y, -sd / 2, 0, 1, 0, 0, 0, 3);
  pushV(buf, sw / 2, y, -sd / 2, 0, 1, 0, 1, 0, 3);
  pushV(buf, sw / 2, y, sd / 2, 0, 1, 0, 1, 1, 3);
  pushV(buf, -sw / 2, y, sd / 2, 0, 1, 0, 0, 1, 3);
  pushQuad(buf, i0, i0 + 1, i0 + 2, i0 + 3);
}

function buildMesh(frameId) {
  const layout = phoneLayoutForFrame(frameId);
  const buf = { pos: [], nor: [], uv: [], kind: [], idx: [] };
  const z0 = -layout.D / 2;
  const z1 = layout.D / 2;
  addRoundedBox(buf, layout.W, layout.H, layout.D, layout.rxBody, 0, z0, z1);
  addScreen(buf, layout);
  addIsland(buf, layout);
  addPunchHole(buf, layout);
  addSideButtons(buf, layout);
  addContactShadow(buf, layout);
  return { buf, layout };
}

export function glbUrlForFrame(frameId) {
  if (!frameId) return null;
  return `/frames/3d/${frameId}.glb`;
}

export class Device3DScene {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', {
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    if (!this.gl) throw new Error('WebGL unavailable');
    this.frameId = opts.frameId || 'pixel9';
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this._tex = null;
    this._prog = makeProgram(this.gl);
    this._loc = {
      aPos: this.gl.getAttribLocation(this._prog, 'aPos'),
      aNormal: this.gl.getAttribLocation(this._prog, 'aNormal'),
      aUv: this.gl.getAttribLocation(this._prog, 'aUv'),
      aKind: this.gl.getAttribLocation(this._prog, 'aKind'),
      uMVP: this.gl.getUniformLocation(this._prog, 'uMVP'),
      uModel: this.gl.getUniformLocation(this._prog, 'uModel'),
      uTex: this.gl.getUniformLocation(this._prog, 'uTex'),
      uHasTex: this.gl.getUniformLocation(this._prog, 'uHasTex'),
      uBody: this.gl.getUniformLocation(this._prog, 'uBody'),
      uAccent: this.gl.getUniformLocation(this._prog, 'uAccent'),
      uLightDir: this.gl.getUniformLocation(this._prog, 'uLightDir'),
      uCamPos: this.gl.getUniformLocation(this._prog, 'uCamPos'),
    };
    this._rebuildMesh();
  }

  setOrbit({ yaw = this.yaw, pitch = this.pitch, roll = this.roll } = {}) {
    this.yaw = yaw;
    this.pitch = pitch;
    this.roll = roll;
  }

  setFrameId(frameId) {
    this.frameId = frameId || this.frameId;
    this._rebuildMesh();
  }

  async setScreenshot(url) {
    if (!url) {
      this._clearTex();
      return;
    }
    const img = await loadImage(url);
    const gl = this.gl;
    if (!this._tex) this._tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  _clearTex() {
    if (this._tex) {
      this.gl.deleteTexture(this._tex);
      this._tex = null;
    }
  }

  _rebuildMesh() {
    const { buf, layout } = buildMesh(this.frameId);
    this.layout = layout;
    const gl = this.gl;
    this._count = buf.idx.length;
    this._pos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._pos);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(buf.pos), gl.STATIC_DRAW);
    this._nor = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._nor);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(buf.nor), gl.STATIC_DRAW);
    this._uv = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._uv);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(buf.uv), gl.STATIC_DRAW);
    this._kind = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._kind);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(buf.kind), gl.STATIC_DRAW);
    this._ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(buf.idx), gl.STATIC_DRAW);
  }

  _matrices() {
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const proj = perspective(mat4(), deg(28), aspect, 0.1, 100);
    const view = translate(mat4(), 0, 0.05, -4.6);
    const ry = rotateY(mat4(), deg(this.yaw));
    const rx = rotateX(mat4(), deg(this.pitch));
    const rz = rotateZ(mat4(), deg(this.roll));
    const model = multiply(mat4(), multiply(mat4(), ry, rx), rz);
    const mvp = multiply(mat4(), multiply(mat4(), proj, view), model);
    return { mvp, model };
  }

  render() {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this._prog);

    const { mvp, model } = this._matrices();
    gl.uniformMatrix4fv(this._loc.uMVP, false, mvp);
    gl.uniformMatrix4fv(this._loc.uModel, false, model);
    gl.uniform3fv(this._loc.uBody, this.layout.finish.body);
    gl.uniform3fv(this._loc.uAccent, this.layout.finish.accent);
    gl.uniform3fv(this._loc.uLightDir, [0.45, 0.75, 0.55]);
    gl.uniform3fv(this._loc.uCamPos, [0, 0.2, 4.6]);

    const bind = (loc, buf, size) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    bind(this._loc.aPos, this._pos, 3);
    bind(this._loc.aNormal, this._nor, 3);
    bind(this._loc.aUv, this._uv, 2);
    bind(this._loc.aKind, this._kind, 1);

    gl.uniform1f(this._loc.uHasTex, this._tex ? 1 : 0);
    if (this._tex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._tex);
      gl.uniform1i(this._loc.uTex, 0);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
    gl.drawElements(gl.TRIANGLES, this._count, gl.UNSIGNED_SHORT, 0);
  }

  toDataURL(mime = 'image/png') {
    this.render();
    return this.canvas.toDataURL(mime);
  }

  dispose() {
    this._clearTex();
    const gl = this.gl;
    for (const b of [this._pos, this._nor, this._uv, this._kind, this._ibo]) {
      if (b) gl.deleteBuffer(b);
    }
    if (this._prog) gl.deleteProgram(this._prog);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`screenshot load failed: ${url}`));
    img.src = url;
  });
}

export { webglAvailable } from './webglProbe.js';

/** @deprecated use phoneLayoutForFrame */
export function phoneDimsForFrame(frameId) {
  const L = phoneLayoutForFrame(frameId);
  return { w: L.W, h: L.H, d: L.D, rx: L.rxBody };
}
