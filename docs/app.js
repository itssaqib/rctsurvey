/* Sunni–Shia fieldwork tracker. Data arrive encrypted (AES-GCM, key from the
   passphrase via PBKDF2); nothing readable is ever stored on the server. */
"use strict";
const CODES = ["ENU01","ENU02","ENU03","ENU04","ENU05","ENU06","ENU07","ENU08","ENU09","ENU10","ADMIN"];
const PAGE = 40;
const $ = (s) => document.querySelector(s);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

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
    "Saved on this phone. It will be sent when you are online.", pending: "not yet in the update",
    main: "Main", w2: "2-week", w4: "4-week", due: "due", since: "since",
    stat_total: "My participants", stat_today: "Call today", stat_completed: "Main survey done",
    stat_inprog: "Started, no video yet", stat_fudue: "Follow-up due", stat_pay: "Payment due",
    stat_full: "Full compliance (target)", stat_partial: "Partial compliance (saw video)",
    stat_fu2done: "2-week done (full + partial)", stat_fu4done: "4-week done (full + partial)",
    full: "Full compliance", partial: "Partial compliance",
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
    "اس فون پر محفوظ ہے، انٹرنیٹ ملنے پر بھیج دیا جائے گا۔", pending: "ابھی اپ ڈیٹ میں شامل نہیں",
    main: "مرکزی سروے", w2: "2 ہفتے", w4: "4 ہفتے", due: "مقررہ", since: "سے",
    stat_total: "میرے شرکاء", stat_today: "آج کال کریں", stat_completed: "مرکزی سروے مکمل",
    stat_inprog: "شروع، ابھی ویڈیو نہیں", stat_fudue: "فالو اپ باقی", stat_pay: "ادائیگی باقی",
    stat_full: "مکمل شرکت (ہدف)", stat_partial: "جزوی شرکت (ویڈیو دیکھی)",
    stat_fu2done: "2 ہفتے مکمل (مکمل + جزوی)", stat_fu4done: "4 ہفتے مکمل (مکمل + جزوی)",
    full: "مکمل شرکت", partial: "جزوی شرکت",
  },
};
const STATUS = {
  en: { not_started: "Not started", in_progress: "In progress", stopped: "Stopped (closed)", completed: "Completed", partial: "Saw video, not finished",
        declined: "Declined consent", not_eligible: "—", not_yet: "Not yet due", due: "Due", overdue: "Overdue",
        started: "Started", done: "Done" },
  ur: { not_started: "شروع نہیں کیا", in_progress: "جاری", stopped: "ادھورا (بند)", completed: "مکمل", partial: "ویڈیو دیکھی، مکمل نہیں",
        declined: "رضامندی نہیں دی", not_eligible: "—", not_yet: "ابھی وقت نہیں", due: "وقت آ گیا", overdue: "تاخیر",
        started: "شروع کیا", done: "مکمل" },
};
const ACTION = {
  en: { main_invite: "Send the main survey link and ask them to fill it", main_remind: "Remind to finish the main survey (same phone continues where they stopped)",
        main_restart: "Ask them to fill the main survey again (their earlier attempt closed)",
        wait_main: "Main survey in progress — wait",
        fu2: "2-week follow-up: send link / call", fu4: "4-week follow-up: send link / call",
        wait_followup: "Waiting for the next follow-up", payment_due: "Both follow-ups done — payment due",
        payment_done: "All done and paid", do_not_contact: "Do not contact" },
  ur: { main_invite: "مرکزی سروے کا لنک بھیجیں اور مکمل کرنے کا کہیں", main_remind: "مرکزی سروے مکمل کرنے کی یاد دہانی کرائیں (اسی فون پر وہیں سے جاری ہو گا)",
        main_restart: "مرکزی سروے دوبارہ مکمل کرنے کا کہیں (پچھلی کوشش بند ہو چکی)",
        wait_main: "مرکزی سروے جاری ہے — انتظار کریں",
        fu2: "2 ہفتے کا فالو اپ: لنک بھیجیں / کال کریں", fu4: "4 ہفتے کا فالو اپ: لنک بھیجیں / کال کریں",
        wait_followup: "اگلے فالو اپ کا انتظار", payment_due: "دونوں فالو اپ مکمل — ادائیگی باقی",
        payment_done: "سب مکمل اور ادائیگی ہو گئی", do_not_contact: "رابطہ نہ کریں" },
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
const ADMIN_OUTCOMES = [["paid", "Paid Rs 350", "ادائیگی ہو گئی"]];
const TAGS = [
  ["callback", "Call back", "دوبارہ کال"], ["wrong_number", "Wrong number", "غلط نمبر"],
  ["switched_off", "Phone off", "فون بند"], ["whatsapp_only", "WhatsApp only", "صرف واٹس ایپ"],
  ["language_help", "Needs help reading", "پڑھنے میں مدد"], ["payment_issue", "Payment issue", "ادائیگی کا مسئلہ"],
  ["refused", "Refused", "انکار"],
];
const MSG = {
  main_invite: "السلام علیکم {name}! آپ نے ہماری تحقیق کے لیے رجسٹریشن کروائی تھی۔ براہِ کرم یہ مختصر سروے مکمل کریں: {link}\nسروے میں اپنا یہی موبائل نمبر لکھیں: {phone}\nسروے اور دو مختصر فالو اپ مکمل کرنے پر آپ کو 350 روپے جاز کیش یا ایزی پیسہ کے ذریعے ملیں گے۔ شکریہ",
  main_remind: "السلام علیکم {name}! آپ نے ہمارا سروے شروع کیا تھا لیکن وہ ابھی مکمل نہیں ہوا۔ براہِ کرم اسی فون پر یہ لنک کھولیں، سروے وہیں سے شروع ہو گا جہاں آپ نے چھوڑا تھا: {link}\nاگر سروے شروع سے کھلے تو اپنا موبائل نمبر اس طرح لکھیں: {phone}\nمکمل کرنے پر آپ کو 350 روپے ملیں گے۔ شکریہ",
  main_restart: "السلام علیکم {name}! آپ کا پچھلا سروے مکمل نہیں ہوا تھا اور اب بند ہو چکا ہے۔ براہِ کرم یہ لنک کھول کر سروے دوبارہ شروع سے مکمل کریں: {link}\nاپنا موبائل نمبر اس طرح لکھیں: {phone}\nمکمل کرنے پر آپ کو 350 روپے ملیں گے۔ شکریہ",
  fu2: "السلام علیکم {name}! ہمارے سروے میں حصہ لینے کا شکریہ۔ اب دو ہفتے بعد کا مختصر فالو اپ سروے حاضر ہے (تقریباً 10 منٹ): {link}\nاپنا موبائل نمبر اس طرح لکھیں: {phone}\nشکریہ",
  fu4: "السلام علیکم {name}! یہ ہمارا آخری مختصر فالو اپ سروے ہے (تقریباً 10 منٹ): {link}\nاپنا موبائل نمبر اس طرح لکھیں: {phone}\nمکمل کرنے پر آپ کو 350 روپے بھیجے جائیں گے۔ شکریہ",
};
const FILTERS = [
  ["today", (p) => p.call_today, "Call today", "آج کال کریں"],
  ["all", () => true, "All", "سب"],
  ["not_started", (p) => p.main_status === "not_started", "Not started", "شروع نہیں کیا"],
  ["started", (p) => ["in_progress", "stopped"].includes(p.main_status), "Started, not finished", "شروع، مکمل نہیں"],
  ["full", (p) => p.compliance === "full", "Full compliance", "مکمل شرکت"],
  ["partial", (p) => p.compliance === "partial", "Partial compliance", "جزوی شرکت"],
  ["fu2", (p) => ["due", "overdue", "started"].includes(p.fu2_status), "2-week due", "2 ہفتے باقی"],
  ["fu4", (p) => ["due", "overdue", "started"].includes(p.fu4_status), "4-week due", "4 ہفتے باقی"],
  ["fu2done", (p) => p.fu2_status === "done", "2-week done", "2 ہفتے مکمل"],
  ["fu4done", (p) => p.fu4_status === "done", "4-week done", "4 ہفتے مکمل"],
  ["payment", (p) => p.action === "payment_due", "Payment due", "ادائیگی باقی"],
  ["dnc", (p) => p.action === "do_not_contact", "Do not contact", "رابطہ نہ کریں"],
];

/* ---------------------------------------------------------------- state */
let lang = store.get("ss_lang") || "en";
let D = null;           // decrypted data
let filter = "today", shown = PAGE, current = null;
const t = (k) => (T[lang][k] ?? T.en[k] ?? k);
const lbl = (row) => (lang === "ur" ? row[2] : row[1]);

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

/* ---------------------------------------------------------------- login */
const codeSel = $("#codeSel");
CODES.forEach((c) => codeSel.add(new Option(c === "ADMIN" ? "ADMIN (research team)" : c, c)));
async function login(code, pass, remember) {
  $("#loginErr").hidden = true;
  $("#loginBtn").disabled = true;
  try {
    const r = await fetch(`data/${code}.json.enc?v=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) throw new Error("nodata");
    D = await decrypt(await r.json(), pass);
    if (remember) store.set("ss_auth", JSON.stringify({ code, pass })); else store.del("ss_auth");
    $("#login").hidden = true; $("#main").hidden = false;
    $("#whoCode").textContent = code; $("#genTime").textContent = D.generated;
    setupMain(); render(); flushPending();
  } catch (e) {
    $("#loginErr").textContent = e.message === "nodata" ? t("noData") : t("badPass");
    $("#loginErr").hidden = false;
  } finally { $("#loginBtn").disabled = false; }
}
$("#loginBtn").addEventListener("click", () => login(codeSel.value, $("#pass").value.trim(), $("#remember").checked));
$("#pass").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#loginBtn").click(); });
$("#logoutBtn").addEventListener("click", () => { store.del("ss_auth"); location.reload(); });

/* ---------------------------------------------------------------- pending call logs (offline-safe) */
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
  for (const l of all) { if (l._sent) { left.push(l); continue; } if (await sendLog(l)) left.push({ ...l, _sent: true }); else left.push(l); }
  // keep sent ones until they appear in the next update (so they still show on the card)
  const inData = new Set(D.people.flatMap((p) => (p.calls || []).map((c) => c.log_id)));
  setPending(left.filter((l) => !inData.has(l.log_id)));
}
window.addEventListener("online", () => D && flushPending());

/* ---------------------------------------------------------------- main view */
function fillSelects() {
  const isAdmin = D.role === "admin";
  const tagSel = $("#tagSel"), enuSel = $("#enuSel");
  const keepTag = tagSel.value, keepEnu = enuSel.value;
  tagSel.innerHTML = "";
  tagSel.add(new Option(t("allTags"), ""));
  TAGS.forEach((r) => tagSel.add(new Option(lbl(r), r[0])));
  enuSel.hidden = !isAdmin; enuSel.innerHTML = "";
  if (isAdmin) { enuSel.add(new Option(t("allEnus"), "")); D.enumerators.forEach((e) => enuSel.add(new Option(e, e))); }
  tagSel.value = keepTag; enuSel.value = keepEnu;
}
function setupMain() {
  fillSelects();
  ["#search", "#tagSel", "#enuSel"].forEach((s) => $(s).addEventListener("input", () => { shown = PAGE; renderList(); }));
  $("#moreBtn").onclick = () => { shown += PAGE; renderList(); };
  $("#exportBtn").onclick = exportCsv;
  $("#exportLogsBtn").onclick = exportLogs;
}
function base() {
  const e = $("#enuSel").value;
  return D.people.filter((p) => !e || p.enumerator === e);
}
function render() { renderStats(); renderAdmin(); renderChips(); renderList(); }
function renderStats() {
  const ps = base();
  const n = (f) => ps.filter(f).length;
  const target = (D.target || 300) * (D.role === "admin" && !$("#enuSel").value ? D.enumerators.length : 1);
  const full = n((p) => p.compliance === "full"), part = n((p) => p.compliance === "partial");
  const split = (st) => `${n((p) => p.compliance === "full" && p[st] === "done")} + ${n((p) => p.compliance === "partial" && p[st] === "done")}`;
  const cards = [
    ["full", t("stat_full"), `${full.toLocaleString()} / ${target.toLocaleString()}`, Math.min(100, (100 * full) / target)],
    ["partial", t("stat_partial"), part.toLocaleString()],
    ["today", t("stat_today"), n((p) => p.call_today).toLocaleString()],
    ["started", t("stat_inprog"), n((p) => ["in_progress", "stopped"].includes(p.main_status)).toLocaleString()],
    ["fu2done", t("stat_fu2done"), split("fu2_status")],
    ["fu4done", t("stat_fu4done"), split("fu4_status")],
    ["fu2", t("stat_fudue"), n((p) => ["fu2", "fu4"].includes(p.action)).toLocaleString()],
    ["all", t("stat_total"), ps.length.toLocaleString()],
  ];
  $("#stats").innerHTML = cards.map(([f, l, v, pct]) =>
    `<button class="stat ${filter === f ? "hl" : ""}" data-f="${f}"><div class="n">${v}</div><div class="l">${l}</div>
      ${pct === undefined ? "" : `<div class="bar"><span style="width:${pct.toFixed(1)}%"></span></div>`}</button>`).join("");
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
    const today = new Date().toISOString().slice(0, 10);
    const fp = (st, k) => c((p) => p.compliance === k && p[st] === "done");
    return `<tr><td>${e}</td><td>${ps.length}</td><td>${done}</td><td>${(100 * done / (D.target || 300)).toFixed(0)}%</td>
      <td>${c((p) => p.compliance === "partial")}</td>
      <td>${c((p) => ["in_progress", "stopped"].includes(p.main_status))}</td><td>${c((p) => p.call_today)}</td>
      <td>${fp("fu2_status", "full")} + ${fp("fu2_status", "partial")}</td><td>${fp("fu4_status", "full")} + ${fp("fu4_status", "partial")}</td>
      <td>${c((p) => ["overdue"].includes(p.fu2_status) || ["overdue"].includes(p.fu4_status))}</td>
      <td>${ps.reduce((s, p) => s + (p.n_calls || 0), 0)}</td>
      <td>${ps.reduce((s, p) => s + (p.calls || []).filter((x) => String(x.time).slice(0, 10) === today).length, 0)}</td></tr>`;
  }).join("");
  const flags = [
    ["Under 18", D.people.filter((p) => p.under_18 === "Yes").length],
    ["Completed main survey twice (pay once)", D.people.filter((p) => p.n_completed > 1).length],
    ["Partial compliance: saw a video, not finished (in follow-ups, never restarted)", D.people.filter((p) => p.compliance === "partial").length],
    ["Shown a video in more than one attempt", D.people.filter((p) => p.n_video_attempts > 1).length],
    ["Declined consent / refused", D.people.filter((p) => p.action === "do_not_contact").length],
    ["Follow-up from an unknown number", D.people.filter((p) => String(p.source).includes("not recognised")).length],
    ["Payment due", D.people.filter((p) => p.action === "payment_due").length],
  ];
  panel.innerHTML = `<div class="admin-scroll"><table class="admin-table"><thead><tr><th>Enumerator</th><th>People</th>
    <th>Full</th><th>% of ${D.target || 300}</th><th>Partial</th><th>Started (no video)</th><th>Call today</th>
    <th>2-wk done (full + partial)</th><th>4-wk done (full + partial)</th><th>Overdue</th>
    <th>Calls (all)</th><th>Calls today</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="chips">${flags.map(([l, v]) => `<span class="b ${v ? "warn" : ""}">${l}: ${v}</span>`).join("")}</div>`;
}
function renderChips() {
  const ps = base();
  $("#chips").innerHTML = FILTERS.map(([k, f, en, ur]) =>
    `<button class="chip ${filter === k ? "on" : ""}" data-k="${k}">${lang === "ur" ? ur : en}<span class="k">${ps.filter(f).length}</span></button>`).join("");
  $("#chips").querySelectorAll(".chip").forEach((b) => b.onclick = () => { filter = b.dataset.k; shown = PAGE; render(); });
}
function filtered() {
  const f = (FILTERS.find((x) => x[0] === filter) || FILTERS[1])[1];
  const q = $("#search").value.trim().toLowerCase();
  const tag = $("#tagSel").value;
  const rank = { fu4: 0, fu2: 1, main_remind: 2, main_restart: 2, main_invite: 3, payment_due: 4 };
  return base().filter(f)
    .filter((p) => !tag || (p.tags || []).includes(tag) || pending().some((l) => l.participant_id === p.pid && (l.tags || "").includes(tag)))
    .filter((p) => !q || `${p.name} ${p.pid} ${p.phone}`.toLowerCase().includes(q))
    .sort((a, b) => (rank[a.action] ?? 9) - (rank[b.action] ?? 9) || String(a.fu4_due || a.fu2_due).localeCompare(String(b.fu4_due || b.fu2_due)) || a.pid.localeCompare(b.pid));
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tone = (s) => ({ completed: "ok", done: "ok", in_progress: "info", started: "info", partial: "info", due: "warn", stopped: "warn",
  overdue: "bad", declined: "bad" }[s] || "");
function badge(label, s, extra = "") {
  if (s === "not_eligible") return "";
  return `<span class="b ${tone(s)}">${label}: ${STATUS[lang][s] || s}${extra}</span>`;
}
function waLink(p) {
  const tpl = MSG[p.action] || (p.link ? MSG[p.link === "main" ? (p.main_status === "stopped" ? "main_restart" : "main_remind") : p.link] : "");
  const link = (D.links || {})[p.link] || "";
  const text = tpl ? tpl.replace("{name}", p.name || "").replace("{link}", link).replace("{phone}", p.phone) : "";
  return `https://wa.me/92${p.phone.slice(1)}${text ? "?text=" + encodeURIComponent(text) : ""}`;
}
function renderList() {
  const all = filtered();
  const items = all.slice(0, shown);
  $("#count").textContent = `${items.length.toLocaleString()} ${t("shown")} · ${all.length.toLocaleString()}`;
  $("#moreBtn").hidden = all.length <= shown;
  $("#list").innerHTML = items.map((p) => {
    const logs = logsFor(p);
    const last = logs[logs.length - 1];
    const prog = ["in_progress", "stopped", "partial"].includes(p.main_status) ? ` ${p.main_progress}%` : "";
    const due2 = ["due", "overdue", "not_yet", "started"].includes(p.fu2_status) ? ` · ${p.fu2_due}` : "";
    const due4 = ["due", "overdue", "not_yet", "started"].includes(p.fu4_status) ? ` · ${p.fu4_due}` : "";
    const canMsg = p.action !== "do_not_contact";
    const tags = [...new Set([...(p.tags || []), ...logs.filter((l) => l._pending).flatMap((l) => String(l.tags || "").split(",").filter(Boolean))])];
    return `<article class="card ${p.call_today ? "today" : ""}">
      <div class="row1"><span class="nm">${esc(p.name) || "—"}</span>
        <span class="meta">${p.pid} · ${p.phone}${D.role === "admin" ? " · " + p.enumerator : ""}</span></div>
      <div class="meta">${esc([p.district, p.province].filter(Boolean).join(", "))}</div>
      <div class="badges">${p.compliance ? `<span class="b ${p.compliance === "full" ? "ok" : "info"} strong">${t(p.compliance)}</span>` : ""}${badge(t("main"), p.main_status, prog)}${badge(t("w2"), p.fu2_status, due2)}${badge(t("w4"), p.fu4_status, due4)}
        ${D.role === "admin" && p.under_18 === "Yes" ? '<span class="b bad">Under 18</span>' : ""}
        ${p.paid ? '<span class="b ok">Paid</span>' : ""}</div>
      <div class="act">➜ <b>${ACTION[lang][p.action] || p.action}</b>${p.next_call ? ` · ${t("nextCall").split(" (")[0]}: ${p.next_call}` : ""}</div>
      ${tags.length ? `<div class="tagline">${tags.map((g) => `<span class="tg">${esc(lbl(TAGS.find((x) => x[0] === g) || [g, g, g]))}</span>`).join("")}</div>` : ""}
      <div class="btns" style="margin-top:8px">
        <a class="btn" href="tel:${p.phone}">📞 ${t("call")}</a>
        <a class="btn" ${canMsg ? `href="${waLink(p)}" target="_blank" rel="noopener"` : 'aria-disabled="true" style="opacity:.45;pointer-events:none"'}>💬 ${t("wa")}</a>
        <button class="btn primary" data-log="${p.pid}">✎ ${t("log")}</button>
      </div>
      <details class="hist"><summary>${t("history")} (${logs.length})</summary>
        ${logs.length ? `<ul>${logs.slice().reverse().map((l) => `<li>${esc(String(l.time).slice(0, 16).replace("T", " "))} · ${esc(l.enumerator)} ·
          ${esc(lbl([...OUTCOMES, ...ADMIN_OUTCOMES].find((o) => o[0] === l.outcome) || [l.outcome, l.outcome, l.outcome]))}
          ${l.note ? "· " + esc(l.note) : ""}${l._pending ? ` <i>(${t("pending")})</i>` : ""}</li>`).join("")}</ul>` : `<p>${t("noCalls")}</p>`}
      </details></article>`;
  }).join("");
  $("#list").querySelectorAll("[data-log]").forEach((b) => b.onclick = () => openLog(b.dataset.log));
}

/* ---------------------------------------------------------------- log dialog */
function openLog(pid) {
  current = D.people.find((p) => p.pid === pid);
  $("#logTitle").textContent = `${current.name || "—"} · ${current.pid}`;
  $("#logSub").textContent = ACTION[lang][current.action] || "";
  const sel = $("#outcome"); sel.innerHTML = "";
  [...OUTCOMES, ...(D.role === "admin" ? ADMIN_OUTCOMES : [])].forEach((o) => sel.add(new Option(lbl(o), o[0])));
  $("#tagPick").innerHTML = TAGS.map((r) => `<button type="button" class="chip" data-tag="${r[0]}">${lbl(r)}</button>`).join("");
  $("#tagPick").querySelectorAll(".chip").forEach((c) => c.onclick = () => c.classList.toggle("on"));
  $("#nextCall").value = ""; $("#note").value = "";
  $("#logDlg").showModal();
}
$("#logForm").addEventListener("submit", async (e) => {
  if (e.submitter && e.submitter.value !== "save") return;
  const l = {
    log_id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
    time: new Date().toISOString(), enumerator: D.code, token: D.log_token, participant_id: current.pid,
    action: current.action, outcome: $("#outcome").value,
    tags: [...$("#tagPick").querySelectorAll(".chip.on")].map((c) => c.dataset.tag).join(","),
    note: $("#note").value.trim().slice(0, 300), next_call: $("#nextCall").value,
  };
  const ok = await sendLog(l);
  setPending([...pending(), { ...l, _sent: ok }]);
  toast(ok ? t("savedOnline") : t("savedLocal"));
  renderList();
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
  download(`${D.code}_list_${new Date().toISOString().slice(0, 10)}.csv`, [cols, ...filtered().map((p) => cols.map((c) => p[c]))]);
}
function exportLogs() {
  const cols = ["log_id", "time", "enumerator", "participant_id", "action", "outcome", "tags", "note", "next_call"];
  download(`call_log_${D.code}_${new Date().toISOString().slice(0, 10)}.csv`, [cols, ...pending().map((l) => cols.map((c) => l[c]))]);
}

/* ---------------------------------------------------------------- start */
applyLang();
(() => { try { const a = JSON.parse(store.get("ss_auth") || "null"); if (a) { codeSel.value = a.code; login(a.code, a.pass, true); } } catch (e) {} })();
