# External playback ownership — task1020

## User-visible behavior

Install both the current main ZenzaWatch and ZenzaBlogPartsButton. External links still open the same player over the external page. The companion no longer carries a player copy: approximately 95 KB versus the previous 3.2 MB. Main contains one common runtime, approximately 3.2 MB.

The user clarified that the missing Zen on dic.nicovideo.jp was expected in direct-click mode. No dictionary-specific change is included.

## Execution and privacy boundary

The companion creates the existing Nico-origin player iframe only after a trusted click and authenticates its parent/frame connection through its own short-lived GM ticket. Inside that static frame, its typed client requests the installed main script to open a validated video ID. The protocol checks exact same-frame source and origin, nonce channel, sequence and lifecycle. External parents do not receive a fetch proxy, credentials, API results or transferred capabilities.

The main script owns the authenticated GM transport, main runtime, settings, HLS, comments, likes and mylist implementation. The previously tested GM destination restrictions and private loader-frame ports remain. The companion only retains optional public metadata preflight, not authenticated playback operations.

Normal Nico playback still executes in the page realm. The main userscript's DOM sandbox injects the ordinary runtime using GM_addElement and a pinned lodash resource. No GM methods are passed to page code. The shared runtime has an optional external context; it has no second separately maintained player or settings UI.

## Settings and lifecycle

Main and companion have separate GM stores. On the first handoff the main imports only sanitized registered player preferences from the prior companion snapshots. The local ExternalTrial storage prefix is intentionally retained. External launch preferences synchronize via the local frame channel and existing official-page preference bridge.

Closing first hides the host, then waits for final playback-position promises with the existing bounded close helper before disposing main networking and removing the frame. Either script may initialize first. Missing/old main fails after a bounded handshake wait and the button explains that the main needs updating/enabling.

## Validation

- Package tests exercise both generated distributions with distinct GM stores and isolated lexical bindings, main-owned login checking, preference migration and two-way settings.
- Chrome localhost fixture exercises actual isolated worlds, startup order, parent-message rejection, close notifications and ordinary page-realm bootstrap.
- Existing small/normal background fixture covers transparent small mode.
- Full root suite and source regeneration are release gates. Counts/results are recorded in the implementation plan ledger.

All account responses in tests are simulated. No live account-changing request was made, and these tests are not a claim of logged-in playback verification on the user's browser.

## Confirm after updating both scripts

1. Reload a Nico page, then the external page. Open a direct video link from Nicochart or Nicolog with Zen.
2. Confirm the overlay, small-screen background, current settings, normal/HLS/advanced settings, and close/reopen.
3. Check login-dependent operations you normally use (comments, likes, mylists) and final playback position.
4. On Nico, check ordinary click mode and the follow-new dropdown still open only Zenza.

Rollback reference: public commit 0e7ecf1cba07137a004807732301848705539c03; reinstall both scripts from that revision and reload. Stored data is not removed.
