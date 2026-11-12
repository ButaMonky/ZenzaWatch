# Native official links and verified header routing

Approved behavior: ordinary navigation to a watch page uses the official player. Explicit Zenza actions (list clicks, Zen buttons, external playback, playlists) remain available. No new URL marker, tab name or cross-tab handoff. Retire automatic watch-page replacement, including saved true values and its settings UI. Preserve old marked links as compatibility inputs only.

1. Add failing checks for clean official URLs, native official anchor ownership, and no automatic replacement even with old settings enabled.
2. Promote the user-verified click1018.3 header bridge into a standalone TypeScript module. Generate the legacy build input deterministically; remove diagnostic logs. Use the same original click and defer player startup until event dispatch ends. Keep header-only propagation fallback when early hookup is unavailable.
3. Use existing noHoverMenu exclusion for native official anchors. Keep the official from parameter. Remove obsolete replacement and propagation UI controls; do not delete saved user data.
4. Regenerate canonical TypeScript runtimes and distribution; run URL/action, header routing, settings and external integration checks plus isolated Chrome coverage. Do not access the policy-blocked live site or claim live verification.
5. Review explicit changed files. Publish a version bump to public develop and synchronize identical product files to private develop. Verify remote heads/artifact. Report user checks and rollback link.
