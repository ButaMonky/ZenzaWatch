# Playlist retention and search limits (Task974)

## Settings

The playlist setting is a rolling retention target, not a bulk-fetch limit. It
has30 choices from1,000 to30,000 in1,000 increments; default3,000. Saved changes
apply immediately but never delete existing entries just because a smaller
number was chosen. Search is separate:1..5,000 results per search, default1,000.

A fetched list larger than rolling retention is retained. When explicitly
appending/inserting a fetched collection, existing unique entries are also kept.
The effective capacity temporarily grows to that combined list size; subsequent
single-video additions roll at that capacity. A smaller replacement or clearing
the list resets the capacity to the configured target. This avoids discarding a
5,000-video collection merely because the user normally keeps3,000 videos.

Collection loading has a separate30,000-item per-request safety budget and
reports reaching it. Search API restrictions are not raised to30,000. Storage
tries up to30,000 items but falls back around the active video on quota errors;
that fallback does not shorten the live in-memory playlist or clear other keys.
An accumulation of several explicit lists can exceed30,000; exported JSON is
recommended for preserving such a list beyond the browser's storage capacity.

## Local performance check, 2026-10-28

One headless Chromium run on a Windows desktop, synthetic Japanese titles and
metadata, the actual model/lazy renderer/session implementation, a clean local
origin. These are observations, not hardware-independent performance promises.
No personal browser profile, cookies or NicoNico account changes are involved.

| Items | Model construction | Initial render | Reverse + render | Session save | Restored |
| ---: | ---: | ---: | ---: | ---: | ---: |
|3,000|35 ms|188 ms|121 ms|13 ms|3,000|
|10,000|66 ms|413 ms|417 ms|61 ms|10,000|
|30,000|707 ms|2,281 ms|1,148 ms|230 ms|7,500|

All lists had their full number of DOM shells with13 expanded visible cards.
Lazy details do not make the30,000 outer nodes free. JSON serialized size was
about1.49/4.97/14.97 MB (UTF-8); browser accounting and actual titles differ. The
30,000-item case exceeded storage capacity, and the existing fallback preserved
the active video in7,500 saved entries while an unrelated storage key survived.

Use3,000 by default.20,000..30,000 is opt-in high-load usage; pauses in rendering,
sorting and saving remain possible. The setting explains this and recommends
export for large playlists. See test/browser/task974-retention-benchmark.cjs to
repeat the check; do not treat a timing threshold as a portable correctness test.

## Regression coverage

Config/import and UI validation, native30-choice control, live player wiring,
search1/37/99, bulk4200 over1000, old+new insertion, stale loads, restore,30,000
session/bundle boundaries, active-item retention and existing playlist ordering.
Series insertion was changed from repeated full-list scans to indexed buckets;
a2,000-item case previously needed2,000,000 predicate calls and is now linear.

Web Storage behavior reference (not a fixed performance budget):
https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
