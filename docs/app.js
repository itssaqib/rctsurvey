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
const pad = (n) => String(n).padStart(2, "0");
const localDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => localDay(new Date());
/* any date text from the Sheet -> local YYYY-MM-DD */
function normDay(v) {
  v = String(v || "").trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v.replace(/\s*\(.*\)$/, ""));
  return isNaN(d) ? v.slice(0, 10) : localDay(d);
}

/* ---------------------------------------------------------------- text */
const T = {
  en: {
    title: "Fieldwork Tracker", subtitle: "Sunni–Shia study · participant follow-up", code: "Your code",
    passphrase: "Passphrase", remember: "Remember on this phone", open: "Open my list", updated: "Updated",
    logout: "Log out", search: "Search name, ID or phone", export: "Download list (CSV)",
    exportLogs: "Download my unsent logs", more: "Show more", outcome: "What happened?", tags: "Tags", waPart: "WhatsApp", callPart: "Phone call",
    pickOne: "Choose what happened (WhatsApp, call or both).",
    nextCall: "Next call date (optional)", note: "Note (optional)", cancel: "Cancel", save: "Save",
    badPass: "Wrong code or passphrase.", noData: "No data file for this code yet.", allTags: "All tags",
    allEnus: "All enumerators", shown: "shown", call: "Call", wa: "WhatsApp", log: "Log call",
    history: "History", noCalls: "Nothing logged yet.", savedOnline: "Saved.", savedLocal:
    "Saved on this phone. It will be sent when you are online.", pending: "not yet synced",
    main: "Main", w2: "2-week", w4: "4-week", refresh: "Refresh", nextCallShort: "Next call",
    synced: "Live updates loaded", syncFail: "Could not load live updates (offline?)",
    progress: "Progress to target", perRound: "per round, same people", plusPartial: "+ {n} partial",
    roundMain: "Main survey", round2: "2-week follow-up", round4: "4-week follow-up",
    of: "of", moreFilters: "More…",
    full: "Full compliance", partial: "Partial compliance",
    pay2: "2-week payment", pay4: "4-week payment", paid: "Paid", payDue: "Due", markPaid: "Mark as paid",
    method: "Method", payNumber: "Account number", amount: "Amount (PKR)", reference: "Transaction ID / reference",
    stat_pay2due: "2-week payments due", stat_pay4due: "4-week payments due",
    stat_paidtoday: "Paid today", stat_paidall: "Paid so far", pkr: "PKR", completed: "completed",
    savedPay: "Payment saved.", needRef: "Enter the transaction ID.",
    byEnum: "Completions by enumerator", target: "Target", details: "Details per enumerator",
    checks: "Checks", unmatched: "Follow-ups from numbers not in the study",
  },
  ur: {
    title: "فیلڈ ورک ٹریکر", subtitle: "سنی–شیعہ تحقیق · شرکاء سے رابطہ", code: "آپ کا کوڈ",
    passphrase: "پاس فریز", remember: "اس فون پر یاد رکھیں", open: "میری فہرست کھولیں", updated: "اپ ڈیٹ",
    logout: "لاگ آؤٹ", search: "نام، آئی ڈی یا نمبر تلاش کریں", export: "فہرست ڈاؤن لوڈ کریں (CSV)",
    exportLogs: "نہ بھیجی گئی کالز ڈاؤن لوڈ کریں", more: "مزید دکھائیں", outcome: "کیا ہوا؟", tags: "ٹیگ", waPart: "واٹس ایپ", callPart: "فون کال",
    pickOne: "بتائیں کیا ہوا (واٹس ایپ، کال یا دونوں)۔",
    nextCall: "اگلی کال کی تاریخ (اختیاری)", note: "نوٹ (اختیاری)", cancel: "منسوخ", save: "محفوظ کریں",
    badPass: "کوڈ یا پاس فریز غلط ہے۔", noData: "اس کوڈ کی فائل ابھی موجود نہیں۔", allTags: "تمام ٹیگ",
    allEnus: "تمام انیومریٹرز", shown: "دکھائے گئے", call: "کال", wa: "واٹس ایپ", log: "کال درج کریں",
    history: "تاریخ", noCalls: "ابھی کچھ درج نہیں۔", savedOnline: "محفوظ ہو گیا۔", savedLocal:
    "اس فون پر محفوظ ہے، انٹرنیٹ ملنے پر بھیج دیا جائے گا۔", pending: "ابھی سنک نہیں ہوا",
    main: "مرکزی سروے", w2: "2 ہفتے", w4: "4 ہفتے", refresh: "تازہ کریں", nextCallShort: "اگلی کال",
    synced: "تازہ معلومات آ گئیں", syncFail: "تازہ معلومات نہیں آ سکیں (انٹرنیٹ؟)",
    progress: "ہدف کی طرف پیش رفت", perRound: "ہر مرحلہ، وہی لوگ", plusPartial: "+ {n} جزوی",
    roundMain: "مرکزی سروے", round2: "2 ہفتے کا فالو اپ", round4: "4 ہفتے کا فالو اپ",
    of: "میں سے", moreFilters: "مزید…",
    full: "مکمل شرکت", partial: "جزوی شرکت",
    pay2: "2 ہفتے کی ادائیگی", pay4: "4 ہفتے کی ادائیگی", paid: "ادا ہو گئی", payDue: "باقی", markPaid: "ادائیگی درج کریں",
    method: "طریقہ", payNumber: "اکاؤنٹ نمبر", amount: "رقم (روپے)", reference: "ٹرانزیکشن آئی ڈی",
    stat_pay2due: "2 ہفتے کی ادائیگیاں باقی", stat_pay4due: "4 ہفتے کی ادائیگیاں باقی",
    stat_paidtoday: "آج ادا کی گئیں", stat_paidall: "اب تک ادا", pkr: "روپے", completed: "مکمل",
    savedPay: "ادائیگی محفوظ ہو گئی۔", needRef: "ٹرانزیکشن آئی ڈی لکھیں۔",
    byEnum: "انیومریٹر کے حساب سے", target: "ہدف", details: "ہر انیومریٹر کی تفصیل",
    checks: "جانچ", unmatched: "ایسے نمبروں سے فالو اپ جو تحقیق میں نہیں",
  },
};
const STATUS = {
  en: { not_started: "Not started", in_progress: "Started (open)", stopped: "Started, closed", completed: "Completed",
        partial: "Saw video, not finished", declined: "Declined consent", not_eligible: "—", not_yet: "Not yet due",
        due: "Due", overdue: "Overdue", done: "Done", missed: "Missed" },
  ur: { not_started: "شروع نہیں کیا", in_progress: "شروع (کھلا)", stopped: "شروع، بند", completed: "مکمل",
        partial: "ویڈیو دیکھی، مکمل نہیں", declined: "رضامندی نہیں دی", not_eligible: "—", not_yet: "ابھی وقت نہیں",
        due: "وقت آ گیا", overdue: "تاخیر", done: "مکمل", missed: "رہ گیا" },
};
const ACTION = {
  en: { main_invite: "Send the main survey link",
        main_remind: "Remind to finish the main survey on the same phone",
        main_restart: "Ask them to fill the main survey again (earlier attempt closed)",
        wait_main: "Main survey in progress — wait",
        fu2: "2-week follow-up: send link / remind", fu4: "4-week follow-up: send link / remind",
        wait_fu: "Follow-up started today — wait", wait_followup: "Waiting for the next follow-up",
        all_done: "All surveys done", do_not_contact: "Do not contact" },
  ur: { main_invite: "مرکزی سروے کا لنک بھیجیں",
        main_remind: "اسی فون پر مرکزی سروے مکمل کرنے کی یاد دہانی",
        main_restart: "مرکزی سروے دوبارہ بھرنے کا کہیں (پچھلی کوشش بند ہو چکی)",
        wait_main: "مرکزی سروے جاری ہے — انتظار کریں",
        fu2: "2 ہفتے کا فالو اپ: لنک / یاد دہانی", fu4: "4 ہفتے کا فالو اپ: لنک / یاد دہانی",
        wait_fu: "فالو اپ آج شروع ہوا — انتظار کریں", wait_followup: "اگلے فالو اپ کا انتظار",
        all_done: "تمام سروے مکمل", do_not_contact: "رابطہ نہ کریں" },
};
/* a contact entry can record a WhatsApp message AND a phone call together (one of each at most) */
const WA_OPTS = [
  ["whatsapp_sent", "Message sent", "پیغام بھیجا"],
  ["whatsapp_reply", "They replied", "انہوں نے جواب دیا"],
];
const CALL_OPTS = [
  ["reached", "Reached — will fill it", "بات ہوئی — سروے کریں گے"],
  ["reached_done", "Says already done", "کہتے ہیں مکمل کر لیا"],
  ["no_answer", "No answer", "جواب نہیں دیا"],
  ["busy", "Busy", "مصروف"],
  ["switched_off", "Phone switched off", "فون بند"],
  ["call_back", "Call back later", "بعد میں کال کریں"],
  ["wrong_number", "Wrong number", "غلط نمبر"],
  ["refused", "Not interested — do not contact", "دلچسپی نہیں — رابطہ نہ کریں"],
];
const OUTCOMES = [         /* labels for the history (older entries used single outcomes) */
  ["whatsapp_sent", "WhatsApp message sent", "واٹس ایپ پیغام بھیجا"],
  ["whatsapp_reply", "Replied on WhatsApp", "واٹس ایپ پر جواب آیا"],
  ["reached", "Reached — will fill it", "بات ہوئی — سروے کریں گے"],
  ["reached_done", "Says already done", "کہتے ہیں مکمل کر لیا"],
  ["no_answer", "No answer", "جواب نہیں دیا"],
  ["busy", "Busy", "مصروف"],
  ["switched_off", "Phone switched off", "فون بند"],
  ["call_back", "Asked to call back later", "بعد میں کال کرنے کا کہا"],
  ["wrong_number", "Wrong number", "غلط نمبر"],
  ["refused", "Not interested — do not contact again", "دلچسپی نہیں — دوبارہ رابطہ نہ کریں"],
];
const parts = (o) => String(o || "").split("+").filter(Boolean);       // "whatsapp_sent+no_answer"
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
  fu2_continue: "السلام علیکم {name}! آپ نے دو ہفتے والا فالو اپ سروے شروع کیا تھا ({pct} مکمل)۔ براہِ کرم اسی فون پر یہ لنک کھول کر مکمل کریں، سروے وہیں سے شروع ہو گا: {link}\nمکمل کرنے پر آپ کو 200 روپے بھیجے جائیں گے۔ شکریہ",
  fu2_again: "السلام علیکم {name}! آپ کا دو ہفتے والا فالو اپ سروے مکمل نہیں ہوا تھا۔ براہِ کرم یہ لنک کھول کر دوبارہ مکمل کریں: {link}\nاپنا موبائل نمبر اس طرح لکھیں: {phone}\nمکمل کرنے پر آپ کو 200 روپے بھیجے جائیں گے۔ شکریہ",
  fu4: "السلام علیکم {name}! یہ ہمارا آخری مختصر فالو اپ سروے ہے (تقریباً 10 منٹ): {link}\nاپنا موبائل نمبر اس طرح لکھیں: {phone}\nمکمل کرنے پر آپ کو 150 روپے بھیجے جائیں گے۔ شکریہ",
  fu4_continue: "السلام علیکم {name}! آپ نے آخری فالو اپ سروے شروع کیا تھا ({pct} مکمل)۔ براہِ کرم اسی فون پر یہ لنک کھول کر مکمل کریں، سروے وہیں سے شروع ہو گا: {link}\nمکمل کرنے پر آپ کو 150 روپے بھیجے جائیں گے۔ شکریہ",
  fu4_again: "السلام علیکم {name}! آپ کا آخری فالو اپ سروے مکمل نہیں ہوا تھا۔ براہِ کرم یہ لنک کھول کر دوبارہ مکمل کریں: {link}\nاپنا موبائل نمبر اس طرح لکھیں: {phone}\nمکمل کرنے پر آپ کو 150 روپے بھیجے جائیں گے۔ شکریہ",
  wait_next: "السلام علیکم {name}! ہمارے سروے میں حصہ لینے کا بہت شکریہ۔ اگلا مختصر فالو اپ سروے آپ کو {date} کو بھیجا جائے گا۔",
  thanks: "السلام علیکم {name}! ہمارے تمام سروے مکمل کرنے کا بہت شکریہ۔ آپ کی رقم جاز کیش یا ایزی پیسہ کے ذریعے بھیجی جا رہی ہے۔",
};
const FU_ACTIVE = ["due", "overdue", "in_progress", "stopped"];
const payDue = (p) => (p.pay2 && p.pay2.status === "due") || (p.pay4 && p.pay4.status === "due");
const payPaid = (p) => (p.pay2 && p.pay2.status === "paid") || (p.pay4 && p.pay4.status === "paid");
const contactedToday = (p) => logsFor(p).some((l) => !String(l.outcome).startsWith("paid") && normDay(l.day || l.time) === today());
/* main tabs (always visible) and the extra filters in the "More…" menu */
const TABS = [
  ["today", (p) => p.call_today && !contactedToday(p), "To do today", "آج کا کام"],
  ["followup", (p) => FU_ACTIVE.includes(p.fu2_status) || FU_ACTIVE.includes(p.fu4_status), "Follow-ups", "فالو اپ"],
  ["unfinished", (p) => ["in_progress", "stopped"].includes(p.main_status) || (p.compliance === "partial" && ["main_remind", "wait_main"].includes(p.action)), "Main not finished", "مرکزی نامکمل"],
  ["not_started", (p) => p.main_status === "not_started", "Not started", "شروع نہیں کیا"],
  ["contacted", contactedToday, "Contacted today", "آج رابطہ ہوا"],
];
const MORE = [
  ["all", () => true, "All", "سب"],
  ["full", (p) => p.compliance === "full", "Full compliance", "مکمل شرکت"],
  ["partial", (p) => p.compliance === "partial", "Partial compliance", "جزوی شرکت"],
  ["fu2done", (p) => p.fu2_status === "done", "2-week done", "2 ہفتے مکمل"],
  ["fu4done", (p) => p.fu4_status === "done", "4-week done", "4 ہفتے مکمل"],
  ["paydue", payDue, "Payment pending", "ادائیگی باقی"],
  ["paid", payPaid, "Paid", "ادائیگی ہو گئی"],
  ["dnc", (p) => p.action === "do_not_contact", "Do not contact", "رابطہ نہ کریں"],
];
const PAY_TABS = [
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
const isAdmin = () => D && D.role === "admin";

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
    const pid = String(r.participant_id).replace(/\.0$/, "").padStart(6, "0");
    const p = byPid.get(pid);
    if (!p) continue;
    p.calls = p.calls || [];
    if (p.calls.some((c) => c.log_id === r.log_id)) continue;
    r.next_call = normDay(r.next_call); r.day = normDay(r.time);
    p.calls.push(r);
    applyOne(p, r);
  }
  const have = new Set(D.people.flatMap((p) => (p.calls || []).map((c) => c.log_id)));
  setPending(pending().filter((l) => !have.has(l.log_id)));
}
function applyOne(p, r) {    // what a new call / payment record changes on the card straight away
  const w = { paid_fu2: "pay2", paid_fu4: "pay4" }[r.outcome];
  if (w) {
    p[w] = { ...(p[w] || {}), status: "paid", date: normDay(r.time), ref: r.reference || "",
             method: r.method || (p[w] || {}).method || "", number: r.pay_number || (p[w] || {}).number || "",
             amount: r.amount || (p[w] || {}).amount };
    return;
  }
  p.n_calls = (p.n_calls || 0) + 1;
  if (normDay(r.time) === today()) p.call_today = false;
  const nc = normDay(r.next_call);
  if (nc) { p.next_call = nc; if (nc > today()) p.call_today = false; }
  const tg = String(r.tags || "").split(",").filter(Boolean);
  p.tags = [...new Set([...(p.tags || []), ...tg])];
  if (parts(r.outcome).includes("refused")) { p.action = "do_not_contact"; p.call_today = false; }
  if (parts(r.outcome).includes("wrong_number") || tg.includes("wrong_number")) p.call_today = false;
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
  const many = isAdmin() || isPay();
  const tagSel = $("#tagSel"), enuSel = $("#enuSel"), moreSel = $("#moreSel");
  const keepTag = tagSel.value, keepEnu = enuSel.value;
  tagSel.innerHTML = ""; tagSel.hidden = isPay();
  tagSel.add(new Option(t("allTags"), ""));
  TAGS.forEach((r) => tagSel.add(new Option(lbl(r), r[0])));
  enuSel.hidden = !many; enuSel.innerHTML = "";
  if (many) { enuSel.add(new Option(t("allEnus"), "")); D.enumerators.forEach((e) => enuSel.add(new Option(e, e))); }
  tagSel.value = keepTag; enuSel.value = keepEnu;
  moreSel.hidden = isPay();
  moreSel.innerHTML = "";
  moreSel.add(new Option(t("moreFilters"), ""));
  MORE.forEach((m) => moreSel.add(new Option(lang === "ur" ? m[3] : m[2], m[0])));
  moreSel.value = MORE.some((m) => m[0] === filter) ? filter : "";
}
function setupMain() {
  fillSelects();
  ["#search", "#tagSel", "#enuSel"].forEach((s) => $(s).addEventListener("input", () => { shown = PAGE; render(); }));
  $("#moreSel").addEventListener("change", (e) => { if (e.target.value) { filter = e.target.value; shown = PAGE; render(); } });
  $("#moreBtn").onclick = () => { shown += PAGE; renderList(); };
  $("#exportBtn").onclick = () => (isPay() ? exportPay() : exportCsv());
  $("#exportLogsBtn").onclick = exportLogs;
}
function base() {
  const e = $("#enuSel").value;
  return D.people.filter((p) => !e || p.enumerator === e);
}
function render() { renderProgress(); renderStats(); renderAdmin(); renderTabs(); renderList(); }

/* ---- progress to target: the same people through main, 2-week and 4-week ---- */
function rounds(ps) {
  const c = (f) => ps.filter(f).length;
  return [
    { key: "main", label: t("roundMain"), color: "var(--s1)", n: c((p) => p.compliance === "full"), extra: c((p) => p.compliance === "partial") },
    { key: "fu2", label: t("round2"), color: "var(--s2)", n: c((p) => p.compliance === "full" && p.fu2_status === "done"),
      extra: c((p) => p.compliance === "partial" && p.fu2_status === "done") },
    { key: "fu4", label: t("round4"), color: "var(--s3)", n: c((p) => p.compliance === "full" && p.fu4_status === "done"),
      extra: c((p) => p.compliance === "partial" && p.fu4_status === "done") },
  ];
}
function renderProgress() {
  const box = $("#progress");
  if (isPay()) { box.hidden = true; return; }
  box.hidden = false;
  const ps = base();
  const target = (D.target || 320) * (isAdmin() && !$("#enuSel").value ? D.enumerators.length : 1);
  box.innerHTML = `<h3>${t("progress")} <span class="muted">${target.toLocaleString()} ${t("perRound")}</span></h3>
    <div class="prog">${rounds(ps).map((r) => {
      const pct = Math.min(100, (100 * r.n) / target);
      return `<div class="prow"><div class="top-line"><span class="lab"><i class="sw" style="background:${r.color}"></i>${r.label}</span>
        <span class="val">${r.n.toLocaleString()} <small>/ ${target.toLocaleString()} · ${pct.toFixed(0)}%</small></span></div>
        <div class="meter" role="img" aria-label="${r.label}: ${r.n} ${t("of")} ${target}"><span style="width:${pct.toFixed(1)}%;background:${r.color}"></span></div>
        ${r.extra ? `<div class="sub">${t("plusPartial").replace("{n}", r.extra)}</div>` : ""}</div>`;
    }).join("")}</div>`;
}

/* ---- PAY tiles ---- */
const statCard = ([f, l, v]) =>
  `<button class="stat ${filter === f ? "hl" : ""}" data-f="${f}"><div class="n">${v}</div><div class="l">${l}</div></button>`;
function renderStats() {
  const box = $("#stats");
  if (!isPay()) { box.hidden = true; return; }
  box.hidden = false;
  const ps = base();
  const n = (f) => ps.filter(f).length;
  const sum = (k, st) => ps.filter((p) => p[k].status === st).reduce((s, p) => s + Number(p[k].amount || 0), 0);
  const paidOn = (d) => ps.reduce((s, p) => s + ["pay2", "pay4"].filter((k) => p[k].status === "paid" && p[k].date === d).length, 0);
  const cards = [
    ["pay2due", t("stat_pay2due"), `${n((p) => p.pay2.status === "due")} · ${t("pkr")} ${sum("pay2", "due").toLocaleString()}`],
    ["pay4due", t("stat_pay4due"), `${n((p) => p.pay4.status === "due")} · ${t("pkr")} ${sum("pay4", "due").toLocaleString()}`],
    ["paid", t("stat_paidtoday"), paidOn(today()).toLocaleString()],
    ["paid", t("stat_paidall"), `${ps.reduce((s, p) => s + ["pay2", "pay4"].filter((k) => p[k].status === "paid").length, 0)} · ${t("pkr")} ${(sum("pay2", "paid") + sum("pay4", "paid")).toLocaleString()}`],
  ];
  box.innerHTML = cards.map(statCard).join("");
  box.querySelectorAll(".stat").forEach((b) => b.onclick = () => { filter = b.dataset.f; shown = PAGE; render(); });
}

/* ---- ADMIN: chart by enumerator + collapsible details ---- */
function adminChart() {
  const E = D.enumerators, tgt = D.target || 320;
  const data = E.map((e) => ({ e, r: rounds(D.people.filter((p) => p.enumerator === e)) }));
  const ymax = Math.max(tgt, ...data.flatMap((d) => d.r.map((x) => x.n))) * 1.08;
  const W = 720, H = 260, m = { l: 34, r: 8, t: 14, b: 26 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b, gw = iw / E.length, bw = Math.min(16, (gw - 14) / 3);
  const y = (v) => m.t + ih - (v / ymax) * ih;
  const ticks = [0, 80, 160, 240, 320, 400, 480].filter((v) => v <= ymax);
  const bar = (x, v, color) => {         // 4px rounded top, square on the baseline
    const h = Math.max(0, y(0) - y(v)); if (!h) return "";
    const r = Math.min(4, h, bw / 2), y0 = y(0), y1 = y(v);
    return `<path d="M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 + r} V${y0} Z" fill="${color}"/>`;
  };
  let g = ticks.map((v) => `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("");
  data.forEach((d, i) => {
    const x0 = m.l + i * gw + (gw - (3 * bw + 4)) / 2;
    g += d.r.map((r, k) => bar(x0 + k * (bw + 2), r.n, r.color)).join("");
    g += `<text class="axis" x="${m.l + i * gw + gw / 2}" y="${H - 8}" text-anchor="middle">${d.e.replace("ENU", "")}</text>`;
    g += `<rect class="hit" data-i="${i}" x="${m.l + i * gw}" y="${m.t}" width="${gw}" height="${ih}"/>`;
  });
  g += `<line class="target" x1="${m.l}" x2="${W - m.r}" y1="${y(tgt)}" y2="${y(tgt)}"/>
        <text class="tlabel" x="${W - m.r}" y="${y(tgt) - 5}" text-anchor="end">${t("target")} ${tgt}</text>`;
  return { svg: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("byEnum")}">${g}</svg>`, data };
}
function renderAdmin() {
  const panel = $("#adminPanel");
  if (!isAdmin()) { panel.hidden = true; return; }
  panel.hidden = false;
  const ch = adminChart();
  const legend = rounds([]).map((r) => `<span><i class="sw" style="background:${r.color}"></i>${r.label}</span>`).join("");
  const rows = D.enumerators.map((e) => {
    const ps = D.people.filter((p) => p.enumerator === e);
    const c = (f) => ps.filter(f).length;
    const r = rounds(ps);
    const pays = (st) => ps.reduce((s, p) => s + ["pay2", "pay4"].filter((k) => p[k] && p[k].status === st).length, 0);
    return `<tr><td>${e}</td><td>${ps.length}</td><td>${r[0].n} <span class="muted">+${r[0].extra}</span></td>
      <td>${r[1].n} <span class="muted">+${r[1].extra}</span></td><td>${r[2].n} <span class="muted">+${r[2].extra}</span></td>
      <td>${c((p) => FU_ACTIVE.includes(p.fu2_status) || FU_ACTIVE.includes(p.fu4_status))}</td>
      <td>${c((p) => p.call_today)}</td><td>${pays("paid")} / ${pays("due")}</td>
      <td>${ps.reduce((s, p) => s + (p.n_calls || 0), 0)}</td><td>${c(contactedToday)}</td></tr>`;
  }).join("");
  const um = D.unmatched || [];
  const flags = [
    ["Completed main survey twice (pay once)", D.people.filter((p) => p.n_completed > 1).length],
    ["Shown a video in more than one attempt", D.people.filter((p) => p.n_video_attempts > 1).length],
    ["Declined consent / not interested", D.people.filter((p) => p.action === "do_not_contact").length],
    ["2-week missed", D.people.filter((p) => p.fu2_status === "missed").length],
    [t("unmatched"), um.length],
  ];
  panel.innerHTML = `<section class="panel chart"><h3>${t("byEnum")} <span class="muted">full compliance; partial in the table</span></h3>
      <div class="legend">${legend}<span><i class="sw" style="background:transparent;border-top:2px dashed var(--ink-2);height:0;width:14px;border-radius:0"></i>${t("target")} ${D.target || 320}</span></div>${ch.svg}</section>
    <details class="box"><summary>${t("details")}</summary><div class="admin-scroll"><table class="admin-table"><thead><tr>
      <th>Enumerator</th><th>People</th><th>Main (full +partial)</th><th>2-week</th><th>4-week</th><th>Follow-ups open</th>
      <th>To do today</th><th>Payments paid / due</th><th>Calls</th><th>Contacted today</th></tr></thead><tbody>${rows}</tbody></table></div></details>
    <details class="box"><summary>${t("checks")}</summary><div class="flags">${flags.map(([l, v]) => `<span class="b ${v ? "warn" : ""}">${l}: ${v}</span>`).join("")}</div>
      ${um.length ? `<ul class="small muted">${um.map((u) => `<li>${esc(u.wave)} · ${esc(u.date)} · typed: ${esc(u.phone_typed)} · ${esc(u.name)} · ${u.finished ? "finished" : "not finished"}</li>`).join("")}</ul>` : ""}</details>`;
  const tip = $("#tip");
  panel.querySelectorAll(".hit").forEach((h) => {
    const d = ch.data[+h.dataset.i];
    h.addEventListener("mousemove", (ev) => {
      tip.innerHTML = `<b>${d.e}</b><br>${d.r.map((r) => `${r.label}: ${r.n} (+${r.extra} partial)`).join("<br>")}`;
      tip.hidden = false; tip.style.left = `${Math.min(ev.clientX + 12, innerWidth - 250)}px`; tip.style.top = `${ev.clientY + 12}px`;
    });
    h.addEventListener("mouseleave", () => { tip.hidden = true; });
  });
}

/* ---- tabs + list ---- */
function renderTabs() {
  const ps = base();
  const list = isPay() ? PAY_TABS : TABS;
  $("#chips").innerHTML = list.map(([k, f, en, ur]) =>
    `<button class="tab ${filter === k ? "on" : ""}" role="tab" data-k="${k}">${lang === "ur" ? ur : en}<span class="k">${ps.filter(f).length}</span></button>`).join("");
  $("#chips").querySelectorAll(".tab").forEach((b) => b.onclick = () => { filter = b.dataset.k; shown = PAGE; $("#moreSel").value = ""; render(); });
  const ms = $("#moreSel");
  ms.classList.toggle("on", MORE.some((m) => m[0] === filter));
  if (!isPay()) ms.value = MORE.some((m) => m[0] === filter) ? filter : "";
}
function filtered() {
  const list = isPay() ? PAY_TABS : [...TABS, ...MORE];
  const f = (list.find((x) => x[0] === filter) || list[0])[1];
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
  if (!s || s === "not_eligible") return "";
  return `<span class="b ${tone(s)}">${label}: ${STATUS[lang][s] || s}${extra}</span>`;
}
function payBadge(label, pay) {
  if (!pay || pay.status === "not_due") return "";
  return pay.status === "paid"
    ? `<span class="b ok">${label}: ${t("paid")} ✓</span>`
    : `<span class="b warn">${label}: ${t("payDue")}</span>`;
}
/* the WhatsApp message always matches the person's current state (also while waiting) */
function waMessage(p) {
  let key = "", link = "";
  const fuKey = (w) => w + ({ in_progress: "_continue", stopped: "_again" }[p[`${w}_status`]] || "");
  if (FU_ACTIVE.includes(p.fu4_status)) { key = fuKey("fu4"); link = "fu4"; }
  else if (FU_ACTIVE.includes(p.fu2_status)) { key = fuKey("fu2"); link = "fu2"; }
  else if (p.main_status === "not_started") { key = "main_invite"; link = "main"; }
  else if (p.main_status === "in_progress" || (p.compliance === "partial" && ["main_remind", "wait_main"].includes(p.action))) { key = "main_remind"; link = "main"; }
  else if (p.main_status === "stopped") { key = "main_restart"; link = "main"; }
  else if (p.action === "all_done") key = "thanks";
  else if (p.compliance) key = "wait_next";
  const w = link === "fu4" ? "fu4" : "fu2";
  const nextDate = p.fu2_status === "not_yet" ? p.fu2_due : p.fu4_due;
  return (MSG[key] || "").replace("{name}", p.name || "").replace("{link}", (D.links || {})[link] || "")
    .replace("{phone}", p.phone).replace("{date}", nextDate || "").replace("{pct}", `${p[`${w}_progress`] || 0}%`);
}
const waLink = (p) => `https://api.whatsapp.com/send?phone=92${p.phone.slice(1)}&text=${encodeURIComponent(waMessage(p))}`;
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
  const when = (s) => { const d = new Date(s); return isNaN(d) ? String(s).slice(0, 16) : `${localDay(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  return logs.length ? `<ul>${logs.slice().reverse().map((l) => `<li>${esc(when(l.time))} · ${esc(l.enumerator)} ·
    ${esc(parts(l.outcome).map((o) => lbl([...OUTCOMES, ...PAY_OUTCOMES].find((x) => x[0] === o) || [o, o, o])).join(" + "))}
    ${l.reference ? "· " + esc(l.reference) : ""}${l.note ? " · " + esc(l.note) : ""}${l._pending ? ` <i>(${t("pending")})</i>` : ""}</li>`).join("")}</ul>`
    : `<p>${t("noCalls")}</p>`;
}
function fuBadge(p, w, label) {
  const st = p[`${w}_status`];
  if (!st || st === "not_eligible") return "";
  let extra = "";
  if (["in_progress", "stopped"].includes(st)) extra = ` · ${p[`${w}_progress`] || 0}%`;
  else if (["due", "overdue", "not_yet"].includes(st)) extra = ` · ${p[`${w}_due`]}`;
  return badge(label, st, extra);
}
function personCard(p) {
  const logs = logsFor(p);
  const prog = ["in_progress", "stopped", "partial"].includes(p.main_status) ? ` · ${p.main_progress}%` : "";
  const canMsg = p.action !== "do_not_contact";
  const tags = [...new Set([...(p.tags || []), ...logs.filter((l) => l._pending).flatMap((l) => String(l.tags || "").split(",").filter(Boolean))])];
  const comp = p.compliance ? `<span class="b ${p.compliance === "full" ? "ok" : "info"} strong">${t(p.compliance)}</span>` : "";
  const mainB = p.compliance === "full" ? "" : badge(t("main"), p.main_status, prog);   // full compliance already says it
  return `<article class="card ${p.call_today && !contactedToday(p) ? "today" : ""}">
    <div class="row1"><span class="nm">${esc(p.name) || "—"}</span>
      <span class="meta">${p.pid} · ${p.phone}${isAdmin() ? " · " + p.enumerator : ""}</span></div>
    <div class="badges">${comp}${mainB}${fuBadge(p, "fu2", t("w2"))}${fuBadge(p, "fu4", t("w4"))}
      ${payBadge(t("pay2"), p.pay2)}${payBadge(t("pay4"), p.pay4)}
</div>
    <div class="act">➜ <b>${ACTION[lang][p.action] || p.action}</b>${p.next_call ? ` · ${t("nextCallShort")}: ${p.next_call}` : ""}</div>
    ${tags.length ? `<div class="tagline">${tags.map((g) => `<span class="tg">${esc(lbl(TAGS.find((x) => x[0] === g) || [g, g, g]))}</span>`).join("")}</div>` : ""}
    <div class="btns">
      <a class="btn" href="tel:${p.phone}">📞 ${t("call")}</a>
      <a class="btn" ${canMsg ? `href="${waLink(p)}" target="_blank" rel="noopener"` : 'aria-disabled="true"'}>💬 ${t("wa")}</a>
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
    ${block("pay2", t("pay2"), p.fu2_date)}${block("pay4", t("pay4"), p.fu4_date)}
    <details class="hist"><summary>${t("history")} (${logs.length})</summary>${histList(logs)}</details></article>`;
}

/* ---------------------------------------------------------------- call-log dialog */
function openLog(pid) {
  current = D.people.find((p) => p.pid === pid);
  $("#logTitle").textContent = `${current.name || "—"} · ${current.pid}`;
  $("#logSub").textContent = ACTION[lang][current.action] || "";
  const group = (el, opts) => {
    el.innerHTML = opts.map((o) => `<button type="button" class="chip" data-v="${o[0]}">${lbl(o)}</button>`).join("");
    el.querySelectorAll(".chip").forEach((c) => c.onclick = () => {      // one per group, tap again to clear
      const on = c.classList.contains("on");
      el.querySelectorAll(".chip").forEach((x) => x.classList.remove("on"));
      if (!on) c.classList.add("on");
    });
  };
  group($("#waPick"), WA_OPTS);
  group($("#callPick"), CALL_OPTS);
  $("#tagPick").innerHTML = TAGS.map((r) => `<button type="button" class="chip" data-tag="${r[0]}">${lbl(r)}</button>`).join("");
  $("#tagPick").querySelectorAll(".chip").forEach((c) => c.onclick = () => c.classList.toggle("on"));
  $("#nextCall").value = ""; $("#note").value = "";
  $("#logDlg").showModal();
}
$("#logForm").addEventListener("submit", async (e) => {
  if (e.submitter && e.submitter.value !== "save") return;
  const picked = [...document.querySelectorAll("#waPick .chip.on, #callPick .chip.on")].map((c) => c.dataset.v);
  if (!picked.length) { e.preventDefault(); toast(t("pickOne")); return; }
  await record(current, {
    action: current.action, outcome: picked.join("+"),
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
    "compliance", "fu2_status", "fu2_progress", "fu2_due", "fu4_status", "fu4_progress", "fu4_due", "action", "next_call", "n_calls"];
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
