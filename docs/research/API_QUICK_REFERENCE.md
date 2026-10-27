# ニコニコAPIクイックリファレンス（自動生成）

> 単一の正本は api_catalog.json。このMarkdownは research_lookup.py --generate-markdown の出力。
> 通信・投稿・削除は一切行わない。最新性・権限・注意点はJSONまたは検索ツールの詳細を確認。

## 検索・候補（5件）

| ID・用途 | HTTP（用途） | 認証条件 | 検証状態 | パス | 実装 |
|---|---|---|---|---|---|
| search.video — 公式動画検索 | GET (read) | frontend_cookie | historical | https://nvapi.nicovideo.jp/v2/search/video | [コード](../../packages/lib/src/nico/VideoSearch.js) |
| search.snapshot — スナップショット検索 | GET (read) | public | historical | https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search | [コード](../../packages/lib/src/nico/VideoSearch.js) |
| search.by-owner — 投稿者の公開動画検索 | GET (read) | frontend_cookie | code | https://nvapi.nicovideo.jp/v3/users/{userId}/videos | [コード](../../packages/lib/src/nico/VideoSearch.js) |
| search.suggest — タグ検索候補 | GET (read) | public | historical | https://sug.search.nicovideo.jp/suggestion/expand/{encodedWord} | [コード](../../packages/lib/src/nico/TagSuggestLoader.js) |
| search.playlist — プレイリスト検索 | GET (read) | frontend_cookie | code | https://nvapi.nicovideo.jp/v1/playlist/search | [コード](../../packages/lib/src/nico/PlaylistApiLoader.js) |

## タグ一覧・追加・削除（4件）

| ID・用途 | HTTP（用途） | 認証条件 | 検証状態 | パス | 実装 |
|---|---|---|---|---|---|
| tags.list — タグ一覧取得 | GET (read) | frontend_cookie | code | https://nvapi.nicovideo.jp/v2/videos/{videoId}/tags | [コード](../../packages/lib/src/nico/TagEditApi.js) |
| tags.add — タグ登録・追加 | POST (write) | authorized | historical | https://nvapi.nicovideo.jp/v2/videos/{videoId}/tags?tag={encodedTag} | [コード](../../packages/lib/src/nico/TagEditApi.js) |
| tags.delete — タグ削除 | DELETE (write) | authorized | historical | https://nvapi.nicovideo.jp/v2/videos/{videoId}/tags?tag={encodedTag} | [コード](../../packages/lib/src/nico/TagEditApi.js) |
| tags.edit-key — タグ編集キー更新 | GET (read) | frontend_cookie | historical | https://www.nicovideo.jp/api/watch/v3/{videoId} | [コード](../../packages/lib/src/nico/TagEditApi.js) |

## コメント取得・投稿・削除・ニコる（8件）

| ID・用途 | HTTP（用途） | 認証条件 | 検証状態 | パス | 実装 |
|---|---|---|---|---|---|
| comment.read-key — スレッドキー取得 | GET (read) | frontend_cookie | code | https://nvapi.nicovideo.jp/v1/comment/keys/thread?videoId={videoId} | [コード](../../packages/lib/src/nico/ThreadLoader.js) |
| comment.read — nvCommentコメント取得 | POST (read) | dynamic | code | {nvComment.server}/v1/threads | [コード](../../packages/lib/src/nico/ThreadLoader.js) |
| comment.post-key — コメント投稿キー取得 | GET (read) | frontend_cookie | code | https://nvapi.nicovideo.jp/v1/comment/keys/post?threadId={threadId} | [コード](../../packages/lib/src/nico/CommentPostWire.js) |
| comment.post — コメント新規投稿 | POST (write) | authorized | code | {nvComment.server}/v1/threads/{threadId}/comments | [コード](../../packages/lib/src/nico/ThreadLoader.js) |
| comment.delete-key — コメント削除キー取得 | GET (read) | frontend_cookie | code | https://nvapi.nicovideo.jp/v1/comment/keys/delete?threadId={threadId}&fork={fork} | [コード](../../packages/lib/src/nico/ThreadLoader.js) |
| comment.delete — 投稿者コメント削除 | PUT (write) | authorized | code | {nvComment.server}/v1/threads/{threadId}/comment-comment-owner-deletions | [コード](../../packages/lib/src/nico/ThreadLoader.js) |
| comment.nicoru-key — ニコるキー取得 | GET (read) | frontend_cookie | code | https://nvapi.nicovideo.jp/v1/comment/keys/nicoru?threadId={threadId} | [コード](../../packages/lib/src/nico/ThreadLoader.js) |
| comment.nicoru — コメントにニコる | POST (write) | authorized | code | {nvComment.server}/v1/threads/{threadId}/nicorus | [コード](../../packages/lib/src/nico/ThreadLoader.js) |

## 動画情報・投稿者・広告（9件）

| ID・用途 | HTTP（用途） | 認証条件 | 検証状態 | パス | 実装 |
|---|---|---|---|---|---|
| video.watch — 視聴ページ・watch v4 | GET (read) | frontend_cookie | historical | https://www.nicovideo.jp/watch/{watchId} | [コード](../../packages/lib/src/nico/VideoInfoLoader.js) |
| video.watch-lazy — watch v4追加情報lazy | GET (read) | frontend_cookie | code | https://nvapi.nicovideo.jp/v4/watch/lazy/{watchId} | [コード](../../packages/lib/src/nico/VideoInfoLoader.js) |
| video.thumbinfo — getthumbinfo XML | GET (read) | public | historical | https://ext.nicovideo.jp/api/getthumbinfo/{watchId} | [コード](../../packages/lib/src/nico/ThumbInfoLoader.js) |
| video.likes-and-owner — いいね数と可視投稿者 | GET (read) | public | live_get | https://nvapi.nicovideo.jp/v1/videos?watchIds={watchId} | [コード](../../packages/zenza/src/pocket/PocketCardMetadataLoader.js) |
| video.owner.nicoad — 欠落投稿者のNicoAd補完 | GET (read) | public | live_get | https://api.nicoad.nicovideo.jp/v1/contents/video/{watchId} | [コード](../../packages/lib/src/nico/OwnerSupplement.js) |
| video.owner.snapshot — Snapshotの投稿者ID逆引き | GET (read) | public | historical | https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search | [コード](../../packages/lib/src/nico/VideoSearch.js) |
| video.owner.icon-cdn — 既知IDのアイコンCDN候補 | GET (read) | public | live_get | https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/s/{bucket}/{userId}.jpg | [コード](../../packages/zenza/src/pocket/PocketDescriptionCard.js) |
| video.nicoad-decoration — 金冠・銀冠を一括取得 | GET (read) | public | historical | https://api.nicoad.nicovideo.jp/v1/contents/video/decoration?ids={watchIds} | [コード](../../packages/lib/src/nico/AdDecorationLoader.js) |
| watch.linked-channel — チャンネル連動動画 | GET (read) | frontend_cookie | code | https://public-api.ch.nicovideo.jp/v1/user/channelVideoDAnimeLinks | [コード](../../packages/lib/src/nico/VideoInfoLoader.js) |

## いいね操作（2件）

| ID・用途 | HTTP（用途） | 認証条件 | 検証状態 | パス | 実装 |
|---|---|---|---|---|---|
| like.add — いいね登録 | POST (write) | authorized | historical | https://nvapi.nicovideo.jp/v1/users/me/likes/items?videoId={videoId} | [コード](../../packages/lib/src/nico/LikeApi.js) |
| like.delete — いいね解除 | DELETE (write) | authorized | historical | https://nvapi.nicovideo.jp/v1/users/me/likes/items?videoId={videoId} | [コード](../../packages/lib/src/nico/LikeApi.js) |

## プレイリスト（4件）

| ID・用途 | HTTP（用途） | 認証条件 | 検証状態 | パス | 実装 |
|---|---|---|---|---|---|
| playlist.series — シリーズ動画プレイリスト | GET (read) | frontend_cookie | code | https://nvapi.nicovideo.jp/v1/playlist/series/{seriesId} | [コード](../../packages/lib/src/nico/PlaylistApiLoader.js) |
| playlist.uploaded — 投稿者動画プレイリスト | GET (read) | frontend_cookie | code | https://nvapi.nicovideo.jp/v1/playlist/user-uploaded/{userId} | [コード](../../packages/lib/src/nico/PlaylistApiLoader.js) |
| playlist.mylist — 公開マイリスト再生 | GET (read) | frontend_cookie | code | https://nvapi.nicovideo.jp/v1/playlist/mylist/{mylistId} | [コード](../../packages/lib/src/nico/PlaylistApiLoader.js) |
| playlist.watchlater — あとで見るプレイリスト | GET (read) | frontend_cookie | code | https://nvapi.nicovideo.jp/v1/playlist/watch-later | [コード](../../packages/lib/src/nico/PlaylistApiLoader.js) |

## マイリスト・あとで見る（7件）

| ID・用途 | HTTP（用途） | 認証条件 | 検証状態 | パス | 実装 |
|---|---|---|---|---|---|
| mylist.groups — 本人マイリストグループ一覧 | GET (read) | frontend_cookie | code | https://nvapi.nicovideo.jp/v1/users/me/mylists | [コード](../../packages/lib/src/nico/MylistApiLoader.js) |
| mylist.items — 本人マイリスト動画一覧 | GET (read) | frontend_cookie | code | https://nvapi.nicovideo.jp/v1/users/me/mylists/{groupId} | [コード](../../packages/lib/src/nico/MylistApiLoader.js) |
| mylist.add — マイリスト追加 | POST (write) | authorized | code | https://nvapi.nicovideo.jp/v1/users/me/mylists/{groupId}/items?itemId={watchId}&description={encodedDescription} | [コード](../../packages/lib/src/nico/MylistApiLoader.js) |
| mylist.delete — マイリスト削除 | DELETE (write) | authorized | code | https://nvapi.nicovideo.jp/v1/users/me/mylists/{groupId}/items?itemIds={itemId} | [コード](../../packages/lib/src/nico/MylistApiLoader.js) |
| watchlater.items — あとで見る登録一覧 | GET (read) | frontend_cookie | code | https://nvapi.nicovideo.jp/v1/users/me/watch-later | [コード](../../packages/lib/src/nico/MylistApiLoader.js) |
| watchlater.add — あとで見る追加 | POST (write) | authorized | code | https://nvapi.nicovideo.jp/v1/users/me/watch-later | [コード](../../packages/lib/src/nico/MylistApiLoader.js) |
| watchlater.delete — あとで見る削除 | DELETE (write) | authorized | code | https://nvapi.nicovideo.jp/v1/users/me/watch-later?itemIds={itemId} | [コード](../../packages/lib/src/nico/MylistApiLoader.js) |

## ニコニコ大百科（1件）

| ID・用途 | HTTP（用途） | 認証条件 | 検証状態 | パス | 実装 |
|---|---|---|---|---|---|
| nicodic.batch — 大百科記事一括照会 | GET (read) | public | historical | https://api.dic.nicovideo.jp/v1/articles/article?titles[]={title} | [コード](../../packages/lib/src/nico/NicodicArticleLoader.js) |

## コンテンツツリー（2件）

| ID・用途 | HTTP（用途） | 認証条件 | 検証状態 | パス | 実装 |
|---|---|---|---|---|---|
| commons.parents — コンテンツツリー親作品 | GET (read) | public | historical | https://public-api.commons.nicovideo.jp/v1/tree/{globalId}/relatives/parents | [コード](../../packages/lib/src/nico/CommonsTreeLoader.js) |
| commons.children — コンテンツツリー子作品 | GET (read) | public | historical | https://public-api.commons.nicovideo.jp/v1/tree/{globalId}/relatives/children | [コード](../../packages/lib/src/nico/CommonsTreeLoader.js) |

## 再生履歴（1件）

| ID・用途 | HTTP（用途） | 認証条件 | 検証状態 | パス | 実装 |
|---|---|---|---|---|---|
| watch.playback-position — 再生位置保存 | PUT (write) | authorized | code | https://nvapi.nicovideo.jp/v2/users/me/watch/history/playback-position | [コード](../../packages/lib/src/nico/PlaybackPosition.js) |

## ランキング（1件）

| ID・用途 | HTTP（用途） | 認証条件 | 検証状態 | パス | 実装 |
|---|---|---|---|---|---|
| ranking.rss — ランキングRSS | GET (read) | public | code | https://www.nicovideo.jp/ranking/genre/{genre}?term={term}&rss=2.0 | [コード](../../packages/lib/src/nico/NicoRssLoader.js) |

## 最初に使う検索コマンド

    python tools/research_lookup.py タグ 削除
    python tools/research_lookup.py コメント 投稿 --json
    python tools/research_lookup.py --id comment.post --related
    python tools/research_lookup.py 投稿者 アイコン --docs
    python tools/research_lookup.py --validate
