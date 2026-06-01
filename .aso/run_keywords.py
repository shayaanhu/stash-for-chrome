"""Drives the ASO skill's KeywordAnalyzer for the Chrome tab-manager category.

Volume/competition figures are grounded estimates for Chrome Web Store search in
the tab-manager space (no official CWS keyword API exists). Relevance is how well
the term matches what Stash actually does. competing_apps ~= extensions surfacing
for the term."""

import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".claude", "skills", "skills", "app-store-optimization"))
from keyword_analyzer import KeywordAnalyzer  # noqa: E402

# keyword, est monthly searches, competing extensions, relevance(0-1)
DATA = [
    ("tab manager",            40000, 3000, 1.00),
    ("save tabs",              18000, 1800, 1.00),
    ("tab organizer",          12000, 1400, 0.97),
    ("onetab alternative",      2600,  140, 1.00),
    ("save all tabs",           6000,  650, 1.00),
    ("save chrome tabs",        4800,  420, 1.00),
    ("tab saver",               5200,  600, 0.97),
    ("session manager",         9000, 1300, 0.85),
    ("restore tabs",            5000,  700, 0.92),
    ("tab session manager",     3200,  350, 0.95),
    ("close tabs",              4200,  520, 0.72),
    ("too many tabs",           3000,  180, 0.90),
    ("declutter tabs",           900,   70, 0.92),
    ("tab groups",             30000, 2400, 0.58),
    ("bookmark manager",       26000, 4200, 0.48),
    ("tab memory saver",        8000,  900, 0.55),
    ("save browser session",    2200,  240, 0.95),
    ("organize tabs",           7000,  820, 0.94),
]

keywords = [
    {"keyword": k, "search_volume": v, "competing_apps": c, "relevance_score": r}
    for (k, v, c, r) in DATA
]

report = KeywordAnalyzer().compare_keywords(keywords)

def row(kw):
    return f"  {kw['potential_score']:5.1f}  diff {kw['difficulty_score']:5.1f}  rel {kw['relevance_score']:.2f}  {kw['keyword']}  ->  {kw['recommendation']}"

print("=== RANKED (by potential score) ===")
for kw in report["ranked_keywords"]:
    print(row(kw))

print("\n=== PRIMARY (title-worthy) ===")
for kw in report["primary_keywords"]:
    print("  " + kw["keyword"])

print("\n=== SECONDARY (description body) ===")
for kw in report["secondary_keywords"]:
    print("  " + kw["keyword"])

print("\n=== LONG-TAIL ===")
for kw in report["long_tail_keywords"]:
    print("  " + kw["keyword"])

print("\nSUMMARY:", report["summary"])
