# Comment history for ZenzaWatch (Task 200)

Independent read-only comment retrieval, bounded retries, per-video continuation, and a C-3 player panel.
Defaults: OFF until enabled; 5,000 additional comments; maximum 20,000. Enabling is persistent and applies to all tabs after normal comments load. Same-origin tab jobs are queued when Web Locks is available.

## Source ownership
Edit src/*.mjs, never src/generated/*.js. Run `npm run build:zenza` here, then `npm run build` at the repository root. The root build refuses stale generated files.
Run `npm test` here for the independent suite and `npm test` at the repository root for integration/regression tests. This package has no third-party runtime dependencies.
The right-bottom panel and advanced-settings userscript use the same settings schema and storage adapter; redesigning the settings UI does not require rewriting retrieval.

## Behavior
Data is applied after an acquisition batch ends. Further acquisition preserves the cursor and adds the selected quota, up to 20,000 total extras. Stop applies good partial results; OFF releases extras and retains normal comments and local edits. Switching videos invalidates old responses.
Timestamp-only paging does not prove complete historical coverage. Same-second ambiguity, malformed responses, time/request limits and errors are reported explicitly.
Current official totals and posting metadata are not replaced by historical page counts. Comment text and authentication material are never included in the public diagnostic summary.

## Integration boundaries
Generated entry points are connected by CommentPlayer, NicoVideoPlayer and NicoVideoPlayerDialog. Display preparation keeps normal comment identities and NicoScript runtime state. CommentPanel retains a reading anchor only within the same video generation.
Keep independent fixture tests and integration tests together when changing these boundaries. Browser tests with mocked transport are not evidence of successful live NicoNico retrieval.
