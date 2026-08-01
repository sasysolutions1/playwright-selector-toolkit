# Release checklist

- [x] Public API has usage documentation.
- [x] Authorized-use and fail-closed boundaries are documented.
- [x] Node syntax checks pass.
- [x] Unit tests cover ranking, escaping, generated IDs, locator dispatch,
  uniqueness, visibility, and abstention.
- [x] CI validates supported Node versions without requiring browser secrets.
- [ ] Review and merge the release pull request.
- [ ] Create signed or annotated tag `v0.1.0`.
- [ ] Publish the GitHub release from the reviewed tag.
