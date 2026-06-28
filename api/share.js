import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    const { id } = req.query;

    // Prevent empty IDs
    if (!id) {
      return res.status(400).send("Missing article ID");
    }

    const docRef = db.collection("articles").doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).send("Article not found");
    }

    const article = snap.data();

    const title = article.title || "Article";
    const description = article.summary || title;
    const image = article.image || "";
    const shareUrl = `https://ofouqacademie.com/api/share?id=${id}`;
    const redirectUrl = `https://ofouqacademie.com/articles-view.html?id=${id}`;

    res.setHeader("Content-Type", "text/html");

    res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
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

<meta http-equiv="refresh" content="0; url=${redirectUrl}">
</head>

<body>
<p>Redirecting...</p>

<script>
window.location.href = "${redirectUrl}";
</script>
</body>
</html>
`);
  } catch (error) {
    console.error(error);
    return res.status(500).send(error.message);
  }
}