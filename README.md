# learn-p5-content

Authored content and build/validation tooling for the Learn p5 app. The app downloads the published content pack (`content-latest` release) at launch.

## Structure

- `courses/` — course definitions in YAML (`*.yaml`).
- `scripts/build/` — build pipeline scripts (`content.mjs`, `courses.mjs`, `reference.mjs`).
- `scripts/bundle/` — bundling scripts (`validation.mjs` generates `validation-core.generated.ts`).
- `scripts/check/` — content checks (`exercises.mjs`, `symbols.mjs`).
- `scripts/lib/` — shared modules and utilities (e.g. `validation.ts`, `p5-version.mjs`, `description-format.mjs` and its tests).
- `reference.generated.json`, `p5Assets.generated.json` — generated reference/assets data.
- `content/` — build output (pack, manifest, bundled p5 runtime) produced by the build.

## Commands

```bash
npm run build    # generate reference/assets and build the content pack
npm run check    # run tests and content validation checks
npm test         # run script/lib tests
```

CI runs the same checks in `.github/workflows/content.yaml`.

## License

Learning content inherits the license from the [p5.js](https://p5js.org) website content.
