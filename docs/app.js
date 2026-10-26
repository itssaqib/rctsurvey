/* Sunni–Shia fieldwork tracker. Data arrive encrypted (AES-GCM, key from the
   passphrase via PBKDF2); nothing readable is ever stored on the server.
   Calls and payments are saved to the team's Google Sheet and read back live. */
"use strict";
const CODES = ["ENU01","ENU02","ENU03","ENU04","ENU05","ENU06","ENU07","ENU08","ENU09","ENU10","PAY","ADMIN"];
const PAGE = 40;
const $ = (s) => document.querySelector(s);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const today = () => new Date().toISOString().slice(0, 10);

/* ---------------------------------------------------------------- text */
const T = {
  en: {
    title: "Fieldwork Tracker", subtitle: "Sunni–Shia study · participant follow-up", code: "Your code",
    passphrase: "Passphrase", remember: "Remember on this phone", open: "Open my list", updated: "Updated",
    logout: "Log out", search: "Search name, ID or phone", export: "Download list (CSV)",
    exportLogs: "Download my unsent logs", more: "Show more", outcome: "What happened?", tags: "Tags",
    nextCall: "Next call date (optional)", note: "Note (optional)", cancel: "Cancel", save: "Save",
    badPass: "Wrong code or passphrase.", noData: "No data file for this code yet.", allTags: "All tags",
    allEnus: "All enumerators", shown: "shown", of: "of", call: "Call", wa: "WhatsApp", log: "Log call",
    history: "Call history", noCalls: "No calls logged yet.", savedOnline: "Saved.", savedLocal:
    "Saved on this phone. It will be sent when you are online.", pending: "not yet synced",
    main: "Main", w2: "2-week", w4: "4-week", due: "due", since: "since", refresh: "Refresh",
    synced: "Live updates loaded", syncFail: "Could not load live updates (offline?)",
    stat_total: "My participants", stat_today: "Call today",
    stat_inprog: "Started, no video yet", stat_fudue: "Follow-up due",
    stat_full: "Full compliance (target)", stat_partial: "Partial compliance (saw video)",
    stat_fu2done: "2-week done (full + partial)", stat_fu4done: "4-week done (full + partial)",
    stat_paystate: "Payments: paid / pending",
    full: "Full compliance", partial: "Partial compliance",
    pay2: "2-week payment", pay4: "4-week payment", paid: "Paid", payDue: "Due", markPaid: "Mark as paid",
    method: "Method", payNumber: "Account number", amount: "Amount (PKR)", reference: "Transaction ID / reference",
    payDate: "Payment date", stat_pay2due: "2-week payments due", stat_pay4due: "4-week payments due",
    stat_paidtoday: "Paid today", stat_paidall: "Paid so far", pkr: "PKR", completed: "completed",
    savedPay: "Payment saved.", needRef: "Enter the transaction ID.",
  },
  ur: {
    title: "فیلڈ ورک ٹریکر", subtitle: "سنی–شیعہ تحقیق · شرکاء سے رابطہ", code: "آپ کا کوڈ",
    passphrase: "پاس فریز", remember: "اس فون پر یاد رکھیں", open: "میری فہرست کھولیں", updated: "اپ ڈیٹ",
    logout: "لاگ آؤٹ", search: "نام، آئی ڈی یا نمبر تلاش کریں", export: "فہرست ڈاؤن لوڈ کریں (CSV)",
    exportLogs: "نہ بھیجی گئی کالز ڈاؤن لوڈ کریں", more: "مزید دکھائیں", outcome: "کیا ہوا؟", tags: "ٹیگ",
    nextCall: "اگلی کال کی تاریخ (اختیاری)", note: "نوٹ (اختیاری)", cancel: "منسوخ", save: "محفوظ کریں",
    badPass: "کوڈ یا پاس فریز غلط ہے۔", noData: "اس کوڈ کی فائل ابھی موجود نہیں۔", allTags: "تمام ٹیگ",
    allEnus: "تمام انیومریٹرز", shown: "دکھائے گئے", of: "میں سے", call: "کال", wa: "واٹس ایپ", log: "کال درج کریں",
    history: "کالز کی تاریخ", noCalls: "ابھی کوئی کال درج نہیں۔", savedOnline: "محفوظ ہو گیا۔", savedLocal:
    "اس فون پر محفوظ ہے، انٹرنیٹ ملنے پر بھیج دیا جائے گا۔", pending: "ابھی سنک نہیں ہوا",
    main: "مرکزی سروے", w2: "2 ہفتے", w4: "4 ہفتے", due: "مقررہ", since: "سے", refresh: "تازہ کریں",
    synced: "تازہ معلومات آ گئیں", syncFail: "تازہ معلومات نہیں آ سکیں (انٹرنیٹ؟)",
    stat_total: "میرے شرکاء", stat_today: "آج کال کریں",
    stat_inprog: "شروع، ابھی ویڈیو نہیں", stat_fudue: "فالو اپ باقی",
    stat_full: "مکمل شرکت (ہدف)", stat_partial: "جزوی شرکت (ویڈیو دیکھی)",
    stat_fu2done: "2 ہفتے مکمل (مکمل + جزوی)", stat_fu4done: "4 ہفتے مکمل (مکمل + جزوی)",
    stat_paystate: "ادائیگی: ہو گئی / باقی",
    full: "مکمل شرکت", partial: "جزوی شرکت",
    pay2: "2 ہفتے کی ادائیگی", pay4: "4 ہفتے کی ادائیگی", paid: "ادا ہو گئی", payDue: "باقی", markPaid: "ادائیگی درج کریں",
    method: "طریقہ", payNumber: "اکاؤنٹ نمبر", amount: "رقم (روپے)", reference: "ٹرانزیکشن آئی ڈی",
    payDate: "ادائیگی کی تاریخ", stat_pay2due: "2 ہفتے کی ادائیگیاں باقی", stat_pay4due: "4 ہفتے کی ادائیگیاں باقی",
    stat_paidtoday: "آج ادا کی گئیں", stat_paidall: "اب تک ادا", pkr: "روپے", completed: "مکمل",
    savedPay: "ادائیگی محفوظ ہو گئی۔", needRef: "ٹرانزیکشن آئی ڈی لکھیں۔",
  },
};
const STATUS = {
  en: { not_started: "Not started", in_progress: "Started (open)", stopped: "Started, closed", completed: "Completed",
        partial: "Saw video, not finished", declined: "Declined consent", not_eligible: "—", not_yet: "Not yet due",
        due: "Due", overdue: "Overdue", done: "Done", missed: "Missed (4-week took over)" },
  ur: { not_started: "شروع نہیں کیا", in_progress: "شروع (کھلا)", stopped: "شروع، بند", completed: "مکمل",
        partial: "ویڈیو دیکھی، مکمل نہیں", declined: "رضامندی نہیں دی", not_eligible: "—", not_yet: "ابھی وقت نہیں",
        due: "وقت آ گیا", overdue: "تاخیر", done: "مکمل", missed: "رہ گیا (اب 4 ہفتے)" },
};
const ACTION = {
  en: { main_invite: "Send the main survey link and ask them to fill it",
        main_remind: "Remind to finish the main survey (same phone continues where they stopped)",
        main_restart: "Ask them to fill the main survey again (their earlier attempt closed)",
        wait_main: "Main survey in progress — wait",
        fu2: "2-week follow-up: send link / call", fu4: "4-week follow-up: send link / call",
        wait_fu: "Follow-up started today — wait", wait_followup: "Waiting for the next follow-up",
        all_done: "All surveys done", do_not_contact: "Do not contact" },
  ur: { main_invite: "مرکزی سروے کا لنک بھیجیں اور مکمل کرنے کا کہیں",
        main_remind: "مرکزی سروے مکمل کرنے کی یاد دہانی کرائیں (اسی فون پر وہیں سے جاری ہو گا)",
        main_restart: "مرکزی سروے دوبارہ مکمل کرنے کا کہیں (پچھلی کوشش بند ہو چکی)",
        wait_main: "مرکزی سروے جاری ہے — انتظار کریں",
        fu2: "2 ہفتے کا فالو اپ: لنک بھیجیں / کال کریں", fu4: "4 ہفتے کا فالو اپ: لنک بھیجیں / کال کریں",
        wait_fu: "فالو اپ آج شروع ہوا — انتظار کریں", wait_followup: "اگلے فالو اپ کا انتظار",
        all_done: "تمام سروے مکمل", do_not_contact: "رابطہ نہ کریں" },
};
const OUTCOMES = [
  ["reached", "Reached — will fill it", "بات ہوئی — سروے کریں گے"],
  ["reached_done", "Reached — says already done", "بات ہوئی — کہتے ہیں مکمل کر لیا"],
  ["whatsapp_sent", "WhatsApp message sent", "واٹس ایپ پیغام بھیجا"],
  ["no_answer", "No answer", "جواب نہیں دیا"],
  ["busy", "Busy", "مصروف"],
  ["switched_off", "Phone switched off", "فون بند"],
  ["call_back", "Asked to call back later", "بعد میں کال کرنے کا کہا"],
  ["wrong_number", "Wrong number", "غلط نمبر"],
  ["refused", "Refused — do not contact again", "انکار — دوبارہ رابطہ نہ کریں"],
];
const PAY_OUTCOMES = [["paid_fu2", "Paid — 2-week (PKR 200)", "ادائیگی — 2 ہفتے (200 روپے)"],
                      ["paid_fu4", "Paid — 4-week (PKR 150)", "ادائیگی — 4 ہفتے (150 روپے)"]];
const TAGS = [
  ["callback", "Call back", "دوبارہ کال"], ["wrong_number", "Wrong number", "غلط نمبر"],
  ["switched_off", "Phone off", "فون بند"], ["whatsapp_only", "WhatsApp only", "صرف واٹس ایپ"],
  ["language_help", "Needs help reading", "پڑھنے میں مدد"], ["payment_issue", "Payment issue", "ادائیگی کا مسئلہ"],
  ["refused", "Refused", "انکار"],
];
const MSG = {
  main_invite: "السلام علیکم {name}! آپ نے ہماری تحقیق کے لیے رجسٹریشن کروائی تھی۔ براہِ کرم یہ مختصر سروے مکمل کریں: {link}\nسروے میں اپنا یہی موبائل نمبر لکھیں: {phone}\nسروے اور دو مختصر فالو اپ مکمل کرنے پر آپ کو 350 روپے جاز کیش یا ایزی پیسہ کے ذریعے ملیں گے۔ شکریہ",
  main_remind: "السلام علیکم {name}! آپ نے ہمارا سروے شروع کیا تھا لیکن وہ ابھی مکمل نہیں ہوا۔ براہِ کرم اسی فون پر یہ لنک کھولیں، سروے وہیں سے شروع ہو گا جہاں آپ نے چھوڑا تھا: {link}\nاگر سروے شروع سے کھلے تو اپنا موبائل نمبر اس طرح لکھیں: {phone}\nشکریہ",
  main_restart: "السلام علیکم {name}! آپ کا پچھلا سروے مکمل نہیں ہوا تھا اور اب بند ہو چکا ہے۔ براہِ کرم یہ لنک کھول کر سروے دوبارہ شروع سے مکمل کریں: {link}\nاپنا موبائل نمبر اس طرح لکھیں: {phone}\nشکریہ",
  fu2: "السلام علیکم {name}! ہمارے سروے میں حصہ لینے کا شکریہ۔ اب دو ہفتے بعد کا مختصر فالو اپ سروے حاضر ہے (تقریباً 10 منٹ): {link}\nاپنا موبائل نمبر اس طرح لکھیں: {phone}\nمکمل کرنے پر آپ کو 200 روپے بھیجے جائیں گے۔ شکریہ",
  fu2_continue: "السلام علیکم {name}! آپ نے دو ہفتے والا فالو اپ سروے شروع کیا تھا۔ براہِ کرم اسی فون پر یہ لنک کھول کر مکمل کریں، سروے وہیں سے شروع ہو گا: {link}\nمکمل کرنے پر آپ کو 200 روپے بھیجے جائیں گے۔ شکریہ",
  fu2_again: "السلام علیکم {name}! آپ کا دو ہفتے والا فالو اپ سروے مکمل نہیں ہوا تھا۔ براہِ کرم یہ لنک کھول کر دوبارہ مکمل کریں: {link}\nاپنا موبائل نمبر اس طرح لکھیں: {phone}\nمکمل کرنے پر آپ کو 200 روپے بھیجے جائیں گے۔ شکریہ",
  fu4: "السلام علیکم {name}! یہ ہمارا آخری مختصر فالو اپ سروے ہے (تقریباً 10 منٹ): {link}\nاپنا موبائل نمبر اس طرح لکھیں: {phone}\nمکمل کرنے پر آپ کو 150 روپے بھیجے جائیں گے۔ شکریہ",
  fu4_continue: "السلام علیکم {name}! آپ نے آخری فالو اپ سروے شروع کیا تھا۔ براہِ کرم اسی فون پر یہ لنک کھول کر مکمل کریں، سروے وہیں سے شروع ہو گا: {link}\nمکمل کرنے پر آپ کو 150 روپے بھیجے جائیں گے۔ شکریہ",
  fu4_again: "السلام علیکم {name}! آپ کا آخری فالو اپ سروے مکمل نہیں ہوا تھا۔ براہِ کرم یہ لنک کھول کر دوبارہ مکمل کریں: {link}\nاپنا موبائل نمبر اس طرح لکھیں: {phone}\nمکمل کرنے پر آپ کو 150 روپے بھیجے جائیں گے۔ شکریہ",
};
const FU_ACTIVE = ["due", "overdue", "in_progress", "stopped"];
const payDue = (p) => (p.pay2 && p.pay2.status === "due") || (p.pay4 && p.pay4.status === "due");
const payPaid = (p) => (p.pay2 && p.pay2.status === "paid") || (p.pay4 && p.pay4.status === "paid");
const FILTERS = [
  ["today", (p) => p.call_today, "Call today", "آج کال کریں"],
  ["all", () => true, "All", "سب"],
  ["not_started", (p) => p.main_status === "not_started", "Not started", "شروع نہیں کیا"],
  ["started", (p) => ["in_progress", "stopped"].includes(p.main_status), "Started, no video", "شروع، ویڈیو نہیں"],
  ["full", (p) => p.compliance === "full", "Full compliance", "مکمل شرکت"],
  ["partial", (p) => p.compliance === "partial", "Partial compliance", "جزوی شرکت"],
  ["fu2", (p) => FU_ACTIVE.includes(p.fu2_status), "2-week due", "2 ہفتے باقی"],
  ["fu4", (p) => FU_ACTIVE.includes(p.fu4_status), "4-week due", "4 ہفتے باقی"],
  ["fu2done", (p) => p.fu2_status === "done", "2-week done", "2 ہفتے مکمل"],
  ["fu4done", (p) => p.fu4_status === "done", "4-week done", "4 ہفتے مکمل"],
  ["paydue", payDue, "Payment pending", "ادائیگی باقی"],
  ["paid", payPaid, "Paid", "ادائیگی ہو گئی"],
  ["dnc", (p) => p.action === "do_not_contact", "Do not contact", "رابطہ نہ کریں"],
];
const PAY_FILTERS = [
  ["pay2due", (p) => p.pay2.status === "due", "2-week due (PKR 200)", "2 ہفتے باقی (200)"],
  ["pay4due", (p) => p.pay4.status === "due", "4-week due (PKR 150)", "4 ہفتے باقی (150)"],
  ["paid", payPaid, "Paid", "ادا ہو گئی"],
  ["all", () => true, "All", "سب"],
];

/* ---------------------------------------------------------------- state */
let lang = store.get("ss_lang") || "en";
let D = null, AUTH = null;     // decrypted data; code + passphrase kept in memory for Refresh
let filter = "today", shown = PAGE, current = null, payCurrent = null;
const t = (k) => (T[lang][k] ?? T.en[k] ?? k);
const lbl = (row) => (lang === "ur" ? row[2] : row[1]);
const isPay = () => D && D.role === "pay";

/* ---------------------------------------------------------------- crypto */
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function decrypt(blob, pass) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(blob.salt), iterations: blob.iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(blob.iv) }, key, b64(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

/* ---------------------------------------------------------------- language */
function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
  document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll("[data-tp]").forEach((el) => { el.placeholder = t(el.dataset.tp); });
  document.querySelectorAll("[data-lang-toggle]").forEach((el) => { el.textContent = lang === "ur" ? "English" : "اردو"; });
  if (D) { fillSelects(); render(); }
}
document.querySelectorAll("[data-lang-toggle]").forEach((el) =>
  el.addEventListener("click", () => { lang = lang === "ur" ? "en" : "ur"; store.set("ss_lang", lang); applyLang(); }));

/* ---------------------------------------------------------------- login / refresh */
const codeSel = $("#codeSel");
CODES.forEach((c) => codeSel.add(new Option(
  c === "ADMIN" ? "ADMIN (research team)" : c === "PAY" ? "PAY (payments — CANE Technologies)" : c, c)));
async function loadData(code, pass) {
  const r = await fetch(`data/${code}.json.enc?v=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error("nodata");
  return decrypt(await r.json(), pass);
}
async function login(code, pass, remember) {
  $("#loginErr").hidden = true;
  $("#loginBtn").disabled = true;
  try {
    D = await loadData(code, pass);
    AUTH = { code, pass };
    if (remember) store.set("ss_auth", JSON.stringify({ code, pass })); else store.del("ss_auth");
    $("#login").hidden = true; $("#main").hidden = false;
    $("#whoCode").textContent = code; $("#genTime").textContent = D.generated;
    filter = isPay() ? "pay2due" : "today";
    setupMain(); render();
    await flushPending(); await syncLive(false);
  } catch (e) {
    $("#loginErr").textContent = e.message === "nodata" ? t("noData") : t("badPass");
    $("#loginErr").hidden = false;
  } finally { $("#loginBtn").disabled = false; }
}
$("#loginBtn").addEventListener("click", () => login(codeSel.value, $("#pass").value.trim(), $("#remember").checked));
$("#pass").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#loginBtn").click(); });
$("#logoutBtn").addEventListener("click", () => { store.del("ss_auth"); location.reload(); });
$("#refreshBtn").addEventListener("click", async () => {
  if (!AUTH) return;
  try { D = await loadData(AUTH.code, AUTH.pass); $("#genTime").textContent = D.generated; } catch (e) {}
  await flushPending(); await syncLive(true);
});

/* ---------------------------------------------------------------- live sync with the Google Sheet */
async function syncLive(announce) {
  const inData = new Set(D.people.flatMap((p) => (p.calls || []).map((c) => c.log_id)));
  setPending(pending().filter((l) => !inData.has(l.log_id)));     // already in the published data
  if (!D.apps_script_url) { render(); return; }
  try {
    const u = `${D.apps_script_url}?action=mine&code=${encodeURIComponent(D.code)}&token=${encodeURIComponent(D.log_token)}`;
    const r = await fetch(u, { cache: "no-store" });
    const j = await r.json();
    if (j.ok) applyLive(j.rows || []);
    if (announce) toast(t("synced"));
  } catch (e) { if (announce) toast(t("syncFail")); }
  render();
}
function applyLive(rows) {
  const byPid = new Map(D.people.map((p) => [p.pid, p]));
  rows.sort((a, b) => String(a.time).localeCompare(String(b.time)));
  for (const r of rows) {
    const p = byPid.get(String(r.participant_id));
    if (!p) continue;
    p.calls = p.calls || [];
    if (p.calls.some((c) => c.log_id === r.log_id)) continue;
    p.calls.push(r);
    applyOne(p, r);
  }
  const have = new Set(D.people.flatMap((p) => (p.calls || []).map((c) => c.log_id)));
  setPending(pending().filter((l) => !have.has(l.log_id)));
}
function applyOne(p, r) {    // what a new call / payment record changes on the card straight away
  const w = { paid_fu2: "pay2", paid_fu4: "pay4" }[r.outcome];
  if (w) {
    p[w] = { ...(p[w] || {}), status: "paid", date: String(r.time).slice(0, 10), ref: r.reference || "",
             method: r.method || (p[w] || {}).method || "", number: r.pay_number || (p[w] || {}).number || "",
             amount: r.amount || (p[w] || {}).amount };
    return;
  }
  p.n_calls = (p.n_calls || 0) + 1;
  if (String(r.time).slice(0, 10) === today()) p.call_today = false;
  if (r.next_call) { p.next_call = r.next_call; if (r.next_call > today()) p.call_today = false; }
  const tg = String(r.tags || "").split(",").filter(Boolean);
  p.tags = [...new Set([...(p.tags || []), ...tg])];
  if (r.outcome === "refused") { p.action = "do_not_contact"; p.call_today = false; }
  if (r.outcome === "wrong_number" || tg.includes("wrong_number")) p.call_today = false;
}

/* ---------------------------------------------------------------- pending records (offline-safe) */
const pendKey = () => `ss_pending_${D.code}`;
const pending = () => { try { return JSON.parse(store.get(pendKey()) || "[]"); } catch (e) { return []; } };
const setPending = (a) => store.set(pendKey(), JSON.stringify(a));
function logsFor(p) {
  const known = new Set((p.calls || []).map((c) => c.log_id));
  const extra = pending().filter((l) => l.participant_id === p.pid && !known.has(l.log_id)).map((l) => ({ ...l, _pending: true }));
  return [...(p.calls || []), ...extra];
}
async function sendLog(l) {
  if (!D.apps_script_url) return false;
  try {   // text/plain avoids a CORS pre-flight; Apps Script appends the row
    await fetch(D.apps_script_url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(l) });
    return true;
  } catch (e) { return false; }
}
async function flushPending() {
  const all = pending(); if (!all.length || !D.apps_script_url) return;
  const left = [];
  for (const l of all) { if (l._sent) { left.push(l); continue; } left.push((await sendLog(l)) ? { ...l, _sent: true } : l); }
  setPending(left);
}
window.addEventListener("online", () => D && flushPending());
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
async function record(p, fields, okMsg) {
  const l = { log_id: newId(), time: new Date().toISOString(), enumerator: D.code, token: D.log_token,
              owner: p.enumerator, participant_id: p.pid, ...fields };
  const ok = await sendLog(l);
  setPending([...pending(), { ...l, _sent: ok }]);
  applyOne(p, l);
  toast(ok ? okMsg : t("savedLocal"));
  render();
}

/* ---------------------------------------------------------------- main view */
function fillSelects() {
  const many = D.role === "admin" || D.role === "pay";
  const tagSel = $("#tagSel"), enuSel = $("#enuSel");
  const keepTag = tagSel.value, keepEnu = enuSel.value;
  tagSel.innerHTML = ""; tagSel.hidden = isPay();
  tagSel.add(new Option(t("allTags"), ""));
  TAGS.forEach((r) => tagSel.add(new Option(lbl(r), r[0])));
  enuSel.hidden = !many; enuSel.innerHTML = "";
  if (many) { enuSel.add(new Option(t("allEnus"), "")); D.enumerators.forEach((e) => enuSel.add(new Option(e, e))); }
  tagSel.value = keepTag; enuSel.value = keepEnu;
}
function setupMain() {
  fillSelects();
  ["#search", "#tagSel", "#enuSel"].forEach((s) => $(s).addEventListener("input", () => { shown = PAGE; render(); }));
  $("#moreBtn").onclick = () => { shown += PAGE; renderList(); };
  $("#exportBtn").onclick = () => (isPay() ? exportPay() : exportCsv());
  $("#exportLogsBtn").onclick = exportLogs;
}
function base() {
  const e = $("#enuSel").value;
  return D.people.filter((p) => !e || p.enumerator === e);
}
function render() { renderStats(); renderAdmin(); renderChips(); renderList(); }
const statCard = ([f, l, v, pct]) =>
  `<button class="stat ${filter === f ? "hl" : ""}" data-f="${f}"><div class="n">${v}</div><div class="l">${l}</div>
    ${pct === undefined ? "" : `<div class="bar"><span style="width:${pct.toFixed(1)}%"></span></div>`}</button>`;
function renderStats() {
  const ps = base();
  const n = (f) => ps.filter(f).length;
  let cards;
  if (isPay()) {
    const sum = (k, st) => ps.filter((p) => p[k].status === st).reduce((s, p) => s + Number(p[k].amount || 0), 0);
    const paidOn = (d) => ps.reduce((s, p) => s + ["pay2", "pay4"].filter((k) => p[k].status === "paid" && p[k].date === d).length, 0);
    cards = [
      ["pay2due", t("stat_pay2due"), `${n((p) => p.pay2.status === "due")} · ${t("pkr")} ${sum("pay2", "due").toLocaleString()}`],
      ["pay4due", t("stat_pay4due"), `${n((p) => p.pay4.status === "due")} · ${t("pkr")} ${sum("pay4", "due").toLocaleString()}`],
      ["paid", t("stat_paidtoday"), paidOn(today()).toLocaleString()],
      ["paid", t("stat_paidall"), `${ps.reduce((s, p) => s + ["pay2", "pay4"].filter((k) => p[k].status === "paid").length, 0)} · ${t("pkr")} ${(sum("pay2", "paid") + sum("pay4", "paid")).toLocaleString()}`],
    ];
  } else {
    const target = (D.target || 300) * (D.role === "admin" && !$("#enuSel").value ? D.enumerators.length : 1);
    const full = n((p) => p.compliance === "full"), part = n((p) => p.compliance === "partial");
    const split = (st) => `${n((p) => p.compliance === "full" && p[st] === "done")} + ${n((p) => p.compliance === "partial" && p[st] === "done")}`;
    const paidN = ps.reduce((s, p) => s + ["pay2", "pay4"].filter((k) => p[k] && p[k].status === "paid").length, 0);
    const dueN = ps.reduce((s, p) => s + ["pay2", "pay4"].filter((k) => p[k] && p[k].status === "due").length, 0);
    cards = [
      ["full", t("stat_full"), `${full.toLocaleString()} / ${target.toLocaleString()}`, Math.min(100, (100 * full) / target)],
      ["partial", t("stat_partial"), part.toLocaleString()],
      ["today", t("stat_today"), n((p) => p.call_today).toLocaleString()],
      ["started", t("stat_inprog"), n((p) => ["in_progress", "stopped"].includes(p.main_status)).toLocaleString()],
      ["fu2done", t("stat_fu2done"), split("fu2_status")],
      ["fu4done", t("stat_fu4done"), split("fu4_status")],
      ["fu2", t("stat_fudue"), n((p) => ["fu2", "fu4"].includes(p.action)).toLocaleString()],
      ["paydue", t("stat_paystate"), `${paidN} / ${dueN}`],
    ];
  }
  $("#stats").innerHTML = cards.map(statCard).join("");
  $("#stats").querySelectorAll(".stat").forEach((b) => b.onclick = () => { filter = b.dataset.f; shown = PAGE; render(); });
}
function renderAdmin() {
  const panel = $("#adminPanel");
  if (D.role !== "admin") { panel.hidden = true; return; }
  panel.hidden = false;
  const rows = D.enumerators.map((e) => {
    const ps = D.people.filter((p) => p.enumerator === e);
    const c = (f) => ps.filter(f).length;
    const done = c((p) => p.compliance === "full");
    const fp = (st, k) => c((p) => p.compliance === k && p[st] === "done");
    const pays = (st) => ps.reduce((s, p) => s + ["pay2", "pay4"].filter((k) => p[k] && p[k].status === st).length, 0);
    return `<tr><td>${e}</td><td>${ps.length}</td><td>${done}</td><td>${(100 * done / (D.target || 300)).toFixed(0)}%</td>
      <td>${c((p) => p.compliance === "partial")}</td>
      <td>${c((p) => ["in_progress", "stopped"].includes(p.main_status))}</td><td>${c((p) => p.call_today)}</td>
      <td>${fp("fu2_status", "full")} + ${fp("fu2_status", "partial")}</td><td>${fp("fu4_status", "full")} + ${fp("fu4_status", "partial")}</td>
      <td>${c((p) => p.fu2_status === "overdue" || p.fu4_status === "overdue")}</td>
      <td>${pays("paid")} / ${pays("due")}</td>
      <td>${ps.reduce((s, p) => s + (p.n_calls || 0), 0)}</td>
      <td>${ps.reduce((s, p) => s + (p.calls || []).filter((x) => String(x.time).slice(0, 10) === today() && !String(x.outcome).startsWith("paid")).length, 0)}</td></tr>`;
  }).join("");
  const um = D.unmatched || [];
  const flags = [
    ["Under 18", D.people.filter((p) => p.under_18 === "Yes").length],
    ["Completed main survey twice (pay once)", D.people.filter((p) => p.n_completed > 1).length],
    ["Partial compliance: saw a video, not finished (in follow-ups, never restarted)", D.people.filter((p) => p.compliance === "partial").length],
    ["Shown a video in more than one attempt", D.people.filter((p) => p.n_video_attempts > 1).length],
    ["Declined consent / refused", D.people.filter((p) => p.action === "do_not_contact").length],
    ["2-week missed (4-week took over)", D.people.filter((p) => p.fu2_status === "missed").length],
    ["Follow-ups from numbers not in the study", um.length],
  ];
  panel.innerHTML = `<div class="admin-scroll"><table class="admin-table"><thead><tr><th>Enumerator</th><th>People</th>
    <th>Full</th><th>% of ${D.target || 300}</th><th>Partial</th><th>Started (no video)</th><th>Call today</th>
    <th>2-wk done (full + partial)</th><th>4-wk done (full + partial)</th><th>Overdue</th><th>Payments paid / due</th>
    <th>Calls (all)</th><th>Calls today</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="chips">${flags.map(([l, v]) => `<span class="b ${v ? "warn" : ""}">${l}: ${v}</span>`).join("")}</div>
    ${um.length ? `<details class="hist"><summary>Follow-ups from numbers not in the study (${um.length}) — match them by hand</summary><ul>
      ${um.map((u) => `<li>${esc(u.wave)} · ${esc(u.date)} · typed: ${esc(u.phone_typed)} · ${esc(u.name)} · ${u.finished ? "finished" : "not finished"} · ${esc(u.response_id)}</li>`).join("")}</ul></details>` : ""}`;
}
function renderChips() {
  const ps = base();
  const list = isPay() ? PAY_FILTERS : FILTERS;
  $("#chips").innerHTML = list.map(([k, f, en, ur]) =>
    `<button class="chip ${filter === k ? "on" : ""}" data-k="${k}">${lang === "ur" ? ur : en}<span class="k">${ps.filter(f).length}</span></button>`).join("");
  $("#chips").querySelectorAll(".chip").forEach((b) => b.onclick = () => { filter = b.dataset.k; shown = PAGE; render(); });
}
function filtered() {
  const list = isPay() ? PAY_FILTERS : FILTERS;
  const f = (list.find((x) => x[0] === filter) || list[list.length - 1])[1];
  const q = $("#search").value.trim().toLowerCase();
  const tag = isPay() ? "" : $("#tagSel").value;
  const rank = { fu4: 0, fu2: 1, main_remind: 2, main_restart: 2, main_invite: 3 };
  return base().filter(f)
    .filter((p) => !tag || (p.tags || []).includes(tag) || pending().some((l) => l.participant_id === p.pid && (l.tags || "").includes(tag)))
    .filter((p) => !q || `${p.name} ${p.pid} ${p.phone} ${(p.pay2 || {}).number || ""} ${(p.pay4 || {}).number || ""}`.toLowerCase().includes(q))
    .sort(isPay()
      ? (a, b) => String(a.fu2_date || a.fu4_date).localeCompare(String(b.fu2_date || b.fu4_date)) || a.pid.localeCompare(b.pid)
      : (a, b) => (rank[a.action] ?? 9) - (rank[b.action] ?? 9) || String(a.fu4_due || a.fu2_due).localeCompare(String(b.fu4_due || b.fu2_due)) || a.pid.localeCompare(b.pid));
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tone = (s) => ({ completed: "ok", done: "ok", paid: "ok", in_progress: "info", partial: "info", due: "warn",
  stopped: "warn", overdue: "bad", declined: "bad", missed: "bad" }[s] || "");
function badge(label, s, extra = "") {
  if (s === "not_eligible") return "";
  return `<span class="b ${tone(s)}">${label}: ${STATUS[lang][s] || s}${extra}</span>`;
}
function payBadge(label, pay) {
  if (!pay || pay.status === "not_due") return "";
  return pay.status === "paid"
    ? `<span class="b ok">${label}: ${t("paid")} ✓ ${esc(pay.date)}</span>`
    : `<span class="b warn">${label}: ${t("payDue")} (${t("pkr")} ${esc(pay.amount)})</span>`;
}
function waLink(p) {
  let key = "";
  if (p.link === "main") key = p.action === "main_invite" ? "main_invite" : (p.main_status === "stopped" ? "main_restart" : "main_remind");
  else if (p.link === "fu2" || p.link === "fu4") {
    const st = p[`${p.link}_status`];
    key = p.link + (st === "in_progress" ? "_continue" : st === "stopped" ? "_again" : "");
  }
  const tpl = MSG[key] || "";
  const link = (D.links || {})[p.link] || "";
  const text = tpl ? tpl.replace("{name}", p.name || "").replace("{link}", link).replace("{phone}", p.phone) : "";
  return `https://wa.me/92${p.phone.slice(1)}${text ? "?text=" + encodeURIComponent(text) : ""}`;
}
function renderList() {
  const all = filtered();
  const items = all.slice(0, shown);
  $("#count").textContent = `${items.length.toLocaleString()} ${t("shown")} · ${all.length.toLocaleString()}`;
  $("#moreBtn").hidden = all.length <= shown;
  $("#list").innerHTML = items.map((p) => (isPay() ? payCard(p) : personCard(p))).join("");
  $("#list").querySelectorAll("[data-log]").forEach((b) => b.onclick = () => openLog(b.dataset.log));
  $("#list").querySelectorAll("[data-pay]").forEach((b) => b.onclick = () => openPay(...b.dataset.pay.split("|")));
}
function histList(logs) {
  return logs.length ? `<ul>${logs.slice().reverse().map((l) => `<li>${esc(String(l.time).slice(0, 16).replace("T", " "))} · ${esc(l.enumerator)} ·
    ${esc(lbl([...OUTCOMES, ...PAY_OUTCOMES].find((o) => o[0] === l.outcome) || [l.outcome, l.outcome, l.outcome]))}
    ${l.reference ? "· " + esc(l.reference) : ""}${l.note ? " · " + esc(l.note) : ""}${l._pending ? ` <i>(${t("pending")})</i>` : ""}</li>`).join("")}</ul>`
    : `<p>${t("noCalls")}</p>`;
}
function personCard(p) {
  const logs = logsFor(p);
  const prog = ["in_progress", "stopped", "partial"].includes(p.main_status) ? ` ${p.main_progress}%` : "";
  const due = (w) => (["due", "overdue", "not_yet", "in_progress", "stopped"].includes(p[`${w}_status`]) ? ` · ${p[`${w}_due`]}` : "");
  const canMsg = p.action !== "do_not_contact";
  const tags = [...new Set([...(p.tags || []), ...logs.filter((l) => l._pending).flatMap((l) => String(l.tags || "").split(",").filter(Boolean))])];
  return `<article class="card ${p.call_today ? "today" : ""}">
    <div class="row1"><span class="nm">${esc(p.name) || "—"}</span>
      <span class="meta">${p.pid} · ${p.phone}${D.role === "admin" ? " · " + p.enumerator : ""}</span></div>
    <div class="meta">${esc([p.district, p.province].filter(Boolean).join(", "))}</div>
    <div class="badges">${p.compliance ? `<span class="b ${p.compliance === "full" ? "ok" : "info"} strong">${t(p.compliance)}</span>` : ""}${badge(t("main"), p.main_status, prog)}${badge(t("w2"), p.fu2_status, due("fu2"))}${badge(t("w4"), p.fu4_status, due("fu4"))}
      ${payBadge(t("pay2"), p.pay2)}${payBadge(t("pay4"), p.pay4)}
      ${D.role === "admin" && p.under_18 === "Yes" ? '<span class="b bad">Under 18</span>' : ""}</div>
    <div class="act">➜ <b>${ACTION[lang][p.action] || p.action}</b>${p.next_call ? ` · ${t("nextCall").split(" (")[0]}: ${p.next_call}` : ""}</div>
    ${tags.length ? `<div class="tagline">${tags.map((g) => `<span class="tg">${esc(lbl(TAGS.find((x) => x[0] === g) || [g, g, g]))}</span>`).join("")}</div>` : ""}
    <div class="btns" style="margin-top:8px">
      <a class="btn" href="tel:${p.phone}">📞 ${t("call")}</a>
      <a class="btn" ${canMsg ? `href="${waLink(p)}" target="_blank" rel="noopener"` : 'aria-disabled="true" style="opacity:.45;pointer-events:none"'}>💬 ${t("wa")}</a>
      <button class="btn primary" data-log="${p.pid}">✎ ${t("log")}</button>
    </div>
    <details class="hist"><summary>${t("history")} (${logs.length})</summary>${histList(logs)}</details></article>`;
}
function payCard(p) {
  const logs = logsFor(p).filter((l) => String(l.outcome).startsWith("paid"));
  const block = (w, label, doneDate) => {
    const pay = p[w];
    if (pay.status === "not_due") return "";
    const head = `<b>${label} — ${t("pkr")} ${esc(pay.amount)}</b> · ${t("completed")} ${esc(doneDate)}`;
    return pay.status === "paid"
      ? `<div class="paybox ok">${head}<br>${t("paid")} ✓ ${esc(pay.date)} · ${esc(pay.method)} ${esc(pay.number)} · ${esc(pay.ref)}</div>`
      : `<div class="paybox due">${head}<br>${esc(pay.method || "—")} · <span class="num">${esc(pay.number)}</span>
         <button class="btn primary sm" data-pay="${p.pid}|${w}">✓ ${t("markPaid")}</button></div>`;
  };
  return `<article class="card ${payDue(p) ? "today" : ""}">
    <div class="row1"><span class="nm">${esc(p.name) || "—"}</span><span class="meta">${p.pid} · ${p.phone} · ${p.enumerator}</span></div>
    <div class="meta">${esc([p.district, p.province].filter(Boolean).join(", "))}</div>
    ${block("pay2", t("pay2"), p.fu2_date)}${block("pay4", t("pay4"), p.fu4_date)}
    <details class="hist"><summary>${t("history")} (${logs.length})</summary>${histList(logs)}</details></article>`;
}

/* ---------------------------------------------------------------- call-log dialog */
function openLog(pid) {
  current = D.people.find((p) => p.pid === pid);
  $("#logTitle").textContent = `${current.name || "—"} · ${current.pid}`;
  $("#logSub").textContent = ACTION[lang][current.action] || "";
  const sel = $("#outcome"); sel.innerHTML = "";
  OUTCOMES.forEach((o) => sel.add(new Option(lbl(o), o[0])));
  $("#tagPick").innerHTML = TAGS.map((r) => `<button type="button" class="chip" data-tag="${r[0]}">${lbl(r)}</button>`).join("");
  $("#tagPick").querySelectorAll(".chip").forEach((c) => c.onclick = () => c.classList.toggle("on"));
  $("#nextCall").value = ""; $("#note").value = "";
  $("#logDlg").showModal();
}
$("#logForm").addEventListener("submit", async (e) => {
  if (e.submitter && e.submitter.value !== "save") return;
  await record(current, {
    action: current.action, outcome: $("#outcome").value,
    tags: [...$("#tagPick").querySelectorAll(".chip.on")].map((c) => c.dataset.tag).join(","),
    note: $("#note").value.trim().slice(0, 300), next_call: $("#nextCall").value,
  }, t("savedOnline"));
});

/* ---------------------------------------------------------------- payment dialog (PAY login) */
function openPay(pid, w) {
  payCurrent = { p: D.people.find((x) => x.pid === pid), w };
  const pay = payCurrent.p[w];
  $("#payTitle").textContent = `${payCurrent.p.name || "—"} · ${pid} · ${w === "pay2" ? t("pay2") : t("pay4")}`;
  $("#payMethod").value = pay.method || "JazzCash";
  $("#payNumber").value = pay.number || payCurrent.p.phone;
  $("#payAmount").value = pay.amount;
  $("#payRef").value = ""; $("#payNote").value = "";
  $("#payDlg").showModal();
}
$("#payForm").addEventListener("submit", async (e) => {
  if (e.submitter && e.submitter.value !== "save") return;
  if (!$("#payRef").value.trim()) { e.preventDefault(); toast(t("needRef")); return; }
  const { p, w } = payCurrent;
  await record(p, {
    action: "payment", outcome: w === "pay2" ? "paid_fu2" : "paid_fu4",
    amount: $("#payAmount").value, method: $("#payMethod").value, pay_number: $("#payNumber").value.trim(),
    reference: $("#payRef").value.trim().slice(0, 60), note: $("#payNote").value.trim().slice(0, 300),
  }, t("savedPay"));
});
function toast(m) { const el = $("#toast"); el.textContent = m; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => el.hidden = true, 3000); }

/* ---------------------------------------------------------------- exports */
function download(name, rows) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportCsv() {
  const cols = ["pid", "enumerator", "name", "phone", "district", "province", "main_status", "main_progress", "main_done",
    "compliance", "fu2_status", "fu2_due", "fu4_status", "fu4_due", "action", "next_call", "n_calls"];
  download(`${D.code}_list_${today()}.csv`, [[...cols, "pay_2week", "pay_4week"],
    ...filtered().map((p) => [...cols.map((c) => p[c]), (p.pay2 || {}).status, (p.pay4 || {}).status])]);
}
function exportPay() {
  const head = ["participant_id", "name", "wave", "amount_pkr", "method", "account_number", "survey_completed", "status",
    "paid_date", "reference", "enumerator"];
  const rows = [];
  for (const p of filtered()) for (const [w, label, d] of [["pay2", "2-week", p.fu2_date], ["pay4", "4-week", p.fu4_date]]) {
    const pay = p[w];
    if (pay.status === "not_due") continue;
    if (filter === "pay2due" && w !== "pay2") continue;
    if (filter === "pay4due" && w !== "pay4") continue;
    rows.push([p.pid, p.name, label, pay.amount, pay.method, pay.number, d, pay.status, pay.date, pay.ref, p.enumerator]);
  }
  download(`payments_${filter}_${today()}.csv`, [head, ...rows]);
}
function exportLogs() {
  const cols = ["log_id", "time", "enumerator", "owner", "participant_id", "action", "outcome", "tags", "note", "next_call",
    "amount", "method", "pay_number", "reference"];
  download(`call_log_${D.code}_${today()}.csv`, [cols, ...pending().filter((l) => !l._sent).map((l) => cols.map((c) => l[c]))]);
}

/* ---------------------------------------------------------------- start */
applyLang();
(() => { try { const a = JSON.parse(store.get("ss_auth") || "null"); if (a) { codeSel.value = a.code; login(a.code, a.pass, true); } } catch (e) {} })();
