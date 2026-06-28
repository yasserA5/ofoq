import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
 "project_id": "ofouq-academie",
  "client_email": "firebase-adminsdk-fbsvc@ofouq-academie.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDJk/qH386v6N9g\noRMSMmuqIh+WhokZDXOVn0aNE3J8jqNDkghUU4Op+Oe3KVGNum2Ss25WifO0V6cZ\nLKP99PvJzeU1Z8aRTY1jHg2CJXDKsljSndH0YfWWkfT8JMNpUJSGhVq60XxLCnkG\nz2SvJ8rgBudN03kYr1MqvKoLQnq6C+HLFBred8Sh1keMdDmX1Z6qd1US7rlUwWEo\ni2P2dru34NA+b1knhDOH8scOEPt1LBTKVYoxFZ5s7ZvWW39+rybWKigvQaJaViKa\nTjPWZyf3ZjOvkYxSMH6oZE/IPzAHGXU0MlRPPtj2Je0q1V+WTEEHH+/6jPDYPVLb\ntq51r/s3AgMBAAECggEAH0iq+gle72gJutpktk9C7E2Nb3QDtPKkfJUSgvSAsRoF\n9oekaUnoxilN9Nwhvwgu1zSnrCCOxO9RjJOkA9bQeNpOd0Jay9QoXDieyhL7dUnG\nhTFfEzlcvvh59+PQu/h4hIQPt6ypSJAghlELhC99ydTocuieA5m6I4jSLxsrJtJI\nvmXnlO4Myi8Mf73akhvSkBL45mrUjlRrybxNCASe15s8wewAGdCxonQJPT8loWw+\nJDtM8z35lDPxWPdThojfWIvkG2RC2i0FlEvUAdGBmkmf0jD9K78iaDfd9XrmYezQ\n0OZHvNogn8MTtQgpK8N92InsZ7WyH4B6VFbIYVOryQKBgQDkwW0PCkkVyUEmuZ7Q\nIwH4iwBDoECvUqXLlk/ZHWoZfVPeRX/gNJ+R4LWp9o4UP4otxdZfAHqGb7l/C62s\nXI1hlH3L3obehKg3qQysQ0k7A9lMBFnWm99FvqnSv/afZBqUA0SC8mTvOgmTS0DY\nS7jLvVvmdauQPxyz1eJ8TIcijQKBgQDhle56YL0ZgkeweMSXPaUkzdoPk1tVHDv/\n7xsuHXGkkFOZhb2CnlqDuREs3bZT5xTQBpmRKdZMD30dmXSaE8zm0n5CNRWFOhWF\noHOIsOefyVxGSTZEGm8rluNvVNPoSBpr9VMvV7hTJdsTEYuQILPJJwmbfJ9JQs5F\nP1aupZjF0wKBgQCLzsPOq2SbkhLljhDH+H1d3+ZbbnfaL1LxKH7InTeZOIWnlSZg\nawkTaRjeNbgEHAlhjEZGbc50l5fxU7vjWfV2rABuNySKnt0Il6MNLVp2XRXTZd1a\nUo2U3MCB85zRMackyxJ2TZrusrPjd9y71RuuOZ8PLN+cG1Z5esEfYs48iQKBgFrz\nbzYKANPjEfJVjrWHliizkkKLX9x9yLcUeTnrhyEZS4tvP4wFOms3V3RmY5eKaHrC\n3nGHk64Q5Jnlf/yLFSbPITaiXm3bkEfS/CHVaV2j+r8fz3A/1CiX6lS9t75EK9rx\nCzvgOyHS9nPGtCVE+heU1KvK4BHSjIWg1tsNSv4fAoGAMLEG2meI2AFv2xUFsXLd\nkDZQmhI0l0ZspX+1Z0+plvrGDaD9yI0wqmTlqPvXwfM7oYAmFo7iBNUxYTHfKhG2\nBoHEAgW6qwnlnnXTRT0wM0w60hHYlwz5QOJ0zIUqL0yIkle/s4NmXGOKly+PTQxA\nFWn8vGJtM651bD7w/M2f1uQ=\n-----END PRIVATE KEY-----\n",
    })
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    const { docId } = req.query;

    // منع القيم الفارغة
    if (!docId) {
      return res.status(400).send("Missing document ID");
    }

    const docRef = db.collection("articles").doc(docId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).send("Article not found");
    }

    const article = snap.data();

    const title = article.title || "Article";
    const description = article.summary || title;
    const image = article.image || "";

    const shareUrl = `https://ofouqacademie.com/api/share?docId=${docId}`;
    const redirectUrl = `https://ofouqacademie.com/articles-view.html?docId=${docId}`;

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