// VidSrc Extractor — Kazemi JS
// =========================================================

const EXTRACTOR = {
  id: "vidsrc",
  name: "VidSrc",
  version: "2.0.0",
  domains: [
    "megacloud.blog",
    "vidsrc.me",
    "vidsrc.to",
    "vidsrc.xyz",
    "vidsrc.net",
    "vidsrc.in",
    "vidsrc.pm",
    "vidsrc.am",
    "2embed.to",
    "2embed.cc",
    "2embed.me"
  ]
};

// ── MegaCloud flow (used for megacloud.blog) ─────────────

function extractMegaCloud(url, host) {
  var idM = url.match(/\/e-1\/([a-zA-Z0-9]+)/);
  if (!idM) idM = url.match(/\/v2\/([a-zA-Z0-9]+)/);
  if (!idM) idM = url.match(/\/([a-zA-Z0-9]{10,})(?:\?|$)/);
  if (!idM) return [];
  var id = idM[1];

  // Usar la URL original directamente — no reconstruir
  var embedUrl = url;

  console.log("[vidsrc/megacloud] Fetching embed: " + embedUrl + " id=" + id);
  var html = http.get(embedUrl, {
    "Referer": "https://" + host + "/",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  if (!html) {
    console.log("[vidsrc/megacloud] HTML vacío");
    return [];
  }

  // Extract 48-char nonce
  var nonce = "";
  var nonceM = html.match(/\b([a-zA-Z0-9]{48})\b/);
  if (nonceM) {
    nonce = nonceM[1];
  } else {
    var nonceBlocks = html.match(/"([a-zA-Z0-9]{16})"\s*\+\s*"([a-zA-Z0-9]{16})"\s*\+\s*"([a-zA-Z0-9]{16})"/);
    if (nonceBlocks) nonce = nonceBlocks[1] + nonceBlocks[2] + nonceBlocks[3];
  }

  if (!nonce) {
    console.log("[vidsrc/megacloud] No nonce found. HTML snippet: " + html.substring(0, 2000));
    return [];
  }
  console.log("[vidsrc/megacloud] Nonce: " + nonce.substring(0, 10) + "...");

  var sourcesUrl = "https://" + host + "/embed-2/v3/e-1/getSources?id=" + id + "&_k=" + nonce;
  var sourcesStr = http.get(sourcesUrl, {
    "X-Requested-With": "XMLHttpRequest",
    "Referer": embedUrl,
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  console.log("[vidsrc/megacloud] getSources: " + (sourcesStr ? sourcesStr.substring(0, 200) : "EMPTY"));

  var data;
  try { data = JSON.parse(sourcesStr); } catch(e) {
    console.log("[vidsrc/megacloud] JSON parse error: " + e.message);
    return [];
  }
  if (!data.sources || data.sources.length === 0) {
    console.log("[vidsrc/megacloud] No sources. encrypted=" + data.encrypted);
    return [];
  }

  var results = [];
  data.sources.forEach(function(source) {
    var fileUrl = source.file;
    if (fileUrl && fileUrl.indexOf(".m3u8") !== -1) {
      results.push({
        url: fileUrl,
        quality: "Multi-Quality (m3u8)",
        headers: {
          "Referer": "https://" + host + "/",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
    }
  });

  return results;
}

// ── RC4 helpers (for vidsrc.me/to/xyz) ───────────────────

const ENCRYPTION_KEY1 = "8Qy3mlM2kod80XIK";
const ENCRYPTION_KEY2 = "BgKVSrzpH2Enosgm";
const DECRYPTION_KEY = "9jXDYBZUcTcTZveM";

function rc4(key, str) {
  var s = [], j = 0, x, res = '';
  for (var i = 0; i < 256; i++) s[i] = i;
  for (i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    x = s[i]; s[i] = s[j]; s[j] = x;
  }
  i = 0; j = 0;
  for (var y = 0; y < str.length; y++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    x = s[i]; s[i] = s[j]; s[j] = x;
    res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
  }
  return res;
}

function encodeID(videoID, key) {
  var cipher = rc4(key, videoID);
  return btoa(cipher)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
    .trim();
}

function extractVidSrc(url, host) {
  var pathParts = url.split("?")[0].split("/");
  var videoId = pathParts[pathParts.length - 1];
  if (!videoId) videoId = pathParts[pathParts.length - 2];
  if (!videoId) return [];

  var query = url.indexOf("?") !== -1 ? url.substring(url.indexOf("?")) : "";
  var apiSlug = encodeID(videoId, ENCRYPTION_KEY1);
  var h = encodeID(videoId, ENCRYPTION_KEY2);
  var apiUrl = "https://" + host + "/mediainfo/" + apiSlug + query;
  apiUrl += query ? "&h=" + h : "?h=" + h;

  console.log("[vidsrc] Fetching mediainfo: " + apiUrl);
  var responseStr = http.get(apiUrl, {
    "Referer": url,
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest"
  });

  if (!responseStr) return [];

  var data;
  try { data = JSON.parse(responseStr); } catch(e) { return []; }
  if (!data.result || data.status !== 200) return [];

  var decodedResult = atob(data.result);
  var decryptedStr = rc4(DECRYPTION_KEY, decodedResult);
  var finalJsonStr = decodeURIComponent(decryptedStr);

  var result;
  try { result = JSON.parse(finalJsonStr); } catch(e) { return []; }
  if (!result.sources || result.sources.length === 0) return [];

  var videos = [];
  result.sources.forEach(function(src, index) {
    if (src.file) {
      videos.push({
        url: src.file,
        quality: "Multi-Quality (m3u8)" + (index > 0 ? " " + index : ""),
        headers: {
          "Referer": "https://" + host + "/",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
    }
  });
  return videos;
}

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  var host = "";
  try { host = url.split("/")[2]; } catch(e) { return []; }

  // megacloud.blog uses nonce+getSources flow
  if (host === "megacloud.blog" || host.indexOf("megacloud") !== -1) {
    return extractMegaCloud(url, host);
  }

  // Legacy vidsrc.me/to/xyz flow
  return extractVidSrc(url, host);
}
