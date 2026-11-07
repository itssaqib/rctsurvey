"""Split one enumerator's list over two logins (a second WhatsApp number), e.g. ENU06 -> ENU06 + ENU06B.

    python split_login.py ENU06 ENU06B      split: run update.py before (fresh statuses) and after (publish)
    python split_login.py --undo ENU06B     put everyone in ENU06B back under ENU06 and remove the login

Only untouched people move to the new login: main survey never opened, no survey response of any kind,
no call or WhatsApp logged, no tags, not in a team list (same person, new number, contact again). At
most half of the list moves (chosen at random with a fixed seed); everyone with any history stays with
the first login. The moved IDs are saved in state/split_<new login>.csv, people.csv is backed up first.
Afterwards update.py treats the pair as one enumerator (config "split"): new people go to the login with
fewer people, and the two logins share one target.
"""
import json
import os
import random
import shutil
import sys
from datetime import datetime

import pandas as pd

import update as u

CFG_PATH = u.P("config.json")


def save_config(cfg):
    with open(CFG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
        f.write("\n")


def save_state(state):
    shutil.copy(u.STATE, u.STATE.replace(".csv", f"_backup_{datetime.now():%Y%m%d_%H%M%S}.csv"))
    state[u.STATE_COLS].to_csv(u.STATE, index=False, encoding="utf-8-sig")


def split(parent, child):
    cfg = json.load(open(CFG_PATH, encoding="utf-8"))
    if parent not in cfg["enumerators"] or parent in cfg.get("split", {}):
        sys.exit(f"{parent} is not a first login in config.json")
    if child in cfg["enumerators"] or child in ("PAY", "ADMIN"):
        sys.exit(f"{child} already exists")
    sec = json.load(open(u.P("secrets", "passphrases.json"), encoding="utf-8"))
    adm = u.decrypt(json.load(open(u.P("docs", "data", "ADMIN.json.enc"))), sec["ADMIN"]["passphrase"])
    print(f"Statuses from the last update ({adm['generated']}).")

    answered = set(pd.read_csv(u.LINKS, dtype=str, keep_default_na=False).participant_id) if os.path.exists(u.LINKS) else set()
    listed = set()
    for path, cols in ((u.SAME, ["keep_id", "other_id", "date", "note"]),
                       (u.NUMBERS, ["participant_id", "new_phone", "date", "note"]),
                       (u.REOPEN, ["participant_id", "date", "note"])):
        t = u.read_team_list(path, cols)
        listed |= {x.strip() for c in ("keep_id", "other_id", "participant_id") if c in t for x in t[c]}
    mine = [p for p in adm["people"] if p["enumerator"] == parent]
    fresh = sorted(p["pid"] for p in mine
                   if p["main_status"] == "not_started" and not p["calls"] and not p["tags"]
                   and p["pid"] not in answered and p["pid"] not in listed
                   and not p["old_phone"] and not p.get("other_phones"))
    n = min(len(fresh), len(mine) // 2)
    move = sorted(random.Random(f"{parent}-{child}").sample(fresh, n))

    state = pd.read_csv(u.STATE, dtype=str, keep_default_na=False)
    rows = state.participant_id.isin(move)
    if rows.sum() != len(move) or (state.loc[rows, "enumerator"] != parent).any():
        sys.exit("people.csv does not match the last update: run update.py first")

    # config first: a new login without people is harmless if anything below fails
    cfg["enumerators"].insert(cfg["enumerators"].index(parent) + 1, child)
    cfg.setdefault("split", {})[child] = parent
    save_config(cfg)
    state.loc[rows, "enumerator"] = child
    save_state(state)
    pd.DataFrame({"participant_id": move, "from_login": parent, "to_login": child,
                  "date": u.TODAY.isoformat()}).to_csv(u.P("state", f"split_{child}.csv"), index=False, encoding="utf-8-sig")

    print(f"{parent}: {len(mine)} people, {len(fresh)} untouched. Moved {len(move)} untouched to {child};"
          f" {len(mine) - len(move)} stay with {parent}. List: state/split_{child}.csv")
    print("Next: run update.py (it makes the new login's passphrase), paste secrets/apps_script_tokens.json into the"
          " Apps Script property TOKENS, give the new passphrase privately, then commit and push.")


def undo(child):
    cfg = json.load(open(CFG_PATH, encoding="utf-8"))
    parent = cfg.get("split", {}).get(child)
    if not parent:
        sys.exit(f"{child} is not a split login in config.json")
    state = pd.read_csv(u.STATE, dtype=str, keep_default_na=False)
    rows = state.enumerator == child
    state.loc[rows, "enumerator"] = parent
    save_state(state)
    cfg["enumerators"].remove(child)
    del cfg["split"][child]
    if not cfg["split"]:
        del cfg["split"]
    save_config(cfg)
    data = u.P("docs", "data", f"{child}.json.enc")
    if os.path.exists(data):
        os.remove(data)
    print(f"Moved {int(rows.sum())} people from {child} back to {parent} and removed the login."
          " Next: run update.py, then commit and push (git add -A docs).")


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) == 2 and a[0] == "--undo":
        undo(a[1])
    elif len(a) == 2 and not a[0].startswith("-"):
        split(*a)
    else:
        sys.exit(__doc__)
