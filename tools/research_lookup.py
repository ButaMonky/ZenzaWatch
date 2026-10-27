#!/usr/bin/env python3
"""Offline NicoNico API lookup; never contacts websites or mutates user accounts."""
from __future__ import annotations
import argparse, json, re, sys, unicodedata
from collections import Counter
from datetime import date
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/"docs/research/api_catalog.json"
METHODS={"GET","HEAD","POST","PUT","PATCH","DELETE"}
AUTH={"public","frontend_cookie","authorized","dynamic"}
LEVEL={"code","historical","live_get"}
GROUPS={"search","tags","comments","video","likes","playlist","mylist",
        "dictionary","commons","history","ranking"}
# Suppress entire source lines that could reveal credentials, IDs or local paths.
# Snippets are advisory only: the user should open the cited source when necessary.
MASK=re.compile(
    r"(?i)(?:[a-z]:[\\/]|/(?:users|home)/[^/\s]+/|"
    r"\b(?:cookie|authorization|set-cookie|bearer|password|passwd|"
    r"access[_ .-]?token|refresh[_ .-]?token|csrf[_ .-]?token|"
    r"secret(?:[_ .-]?key)?|private[_ .-]?key|api[_ .-]?key|"
    r"session[_ .-]?(?:id|key|token)|x-tag-edit-key)\b|"
    r"(?:gh[pousr]_[a-z0-9]{10,}|github_pat_[a-z0-9_]{10,}|sk-[a-z0-9_-]{12,})|"
    r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})")

def normalize(x):
    return unicodedata.normalize("NFKC",str(x)).casefold()

# Longest-first Japanese terms; matches particles/compound requests without a tokenizer dependency.
QUERY_TERMS=("コンテンツツリー","サジェスト","マイリスト","あとで見る",
             "再生履歴","コメント","投稿者","ランキング","ニコる","いいね",
             "ユーザー","アイコン","プレイリスト","スナップショット",
             "検索","動画","タグ","登録","追加","削除","解除","投稿",
             "取得","読込","一覧","欠落","不明","書込","受信","キー","数")
QUERY_PARTS=re.compile("|".join(map(re.escape,QUERY_TERMS))+r"|[a-z0-9_.-]+",re.I)
QUERY_STOP={"api","url","http","https","方法","使い方","したい","する",
            "教えて","を","の","に","で","が","へ","と","について"}
QUERY_ALIASES={"不明":"欠落","受信":"読込","書込":"投稿"}

def tokens(q):
    result=[]
    for term in re.findall(r"[^,\s、/・]+",normalize(q)):
        matches=QUERY_PARTS.findall(term)
        # A word such as "キーワード" without known parts is still searchable.
        parts=matches if matches else [term]
        for part in parts:
            part=QUERY_ALIASES.get(part,part)
            if part not in QUERY_STOP and part not in result:
                result.append(part)
    return result

def load():
    return json.loads(CATALOG.read_text(encoding="utf-8"))

def text_lines(path):
    raw=path.read_bytes()
    try: return raw.decode("utf-8").splitlines()
    except UnicodeError: return raw.decode("cp932").splitlines()

def find_line(path,anchor):
    try:
        for idx,line in enumerate(text_lines(path),1):
            if anchor in line: return idx
    except (OSError,UnicodeError): pass
    return None

def validate(data):
    issues=[]
    if data.get("schema_version")!=1:issues.append("schema_version must equal 1")
    entries=data.get("entries")
    if not isinstance(entries,list) or not entries:return issues+["entries missing"]
    ids=set()
    for item in entries:
        ident=item.get("id")
        if not isinstance(ident,str) or not re.fullmatch(r"[a-z0-9]+(?:[.-][a-z0-9]+)+",ident):
            issues.append("invalid id: "+str(ident));continue
        if ident in ids:issues.append("duplicate id "+ident)
        ids.add(ident)
        for required in ("category","title","url","method","auth","summary","verification"):
            if not isinstance(item.get(required),str) or not item[required].strip():
                issues.append(ident+": "+required+" missing")
        if item.get("category") not in GROUPS:issues.append(ident+": invalid category")
        if item.get("method") not in METHODS:issues.append(ident+": invalid method")
        if item.get("auth") not in AUTH:issues.append(ident+": invalid auth")
        if item.get("verification") not in LEVEL:issues.append(ident+": invalid verification")
        stamp=item.get("verified_on")
        if item.get("verification")=="code" and stamp is not None:
            issues.append(ident+": code-only entry must not claim an observation date")
        elif item.get("verification") in ("historical","live_get"):
            try:
                if not isinstance(stamp,str) or date.fromisoformat(stamp)>date.today():
                    raise ValueError("invalid or future date")
            except ValueError:issues.append(ident+": valid observation date required")
        if item.get("verification")=="live_get" and item.get("method")!="GET":
            issues.append(ident+": cannot claim live-GET for mutation")
        if item.get("action") not in ("read","write"):
            issues.append(ident+": action missing")
        if item.get("action")=="write":
            if item.get("auth")!="authorized":
                issues.append(ident+": mutating operation must require authorization")
            if item.get("method") in ("GET","HEAD"):
                issues.append(ident+": mutating operation cannot use GET/HEAD")
        route=item.get("url")
        if not isinstance(route,str) or not route.startswith(("https://","{nvComment.server}/")) or (
                re.search(r"\s|@",route)):
            issues.append(ident+": unsafe or malformed endpoint")
        for field in ("caveats","keywords"):
            if not isinstance(item.get(field),list) or not item[field]:
                issues.append(ident+": "+field+" missing")
        refs=item.get("sources",[])
        if not refs or not refs[0].get("anchor"):
            issues.append(ident+": source code anchor required")
        for ref in refs:
            rel=ref.get("path","")
            if not isinstance(rel,str) or not rel.startswith(("docs/","packages/","src/","tools/","test/")) or ".." in Path(rel).parts:
                issues.append(ident+": unsafe path "+str(rel));continue
            source=ROOT/rel
            if not source.resolve().is_relative_to(ROOT.resolve()) or source.is_symlink():
                issues.append(ident+": source escaped repository "+rel);continue
            if not source.is_file(): issues.append(ident+": source not found "+rel)
            elif ref.get("anchor") and find_line(source,ref["anchor"]) is None:
                issues.append(ident+": source anchor absent "+rel+" "+ref["anchor"])
    for item in entries:
        for dependency in item.get("depends_on",[]):
            if dependency not in ids: issues.append(item["id"]+": missing dependency "+dependency)
    return issues

def contains_term(haystack,term):
    # "投稿" (send a comment) must not accidentally match "投稿者" (uploader).
    return bool(re.search(r"投稿(?!者)",haystack)) if term=="投稿" else term in haystack

def score(item,query_tokens):
    title=normalize(item["id"]+" "+item["title"])
    keywords=normalize(" ".join(item["keywords"]))
    details=normalize(" ".join([item["category"],item["method"],item["url"],
                               item["summary"],*item["caveats"]]))
    found=0;points=0;strong=False
    for t in query_tokens:
        if contains_term(title,t):points+=24;found+=1;strong=True
        elif contains_term(keywords,t):points+=12;found+=1;strong=True
        elif contains_term(details,t):points+=3;found+=1
    # AND semantics; incidental mentions in caveats must not become search results.
    if found<len(query_tokens) or not strong:return 0
    points+=15
    if query_tokens and title.startswith(query_tokens[0]):points+=18
    if len(query_tokens)>1 and title.endswith(query_tokens[-1]):points+=18
    if item['method']=='POST' and any(t in query_tokens for t in ('投稿','登録','追加')):points+=12
    if item['method']=='DELETE' and any(t in query_tokens for t in ('削除','解除')):points+=12
    if '検索' in query_tokens and '公式' in item['title']:points+=8
    if 'キー' not in query_tokens and item['id'].endswith('-key'):points-=12
    if len(query_tokens)==1 and query_tokens[0]==normalize(item["id"]):points+=100
    return max(1,points)

def find_docs(q,limit):
    matches=[]
    if not q:return matches
    for folder in (ROOT/"docs/design-pack",ROOT/"docs/research"):
        if not folder.is_dir():continue
        for file in folder.rglob("*"):
            if not file.is_file() or file.suffix.lower() not in (".md",".json",".csv"):continue
            # Never dereference a linked file outside the checked-out repository.
            if file.is_symlink() or not file.resolve().is_relative_to(ROOT.resolve()):continue
            if file.name in ("api_catalog.json","API_QUICK_REFERENCE.md"):continue
            if file.stat().st_size>512000:continue
            try:lines=text_lines(file)
            except (OSError,UnicodeError):continue
            name=normalize(str(file.relative_to(ROOT)));best=None
            for number,line in enumerate(lines[:3500],1):
                s=line.strip()
                if not s or MASK.search(s):continue
                folded=normalize(s)
                hits=sum(t in folded for t in q)
                if not hits:continue
                weight=hits*5+sum(t in name for t in q)*8
                if hits==len(q):weight+=12
                if best is None or best[0]<weight:best=(weight,number,s[:190])
            if best:matches.append({"path":file.relative_to(ROOT).as_posix(),
                                   "line":best[1],"score":best[0],"excerpt":best[2]})
    return sorted(matches,key=lambda x:(-x["score"],x["path"]))[:limit]

def detail(row):
    data=dict(row);refs=[]
    for ref in row["sources"]:
        src=dict(ref)
        if src.get("anchor"):
            number=find_line(ROOT/src["path"],src["anchor"])
            if number:src["line"]=number
        refs.append(src)
    data["sources"]=refs
    return data

def markdown(data):
    names={"search":"検索・候補","tags":"タグ一覧・追加・削除",
           "comments":"コメント取得・投稿・削除・ニコる",
           "video":"動画情報・投稿者・広告","likes":"いいね操作",
           "playlist":"プレイリスト","mylist":"マイリスト・あとで見る",
           "dictionary":"ニコニコ大百科","commons":"コンテンツツリー",
           "history":"再生履歴","ranking":"ランキング"}
    order=["search","tags","comments","video","likes","playlist",
           "mylist","dictionary","commons","history","ranking"]
    out=["# ニコニコAPIクイックリファレンス（自動生成）","",
         "> 単一の正本は api_catalog.json。このMarkdownは research_lookup.py --generate-markdown の出力。",
         "> 通信・投稿・削除は一切行わない。最新性・権限・注意点はJSONまたは検索ツールの詳細を確認。",
         ""]
    for group in order:
        group_rows=[x for x in data["entries"] if x["category"]==group]
        if not group_rows:continue
        out += ["## "+names.get(group,group)+"（"+str(len(group_rows))+"件）","",
                "| ID・用途 | HTTP（用途） | 認証条件 | 検証状態 | パス | 実装 |",
                "|---|---|---|---|---|---|"]
        for row in group_rows:
            source=row["sources"][0]["path"]
            url=row["url"].replace("|","\\|")
            out.append("| "+row["id"]+" — "+row["title"]+" | "+row["method"]+
                       " ("+row["action"]+") | "+row["auth"]+" | "+row["verification"]+
                       " | "+url+" | [コード](../../"+source+") |")
        out.append("")
    out += ["## 最初に使う検索コマンド","",
       "    python tools/research_lookup.py タグ 削除",
       "    python tools/research_lookup.py コメント 投稿 --json",
       "    python tools/research_lookup.py --id comment.post --related",
       "    python tools/research_lookup.py 投稿者 アイコン --docs",
       "    python tools/research_lookup.py --validate",""]
    return "\n".join(out).rstrip("\n")

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("query",nargs="*")
    p.add_argument("--id",help="Exact API ID")
    p.add_argument("--group")
    p.add_argument("--method",choices=sorted(METHODS))
    p.add_argument("--limit",type=int,default=7)
    p.add_argument("--json",action="store_true")
    p.add_argument("--docs",action="store_true",help="Bounded full-text source search")
    p.add_argument("--related",action="store_true")
    p.add_argument("--groups",action="store_true")
    p.add_argument("--validate",action="store_true")
    p.add_argument("--generate-markdown",action="store_true")
    args=p.parse_args()
    if not 1<=args.limit<=100:p.error("--limit must be between 1 and 100")
    data=load()
    if args.validate:
        issues=validate(data)
        for error in issues:print("INVALID "+error,file=sys.stderr)
        if not issues:print("CATALOG_VALIDATED entries="+str(len(data["entries"]))+" sources=checked offline=yes")
        return bool(issues)
    if args.generate_markdown:
        print(markdown(data));return 0
    if args.groups:
        counts=Counter(x["category"] for x in data["entries"])
        print(json.dumps(dict(sorted(counts.items())),indent=2,ensure_ascii=False)
              if args.json else "\n".join("%-16s %d"%x for x in sorted(counts.items())))
        return 0
    query=" ".join(args.query);q=tokens(query)
    if args.id:
        chosen=[x for x in data["entries"] if x["id"]==args.id]
        if not chosen:
            print("Unknown API id: "+args.id,file=sys.stderr);return 2
        if args.related:
            deps=set(chosen[0].get("depends_on",[]))
            chosen.extend(x for x in data["entries"] if x["id"] in deps)
    else:
        chosen=[x for x in data["entries"] if
                (not args.group or x["category"]==args.group) and
                (not args.method or x["method"]==args.method)]
        if q:
            chosen=[x for x in chosen if score(x,q)>0]
            # Generic results win ties over specialized variants, e.g. video search
            # before an owner's video-search endpoint.
            chosen.sort(key=lambda x:(-score(x,q),len(x["title"]),x["id"]))
        else:chosen.sort(key=lambda x:(x["category"],x["id"]))
        chosen=chosen[:args.limit]
    results=[detail(x) for x in chosen]
    doc_hits=find_docs(q,args.limit) if args.docs else []
    if args.json:
        print(json.dumps({"query":query,"matches":results,"documents":doc_hits},
                         indent=2,ensure_ascii=False))
        return 0 if chosen or doc_hits else 2
    print("API "+str(len(results))+" hits / "+str(len(data["entries"]))+" indexed (OFFLINE)")
    for row in results:
        print("\n["+row["id"]+"] "+row["title"]+" / "+row["method"]+" / "+row["category"])
        print("  Route: "+row["url"])
        print("  Purpose: "+row["summary"])
        print("  Access: "+row["auth"]+" | status: "+row["verification"]+
              (" "+row["verified_on"] if row.get("verified_on") else ""))
        print("  Caution: "+" / ".join(row["caveats"][:2]))
        for ref in row["sources"][:3]:
            print("  Source: "+ref["path"]+(":"+str(ref["line"]) if ref.get("line") else ""))
        if row["depends_on"]:print("  Requires: "+", ".join(row["depends_on"]))
    if args.docs:
        print("\nDOCUMENTS "+str(len(doc_hits))+" hits (read-only, small snippets)")
        for hit in doc_hits:print(hit["path"]+":"+str(hit["line"])+" "+hit["excerpt"])
    return 0 if chosen or doc_hits else 2

if __name__=="__main__":
    sys.exit(main())
