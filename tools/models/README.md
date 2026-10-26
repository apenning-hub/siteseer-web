# Models

The homepage 3D uses two GLB files in `public/models/`, built here:

| File | Source | What it is |
|---|---|---|
| `detail.glb` | `make_detail.py` | Placeholder window-opening detail: 12 layers from Sean's Vectary cards |
| `site.glb` | `make_site.py` | Placeholder building site the detail sits on in the hero finale |

Rebuild both with `npm run models`. This generates raw GLBs into `out/` (git-ignored) and compresses them into `public/models/` with `compress.mjs`, which applies tangents, WebP textures at 512 px and meshopt geometry. Check a file with `node tools/models/validate.mjs public/models/detail.glb`.

## Naming rule (the site code depends on it)

- **Detail layers:** each layer is the outermost node named `L01_…` to `L12_…`. Material names start with the same `Lnn`.
- **Inspection markers:** optional empty nodes named `Lnn_pin`, placed as children of their layer. Leave them empty; `compress.mjs` keeps them.
- **Site props:** each prop group is a node named `S_<thing>` (`S_ground`, `S_slab`, `S_frame`, …). The "Pause the build" tile uses `S_slab` and `S_frame`.

## Swapping in the real models

1. Export the GLB from Vectary (or Unreal/Rhino).
2. Rename the nodes to match the rule above.
3. Run `node tools/models/compress.mjs real.glb public/models/detail.glb`.
4. Check it with `validate.mjs`.

No site code changes.

## Textures

CC0, from [Poly Haven](https://polyhaven.com): brown_mud_dry, concrete_floor_worn_001, fine_grained_wood, sand_01, clay_plaster, metal_plate and white_plaster_02.

- `clay`, `metal` and `plaster` are greyscale versions, tinted by each material's base colour.
- `wood` and `concrete` are brightened.

Texture coordinates are projected from each face in world space (`glb.py`), so a texture tiles at real-world scale.
