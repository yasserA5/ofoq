import { app, auth } from "./admin-firebase.js";
import {
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  getStorage,
  ref,
  uploadBytes,
  uploadBytesResumable,
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

// Keep identical to firestore.rules: the rules are the real protection, this only hides the panel
const ADMIN_EMAILS = ["animxanimx@gmail.com", "ofouqacademie@gmail.com"];
function isAdminUser(user) {
  return Boolean(user?.email) && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

const state = {
  bySection: Object.fromEntries(SECTIONS.map((s) => [s.key, []])),
  currentSectionKey: "editions",
  editing: { key: null, id: null },
  authResolved: false,
  liveUnsubscribe: null
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

function showNotification(message, type = "success") {
  const notification = document.createElement("div");
  notification.className = `admin-notification ${type}`;
  notification.innerHTML = `
    <span class="notification-icon">${type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}</span>
    <span class="notification-text">${message}</span>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add("show");
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 3000);
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

  const allowed = isAdminUser(user);

  if (authGate) authGate.style.display = allowed ? "none" : "block";
  if (adminApp) adminApp.style.display = allowed ? "block" : "none";
  if (userLabel) userLabel.textContent = allowed ? user.email : "";

  if (allowed) {
    setLoginStatus("");
    setStatus(`تم تسجيل الدخول: ${user.email || "Admin"}`);
  } else {
    // the session is shared with the public site, so a reader can arrive here already signed in
    setLoginStatus(user ? `الحساب ${user.email || ""} ليس حساب مدير. سجّل الدخول بحساب المدير.` : "");
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
    setLoginStatus(
      err.code === "auth/invalid-credential"
        ? "البريد أو كلمة المرور غير صحيحة. إذا كان حسابك يدخل عبر Google فاستخدم زر Google."
        : `فشل تسجيل الدخول: ${err.message || "بيانات غير صحيحة"}`
    );
  }
}

async function loginAdminGoogle() {
  try {
    setLoginStatus("جاري تسجيل الدخول...");
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    console.error(err);
    setLoginStatus(`تعذر الدخول عبر Google: ${err.message || ""}`);
  }
}

// ============================================================
// Platform Detection & Meta
// ============================================================
const PLATFORM_META = {
  youtube: { label: "YouTube", icon: "▶️", color: "#ff6b6b", regex: /(?:youtube\.com|youtu\.be)/ },
  facebook: { label: "Facebook", icon: "📘", color: "#8ab4ff", regex: /facebook\.com|fb\.watch/ },
  twitch: { label: "Twitch", icon: "🟣", color: "#c4a3ff", regex: /twitch\.tv/ },
  kick: { label: "Kick", icon: "🟢", color: "#8dffb0", regex: /kick\.com/ },
  twitter: { label: "X (Twitter)", icon: "✖️", color: "#e5e7eb", regex: /(?:twitter\.com|x\.com)/ },
  instagram: { label: "Instagram", icon: "📸", color: "#f9a8d4", regex: /instagram\.com/ },
  tiktok: { label: "TikTok", icon: "🎵", color: "#e5e7eb", regex: /tiktok\.com|vm\.tiktok\.com/ },
  vimeo: { label: "Vimeo", icon: "🎬", color: "#7fd8f7", regex: /vimeo\.com/ },
  dailymotion: { label: "Dailymotion", icon: "🎞️", color: "#7fc4f7", regex: /dailymotion\.com/ },
  video: { label: "فيديو", icon: "🎥", color: "#f9a8d4", regex: /\.(mp4|webm|ogg)/ },
  unknown: { label: "رابط خارجي", icon: "🔗", color: "#e5e7eb", regex: /.*/ }
};

function detectPlatform(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url) return "unknown";

  for (const [platform, meta] of Object.entries(PLATFORM_META)) {
    if (platform !== "unknown" && meta.regex.test(url)) {
      return platform;
    }
  }
  return "unknown";
}

// ============================================================
// Real-time Firestore Listener for Live Section
// ============================================================
function setupLiveListener() {
  if (!window.fs || !window.fs.db) return;

  try {
    if (state.liveUnsubscribe) {
      state.liveUnsubscribe();
    }

    const contentCollection = window.fs.collection(window.fs.db, "content");
    const liveQuery = window.fs.query(
      contentCollection,
      window.fs.where("section", "==", "live")
    );

    state.liveUnsubscribe = window.fs.onSnapshot(
      liveQuery,
      (snapshot) => {
        const liveItems = [];
        snapshot.forEach((doc) => {
          liveItems.push({
            id: doc.id,
            docId: doc.id,
            ...doc.data()
          });
        });

        state.bySection.live = liveItems.sort(
          (a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)
        );

        // Only re-render if we're viewing live section
        if (state.currentSectionKey === "live") {
          renderList("live");
        }

        console.log("✅ Live items updated:", liveItems.length);
      },
      (error) => {
        console.error("❌ Live listener error:", error);
      }
    );
  } catch (error) {
    console.error("❌ Failed to setup live listener:", error);
  }
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
    video: raw.video || "",
    videoPath: raw.videoPath || "",
    videoCover: raw.videoCover || "",
    videoCoverPath: raw.videoCoverPath || "",
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
  const liveItems = state.bySection.live || [];
  localStorage.setItem("live", JSON.stringify(liveItems));

  try {
    const channel = new BroadcastChannel("ofouq-live-sync");
    channel.postMessage({ type: "live-updated", count: liveItems.length });
  } catch (e) {
    console.warn("BroadcastChannel not available");
  }

  showNotification(`تم تحديث البث المباشر (${liveItems.length} بث)`, "success");
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
    b.title = sec.title;
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
// Form Building - Enhanced Live Form
// ============================================================
function buildLiveForm(key) {
  return `
    <div class="card">
      <h3>🔴 إضافة بث مباشر جديد</h3>
      <p style="color:#6b7280;font-size:13px;margin-bottom:15px;">أضف البث على أي منصة وسيظهر فوراً على صفحة البث المباشر</p>
      
      <div class="row">
        <label>العنوان (العربية) <span style="color:red;">*</span></label>
        <input type="text" id="${key}-title-ar" placeholder="مثال: ندوة علمية حول البحث الأكاديمي" required />
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
        <textarea id="${key}-short-ar" placeholder="وصف قصير عن البث..." rows="2"></textarea>
      </div>

      <div class="row">
        <label>الوصف المختصر (الإنجليزية)</label>
        <textarea id="${key}-short-en" placeholder="Brief description of the stream..." rows="2"></textarea>
      </div>

      <div class="row">
        <label>الوصف المختصر (الفرنسية)</label>
        <textarea id="${key}-short-fr" placeholder="Brève description du flux..." rows="2"></textarea>
      </div>

      <div class="row">
        <label>رابط البث / الفيديو <span style="color:red;">*</span></label>
        <input type="url" id="${key}-live-link" placeholder="الصق رابط البث هنا..." required />
        <small style="color:#6b7280;display:block;margin-top:6px;line-height:1.5;">
          <strong>✓ الأنصات المدعومة:</strong> YouTube • Facebook • Twitch • Kick • X/Twitter • Instagram • TikTok • Vimeo • Dailymotion • ملفات MP4/WebM/OGG
        </small>
      </div>

      <div class="row">
        <label>معاينة المنصة</label>
        <div id="${key}-platform-preview" style="padding:10px;background:#f3f4f6;border-radius:8px;font-size:13px;color:#6b7280;">
          اكتب الرابط للمعاينة
        </div>
      </div>

      <div class="row">
        <label>الحالة <span style="color:red;">*</span></label>
        <select id="${key}-status" required>
          <option value="upcoming">📅 قادم قريباً</option>
          <option value="live">🔴 بث مباشر الآن</option>
          <option value="ended">🎬 انتهى (إعادة)</option>
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
        <button class="btn btn-green" type="button" onclick="publishItem('${key}')">💾 حفظ البث المباشر</button>
        <button class="btn btn-ghost" type="button" onclick="resetForm('${key}')">🔄 مسح الحقول</button>
      </div>
    </div>
  `;
}

function buildVideoFields(key) {
  return `
    <div class="row"><label>فيديو من الحاسوب (أي حجم)</label><input type="file" id="${key}-video-file" accept="video/*" /></div>
    <div class="row">
      <label>أو رابط فيديو</label>
      <input type="url" id="${key}-video-link" placeholder="https://www.youtube.com/watch?v=..." />
      <small>YouTube • Vimeo • Facebook • Twitch • رابط مباشر لملف فيديو. امسح الرابط لحذف الفيديو.</small>
    </div>
    <div class="row video-cover" id="${key}-video-cover-row" hidden>
      <label>غلاف الفيديو (صورة من جهازك)</label>
      <input type="file" id="${key}-video-cover" accept="image/*" />
      <img id="${key}-video-cover-preview" alt="غلاف الفيديو" hidden />
    </div>
    <div class="video-progress" id="${key}-video-progress" hidden><i></i><span></span></div>
  `;
}

// The cover picker only appears once there is a video to put it on
function syncVideoCoverField(key) {
  const row = el(`${key}-video-cover-row`);
  if (!row) return;
  row.hidden = !(el(`${key}-video-file`)?.files?.length || el(`${key}-video-link`)?.value.trim());
}

function showVideoCoverPreview(key, url) {
  const img = el(`${key}-video-cover-preview`);
  if (!img) return;
  img.hidden = !url;
  if (url) img.src = url;
  else img.removeAttribute("src");
}

function buildEditionForm(key) {
  return `
    <div class="card">
      <h3>📑 إضافة عدد جديد</h3>
      <div class="grid-2">
        <div>
          <div class="row"><label>رقم العدد</label><input type="text" id="${key}-number-ar" /></div>
          <div class="row"><label>عنوان العدد</label><input type="text" id="${key}-title-ar" /></div>
          <div class="row"><label>وصف العدد</label><textarea id="${key}-short-ar"></textarea></div>
          <div class="row"><label>صورة الغلاف</label><input type="file" id="${key}-image" accept="image/*" /></div>
          <div class="row"><label>PDF العدد كامل</label><input type="file" id="${key}-full-pdf-file" accept="application/pdf" /></div>
          ${buildVideoFields(key)}
        </div>
        <div><div class="preview" id="${key}-preview"></div></div>
      </div>

      <div class="card" style="margin-top:14px">
        <h3>مقالات العدد</h3>
        <div id="${key}-articles-wrap"></div>
        <div class="actions">
          <button class="btn btn-ghost btn-small" type="button" onclick="addEditionArticleRow('${key}')">+ إضافة مقال</button>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-green btn-small" type="button" onclick="publishItem('${key}')">💾 حفظ العدد</button>
        <button class="btn btn-ghost btn-small" type="button" onclick="resetForm('${key}')">🔄 مسح</button>
      </div>
    </div>
  `;
}

function buildContentForm(key, title) {
  return `
    <div class="card">
      <h3>📝 إضافة إلى ${esc(title)}</h3>
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
          ${buildVideoFields(key)}
          <div class="preview" id="${key}-preview"></div>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-green btn-small" type="button" onclick="publishItem('${key}')">💾 حفظ</button>
        <button class="btn btn-ghost btn-small" type="button" onclick="resetForm('${key}')">🔄 مسح</button>
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
        <div>📊 العناصر: <strong id="${key}-count">0</strong></div>
        <input type="search" id="${key}-search" placeholder="ابحث..." style="max-width:240px" />
      </div>
      <div class="list" id="${key}-list"></div>
    </div>
  `;
}

function buildPreviewHTML(imageUrl = "", pdfUrl = "") {
  let out = "";
  if (pdfUrl) {
    out += `<div style="margin-bottom:6px;padding:8px;background:#dbeafe;border-radius:6px;border-left:3px solid #0ea5e9;">📄 PDF: <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer" style="color:#0369a1;font-weight:600;">فتح الملف</a></div>`;
  }
  if (imageUrl) {
    out += `<div style="border-radius:8px;overflow:hidden;margin-top:6px;"><img src="${imageUrl}" alt="preview" style="max-width:100%;height:auto;"></div>`;
  }
  return out;
}

function bindPreviewInputs(key) {
  const imgInput = el(`${key}-image`);
  const pdfInput = el(`${key}-pdf-file`);
  const fullPdfInput = el(`${key}-full-pdf-file`);
  const preview = el(`${key}-preview`);
  const liveLink = el(`${key}-live-link`);
  const platformPreview = el(`${key}-platform-preview`);

  if (!preview) return;

  // Live link platform detection
  if (liveLink && platformPreview) {
    liveLink.addEventListener("input", () => {
      const url = liveLink.value.trim();
      if (!url) {
        platformPreview.innerHTML = "اكتب الرابط للمعاينة";
        platformPreview.style.color = "#6b7280";
        return;
      }

      const platform = detectPlatform(url);
      const meta = PLATFORM_META[platform];
      platformPreview.innerHTML = `<strong style="color:${meta.color};">${meta.icon} ${meta.label}</strong>`;
      platformPreview.style.color = meta.color;
    });
  }

  if (imgInput) {
    imgInput.addEventListener("change", () => {
      const file = imgInput.files?.[0];
      if (!file) return;
      preview.innerHTML = `<div style="border-radius:8px;overflow:hidden;"><img src="${URL.createObjectURL(file)}" alt="preview" style="max-width:100%;height:auto;"></div>`;
    });
  }

  const videoInput = el(`${key}-video-file`);
  if (videoInput) {
    videoInput.addEventListener("change", () => {
      const file = videoInput.files?.[0];
      if (!file) return;
      const v = document.createElement("video");
      v.src = URL.createObjectURL(file);
      v.controls = true;
      v.muted = true;
      v.style.cssText = "width:100%;border-radius:8px";
      preview.appendChild(v);
    });
    videoInput.addEventListener("change", () => syncVideoCoverField(key));
    el(`${key}-video-link`)?.addEventListener("input", () => syncVideoCoverField(key));
    el(`${key}-video-cover`)?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) showVideoCoverPreview(key, URL.createObjectURL(file));
    });
  }

  if (pdfInput) {
    pdfInput.addEventListener("change", () => {
      const file = pdfInput.files?.[0];
      preview.innerHTML = file ? `<div style="padding:8px;background:#dbeafe;border-radius:6px;border-left:3px solid #0ea5e9;">📄 ${esc(file.name)}</div>` : "";
    });
  }

  if (fullPdfInput) {
    fullPdfInput.addEventListener("change", () => {
      const file = fullPdfInput.files?.[0];
      if (!file) return;
      preview.innerHTML += `<div style="padding:8px;background:#dcfce7;border-radius:6px;border-left:3px solid #16a34a;margin-top:6px;">📑 العدد الكامل: ${esc(file.name)}</div>`;
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
      const statusSelect = el(`${key}-status`);
      if (statusSelect) statusSelect.value = "upcoming";
      setupLiveListener();
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
  const filePath = `pdfs/${sectionKey}/${itemId}-${Date.now()}-${safeName}`;
  const storageRef = ref(storage, filePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, path: filePath };
}

async function uploadImageToStorage(file, sectionKey, itemId) {
  await ensureFreshAuth();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = `images/${sectionKey}/${itemId}-${Date.now()}-${safeName}`;
  const storageRef = ref(storage, filePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, path: filePath };
}

// Resumable, so large files survive network hiccups and can report progress
async function uploadVideoToStorage(file, sectionKey, itemId) {
  await ensureFreshAuth();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = `videos/${sectionKey}/${itemId}-${Date.now()}-${safeName}`;
  const storageRef = ref(storage, filePath);
  const bar = el(`${sectionKey}-video-progress`);
  const warnOnLeave = (e) => e.preventDefault();

  window.addEventListener("beforeunload", warnOnLeave);
  if (bar) bar.hidden = false;
  try {
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type || "video/mp4" });
    task.on("state_changed", (snap) => {
      const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
      const mb = (n) => (n / 1048576).toFixed(1);
      setStatus(`جاري رفع الفيديو... ${pct}%`);
      if (bar) {
        bar.querySelector("i").style.inlineSize = `${pct}%`;
        bar.querySelector("span").textContent = `${pct}% — ${mb(snap.bytesTransferred)} / ${mb(snap.totalBytes)} MB`;
      }
    });
    await task;
    return { url: await getDownloadURL(storageRef), path: filePath };
  } finally {
    window.removeEventListener("beforeunload", warnOnLeave);
    if (bar) bar.hidden = true;
  }
}

// Fills obj.video and its cover from the form; returns replaced Storage files to delete once the save succeeds
async function applyVideoFields(key, obj, existing) {
  const file = el(`${key}-video-file`)?.files?.[0];
  const link = el(`${key}-video-link`)?.value.trim() || "";
  const oldPath = existing?.videoPath || "";

  if (file) {
    const uploaded = await uploadVideoToStorage(file, key, obj.id);
    obj.video = uploaded.url;
    obj.videoPath = uploaded.path;
  } else {
    if (link && !/^https:\/\//i.test(link)) throw new Error("رابط الفيديو يجب أن يبدأ بـ https://");
    obj.video = link;
    obj.videoPath = link && link === existing?.video ? oldPath : "";
  }

  const coverFile = el(`${key}-video-cover`)?.files?.[0];
  const oldCoverPath = existing?.videoCoverPath || "";
  if (obj.video && coverFile) {
    setStatus("جاري رفع غلاف الفيديو...");
    const uploaded = await uploadImageToStorage(coverFile, `${key}-video-covers`, obj.id);
    obj.videoCover = uploaded.url;
    obj.videoCoverPath = uploaded.path;
  } else if (!obj.video) {
    obj.videoCover = "";
    obj.videoCoverPath = "";
  }

  return [
    oldPath !== obj.videoPath ? oldPath : "",
    oldCoverPath !== obj.videoCoverPath ? oldCoverPath : ""
  ].filter(Boolean);
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
  row.style.background = "#f9fafb";
  row.dataset.rowId = uid();
  row.dataset.file = article.file || "";
  row.dataset.filePath = article.filePath || "";

  const count = wrap.children.length + 1;

  row.innerHTML = `
    <h4 style="margin-bottom:8px;color:#374151;">📄 المقال رقم ${count}</h4>
    <div class="row">
      <label>عنوان المقال</label>
      <input type="text" class="edition-article-title" placeholder="عنوان المقال..." value="${esc(article.title || "")}" />
    </div>
    <div class="row">
      <label>وصف المقال</label>
      <textarea class="edition-article-description" placeholder="وصف مختصر للمقال..." rows="2">${esc(article.description || "")}</textarea>
    </div>
    <div class="row">
      <label>PDF المقال</label>
      <input type="file" class="edition-article-file" accept="application/pdf" />
      ${article.file ? `<div style="margin-top:6px;padding:8px;background:#dbeafe;border-radius:6px;border-left:3px solid #0ea5e9;"><a href="${article.file}" target="_blank" rel="noopener noreferrer" style="color:#0369a1;font-weight:600;">📄 فتح الملف الحالي</a></div>` : ""}
    </div>
    <div class="actions" style="gap:6px;">
      <button class="btn btn-red btn-small" type="button" onclick="this.closest('.edition-article-row').remove()">🗑️ حذف</button>
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

  console.log("📤 Saving to Firestore:", {
    collection: "content",
    docId: docIdValue,
    section: sectionKey,
    status: payload.status
  });

  await window.fs.setDoc(
    window.fs.doc(window.fs.db, "content", docIdValue),
    payload,
    { merge: true }
  );

  console.log("✅ Saved successfully");
  return payload;
}

async function saveItem(key) {
  const cfg = getSectionConfig(key);
  if (!cfg) return;

  // a long video upload must not be started twice by a second click
  const saveBtn = document.querySelector("#content .btn-green");
  if (saveBtn) saveBtn.disabled = true;
  let staleVideoPaths = [];

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
      video: existing?.video || "",
      videoPath: existing?.videoPath || "",
      videoCover: existing?.videoCover || "",
      videoCoverPath: existing?.videoCoverPath || "",
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

      staleVideoPaths = await applyVideoFields(key, obj, existing);

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

      console.log("🔴 Live item data:", {
        title: obj.title.ar,
        status: obj.status,
        platform: detectPlatform(obj.file),
        file: obj.file.substring(0, 50) + "..."
      });
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

      staleVideoPaths = await applyVideoFields(key, obj, existing);
    }

    upsertLocal(key, obj);
    await upsertFirestore(key, obj);

    for (const path of staleVideoPaths) {
      await deleteObject(ref(storage, path)).catch((e) => console.error(e));
    }

    // Broadcast live updates
    if (key === "live") {
      broadcastLiveUpdate();
    }

    resetForm(key);
    renderList(key);
    showNotification(`✅ تم حفظ: ${obj.title.ar || "عنصر جديد"}`, "success");
    setStatus(`تم حفظ: ${obj.title.ar || "عنصر جديد"}`);
  } catch (err) {
    console.error("❌ Save error:", err);
    if (isPermissionError(err)) {
      setStatus("فشل الحفظ: ليست لديك صلاحية للوصول إلى Firestore/Storage");
      showNotification("❌ تحقق من Firestore Rules و Storage Rules", "error");
      return;
    }
    setStatus(err.message || "حدث خطأ أثناء الحفظ");
    showNotification(err.message || "حدث خطأ أثناء الحفظ", "error");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
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

  if (key === "live") {
    if (el(`${key}-title-en`)) el(`${key}-title-en`).value = getByLang(item.title, "en");
    if (el(`${key}-title-fr`)) el(`${key}-title-fr`).value = getByLang(item.title, "fr");
    if (el(`${key}-short-en`)) el(`${key}-short-en`).value = getByLang(item.short, "en");
    if (el(`${key}-short-fr`)) el(`${key}-short-fr`).value = getByLang(item.short, "fr");
    if (el(`${key}-date-en`)) el(`${key}-date-en`).value = getByLang(item.date, "en");
    if (el(`${key}-date-fr`)) el(`${key}-date-fr`).value = getByLang(item.date, "fr");
    if (el(`${key}-live-link`)) el(`${key}-live-link`).value = item.file || "";
    if (el(`${key}-status`)) el(`${key}-status`).value = item.status || "upcoming";

    const platformPreview = el(`${key}-platform-preview`);
    if (platformPreview && item.file) {
      const platform = detectPlatform(item.file);
      const meta = PLATFORM_META[platform];
      platformPreview.innerHTML = `<strong style="color:${meta.color};">${meta.icon} ${meta.label}</strong>`;
      platformPreview.style.color = meta.color;
    }
  } else {
    if (el(`${key}-live-link`)) el(`${key}-live-link`).value = item.file || "";
  }

  if (el(`${key}-video-link`)) el(`${key}-video-link`).value = item.video || "";
  showVideoCoverPreview(key, item.videoCover);
  syncVideoCoverField(key);

  const p = el(`${key}-preview`);
  if (p) {
    let previewHtml = buildPreviewHTML(item.image, item.file);
    if (key === "editions" && item.fullIssueFile) {
      previewHtml =
        `<div style="margin-bottom:6px;padding:8px;background:#dcfce7;border-radius:6px;border-left:3px solid #16a34a;">📑 PDF العدد الكامل: <a href="${item.fullIssueFile}" target="_blank" rel="noopener noreferrer" style="color:#15803d;font-weight:600;">فتح الملف</a></div>` +
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

  document.querySelector(".live-container")?.scrollIntoView({ behavior: "smooth" });
}

// ============================================================
// Delete Item
// ============================================================
async function deleteItemById(sectionKey, id) {
  if (!confirm("هل تريد الحذف النهائي؟")) return;

  const target = state.bySection[sectionKey].find((x) => String(x.docId || x.id) === String(id));
  const itemTitle = getByLang(target?.title || "عنصر");

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
    try {
      if (target?.videoPath) await deleteObject(ref(storage, target.videoPath));
    } catch (e) {
      console.error(e);
    }
    try {
      if (target?.videoCoverPath) await deleteObject(ref(storage, target.videoCoverPath));
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

    if (sectionKey === "live") {
      broadcastLiveUpdate();
    }

    showNotification(`✅ تم حذف: ${itemTitle}`, "success");
    setStatus("تم الحذف");
  } catch (err) {
    console.error(err);
    if (isPermissionError(err)) {
      setStatus("فشل الحذف: ليست لديك صلاحية");
      showNotification("❌ تحقق من Firebase Rules", "error");
      return;
    }
    setStatus(err.message || "فشل الحذف");
    showNotification(err.message || "فشل الحذف", "error");
  }
}

// ============================================================
// Reset Form
// ============================================================
function resetForm(key) {
  state.editing = { key: null, id: null };

  ["title-ar", "title-en", "title-fr", "author-ar", "aff-ar", "date-ar", "date-en", "date-fr", "short-ar", "short-en", "short-fr", "details-ar", "live-link", "video-link", "video-file", "video-cover"].forEach((name) => {
    const node = el(`${key}-${name}`);
    if (node) node.value = "";
  });
  showVideoCoverPreview(key, "");
  syncVideoCoverField(key);

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
    const platformPreview = el(`${key}-platform-preview`);
    if (platformPreview) {
      platformPreview.innerHTML = "اكتب الرابط للمعاينة";
      platformPreview.style.color = "#6b7280";
    }
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
// Render List - Enhanced for Live
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
    list.innerHTML = `<div class="empty">📭 لا توجد بيانات في هذا القسم حالياً.<br><small>أضف محتوى جديداً من الأعلى.</small></div>`;
    return;
  }

  list.innerHTML = "";

  data.forEach((item) => {
    const title = getByLang(item.title, "ar") || "بدون عنوان";
    const descBase = getByLang(item.short, "ar") || getByLang(item.details, "ar") || "";
    const desc = descBase.length > 100 ? `${descBase.slice(0, 100)}...` : descBase;
    const author = getByLang(item.author, "ar") || "";
    
    let dateLabel = "";
    let statusBadge = "";
    if (key === "editions") {
      dateLabel = `العدد ${item.editionNumber || item.issueNumber || ""}`;
    } else if (key === "live") {
      const statusEmoji = item.status === "live" ? "🔴" : item.status === "upcoming" ? "📅" : "🎬";
      const statusText = item.status === "live" ? "بث مباشر" : item.status === "upcoming" ? "قادم قريباً" : "انتهى";
      statusBadge = `<span style="display:inline-block;padding:4px 8px;background:${item.status === "live" ? "#fee2e2" : item.status === "upcoming" ? "#fef3c7" : "#dcfce7"};border-radius:4px;font-size:11px;color:${item.status === "live" ? "#dc2626" : item.status === "upcoming" ? "#92400e" : "#15803d"};font-weight:700;margin-right:8px;">${statusEmoji} ${statusText}</span>`;
      dateLabel = getByLang(item.date, "ar") || "";
    } else {
      dateLabel = getByLang(item.date, "ar") || "";
    }

    let imgHtml = "";
    if (key === "live") {
      const platform = detectPlatform(item.file);
      const meta = PLATFORM_META[platform];
      imgHtml = `<div style="display:flex;align-items:center;justify-content:center;width:70px;height:70px;background:${meta.color}22;border-radius:8px;font-size:28px;flex-shrink:0;">${meta.icon}</div>`;
    } else {
      imgHtml = item.image
        ? `<img src="${item.image}" alt="img" />`
        : `<img src="logo1222.jpeg" alt="logo" />`;
    }

    const articlesHtml =
      key === "editions" && Array.isArray(item.articles) && item.articles.length
        ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">${item.articles.map((a) => `<span style="display:inline-block;padding:4px 8px;border-radius:4px;background:#f3f4f6;border-left:3px solid #ec4899;font-size:11px;color:#374151;"><strong>${esc(a.title || "مقال")}</strong></span>`).join("")}</div>`
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
        <div class="item-meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${statusBadge}
          <span>${esc(author)}</span>
          <span>${esc(dateLabel)}</span>
        </div>
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
    showNotification(`✅ تم تحميل ${all.length} عنصر من Firestore`, "success");
    setStatus(`تم تحميل ${all.length} عنصر من Firestore`);
  } catch (e) {
    console.error(e);
    if (isPermissionError(e)) {
      setStatus("فشل تحميل Firestore: لا توجد صلاحيات كافية");
      showNotification("❌ تحقق من Firestore Rules", "error");
      return;
    }
    setStatus(`فشل تحميل Firestore: ${e.message || "Permission denied"}`);
    showNotification(`❌ فشل: ${e.message || "Permission denied"}`, "error");
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
      showNotification(`✅ تمت المزامنة: ${merged.length} عنصر`, "success");
    } else if (merged.length) {
      setStatus(`تم تحميل البيانات المحلية: ${merged.length} عنصر`);
    } else {
      setStatus("لا توجد بيانات حالياً");
    }
  } catch (e) {
    console.error(e);
    setStatus(`Firestore sync failed: ${e.message || "Permission denied"}`);
    showNotification(`❌ Firestore sync failed`, "error");
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
  a.download = `ofouq-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showNotification("✅ تم تصدير البيانات", "success");
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
  showNotification("✅ تم مسح localStorage", "success");
  setStatus("تم مسح localStorage");
}

// ============================================================
// Add Notification Styles
// ============================================================
function addNotificationStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .admin-notification {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      font-weight: 600;
      z-index: 5000;
      transform: translateX(400px);
      transition: transform 0.3s ease;
      max-width: 90%;
    }

    .admin-notification.show {
      transform: translateX(0);
    }

    .admin-notification.success {
      border-left: 4px solid #22c55e;
      color: #166534;
    }

    .admin-notification.error {
      border-left: 4px solid #ef4444;
      color: #991b1b;
    }

    .admin-notification.info {
      border-left: 4px solid #3b82f6;
      color: #1e40af;
    }

    .notification-icon {
      font-size: 16px;
      flex-shrink: 0;
    }

    .notification-text {
      flex: 1;
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
// Initialization
// ============================================================
async function init() {
  addNotificationStyles();
  buildMenu();
  rebuildDbFromCache();

  if (isAdminUser(auth.currentUser)) {
    showSection(state.currentSectionKey);
    await recoverAllData();
  }

  el("loginBtn")?.addEventListener("click", loginAdmin);
  el("loginGoogleBtn")?.addEventListener("click", loginAdminGoogle);

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
    if (isAdminUser(user)) {
      rebuildDbFromCache();
      showSection(state.currentSectionKey);
      await recoverAllData();
    }
  });

  // Setup live listener on load
  setupLiveListener();
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