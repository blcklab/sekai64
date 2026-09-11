# Tests

Run the tests before pushing or publishing:

```bash
npm ci
npm test
```

`npm test` builds the package, then runs every `.mjs` file directly inside `tests/` with Node's test runner. Each file runs in a separate process. A failed assertion, import error, or timeout fails the command.

To rerun tests after a build, use `npm run test:run`. To run one file:

```bash
node --import ./scripts/register-workspace-loader.mjs --test tests/xr-smoke.mjs
```

`npm run check` runs the build, tests, and package verification. GitHub runs it on pushes and pull requests with Node 22 and 24, and before publishing a version tag. Local `npm publish` runs the same checks through `prepublishOnly`.

These tests cover runtime behavior with browser/GPU mocks and source-level regression checks. They do not validate rendered images on a real GPU. The separate Vitest tests under `packages/` are not included in this command.

The Anyo adapter source check needs a separate Anyo checkout and runs explicitly:

```bash
node tests/integration/anyo-viewer.mjs /path/to/Anyo/src/renderer-sekai64/Sekai64Renderer.ts
```

It is kept outside the package suite so Sekai64 can be tested from a standalone checkout.
