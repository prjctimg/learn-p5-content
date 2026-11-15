# Contributing to learn-p5-content

This repo contains the YAML course content and build/check tooling for the Learn p5 content pack. Before opening a PR, run the checks locally, keep YAML valid, and use commit messages in Conventional Commits format.

## Quick workflow

1. Install deps: `npm ci` (installs Husky hooks via `prepare`).
2. Ensure check inputs exist when needed: `node scripts/build/reference.mjs` (creates `reference.generated.json`) and `npm run bundle-validation` (creates `validation-core.generated.ts`). CI regenerates these during publish.
3. Edit or add courses in `courses/*.yaml`.
4. Validate your work: `npm run check` (tests, bundle validation core, exercise checks, symbol checks). Run `npm run build` if you need to verify the full content pack build.
5. Commit with a Conventional Commit message (enforced by `commit-msg` hook) and push (pre-push runs `npm run check`).

## Course YAML spec

Course files live in `courses/` and use `.yaml` (or `.yml`). Each file defines one course object:

### Course (root)

| Field | Meaning |
| --- | --- |
| `slug` | Unique course id (matches the course identity, typically the filename stem, e.g. `shapes`). |
| `title` | Display title of the course. |
| `moduleName` | Module/group label shown with the course (e.g. `Fundamentals`). |
| `description` | Short summary of what the course covers. |
| `exercises` | Ordered list of exercises in the course. |

### Exercise

| Field | Meaning |
| --- | --- |
| `id` | Unique exercise id within the course (e.g. `exercise-1`). |
| `title` | Exercise title. |
| `module` | Module label for the exercise (often matches course/module context). |
| `description` | Brief description of the exercise goal. |
| `instruction` | Learner-facing prompt for the exercise. |
| `startingCode` | Starter p5 sketch for the exercise (usually includes `setup()`/`draw()`). |
| `solution` | Final/reference solution for the exercise. |
| `tasks` | Ordered list of tasks/steps that build toward the solution. |

### Task

| Field | Meaning |
| --- | --- |
| `id` | Unique task id within the exercise (e.g. `task-1`). |
| `title` | Task title. |
| `instruction` | Learner-facing prompt for the task. |
| `validation` | Array of validation rules checked against the task’s solution (see below). Must be present and be an array. |
| `solution` | Code that satisfies this task’s validation. For the last task, the checker may fall back to the exercise `solution` if a task `solution` is omitted. |
| `startingCode` | Optional starter code specific to this task (useful for carry-forward vs fresh-start steps). |

**Formatting tips:** use YAML block scalars (`|`) for multiline `instruction`, `startingCode`, and `solution` so indentation and newlines are preserved exactly.

## Validation rules (`task.validation`)

Each item in `validation` is a rule object with a `type` and type-specific fields. Schemas are enforced by the shared validation core (`scripts/lib/validation.ts`, bundled to `validation-core.generated.ts`).

| Type | Required fields | Optional fields | Meaning |
| --- | --- | --- | --- |
| `functionCall` | `name` (string) | `exactArgs` (number), `minArgs` (number) | The solution must call p5 function `name` (e.g. `circle`). If set, argument count must match `exactArgs` or be at least `minArgs`. |
| `functionExists` | `name` (string) | — | The solution must define a function named `name`. |
| `canvasSize` | `width` (number), `height` (number) | — | The solution must call `createCanvas(width, height)` with the given size. |
| `pixelMatch` | `x`, `y` (numbers), `expected` (`[r, g, b]`) | `tolerance` (number, default `30`) | The rendered pixel at (`x`,`y`) should match `expected` within per-channel tolerance. |
| `expectedPixels` | `points` (non-empty array of `{x, y, expected, tolerance?}`) | `minPassFraction` (number, default `0.9`) | A fraction of sample points must match their expected colors (used for visual/output checks). |

`npm run check-exercises` validates rule schemas and evaluates sync/static rules against task solutions; it also checks that task solutions don’t introduce unexpected p5 calls beyond allowed sources. Pixel/output rules are schema-checked and used by the runtime validation flow.

## How to verify courses

- **`npm test`** — runs unit tests in `scripts/lib/` (e.g. description formatting).
- **`npm run bundle-validation`** — bundles `scripts/lib/validation.ts` into `validation-core.generated.ts` (required by exercise/symbol checks).
- **`npm run check-exercises`** — parses `courses/*.yaml` and checks task validation invariants (schema, solutions satisfy rules, no extra p5 calls). Requires `reference.generated.json` (generate with `node scripts/build/reference.mjs`) and the bundled validation core.
- **`npm run check-symbols`** — scans code blocks in course YAML for unknown/non-resolving symbols and p5 v1-only APIs (e.g. `curveVertex` → `splineVertex` in p5 v2).
- **`npm run check`** — runs all of the above in order.
- **`npm run build`** — generates reference/assets and builds the content pack; build scripts also reject p5 v1-only curve APIs in `startingCode`/`solution`.

CI (`.github/workflows/content.yaml`) runs the same class of checks before building/publishing.

## YAML validity (required)

Always keep course files as **valid YAML**:

- Install a YAML validator/formatter in your editor (for example, the Red Hat YAML extension, or formatters like Prettier) and fix diagnostics before committing.
- Watch indentation (spaces, not tabs), quoting, and multiline blocks (`|`)—small YAML syntax errors will break parsing and checks.
- If in doubt, run `npm run check` (parses all course YAML) before pushing.

## Commit messages and hooks

- **Format:** Conventional Commits, e.g. `feat: add curves exercise`, `fix(courses): correct pixel tolerance`, `docs: update contributing guide`.
- **`commit-msg` hook:** runs commitlint to enforce the format.
- **`pre-push` hook:** runs `npm run check` as a sanity gate to catch broken YAML, validation, or symbol issues before they reach CI.

Bypass hooks only in exceptional cases (`--no-verify`) and never to push known-broken content.
