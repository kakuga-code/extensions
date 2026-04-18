// Sendvid Extractor — Kazemi JS
// =========================================================

const EXTRACTOR = {
  id: "sendvid",
  name: "Sendvid",
  version: "1.0.1",
  aliases: ["sendvid"],
  domains: ["sendvid.com"]
};

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  console.log("[sendvid] Fetching: " + url);

  var html = http.get(url, {
    "Referer": "https://sendvid.com/",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  if (!html || html.length === 0) {
    console.log("[sendvid] HTML vacío");
    return [];
  }

  // <source id="video_source" src="..."> — atributos en cualquier orden
  var sourceM = html.match(/<source[^>]+id="video_source"[^>]*>/i);
  var masterUrl = null;

  if (sourceM) {
    var srcM = sourceM[0].match(/src="([^"]+)"/i);
    if (srcM) masterUrl = srcM[1];
  }

  // Fallback: var video_source = "..."
  if (!masterUrl) {
    var varM = html.match(/var\s+video_source\s*=\s*"([^"]+)"/);
    if (varM) masterUrl = varM[1];
  }

  if (!masterUrl) {
    console.log("[sendvid] No video URL found");
    return [];
  }

  console.log("[sendvid] Found: " + masterUrl);

  if (masterUrl.indexOf(".m3u8") !== -1) {
    var playlist = http.get(masterUrl, {
      "Referer": url,
      "Origin": "https://sendvid.com"
    });

    if (!playlist || playlist.indexOf("#EXTM3U") === -1) {
      return [{ url: masterUrl, quality: "HD", headers: { "Referer": url } }];
    }

    var results = [];
    var lines = playlist.split("\n");
    var base = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.indexOf("#EXT-X-STREAM-INF") === 0) {
        var resM = line.match(/RESOLUTION=(\d+x\d+)/);
        var quality = resM ? resM[1] : "HD";
        var next = (lines[i + 1] || "").trim();
        if (!next || next.indexOf("#") === 0) continue;
        var streamUrl = next.indexOf("http") === 0 ? next : base + next;
        results.push({ url: streamUrl, quality: quality, headers: { "Referer": url } });
      }
    }
    return results.length > 0 ? results : [{ url: masterUrl, quality: "HD", headers: { "Referer": url } }];
  }

  return [{ url: masterUrl, quality: "SD", headers: { "Referer": url } }];
}
