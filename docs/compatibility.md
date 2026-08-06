# Compatibility review

The toolkit supports actively maintained Node.js release lines and publishes a machine-readable
compatibility review.

## Supported runtime matrix

| Runtime                                 | Status                                                           |
| --------------------------------------- | ---------------------------------------------------------------- |
| Node.js 22.14 or newer on the 22.x line | Tested                                                           |
| Node.js 24.x                            | Tested                                                           |
| Later Node.js releases                  | Allowed by `engines`, but reported as untested until added to CI |
| Linux, macOS, Windows                   | Supported development platforms                                  |

Run the review after building:

```bash
npm run build
selector compatibility
selector --json compatibility
selector compatibility --strict
```

Normal mode fails only on incompatible requirements. Strict mode also treats an untested release
line or a development npm client below the trusted-publishing requirement as a failure.

The review checks Node.js, npm, platform, package engine metadata, ESM exports, CLI mappings,
Playwright dependency placement, and production build outputs.
