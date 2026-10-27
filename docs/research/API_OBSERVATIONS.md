# Additional public research observations (Task969)

This file documents two observation-only API records absent from the current published source code. They are **not** evidence that this repository implements these endpoints. These entries were transferred from private offline research findings on 2026-10-27 without publishing any authenticated traces, request headers, or personal data. The original observation material is not part of this public repository, so independently verify the current API before relying on it.

## video.likes-and-owner

- Read-only endpoint observed on 2026-10-27: `GET https://nvapi.nicovideo.jp/v1/videos?watchIds={watchId}`
- Observed fields: `data.items[].video.count.like` and public `data.items[].video.owner`.
- Publicly shipped ZenzaWatch already consumes `count.like` from other result objects (see `packages/lib/src/nico/VideoSearch.js` and `packages/zenza/src/Playlist/VideoListItemView.js`), but **the specific /v1/videos endpoint is not implemented in this public tree**.
- Treat absent `count.like` as unknown, not zero; hidden uploader data must not overwrite already verified visible metadata.
- The documented date is an historical observation; it is not a claim of current uptime or public API support.

## video.owner.icon-cdn

- Read-only URL pattern observed on 2026-10-27: `https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/s/{bucket}/{userId}.jpg`.
- Public fixtures in `packages/components/mock/nicorepoVideoData.js` include small user-icon URL patterns, but the finite fallback logic and ID-bucket derivation associated with this record are **not implemented in this public tree**.
- The URL is a *candidate* only for already known, well-formed user IDs. An HTTP 404 does not establish account deletion, user identity or retirement.
- No user-specific URLs, icons or request logs are shipped in this research document.

## HLS and unindexed endpoints

- The 44 records are an initial search index, not a complete census of NicoNico interfaces. Other topics, including HLS, may be in application source or separate compatibility documents and should not be assumed complete.
