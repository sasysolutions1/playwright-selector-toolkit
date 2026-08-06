# Module 13 — Plugin API

Module 13 adds trusted ESM plugins with:

- Ordered setup and reverse-order teardown
- Authentication hooks
- Page-state detectors
- Structured DOM redaction extensions
- Custom locator-candidate generators
- Per-plugin state and logging
- Per-hook diagnostics and timeout reporting
- Isolated or fail-fast error behavior
- Configuration, environment, and repeatable CLI plugin loading
- `selector plugins inspect`
- Real Chromium authentication/redaction/candidate smoke coverage

Plugins are not sandboxed. Only trusted plugin code should be loaded.
