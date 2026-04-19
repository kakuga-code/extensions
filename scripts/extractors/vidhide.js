// VidHide Extractor — Kazemi JS
// Covers dingtezuni.com, minochinos.com and other VidHide-based hosts
// =========================================================

const EXTRACTOR = {
  id: "vidhide",
  name: "VidHide",
  version: "1.0.0",
  aliases: ["vidhide", "dingtezuni", "minochinos"],
  domains: [
    "dingtezuni.com",
    "minochinos.com",
    "vidhide.com",
    "vidhide.to",
    "vidhidepro.com",
    "vidhidevip.com",
    "vidhideplus.com"
  ]
};

// ── Helpers ──────────────────────────────────────────────

function jsUnpack(script) {
  var p = script.match(/\}\s*\(\s*'([\s\S]*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([\s\S]*)'\s*\.split/);
  if (!p) return null;
  try {
    var payload = p[1];
    var radix = parseInt(p[2], 10);
    var keys = p[4].split("|");
    function decode(c) {
      var n = parseInt(c, radix);
      return (n < keys.length && keys[n]) ? keys[n] : c;
    }
    return payload.replace(/\b\w+\b/g, decode);
  } catch (e) { return null; }
}

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  console.log("[vidhide] Fetching: " + url);

  var host = url.match(/^https?:\/\/([^/]+)/);
  var referer = host ? "https://" + host[1] + "/" : url;

  var html = http.get(url, {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://anime-sama.to/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  });

  if (!html || html.length === 0) {
    console.log("[vidhide] HTML vacío");
    return [];
  }

  // Find and unpack eval(function(p,a,c,k...)) block
  var scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  var sm;
  var unpacked = null;

  while ((sm = scriptRe.exec(html)) !== null) {
    if (sm[1].indexOf("eval(function") !== -1 && sm[1].indexOf("sources") !== -1) {
      unpacked = jsUnpack(sm[1]);
      if (unpacked) {
        console.log("[vidhide] jsUnpack OK, len=" + unpacked.length);
        break;
      }
    }
  }

  if (!unpacked) {
    console.log("[vidhide] jsUnpack falló. Snippet: " + html.substring(0, 300));
    return [];
  }

  // Find all m3u8 URLs in unpacked script (absolute or root-relative)
  var m3u8Re = /"((?:https?:\/)?\/[^"]*m3u8[^"]*)"/g;
  var masterUrls = [];
  var mm;
  while ((mm = m3u8Re.exec(unpacked)) !== null) {
    var u2 = mm[1];
    if (u2.indexOf("http") !== 0) {
      u2 = referer.replace(/\/$/, "") + (u2.indexOf("/") === 0 ? "" : "/") + u2;
    }
    masterUrls.push(u2);
  }

  if (masterUrls.length === 0) {
    console.log("[vidhide] No m3u8 URLs found");
    return [];
  }

  // Use only the first master URL — multiple URLs point to same content (CDN mirrors)
  masterUrls = [masterUrls[0]];

  var results = [];

  for (var mi = 0; mi < masterUrls.length; mi++) {
    var masterUrl = masterUrls[mi];
    console.log("[vidhide] Master URL: " + masterUrl);

    var playlist = http.get(masterUrl, {
      "Referer": url,
      "Origin": referer.replace(/\/$/, "")
    });

    if (!playlist || playlist.indexOf("#EXTM3U") === -1) {
      results.push({ url: masterUrl, quality: "HD", headers: { "Referer": url } });
      continue;
    }

    var lines = playlist.split("\n");
    var base = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);
    var added = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.indexOf("#EXT-X-STREAM-INF") === 0) {
        var resM = line.match(/RESOLUTION=(\d+x\d+)/);
        var bwM = line.match(/BANDWIDTH=(\d+)/);
        var quality = resM ? resM[1].split("x")[1] + "p" : (bwM ? Math.round(parseInt(bwM[1]) / 1000) + "k" : "HD");
        var next = (lines[i + 1] || "").trim();
        if (!next || next.indexOf("#") === 0) continue;
        var streamUrl = next.indexOf("http") === 0 ? next : base + next;
        results.push({ url: streamUrl, quality: quality, headers: { "Referer": url } });
        added = true;
      }
    }

    if (!added) {
      results.push({ url: masterUrl, quality: "HD", headers: { "Referer": url } });
    }
  }

  console.log("[vidhide] Found " + results.length + " streams");
  return results;
}
