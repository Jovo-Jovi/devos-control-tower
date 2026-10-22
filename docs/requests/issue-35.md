# Issue #35 — A sharp globe at any size (replace the displacement-map sphere)

## What was asked

Draw the globe sharp at any size and screen density. The rest of the v3.2 request (plates at original quality,
moving clouds, star particles, mist) already landed in the owner's PR #36; only the globe is left.

- Today each globe is warped by an 8-bit `feDisplacementMap` from a 340×340 map, so near the centre neighbouring
  pixels copy one texel and the clouds become small squares on the 340 px desktop globe
  (`docs/design/v3/screens/v3.2-why-planet-blocks.png`, README §15).
- Replace the filter with a renderer that samples the strips per device pixel, for example a small WebGL sphere, with
  no new dependency unless justified, on `docs/design/v3/assets/v3.2/planet-day.webp` and `planet-crimson.webp`
  (2048×1024).
- Keep size, position, shade, atmosphere, glow, the 120 s spin and the crimson roll on the switch.
- Without WebGL, or with reduced motion, a still globe.
- `planet-sphere-map.png` and the filter go.
- Loading as `DESIGN_SYSTEM.md` §9: before the first paint only the theme's strip; never wait for an image.
- Amend `DESIGN_SYSTEM.md` §9 and `scripts/scene/art.mjs verify`.
- Judged at the design gate on captures at 1280 (DPR 2) and 390 (DPR 3), light and dark: no squares; canvas backing
  size = CSS size × devicePixelRatio; spin and roll timing as today; still globe with reduced motion; layout shift 0;
  the first paint loads one strip. "Small change (one or two tasks)", "Next up".

## What was decided (OD-10, DRAFT)

- **One task, T12** (risk 2, three stages — WebGL renderer, still paths, captures and ledgers — gate
  **G-Planet-Sharp**). Risk 2: no header, CSP, auth, data or boundary
  change; WebGL draws same-origin images that `img-src 'self'` already allows.
- **Renderer:** a client component `PlanetGlobe` per globe, a canvas whose backing store is its rendered size ×
  `devicePixelRatio` (no cap), drawing an orthographic sphere with WebGL 1 and a mipmapped, repeating texture. No
  library: a full-screen quad and one fragment shader are a few dozen lines, so the request's "no new dependency"
  holds. The crimson canvas sits inside the existing mask element, so the moving disc (and its tests) are unchanged.
- **Timing by construction:** the CSS `.spin` and `.turn` wrappers stay the clock; the canvas reads their
  `translateX` every frame (`centreU` in `sphere.ts`). Reduced motion (the global `animation/transition: none`), the
  hidden pause and the tests' `pause()`/seek then act on the canvas as on the CSS, and the existing timing tests (the
  1800 ms turn transition, −340 px under reduced motion) keep proving it.
- **Still globe:** reduced motion → WebGL draws on change only; no WebGL → a 2D canvas drawing from the same
  `sampleSphere` maths, on change only. Until the first frame (and when no context exists) the flat strip stays
  visible under the shade as a poster, so the first paint still shows a planet.
- **Loading:** the strips keep loading from the existing CSS rules; the renderer takes the URL from the strip's
  computed `background-image`, so no second URL is requested; the shell spec counts distinct URLs.
- **Assets and budget:** the two v3.2 strips replace the v3.1 ones byte for byte; the sphere map goes. The budget
  becomes the size of the set, 3 847 962 bytes (README §15). `DESIGN_SYSTEM.md` §3, §5.2, §5.10 ("No WebGL" now
  allows `PlanetGlobe` only), §9 and §10 are amended in this intake PR.
- **Evidence:** shell spec test 7 runs its own Chromium with `--enable-unsafe-swiftshader` (headless Chromium has
  WebGL only through SwiftShader) at 1280/DPR 2 and 390/DPR 3 in both themes: backing sizes 680 and 632
  (340 × 0.62 × 3, rounded), motion, reduced motion and no-WebGL modes, the switch's roll filmstrip, and 12
  layout-shift values of 0. Captures use the `planet-` prefix so the `v3-*` counts stay.

## What was left out, and why

- A WebGL starfield or any other WebGL use (not asked; `DESIGN_SYSTEM.md` §5.10 limits WebGL to `PlanetGlobe`).
- A pixel metric for "no squares": the reviewer and the owner judge the captures against
  `v3.2-why-planet-blocks.png`; the backing-size check proves the per-device-pixel sampling.
- `docs/design/v3/README.md` §15's last paragraph ("the sharper WebGL sphere … is not in this change") stays as the
  owner's design record; `DESIGN_SYSTEM.md` holds where they differ.
- `docs/method/AUTOMATION.md` §6's description of `art.mjs` (a method file; OD-09 already left it to a method task).
- The runner's own captures stay at its default density; the DPR captures come from the task's spec.
