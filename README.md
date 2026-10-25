# Sunni–Shia fieldwork tracker

A phone-friendly web page where each enumerator sees **only their own participants**
and their status (registered, main survey started / completed, 2-week and 4-week
follow-ups due or done, payment), with call and WhatsApp buttons and a call log.
You update it from your laptop by dropping in the Qualtrics exports and running one
command.

## How it works

```
 YOUR LAPTOP                                          ENUMERATOR PHONES
 inputs/  <- Qualtrics exports                        GitHub Pages link
   python update.py                                     code + passphrase
     - merges registration, main survey (recorded        decrypts ONLY their own file
       + in progress), 2-week and 4-week follow-ups      list, filters, Call / WhatsApp
     - keeps every ID and enumerator; new people get     "Log call" -> Google Sheet
       a new ID and go to the enumerator with the
       fewest people                                  GOOGLE SHEET (yours)
     - reads the call log from the Google Sheet  <---   one row per logged call
     - writes docs/data/ENU01..ENU10, ADMIN
       (encrypted)
   git push  ------------------------------------->  page shows the new data
```

* **Participant data are never readable on GitHub.** Each file in `docs/data/` is
  encrypted (AES-256-GCM, key derived from the passphrase with PBKDF2, 200,000
  rounds). The page decrypts it inside the phone's browser.
* Enumerators see: ID, name, phone, district/province, status and dates, calls.
  **Not** sect, age or any survey answer. ADMIN additionally sees the under-18 flag.
* `inputs/`, `state/` and `secrets/` hold readable data and are excluded by
  `.gitignore`. Never remove those lines.

## One-time setup (about 20 minutes)

1. **Passphrases.** The first `python update.py` created `secrets/passphrases.json`:
   one passphrase per enumerator plus ADMIN. Give each enumerator **only their own**
   (in person or a private message). Keep the file off GitHub, WhatsApp groups and email.
2. **Google Sheet for call logs.**
   1. Create a new Google Sheet (your account). Extensions → Apps Script.
   2. Replace the code with `apps_script/Code.gs`. Save.
   3. Project Settings → Script Properties → add property `TOKENS` with the
      contents of `secrets/apps_script_tokens.json` (one line of JSON).
   4. Deploy → New deployment → type **Web app** → Execute as **Me**,
      Who has access **Anyone** → Deploy → authorise → copy the Web app URL.
   5. Paste the URL into `config.json` → `"apps_script_url"`.
3. **Survey links.** Put the three Qualtrics anonymous links into `config.json` →
   `links` (`main`, `fu2`, `fu4`). They are used in the ready-made WhatsApp messages.
4. **GitHub.**
   1. Create a repository (e.g. `ss-tracker`). Private is fine if your plan
      supports Pages for private repos; if public, only code and encrypted files
      are visible.
   2. In this `tracker` folder: `git init`, `git add .`, `git commit -m "tracker"`,
      add the remote, `git push -u origin main`.
   3. GitHub → Settings → Pages → Source: *Deploy from a branch* → `main` / `/docs`.
   4. The link is `https://<your-user>.github.io/<repo>/`. Send it to the enumerators.

## Daily routine (about 5 minutes)

1. Qualtrics → Data & Analysis → Export → **Use choice text**, for:
   registration survey; main survey (recorded); main survey **responses in progress**;
   2-week and 4-week follow-up surveys (once they start).
2. Put the files in `inputs/` (old ones can stay; duplicates are removed by ResponseId).
3. `python update.py` — read the summary it prints (also in `state/last_run.txt`).
4. `git add docs/data && git commit -m "update" && git push`.
   The page updates within about a minute; enumerators reload it.

## What the statuses mean

| Main survey | |
|---|---|
| Not started | registered (or contact known) but no survey response |
| In progress | an open Qualtrics session — they can still finish it |
| Stopped (closed) | Qualtrics closed the unfinished response |
| Completed | finished the main survey (date = 2-week / 4-week clock start) |
| Declined consent | answered No — **do not contact** |

Follow-ups: *Not yet due* → *Due* (from day 14 / day 28 after completion) →
*Overdue* (7 days after due) → *Done*. After both are done: *Payment due* → log
"Paid Rs 350" from the ADMIN login.

**Next action rules.** Not started → send main link. Started, not finished → remind
after 2 days — **unless a video was already shown** ("do not restart"), because a new
attempt would re-randomise them to another video. Completed → 2-week, then 4-week
follow-up. Refused or wrong number → removed from "Call today".

## Changing things

* `config.json`: follow-up days (`fu2_day`, `fu4_day`), overdue window, reminder delay.
* New enumerator: add the code to `config.json` and `CODES` in `docs/app.js`, delete
  `secrets/passphrases.json` → new passphrases for everyone on the next run (also update
  `TOKENS` in Apps Script). Do the same if a passphrase leaks or someone leaves.
* `state/people.csv` is the master list (ID ↔ phone ↔ enumerator). It is backed up
  on every run (`state/people_backup_*.csv`). Do not edit IDs by hand.
