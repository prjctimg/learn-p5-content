# learn-p5-content

Authored content for the Learn P5 app: course YAML, the p5.js runtime bundle,
generated reference data, and the validation checks that guard them. The app
downloads the published pack (`content-latest` release) at runtime.

The p5.js runtime ships as its own artifact, `p5.min.js`, alongside
`pack.json` in the same release. The app downloads it once, caches it, and
loads it as a separate script file in previews rather than inlining it into
every exercise's HTML. The bundle is produced by `bundle-p5.mjs`, which
downloads the pinned jsDelivr release, transpiles it to ES2015, and prepends
the ES5 compatibility shim.

## Checks

Course content changes must keep the exercise invariants green and the symbol
checks clean:

```bash
npm run check   # bundles the validation core, then check-exercises + check-symbols
```

These validate the course YAML against the same validation core the app
ships (see `validation.ts`). The lezer parser (`@lezer/javascript`) is a
dev-only tool and intentionally not locked: install it ad hoc when running
checks locally:

```bash
npm install --no-save @lezer/javascript@1.5.4
```

CI does the same thing in `.github/workflows/content.yaml`.

## The validation core

`validation.ts` is a byte-identical synced copy of
`learn-p5/src/utils/editor/validation.ts` (the same file is bundled into the
app's exercise WebView). Same as the mirrored `p5-version.mjs`, the two
copies are kept in sync by hand. Edit the canonical file in learn-p5, then
copy it here so both adapters bundle identical logic.
