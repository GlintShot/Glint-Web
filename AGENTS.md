# Glint-Web - Agent Instructions

Gint-Web is the frames editor (AppLaunchpad-style board). Import raw screenshots → pick template → set headlines → export store-ready ZIP.

**Full workflow:** See `skills/glint/SKILL.md` in the GlintShot org for the complete multi-repo pipeline.

## Sidebars

**Left** (workflow tabs): Templates · Assets · Frames · Export

**Right** (Design tabs):
- `Device` - visual device bezel tiles (replace selected / active artboard device)
- `Graphics` - visual graphic preview tiles
- `Colors` - background swatches
- `Design` - text insert, fonts, typography

**Center:** frames board. Active artboard has accent ring; Fabric objects use gold selection handles.

## Rules

1. Real UI only
2. `session.json` + PNGs import contract
3. Store sizes: Play `1080x1920`, iOS phone `1290x2796`, iPad `2048x2732`
4. ZIP `{AppName}.zip` or `glint.zip`
5. View handoff via Copy for Glint View (`data:` screens)

## Template Previews

Static preview images in `public/templates/previews/` show each template on the Home page.

**Regenerate previews when:**
- Adding/modifying template JSON files in `public/templates/`
- Changing template slide layouts or theme colors

**Command:**
```bash
npm run generate:previews
```

Output: `public/templates/previews/{template-id}.png` (one per template)

Commit the updated preview images with your template changes.

## Headless polish (agents)

**Manual Studio and headless are both JS canvas — not CSS.** Studio = `canvasEngine.js` (Fabric). Fast polish = `compose.js` + `render.mjs`. For pixel-identical Studio output use `headless-export.mjs` (Playwright).

Bridge `output/` → store ZIP:

```bash
node scripts/polish-session.mjs \
  --session ../Glint-Bridge/output \
  --out app-play.zip \
  --template mint-tags-play \
  --headlines "Line one,Line two,Line three,Line four,Line five"
```

Uses `theme.json` from Bridge (or samples colors), crops leftover status/nav, fits the device under a caption band, flood-fill clips the shot to the bezel hole, draws bezel on top, editor-like drop shadow.

Layout self-check: `node scripts/check-polish-layout.mjs`

Studio twin: `node scripts/headless-export.mjs --session … --template … --out …` (needs `npm run preview`).

## Future (do not implement unless asked)

Marketplace / contribute `.glint` → community gallery: `docs/FUTURE-marketplace-glint.md`.
