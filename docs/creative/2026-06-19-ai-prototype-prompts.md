# Atelier — AI Image-Prototype Prompts

**Companion to the still-life photography brief. Eight Midjourney v7 prompts for prototyping the visual world before commissioning a photographer.**

| | |
|---|---|
| **Companion to** | `2026-06-19-still-life-photography-brief.md` |
| **Primary model** | Midjourney v7 |
| **Secondary** | Flux 1.1 [pro] (when photorealism beats stylisation) |
| **Use case** | Generate visual references to brief a real photographer, OR to use as temporary site imagery |

---

## 1. The honest framing

AI-generated imagery is a prototyping tool, not a final answer for a luxury brand.

A meaningful minority of Atelier's target readers will notice AI tells (fabric weave that does not quite resolve, brass slightly too saturated, light symmetry too perfect, fabric drape that defies gravity by a millimetre). That minority is disproportionately the audience the brand wants. So putting AI imagery on the live site as the final answer is the visual equivalent of leaving the em dashes in the prose.

That said, AI is excellent at one thing: **producing 100 variations of the same shot in an afternoon for £30, so that the brief you send to a real photographer is hyper-specific rather than generic.** This is what most design teams actually do.

Three paths, in order of how Atelier should think about them:

| Path | Cost | Time | Quality | When |
|---|---|---|---|---|
| **A. AI as final imagery** | ~£30 | 1 weekend | 70th percentile editorial | Bootstrapped launch, willing to replace within six months |
| **B. AI as a brief, photographer for final** | ~£3,500 + £30 | 6 weeks | 95th percentile editorial | The right premium answer |
| **C. Skip imagery, ship typography-only** | £0 | 0 | Defensible | If the rewrite and redesign are enough lift for the next quarter |

Path B is the correct premium answer. Path C is the correct interim answer. Path A is defensible only as an explicitly temporary placeholder.

## 2. Model choice

| Model | Strength | Weakness | Best for |
|---|---|---|---|
| **Midjourney v7** | Strongest editorial register baked in. Excellent at light, materials, composition. Cereal / Toast / Aesop mood comes naturally. ~£24/month subscription. | Slightly painterly; sometimes too stylised. Hands still imperfect. | **The default. Use this.** |
| **Flux 1.1 [pro]** (via Replicate or fal.ai) | Most photorealistic. Better at "this is a real photograph" than Midjourney. ~£0.04/image. | Less editorial mood; needs more careful prompting. | When photorealism is non-negotiable, or as a second pass after a failed Midjourney attempt. |
| **Imagen 4** (Gemini / Vertex AI) | Beautiful fabric and material rendering, especially knitwear and leather. | Less style control. | Plates 3 and 6 (material studies). |
| **DALL-E 3 / GPT Image 1** | Available everywhere. | Generic AI aesthetic the brand is positioning against. | Avoid. |
| **Stable Diffusion 3.5 + curated LoRA** | Most flexible, free locally. | Requires technical skill; unpredictable without LoRAs. | If you have a designer who already runs SD. |

**Recommendation:** Generate the eight plates primarily in Midjourney v7. If a specific plate (especially Plate 4) fails after 30+ Midjourney attempts, fall back to Flux 1.1 Pro for that plate only.

## 3. The eight Midjourney v7 prompts

Each prompt below targets one plate from the photographer brief. They include explicit material specifications, light direction, composition placement, and editorial reference register. `--style raw` reduces Midjourney's default stylisation; `--stylize` values between 150 and 200 sit between "realistic" and "subtly editorial."

### Plate 1 — Hero (folded knitwear on linen)

```
A still life of three folded knitwear jumpers stacked on a washed natural
linen tablecloth: one cream, one warm stone grey, one deep navy, each
showing the soft napped texture of carded wool. Photographed from a
three-quarter overhead angle with the stack offset to the lower right
third of the frame, the upper left held as quiet negative space showing
only the slightly creased linen surface. Soft north-facing winter daylight
from the upper left, casting long gentle shadows. Shot on medium format
film, Kodak Portra 400 NC, subtle natural grain, slightly desaturated warm
cream colour grading. Mood of Toast catalogue, Cereal Magazine still life.
No studio lighting, no harsh shadows, no plastic, no labels, no branding.
--ar 1:1 --style raw --stylize 200 --v 7
```

### Plate 2 — Journal cover (wax seal, fountain pen, ledger)

```
An overhead still life of editorial publication objects on a folded sheet
of cream hand-bound paper: a tarnished brass wax-seal monogram pressed
into the page, a vintage Montblanc fountain pen lying across at a slight
diagonal, a small linen-bound notebook half-visible at the frame edge.
The wax is warm gold-brown, the paper is slightly textured cotton-rag,
the fountain pen has soft brass details. Shot from directly above, tightly
composed. North-facing winter daylight from the left, casting subtle
shadows. Slightly desaturated warm tones. Editorial register of Cereal
Magazine and The Gentlewoman. Shot on medium format, Portra 400, fine
grain. No bright gold, no plastic, no modern electronics.
--ar 4:5 --style raw --stylize 150 --v 7
```

### Plate 3 — Material study (wool, leather, linen on marble)

```
An overhead still life of three fabric swatches arranged diagonally on a
slab of honed pale limestone: a heathered grey wool, a vegetable-tanned
tan leather with slight natural patina, an oat-coloured raw linen. Each
fabric clearly textured with visible weave and weight. Tight crop, swatches
running corner to corner of the frame, each occupying roughly equal area.
Soft north-facing daylight from the upper right, long quiet shadows.
Slightly desaturated warm tones. Shot on medium format film, Provia 100F,
very fine grain. Editorial register of Aesop, &Daughter, Cereal Magazine.
No bright colours, no studio light, no shiny finish.
--ar 1:1 --style raw --stylize 150 --v 7
```

### Plate 4 — The tailor's hand (RISK PLATE)

```
A close-up overhead photograph of a pair of weathered hands marking a
chalk line on dark grey wool fabric: one hand holding a piece of tailor's
chalk, the other resting flat on the cloth, with a coiled cloth measuring
tape and a small tarnished brass thimble nearby in soft focus. The hands
are quietly skilled, mid-life, no jewellery, no nail polish, entering from
the right edge of the frame. North-facing daylight from the upper left,
soft shadows. Slightly desaturated warm tones. Editorial still life in the
register of a craft documentary or Cereal Magazine. Shot on medium format
film, Portra 400, fine grain. Naturalistic hands with visible knuckles
and skin texture. No glamour, no faces.
--ar 4:5 --style raw --stylize 150 --v 7
```

> **Note:** Hands remain the single biggest AI tell, especially at close crop holding small objects. Expect to generate 30+ variations and reject most. If Midjourney fails consistently, try Flux 1.1 Pro for this plate (see translation guidance below), or skip the plate and commission only this one from a photographer.

### Plate 5 — Wardrobe in winter light

```
A photograph of an opened wardrobe interior, three winter coats hanging
on wooden hangers from a brass rail: one black wool, one camel, one deep
navy. Slight worm's-eye angle looking up into the wardrobe. North-facing
oblique daylight from outside the frame, falling on the shoulders of the
coats and the inner edge of the cream-painted cabinet door. The interior
is slightly shadowed and quiet, the coats hanging with subtle natural
creases. No clutter, no other clothing visible. Editorial mood of The
Modern House property photography and Toast catalogue interior. Shot on
medium format film, slightly underexposed, gentle Portra grain, warm
cream colour grading. No people, no studio light.
--ar 3:4 --style raw --stylize 200 --v 7
```

### Plate 6 — Folded knitwear (close crop)

```
A tight overhead still life of two folded jumpers stacked together: a
cream over a warm stone grey, each showing soft carded wool texture with
visible knit stitches, on a washed natural linen surface. A vegetable-
tanned tan leather belt with a small tarnished brass buckle curls into
the lower corner of the frame. Tight close composition, fabric filling
two-thirds of the image, leather adding warmth. Soft north-facing winter
daylight from the upper left, gentle shadows. Slightly desaturated warm
cream colour grading. Editorial register of Toast, &Daughter, Cereal
Magazine. Shot on medium format film, Portra 400 NC, fine grain. No
labels, no branding, no shiny gold.
--ar 4:5 --style raw --stylize 150 --v 7
```

### Plate 7 — Single coat at rest

```
A photograph of a single dark charcoal wool coat hanging on an unfinished
oak hanger against a cream-painted plaster wall. The coat occupies the
centre vertical third of the frame, with generous cream wall above and
below. North-facing daylight from the upper left, casting a soft natural
shadow on the wall behind. The coat has subtle natural creases, visible
wool texture, no logos or trims. Editorial portrait-like still life,
quietly composed, in the register of The Modern House and The
Gentlewoman. Shot on medium format film, slightly underexposed, warm
cream colour grading. No props, no styling clutter, no other garments.
--ar 3:4 --style raw --stylize 200 --v 7
```

### Plate 8 — The Atelier (writing tools)

```
An overhead still life of the writing tools of a considered studio,
arranged asymmetrically on washed natural linen: a vintage fountain pen
lying across an open hand-bound linen notebook showing a blank cream
page, a small tarnished brass paperclip beside, an unlit ivory taper
candle standing vertical at a slight off-axis angle, a small glass bottle
of ink with a brass collar in the upper right corner. The composition is
quiet, restrained, slightly off-centre. Soft north-facing winter daylight
from the upper left, gentle long shadows. Editorial register of Cereal
Magazine and Aesop. Shot on medium format film, Portra 400 NC, fine
grain. Slightly desaturated warm cream colour grading. No modern
electronics, no plastic, no labels, no bright gold.
--ar 1:1 --style raw --stylize 200 --v 7
```

## 4. The workflow that actually produces usable output

1. **Generate Plate 1 first, in isolation, until it is right.** Iterate 20 to 40 times. Vary `--stylize` between 100 and 300. Tweak the prompt slightly each pass. Stop when you have one image you would genuinely place on the homepage.

2. **Use the winning Plate 1 as a style reference (`--sref`) for the other seven plates.** This is the most important step. Without it, the eight plates will feel like a stock library. With it, they read as one shoot.

   Syntax in Midjourney:
   ```
   <prompt for Plate 2 ...> --sref <url-of-winning-plate-1> --ar 4:5 --style raw --v 7
   ```

   The `--sref` parameter takes the URL of an existing image and tells Midjourney "match this image's lighting, palette, and overall feel." It does not copy composition or subject matter — only style.

3. **Curate ruthlessly.** Expect to reject 90% of generations. The 10% you keep must pass a single test: *would a discerning editor put this in The Gentlewoman?* If no, regenerate.

4. **Upscale only the keepers.** Run Midjourney's built-in high-resolution upscale, then a single pass through Magnific AI or Topaz Gigapixel for print-quality detail.

5. **Final pass in Lightroom (or Photoshop).** Add subtle film grain (Provia or Portra emulation via VSCO or Mastin Labs presets), apply a warm tone curve, slightly lift shadows. This is the step that hides most of the remaining AI tells.

## 5. AI tells to watch for, and reject

Reject any generation showing:

- **Fabric weave that does not resolve** at 100% zoom — the warp/weft pattern should look like real woven cloth, not a blurry impression of one
- **Brass that is too saturated or too gold** — should be `#A8884C` to `#D4B378`, the colour of *tarnished* brass, never the colour of new gold jewellery
- **Light symmetry that is too perfect** — real daylight is directional and slightly uneven; if the shadows are perfectly soft on all sides, it reads as CGI
- **Floating objects** — every object must have a contact shadow and feel like it has weight against the surface beneath it
- **Hands that look like hands** but feel slightly wrong — extra knuckle joint, finger length disparity, missing fingernail, fingers melting together at certain angles (Plate 4 especially)
- **Surfaces too clean** — real linen has dust, slight wrinkles, occasional fibres. Real marble has subtle veining and the odd nick. Pristine surfaces read as render
- **Compositional symmetry** that the brief explicitly avoided — if the prompt said "lower right third" and the output is centred, regenerate
- **Visible text on labels, tags, or covers** — AI rendered text is almost always nonsense; if any text appears in frame, regenerate

## 6. Translating these prompts to other models

If you need to use a different model, the translation rules:

### Flux 1.1 [pro] (via Replicate, fal.ai, or freepik.com)

- **Drop the Midjourney flags** (`--ar`, `--style`, `--stylize`, `--v 7`)
- **Pass aspect ratio as a separate parameter** in the API call or UI
- **Keep the natural-language description** — Flux follows literal prompts better than Midjourney
- **Add the phrase "photorealistic medium-format photography"** near the front of the prompt, because Flux defaults to a slightly more "rendered" register
- **Avoid Flux's strong tendency to make things feel like a stock photograph** by emphasising terms like "natural imperfection," "unstaged," "casual placement"

Example Flux 1.1 Pro version of Plate 1:

```
Photorealistic medium-format photography. A still life of three folded
knitwear jumpers stacked on a washed natural linen tablecloth: one cream,
one warm stone grey, one deep navy, each showing the soft napped texture
of carded wool. Three-quarter overhead angle, stack offset to lower right
third of frame, upper left held as negative space showing slightly creased
linen. Soft north-facing winter daylight from upper left, long gentle
shadows. Shot on Kodak Portra 400 NC film, natural grain, slightly
desaturated warm cream tones. Editorial mood of Toast catalogue and Cereal
Magazine. Natural imperfection, unstaged placement. No studio strobe, no
plastic, no labels.
```

Set aspect ratio to 1:1, output format PNG, guidance scale around 3.5.

### Imagen 4 (Gemini)

- Similar to Flux — drop flags, write as natural prose
- Add explicit camera reference ("shot on Hasselblad X2D, 80mm lens, f/4")
- Imagen is especially good at material rendering; emphasise material vocabulary

### Stable Diffusion 3.5 + LoRA

- Use a curated still-life or editorial LoRA (search Civitai for "editorial photography" or "magazine still life" LoRAs)
- Run with CFG scale around 4.5, 30+ sampling steps
- Use a high-quality VAE for cleaner fabric textures

## 7. If using AI as final imagery — three more practical notes

1. **Resolution and grain.** Final imagery on the live site needs to be at least 2400 px on the long edge for retina displays. Generate at Midjourney's highest resolution, upscale to 4000+ px, then export at 2400 for web. Apply film grain in post — counter-intuitively, slight grain hides AI smoothness better than aggressive sharpening would.

2. **Variety in the suite.** All eight plates should have subtly varied colour temperature and slightly different shadow angles. If every plate has the same upper-left light source, the suite reads as templated. Vary `--stylize` deliberately across the eight to introduce small differences.

3. **Be ready to replace.** If you do go with AI as a temporary final, treat the imagery as a placeholder for six months at most. Set a calendar reminder. Photography commissioning takes six weeks; six months gives you a full quarter to budget, brief, and execute the real shoot, then swap the AI plates out cleanly.

---

## Appendix — the smart hybrid

The version of this that actually pays off:

1. Spend a weekend in Midjourney v7. Generate 100+ variations using these eight prompts.
2. Pick the strongest 8 — the ones you would honestly defend on the live site.
3. Send those 8 to the photographer (alongside `2026-06-19-still-life-photography-brief.md`) as your visual reference deck.
4. The photographer now has a hyper-specific brief expressed in actual images, not just prose. The shoot becomes a recreation, refinement, and elevation of those references, rather than a from-scratch interpretation.
5. The real photographs are better than the AI prototypes by every measure, *and* they took less of the photographer's interpretation time, *and* they cost you only an extra £30 on top of the commission.

This is the path. The AI prompts above are not the end of the work; they are the start of a better brief.
