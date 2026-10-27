"""SUNNI-SHIA RCT - fieldwork tracker update.

Run:   python update.py            (from the tracker folder)
Reads: inputs/*  (Qualtrics exports: registration, main survey recorded + in
       progress, 2-week and 4-week follow-ups) and the call log.
Keeps: state/people.csv  (phone -> participant_id + enumerator; never renumbered)
Writes docs/data/<CODE>.json.enc  (one encrypted file per enumerator + ADMIN)
       state/last_run.txt         (summary)
New people are assigned automatically to the enumerator with the fewest people.
"""
import base64
import glob
import json
import os
import re
import secrets
import shutil
import sys
import urllib.request
from datetime import date, datetime, timedelta

import pandas as pd
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, "config.json"), encoding="utf-8"))
ENUS = CFG["enumerators"]
TODAY = date.today()
P = lambda *a: os.path.join(HERE, *a)
STATE = P("state", "people.csv")
STATE_COLS = ["phone", "participant_id", "enumerator", "first_seen", "source",
              "name", "gender", "age", "province", "district", "city"]
PBKDF2_ITER = 200_000


# ============================================================ helpers
VALID_PREFIX = {f"03{i:02d}" for i in range(80)}


def clean_phone(raw):
    """03XXXXXXXXX or None (same rules as the master-file pipeline)."""
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return None
    s = str(raw).strip()
    if not s or s.lower() == "nan":
        return None
    s = s.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹"
                                  "٠١٢٣٤٥٦٧٨٩",
                                  "01234567890123456789"))
    if re.fullmatch(r"\d+\.0", s):
        s = s[:-2]
    s = s.replace("O", "0").replace("o", "0")
    s = re.sub(r"(?<=\d)[lI](?=\d)", "1", s)
    parts = [p for p in re.split(r"[,/;]|\bor\b|\band\b", s) if re.search(r"\d", p)]
    if not parts:
        return None
    d = re.sub(r"\D", "", parts[0])
    if d.startswith("0092"):
        d = d[4:]
    elif d.startswith("00"):
        d = d[2:]
    elif d.startswith("92") and len(d) >= 12:
        d = d[2:]
    if d.startswith("3") and len(d) >= 10:
        d = "0" + d
    if d.startswith("003"):
        d = d[1:]
    if len(d) > 11 and d.startswith("03"):
        d = d[:11]
    return d if len(d) == 11 and d[:4] in VALID_PREFIX else None


def luhn_digit(base):
    t = 0
    for i, ch in enumerate(reversed(base)):
        x = int(ch)
        if i % 2 == 0:
            x *= 2
            if x > 9:
                x -= 9
        t += x
    return str((10 - t % 10) % 10)


def eng(v):
    """'مرد (Male)' -> 'Male'."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    v = str(v).strip()
    m = re.search(r"\(([^()]*)\)\s*$", v)
    return m.group(1).strip() if m else v


def tidy(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    v = re.sub(r"\s+", " ", str(v)).strip()
    return v.title() if v.isascii() else v


def val(row, col):
    v = row.get(col) if hasattr(row, "get") else None
    return None if v is None or (isinstance(v, float) and pd.isna(v)) or str(v).strip() == "" else str(v).strip()


def to_dt(v):
    try:
        return pd.to_datetime(v, format="mixed")
    except (ValueError, TypeError):
        return pd.NaT


def read_export(path):
    """Qualtrics export -> data rows. CSV has 3 header rows, xlsx 2 (row 2 = question text)."""
    if path.lower().endswith(".csv"):
        df = pd.read_csv(path, dtype=str, encoding="utf-8-sig")
    else:
        df = pd.read_excel(path, dtype=str)
    skip = 1
    if len(df) > 1 and str(df.iloc[1, 0]).startswith('{"ImportId"'):
        skip = 2
    df = df.iloc[skip:].reset_index(drop=True)
    if "Status" in df:
        df = df[~df.Status.isin(["Survey Preview", "Survey Test", "Spam", "Imported"])]
    return df


def kind_of(df, name):
    cols = set(df.columns)
    if "fu_mobile" in cols:
        if "wave" in cols and df.wave.dropna().astype(str).str.strip().isin(["2", "4"]).any():
            return "fu" + df.wave.dropna().astype(str).str.strip().mode().iloc[0]
        return "fu4" if "4week" in name.replace(" ", "").lower() else "fu2"
    if "b_trust_own" in cols or "pv_trust_opp" in cols:
        return "main"
    if "mobile_whatsapp" in cols:
        return "reg"
    return None


# ============================================================ passphrases
WORDS = ("apple river stone cloud mango tiger lemon green bread chair horse light paper water ocean"
         " sugar candle silver garden pencil rocket window market bottle castle forest jacket ladder"
         " mirror needle orange parrot pepper pillow planet rabbit saddle shadow spider summer table"
         " tomato tunnel wallet winter yellow anchor basket bridge camera cotton desert dragon engine"
         " falcon finger flower guitar hammer island kettle lizard magnet meadow monkey number pocket"
         " puzzle rainbow saturn sparrow statue thunder ticket turtle velvet violet walnut whistle zebra"
         " button cherry cookie copper dolphin feather galaxy ginger harbor helmet lantern melon nectar"
         " olive pebble pirate quartz ribbon rubber salmon spoon tulip umbrella valley wagon yogurt").split()


def make_secrets():
    """One passphrase + log token per login (ENU01..ENU10, ADMIN, PAY). Existing ones never change;
    a missing login (e.g. PAY added later) gets a new one."""
    path = P("secrets", "passphrases.json")
    out = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    rnd = secrets.SystemRandom()
    added = []
    for code in ENUS + ["ADMIN", "PAY"]:
        if code not in out:
            words = "-".join(rnd.choice(WORDS) for _ in range(4)) + f"-{rnd.randint(10, 99)}"
            out[code] = {"passphrase": words, "log_token": secrets.token_urlsafe(18)}
            added.append(code)
    if added:
        json.dump(out, open(path, "w", encoding="utf-8"), indent=2)
        print("NEW passphrase(s) for", ", ".join(added), "in secrets/passphrases.json - give each person only their own.",
              "Also paste secrets/apps_script_tokens.json into the Apps Script property TOKENS again.")
    write_tokens(out)
    return out


def write_tokens(sec):
    """Tokens only (no passphrases) - paste into the Apps Script property TOKENS."""
    json.dump({c: v["log_token"] for c, v in sec.items()},
              open(P("secrets", "apps_script_tokens.json"), "w", encoding="utf-8"))


def encrypt(obj, passphrase):
    salt, iv = os.urandom(16), os.urandom(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=PBKDF2_ITER).derive(
        passphrase.encode("utf-8"))
    ct = AESGCM(key).encrypt(iv, json.dumps(obj, ensure_ascii=False).encode("utf-8"), None)
    b64 = lambda b: base64.b64encode(b).decode("ascii")
    return {"v": 1, "kdf": "PBKDF2-SHA256", "iter": PBKDF2_ITER, "salt": b64(salt), "iv": b64(iv), "ct": b64(ct)}


# ============================================================ state (stable IDs + assignment)
def load_state():
    if os.path.exists(STATE):
        return pd.read_csv(STATE, dtype=str, keep_default_na=False)
    # first run: seed from the 22 Oct master; ENU11 people are shared out equally
    seed = pd.read_excel(P(CFG["seed_master"]), sheet_name="contacts", dtype=str).fillna("")
    s = pd.DataFrame({"phone": seed.phone, "participant_id": seed.participant_id, "enumerator": seed.enumerator,
                      "first_seen": seed.registration_date.where(seed.registration_date != "", seed.main_survey_date),
                      "source": seed.source, "name": seed.name, "gender": seed.gender, "age": seed.age,
                      "province": seed.province, "district": seed.district, "city": seed.city_village})
    load = s[s.enumerator.isin(ENUS)].enumerator.value_counts().reindex(ENUS, fill_value=0).to_dict()
    for i in s[~s.enumerator.isin(ENUS)].sort_values(["first_seen", "participant_id"]).index:
        e = min(ENUS, key=lambda c: (load[c], c))
        s.at[i, "enumerator"] = e
        load[e] += 1
    print("First run: seeded", len(s), "people from", CFG["seed_master"], "and shared ENU11 people equally.")
    return s[STATE_COLS]


# ============================================================ main
def main():
    sec = make_secrets()
    state = load_state()
    known = dict(zip(state.phone, state.index))

    files = sorted(glob.glob(P("inputs", "*.xlsx")) + glob.glob(P("inputs", "*.csv")))
    data = {"reg": [], "main": [], "fu2": [], "fu4": []}
    for f in files:
        if os.path.basename(f).lower().startswith("call_log"):
            continue
        df = read_export(f)
        k = kind_of(df, os.path.basename(f))
        if k:
            data[k].append(df)
            print(f"  read {k:4s} {len(df):6d} rows  {os.path.basename(f)}")
    cat = {k: (pd.concat(v, ignore_index=True).drop_duplicates("ResponseId", keep="last") if v else pd.DataFrame())
           for k, v in data.items()}
    if cat["main"].empty and cat["reg"].empty:
        sys.exit("No Qualtrics exports found in inputs/.")

    new_people = []

    def person_for(phones, first_seen, profile, source):
        """Return the state index for the first known phone; otherwise queue a new person."""
        phones = [p for p in phones if p]
        for p in phones:
            if p in known:
                return known[p]
        if not phones:
            return None
        p = phones[0]
        idx = f"new{len(new_people)}"
        known[p] = idx
        new_people.append(dict(phone=p, first_seen=str(first_seen)[:19], source=source, **profile, _idx=idx))
        return idx

    # ---------------- registration
    reg_profile = {}
    for _, r in cat["reg"].iterrows():
        ph = clean_phone(val(r, "mobile_whatsapp"))
        prof = dict(name=tidy(val(r, "name")), gender=eng(val(r, "gender")), age=val(r, "age") or "",
                    province=eng(val(r, "province")), district=tidy(val(r, "district")),
                    city=tidy(val(r, "city_village")))
        i = person_for([ph], val(r, "StartDate"), prof, "Registration")
        if i is not None:
            reg_profile.setdefault(i, prof)

    # ---------------- main survey (recorded + in progress)
    main = {}
    timers = [c for c in cat["main"].columns if str(c).startswith("timer_Page Submit")]
    for _, r in cat["main"].iterrows():
        phones = [clean_phone(val(r, c)) for c in ("mobile", "ExternalReference", "mobile.1")]
        prof = dict(name=tidy(val(r, "name")), gender=eng(val(r, "gender")), age=val(r, "age") or "",
                    province=eng(val(r, "province")), district=tidy(val(r, "district")),
                    city=tidy(val(r, "cityvillage")))
        i = person_for(phones, val(r, "StartDate"), prof, "Main survey (not registered)")
        if i is None:
            continue
        finished = str(val(r, "Finished")).lower() in ("true", "1")
        rid = val(r, "ResponseId") or ""
        consent = val(r, "consent")
        st = ("completed" if finished and consent != "No" else "declined" if consent == "No"
              else "in_progress" if rid.startswith("FS_") else "stopped")
        rec = dict(status=st, progress=int(float(val(r, "Progress") or 0)), start=to_dt(val(r, "StartDate")),
                   end=to_dt(val(r, "EndDate")) if finished else pd.NaT,
                   video=any(val(r, c) for c in timers), consent=consent)
        main.setdefault(i, []).append(rec)
        if i not in reg_profile and prof["name"]:
            reg_profile.setdefault(i, prof)

    # ---------------- follow-ups (2-week, 4-week)
    fu = {"fu2": {}, "fu4": {}}
    unmatched = []            # follow-ups from numbers not in the study: shown to ADMIN, never new people
    for w in ("fu2", "fu4"):
        recs = {}
        for _, r in cat[w].iterrows():
            ph = clean_phone(val(r, "fu_mobile"))
            rid = val(r, "ResponseId") or ""
            finished = str(val(r, "Finished")).lower() in ("true", "1")
            i = known.get(ph) if ph else None
            if i is None:
                if ph or finished:
                    unmatched.append({"wave": w, "phone_typed": val(r, "fu_mobile") or "", "name": tidy(val(r, "fu_name")),
                                      "date": str(val(r, "StartDate"))[:16], "finished": finished, "response_id": rid})
                continue
            done = finished and val(r, "fu_consent") != "No"
            recs.setdefault(i, []).append(dict(
                done=done, open=rid.startswith("FS_"), start=to_dt(val(r, "StartDate")),
                date=to_dt(val(r, "EndDate") if done else val(r, "StartDate")),
                progress=int(float(val(r, "Progress") or 0)),
                pay_method=eng(val(r, "fu_pay_method")), pay_number=clean_phone(val(r, "fu_pay_number")) or ""))
        for i, rs in recs.items():
            # stale in-progress copies of an attempt that is now closed are dropped (same start time)
            closed = {str(x["start"])[:19] for x in rs if not x["open"]}
            rs = [x for x in rs if not (x["open"] and str(x["start"])[:19] in closed)] or rs
            done = [x for x in rs if x["done"]]
            fu[w][i] = min(done, key=lambda x: x["date"]) if done else max(
                rs, key=lambda x: x["start"] if not pd.isna(x["start"]) else pd.Timestamp.min)

    # ---------------- assign new people (IDs continue the sequence; fewest-people enumerator)
    if new_people:
        load = state.enumerator.value_counts().reindex(ENUS, fill_value=0).to_dict()
        seq = int(state.participant_id.str[:5].astype(int).max())
        rows = []
        for n in sorted(new_people, key=lambda x: (x["first_seen"], x["phone"])):
            seq += 1
            e = min(ENUS, key=lambda c: (load[c], c))
            load[e] += 1
            n2 = {k: n.get(k, "") for k in STATE_COLS}
            n2.update(participant_id=str(seq) + luhn_digit(str(seq)), enumerator=e)
            rows.append((n["_idx"], n2))
        add = pd.DataFrame([r for _, r in rows])
        start = len(state)
        state = pd.concat([state, add], ignore_index=True)
        remap = {old: start + k for k, (old, _) in enumerate(rows)}
        for d in (reg_profile, main, fu["fu2"], fu["fu4"]):
            for old, new in list(remap.items()):
                if old in d:
                    d[new] = d.pop(old)
    assert state.phone.is_unique and state.participant_id.is_unique
    # profile refresh from the latest registration / survey answers (never touches ID or enumerator)
    for i, prof in reg_profile.items():
        for k, v in prof.items():
            if v and not state.at[i, k]:
                state.at[i, k] = v

    # ---------------- call log
    logs = load_call_log(sec)

    # ---------------- statuses
    people = []
    for i, s in state.iterrows():
        people.append(build_person(i, s, main.get(i, []), fu["fu2"].get(i), fu["fu4"].get(i),
                                   logs.get(s.participant_id, [])))

    # ---------------- save state (backup first)
    if os.path.exists(STATE):
        shutil.copy(STATE, STATE.replace(".csv", f"_backup_{datetime.now():%Y%m%d_%H%M%S}.csv"))
    state[STATE_COLS].to_csv(STATE, index=False, encoding="utf-8-sig")

    # ---------------- publish encrypted files
    gen = datetime.now().strftime("%Y-%m-%d %H:%M")
    public = {"links": CFG["links"], "apps_script_url": CFG["apps_script_url"], "generated": gen,
              "target": CFG.get("target_per_enumerator", 300),
              "fu2_day": CFG["fu2_day"], "fu4_day": CFG["fu4_day"],
              "pay_fu2": CFG.get("pay_fu2", 200), "pay_fu4": CFG.get("pay_fu4", 150)}
    hidden_admin = ("age", "under_18", "gender", "video_seen", "n_video_attempts")
    for e in ENUS:
        mine = [{k: v for k, v in p.items() if k not in hidden_admin} for p in people if p["enumerator"] == e]
        obj = dict(public, role="enumerator", code=e, log_token=sec[e]["log_token"], people=mine)
        json.dump(encrypt(obj, sec[e]["passphrase"]), open(P("docs", "data", f"{e}.json.enc"), "w"))
    adm = dict(public, role="admin", code="ADMIN", log_token=sec["ADMIN"]["log_token"], people=people,
               enumerators=ENUS, unmatched=unmatched)
    # PAY login (payment firm): only people who completed a follow-up; payment details, no survey answers
    pay_keep = ("pid", "enumerator", "name", "phone", "district", "province", "compliance",
                "fu2_status", "fu2_date", "fu4_status", "fu4_date", "pay2", "pay4")
    payers = [dict({k: p[k] for k in pay_keep},
                   calls=[c for c in p["calls"] if str(c.get("outcome", "")).startswith("paid")])
              for p in people if p["pay2"]["status"] != "not_due" or p["pay4"]["status"] != "not_due"]
    payobj = dict(public, role="pay", code="PAY", log_token=sec["PAY"]["log_token"], people=payers, enumerators=ENUS)
    json.dump(encrypt(payobj, sec["PAY"]["passphrase"]), open(P("docs", "data", "PAY.json.enc"), "w"))
    json.dump(encrypt(adm, sec["ADMIN"]["passphrase"]), open(P("docs", "data", "ADMIN.json.enc"), "w"))
    json.dump({"generated": gen}, open(P("docs", "data", "version.json"), "w"))

    # ---------------- summary
    df = pd.DataFrame(people)
    lines = [f"Tracker update {gen}", f"People: {len(df)}  (new this run: {len(new_people)})",
             "Main survey: " + ", ".join(f"{k} {v}" for k, v in df.main_status.value_counts().items()),
             "2-week: " + ", ".join(f"{k} {v}" for k, v in df.fu2_status.value_counts().items()),
             "4-week: " + ", ".join(f"{k} {v}" for k, v in df.fu4_status.value_counts().items()),
             f"Call today (all enumerators): {int(df.call_today.sum())}",
             f"Call-log entries read: {sum(len(v) for v in logs.values())}",
             "Payments 2-week (PKR {}): due {}, paid {}   4-week (PKR {}): due {}, paid {}".format(
                 CFG.get("pay_fu2", 200), sum(p["pay2"]["status"] == "due" for p in people),
                 sum(p["pay2"]["status"] == "paid" for p in people), CFG.get("pay_fu4", 150),
                 sum(p["pay4"]["status"] == "due" for p in people), sum(p["pay4"]["status"] == "paid" for p in people)),
             f"Follow-ups from numbers not in the study (see ADMIN): {len(unmatched)}", "",
             f"Full compliance: {int((df.compliance == 'full').sum())}   Partial compliance (video, not finished): "
             f"{int((df.compliance == 'partial').sum())}", "",
             "Per enumerator: people / full / partial / 2-wk done / 4-wk done / call today"]
    for e in ENUS:
        d = df[df.enumerator == e]
        lines.append(f"  {e}: {len(d):5d} / {int((d.compliance == 'full').sum()):4d} / {int((d.compliance == 'partial').sum()):4d}"
                     f" / {int((d.fu2_status == 'done').sum()):4d} / {int((d.fu4_status == 'done').sum()):4d}"
                     f" / {int(d.call_today.sum()):4d}")
    open(P("state", "last_run.txt"), "w", encoding="utf-8").write("\n".join(lines))
    print("\n".join(lines))
    print("\nNext: commit and push the docs/ folder (see README.md).")


def norm_day(v):
    """Any date / datetime text from the Sheet -> 'YYYY-MM-DD' (local day), or ''."""
    v = str(v or "").strip()
    if not v:
        return ""
    if re.match(r"^\d{4}-\d{2}-\d{2}$", v):
        return v
    v2 = re.sub(r"\s*\(.*\)$", "", v)                 # 'Tue Oct 27 2026 00:00:00 GMT+0900 (...)'
    t = pd.to_datetime(v2, errors="coerce", utc=True)
    if pd.isna(t):
        return v[:10]
    return t.tz_convert(datetime.now().astimezone().tzinfo).strftime("%Y-%m-%d")


LOG_FIELDS = ("log_id", "time", "enumerator", "owner", "participant_id", "action", "outcome", "tags", "note",
              "next_call", "amount", "method", "pay_number", "reference")


def load_call_log(sec):
    rows = []
    url = CFG.get("apps_script_url")
    if url:
        try:
            q = f"{url}?action=export&token={sec['ADMIN']['log_token']}"
            with urllib.request.urlopen(q, timeout=60) as resp:
                rows = json.loads(resp.read().decode("utf-8")).get("rows", [])
            print(f"  read call log from Google Sheet: {len(rows)} entries")
        except Exception as ex:  # keep working offline
            print("  WARNING: could not read the online call log:", ex)
    for f in glob.glob(P("inputs", "call_log*.csv")):
        rows += pd.read_csv(f, dtype=str, keep_default_na=False).to_dict("records")
    out, seen = {}, set()
    valid = {c: sec[c]["log_token"] for c in sec}
    for r in rows:
        lid = r.get("log_id") or ""
        if lid in seen:
            continue
        seen.add(lid)
        code = r.get("enumerator", "")
        if valid.get(code) != r.get("token") and "token" in r:
            continue      # entries with a wrong token are ignored
        rec = {k: str(r.get(k, "") or "") for k in LOG_FIELDS}
        pid = re.sub(r"\.0$", "", rec["participant_id"])
        rec["participant_id"] = pid.zfill(6) if pid.isdigit() else pid       # Sheets drops leading zeros
        rec["next_call"] = norm_day(rec["next_call"])
        rec["day"] = norm_day(rec["time"])                                  # local calendar day of the call
        if rec["pay_number"]:
            rec["pay_number"] = clean_phone(rec["pay_number"]) or rec["pay_number"]
        out.setdefault(rec["participant_id"], []).append(rec)
    for v in out.values():
        v.sort(key=lambda x: x["time"])
    return out


def build_person(i, s, mains, fu2, fu4, logs):
    fmt = lambda t: "" if t is None or pd.isna(t) else pd.Timestamp(t).strftime("%Y-%m-%d")
    # ---- main survey: best attempt
    rank = {"completed": 4, "in_progress": 3, "stopped": 2, "declined": 1}
    if mains:
        # an in-progress copy is stale once the same attempt (same start time) appears as closed
        closed_starts = {str(m["start"])[:19] for m in mains if m["status"] != "in_progress"}
        live = [m for m in mains if not (m["status"] == "in_progress" and str(m["start"])[:19] in closed_starts)]
        mains = live or mains
        done_any = [m for m in mains if m["status"] == "completed"]
        if done_any:
            best = max(done_any, key=lambda m: m["progress"])
        else:   # otherwise the most recent attempt tells the current state
            best = max(mains, key=lambda m: (m["start"] if not pd.isna(m["start"]) else pd.Timestamp.min,
                                              rank[m["status"]]))
        main_status = best["status"]
        consent_yes = any(m["consent"] == "Yes" for m in mains)
        if main_status == "declined" and consent_yes:
            main_status = "stopped"
        video_seen = any(m["video"] for m in mains)
        n_video = sum(bool(m["video"]) for m in mains)
        done_dates = [m["end"] for m in mains if m["status"] == "completed" and not pd.isna(m["end"])]
        main_done = min(done_dates) if done_dates else None
        last_start = max((m["start"] for m in mains if not pd.isna(m["start"])), default=None)
        progress = max(m["progress"] for m in mains)
        n_completed = sum(m["status"] == "completed" for m in mains)
    else:
        main_status, video_seen, main_done, last_start, progress, n_completed = "not_started", False, None, None, 0, 0
        n_video, consent_yes = 0, False

    # ---- compliance: full = finished the main survey; partial = saw a video, consented, did not finish.
    # Partial completers are treated (never restarted: a new attempt would re-randomise the video) and
    # enter the 2-/4-week follow-ups, counted from the day they watched the video.
    compliance, partial_open = "", False
    if main_status == "completed":
        compliance = "full"
    elif video_seen and consent_yes and main_status in ("in_progress", "stopped"):
        compliance = "partial"
        partial_open = main_status == "in_progress"
        vids = [m["start"] for m in mains if m["video"] and not pd.isna(m["start"])]
        main_done = max(vids) if vids else last_start
        main_status = "partial"

    # ---- follow-up windows
    # status: not_eligible | not_yet | due | overdue | in_progress (open session) | stopped (closed, unfinished)
    #         | done | missed (2-week never done and the 4-week window has opened)
    def wave(rec, day):
        if main_done is None:
            return "not_eligible", ""
        due = (pd.Timestamp(main_done) + timedelta(days=day)).date()
        if rec and rec["done"]:
            return "done", due.isoformat()
        if rec:                                  # started but not finished: send the link again
            return ("in_progress" if rec["open"] else "stopped"), due.isoformat()
        if TODAY < due:
            return "not_yet", due.isoformat()
        return ("overdue" if TODAY >= due + timedelta(days=CFG["window_days"]) else "due"), due.isoformat()

    fu2_status, fu2_due = wave(fu2, CFG["fu2_day"])
    fu4_status, fu4_due = wave(fu4, CFG["fu4_day"])
    if fu2_status in ("due", "overdue", "in_progress", "stopped") and fu4_status not in ("not_yet", "not_eligible"):
        fu2_status = "missed"                    # the 4-week survey takes over
    fu_rec = {"fu2": fu2, "fu4": fu4}
    fu_open_stall = lambda w: bool(fu_rec[w] and fu_rec[w]["open"] and not pd.isna(fu_rec[w]["start"]) and
                                   (TODAY - pd.Timestamp(fu_rec[w]["start"]).date()).days >= 1)
    # ---- calls and payments (payments are logged by the PAY login: outcome paid_fu2 / paid_fu4)
    last_call = [l for l in logs if not str(l.get("outcome", "")).startswith("paid")]
    last = last_call[-1] if last_call else None
    tags = sorted({t.strip() for l in last_call for t in str(l.get("tags", "")).split(",") if t.strip()})
    refused = bool(last and last.get("outcome") == "refused") or "refused" in tags
    wrong = "wrong_number" in tags

    def pay(w, amount):
        rec = fu_rec[w]
        paid = [l for l in logs if l.get("outcome") == f"paid_{w}"]
        if paid:
            p = paid[-1]
            return dict(status="paid", amount=p.get("amount") or amount, date=str(p.get("time", ""))[:10],
                        ref=p.get("reference", ""), method=p.get("method", ""), number=p.get("pay_number", ""))
        if rec and rec["done"]:
            return dict(status="due", amount=amount, date=fmt(rec["date"]), ref="",
                        method=rec["pay_method"], number=rec["pay_number"] or s.phone)
        return dict(status="not_due", amount=amount, date="", ref="", method="", number="")

    pay2, pay4 = pay("fu2", CFG.get("pay_fu2", 200)), pay("fu4", CFG.get("pay_fu4", 150))
    # ---- next action
    stall = last_start is not None and (TODAY - pd.Timestamp(last_start).date()).days >= CFG["stall_days"]
    if main_status == "declined":
        action, link = "do_not_contact", ""
    elif refused:
        action, link = "do_not_contact", ""
    elif main_status == "not_started":
        action, link = "main_invite", "main"
    # started, no video yet: in progress -> reopen on the same phone; stopped (closed) -> start again.
    # (Anyone who already saw a video is "partial" above and is never asked to restart.)
    elif main_status == "in_progress":
        action, link = ("main_remind" if stall else "wait_main"), "main"
    elif main_status == "stopped":
        action, link = "main_restart", "main"
    # follow-ups: not done -> send the link; started in an open session -> remind to finish on the same
    # phone (after a day); started and closed -> send the link again (no randomisation in follow-ups)
    elif fu4_status in ("due", "overdue", "stopped") or (fu4_status == "in_progress" and fu_open_stall("fu4")):
        action, link = "fu4", "fu4"
    elif fu4_status == "in_progress":
        action, link = "wait_fu", ""
    elif fu2_status in ("due", "overdue", "stopped") or (fu2_status == "in_progress" and fu_open_stall("fu2")):
        action, link = "fu2", "fu2"
    elif fu2_status == "in_progress":
        action, link = "wait_fu", ""
    elif fu4_status == "done":
        action, link = "all_done", ""
    elif partial_open and stall:
        action, link = "main_remind", "main"       # same open session: same video, no re-randomisation
    else:
        action, link = "wait_followup", ""
    next_call = (last or {}).get("next_call", "") or ""
    actionable = action in ("main_invite", "main_remind", "main_restart", "fu2", "fu4")
    called_today = bool(last and last.get("day", str(last.get("time", ""))[:10]) == TODAY.isoformat())
    call_today = (actionable and not wrong and not called_today and (not next_call or next_call <= TODAY.isoformat()))
    try:
        age = int(float(s.age))
    except (TypeError, ValueError):
        age = None
    return {
        "pid": s.participant_id, "enumerator": s.enumerator, "name": s["name"] or "",
        "phone": s.phone, "district": s.district or "", "province": s.province or "", "city": s.city or "",
        "source": s.source, "first_seen": str(s.first_seen)[:10],
        "main_status": main_status, "main_progress": progress, "main_done": fmt(main_done),
        "main_last_start": fmt(last_start), "video_seen": bool(video_seen), "n_video_attempts": n_video, "n_completed": n_completed,
        "compliance": compliance, "followup_from": fmt(main_done),
        "fu2_status": fu2_status, "fu2_due": fu2_due, "fu4_status": fu4_status, "fu4_due": fu4_due,
        "fu2_date": fmt(fu2["date"]) if fu2 and fu2["done"] else "", "fu4_date": fmt(fu4["date"]) if fu4 and fu4["done"] else "",
        "fu2_progress": fu2["progress"] if fu2 else 0, "fu4_progress": fu4["progress"] if fu4 else 0,
        "pay2": pay2, "pay4": pay4,
        "action": action, "link": link, "call_today": bool(call_today), "next_call": next_call,
        "tags": tags, "calls": logs[-8:], "n_calls": len(last_call),
        "age": "" if age is None else age, "under_18": "" if age is None else ("Yes" if age < 18 else "No"),
        "gender": s.gender or "",
    }


if __name__ == "__main__":
    main()
