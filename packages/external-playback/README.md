# External playback package

Main ZenzaWatch owns playback. ZenzaBlogPartsButton detects links, displays Zen controls, optionally checks public metadata and requests playback. Install/update both scripts. No separate trial is required.

## Boundaries

- `src/settings.ts`, `targets.ts`, `site-rules.ts`: common settings and pure link/site rules.
- `inline-buttons.ts`, `overlay.ts`, `settings-panel.ts`, `preflight.ts`: launcher UI, explicit disposal and optional bounded metadata checks.
- `official-settings.ts`: allowlisted launch preferences shared with the main settings UI.
- `blog-clicks.ts`, `coexistence.ts`: trusted blog clicks and old-trial coexistence.
- `main-player-bridge.ts`: typed local launch protocol **inside the Nico-origin player frame**, with exact source/origin, video ID, sequence and lifecycle validation. No API method, account response or authentication capability is exposed to the external parent.
- `player-host.cjs`: companion-owned outer iframe and private GM trusted-click ticket. Main never accepts the external parent's window messages as launch proof.
- `launcher.cjs`, `gm-network.cjs`, `private-port.cjs`: main-owned player session, authenticated transport and private loader-frame RPC. The launcher also uses the network utility only for optional availability checks.
- `display-settings.cjs`: main-owned player preferences; sanitized migration from the old companion snapshot, subsequent local-change merging.
- `src/player-close.ts`, `player-background.ts`: bounded final save and small-mode transparent surface.
- `runtime-adapter.cjs`: checked build-time hooks around **one** canonical main runtime, selecting external capabilities only inside the isolated host. It does not contain a second player/UI implementation.
- `build-shells.cjs`: separate main/launcher entries. Main remains scoped to Nico and its existing supported hosts; it does not run directly on every external site. Main uses a DOM sandbox; ordinary Nico playback is injected into the page realm with only lexical lodash and no GM APIs. External playback runs in the main userscript realm.
- `build.cjs`: compiles TypeScript, validates settings/source anchors and emits both products atomically. Internal ExternalTrial storage/frame identifiers are retained for compatibility.

## Checks

`node build.js --dev`, `npm run test:external`, `node packages/external-playback/main-bridge-browser.cjs`, `npm run test:external:browser`, and `node tools/check_regeneration.js .`.

Ownership tests use distinct GM stores and script closures; browser fixtures use distinct Chrome isolated worlds and real same-frame postMessage. API transport is mocked: these checks do not claim live account/playback verification.

## Upgrade and rollback

Update main and companion together, reload Nico once to publish the current player preferences, then reload external pages. Existing companion preferences migrate on the first successful handoff; no old data is deleted. External launch options continue to synchronize in both directions.

A new companion with an old/missing main reports that the main needs updating/enabling. A new main with the previous companion leaves the previous companion's host alone until both are updated.

Rollback: reinstall main and companion from public commit `0e7ecf1cba07137a004807732301848705539c03`, then reload pages. Keep existing stored settings. Do not run the old trial and the new companion simultaneously.

## 完成したMP4をXに直接投稿する初回設定

ご自身のX開発者アプリで完成したMP4を投稿する場合の手順です。ニコニコの公式クリップ（元動画の3〜30秒）は、ニコニコ側のX連携で利用できます。

1. X Developer Consoleでアプリのユーザー認証を有効にし、OAuth 2.0の公開クライアント（Native App または Single Page App）と読み書き権限を設定します。コールバックURLに `http://127.0.0.1:48765/callback` をそのまま登録し、公開Client IDを控えてください。X APIの利用には料金が発生する場合があります。[XのOAuth設定と権限](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)
2. Node.jsをインストールした同じPCで、認可を始める直前にリポジトリのルートから `node packages/external-playback/x-oauth-loopback.cjs` を実行します。[受信ツール](x-oauth-loopback.cjs)を単体で保存した場合は、そのフォルダーで `node x-oauth-loopback.cjs` を実行します。待受は1回分で、10分で終了します。
3. ZenzaWatchで完成したMP4の直接投稿画面を開き、公開Client IDと登録済みのコールバックURLを入力します。「Xで連携を許可」を押し、Xの認可画面でアカウントと権限を確認します。
4. 自動で戻らない場合は、受信画面の「認可URLをコピー」を押し、元の画面の「認可後に画面が切り替わらない場合」に貼り付けて、30秒以内に連携を完了してください。期限が切れたら受信ツールを起動し直して、もう一度認可します。
5. 元の画面で投稿先アカウント、動画、本文を確認し、投稿を確定します。アカウントの切替は「この端末の連携を解除・切替」から行えます。
