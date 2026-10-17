"""The write statement for the photo-labels skill (SKILL.md, step 4).

Reads the labels as one line per sheet number, and index.json from
sheets.py, and prints one upsert statement for the whole batch:

    # n  kind      brand wide green daylight people staged  [unsure] ["note"]
    12   food      f     f    f     n        f      f
    27   interior  f     t    t     t        f      f       unsure "A covered gallery: inside or out."

t / f / n are true / false / null. A line per number rather than JSON by
hand, because the trial (17 Oct 2026) was 137 photographs and seven keys
each: the short form is what can be checked against the sheet by eye.

The statement carries the rows as one jsonb array, not a VALUES list: the
same 98 rows were 21 KB as VALUES and 15 KB as an array, and the whole
statement travels through the MCP call.

Usage: python3 write.py labels.txt index.json > write.sql
"""
import json
import shlex
import sys

VERSION = 3
KINDS = ('food', 'interior', 'exterior', 'view', 'text', 'other')
ATTRS = ('brand', 'wide', 'green', 'daylight', 'people', 'staged')
VALUE = {'t': True, 'f': False, 'n': None}


def parse(line: str) -> tuple[str, dict]:
    parts = shlex.split(line)
    n, kind, vals, rest = parts[0], parts[1], parts[2:8], parts[8:]
    if kind not in KINDS or len(vals) != len(ATTRS) or any(v not in VALUE for v in vals):
        raise SystemExit(f'bad line: {line}')
    signals = {'v': VERSION, 'kind': kind, **{k: VALUE[v] for k, v in zip(ATTRS, vals)}, 'by': 'skill'}
    for token in rest:
        if token == 'note':  # optional marker before the note
            continue
        if token == 'unsure':
            signals['unsure'] = True
        elif 'note' not in signals:
            signals['note'] = token
        else:
            raise SystemExit(f'bad line: {line}')
    return n, signals


def main(labels: str, index: str) -> None:
    ids = json.load(open(index))
    rows, seen = [], set()
    for line in open(labels):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        n, signals = parse(line)
        if n not in ids or n in seen:
            raise SystemExit(f'number {n} is not on a sheet, or is labelled twice')
        seen.add(n)
        rows.append([ids[n], signals])
    # Every photograph on the sheets gets a line: a gap is a photograph
    # skipped by accident, and would come back from step 1 next time
    # without anyone knowing why.
    if seen != set(ids):
        raise SystemExit(f'not labelled: {sorted(set(ids) - seen, key=int)}')
    array = json.dumps(rows, ensure_ascii=False, separators=(',', ':')).replace("'", "''")
    print(f"""insert into public.photo_scores (photo_id, scorer, scorer_version, signals)
select (e->>0)::uuid, 'claude-labels', {VERSION}, e->1 from jsonb_array_elements('{array}'::jsonb) e
on conflict (photo_id, scorer) do update
  set signals = public.photo_scores.signals || excluded.signals,
      scorer_version = greatest(public.photo_scores.scorer_version, excluded.scorer_version),
      scored_at = now();""")
    kinds: dict[str, int] = {}
    for _, s in rows:
        kinds[s['kind']] = kinds.get(s['kind'], 0) + 1
    print(f'-- {len(rows)} rows: {json.dumps(kinds)}', file=sys.stderr)


if __name__ == '__main__':
    main(*sys.argv[1:3])
