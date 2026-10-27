# ZenzaWatch contributor reference (research only)

When studying NicoNico video API behaviour, search the [offline API catalog](docs/research/README.md) before reading lengthy code or guessing an endpoint.

```powershell
python tools/research_lookup.py "????" --json
python tools/research_lookup.py --id comment.post --related
python tools/research_lookup.py --validate
```

The index is read-only. Do not execute mutation APIs for research. Distinguish recorded observations from live checks. Source anchors refer to *this public repository*, except for the two explicitly documented observation-only records. Do not publish cookies, tokens, raw HAR files or user-identifying logs. This note does not override existing build, contribution or safety guidance.
