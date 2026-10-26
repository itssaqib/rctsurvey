/**
 * Sunni–Shia fieldwork tracker — call-log and payment receiver.
 * Paste into Extensions > Apps Script of a NEW Google Sheet you own, then
 * Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * Script Properties: TOKENS = the JSON from secrets/apps_script_tokens.json
 *
 * POST  one record (call log by an enumerator, or payment by PAY)  -> appended to sheet "calls"
 * GET   ?action=mine&code=ENU01&token=..  -> that login's records (live sync in the web page)
 * GET   ?action=export&token=<ADMIN>     -> everything (read by update.py)
 */
const SHEET = "calls";
const COLS = ["received", "log_id", "time", "enumerator", "owner", "participant_id", "action", "outcome", "tags",
  "note", "next_call", "amount", "method", "pay_number", "reference"];

function tokens_() {
  return JSON.parse(PropertiesService.getScriptProperties().getProperty("TOKENS") || "{}");
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(COLS); sh.setFrozenRows(1); }
  return sh;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function rows_() {
  const v = sheet_().getDataRange().getValues();
  const head = v.shift() || COLS;
  return v.map((r) => {
    const o = {};
    head.forEach((h, i) => { o[h] = r[i] instanceof Date ? r[i].toISOString() : String(r[i]); });
    return o;
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    const tok = tokens_();
    if (!d.enumerator || tok[d.enumerator] !== d.token) return out_({ ok: false, error: "bad token" });
    if (!/^\d{6}$/.test(String(d.participant_id))) return out_({ ok: false, error: "bad id" });
    const isPay = /^paid_/.test(String(d.outcome));
    if (isPay && d.enumerator !== "PAY" && d.enumerator !== "ADMIN") return out_({ ok: false, error: "not allowed" });
    if (!isPay && d.enumerator !== "ADMIN" && d.enumerator !== "PAY" && d.owner !== d.enumerator)
      return out_({ ok: false, error: "not your participant" });
    const sh = sheet_();
    const last = sh.getLastRow();
    if (last > 1) {   // ignore re-sends of the same record
      const ids = sh.getRange(2, 2, last - 1, 1).getValues().flat();
      if (ids.indexOf(d.log_id) !== -1) return out_({ ok: true, duplicate: true });
    }
    const c = (s, n) => String(s || "").slice(0, n);
    sh.appendRow([new Date(), c(d.log_id, 64), c(d.time, 40), d.enumerator, c(d.owner, 10), String(d.participant_id),
      c(d.action, 30), c(d.outcome, 30), c(d.tags, 200), c(d.note, 300), c(d.next_call, 10),
      c(d.amount, 10), c(d.method, 20), c(d.pay_number, 20), c(d.reference, 60)]);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const p = e.parameter || {};
  const tok = tokens_();
  if (p.action === "export" && tok.ADMIN === p.token) return out_({ ok: true, rows: rows_() });
  if (p.action === "mine" && p.code && tok[p.code] === p.token) {
    let rows = rows_();
    if (p.code === "PAY") rows = rows.filter((r) => /^paid_/.test(r.outcome));
    else if (p.code !== "ADMIN") rows = rows.filter((r) => r.owner === p.code);
    return out_({ ok: true, rows: rows });
  }
  return out_({ ok: false });
}
