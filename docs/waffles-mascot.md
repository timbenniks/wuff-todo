# Waffles

## Head-and-collar icon

Asset: [transparent icon PNG](../apps/web/public/mascot/waffles-icon.png). Created with the built-in image generation tool using the original mascot as an identity reference. Removes the body and enlarges the two signature charms; the waffle uses four recesses for simpler recognition. Visually checked the head-only composition, collar, waffle, and viewer-left leaf; confirmed PNG transparency. Actual small-size app rendering is not yet verified or integrated.

Icon generation prompt:

```text
Use case: identity-preserve / app icon simplification.
Input image: Waffles original mascot, identity and palette reference. Create a simplified standalone app icon character based on this exact corgi. HEAD AND COLLAR ONLY; remove the entire body, legs, paws and chest. Preserve his oversized upright softly pink inner ears, warm golden-orange fur, broad white forehead stripe and rounded white muzzle/cheeks, dark-brown glossy eyes, small black nose, sweet gentle smile and a subtle head tilt. Use a compact near-square silhouette optimized for a 48–64 pixel app/sidebar icon. Simplify fur into a few smooth rounded sculpted tufts, no individual hairs or microtexture. Polished soft 3D storybook toy-like forms, gentle warm shading, clear broad color regions, restrained highlights, very readable silhouette. Crucial: a thick clearly visible LAVENDER COLLAR directly beneath the chin, with an enlarged central GOLDEN WAFFLE pendant with a simple unmistakable recessed 2-by-2 waffle grid, and an enlarged bright GREEN LEAF charm on the VIEWER'S LEFT. Both charms must be separate, fully visible and readable, hanging directly from the collar without body behind them. Keep charms close to the collar for a compact composition. Enlarge face, minimize empty space, but leave safe margin around ears and charms. Truly transparent background, no tile, no text, no border, no scene, no additional objects. Friendly comforting Waffles, not a generic dog. Deliver one single icon.
```

Waffles is Wuff Todo's friendly little companion: a sweet, fluffy golden-orange-and-white corgi, seated front-facing with a slightly tilted head. The artwork uses soft, polished 3D storybook styling, textured fur, warm lighting, and rounded shapes.

## Recognizable details

- Oversized upright ears with soft pink interiors.
- Glossy dark-brown eyes, a small black nose, and a gentle happy smile.
- White forehead stripe into the muzzle, fluffy white cheeks and chest, and little white paws.
- Rounded body and short legs.
- Lavender collar with a central golden waffle pendant and a green leaf charm on the viewer's left.

Simplified logo adaptations must preserve the big ears, white face stripe, lavender collar, and recognizable waffle pendant. Keep the character comforting and personal.

## Generation

Asset: [transparent PNG](../apps/web/public/mascot/waffles.png).

Verified October 15, 2026: visually checked the seated pose, fur colors, white stripe, lavender collar, central waffle pendant, and viewer-left leaf charm. PNG alpha channel confirmed. This asset has not yet been wired into the app interface.

Created with the built-in image generation tool. Generation prompt:

```text
Use case: stylized-concept
Asset type: Waffles, the Wuff Todo app mascot, standalone reusable character asset.
Create a sweet fluffy orange-and-white corgi sitting front-facing with a slightly tilted head. Oversized upright ears with soft pink interiors, big glossy dark-brown eyes, small black nose, gentle happy smile. A white stripe runs down the forehead into the muzzle, fluffy white cheeks and chest, little white paws. Warm golden-orange fur, rounded body, short legs. Signature details must be clearly visible: lavender collar, a golden waffle-shaped pendant centered at the front (recognizable square waffle with rounded corners and recessed grid), plus a small green leaf charm hanging on the VIEWER'S LEFT of the pendant. Keep the collar visible above the chest fluff. Soft polished 3D storybook illustration with finely textured fluffy fur, warm soft lighting, rounded shapes. Cute comforting friendly little companion. Entire seated body and both ears visible, centered, generous clear margin, square composition. Truly transparent background, no ground plane, no scene, no lettering, no watermark. Not flat, not angular, not corporate. One character only.
```

## Application integration

- `Corgi` retains its existing component API and renders the optimized 256px WebP, so sign-in, password setup, OAuth consent, sidebar, and empty states share Waffles.
- Browser favicon: multi-size ICO (16/32/48px), plus PNG metadata.
- Apple home-screen icon: opaque 180px PNG. Web manifest: 192/512px icons and a separately padded maskable icon.
- Open Graph and Twitter: a 1200×630 public branding card. No private list/task content is included. Absolute URLs use the existing configured app origin.
- MCP App: embedded WebP header, with no external image fetch required.
- Future native assets: `app-1024.png` is an opaque square source for iPhone; `android-foreground-432.png` is a transparent padded adaptive-icon foreground paired with background `#e7f0f8`. Platform packaging, additional appearances, and device validation belong to the future native app implementation. Do not pre-round the source artwork.

Regenerate exports from the approved original with `node scripts/generate-brand-assets.mjs`. This uses the installed Next.js Sharp dependency and preserves the original PNGs. The manifest provides home-screen identity; it does not add offline support.

### Integration verification — October 15, 2026

- `pnpm typecheck` and `pnpm build:mcp` passed.
- Local Chrome rendered the new mascot on sign-in and loaded it successfully. Inspected the screenshot and social card.
- Local favicon, manifest, social card, Apple icon, and maskable icon returned HTTP 200 with their expected content types.
- Rendered metadata linked the favicon, Apple icon, manifest, and absolute Open Graph image URL.
- Native device installation and social-platform preview caches were not tested. At 16px, the face/colors remain the identity; charm details naturally become tiny.

- Production build (`pnpm build`) passed, including the manifest route. Native square icon exports have no alpha channel.
