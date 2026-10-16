"""The judging and the vector cache of eval.py, without a model or a network.

Run by `data/test/photo-eval-python.test.mjs`, so `npm test` in `data/`
and CI run it. A one-number vector per sentence makes `dot` return that
number, so each case states its scores outright.
"""

import random
import tempfile
import unittest
from pathlib import Path

import eval as ev

CATS = ["cafes", "eats", "nightlife", "views", "markets"]


def reading(scores: dict[str, float], categories: list[str], off_margin: float = 0.02,
            off_rank: int = 3, pid: str = "p", cover: bool = False) -> ev.Reading:
    groups = {g: [[scores.get(g, 0.0)]] for g in [*CATS, "_off", "_neutral"]}
    photo = ev.Photo(pid, "https://example.test/p.jpg", "place", categories, cover)
    return ev.read_photo(photo, [1.0], groups, 0.0, off_margin, off_rank)


def judge(scores: dict[str, float], categories: list[str], off_margin: float = 0.02,
          off_rank: int = 3) -> str:
    return reading(scores, categories, off_margin, off_rank).verdict


class Verdict(unittest.TestCase):
    def test_first_choice_fits(self):
        self.assertEqual(judge({"cafes": 0.30, "eats": 0.20}, ["cafes"]), "fit")

    # The case that turned 132 covers off-topic: second by a clear margin
    # is a reason to look, not off-topic.
    def test_second_is_unclear_however_far_behind(self):
        self.assertEqual(judge({"eats": 0.30, "cafes": 0.20}, ["cafes"]), "unclear")

    def test_third_is_unclear(self):
        self.assertEqual(judge({"eats": 0.30, "nightlife": 0.29, "cafes": 0.20}, ["cafes"]), "unclear")

    def test_outside_the_top_three_and_well_behind_is_off(self):
        s = {"eats": 0.30, "nightlife": 0.29, "views": 0.28, "cafes": 0.20}
        self.assertEqual(judge(s, ["cafes"]), "off")

    def test_outside_the_top_three_but_close_is_unclear(self):
        s = {"eats": 0.300, "nightlife": 0.299, "views": 0.298, "cafes": 0.290}
        self.assertEqual(judge(s, ["cafes"]), "unclear")

    def test_off_topic_sentences_first_and_category_outside_top_three_is_off(self):
        s = {"_off": 0.300, "eats": 0.299, "nightlife": 0.298, "cafes": 0.295}
        self.assertEqual(judge(s, ["cafes"]), "off")

    def test_either_of_two_categories_counts(self):
        s = {"eats": 0.30, "nightlife": 0.29, "views": 0.28, "markets": 0.27, "cafes": 0.26}
        self.assertEqual(judge(s, ["cafes", "nightlife"]), "unclear")

    def test_a_menu_is_not_judged(self):
        self.assertEqual(judge({"_neutral": 0.40, "eats": 0.30, "cafes": 0.10}, ["cafes"]), "unclear")


    def test_a_tighter_rank_calls_second_place_off(self):
        s = {"eats": 0.30, "cafes": 0.20}
        self.assertEqual(judge(s, ["cafes"], off_rank=1), "off")
        self.assertEqual(judge(s, ["cafes"], off_rank=2), "unclear")


class Calibration(unittest.TestCase):
    # Marked: one the owner calls off, sitting second; a cover the owner
    # calls off, far down (a finding, not an error); a cover the owner calls
    # fitting, sitting second; one marked Chưa rõ, far down, which no figure
    # but the catalog's may count. And one nobody marked.
    def setUp(self):
        second = {"eats": 0.30, "cafes": 0.20}
        far = {"eats": 0.30, "nightlife": 0.29, "views": 0.28, "cafes": 0.10}
        self.readings = [reading(second, ["cafes"], pid="a"), reading(far, ["cafes"], pid="b", cover=True),
                         reading(second, ["cafes"], pid="c", cover=True),
                         reading(far, ["cafes"], pid="unclear"), reading(far, ["cafes"], pid="unmarked")]
        self.marks = {"a": {"owner": "off"}, "b": {"owner": "off"}, "c": {"owner": "fit"},
                      "unclear": {"owner": "unclear"}}

    def row(self, rank, margin):
        rows = ev.calibrate(self.readings, self.marks, 0.0)
        return next(r for r in rows if r["off_rank"] == rank and r["off_margin"] == margin)

    def test_top_three_catches_only_the_far_one(self):
        r = self.row(3, 0.02)
        self.assertEqual((r["off_precision"], r["off_recall"]), (1.0, 0.5))
        self.assertEqual(r["covers_fit_called_off"], 0)
        self.assertEqual((r["catalog_off"], r["catalog_covers_off"]), (3, 1))

    def test_rank_one_catches_both_and_wrongs_the_cover(self):
        r = self.row(1, 0.02)
        self.assertEqual((r["off_precision"], r["off_recall"]), (round(2 / 3, 3), 1.0))
        self.assertEqual(r["covers_fit_called_off"], 1)
        self.assertEqual((r["catalog_off"], r["catalog_covers_off"]), (5, 2))

    def test_every_threshold_pair_is_tried(self):
        rows = ev.calibrate(self.readings, self.marks, 0.0)
        self.assertEqual(len(rows), len(ev.CALIBRATION_RANKS) * len(ev.CALIBRATION_MARGINS))

    def test_the_table_has_a_line_a_rule(self):
        rows = ev.calibrate(self.readings, self.marks, 0.0)
        self.assertEqual(len(ev.calibration_table(rows).splitlines()), len(rows) + 1)


class Cache(unittest.TestCase):
    def test_vectors_survive_a_reopen_and_a_line_cut_short(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "cache" / "vectors-x.jsonl"
            a = ev.Photo("a", "https://example.test/a.jpg", "s", ["cafes"])
            b = ev.Photo("b", "https://example.test/b.jpg", "s", ["cafes"])
            first = ev.VectorCache(path)
            first.put(a, [0.1234567, -0.5])
            first.file.close()
            with path.open("a") as f:
                f.write('["cut short", [0.1')  # a run stopped mid-write
            again = ev.VectorCache(path)
            self.assertEqual(again.get(a), [0.123457, -0.5])
            self.assertIsNone(again.get(b))
            self.assertEqual(len(again.known), 1)

    def test_a_new_address_is_a_new_photograph(self):
        a = ev.Photo("a", "https://example.test/a.jpg", "s", [])
        moved = ev.Photo("a", "https://example.test/a2.jpg", "s", [])
        self.assertNotEqual(ev.VectorCache.key(a), ev.VectorCache.key(moved))


class Page(unittest.TestCase):
    def test_a_sample_is_bounded_and_zero_means_all(self):
        rows = list(range(10))
        self.assertEqual(len(ev.sampled(rows, 3, random.Random(1))), 3)
        self.assertEqual(ev.sampled(rows, 0, random.Random(1)), rows)
        self.assertEqual(ev.sampled(rows, 20, random.Random(1)), rows)

    def test_confusions_are_single_category_disagreements_most_frequent_first(self):
        def r(cats, first):
            return ev.Reading(ev.Photo("p", "u", "s", cats), {}, [first], None, "unclear", None)
        rows = [r(["cafes"], "eats")] * 3 + [r(["cafes"], "markets")] + [r(["cafes"], "cafes")] \
            + [r(["cafes", "eats"], "views")] * 5
        got = [(own, guess, len(rs)) for own, guess, rs in ev.confusions(rows, 5)]
        self.assertEqual(got, [("cafes", "eats", 3), ("cafes", "markets", 1)])


if __name__ == "__main__":
    unittest.main()
