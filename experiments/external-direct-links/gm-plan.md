# Tampermonkey transport trial 2

Keep the direct-link UI and experimental branch. Route CrossDomainGate.fetch and hls.js loaders through a private GM transport. Keep existing frame bridge for configuration/database only. No per-external-site logic, cookie extraction, global browser permission changes, or automatic account writes.

1. Add mocked request tests: destination boundary, POST body, response, abort, timeout and HLS range/bytes callbacks.
2. Implement gm-network.cjs: restricted HTTPS destinations, GM request to Response adapter, hls.js loader with cancellation and loading statistics.
3. Integrate through checked bundle replacements; force hls.js rather than native HLS so media does not bypass transport. Route optional media preload cache requests through GM too.
4. Bump trial version and diagnostics; test generated runtime and review changes. Publish experimental branch only.
5. Real logged-in playback and deliberate user comment/like/mylist actions remain user verification; never infer success from mocked requests.
