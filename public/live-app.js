/* ============================================================
   LIVE STREAMING APP - Firestore-Powered with Debugging
   ============================================================ */

import { app, auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// ============================================================
// TRANSLATIONS (keep same as before)
// ============================================================
const translations = {
  ar: {
    title: "البث المباشر",
    brand_name: "أفق",
    brand_tagline: "منصة أكاديمية حديثة",
    mobile_discover: "اكتشف",
    nav_home: "الرئيسية",
    nav_research_peer: "أبحاث محكمة",
    nav_articles_peer: "مقالات محكمة",
    nav_files: "ملفات بحثية",
    nav_foreign: "مقالات أجنبية",
    nav_articles: "مقالات",
    nav_editions: "إصداراتنا",
    nav_activities: "أنشطتنا",
    nav_academic: "أكاديمي",
    nav_live: "بث مباشر",
    nav_rules: "شروط النشر",
    nav_contact: "اتصل بنا",
    nav_board: "هيئة التحرير",
    nav_login: "تسجيل الدخول",
    nav_join: "انضم إلينا",
    hero_live_badge: "🔴 البث المباشر الآن",
    hero_idle_badge: "⚪ لا يوجد بث حالياً",
    hero_title_live: "البث الحي",
    hero_sub_live: "تابع معنا الآن الفعاليات والحوارات والندوات العلمية مباشرة",
    sec_live_multi: "بثوث مباشرة أخرى الآن",
    sec_live_next: "البث القادم",
    sec_live_ended: "الإعادات السابقة",
    no_live: "لا توجد بثوث مباشرة حالياً",
    no_live_sub: "ستظهر البثوث القادمة هنا بمجرد إضافتها من لوحة التحكم.",
    no_ended: "لا توجد إعادات بعد",
    remind_saved: "تم حفظ تذكير البث",
    btn_remind: "تذكير لاحقاً",
    watch_replay: "▶ مشاهدة الإعادة",
    watch_original: "مشاهدة على المصدر",
    watch_now: "مشاهدة الآن",
    copy_link: "نسخ الرابط",
    copy_success: "تم نسخ الرابط!",
    copy_fail: "تعذر نسخ الرابط، انسخه يدوياً",
    embed_issue_note: "لم يعمل التضمين؟",
    embed_issue_link: "افتح الرابط الأصلي",
    logout: "تسجيل الخروج",
    sp_politics: "تخصص علوم سياسية",
    sp_ir: "العلاقات الدولية",
    sp_admin_law: "القانون الإداري",
    sp_const_law: "القانون الدستوري",
    sp_public_policy: "السياسات العمومية"
  },
  en: {
    title: "Live Stream",
    brand_name: "Ofouq",
    brand_tagline: "Modern academic platform",
    mobile_discover: "Discover",
    nav_home: "Home",
    nav_research_peer: "Peer-reviewed research",
    nav_articles_peer: "Peer-reviewed articles",
    nav_files: "Research files",
    nav_foreign: "Foreign articles",
    nav_articles: "Articles",
    nav_editions: "Our publications",
    nav_activities: "Activities",
    nav_academic: "Academic",
    nav_live: "Live",
    nav_rules: "Submission rules",
    nav_contact: "Contact us",
    nav_board: "Editorial board",
    nav_login: "Login",
    nav_join: "Join us",
    hero_live_badge: "🔴 Live now",
    hero_idle_badge: "⚪ Nothing live right now",
    hero_title_live: "Live Stream",
    hero_sub_live: "Follow our live events, seminars and talks",
    sec_live_multi: "Also live right now",
    sec_live_next: "Upcoming Live",
    sec_live_ended: "Previous Replays",
    no_live: "No live streams currently",
    no_live_sub: "Upcoming streams will appear here once added.",
    no_ended: "No replays yet",
    remind_saved: "Stream reminder saved",
    btn_remind: "Remind me later",
    watch_replay: "▶ Watch replay",
    watch_original: "Watch on source",
    watch_now: "Watch now",
    copy_link: "Copy link",
    copy_success: "Link copied!",
    copy_fail: "Couldn't copy — copy it manually",
    embed_issue_note: "Embed not loading?",
    embed_issue_link: "Open the original link",
    logout: "Logout",
    sp_politics: "Political Science",
    sp_ir: "International Relations",
    sp_admin_law: "Administrative Law",
    sp_const_law: "Constitutional Law",
    sp_public_policy: "Public Policy"
  },
  fr: {
    title: "Diffusion en direct",
    brand_name: "Ofouq",
    brand_tagline: "Plateforme académique moderne",
    mobile_discover: "Découvrir",
    nav_home: "Accueil",
    nav_research_peer: "Recherches évaluées",
    nav_articles_peer: "Articles évalués",
    nav_files: "Dossiers de recherche",
    nav_foreign: "Articles étrangers",
    nav_articles: "Articles",
    nav_editions: "Nos publications",
    nav_activities: "Activités",
    nav_academic: "Académique",
    nav_live: "Direct",
    nav_rules: "Conditions de publication",
    nav_contact: "Contactez-nous",
    nav_board: "Comité éditorial",
    nav_login: "Connexion",
    nav_join: "Rejoignez-nous",
    hero_live_badge: "🔴 En direct",
    hero_idle_badge: "⚪ Aucun direct pour le moment",
    hero_title_live: "Diffusion en direct",
    hero_sub_live: "Suivez nos événements, séminaires et conférences en direct",
    sec_live_multi: "Autres directs en ce moment",
    sec_live_next: "Prochains directs",
    sec_live_ended: "Rediffusions précédentes",
    no_live: "Aucune diffusion pour le moment",
    no_live_sub: "Les prochains directs apparaîtront ici.",
    no_ended: "Aucune rediffusion pour le moment",
    remind_saved: "Rappel enregistré",
    btn_remind: "Me rappeler plus tard",
    watch_replay: "▶ Voir la rediffusion",
    watch_original: "Voir sur la source",
    watch_now: "Regarder",
    copy_link: "Copier le lien",
    copy_success: "Lien copié !",
    copy_fail: "Copie impossible — copiez-le manuellement",
    embed_issue_note: "L'intégration ne s'affiche pas ?",
    embed_issue_link: "Ouvrir le lien original",
    logout: "Déconnexion",
    sp_politics: "Science politique",
    sp_ir: "Relations internationales",
    sp_admin_law: "Droit administratif",
    sp_const_law: "Droit constitutionnel",
    sp_public_policy: "Politiques publiques"
  }
};

// ============================================================
// STATE
// ============================================================
let currentLang = localStorage.getItem("lang") || "ar";
let user = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
let activeLiveId = null;
let __liveItemsCache = [];
let liveUnsubscribe = null;

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function t(key) {
  const dict = translations[currentLang] || translations.ar;
  return dict[key] || "";
}

function getText(field) {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field[currentLang] || field.ar || field.fr || field.en || "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, function(m) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m];
  });
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icons = { success: "✅", info: "ℹ️" };
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || "ℹ️"}</span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("removing");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    showToast(`🔗 ${t("copy_success")}`, "success");
    return true;
  } catch (error) {
    console.warn("Clipboard copy failed:", error);
    showToast(`⚠️ ${t("copy_fail")}`, "info");
    return false;
  }
}
window.copyToClipboard = copyToClipboard;

// ============================================================
// PLATFORM DETECTION
// ============================================================
const PLATFORM_META = {
  youtube: { label: "YouTube", icon: "▶️", bg: "rgba(255,0,0,.18)", color: "#ff6b6b" },
  facebook: { label: "Facebook", icon: "📘", bg: "rgba(59,89,152,.22)", color: "#8ab4ff" },
  twitch: { label: "Twitch", icon: "🟣", bg: "rgba(145,70,255,.2)", color: "#c4a3ff" },
  kick: { label: "Kick", icon: "🟢", bg: "rgba(83,252,25,.16)", color: "#8dffb0" },
  twitter: { label: "X (Twitter)", icon: "✖️", bg: "rgba(255,255,255,.12)", color: "#e5e7eb" },
  instagram: { label: "Instagram", icon: "📸", bg: "rgba(225,48,108,.2)", color: "#f9a8d4" },
  tiktok: { label: "TikTok", icon: "🎵", bg: "rgba(255,255,255,.12)", color: "#e5e7eb" },
  vimeo: { label: "Vimeo", icon: "🎬", bg: "rgba(26,183,234,.2)", color: "#7fd8f7" },
  dailymotion: { label: "Dailymotion", icon: "🎞️", bg: "rgba(0,131,226,.2)", color: "#7fc4f7" },
  video: { label: "فيديو", icon: "🎥", bg: "rgba(236,72,153,.18)", color: "#f9a8d4" },
  unknown: { label: "رابط خارجي", icon: "🔗", bg: "rgba(255,255,255,.1)", color: "#e5e7eb" }
};

function detectPlatform(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url) return { platform: "unknown", embedUrl: "", aspect: "aspect-auto" };

  let m;

  // YouTube
  m = url.match(/(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/i);
  if (m) {
    return {
      platform: "youtube", aspect: "aspect-16-9",
      embedUrl: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0&modestbranding=1`
    };
  }

  // Facebook
  if (/facebook\.com|fb\.watch/i.test(url)) {
    return { platform: "facebook", aspect: "aspect-9-16" };
  }

  // Twitch
  m = url.match(/twitch\.tv\/(?:[a-zA-Z0-9_]+\/)?videos?\/(\d+)/i);
  if (m) {
    return {
      platform: "twitch", aspect: "aspect-16-9",
      embedUrl: `https://player.twitch.tv/?video=${m[1]}&parent=${location.hostname}&autoplay=true`
    };
  }

  m = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)\/?(?:\?.*)?$/i);
  if (m) {
    return {
      platform: "twitch", aspect: "aspect-16-9",
      embedUrl: `https://player.twitch.tv/?channel=${m[1]}&parent=${location.hostname}&autoplay=true`
    };
  }

  // Kick
  m = url.match(/kick\.com\/([a-zA-Z0-9_]+)\/?(?:\?.*)?$/i);
  if (m) {
    return {
      platform: "kick", aspect: "aspect-16-9",
      embedUrl: `https://player.kick.com/${m[1]}`
    };
  }

  // Vimeo
  m = url.match(/vimeo\.com\/(\d+)/i);
  if (m) {
    return {
      platform: "vimeo", aspect: "aspect-16-9",
      embedUrl: `https://player.vimeo.com/video/${m[1]}`
    };
  }

  // Dailymotion
  m = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/i);
  if (m) {
    return {
      platform: "dailymotion", aspect: "aspect-16-9",
      embedUrl: `https://www.dailymotion.com/embed/video/${m[1]}`
    };
  }

  // Twitter/X
  if (/(?:twitter\.com|x\.com)\/[^\/]+\/status\/\d+/i.test(url)) {
    return { platform: "twitter", aspect: "aspect-auto" };
  }

  // Instagram
  if (/instagram\.com\/(?:p|reel|tv)\//i.test(url)) {
    return { platform: "instagram", aspect: "aspect-auto" };
  }

  // TikTok
  if (/tiktok\.com/i.test(url)) {
    return { platform: "tiktok", aspect: "aspect-9-16" };
  }

  // Direct video
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
    return { platform: "video", aspect: "aspect-16-9", embedUrl: url };
  }

  return { platform: "unknown", aspect: "aspect-auto", embedUrl: "" };
}

// ============================================================
// FIRESTORE LISTENER WITH DEBUGGING
// ============================================================
function startLiveListener() {
  console.log("🔄 Starting Firestore listener...");

  const waitForFirestore = () => {
    return new Promise((resolve) => {
      if (window.fs && window.fs.db) {
        console.log("✅ Firestore ready immediately");
        return resolve();
      }
      console.log("⏳ Waiting for Firestore to be ready...");
      window.addEventListener("firestoreReady", () => {
        console.log("✅ Firestore ready via event");
        resolve();
      }, { once: true });
      setTimeout(() => {
        console.log("⏰ Firestore timeout - using fallback");
        resolve();
      }, 5000);
    });
  };

  waitForFirestore().then(() => {
    if (!window.fs || !window.fs.db) {
      console.warn("❌ Firestore not available, using localStorage only");
      const cached = JSON.parse(localStorage.getItem("live") || "[]");
      console.log("📦 Loaded from localStorage:", cached.length, "items");
      __liveItemsCache = cached;
      renderLive();
      return;
    }

    try {
      console.log("🔗 Connecting to Firestore...");

      if (liveUnsubscribe) {
        console.log("🧹 Cleaning up old listener");
        liveUnsubscribe();
      }

      const contentCollection = window.fs.collection(window.fs.db, "content");
      console.log("📂 Content collection reference created");

      // Try with where clause first
      try {
        const liveQuery = window.fs.query(
          contentCollection,
          window.fs.where("section", "==", "live")
        );
        console.log("🔍 Query created: section == 'live'");

        liveUnsubscribe = window.fs.onSnapshot(liveQuery, (snapshot) => {
          console.log("📡 Received Firestore update:", snapshot.size, "items");
          const liveItems = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            console.log("  - Item:", doc.id, data.title?.ar || "No title");
            liveItems.push({
              id: doc.id,
              docId: doc.id,
              ...data
            });
          });

          __liveItemsCache = liveItems;
          localStorage.setItem("live", JSON.stringify(liveItems));
          console.log("💾 Cached", liveItems.length, "items to localStorage");
          renderLive();
        }, (error) => {
          console.error("❌ Firestore listener error:", error);
          console.log("🔄 Trying to query all content...");
          
          // Fallback: query all and filter manually
          const allQuery = window.fs.query(contentCollection);
          window.fs.getDocs(allQuery).then((snapshot) => {
            const liveItems = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              if (data.section === "live") {
                liveItems.push({
                  id: doc.id,
                  docId: doc.id,
                  ...data
                });
              }
            });
            console.log("✅ Fallback query found", liveItems.length, "live items");
            __liveItemsCache = liveItems;
            localStorage.setItem("live", JSON.stringify(liveItems));
            renderLive();
          }).catch(fallbackError => {
            console.error("❌ Fallback also failed:", fallbackError);
            const cached = JSON.parse(localStorage.getItem("live") || "[]");
            __liveItemsCache = cached;
            renderLive();
          });
        });
      } catch (queryError) {
        console.error("❌ Query creation failed:", queryError);
        
        // Double fallback: get all docs
        window.fs.getDocs(contentCollection).then((snapshot) => {
          const liveItems = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.section === "live") {
              liveItems.push({
                id: doc.id,
                docId: doc.id,
                ...data
              });
            }
          });
          console.log("✅ Double fallback found", liveItems.length, "live items");
          __liveItemsCache = liveItems;
          localStorage.setItem("live", JSON.stringify(liveItems));
          renderLive();
        }).catch(allDocsError => {
          console.error("❌ All docs query failed:", allDocsError);
          const cached = JSON.parse(localStorage.getItem("live") || "[]");
          __liveItemsCache = cached;
          renderLive();
        });
      }
    } catch (error) {
      console.error("❌ Critical error in Firestore setup:", error);
      const cached = JSON.parse(localStorage.getItem("live") || "[]");
      __liveItemsCache = cached;
      renderLive();
    }
  });
}

// ============================================================
// RENDERING FUNCTIONS (same as before)
// ============================================================
function renderPrimary(item) {
  const liveVideo = document.getElementById("liveVideo");
  const primaryCaption = document.getElementById("primaryCaption");
  const primaryFallback = document.getElementById("primaryFallback");

  if (!liveVideo) return;

  liveVideo.className = "live-video";
  liveVideo.innerHTML = "";
  primaryFallback.innerHTML = "";
  primaryCaption.innerHTML = "";

  if (!item) {
    liveVideo.classList.add("aspect-9-16");
    liveVideo.innerHTML = `
      <div class="live-overlay">
        <h3>${t("no_live")}</h3>
        <p style="font-size:clamp(16px,4vw,20px);">${t("no_live_sub")}</p>
      </div>`;
    return;
  }

  activeLiveId = item.id;
  const safeUrl = String(item.file || "").trim();
  const det = detectPlatform(safeUrl);
  liveVideo.classList.add(det.aspect || "aspect-9-16");
  liveVideo.innerHTML = buildMediaHTML(item, safeUrl, det, liveVideo);

  const title = escapeHtml(getText(item.title));
  const desc = escapeHtml(getText(item.short));
  primaryCaption.innerHTML = `
    ${platformBadgeHTML(det.platform)}
    ${title ? `<h3>${title}</h3>` : ""}
    ${desc ? `<p>${desc}</p>` : ""}
    <div class="card-actions" style="justify-content:center;margin-top:10px;">
      <button class="card-btn secondary" type="button" onclick="copyToClipboard('${safeUrl.replace(/'/g, "\\'")}')" title="${t("copy_link")}">🔗 ${t("copy_link")}</button>
    </div>
  `;

  if (safeUrl && needsFallbackLink(det.platform)) {
    primaryFallback.innerHTML = `${t("embed_issue_note")} <a href="${safeUrl}" target="_blank" rel="noopener">${t("embed_issue_link")}</a>`;
  }
}

function buildMediaHTML(item, safeUrl, det, container) {
  const title = escapeHtml(getText(item.title) || t("hero_title_live"));

  switch (det.platform) {
    case "youtube":
    case "vimeo":
    case "dailymotion":
      return `<iframe src="${det.embedUrl}" title="${title}" loading="lazy"
        allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;web-share"
        allowfullscreen></iframe>`;

    case "twitch":
    case "kick":
      return `<iframe src="${det.embedUrl}" title="${title}" loading="lazy"
        allow="autoplay;fullscreen" allowfullscreen></iframe>`;

    case "video":
      return `<video controls autoplay playsinline src="${det.embedUrl}"></video>`;

    case "facebook":
      return `
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:10px;">
          <div class="fb-video" data-href="${safeUrl}" data-width="700" data-show-text="false" data-allowfullscreen="true">
            <div class="fb-xfbml-parse-ignore">
              <blockquote cite="${safeUrl}"><a href="${safeUrl}" target="_blank" rel="noopener">${title}</a></blockquote>
            </div>
          </div>
        </div>`;

    case "twitter":
      return `<blockquote class="twitter-tweet" data-dnt="true">
        <a href="${safeUrl}"></a></blockquote>`;

    case "instagram":
      return `<blockquote class="instagram-media" data-instgrm-permalink="${safeUrl}"
        data-instgrm-version="14" style="width:100%;"></blockquote>`;

    case "tiktok":
      return `<blockquote class="tiktok-embed" cite="${safeUrl}" style="max-width:100%;min-width:100%;">
        <section><a target="_blank" rel="noopener" href="${safeUrl}">${title}</a></section></blockquote>`;

    default:
      return `
        <div class="live-overlay" style="position:static;background:transparent;">
          <h3 style="animation:none;">${title}</h3>
          <p style="font-size:15px;margin-bottom:18px;">${escapeHtml(getText(item.short) || "")}</p>
          <a class="card-btn" href="${safeUrl}" target="_blank" rel="noopener">${t("watch_original")}</a>
        </div>`;
  }
}

function platformBadgeHTML(platform) {
  const meta = PLATFORM_META[platform] || PLATFORM_META.unknown;
  return `<span class="platform-badge" style="background:${meta.bg};color:${meta.color};">${meta.icon} ${meta.label}</span>`;
}

function needsFallbackLink(platform) {
  return ["youtube", "twitch", "kick", "vimeo", "dailymotion"].includes(platform);
}

window.playItem = function(id) {
  const item = __liveItemsCache.find(i => String(i.id) === String(id));
  if (item) {
    renderPrimary(item);
    document.querySelector(".live-container")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

function buildCard({ item, mode }) {
  const safeUrl = String(item.file || "").trim();
  const det = detectPlatform(safeUrl);
  const title = escapeHtml(getText(item.title) || (mode === "ended" ? "إعادة" : "بث"));
  const desc = escapeHtml(getText(item.short) || "");
  const timeLabel = item.date ? escapeHtml(getText(item.date)) : (mode === "upcoming" ? "📅" : mode === "ended" ? "🎬" : "🔴");

  const card = document.createElement("div");
  card.className = "card";

  let actionBtn = "";
  if (mode === "live") {
    actionBtn = `<button class="card-btn" type="button" onclick="playItem('${item.id}')">${t("watch_now")}</button>`;
  } else if (mode === "upcoming") {
    actionBtn = `<button class="card-btn" type="button" onclick="remindStream('${item.id}')"><span>${t("btn_remind")}</span><span>🔔</span></button>`;
  } else {
    actionBtn = safeUrl
      ? `<a class="card-btn" href="${safeUrl}" target="_blank" rel="noopener">${t("watch_replay")}</a>`
      : `<span class="card-btn" style="opacity:.5;pointer-events:none;">${t("watch_replay")}</span>`;
  }

  card.innerHTML = `
    ${platformBadgeHTML(det.platform)}
    <div class="card-time">${timeLabel}</div>
    <h3>${title}</h3>
    <p>${desc}</p>
    <div class="card-actions">
      ${actionBtn}
      ${safeUrl ? `<button class="card-btn secondary" type="button" onclick="copyToClipboard('${safeUrl.replace(/'/g, "\\'")}')" title="${t("copy_link")}">🔗</button>` : ""}
    </div>
  `;
  return card;
}

window.remindStream = function(id) {
  const stream = __liveItemsCache.find(item => String(item.id) === String(id));
  if (stream) {
    showToast(`🔔 ${t("remind_saved")} "${getText(stream.title) || ""}"`, "success");
  }
};

function renderLive() {
  console.log("🎨 Rendering live streams, total items:", __liveItemsCache.length);

  const liveVideo = document.getElementById("liveVideo");
  const upcomingStreams = document.getElementById("upcomingStreams");
  const endedStreams = document.getElementById("endedStreams");
  const multiLiveSection = document.getElementById("multi-live-section");
  const multiLiveGrid = document.getElementById("multiLiveGrid");
  const liveStatusBadge = document.getElementById("liveStatusBadge");
  const liveStatusText = document.getElementById("liveStatusText");
  const liveIndicator = document.getElementById("liveIndicator");
  const liveIndicatorText = document.getElementById("liveIndicatorText");

  if (!liveVideo || !upcomingStreams || !endedStreams) {
    console.error("❌ Missing DOM elements");
    return;
  }

  const items = __liveItemsCache;
  const liveNow = items.filter(i => i.status === "live");
  const upcoming = items.filter(i => i.status === "upcoming");
  const ended = items.filter(i => i.status === "ended");

  console.log("📊 Counts - Live:", liveNow.length, "Upcoming:", upcoming.length, "Ended:", ended.length);

  // Update hero badge
  if (liveStatusBadge && liveStatusText) {
    if (liveNow.length) {
      liveStatusBadge.classList.remove("idle");
      liveStatusText.textContent = t("hero_live_badge");
    } else {
      liveStatusBadge.classList.add("idle");
      liveStatusText.textContent = t("hero_idle_badge");
    }
  }

  // Update floating indicator
  if (liveIndicator) {
    if (liveNow.length) {
      liveIndicator.classList.add("active");
      liveIndicatorText.textContent = t("hero_live_badge");
    } else {
      liveIndicator.classList.remove("active");
    }
  }

  // Primary player
  const stillActive = liveNow.concat(ended).find(i => String(i.id) === String(activeLiveId));
  const primary = stillActive || liveNow[0] || ended[0] || null;
  renderPrimary(primary);

  // Extra live streams
  const extraLive = liveNow.filter(i => !primary || String(i.id) !== String(primary.id));
  multiLiveGrid.innerHTML = "";
  if (extraLive.length) {
    multiLiveSection.style.display = "";
    extraLive.forEach(item => multiLiveGrid.appendChild(buildCard({ item, mode: "live" })));
  } else {
    multiLiveSection.style.display = "none";
  }

  // Upcoming
  upcomingStreams.innerHTML = "";
  if (upcoming.length) {
    upcoming.forEach(item => upcomingStreams.appendChild(buildCard({ item, mode: "upcoming" })));
  } else {
    upcomingStreams.innerHTML = `<div class="empty-state"><h3>${t("no_live")}</h3><p>${t("no_live_sub")}</p></div>`;
  }

  // Ended / replays
  endedStreams.innerHTML = "";
  if (ended.length) {
    ended.forEach(item => endedStreams.appendChild(buildCard({ item, mode: "ended" })));
  } else {
    endedStreams.innerHTML = `<div class="empty-state"><h3>${t("no_ended")}</h3></div>`;
  }
}
window.renderLive = renderLive;

// ============================================================
// NAVIGATION & HEADER (same as before)
// ============================================================
window.goToHome = function() {
  window.location.href = "index.html";
};

window.toggleMenu = function() {
  const menu = document.getElementById("mobileMenu");
  const overlay = document.getElementById("navSheetOverlay");
  const btn = document.getElementById("menu-btn");
  if (!menu || !overlay || !btn) return;
  const isOpen = menu.classList.contains("show");
  menu.classList.toggle("show", !isOpen);
  overlay.classList.toggle("show", !isOpen);
  document.body.style.overflow = isOpen ? "" : "hidden";
  btn.setAttribute("aria-expanded", String(!isOpen));
};

window.doSearch = function(e) {
  e.preventDefault();
  const desktopInput = document.getElementById("navSearchInput");
  const mobileInput = document.getElementById("navSearchInputMobile");
  const q = (mobileInput && mobileInput.value.trim()) || (desktopInput && desktopInput.value.trim()) || "";
  if (!q) return;
  window.location.href = "search.html?q=" + encodeURIComponent(q);
};

window.toggleLangMenu = function() {
  const desktopMenu = document.getElementById("langMenu");
  const toggle = document.querySelector(".lang-toggle");
  if (!desktopMenu || !toggle) return;
  const isOpen = desktopMenu.style.display === "block";
  desktopMenu.style.display = isOpen ? "none" : "block";
  toggle.setAttribute("aria-expanded", String(!isOpen));
};

document.addEventListener("click", function(e) {
  if (!e.target.closest(".lang-wrapper")) {
    const m1 = document.getElementById("langMenu");
    if (m1) m1.style.display = "none";
    document.querySelectorAll(".lang-toggle").forEach(btn => btn.setAttribute("aria-expanded", "false"));
  }
});

function updateHeader() {
  const headerActions = document.getElementById("headerActions");
  const mobileLogin = document.getElementById("mobileLogin");
  const mobileRegister = document.getElementById("mobileRegister");

  if (user && user.loggedIn) {
    const displayName = user.name || user.username || (user.email ? user.email.split("@")[0] : "User");
    if (headerActions) {
      headerActions.innerHTML = `
        <div class="lang-wrapper">
          <button class="lang-toggle" type="button" onclick="toggleLangMenu()">
            <span id="langCurrent">${currentLang.toUpperCase()}</span>
          </button>
          <div class="lang-menu" id="langMenu">
            <button type="button" onclick="setLang('ar')">العربية</button>
            <button type="button" onclick="setLang('en')">English</button>
            <button type="button" onclick="setLang('fr')">Français</button>
          </div>
        </div>
        <span style="margin-right:8px;font-size:12px;color:#374151;font-weight:700;">${escapeHtml(displayName)}</span>
        <button class="btn" onclick="logout()" data-t="logout">${t("logout")}</button>
      `;
    }
    if (mobileLogin) {
      mobileLogin.textContent = t("logout");
      mobileLogin.href = "#";
      mobileLogin.onclick = function(e) {
        e.preventDefault();
        logout();
      };
    }
    if (mobileRegister) mobileRegister.style.display = "none";
  } else {
    if (headerActions) {
      headerActions.innerHTML = `
        <div class="lang-wrapper">
          <button class="lang-toggle" type="button" onclick="toggleLangMenu()">
            <span id="langCurrent">${currentLang.toUpperCase()}</span>
          </button>
          <div class="lang-menu" id="langMenu">
            <button type="button" onclick="setLang('ar')">العربية</button>
            <button type="button" onclick="setLang('en')">English</button>
            <button type="button" onclick="setLang('fr')">Français</button>
          </div>
        </div>
        <button class="btn" onclick="location.href='login.html'" data-t="nav_login">${t("nav_login")}</button>
        <button class="btn primary" onclick="location.href='register.html'" data-t="nav_join">${t("nav_join")}</button>
      `;
    }
    if (mobileLogin) {
      mobileLogin.href = "login.html";
      mobileLogin.onclick = null;
      mobileLogin.textContent = t("nav_login");
    }
    if (mobileRegister) {
      mobileRegister.style.display = "";
      mobileRegister.href = "register.html";
      mobileRegister.textContent = t("nav_join");
    }
  }
}

window.logout = function() {
  localStorage.removeItem("user");
  sessionStorage.removeItem("user");
  user = null;
  location.reload();
};

window.setLang = function(lang) {
  currentLang = lang;
  localStorage.setItem("lang", lang);

  const dict = translations[lang] || translations.ar;
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === "en" || lang === "fr") ? "ltr" : "rtl";

  const titleEl = document.getElementById("t-title");
  if (titleEl && dict.title) titleEl.textContent = dict.title;

  const langCurrent = document.getElementById("langCurrent");
  if (langCurrent) langCurrent.textContent = lang.toUpperCase();

  document.querySelectorAll("[data-t]").forEach(el => {
    const key = el.getAttribute("data-t");
    if (dict[key]) el.textContent = dict[key];
  });

  updateHeader();
  renderLive();
};

// ============================================================
// INITIALIZATION
// ============================================================
window.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Page loaded, initializing...");
  updateHeader();
  setLang(currentLang);
  
  // Start Firestore listener
  startLiveListener();
  
  // Load cached data
  const cached = JSON.parse(localStorage.getItem("live") || "[]");
  console.log("📦 Initial cache:", cached.length, "items");
  __liveItemsCache = cached;
  renderLive();
});

window.addEventListener("beforeunload", () => {
  if (liveUnsubscribe) {
    console.log("🧹 Cleaning up listener");
    liveUnsubscribe();
  }
});