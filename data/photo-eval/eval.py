"""Does an image-text model see what a place's category promises?

Step B3 of docs/photo-critic.md. Read-only and outside the app: it fetches
the catalog's photographs and their places' categories through the public
API, asks a model how well each photograph matches each category's
sentences (prompts.json), and writes a CSV and an HTML page a person can
read through. Nothing is written back anywhere.

Run on a Mac (README.md). The session that wrote it could not reach the
photo storage or the model hub, so the parts that touch the network or a
model have only run there; everything between them runs here under
`--model fake --photos-json`, which is how it was checked.

Why these models, and not MobileCLIP, is in docs/photo-critic.md section 8:
Apple's MobileCLIP weights are licensed for research only. SigLIP 2 is
Apache 2.0 and CLIP is MIT, so either could ship.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import math
import os
import random
import sys
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent

# The app's own public endpoint and publishable key (app/src/lib/supabase.ts):
# what anyone holding the app can already read, which is all this needs.
SUPABASE_URL = "https://amdvitzpogaejzzqroco.supabase.co"
SUPABASE_KEY = "sb_publishable_VVol99Jqs0QYzeVrmOawlw_ZpXqcv7B"

MODELS = {
    # The smallest SigLIP 2; Apache 2.0. Its image tower is what would ship.
    "siglip2": "google/siglip2-base-patch16-256",
    # The reference point every image-text model is measured against; MIT.
    "clip": "openai/clip-vit-base-patch32",
}

# The rule the app could apply today with Vision's stored labels — the
# prototype that found 270 of 277 photographs fitting on 16 Oct 2026
# (docs/photo-critic.md section 4). Here only as the baseline a model has
# to beat; a category absent from it is one Vision's labels cannot speak
# for, which is the point of this evaluation.
VISION_EXPECT = {
    "cafes": "drinking_glass cup coffee beverage liquid drink tableware utensil food plate interior_room furniture "
             "table chair restaurant people adult machine lamp stool decoration decorative_plant building portal "
             "window door wood_processed bar art frame raw_glass bowl textile light container",
    "eats": "food plate bowl tableware utensil fork drinking_glass drink liquid restaurant interior_room furniture "
            "table people adult bar wood_processed light decoration",
    "nightlife": "bar drinking_glass drink liquid light people adult interior_room furniture restaurant tableware "
                 "sky cityscape outdoor structure",
    "views": "sky blue_sky cloudy cityscape skyscraper outdoor building water land structure",
    "heritage": "building structure arch portal art interior_room sculpture statue decoration window people frame "
                "material sky outdoor",
    "nature": "plant tree foliage grass garden flower land sky blue_sky cloudy water outdoor decorative_plant "
              "structure building arch",
}
VISION_P = 0.3


@dataclass
class Photo:
    id: str
    uri: str
    slug: str
    categories: list[str]
    cover: bool = False
    labels: list[dict] = field(default_factory=list)
    truth: str | None = None  # the category of an owner's test photograph


# ── fetching ──────────────────────────────────────────────────────────

def fetch_catalog(url: str, key: str, limit: int | None) -> list[Photo]:
    """Every visible photograph of every published place, with the place's
    categories and Vision's stored labels where it has been scored. What
    the public key may read is what RLS gives anyone: hidden photographs
    and unpublished places are not in it, which suits an evaluation of the
    catalog people see."""
    select = ("id,photo_uri,is_cover,"
              "places!inner(slug,categories,is_published),"
              "photo_scores(scorer,signals)")
    out: list[Photo] = []
    page = 1000
    offset = 0
    while True:
        q = (f"{url}/rest/v1/place_photos?select={urllib.parse.quote(select, safe=',:()!')}"
             f"&places.is_published=eq.true&photo_scores.scorer=eq.apple-vision"
             f"&order=id&limit={page}&offset={offset}")
        req = urllib.request.Request(q, headers={"apikey": key, "Authorization": f"Bearer {key}"})
        with urllib.request.urlopen(req, timeout=60) as r:
            rows = json.load(r)
        for row in rows:
            scores = row.get("photo_scores") or []
            if isinstance(scores, dict):
                scores = [scores]
            labels = scores[0].get("signals", {}).get("labels", []) if scores else []
            place = row["places"]
            out.append(Photo(row["id"], row["photo_uri"], place["slug"],
                             place["categories"] or [], bool(row["is_cover"]), labels or []))
        if len(rows) < page or (limit and len(out) >= limit):
            break
        offset += page
    return out[:limit] if limit else out


def extra_photos(folder: Path, known: set[str]) -> list[Photo]:
    """The owner's own test photographs: `folder/<category>/<file>`. The
    folder's name is the truth, so these are the only photographs here
    whose right answer is known for certain (step B6)."""
    out = []
    for sub in sorted(p for p in folder.iterdir() if p.is_dir()):
        if sub.name not in known:
            sys.exit(f"{sub}: not a category ({', '.join(sorted(known))})")
        for f in sorted(sub.iterdir()):
            if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".heic", ".webp"}:
                out.append(Photo(f"extra:{sub.name}/{f.name}", f.resolve().as_uri(), f"(test) {sub.name}",
                                 [sub.name], truth=sub.name))
    return out


def load_image(photo: Photo, cache: Path):
    from PIL import Image  # noqa: PLC0415 — not needed by the fake model
    if photo.uri.startswith("file:"):
        path = Path(urllib.request.url2pathname(urllib.parse.urlparse(photo.uri).path))
    else:
        path = cache / "images" / (hashlib.sha1(photo.uri.encode()).hexdigest() + ".img")
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            req = urllib.request.Request(photo.uri, headers={"User-Agent": "citycrew-photo-eval"})
            with urllib.request.urlopen(req, timeout=60) as r:
                path.write_bytes(r.read())
    if path.suffix.lower() == ".heic":
        try:
            import pillow_heif  # noqa: PLC0415
            pillow_heif.register_heif_opener()
        except ImportError:
            sys.exit("HEIC test photos need `pip install pillow-heif`, or export them as JPEG")
    return Image.open(path).convert("RGB")


class VectorCache:
    """Each catalog photograph's image vector, per model, one JSON line
    each. The first full run took 1 h 28 min on the owner's Mac, nearly all
    of it in reading 6,211 photographs; the sentences, the rule and its
    thresholds are what change between runs, and with the vectors kept a
    run that changes only those takes seconds. Appended and flushed per
    photograph, so a run stopped halfway keeps what it read, and a line cut
    short by the stop is skipped on the next read.

    Keyed by the photograph's address, as `load_image` keys the file: a
    replaced photograph has a new address. The owner's test photographs
    are not kept here, since a file can change under the same path and
    there are only tens of them."""

    def __init__(self, path: Path):
        self.path = path
        self.known: dict[str, list[float]] = {}
        self.file = None
        if path.exists():
            for line in path.read_text().splitlines():
                try:
                    key, vec = json.loads(line)
                except ValueError:
                    continue
                self.known[key] = vec

    @staticmethod
    def key(photo: Photo) -> str:
        return hashlib.sha1(photo.uri.encode()).hexdigest()

    def get(self, photo: Photo) -> list[float] | None:
        return self.known.get(self.key(photo))

    def put(self, photo: Photo, vec: list[float]) -> None:
        if self.file is None:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.file = self.path.open("a")
        # Six places: the margins that decide a verdict are thousandths.
        rounded = [round(x, 6) for x in vec]
        self.file.write(json.dumps([self.key(photo), rounded]) + "\n")
        self.file.flush()
        self.known[self.key(photo)] = rounded


# ── models ────────────────────────────────────────────────────────────

class FakeModel:
    """Deterministic vectors from a hash, so everything but the model can
    be run where no model can be downloaded. Its numbers mean nothing."""
    name = "fake"

    def _vec(self, s: str) -> list[float]:
        h = hashlib.sha256(s.encode()).digest()
        v = [b / 255 - 0.5 for b in h]
        n = math.sqrt(sum(x * x for x in v))
        return [x / n for x in v]

    def texts(self, texts: list[str]) -> list[list[float]]:
        return [self._vec(t) for t in texts]

    def image(self, photo: Photo, _cache: Path) -> list[float]:
        return self._vec(photo.id)


def features(out):
    """The projected embedding out of `get_text_features` /
    `get_image_features`. transformers 4 returns it as a tensor;
    transformers 5 returns a `BaseModelOutputWithPooling` holding it in
    `pooler_output` (the owner's first run on the Mac, 16 Oct 2026, failed
    on exactly that). Both are taken, so the version pip picks is not this
    script's business."""
    if hasattr(out, "norm"):
        return out
    for name in ("text_embeds", "image_embeds", "pooler_output"):
        value = getattr(out, name, None)
        if value is not None:
            return value
    raise TypeError(f"no embedding in a {type(out).__name__}")


def unit(t) -> list[list[float]]:
    return (t / t.norm(dim=-1, keepdim=True)).cpu().tolist()


class HFModel:
    def __init__(self, name: str):
        import torch  # noqa: PLC0415
        from transformers import AutoModel, AutoProcessor  # noqa: PLC0415
        self.torch = torch
        self.name = name
        self.id = MODELS[name]
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"
        self.model = AutoModel.from_pretrained(self.id).to(self.device).eval()
        self.proc = AutoProcessor.from_pretrained(self.id)

    def _norm(self, out):
        return unit(features(out))

    def texts(self, texts: list[str]) -> list[list[float]]:
        # SigLIP was trained on text padded to 64 tokens and reads others
        # worse; CLIP pads to the longest.
        kw = {"padding": "max_length", "max_length": 64} if self.name == "siglip2" else {"padding": True}
        inputs = self.proc(text=texts, return_tensors="pt", **kw).to(self.device)
        with self.torch.no_grad():
            return self._norm(self.model.get_text_features(**inputs))

    def image(self, photo: Photo, cache: Path) -> list[float]:
        inputs = self.proc(images=load_image(photo, cache), return_tensors="pt").to(self.device)
        with self.torch.no_grad():
            return self._norm(self.model.get_image_features(**inputs))[0]


# ── judging ───────────────────────────────────────────────────────────

def dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


@dataclass
class Reading:
    photo: Photo
    by_group: dict[str, float]      # best similarity per category, `_off` and `_neutral`
    ranked: list[str]               # categories and `_off`, best first; `_neutral` left out
    margin: float | None            # best of the place's own minus best of the rest
    verdict: str                    # fit | unclear | off
    vision_fit: bool | None         # the baseline, where Vision has labels


def read_photo(photo: Photo, img: list[float], groups: dict[str, list[list[float]]],
               fit_margin: float, off_margin: float) -> Reading:
    # `zip` would quietly compare the first n numbers of two vectors of
    # different lengths and every score after it would be noise.
    width = len(next(iter(groups.values()))[0])
    if len(img) != width:
        raise ValueError(f"image vector has {len(img)} numbers, text vectors {width}")
    by_group = {g: max(dot(img, t) for t in vecs) for g, vecs in groups.items()}
    ranked = sorted((g for g in by_group if g != "_neutral"), key=lambda g: -by_group[g])
    own = [by_group[c] for c in photo.categories if c in by_group]
    others = [v for g, v in by_group.items() if g not in photo.categories and g != "_neutral"]
    margin = (max(own) - max(others)) if own and others else None
    # A menu or a sign is neither for nor against a place: when it is the
    # best match, the photograph is not judged at all.
    if margin is None or ranked and by_group.get("_neutral", -1) > by_group[ranked[0]]:
        verdict = "unclear"
    elif margin >= fit_margin:
        verdict = "fit"
    # Second or third is not off-topic. The first full run (16 Oct 2026)
    # judged by the margin alone and called 791 of 6,211 photographs off
    # while only 327 had their place's category outside the top three: a
    # cafe's cake that scored `eats` a hair above `cafes` was off-topic,
    # and so were 132 covers. A neighbouring category is a reason to look,
    # not a verdict.
    elif set(photo.categories) & set(ranked[:3]):
        verdict = "unclear"
    elif ranked[0] == "_off" or margin <= -off_margin:
        verdict = "off"
    else:
        verdict = "unclear"
    return Reading(photo, by_group, ranked, margin, verdict, vision_fit(photo))


def vision_fit(photo: Photo) -> bool | None:
    if not photo.labels:
        return None
    seen = {lab["id"] for lab in photo.labels if lab.get("p", 0) >= VISION_P}
    return any(seen & set(VISION_EXPECT.get(c, "").split()) for c in photo.categories)


# ── report ────────────────────────────────────────────────────────────

def summarise(readings: list[Reading]) -> dict:
    cat = [r for r in readings if r.photo.truth is None]
    extra = [r for r in readings if r.photo.truth is not None]
    s: dict = {"catalog": len(cat), "extra": len(extra)}
    if cat:
        s["top1"] = sum(r.ranked[0] in r.photo.categories for r in cat) / len(cat)
        s["top3"] = sum(bool(set(r.ranked[:3]) & set(r.photo.categories)) for r in cat) / len(cat)
        s["verdicts"] = dict(Counter(r.verdict for r in cat))
        s["covers"] = sum(r.photo.cover for r in cat)
        s["covers_off"] = sum(r.photo.cover and r.verdict == "off" for r in cat)
        based = [r for r in cat if r.vision_fit is not None]
        s["vision_scored"] = len(based)
        s["vision_fit"] = sum(r.vision_fit for r in based)
        s["model_fit_where_vision_scored"] = sum(r.verdict == "fit" for r in based)
        # Single-category places only: with two categories the "truth" is
        # either, and a confusion row would count one photo twice.
        conf: dict[str, Counter] = defaultdict(Counter)
        for r in cat:
            if len(r.photo.categories) == 1:
                conf[r.photo.categories[0]][r.ranked[0]] += 1
        s["confusion"] = {k: dict(v) for k, v in sorted(conf.items())}
    if extra:
        per: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0])
        for r in extra:
            row = per[r.photo.truth]
            row[0] += 1
            row[1] += r.ranked[0] == r.photo.truth
            row[2] += r.photo.truth in r.ranked[:3]
        s["extra_by_category"] = {k: {"n": n, "top1": a, "top3": b} for k, (n, a, b) in sorted(per.items())}
    return s


def write_csv(readings: list[Reading], groups: list[str], path: Path) -> None:
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["photo_id", "place", "categories", "cover", "truth", "top1", "top2", "top3",
                    "margin", "verdict", "vision_fit", *groups])
        for r in readings:
            p = r.photo
            w.writerow([p.id, p.slug, " ".join(p.categories), int(p.cover), p.truth or "",
                        *(r.ranked + ["", "", ""])[:3],
                        "" if r.margin is None else f"{r.margin:.4f}", r.verdict,
                        "" if r.vision_fit is None else int(r.vision_fit),
                        *(f"{r.by_group[g]:.4f}" for g in groups)])


# The owner marks a photograph Hợp / Chưa rõ / Lạc đề under it, and the
# marks are copied out of the page: the first answers about the catalog
# that a person gave rather than a rule (steps B5 and B7). Kept in the
# browser only so that a reload does not lose them.
MARKS_SCRIPT = """<script>
const KEY='photo-fit-marks';let marks={};try{marks=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
function show(){document.querySelectorAll('figure').forEach(f=>f.querySelectorAll('.pick button')
 .forEach(b=>b.classList.toggle('on',marks[f.dataset.id]?.owner===b.dataset.v)));
 document.getElementById('marks').value=JSON.stringify(marks)}
document.addEventListener('click',e=>{const b=e.target.closest('.pick button');if(!b)return;
 const f=b.closest('figure');marks[f.dataset.id]={place:f.dataset.slug,owner:b.dataset.v,model:f.dataset.verdict};
 try{localStorage.setItem(KEY,JSON.stringify(marks))}catch(e){}show()});
document.getElementById('copy').onclick=()=>navigator.clipboard.writeText(document.getElementById('marks').value);
show();
</script>"""


def sampled(rows: list, n: int, rng) -> list:
    """`n` of them at random, or all when `n` is 0. A page of all 6,211
    photographs is one nobody reads to the end, and the end is where the
    rarer kinds of mistake sit; a few of each kind, read through, is what
    a person can check."""
    return rows if n <= 0 or len(rows) <= n else rng.sample(rows, n)


def confusions(cat: list[Reading], top: int) -> list[tuple[str, str, list[Reading]]]:
    """The most frequent (place's category, model's first choice) pairs that
    disagree, among single-category places: the mistakes worth a look."""
    pairs: dict[tuple[str, str], list[Reading]] = defaultdict(list)
    for r in cat:
        if len(r.photo.categories) == 1 and r.ranked[0] != r.photo.categories[0]:
            pairs[(r.photo.categories[0], r.ranked[0])].append(r)
    best = sorted(pairs.items(), key=lambda kv: -len(kv[1]))[:top]
    return [(own, guess, rows) for (own, guess), rows in best]


def write_html(readings: list[Reading], summary: dict, model: str, path: Path,
               sample: int = 0, seed: int = 1) -> None:
    e = html.escape
    rng = random.Random(seed)

    def card(r: Reading) -> str:
        p = r.photo
        top = " · ".join(f"<span class={'own' if g in p.categories else 'g'}>{e(g)} {r.by_group[g]:.3f}</span>"
                         for g in r.ranked[:3])
        marks = []
        if p.cover:
            marks.append("<b class=cover>BÌA</b>")
        if r.vision_fit is False:
            marks.append("<b class=vis>Vision: lệch</b>")
        if p.truth and r.ranked[0] != p.truth:
            marks.append("<b class=vis>sai</b>")
        m = "—" if r.margin is None else f"{r.margin:+.3f}"
        pick = "".join(f"<button data-v={v}>{t}</button>"
                       for v, t in (("fit", "Hợp"), ("unclear", "Chưa rõ"), ("off", "Lạc đề")))
        return (f"<figure class={r.verdict} data-id='{e(p.id)}' data-slug='{e(p.slug)}' data-verdict={r.verdict}>"
                f"<img loading=lazy src='{e(p.uri)}'><figcaption><b>{e(p.slug)}</b> {' '.join(marks)}<br>"
                f"mong đợi: <span class=own>{e(', '.join(p.categories) or '—')}</span><br>"
                f"đoán: {top}<br>chênh {m} → <b>{r.verdict}</b>"
                f"<div class=pick>{pick}</div></figcaption></figure>")

    def section(title: str, rows: list[Reading]) -> str:
        if not rows:
            return ""
        shown = sorted(sampled(rows, sample, rng), key=lambda r: (r.margin is None, r.margin or 0))
        count = f"{len(shown)} / {len(rows)}" if len(shown) < len(rows) else f"{len(rows)}"
        return f"<h2>{e(title)} ({count})</h2><div class=grid>{''.join(card(r) for r in shown)}</div>"

    cat = [r for r in readings if r.photo.truth is None]
    extra = [r for r in readings if r.photo.truth is not None]
    body = (
        f"<h1>Photo fit — {e(model)}</h1><pre>{e(json.dumps(summary, indent=2, ensure_ascii=False))}</pre>"
        + section("Ảnh thử của chủ sản phẩm", extra)
        # Covers first: a cover called off-topic is the one mistake B7
        # allows none of.
        + section("Ảnh bìa bị coi là lạc đề", [r for r in cat if r.verdict == "off" and r.photo.cover])
        + section("Có vẻ lạc đề", [r for r in cat if r.verdict == "off" and not r.photo.cover])
        + section("Chưa rõ", [r for r in cat if r.verdict == "unclear"])
        + "".join(section(f"Địa điểm {own}, mô hình đoán {guess}", rows) for own, guess, rows in confusions(cat, 5))
        + section("Vision cho là lệch, mô hình cho là hợp", [r for r in cat if r.vision_fit is False and r.verdict == "fit"])
        + section("Hợp", [r for r in cat if r.verdict == "fit"])
        + "<h2>Đánh giá của anh</h2><p>Bấm Hợp / Chưa rõ / Lạc đề dưới mỗi ảnh, rồi Copy khung này gửi lại.</p>"
        "<textarea id=marks rows=6 readonly></textarea><button id=copy>Copy</button>"
    )
    path.write_text(
        "<!doctype html><meta charset=utf-8><title>Photo fit</title><style>"
        "body{font:14px system-ui;margin:16px;background:#111;color:#eee}"
        ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}"
        "figure{margin:0;background:#1d1d1d;border-radius:8px;overflow:hidden;border:2px solid #333}"
        "figure.off{border-color:#d55}figure.unclear{border-color:#c93}figure.fit{border-color:#3a6}"
        "img{width:100%;aspect-ratio:1;object-fit:cover;display:block}figcaption{padding:8px;line-height:1.5}"
        ".own{color:#7d7;font-weight:600}b.cover{color:#fc6}b.vis{color:#f88}"
        ".pick button{margin:6px 4px 0 0;padding:4px 8px;border-radius:6px;border:1px solid #555;background:#222;color:#eee}"
        ".pick button.on{background:#2b5;border-color:#2b5;color:#000}"
        "pre,textarea{background:#1d1d1d;color:#eee;padding:12px;width:100%;box-sizing:border-box}"
        "</style>" + body + MARKS_SCRIPT)



# ── main ──────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--model", choices=[*MODELS, "fake"], default="siglip2")
    ap.add_argument("--supabase-url", default=os.environ.get("SUPABASE_URL", SUPABASE_URL))
    ap.add_argument("--supabase-key", default=os.environ.get("SUPABASE_KEY", SUPABASE_KEY),
                    help="the publishable key; the app's by default")
    ap.add_argument("--photos-json", type=Path, help="read photographs from a file instead of the API")
    ap.add_argument("--extra", type=Path, help="test photographs in <dir>/<category>/<file>")
    ap.add_argument("--limit", type=int, help="the first N catalog photographs only")
    ap.add_argument("--fit-margin", type=float, default=0.0,
                    help="own category ahead of every other by at least this: fit")
    ap.add_argument("--off-margin", type=float, default=0.02,
                    help="own category outside the top three, and another ahead by more than this "
                         "or the off-topic sentences first: off")
    ap.add_argument("--sample", type=int, default=12,
                    help="photographs per section of the HTML page, at random; 0 for all")
    ap.add_argument("--seed", type=int, default=1, help="which random sample")
    ap.add_argument("--out", type=Path, default=HERE / "out")
    a = ap.parse_args()

    prompts = json.loads((HERE / "prompts.json").read_text())
    known = set(prompts["categories"])
    if a.photos_json:
        photos = [Photo(**p) for p in json.loads(a.photos_json.read_text())]
    else:
        photos = fetch_catalog(a.supabase_url.rstrip("/"), a.supabase_key, a.limit)
    if a.extra:
        photos += extra_photos(a.extra, known)

    model = FakeModel() if a.model == "fake" else HFModel(a.model)
    groups_src = {**prompts["categories"], "_off": prompts["offTopic"], "_neutral": prompts["neutral"]}
    groups = {g: model.texts(list(s)) for g, s in groups_src.items()}

    a.out.mkdir(parents=True, exist_ok=True)
    cache = a.out / "cache"
    vectors = VectorCache(cache / f"vectors-{model.name}.jsonl")
    readings = []
    for i, p in enumerate(photos, 1):
        img = None if p.truth else vectors.get(p)
        if img is None:
            try:
                img = model.image(p, cache)
            except Exception as err:  # noqa: BLE001 — one dead link is no reason to stop
                print(f"skip {p.id}: {err}", file=sys.stderr)
                continue
            if not p.truth:
                vectors.put(p, img)
        readings.append(read_photo(p, img, groups, a.fit_margin, a.off_margin))
        if i % 50 == 0:
            print(f"{i}/{len(photos)}", file=sys.stderr)

    summary = summarise(readings)
    stem = a.out / f"photo-fit-{model.name}"
    write_csv(readings, list(groups), stem.with_suffix(".csv"))
    write_html(readings, summary, model.name, stem.with_suffix(".html"), a.sample, a.seed)
    (stem.with_suffix(".json")).write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"\n→ {stem.with_suffix('.html')}")


if __name__ == "__main__":
    main()
