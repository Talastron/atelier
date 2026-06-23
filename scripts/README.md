# Wardrobe asset scripts

## `generate-seed-wardrobe.mjs`

Generates the 20-piece luxury capsule used for the marketing demo and the
internal "try the app" experience. Backed by **Pollinations.ai** (a free,
unauthenticated URL wrapper around Flux Schnell) — no API key, no
watermark, deterministic per `seed`.

### Run

```sh
node scripts/generate-seed-wardrobe.mjs            # fill in anything missing
node scripts/generate-seed-wardrobe.mjs --force    # regenerate everything
node scripts/generate-seed-wardrobe.mjs lbd-crepe  # one slug only
```

Output lands in `public/seed-wardrobe/<slug>.jpg`. The script is
idempotent: it skips files that already exist unless you pass `--force`.

### Editing the capsule

The source of truth is [`src/seedWardrobe.js`](../src/seedWardrobe.js).

- **Change one image's look** — bump that item's `seed` integer and
  rerun with the slug argument. The rest of the capsule is unaffected.
- **Change the overall vibe** — edit `SEED_MASTER_PROMPT_PREFIX` /
  `SEED_MASTER_PROMPT_SUFFIX` at the bottom of the same file, then
  `--force` regenerate.
- **Add an item** — append an entry following the existing shape and
  rerun without `--force`; only the new slug is fetched.

### Copyright posture

Pollinations is Flux-backed, not Adobe Firefly. The IP story relies on
prompts that describe generic garments ("camel wool double-breasted
coat") rather than branded ones ("Max Mara Manuela"). The current
capsule has been written with that in mind; if you add items, keep
brand names out of the `prompt` field.

### Why JPG, not PNG with transparency

The wardrobe cards composite garments onto editorial cream/stone
backgrounds anyway, so the prompt asks for "pure white seamless
backdrop" and we ship JPGs. If you later need cutouts with alpha, the
app already bundles `@imgly/background-removal` — a one-shot in-app
pass over the seed wardrobe is the cheapest path.

### Tuning

In `generate-seed-wardrobe.mjs`:

- `WIDTH` / `HEIGHT` — output dimensions (default ~3:4 portrait).
- `MODEL` — Pollinations supports `flux`, `flux-realism`, `flux-anime`,
  `turbo`. Editorial garments → `flux` is the right default.
- `POLITE_DELAY_MS` — pause between requests. Don't lower this without
  reason; it's a free public endpoint.
