import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
 "projectId": "ofouq-academie",
  "clientEmail": "firebase-adminsdk-fbsvc@ofouq-academie.iam.gserviceaccount.com",
  "privateKey": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDCGLIf/25YRN/Z\nxwL6sfukwdL5EUwDAQOgjZaSziE2cMoTdQ5xo+jaG/czHrJ08IY1CAoETvlpuktE\nbk9avlzEEaV7XM0DTF1OKmOKH5byoHFw0C4fhDgs8aGNQJN1tywPttff+DcISaIy\nTqmUpP2s9Bgh0LlQi5J7Ot5+VmZYVVslpAnsZteRGd4mQTyTo1d4fZkseaSFDVMw\ngfexQKfusxO8LQzNwl7rNecEAS21qlv+Cb2xMKXiYpLEEmC0+ntNMQUteKJfaufp\n0BjbGoSKvyqegRnBCQIF+zbLU23YbEd/nflY4wfC/ptyxpA7JPZ/+IgZ2ibjCt+v\na+4HqRd7AgMBAAECggEAIDs/oSamqUvOrHhq2zyhICv7n9aqe7k4Y/n/LiPCyiqS\ntAZ1PpPMgCOyui93zQmAD+Bk4XBH5LHF+/ghf10rRHf1tfWkKc8Nk4RggThbtbDF\nBcncTumC9putiypVEnA3heiEErJCWUL5B0eey4tWgNkMBNmHXIPA8GvHNM2eMz63\nELepom2SpyCpwZaEVkU7H3magCCMKAvIXaqhoMaS/N+oBAahOly5g7XZkysuFsxd\n4V+cS/N2lzoKBYs6FPx9aWbzwfozAMwDzBtzCLqwQAVfUJYW1nLNRZlUYBYi/jcV\nNLOZZj3KSdkYevQU0vb1QTepqu4Gk9EXtzUku+3+yQKBgQDzeXrtllJg0hf3h2oA\nBeYWODb5OQVyIydpzSgb7Bnl63CNVD2/MqX3Xj7s4ux+AKdMScG0lRcJaphDxwYs\n6ysuzW7PfZqkN0riciSLLg8Hi5+4BgpHd52LiSlhpCa6AwcQvHKZ7lbInCm0X6qA\nINIc+9pGxq/4NtBekWVXHZLK1QKBgQDMFOohrH+P1B+i9m8IIEYUGA7gRN2Yq26k\nCC0cZsvS5EPYS/lvgKwb5AO4Q7xgDxgTKw+Ei3ybQIUlMrKWuIHIC0O5In7Ryuc/\nHok05W+ULGnRuSbJVd8zxGLCCulavnVvUQpwMRmzeyb9a5bzr6D20k9xvp/tGDTe\nrzZpuaLhDwKBgCUuL++IPRw7+Rz7uNw4CmLqQrrcUlCTvbkSc0WQUIQj6BQtASDp\ngx67bbCPFr5HK0UjHkmNWu89L/NpuS+y2e1TwdA9xhe9udnKxHnclr74O3PGuFsh\nkRV15LPcdW2CeNm9bWLEWsxXzKaW1VqrqGp0q2iTftvQwxEt8uPSyE/hAoGARGlK\nZwldJYi1Jjq306CF/VxnODS9l9z31NLM1HV9I+/S8mHddsxKZXsU6CMEtaq5pktM\nA2GC3sRNHcAV78Jf9wAXrqrqmkcLJ7SDyBCVS7Vrr5sCboFztfXCKUvhF8M6uJsR\nBbTf6bOByXfUfVHFgpfTe8yr7Z2ss21Gr0BEYm8CgYEAz+0f6IOZ/IyrgPLVuy9y\n/Lud0cffw8eY6n7+BGaBz8PIbY9x58dfdZ2oQUMd9AyjnqIQwOQYDMWSQgQistqG\nX4NaSMnjWxtHBK5Dmmo8psoQAFm1cUEtZQHa+wmq7eToPX19z6lOSEj7p9GgMyZu\nU8jPw2kR13I4xKuqA5FqluE=\n-----END PRIVATE KEY-----\n",
    })
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
const docId = req.query.docId || req.query.id;

    // منع القيم الفارغة
    if (!docId) {
      return res.status(400).send("Missing document ID");
    }

const docRef = db.collection("content").doc(docId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).send("Article not found");
    }

    const article = snap.data();

    console.log("ARTICLE DATA:", article);
    
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