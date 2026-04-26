// Sibnet Extractor — Kazemi JS
// =========================================================

const EXTRACTOR = {
  id: "sibnet",
  name: "Sibnet",
  version: "1.0.0",
  aliases: ["sibnet"],
  domains: ["video.sibnet.ru", "sibnet.ru"]
};

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  console.log("[sibnet] Fetching: " + url);

  var html = http.get(url, {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": url
  });

  if (!html || html.length === 0) {
    console.log("[sibnet] HTML vacío");
    return [];
  }

  // player.src([{src: "/v/{hash}/{id}.mp4", type: "video/mp4"}])
  var m = html.match(/player\.src\s*\(\s*\[\s*\{\s*src\s*:\s*"([^"]+)"/);
  if (!m) {
    console.log("[sibnet] No video URL found");
    return [];
  }

  var src = m[1];
  var host = url.match(/^https?:\/\/([^/]+)/);
  var videoUrl = src.indexOf("http") === 0 ? src : "https://" + (host ? host[1] : "video.sibnet.ru") + src;
  console.log("[sibnet] Found: " + videoUrl);

  return [{
    url: videoUrl,
    quality: "HD",
    headers: { "Referer": url }
  }];
}
