# Public API observations for Task969

This document preserves observations recorded on 2026-10-27. Both endpoints below
are now present in this repository as part of the full development release.
Their observed status in the catalog is historical and is not a guarantee of current availability.

## video.likes-and-owner

- Endpoint: `GET https://nvapi.nicovideo.jp/v1/videos?watchIds={watchId}`.
- Source: `packages/zenza/src/pocket/PocketCardMetadataLoader.js`.
- Relevant response fields: `data.items[].video.count.like` and visible uploader metadata.
- When counts are missing, avoid incorrectly replacing them with zero; hidden uploader
  metadata must not replace an already confirmed uploader identity.

## video.owner.icon-cdn

- URL pattern: `https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/s/{bucket}/{userId}.jpg`.
- Source: `packages/zenza/src/pocket/PocketDescriptionCard.js`.
- A valid existing user ID is required before generating the URL; an HTTP 404 is
  not proof of account deletion or departure.
- The current code implements a bounded fallback for image loading.

The source paths above contain the actual released implementation. No raw
authentication data, browsing logs or private research archives are included.
