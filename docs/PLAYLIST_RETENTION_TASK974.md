# Playlist retention: Task976 current limits (supersedes Task974 maximum)

## Current behavior

The rolling-playlist setting provides **10 choices: 1,000 to 10,000 in
1,000-item steps**, with **3,000** as the recommended default. Search is
separate (1–5,000 per search, default 1,000).

A fetched mylist, series, upload list, or search may exceed the rolling
preference, but never the 10,000-item loading safety budget. Existing videos
have priority when combining lists. If a second bulk load would exceed
10,000, only room for new unique videos is used and the rest is reported.
Changing the preference alone never deletes loaded videos.

Previously saved values above 10,000 (from the brief Task974 release) are
treated as 10,000. Import/restoration of an older oversized playlist
retains the active video by choosing a 10,000-item window around it.
Previously loaded oversized playlists are never deleted just because a user
changes the preference; replacement will enforce the current safety bound.

Session storage attempts to retain up to **10,000** items, with active-video
preservation and the existing storage-quota fallback. Browser storage is not
guaranteed to hold 10,000 detailed records. For large lists, export to a
separate file to protect against loss on reload.

## Observed performance, single synthetic offline Chromium run

This earlier Task974 benchmark measured the unchanged model/lazy-view/session
components. It is informative but not a universal speed guarantee.

| Entries | Model | Initial rendering | Reverse + render | Save | Restored |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 3,000 | 35 ms | 188 ms | 121 ms | 13 ms | 3,000 |
| 10,000 | 66 ms | 413 ms | 417 ms | 61 ms | 10,000 |

The prior 30,000-item stress benchmark has been retired from the supported
choices; its historical results remain available in the Task974 Git commit.

Large lists still create one lazy outer DOM shell per video. At 8,000 to
10,000 entries, sorting, initial rendering, memory use, or sessionStorage
capacity can impose noticeable delays. The advanced settings include a
warning and recommend exporting large playlists.

## Verification

Task976 tests cover default/maximum, legacy setting normalization, old
oversized-session active-video restoration, a 5,000-item collection exceeding
a 1,000-item rolling setting, a 7,000+5,000 merge that preserves existing
entries and announces overflow, generated distributables and session limits.

This change updates both the private and public develop channels, while
keeping private-only functionality private. No live account mutation or
automatic comment posting is required.
