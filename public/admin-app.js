import { app, auth } from "./firebase-init.js";
import {
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

const storage = getStorage(app);

const SECTIONS = [
  { key: "research", title: "أبحاث محكمة", kind: "content" },
  { key: "articles", title: "مقالات محكمة", kind: "content" },
  { key: "files", title: "ملفات بحثية", kind: "content" },
  { key: "articles-foreign", title: "مقالات أجنبية", kind: "content" },
  { key: "general-articles", title: "مقالات", kind: "content" },
  { key: "editions", title: "إصداراتنا", kind: "edition" },
  { key: "activities", title: "أنشطتنا", kind: "content" },
  { key: "special-politics", title: "تخصص علوم سياسية", kind: "content" },
  { key: "special-ir", title: "تخصص العلاقات الدولية", kind: "content" },
  { key: "special-admin-law", title: "تخصص القانون الإداري", kind: "content" },
  { key: "special-const-law", title: "تخصص القانون الدستوري", kind: "content" },
  { key: "special-public-policy", title: "تخصص السياسات العمومية", kind: "content" },
  { key: "live", title: "🔴 بث مباشر", kind: "live" }
];

const state = {
  bySection: Object.fromEntries(SECTIONS.map((s) => [s.key, []])),
  currentSectionKey: "editions",
  editing: { key: null, id: null },
  authResolved: false
};

const authReadyPromise = new Promise((resolve) => {
  let done = false;
  onAuthStateChanged(auth, (user) => {
    updateAuthUI(user);
    if (!done) {
      done = true;
      state.authResolved = true;
      resolve(user || null);
    }
  });
});

const firestoreReadyPromise = new Promise((resolve) => {
  if (window.fs && window.fs.db) return resolve();
  window.addEventListener("firestoreReady", () => resolve(), { once: true });
});

await authReadyPromise;
await firestoreReadyPromise;

// ============================================================
// Utility Functions
// ============================================================
function el(id) {
  return document.getElementById(id);
}

function setStatus(msg) {
  const node = el("status");
  if (node) node.textContent = msg || "";
}

function setLoginStatus(msg) {
  const node = el("loginStatus");
  if (node) node.textContent = msg || "";
}

function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}${Math.floor(Math.random() * 99999)}`;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeParse(v, fallback = []) {
  try {
    const x = JSON.parse(v);
    return Array.isArray(x) ? x : fallback;
  } catch {
    return fallback;
  }
}

function getByLang(field, lang = "ar") {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field[lang] || field.ar || field.fr || field.en || "";
}

function getContentCache() {
  return safeParse(localStorage.getItem("contentcache"), []);
}

function setContentCache(items) {
  localStorage.setItem("contentcache", JSON.stringify(items));
}

function sectionTitle(key) {
  return SECTIONS.find((s) => s.key === key)?.title || "لوحة التحكم";
}

function getSectionConfig(key) {
  return SECTIONS.find((s) => s.key === key);
}

function getNextEditionNumber() {
  const nums = state.bySection.editions
    .map((x) => Number(x.editionNumber || x.issueNumber || 0))
    .filter(Boolean);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCurrentUser(timeout = 8000) {
  await authReadyPromise;
  if (auth.currentUser) return auth.currentUser;

  const start = Date.now();
  while (!auth.currentUser && Date.now() - start < timeout) {
    await sleep(150);
  }
  return auth.currentUser || null;
}

async function ensureFreshAuth() {
  const user = await waitForCurrentUser();
  if (!user) throw new Error("يجب تسجيل الدخول أولاً");
  await user.getIdToken(true);
  return user;
}

function isPermissionError(err) {
  const code = String(err?.code || "").toLowerCase();
  const msg = String(err?.message || "").toLowerCase();
  return (
    code.includes("permission-denied") ||
    msg.includes("permission denied") ||
    msg.includes("missing or insufficient permissions")
  );
}

function updateAuthUI(user) {
  const authGate = el("authGate");
  const adminApp = el("adminApp");
  const userLabel = el("userEmail");

  if (authGate) authGate.style.display = user ? "none" : "block";
  if (adminApp) adminApp.style.display = user ? "block" : "none";
  if (userLabel) userLabel.textContent = user?.email || "";

  if (user) {
    setLoginStatus("");
    setStatus(`تم تسجيل الدخول: ${user.email || "Admin"}`);
  } else {
    setStatus("يرجى تسجيل الدخول");
  }
}

async function loginAdmin() {
  const email = el("loginEmail")?.value.trim() || "";
  const password = el("loginPassword")?.value || "";

  if (!email || !password) {
    setLoginStatus("أدخل البريد الإلكتروني وكلمة المرور");
    return;
  }

  try {
    setLoginStatus("جاري تسجيل الدخول...");
    await signInWithEmailAndPassword(auth, email, password);
    setLoginStatus("");
  } catch (err) {
    console.error(err);
    setLoginStatus(`فشل تسجيل الدخول: ${err.message || "بيانات غير صحيحة"}`);
  }
}

// ============================================================
// Platform Detection
// ============================================================
const PLATFORM_META = {
  youtube: { label: "YouTube", icon: "▶️", color: "#ff6b6b" },
  facebook: { label: "Facebook", icon: "📘", color: "#8ab4ff" },
  twitch: { label: "Twitch", icon: "🟣", color: "#c4a3ff" },
  kick: { label: "Kick", icon: "🟢", color: "#8dffb0" },
  twitter: { label: "X (Twitter)", icon: "✖️", color: "#e5e7eb" },
  instagram: { label: "Instagram", icon: "📸", color: "#f9a8d4" },
  tiktok: { label: "TikTok", icon: "🎵", color: "#e5e7eb" },
  vimeo: { label: "Vimeo", icon: "🎬", color: "#7fd8f7" },
  dailymotion: { label: "Dailymotion", icon: "🎞️", color: "#7fc4f7" },
  video: { label: "فيديو", icon: "🎥", color: "#f9a8d4" },
  unknown: { label: "رابط خارجي", icon: "🔗", color: "#e5e7eb" }
};

function detectPlatform(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url) return "unknown";

  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/facebook\.com|fb\.watch/i.test(url)) return "facebook";
  if (/twitch\.tv/i.test(url)) return "twitch";
  if (/kick\.com/i.test(url)) return "kick";
  if (/(?:twitter\.com|x\.com)/i.test(url)) return "twitter";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/tiktok\.com|vm\.tiktok\.com/i.test(url)) return "tiktok";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  if (/dailymotion\.com/i.test(url)) return "dailymotion";
  if (/\.(mp4|webm|ogg)/i.test(url)) return "video";

  return "unknown";
}

// ============================================================
// Normalize Items
// ============================================================
function normalizeItem(sectionKey, raw) {
  const id = String(raw.docId || raw.id || uid());
  const isLive = sectionKey === "live";

  return {
    id,
    docId: id,
    section: sectionKey || raw.section || "research",
    type: isLive ? "live" : raw.type || "item",
    title: typeof raw.title === "object" ? raw.title : { ar: raw.title || "", fr: "", en: "" },
    short: typeof raw.short === "object" ? raw.short : { ar: raw.short || "", fr: "", en: "" },
    full: typeof raw.full === "object" ? raw.full : { ar: raw.full || "", fr: "", en: "" },
    details: typeof raw.details === "object" ? raw.details : { ar: raw.details || "", fr: "", en: "" },
    author: typeof raw.author === "object" ? raw.author : { ar: raw.author || "", fr: "", en: "" },
    affiliation: typeof raw.affiliation === "object" ? raw.affiliation : { ar: raw.affiliation || "", fr: "", en: "" },
    date: typeof raw.date === "object" ? raw.date : { ar: raw.date || "", fr: "", en: "" },
    image: raw.image || "",
    imagePath: raw.imagePath || "",
    file: raw.file || raw.link || "",
    filePath: raw.filePath || "",
    fullIssueFile: raw.fullIssueFile || "",
    fullIssueFilePath: raw.fullIssueFilePath || "",
    issueNumber: Number(raw.issueNumber || raw.editionNumber || 0),
    editionNumber: Number(raw.editionNumber || raw.issueNumber || 0),
    articles: Array.isArray(raw.articles) ? raw.articles : [],
    status: isLive ? (raw.status || "upcoming") : (raw.status || "published"),
    createdAt: Number(raw.createdAt || Date.now()),
    updatedAt: Number(raw.updatedAt || raw.createdAt || Date.now())
  };
}

function rebuildDbFromCache() {
  const all = getContentCache()
    .map((item) => normalizeItem(item.section, item))
    .filter((item) => SECTIONS.some((s) => s.key === item.section));

  SECTIONS.forEach((s) => {
    state.bySection[s.key] = all
      .filter((item) => item.section === s.key)
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  });
}

// ============================================================
// Broadcast to live.html
// ============================================================
function broadcastLiveUpdate() {
  // Sync with live.html via localStorage
  const liveItems = state.bySection.live || [];
  localStorage.setItem("live", JSON.stringify(liveItems));

  // Notify via BroadcastChannel
  try {
    const channel = new BroadcastChannel("ofouq-live-sync");
    channel.postMessage({ type: "live-updated" });
  } catch (e) {
    // BroadcastChannel not supported
  }
}

// ============================================================
// Menu Building
// ============================================================
function buildMenu() {
  const menu = el("menu");
  if (!menu) return;

  menu.innerHTML = "";
  SECTIONS.forEach((sec) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.key = sec.key;
    b.innerHTML = `<span>${esc(sec.title)}</span><i class="ri-arrow-left-s-line"></i>`;
    b.addEventListener("click", () => showSection(sec.key));
    menu.appendChild(b);
  });
}

function setActiveMenu(key) {
  document.querySelectorAll("#menu button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.key === key);
  });
}

// ============================================================
// Form Building
// ============================================================
function buildLiveForm(key) {
  const statuses = [
    { value: "live", label: "🔴 بث مباشر الآن" },
    { value: "upcoming", label: "📅 قادم قريباً" },
    { value: "ended", label: "🎬 انتهى (إعادة)" }
  ];

  return `
    <div class="card">
      <h3>إضافة بث مباشر جديد</h3>
      
      <div class="row">
        <label>العنوان (العربية) *</label>
        <input type="text" id="${key}-title-ar" placeholder="مثال: ندوة علمية حول البحث الأكاديمي" />
      </div>

      <div class="row">
        <label>العنوان (الإنجليزية)</label>
        <input type="text" id="${key}-title-en" placeholder="Example: Scientific Seminar on Academic Research" />
      </div>

      <div class="row">
        <label>العنوان (الفرنسية)</label>
        <input type="text" id="${key}-title-fr" placeholder="Exemple: Séminaire scientifique sur la recherche académique" />
      </div>

      <div class="row">
        <label>الوصف المختصر (العربية)</label>
        <textarea id="${key}-short-ar" placeholder="وصف قصير عن البث..."></textarea>
      </div>

      <div class="row">
        <label>الوصف المختصر (الإنجليزية)</label>
        <textarea id="${key}-short-en" placeholder="Brief description of the stream..."></textarea>
      </div>

      <div class="row">
        <label>الوصف المختصر (الفرنسية)</label>
        <textarea id="${key}-short-fr" placeholder="Brève description du flux..."></textarea>
      </div>

      <div class="row">
        <label>رابط البث المباشر / الفيديو *</label>
        <input type="url" id="${key}-live-link" placeholder="https://www.youtube.com/watch?v=... أو facebook.com/... أو twitch.tv/..." />
        <small style="color:#6b7280;display:block;margin-top:6px;">
          ✓ يدعم: YouTube, Facebook, Twitch, Kick, X, Instagram, TikTok, Vimeo, Dailymotion, وملفات MP4/WebM/OGG
        </small>
      </div>

      <div class="row">
        <label>الحالة *</label>
        <select id="${key}-status">
          ${statuses.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
        </select>
      </div>

      <div class="row">
        <label>التاريخ / المعلومات (العربية)</label>
        <input type="text" id="${key}-date-ar" placeholder="مثال: الاثنين 15 يناير 2024 - الساعة 3:00 مساءً" />
      </div>

      <div class="row">
        <label>التاريخ / المعلومات (الإنجليزية)</label>
        <input type="text" id="${key}-date-en" placeholder="Example: Monday, January 15, 2024 - 3:00 PM" />
      </div>

      <div class="row">
        <label>التاريخ / المعلومات (الفرنسية)</label>
        <input type="text" id="${key}-date-fr" placeholder="Exemple: Lundi 15 janvier 2024 - 15h00" />
      </div>

      <div class="actions">
        <button class="btn btn-green btn-small" type="button" onclick="publishItem('${key}')">💾 حفظ البث</button>
        <button class="btn btn-ghost btn-small" type="button" onclick="resetForm('${key}')">🔄 مسح الحقول</button>
      </div>

      <div class="preview" id="${key}-preview"></div>
    </div>
  `;
}

function buildEditionForm(key) {
  return `
    <div class="card">
      <h3>إضافة عدد جديد</h3>
      <div class="grid-2">
        <div>
          <div class="row"><label>رقم العدد</label><input type="text" id="${key}-number-ar" /></div>
          <div class="row"><label>عنوان العدد</label><input type="text" id="${key}-title-ar" /></div>
          <div class="row"><label>وصف العدد</label><textarea id="${key}-short-ar"></textarea></div>
          <div class="row"><label>صورة الغلاف</label><input type="file" id="${key}-image" accept="image/*" /></div>
          <div class="row"><label>PDF العدد كامل</label><input type="file" id="${key}-full-pdf-file" accept="application/pdf" /></div>
        </div>
        <div><div class="preview" id="${key}-preview"></div></div>
      </div>

      <div class="card" style="margin-top:14px">
        <h3>مقالات العدد</h3>
        <div id="${key}-articles-wrap"></div>
        <div class="actions">
          <button class="btn btn-ghost btn-small" type="button" onclick="addEditionArticleRow('${key}')">إضافة مقال</button>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-green btn-small" type="button" onclick="publishItem('${key}')">حفظ العدد</button>
        <button class="btn btn-ghost btn-small" type="button" onclick="resetForm('${key}')">مسح</button>
      </div>
    </div>
  `;
}

function buildContentForm(key, title) {
  return `
    <div class="card">
      <h3>إضافة إلى ${esc(title)}</h3>
      <div class="grid-2">
        <div>
          <div class="row"><label>العنوان</label><input type="text" id="${key}-title-ar" /></div>
          <div class="row"><label>المؤلف</label><input type="text" id="${key}-author-ar" /></div>
          <div class="row"><label>المؤسسة</label><input type="text" id="${key}-aff-ar" /></div>
          <div class="row"><label>التاريخ</label><input type="text" id="${key}-date-ar" /></div>
          <div class="row"><label>ملخص مختصر</label><textarea id="${key}-short-ar"></textarea></div>
          <div class="row"><label>النص الكامل</label><div class="editor" id="${key}-full-ar-editor" contenteditable="true"></div></div>
          <div class="row"><label>تفاصيل إضافية</label><textarea id="${key}-details-ar"></textarea></div>
        </div>
        <div>
          <div class="row"><label>PDF</label><input type="file" id="${key}-pdf-file" accept="application/pdf" /></div>
          <div class="row"><label>صورة</label><input type="file" id="${key}-image" accept="image/*" /></div>
          <div class="preview" id="${key}-preview"></div>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-green btn-small" type="button" onclick="publishItem('${key}')">حفظ</button>
        <button class="btn btn-ghost btn-small" type="button" onclick="resetForm('${key}')">مسح</button>
      </div>
    </div>
  `;
}

function buildFormHTML(key) {
  const cfg = getSectionConfig(key);
  if (!cfg) return `<div class="card"><div class="empty">القسم غير موجود</div></div>`;
  if (cfg.kind === "edition") return buildEditionForm(key);
  if (cfg.kind === "live") return buildLiveForm(key);
  return buildContentForm(key, cfg.title);
}

function buildListHTML(key) {
  return `
    <div class="card">
      <div class="actions" style="justify-content:space-between;margin-bottom:10px">
        <div>العناصر <span id="${key}-count">0</span></div>
        <input type="search" id="${key}-search" placeholder="ابحث..." style="max-width:240px" />
      </div>
      <div class="list" id="${key}-list"></div>
    </div>
  `;
}

function buildPreviewHTML(imageUrl = "", pdfUrl = "") {
  let out = "";
  if (pdfUrl) {
    out += `<div style="margin-bottom:6px">PDF: <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer" style="color:#7dd3fc">فتح الملف</a></div>`;
  }
  if (imageUrl) {
    out += `<div><img src="${imageUrl}" alt="preview"></div>`;
  }
  return out;
}

function bindPreviewInputs(key) {
  const imgInput = el(`${key}-image`);
  const pdfInput = el(`${key}-pdf-file`);
  const fullPdfInput = el(`${key}-full-pdf-file`);
  const preview = el(`${key}-preview`);
  if (!preview) return;

  if (imgInput) {
    imgInput.addEventListener("change", () => {
      const file = imgInput.files?.[0];
      if (!file) return;
      preview.innerHTML = `<div><img src="${URL.createObjectURL(file)}" alt="preview"></div>`;
    });
  }

  if (pdfInput) {
    pdfInput.addEventListener("change", () => {
      const file = pdfInput.files?.[0];
      preview.innerHTML = file ? `<div>PDF: ${esc(file.name)}</div>` : "";
    });
  }

  if (fullPdfInput) {
    fullPdfInput.addEventListener("change", () => {
      const file = fullPdfInput.files?.[0];
      if (!file) return;
      preview.innerHTML += `<div style="margin-top:6px">PDF العدد الكامل: ${esc(file.name)}</div>`;
    });
  }
}

// ============================================================
// Section Display
// ============================================================
function showSection(key) {
  try {
    state.currentSectionKey = key;
    state.editing = { key: null, id: null };
    setActiveMenu(key);

    const titleNode = el("sectionTitle");
    const contentNode = el("content");
    if (!contentNode) return;

    if (titleNode) titleNode.textContent = sectionTitle(key);
    contentNode.innerHTML = buildFormHTML(key) + buildListHTML(key);

    const searchInput = el(`${key}-search`);
    if (searchInput) searchInput.addEventListener("input", () => renderList(key));

    bindPreviewInputs(key);

    if (key === "editions") {
      const next = getNextEditionNumber();
      const numInput = el(`${key}-number-ar`);
      const titleInput = el(`${key}-title-ar`);
      if (numInput) numInput.value = next;
      if (titleInput) titleInput.value = `العدد ${next}`;
      addEditionArticleRow(key);
    }

    if (key === "live") {
      // Set default status to "upcoming"
      const statusSelect = el(`${key}-status`);
      if (statusSelect) statusSelect.value = "upcoming";
    }

    renderList(key);
  } catch (err) {
    console.error(err);
    setStatus(`خطأ في عرض القسم: ${err.message}`);
  }
}

// ============================================================
// File Upload
// ============================================================
async function uploadPdfToStorage(file, sectionKey, itemId) {
  await ensureFreshAuth();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = `pdfs/${sectionKey}/${itemId}-${safeName}`;
  const storageRef = ref(storage, filePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, path: filePath };
}

async function uploadImageToStorage(file, sectionKey, itemId) {
  await ensureFreshAuth();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = `images/${sectionKey}/${itemId}-${safeName}`;
  const storageRef = ref(storage, filePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, path: filePath };
}

// ============================================================
// Edition Article Management
// ============================================================
function addEditionArticleRow(key, article = {}) {
  const wrap = el(`${key}-articles-wrap`);
  if (!wrap) return;

  const row = document.createElement("div");
  row.className = "card edition-article-row";
  row.style.marginTop = "10px";
  row.dataset.rowId = uid();
  row.dataset.file = article.file || "";
  row.dataset.filePath = article.filePath || "";

  const count = wrap.children.length + 1;

  row.innerHTML = `
    <h4 style="margin-bottom:8px">المقال رقم ${count}</h4>
    <div class="row">
      <label>عنوان المقال</label>
      <input type="text" class="edition-article-title" placeholder="عنوان المقال..." value="${esc(article.title || "")}" />
    </div>
    <div class="row">
      <label>وصف المقال</label>
      <textarea class="edition-article-description" placeholder="وصف مختصر للمقال...">${esc(article.description || "")}</textarea>
    </div>
    <div class="row">
      <label>PDF المقال</label>
      <input type="file" class="edition-article-file" accept="application/pdf" />
      ${article.file ? `<div class="hint" style="margin-top:6px"><a href="${article.file}" target="_blank" rel="noopener noreferrer">فتح الملف الحالي</a></div>` : ""}
    </div>
    <div class="actions">
      <button class="btn btn-red btn-small" type="button" onclick="this.closest('.edition-article-row').remove()">
        <i class="ri-delete-bin-line"></i>حذف هذا المقال
      </button>
    </div>
  `;

  wrap.appendChild(row);
}

async function collectEditionArticles(key, issueId) {
  const wrap = el(`${key}-articles-wrap`);
  if (!wrap) return [];

  const rows = [...wrap.querySelectorAll(".edition-article-row")];
  const articles = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const title = row.querySelector(".edition-article-title")?.value.trim() || "";
    const description = row.querySelector(".edition-article-description")?.value.trim() || "";
    const fileInput = row.querySelector(".edition-article-file");

    let file = row.dataset.file || "";
    let filePath = row.dataset.filePath || "";

    if (!title) continue;

    if (fileInput?.files?.[0]) {
      const uploaded = await uploadPdfToStorage(fileInput.files[0], `${key}-articles`, `${issueId}-${i + 1}`);
      file = uploaded.url;
      filePath = uploaded.path;
    }

    articles.push({ title, description, file, filePath });
  }

  return articles;
}

// ============================================================
// Save/Update Items
// ============================================================
function upsertLocal(sectionKey, obj) {
  const all = getContentCache().map((item) => normalizeItem(item.section, item));
  const normalized = normalizeItem(sectionKey, { ...obj, section: sectionKey });
  const filtered = all.filter((x) => String(x.docId || x.id) !== String(normalized.docId || normalized.id));
  filtered.unshift(normalized);
  setContentCache(filtered);
  rebuildDbFromCache();
}

async function upsertFirestore(sectionKey, obj) {
  await ensureFreshAuth();

  const now = Date.now();
  const docIdValue = String(obj.docId || obj.id || uid());
  const payload = {
    ...obj,
    id: docIdValue,
    docId: docIdValue,
    section: sectionKey,
    updatedAt: now,
    createdAt: obj.createdAt || now,
    status: obj.status || (sectionKey === "live" ? "upcoming" : "published")
  };

  await window.fs.setDoc(
    window.fs.doc(window.fs.db, "content", docIdValue),
    payload,
    { merge: true }
  );

  return payload;
}

async function saveItem(key) {
  const cfg = getSectionConfig(key);
  if (!cfg) return;

  try {
    await ensureFreshAuth();

    const currentId = state.editing.key === key && state.editing.id ? state.editing.id : uid();
    const existing = state.bySection[key].find((x) => String(x.id) === String(currentId));

    const obj = {
      id: currentId,
      docId: currentId,
      section: key,
      type: cfg.kind,
      title: { ar: "", fr: "", en: "" },
      short: { ar: "", fr: "", en: "" },
      full: { ar: "", fr: "", en: "" },
      details: { ar: "", fr: "", en: "" },
      author: { ar: "", fr: "", en: "" },
      affiliation: { ar: "", fr: "", en: "" },
      date: { ar: "", fr: "", en: "" },
      image: existing?.image || "",
      imagePath: existing?.imagePath || "",
      file: existing?.file || "",
      filePath: existing?.filePath || "",
      fullIssueFile: existing?.fullIssueFile || "",
      fullIssueFilePath: existing?.fullIssueFilePath || "",
      editionNumber: existing?.editionNumber || 0,
      issueNumber: existing?.issueNumber || 0,
      articles: existing?.articles || [],
      status: existing?.status || (key === "live" ? "upcoming" : "published"),
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    if (cfg.kind === "edition") {
      obj.type = "edition";
      obj.issueNumber = Number(el(`${key}-number-ar`)?.value.trim()) || getNextEditionNumber();
      obj.editionNumber = obj.issueNumber;
      obj.title.ar = el(`${key}-title-ar`)?.value.trim() || `العدد ${obj.issueNumber}`;
      obj.short.ar = el(`${key}-short-ar`)?.value.trim() || "";

      const imgInput = el(`${key}-image`);
      if (imgInput?.files?.[0]) {
        setStatus("جاري رفع صورة الغلاف...");
        const uploadedImage = await uploadImageToStorage(imgInput.files[0], key, currentId);
        obj.image = uploadedImage.url;
        obj.imagePath = uploadedImage.path;
      }

      const fullPdfInput = el(`${key}-full-pdf-file`);
      if (fullPdfInput?.files?.[0]) {
        setStatus("جاري رفع PDF العدد الكامل...");
        const uploadedFullPdf = await uploadPdfToStorage(fullPdfInput.files[0], `${key}-full`, currentId);
        obj.fullIssueFile = uploadedFullPdf.url;
        obj.fullIssueFilePath = uploadedFullPdf.path;
      }

      setStatus("جاري رفع مقالات العدد...");
      obj.articles = await collectEditionArticles(key, currentId);
    } else if (cfg.kind === "live") {
      obj.type = "live";
      obj.title.ar = el(`${key}-title-ar`)?.value.trim() || "";
      obj.title.en = el(`${key}-title-en`)?.value.trim() || obj.title.ar;
      obj.title.fr = el(`${key}-title-fr`)?.value.trim() || obj.title.ar;
      obj.short.ar = el(`${key}-short-ar`)?.value.trim() || "";
      obj.short.en = el(`${key}-short-en`)?.value.trim() || obj.short.ar;
      obj.short.fr = el(`${key}-short-fr`)?.value.trim() || obj.short.ar;
      obj.date.ar = el(`${key}-date-ar`)?.value.trim() || "";
      obj.date.en = el(`${key}-date-en`)?.value.trim() || obj.date.ar;
      obj.date.fr = el(`${key}-date-fr`)?.value.trim() || obj.date.ar;
      obj.file = el(`${key}-live-link`)?.value.trim() || "";
      obj.status = el(`${key}-status`)?.value || "upcoming";

      if (!obj.title.ar || !obj.file) {
        throw new Error("العنوان والرابط مطلوبان");
      }
    } else {
      obj.type = "content";
      obj.title.ar = el(`${key}-title-ar`)?.value.trim() || "";
      obj.author.ar = el(`${key}-author-ar`)?.value.trim() || "";
      obj.affiliation.ar = el(`${key}-aff-ar`)?.value.trim() || "";
      obj.date.ar = el(`${key}-date-ar`)?.value.trim() || "";
      obj.short.ar = el(`${key}-short-ar`)?.value.trim() || "";
      obj.full.ar = el(`${key}-full-ar-editor`)?.innerHTML?.trim() || "";
      obj.details.ar = el(`${key}-details-ar`)?.value.trim() || "";

      const pdfInput = el(`${key}-pdf-file`);
      if (pdfInput?.files?.[0]) {
        setStatus("جاري رفع ملف PDF...");
        const uploadedPdf = await uploadPdfToStorage(pdfInput.files[0], key, currentId);
        obj.file = uploadedPdf.url;
        obj.filePath = uploadedPdf.path;
      }

      const imgInput = el(`${key}-image`);
      if (imgInput?.files?.[0]) {
        setStatus("جاري رفع الصورة...");
        const uploadedImage = await uploadImageToStorage(imgInput.files[0], key, currentId);
        obj.image = uploadedImage.url;
        obj.imagePath = uploadedImage.path;
      }
    }

    upsertLocal(key, obj);
    await upsertFirestore(key, obj);

    // Broadcast live updates
    if (key === "live") {
      broadcastLiveUpdate();
    }

    resetForm(key);
    renderList(key);
    setStatus(`تم حفظ: ${obj.title.ar || "عنصر جديد"}`);
  } catch (err) {
    console.error(err);
    if (isPermissionError(err)) {
      setStatus("فشل الحفظ: ليست لديك صلاحية للوصول إلى Firestore/Storage");
      alert("فشل الحفظ: تحقق من Firebase Authentication وFirestore Rules وStorage Rules");
      return;
    }
    setStatus(err.message || "حدث خطأ أثناء الحفظ");
    alert(err.message || "حدث خطأ أثناء الحفظ");
  }
}

// ============================================================
// Load for Edit
// ============================================================
function loadForEdit(key, id) {
  const item = state.bySection[key].find((x) => String(x.id) === String(id));
  if (!item) return;

  state.editing = { key, id };

  if (el(`${key}-title-ar`)) el(`${key}-title-ar`).value = getByLang(item.title, "ar");
  if (el(`${key}-author-ar`)) el(`${key}-author-ar`).value = getByLang(item.author, "ar");
  if (el(`${key}-aff-ar`)) el(`${key}-aff-ar`).value = getByLang(item.affiliation, "ar");
  if (el(`${key}-date-ar`)) el(`${key}-date-ar`).value = getByLang(item.date, "ar");
  if (el(`${key}-short-ar`)) el(`${key}-short-ar`).value = getByLang(item.short, "ar");
  if (el(`${key}-details-ar`)) el(`${key}-details-ar`).value = getByLang(item.details, "ar");
  if (el(`${key}-full-ar-editor`)) el(`${key}-full-ar-editor`).innerHTML = getByLang(item.full, "ar");

  // Live-specific fields
  if (key === "live") {
    if (el(`${key}-title-en`)) el(`${key}-title-en`).value = getByLang(item.title, "en");
    if (el(`${key}-title-fr`)) el(`${key}-title-fr`).value = getByLang(item.title, "fr");
    if (el(`${key}-short-en`)) el(`${key}-short-en`).value = getByLang(item.short, "en");
    if (el(`${key}-short-fr`)) el(`${key}-short-fr`).value = getByLang(item.short, "fr");
    if (el(`${key}-date-en`)) el(`${key}-date-en`).value = getByLang(item.date, "en");
    if (el(`${key}-date-fr`)) el(`${key}-date-fr`).value = getByLang(item.date, "fr");
    if (el(`${key}-live-link`)) el(`${key}-live-link`).value = item.file || "";
    if (el(`${key}-status`)) el(`${key}-status`).value = item.status || "upcoming";
  } else {
    if (el(`${key}-live-link`)) el(`${key}-live-link`).value = item.file || "";
  }

  const p = el(`${key}-preview`);
  if (p) {
    let previewHtml = buildPreviewHTML(item.image, item.file);
    if (key === "editions" && item.fullIssueFile) {
      previewHtml =
        `<div style="margin-bottom:6px">PDF العدد الكامل: <a href="${item.fullIssueFile}" target="_blank" rel="noopener noreferrer" style="color:#7dd3fc">فتح الملف</a></div>` +
        previewHtml;
    }
    p.innerHTML = previewHtml;
  }

  if (key === "editions") {
    if (el(`${key}-number-ar`)) el(`${key}-number-ar`).value = item.issueNumber || item.editionNumber || "";
    if (el(`${key}-title-ar`)) el(`${key}-title-ar`).value = getByLang(item.title, "ar");
    if (el(`${key}-short-ar`)) el(`${key}-short-ar`).value = getByLang(item.short, "ar");
    const wrap = el(`${key}-articles-wrap`);
    if (wrap) wrap.innerHTML = "";
    (item.articles || []).forEach((article) => addEditionArticleRow(key, article));
  }
}

// ============================================================
// Delete Item
// ============================================================
async function deleteItemById(sectionKey, id) {
  if (!confirm("هل تريد الحذف النهائي؟")) return;

  const target = state.bySection[sectionKey].find((x) => String(x.docId || x.id) === String(id));

  const all = getContentCache().map((item) => normalizeItem(item.section, item));
  const filtered = all.filter((x) => String(x.docId || x.id) !== String(id));
  setContentCache(filtered);
  rebuildDbFromCache();
  renderList(sectionKey);

  try {
    await ensureFreshAuth();

    await window.fs.deleteDoc(window.fs.doc(window.fs.db, "content", String(id)));

    try {
      if (target?.imagePath) await deleteObject(ref(storage, target.imagePath));
    } catch (e) {
      console.error(e);
    }
    try {
      if (target?.filePath) await deleteObject(ref(storage, target.filePath));
    } catch (e) {
      console.error(e);
    }
    try {
      if (target?.fullIssueFilePath) await deleteObject(ref(storage, target.fullIssueFilePath));
    } catch (e) {
      console.error(e);
    }

    if (Array.isArray(target?.articles)) {
      for (const article of target.articles) {
        try {
          if (article?.filePath) await deleteObject(ref(storage, article.filePath));
        } catch (e) {
          console.error(e);
        }
      }
    }

    // Broadcast if live
    if (sectionKey === "live") {
      broadcastLiveUpdate();
    }

    setStatus("تم الحذف");
  } catch (err) {
    console.error(err);
    if (isPermissionError(err)) {
      setStatus("فشل الحذف: ليست لديك صلاحية");
      alert("فشل الحذف: تحقق من Firebase Rules");
      return;
    }
    setStatus(err.message || "فشل الحذف");
    alert(err.message || "فشل الحذف");
  }
}

// ============================================================
// Reset Form
// ============================================================
function resetForm(key) {
  state.editing = { key: null, id: null };

  ["title-ar", "title-en", "title-fr", "author-ar", "aff-ar", "date-ar", "date-en", "date-fr", "short-ar", "short-en", "short-fr", "details-ar", "live-link"].forEach((name) => {
    const node = el(`${key}-${name}`);
    if (node) node.value = "";
  });

  const editor = el(`${key}-full-ar-editor`);
  if (editor) editor.innerHTML = "";

  const img = el(`${key}-image`);
  if (img) img.value = "";

  const pdf = el(`${key}-pdf-file`);
  if (pdf) pdf.value = "";

  const fullPdf = el(`${key}-full-pdf-file`);
  if (fullPdf) fullPdf.value = "";

  const preview = el(`${key}-preview`);
  if (preview) preview.innerHTML = "";

  if (key === "live") {
    const statusSelect = el(`${key}-status`);
    if (statusSelect) statusSelect.value = "upcoming";
  }

  if (key === "editions") {
    const next = getNextEditionNumber();
    const numInput = el(`${key}-number-ar`);
    const titleInput = el(`${key}-title-ar`);
    const shortInput = el(`${key}-short-ar`);
    const wrap = el(`${key}-articles-wrap`);

    if (numInput) numInput.value = next;
    if (titleInput) titleInput.value = `العدد ${next}`;
    if (shortInput) shortInput.value = "";

    if (wrap) {
      wrap.innerHTML = "";
      addEditionArticleRow(key);
    }
  }
}

// ============================================================
// Render List
// ============================================================
function renderList(key) {
  const list = el(`${key}-list`);
  const count = el(`${key}-count`);
  if (!list || !count) return;

  const q = el(`${key}-search`)?.value?.trim().toLowerCase() || "";
  const data = state.bySection[key].filter((item) => {
    if (item.section !== key) return false;
    if (!q) return true;

    const t = getByLang(item.title, "ar").toLowerCase();
    const s = getByLang(item.short, "ar").toLowerCase();
    const d = getByLang(item.details, "ar").toLowerCase();

    return t.includes(q) || s.includes(q) || d.includes(q);
  });

  count.textContent = data.length;

  if (!data.length) {
    list.innerHTML = `<div class="empty">لا توجد بيانات في هذا القسم حالياً.<br>أضف محتوى جديداً أو اضغط "تحميل Firestore".</div>`;
    return;
  }

  list.innerHTML = "";

  data.forEach((item) => {
    const title = getByLang(item.title, "ar") || "بدون عنوان";
    const descBase = getByLang(item.short, "ar") || getByLang(item.details, "ar") || "";
    const desc = descBase.length > 120 ? `${descBase.slice(0, 120)}...` : descBase;
    const author = getByLang(item.author, "ar") || "";
    
    let dateLabel = "";
    if (key === "editions") {
      dateLabel = `العدد ${item.editionNumber || item.issueNumber || ""}`;
    } else if (key === "live") {
      dateLabel = getByLang(item.date, "ar") || `الحالة: ${item.status === "live" ? "🔴 بث مباشر" : item.status === "upcoming" ? "📅 قادم قريباً" : "🎬 انتهى"}`;
    } else {
      dateLabel = getByLang(item.date, "ar") || "";
    }

    let imgHtml = "";
    if (key === "live") {
      const platform = detectPlatform(item.file);
      const meta = PLATFORM_META[platform];
      imgHtml = `<div style="display:flex;align-items:center;justify-content:center;width:80px;height:80px;background:rgba(0,0,0,0.05);border-radius:8px;font-size:32px;">${meta?.icon || "🔗"}</div>`;
    } else {
      imgHtml = item.image
        ? `<img src="${item.image}" alt="img" />`
        : `<img src="logo1222.jpeg" alt="logo" />`;
    }

    const articlesHtml =
      key === "editions" && Array.isArray(item.articles) && item.articles.length
        ? `<div style="margin-top:8px">${item.articles.map((a) => `<span style="display:inline-block;margin:4px;padding:5px 9px;border-radius:999px;background:rgba(56,189,248,.14);border:1px solid rgba(56,189,248,.25)">${esc(a.title || "مقال")}</span>`).join("")}</div>`
        : "";

    const wrap = document.createElement("div");
    wrap.className = "item";
    wrap.innerHTML = `
      <div class="item-actions">
        <button class="mini" title="تعديل" onclick="loadForEdit('${key}','${item.id}')"><i class="ri-pencil-line"></i></button>
        <button class="mini" title="حذف" onclick="deleteItem('${key}','${item.docId || item.id}')"><i class="ri-delete-bin-line"></i></button>
      </div>
      ${imgHtml}
      <div class="item-body">
        <div class="item-title">${esc(title)}</div>
        <div class="item-desc">${esc(desc)}</div>
        <div class="item-meta"><span>${esc(author)}</span><span>${esc(dateLabel)}</span></div>
        ${articlesHtml}
      </div>
    `;
    list.appendChild(wrap);
  });
}

// ============================================================
// Firestore Operations
// ============================================================
async function reloadFromFirestore() {
  try {
    await ensureFreshAuth();
    setStatus("جاري تحميل البيانات من Firestore...");

    const col = window.fs.collection(window.fs.db, "content");
    const snap = await window.fs.getDocs(col);
    const all = [];

    snap.forEach((docSnap) => {
      const raw = { docId: docSnap.id, ...docSnap.data() };
      all.push(normalizeItem(raw.section, raw));
    });

    setContentCache(all);
    rebuildDbFromCache();
    renderList(state.currentSectionKey);
    setStatus(`تم تحميل ${all.length} عنصر من Firestore`);
  } catch (e) {
    console.error(e);
    if (isPermissionError(e)) {
      setStatus("فشل تحميل Firestore: لا توجد صلاحيات كافية");
      return;
    }
    setStatus(`فشل تحميل Firestore: ${e.message || "Permission denied"}`);
  }
}

async function recoverAllData() {
  try {
    setStatus("جاري المزامنة بين Firestore و Local...");

    const localItems = getContentCache().map((item) => normalizeItem(item.section, item));
    let firestoreItems = [];

    const user = await waitForCurrentUser(2500);
    if (user) {
      try {
        await user.getIdToken(true);
        const snap = await window.fs.getDocs(window.fs.collection(window.fs.db, "content"));
        snap.forEach((docSnap) => {
          const raw = { docId: docSnap.id, ...docSnap.data() };
          firestoreItems.push(normalizeItem(raw.section, raw));
        });
      } catch (e) {
        console.error("Firestore recover read error:", e);
        if (isPermissionError(e)) {
          setStatus("تم تحميل البيانات المحلية فقط، صلاحيات Firestore غير كافية");
        } else {
          setStatus(`تعذر قراءة Firestore، تم استخدام البيانات المحلية: ${e.message || "خطأ"}`);
        }
      }
    } else {
      setStatus("تم تحميل البيانات المحلية فقط، لم يتم تسجيل الدخول بعد");
    }

    const mergedMap = new Map();
    [...localItems, ...firestoreItems].forEach((item) => {
      const id = String(item.docId || item.id || uid());
      const existing = mergedMap.get(id);
      if (!existing || Number(item.updatedAt || 0) >= Number(existing.updatedAt || 0)) {
        mergedMap.set(id, item);
      }
    });

    const merged = Array.from(mergedMap.values());
    setContentCache(merged);
    rebuildDbFromCache();
    showSection(state.currentSectionKey);

    if (firestoreItems.length) {
      setStatus(`تمت المزامنة: ${merged.length} عنصر`);
    } else if (merged.length) {
      setStatus(`تم تحميل البيانات المحلية: ${merged.length} عنصر`);
    } else {
      setStatus("لا توجد بيانات حالياً");
    }
  } catch (e) {
    console.error(e);
    setStatus(`Firestore sync failed: ${e.message || "Permission denied"}`);
  }
}

// ============================================================
// Export/Import/Clear
// ============================================================
function exportJSON() {
  const out = {};
  SECTIONS.forEach((s) => {
    out[s.key] = state.bySection[s.key];
  });

  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `site-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function clearLocalStorageOnly() {
  if (!confirm("هل تريد مسح التخزين المحلي فقط؟")) return;

  localStorage.removeItem("contentcache");
  localStorage.removeItem("editions");
  localStorage.removeItem("live");

  [
    "issues",
    "magazineIssues",
    "publications",
    "releases",
    "articles",
    "scientificArticles",
    "peerArticles",
    "peer-reviewed-articles",
    "scholarlyArticles"
  ].forEach((key) => localStorage.removeItem(key));

  SECTIONS.forEach((s) => {
    state.bySection[s.key] = [];
  });

  showSection(state.currentSectionKey);
  setStatus("تم مسح localStorage");
}

// ============================================================
// Initialization
// ============================================================
async function init() {
  buildMenu();
  rebuildDbFromCache();

  if (auth.currentUser) {
    showSection(state.currentSectionKey);
    await recoverAllData();
  }

  el("loginBtn")?.addEventListener("click", loginAdmin);

  const loginPassword = el("loginPassword");
  if (loginPassword) {
    loginPassword.addEventListener("keydown", (e) => {
      if (e.key === "Enter") loginAdmin();
    });
  }

  el("reloadBtn")?.addEventListener("click", reloadFromFirestore);
  el("recoverBtn")?.addEventListener("click", recoverAllData);
  el("exportBtn")?.addEventListener("click", exportJSON);
  el("clearBtn")?.addEventListener("click", clearLocalStorageOnly);

  el("logoutBtn")?.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
    location.reload();
  });

  onAuthStateChanged(auth, async (user) => {
    updateAuthUI(user);
    if (user) {
      rebuildDbFromCache();
      showSection(state.currentSectionKey);
      await recoverAllData();
    }
  });
}

// ============================================================
// Export Global Functions
// ============================================================
window.addEditionArticleRow = addEditionArticleRow;
window.publishItem = saveItem;
window.resetForm = resetForm;
window.loadForEdit = loadForEdit;
window.deleteItem = deleteItemById;
window.showSection = showSection;

init();