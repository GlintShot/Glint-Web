# 3D device frames

Each Flat PNG bezel in `public/frames/{frameId}.png` shares an id with Live 3D.

## How it works

- **Flat (3D off):** photo-real PNG bezel + screenshot hole (`FRAME_INSETS`).
- **Live 3D (3D on):** company-grade procedural mesh sized from the same `FRAME_INSETS`
  (rounded body, titanium/glass finish, Dynamic Island or punch-hole, side buttons,
  contact shadow, screen glass fresnel). Screenshot is UV-mapped to the screen plane.

## Optional GLB upgrade

Drop a licensed/self-authored model at:

```
public/frames/3d/{frameId}.glb
```

e.g. `iphone16-pro.glb`, `pixel9.glb`. The bake path already reserves
`glbUrlForFrame(frameId)` — wire a GLTF loader when assets land. Until then,
procedural meshes are the production renderer (no Three.js required).

## Export

Live 3D always bakes to PNG before ZIP so store uploads stay flat bitmaps.
