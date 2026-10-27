from pathlib import Path
path = Path(__file__).resolve().parent / "test" / "shared-generator.test.mjs"
original = path.read_bytes()
s = original.decode("utf-8").replace("\r\n", "\n")
replacements = [
  ("['UNCHANGED','UNCHANGED']", "['UNCHANGED','UNCHANGED','UNCHANGED']"),
  ("single transaction migrates both modules and verifies both manifests",
   "single transaction migrates all modules and verifies their manifests"),
  ("shared renderer preserves exact Task448/450 runtime bytes",
   "shared renderer preserves canonical legacy runtime bytes")
]
for old, new in replacements:
    if s.count(old) == 1:
        s = s.replace(old, new)
    elif s.count(new) == 1:
        print("ALREADY_UPDATED", old)
    else:
        raise SystemExit(f"UNEXPECTED_MATCH_COUNT {old}")
result = s.encode("utf-8")
if result != original:
    path.write_bytes(result)
print("TASK462_TEST_UPDATES=PASS")
