# Sunni–Shia fieldwork tracker

A phone-friendly web page with three kinds of login:

| Login | Who | Sees |
|---|---|---|
| ENU01 … ENU10 | enumerators | only their own participants: status, what to do next, Call / WhatsApp, call log |
| PAY | payment firm (CANE Technologies) | only people whose payment is due or done: amount, method, account number; marks payments as paid |
| ADMIN | research team | everyone, per-enumerator table, problem flags |

## How it works — two kinds of information, two ways of updating

```
 QUALTRICS (who filled what)                  GOOGLE SHEET (calls + payments)
 you export -> tracker/inputs/                enumerators press "Log call"
 python update.py                             PAY presses "Mark as paid"
   merges everything, keeps IDs                 -> a new row in the Sheet, instantly
   -> docs/data/*.json.enc (encrypted)
 git push  -> website                         every page reads the Sheet when it opens
              (survey status changes            and when "Refresh" is pressed
               appear after the push)           (calls / payments appear within seconds,
                                                 no push needed)
```

* **Survey status** (registered, started, completed, 2-week / 4-week done, payment
  due) comes from the Qualtrics exports. It changes on the website only after you run
  `update.py` and push.
* **Calls and payments** are rows in the Google Sheet. Every open page reads them
  automatically every 2 minutes and whenever it is reopened (the header shows "Live hh:mm"),
  so a call logged by ENU03 or a payment marked by PAY shows for ENU03, PAY and ADMIN within
  about 2 minutes; **Refresh** does it at once. Each enumerator sees the payments of their
  own participants in the progress panel ("Paid / Waiting for payment").
* After you push, open pages pick up the new survey statuses by themselves at the next
  automatic refresh. `update.py` also reads the whole Sheet, so they are
  built into the next push as well.
* **Nothing overlaps or is lost.** Qualtrics data and the Sheet are separate sources,
  merged by participant ID; every call / payment row has its own ID, so re-reading it
  never doubles anything; adding new Qualtrics exports never touches the Sheet.
* **Without the Google Sheet** (empty `apps_script_url`) calls and payments stay on the
  phone that recorded them. Then each person must press "Download my unsent logs" and
  send you the file, which you put in `inputs/` (name starting with `call_log`).
* **Participant data are never readable on GitHub.** Each file in `docs/data/` is
  encrypted (AES-256-GCM, key from the passphrase with PBKDF2, 200,000 rounds).
  Enumerators never see sect, age or survey answers. PAY sees only payment details.
  `inputs/`, `state/` and `secrets/` are excluded by `.gitignore` — never remove those lines.

## One-time setup

1. **Passphrases.** `secrets/passphrases.json` has one passphrase per login
   (ENU01–ENU10, PAY, ADMIN). Give each person **only their own**, privately.
2. **Google Sheet** (needed for live calls and payments).
   1. New Google Sheet (your account) → Extensions → Apps Script.
   2. Replace the code with `apps_script/Code.gs` → Save.
   3. Project Settings → Script Properties → property `TOKENS` = the one line in
      `secrets/apps_script_tokens.json`.
   4. Deploy → New deployment → **Web app** → Execute as **Me**, access **Anyone** →
      Deploy → authorise → copy the URL into `config.json` → `"apps_script_url"`.
   5. Whenever `Code.gs` changes: Deploy → **Manage deployments** → edit → Version:
      *New version* → Deploy (the URL stays the same). When a new login is added
      (e.g. PAY), paste `TOKENS` again.
3. **Survey links** in `config.json` → `links` (`main`, `fu2`, `fu4`).
4. **GitHub Pages:** Settings → Pages → *Deploy from a branch* → `main` / `/docs`.

## Daily routine

1. Qualtrics → Export → **Use choice text**: registration survey; main survey (recorded
   and **responses in progress**); 2-week and 4-week follow-up surveys (recorded and in
   progress). Put **all** of them in `tracker/inputs/` — one folder for everything; the
   script recognises each file by its columns. Old exports can stay.
2. `python update.py` — read the summary (also in `state/last_run.txt`).
3. Push (see the commands at the end).

## Statuses and rules

**Main survey.** Not started → send link. Started, no video yet: open session →
remind after 2 days (same phone continues); closed → start again. **Saw a video** →
*partial compliance*, never restarted (would re-randomise the video). *Full
compliance* = finished (target 320 per enumerator per round: the same people through main, 2-week and 4-week).

**2-week / 4-week follow-ups** (for full and partial compliance; days counted from
completion, or from the day the video was watched for partial compliance):

| Status | Meaning | What the enumerator does |
|---|---|---|
| Not yet due | before day 14 / 28 | wait |
| Due / Overdue | due date reached, not started (overdue after 7 days) | send the link |
| Started (open) | opened the follow-up but did not finish; session still open | after 1 day: "open the link on the same phone to finish" |
| Started, closed | unfinished response closed by Qualtrics (after 1 week) | send the link again: they fill it from the start (no randomisation, so this is safe) |
| Done | completed | — (payment becomes due) |
| Missed | 2-week never done and the 4-week window has opened | 4-week survey takes over |

**Payments** (order form with CANE Technologies): **PKR 200** after the 2-week
follow-up, **PKR 150** after the 4-week follow-up. A payment becomes *Due* when the
follow-up is completed; method and account number come from the participant's answers
in that follow-up (fallback: their phone number). PAY sends the money, presses **Mark as
paid** and enters the transaction ID → the payment shows as *Paid* for the enumerator
and ADMIN straight away. PAY can also download the due list as CSV.

**Analysis note (pre-analysis plan):** treated = reached the video page; follow-up
outcomes are analysed for full + partial compliance; missing post-video items of
partial compliers are attrition for the immediate outcomes only.

## Publishing (PowerShell, one command at a time)

```
cd D:\Research\DavidKhanHussain_Sunni-Shia\tracker
python update.py
git add update.py config.json README.md apps_script docs
git commit -m "update"
git push
```
If the push is rejected: `git pull --rebase`, then `git push` again.

## Changing things

* `config.json`: follow-up days, overdue window, reminder delay, target (`target_per_enumerator`), payment amounts.
* After changing `docs/app.js` or `docs/style.css`, raise the `?v=` number in `docs/index.html`
  so phones load the new version instead of a cached copy.
* New login or a leaked passphrase: delete that entry from `secrets/passphrases.json`,
  run `update.py` (it creates a new one), paste `TOKENS` into Apps Script again.
* `state/people.csv` is the master list (ID ↔ phone ↔ enumerator), backed up on every
  run. Do not edit IDs by hand.
