# Sunni–Shia fieldwork tracker

A phone-friendly web page with three kinds of login:

| Login | Who | Sees |
|---|---|---|
| ENU01 … ENU10 (+ split logins such as ENU06B) | enumerators | only their own participants: status, what to do next, Call / WhatsApp / SMS, call log |
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
| Done | completed — or every question answered, payment details included (progress ≥ 97%), with Submit never pressed | — (payment becomes due) |
| Missed | 2-week never done and the 4-week window has opened | 4-week survey takes over |

**Follow-up priority 1–4 (team decision, 10 Nov).** Each person with full or partial compliance has a number
in front of their name. "High watch" means at least `watch_high_seconds` (3 minutes) on the video page, in any
attempt; for a video shorter than that, `watch_high_share` (90%) of its length is enough. The time comes from
the Qualtrics timer of the video page.

The rule is in minutes, not "half of the video", because video length differs by messenger (citizen 2–3.5 min,
scholars 6–9 min). On the 10 Nov data, the half-video rule gave 30% high watch for citizen videos and 14% for
Sunni- and Shia-scholar videos. The 3-minute rule gives 15–26% across messengers and 17–21% across messages,
about 20% of viewers overall.

| Priority | Main survey | Video |
|---|---|---|
| 1 | finished (100%) | high watch |
| 2 | partial (80–99%, saw the video) | high watch |
| 3 | finished (100%) | watched less |
| 4 | partial | watched less |

Within each kind of task the list shows priority 1 first. *More… → Priority 1–4* lists one group, and
tapping the number explains it. Enumerators see only the number; ADMIN also sees the watched share.

The video lengths are in `config.json` → `video_seconds`, in the order of the 30 `timer_Page Submit` columns
of the main-survey export. That order comes from the ImportId row of a CSV export: each column's QID was
matched to its video block in the survey's `.qsf`. Do not use the order of the blocks in the `.qsf`, which
differs for the first 9 videos. The lengths come from the mp4 files in `../videos`. If videos change, update
both.

Watch time is measured after the video was shown, so it is post-treatment. People with priority 3–4 are still
in the follow-up sample and must still be contacted; the priority only sets the order.

**Late (red tag).** A follow-up that is still open more than `late_days` (3) days after its due
date gets a red "N days late" tag, a red border and its due date in bold red; the Follow-ups tab
shows the number in red, and *More… → Follow-up late* lists them.

**Finished (team decision, 10 Nov).** Once the 4-week survey is done (whether the 2-week was done or missed),
nothing is left to do. In an enumerator's login these people leave every other list and filter (*To do today*,
*Follow-ups*, *All*, *Priority 1–4* …). They appear only in the **✓ Finished** tab, in *Contacted today*, in the
payment filters (*Payment pending*, *Paid*, *Payment on hold*) and in search. Their card shows no priority
number, and they still count in the progress bars. ADMIN and PAY see them in every list as before. ADMIN also
has the Finished tab, which replaced *More… → 4-week done*.

**Search.** The search box (name, ID, or any of the person's numbers: contact, old, other or payment
number) looks through all of the login's people, whatever tab or tag is selected, so someone whose
follow-ups are done is still found when they call or message again. Numbers can be typed in any form
(`+92 345 …`, `0345-…`, Urdu digits). Picking a tab, tile or filter clears the search.

**WhatsApp and SMS buttons.** Both open a ready message that matches the person's status, with the
right link and their number. WhatsApp uses the Urdu text (`MSG` in `docs/app.js`). SMS opens the phone's
own Messages app with a shorter Roman Urdu text (`SMS` in `docs/app.js`). Plain Latin letters keep an
SMS at 160 characters (Urdu script: 70), so every message, link included, fits in 1–2 SMS. A name in Urdu
script is left out of the SMS (it would make every part Urdu-script, 70 characters), and so is a name that
would make it longer than 2 SMS. SMS goes from the enumerator's own SIM and package. In the log, the
message row takes one choice, WhatsApp or SMS. The Apps Script keeps 30 characters of the outcome, and
three parts would not fit. When you change a text, keep it under 306 characters with the link, and
use plain letters only (no curly quotes or emoji).

**New phone number.** Add a line to `state/number_changes.csv` (`participant_id,new_phone,date,note`;
the date is filled in if left empty) and run `update.py`. ID and enumerator stay the same; calls,
WhatsApp and the payment fallback use the new number; survey answers with either number still
match; "wrong number" and other tags logged before the change are dropped. If the new number was
already registered as a second ID, that ID is folded into the first one (listed under ADMIN →
Checks). Deleting the line undoes it.

**Same person under two IDs** (e.g. main survey from one number, follow-up from another). Add a line
to `state/same_person.csv` (`keep_id,other_id,date,note`) and run `update.py`. `other_id` is folded
into `keep_id`: survey answers from either number count for `keep_id`, now and in later waves; its
call history is shown there, marked with the other ID (an enumerator's login shows only the calls that
enumerator logged, never another enumerator's; ADMIN sees all); its numbers are found by search but
not shown on the card (some are only typos); the contact number and enumerator stay those of `keep_id`. `other_id` can also be a phone number that is not in the study (a follow-up typed with a
wrong number): answers typed with it then count for `keep_id`. Deleting the line undoes it.

**Split login (a second WhatsApp number for one enumerator).** Too many messages from one number
get it blocked, so one enumerator's list can be split over two logins (pilot since 8 Nov 2026:
ENU06 + ENU06B; since 9 Nov every enumerator: part A is the original login ENU01 … ENU10, part B is
ENU01B … ENU10B). Run `update.py`, then `python split_login.py ENU06 ENU06B`, then `update.py` again.
Only untouched people move to the new login (main survey never opened, no survey response, no call
or WhatsApp logged, no tags, not in a team list), at most half of the list, chosen at random with a
fixed seed; everyone with any history stays with the first login. The moved IDs are in
`state/split_ENU06B.csv`. `config.json` then lists the new login and `"split": {"ENU06B": "ENU06"}`:
the pair counts as one enumerator when new people are shared out (inside the pair the login with
fewer people gets them), the two logins share one target (half each), and each sees the other's calls
on its own people. Search in one login also finds the other login's people (someone who writes to the
other WhatsApp number). Their card says "In ENU06B's list" and has no Log button, because the Apps
Script accepts a call only from the person's own login. The ADMIN chart draws each pair as one
enumerator against the full target; the table below it lists every login. The sign-in menu reads the logins from `docs/data/version.json`, so no code change
is needed. After the first run, paste `secrets/apps_script_tokens.json` into the Apps Script property
TOKENS (otherwise the new login cannot save calls) and give the new passphrase from
`secrets/passphrases.json` privately. Undo: `python split_login.py --undo ENU06B` (everyone in ENU06B,
including new people since, goes back to ENU06), then `update.py` and push.

**Response links (for the analysis).** Each run writes `state/response_links.csv`: every main and
follow-up response (`response_id`) with the `participant_id` it belongs to, the number typed in the
survey, `finished`, and `finished_order` (1 = the person's first finished response to that survey;
2, 3 = repeats). Merge the Qualtrics data on `response_id` to get participant IDs that already include
number changes and same-person links.

**Contact again after a refusal.** Add a line to `state/contact_again.csv`
(`participant_id,date,note`) and run `update.py`: refusals logged before that date no longer
count, so the person comes back on the enumerator's list. A new refusal after it counts again.

**Payments** (order form with CANE Technologies): **PKR 200** after the 2-week
follow-up, **PKR 150** after the 4-week follow-up. A payment becomes *Due* when the
follow-up is completed; method and account number come from the participant's answers
in that follow-up (fallback: their phone number). PAY sends the money, presses **Mark as
paid** and enters the transaction ID → the payment shows as *Paid* for the enumerator
and ADMIN straight away. PAY opens on **All due**: 2-week and 4-week payments together, oldest first,
and a payment still due is shown above one already paid. The CSV of that tab has both waves (column
`wave`); the 2-week and 4-week tabs give one wave each.
A follow-up completed by someone with no main survey (or no video) under that number is
**on hold**: PAY does not see it, and the enumerator is asked to find out which number they used
for the main survey (then add it as a number change, or tell the team).

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
