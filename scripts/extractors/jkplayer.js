// JKPlayer Extractor — Kazemi JS
// =========================================================

const EXTRACTOR = {
  id: "jkplayer",
  name: "JKPlayer",
  version: "1.0.0",
  domains: [
    "jkanime.net",
    "www.jkanime.net"
  ]
};

// ── Helpers ──────────────────────────────────────────────

function getOrigin(url) {
  var match = url.match(/^(https?:\/\/[^/]+)/i);
  return match ? match[1] : "https://jkanime.net";
}

function absoluteUrl(url, baseUrl) {
  if (!url) return null;
  if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return url;
  if (url.indexOf("//") === 0) return "https:" + url;

  var origin = getOrigin(baseUrl);
  if (url.charAt(0) === "/") return origin + url;

  var base = baseUrl.substring(0, baseUrl.lastIndexOf("/") + 1);
  return base + url;
}

function decodeBase64MediaUrl(encoded) {
  if (!encoded) return null;
  try {
    var decoded = atob(encoded).trim();
    if (decoded.indexOf(".m3u8") !== -1 || decoded.indexOf(".mp4") !== -1) {
      return decoded;
    }
  } catch (e) {
    console.log("[jkplayer] atob falló: " + e);
  }
  return null;
}

function extractStreamUrl(html) {
  if (!html) return null;

  var loadSourceMatch = html.match(/hls\.loadSource\(\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']\s*\)/i);
  if (loadSourceMatch && loadSourceMatch[1]) {
    return loadSourceMatch[1];
  }

  var directAtobMatch = html.match(/(?:url|file)\s*:\s*atob\(\s*["']([^"']+)["']\s*\)/i);
  if (directAtobMatch && directAtobMatch[1]) {
    var directDecoded = decodeBase64MediaUrl(directAtobMatch[1]);
    if (directDecoded) return directDecoded;
  }

  var atobRe = /atob\(\s*["']([^"']+)["']\s*\)/gi;
  var encodedMatch;
  while ((encodedMatch = atobRe.exec(html)) !== null) {
    var decoded = decodeBase64MediaUrl(encodedMatch[1]);
    if (decoded) return decoded;
  }

  var directPatterns = [
    /source[^>]+src=["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i,
    /file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i,
    /url\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i,
    /["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i
  ];

  for (var i = 0; i < directPatterns.length; i++) {
    var match = html.match(directPatterns[i]);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

function parsePlaylistVariants(masterUrl, embedUrl, headers) {
  var playlist = http.get(masterUrl, headers);
  if (!playlist || playlist.indexOf("#EXTM3U") === -1) {
    return [{
      url: masterUrl,
      quality: "JKPlayer - Auto",
      headers: headers
    }];
  }

  if (playlist.indexOf("#EXT-X-STREAM-INF") === -1) {
    return [{
      url: masterUrl,
      quality: "JKPlayer - Auto",
      headers: headers
    }];
  }

  var results = [];
  var lines = playlist.split("\n");

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.indexOf("#EXT-X-STREAM-INF") !== 0) continue;

    var nextLine = lines[i + 1] ? lines[i + 1].trim() : "";
    if (!nextLine || nextLine.indexOf("#") === 0) continue;

    var resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/i);
    var bandwidthMatch = line.match(/BANDWIDTH=(\d+)/i);
    var quality = resolutionMatch
      ? resolutionMatch[1]
      : (bandwidthMatch ? Math.round(parseInt(bandwidthMatch[1], 10) / 1000) + "k" : "Auto");

    results.push({
      url: absoluteUrl(nextLine, masterUrl),
      quality: "JKPlayer - " + quality,
      headers: headers
    });
  }

  if (results.length === 0) {
    results.push({
      url: masterUrl,
      quality: "JKPlayer - Auto",
      headers: headers
    });
  }

  return results;
}

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  console.log("[jkplayer] Fetching: " + url);

  if (url.indexOf(".m3u8") !== -1 || url.indexOf(".mp4") !== -1) {
    return [{
      url: url,
      quality: "JKPlayer - Auto",
      headers: { "Referer": "https://jkanime.net/" }
    }];
  }

  var headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Referer": url,
    "Origin": getOrigin(url)
  };

  var html = http.get(url, headers);
  if (!html || html.length === 0) {
    console.log("[jkplayer] HTML vacío o nulo");
    return [];
  }

  var streamUrl = extractStreamUrl(html);
  if (!streamUrl) {
    console.log("[jkplayer] No se encontró stream directo");
    console.log("[jkplayer] HTML snippet: " + html.substring(0, 800));
    return [];
  }

  streamUrl = absoluteUrl(streamUrl, url);
  console.log("[jkplayer] Stream encontrado: " + streamUrl);

  return parsePlaylistVariants(streamUrl, url, headers);
}
