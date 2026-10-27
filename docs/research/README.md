# NicoNico API reference and source finder

Task969 publishes an **offline, read-only** search index of 44 API operations across 11 categories. The indexed source of truth is [api_catalog.json](api_catalog.json); the [quick reference](API_QUICK_REFERENCE.md) is generated from it. The records cover search, tags, comments, likes, playlist, Mylist/Watch Later, video metadata, NicoDic, Commons, history and RSS.

Use from the repository root:

```powershell
python tools/research_lookup.py --groups
python tools/research_lookup.py "タグ登録" --json
python tools/research_lookup.py "コメントを投稿" --json
python tools/research_lookup.py --id comment.post --related
python tools/research_lookup.py "HLS" --docs
python tools/research_lookup.py --validate
```

Read results in this order: (1) **catalog record and verification status**, (2) referenced public source line, (3) supporting research and, only if necessary, a separate authorized read-only check. The index does not send HTTP requests, post comments, delete tags, add likes or modify user accounts. The `--docs` command returns short excerpts from existing docs, excluding obvious credential and local-path lines; do not treat it as a substitute for reviewing source before sharing.

Verification labels: `code` means the operation is traceable to public code but **not** freshly checked on a website. `historical` indicates a past dated research observation. `live_get` means a GET observation was recorded on the stated date, **not** that it was retested for this public release or that the endpoint has an official stability guarantee.

Public implementation scope differs from the private research tree. Two records (`video.likes-and-owner` and `video.owner.icon-cdn`) now point to their published implementation sources; the earlier release described them as observation-only and have [public provenance notes](API_OBSERVATIONS.md) and retain historical observation notes. All 44 catalog entries now point to published implementation sources. Product runtime and built userscripts are unchanged by this research publication.

To update the index, change the JSON, regenerate the Markdown, run `--validate` and tests, and check that source anchors remain present.
