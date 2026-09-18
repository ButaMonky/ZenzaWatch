# test/pending/

ここに置かれたテストは、`npm test`（`test/**/unit/*.js`）の実行対象から意図的に
除外されています。理由は個別に記載します。除外は一時的なもので、内容は変更していません。

## StoryboardTest.js（解決済み・Task 018で `test/unit/` へ復帰）

`docs/design-pack/09_TASK_001_TEST_IMPORT_AUDIT.md` の調査で発覚した問題
（存在しないimport先、`it()`の外に書かれたアサーション）に加えて、Task 018の
調査で**`StoryboardSession`/`DmcStoryboardInfoLoader`等がWeb Worker専用の
実行コンテキスト（`func.toString()`で文字列化されて別スレッドで再実行される
仕組み）の中だけに定義されていて、そもそもexportできない構造**になっている
ことが判明した（詳細: `docs/design-pack/24_TASK_018_STORYBOARD_TEST_BLOCKED.md`）。

ユーザーの判断（案B: 本格再設計）を受けて、これらのクラスを
`createStoryboardClasses(util)`という単一のファクトリ関数として
`VideoSessionWorker.js`のモジュールトップレベルに切り出し、
(1) 通常の`import`でテストから使えるようにexportしつつ、
(2) `workerUtil.createCrossMessageWorker`の`inject`オプションで同じ
ファクトリのソースをWorker側にも注入する、という形に構造変更した
（詳細: `docs/design-pack/25_TASK_018_STORYBOARD_TEST_REWRITE.md`）。
これによりexport不能の問題が解消したため、`it()`の外のアサーションも含めて
書き直し、`test/unit/StoryboardTest.js`として`test/unit/`に復帰させた。

## utilTest.js（解決済み・Task 021で `test/unit/` へ復帰）

`docs/design-pack/16_TASK_007_WEAKMAP_ROOT_CAUSE.md` の調査（WeakMap未定義エラー）が
原因で`test/pending/`に移動していました。Task 017（jsdomアップグレード検証）で
WeakMap問題を解消し、Task 020で`console.nicoru`問題（実質的な機能のない装飾用
console.logラッパーだったためユーザー確認の上削除）を解消したのち、Task 021で
最後の問題（`Config.props`が非同期に設定されるため、Node側の同期`require`読み込み
だと未定義のまま参照してしまう。`docs/design-pack/29_TASK_021_CONFIG_PROPS_RACE.md`参照）
を解消し、`test/unit/utilTest.js`として`test/unit/`に復帰させた。

道中で判明・修正した以下の問題は`test/setup.js`側の環境不備で、
いずれもテスト実行環境のみに影響し本番の`.user.js`の挙動には影響しません（Task 017）:

1. `packages/components/src/dll.js`がネットワーク越しに`https://esm.run/lit`を
   importしており、Node環境ではこれを解決できず`ERR_NETWORK_IMPORT_DISALLOWED`で
   落ちる（`test/mocks/dll.js`で同じ形のスタブに差し替えることで解消。
   `dll.js`自体はTask 008/010の調査で本番ビルドの`@require`連鎖にも含まれておらず
   実働していないため、スタブ化しても本番挙動に影響しない）。
2. `bounce.js`が参照する`self`がグローバルに存在しなかった（`global.self`を追加）。
3. `CacheStorage.js`が`window._`（lodash）を前提にしていた（`global.window._`を追加）。
4. jsdom 30で`window.CSS`が実装されたことで、`uQuery.js`の未束縛な`CSS`参照が
   初めて評価されるようになった（jsdom 11では`window.CSS`自体が未定義だったため
   このコードパスが素通りされていた。`global.CSS`を追加）。
5. **`test/setup.js`の既存バグ**: `global.document`にJSDOMラッパーインスタンス
   自体を代入していて、本来の`Document`オブジェクト（`.cookie`等を持つ）ではなかった
   （`Task 007`の`window`版と同種のミス）。`nicoUtil.js`が`document.cookie`を
   参照するまで誰も気づかなかった。`dom.window.document`に修正。
6. `window.console`自体が未定義だった（jsdomはスクリプト実行を有効にしない限り
   `window.console`を提供しない）。`global.window.console = console`を追加。

## VideoSearchTest.js（解決済み・Task 019で `test/unit/` へ復帰）

Task 017の環境修正（`ERR_NETWORK_IMPORT_DISALLOWED`等の解消）によりクラッシュ
しなくなったが、`StoryboardTest.js`と同じ構造的な問題（アサーションが`it()`の外、
`describe()`の本体に直接書かれている）を抱えており、実行しても`0 passing`
（実質的に何もテストしていない）状態だった。`StoryboardTest.js`と異なりexport不能
問題はなく（`packages/lib/src/nico/VideoSearch.js`の`NicoSearchApiV2Query`は普通に
importできる）、実際に動かして現行実装の挙動を確認した上で、アサーションを
`it()`ブロックに移すだけで復帰できた（詳細: `docs/design-pack/26_TASK_019_VIDEOSEARCH_TEST_REWRITE.md`）。
`test/unit/VideoSearchTest.js`として`test/unit/`に復帰。
