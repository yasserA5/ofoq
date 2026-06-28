console.log("APP TYPE:", typeof app);
console.log("ROUTES BEING LOADED...");
console.log("REGISTERING ROUTES...");
console.log("🔥 RUNNING FILE:", __filename);
const express = require("express");
const app = express();
const PORT = 3000;

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.get("/api/share", async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).send("Missing article ID");
  }

  // مثال بيانات (بدل Firebase لاحقاً إذا أردت)
  const title = `Article ${id}`;
  const description = "This is a shared article preview";
  const image = "https://yourdomain.com/default.jpg";

  const shareUrl = `http://localhost:3000/api/share?id=${id}`;
  const redirectUrl = `http://localhost:3000/articles-view.html?id=${id}`;

  res.setHeader("Content-Type", "text/html");

  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<title>${title}</title>

<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:type" content="article">
<meta property="og:url" content="${shareUrl}">

<meta http-equiv="refresh" content="0; url=${redirectUrl}">
</head>

<body>
Redirecting...
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`Video server running at http://localhost:${PORT}`);
  console.log("🔥 SERVER FILE LOADED");
});