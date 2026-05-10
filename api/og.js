const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

const CRAWLERS =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|LinkedInBot|TelegramBot|Slackbot|Googlebot/i;

async function getDoc(docId) {
  for (const col of ["articles", "content"]) {
    try {
      const snap = await db.collection(col).doc(docId).get();
      if (snap.exists) return snap.data();
    } catch (e) {
      // try next collection
    }
  }
  return null;
}

function getLang(field) {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field.ar || field.en || field.fr || "";
}

function escAttr(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = async (req, res) => {
  const ua = req.headers["user-agent"] || "";
  const docId = req.query.docId;
  const section = req.query.section || "articles";

  const pageMap = {
    research: "research-view.html",
    articles: "articles-view.html",
    editions: "editions-view.html",
    activities: "activities-view.html",
    training: "training-view.html",
  };

  const viewPage = pageMap[section] || "articles-view.html";
  const canonicalUrl = `https://ofouqacademie.com/${viewPage}?docId=${docId}`;

  // Not a crawler — redirect to actual page
  if (!CRAWLERS.test(ua)) {
    res.redirect(302, canonicalUrl);
    return;
  }

  if (!docId) {
    res.status(404).send("Not found");
    return;
  }

  const data = await getDoc(docId);

  if (!data) {
    res.status(404).send("Not found");
    return;
  }

  const title = escAttr(getLang(data.title) || "أفق أكاديمي");
  const desc = escAttr(getLang(data.short) || getLang(data.description) || "");
  const image = escAttr(data.image || "https://ofouqacademie.com/logo1.png");
  const url = escAttr(canonicalUrl);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <meta property="og:title" content="${title}"/>
  <meta property="og:description" content="${desc}"/>
  <meta property="og:image" content="${image}"/>
  <meta property="og:url" content="${url}"/>
  <meta property="og:type" content="article"/>
  <meta property="og:site_name" content="أفق أكاديمي"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${title}"/>
  <meta name="twitter:description" content="${desc}"/>
  <meta name="twitter:image" content="${image}"/>
  <meta http-equiv="refresh" content="0;url=${url}"/>
</head>
<body></body>
</html>`);
};