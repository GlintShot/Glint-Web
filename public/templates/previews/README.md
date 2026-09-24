# Static template preview strips

One PNG per template id for fast Home / gallery tiles (no Fabric, no WebGL).

| File | Example |
|------|---------|
| `{template-id}.png` | `noir-orbit-ios.png`, `aurora-soft-play.png` |

Generate / refresh (Node `canvas` — no Playwright):

```bash
cd Glint-Web
npm run generate:previews
# optional: only specific ids
node scripts/gen-template-previews.mjs --only=noir-orbit-ios,aurora-soft-play
```

The script discovers flat `templates/*.json` **and** family packs (`TEMPLATE_FAMILY_PATHS`). Live-3D slides get an angled foreshortened device draw so strips match the hero look without baking WebGL.
