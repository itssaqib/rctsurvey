/**
 * Sunni–Shia fieldwork tracker — call-log receiver.
 * Paste into Extensions > Apps Script of a NEW Google Sheet you own, then
 * Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * Script Properties: TOKENS = the JSON from secrets/apps_script_tokens.json
 */
const SHEET = "calls";
const COLS = ["received", "log_id", "time", "enumerator", "participant_id", "action", "outcome", "tags", "note", "next_call"];

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

/** Enumerator phones post one call record here. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    const tok = tokens_();
    if (!d.enumerator || tok[d.enumerator] !== d.token) return out_({ ok: false, error: "bad token" });
    if (!/^\d{6}$/.test(String(d.participant_id))) return out_({ ok: false, error: "bad id" });
    const sh = sheet_();
    // ignore exact re-sends of the same record
    const last = sh.getLastRow();
    if (last > 1) {
      const ids = sh.getRange(2, 2, last - 1, 1).getValues().flat();
      if (ids.indexOf(d.log_id) !== -1) return out_({ ok: true, duplicate: true });
    }
    const clip = (s, n) => String(s || "").slice(0, n);
    sh.appendRow([new Date(), clip(d.log_id, 64), clip(d.time, 40), d.enumerator, String(d.participant_id),
      clip(d.action, 30), clip(d.outcome, 30), clip(d.tags, 200), clip(d.note, 300), clip(d.next_call, 10)]);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** The update script downloads all records with the ADMIN token. */
function doGet(e) {
  const p = e.parameter || {};
  if (p.action !== "export" || tokens_().ADMIN !== p.token) return out_({ ok: false });
  const v = sheet_().getDataRange().getValues();
  const head = v.shift() || COLS;
  const rows = v.map((r) => {
    const o = {};
    head.forEach((h, i) => { o[h] = r[i] instanceof Date ? r[i].toISOString() : String(r[i]); });
    return o;
  });
  return out_({ ok: true, rows: rows });
}
