import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "ofouq-academie",
      clientEmail: "firebase-adminsdk-fbsvc@ofouq-academie.iam.gserviceaccount.com",
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    const id = req.query.id;

    if (!id) {
      return res.status(400).send("Missing edition id");
    }

    const snap = await db.collection("content").doc(id).get();

    if (!snap.exists) {
      return res.status(404).send("Edition not found");
    }

    const edition = snap.data();

    const title =
      edition.title?.ar ||
      edition.title?.en ||
      edition.title?.fr ||
      "Edition";

    const description =
      edition.short?.ar ||
      edition.short?.en ||
      edition.short?.fr ||
      title;

    const image = edition.image || "";

    const shareUrl =
      `https://ofouqacademie.com/api/share-edition?id=${id}`;

    const redirectUrl =
      `https://ofouqacademie.com/editions-view.html?id=${id}`;

    const ua = req.headers["user-agent"] || "";

    const isBot =
      ua.includes("facebookexternalhit") ||
      ua.includes("Facebot") ||
      ua.includes("WhatsApp") ||
      ua.includes("Twitterbot");

    if (!isBot) {
      return res.redirect(302, redirectUrl);
    }

    res.setHeader("Content-Type", "text/html");

    res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
<title>${title}</title>

<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:type" content="article">
<meta property="og:url" content="${shareUrl}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
</head>
<body>
Loading...
</body>
</html>
`);
  } catch (e) {
    return res.status(500).send(e.message);
  }
}