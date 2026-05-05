// StreamWish Extractor — Kazemi JS
// =========================================================

const EXTRACTOR = {
  id: "streamwish",
  name: "StreamWish",
  version: "1.0.1",
  aliases: ["sw", "swish", "streamwish", "wishembed", "sfastwish", "strwish"],
  domains: [
    "streamwish.com",
    "streamwish.to",
    "streamwish.site",
    "embedwish.com",
    "wishembed.pro",
    "awish.pro",
    "dwish.pro",
    "strmwish.com",
    "fwish.pro",
    "fviplions.com",
    "sfastwish.com",
    "egywish.com",
    "arabwish.com",
    "mwish.pro",
    "strwish.com",
    "swdyu.com",
    "swhhd.com",
    "vidhidevip.com"
  ]
};

// ── Helpers ──────────────────────────────────────────────

// JsUnpacker: desempaqueta scripts eval(function(p,a,c,k,e,d){...})
function jsUnpack(script) {
  var p = script.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\((['"])([\s\S]*?)\1,\s*(\d+),\s*(\d+),\s*(['"])([\s\S]*?)\5\.split\(\s*['"]\|['"]\s*\)/i);
  if (!p) return null;
  try {
    var payload = p[2];
    var radix   = parseInt(p[3], 10);
    var count   = parseInt(p[4], 10);
    var keys    = p[6].split("|");
    if (!payload || !radix || !count || !keys.length) return null;

    function toBase(n, base) {
      var digits = "0123456789abcdefghijklmnopqrstuvwxyz";
      if (n === 0) return "0";
      var out = "";
      while (n > 0) {
        out = digits[n % base] + out;
        n = Math.floor(n / base);
      }
      return out;
    }

    var decoded = payload;
    for (var i = count - 1; i >= 0; i--) {
      var key = toBase(i, radix);
      var value = (i < keys.length && keys[i]) ? keys[i] : key;
      var re = new RegExp("\\b" + key + "\\b", "g");
      decoded = decoded.replace(re, value);
    }
    return decoded;
  } catch(e) { return null; }
}

// Extrae URLs m3u8 de un bloque de script
function extractM3U8List(script) {
  var out = [];
  var seen = {};
  function addMatches(re) {
    var m;
    while ((m = re.exec(script)) !== null) {
      var url = (m[1] || "").trim();
      if (!url) continue;
      if (url.startsWith("//")) url = "https:" + url;
      if (!/^https?:\/\//i.test(url)) continue;
      if (!seen[url]) {
        seen[url] = true;
        out.push(url);
      }
    }
  }

  // URL HLS explícita.
  addMatches(/((?:https?:)?\/\/[^"'\s]+\.m3u8[^"'\s]*)/gi);
  // Fallback: algunos mirrors exponen rutas HLS sin extensión clara al parsear.
  addMatches(/((?:https?:)?\/\/[^"'\s]+\/hls[^"'\s]*)/gi);

  // Priorizar hosts más estables frente a premilkyway cuando haya alternativas.
  out.sort(function(a, b) {
    function score(url) {
      var hostM = url.match(/^https?:\/\/([^\/?#]+)/i);
      var host = hostM ? hostM[1].toLowerCase() : "";
      if (host.indexOf("premilkyway") !== -1) return 10;
      if (host.indexOf("cloudwindow") !== -1) return 1;
      return 5;
    }
    return score(a) - score(b);
  });

  return out;
}

// Construye la URL embed canónica, forzando un dominio anti-bloqueo
function getEmbedUrl(url) {
  var baseUrl = url.split("?")[0];
  var hostM = baseUrl.match(/^https?:\/\/([^\/?#]+)/i);
  var host = hostM ? hostM[1].toLowerCase() : "";

  // Si ya viene de StreamWish/Wish, conservar el host original.
  if (host.indexOf("wish") !== -1 || host.indexOf("stream") !== -1) {
    return baseUrl;
  }

  var match = baseUrl.match(/\/[efv]\/([a-zA-Z0-9]+)/);
  if (!match) match = baseUrl.match(/\/([a-zA-Z0-9]+)$/);
  
  var videoId = match ? match[1] : "";
  if (videoId) {
      // sfastwish.com o swdyu.com son mirrors activos que esquivan bloqueos de ISP en España
      return "https://sfastwish.com/e/" + videoId;
  }
  return url;
}

function extractVideoId(url) {
  var baseUrl = (url || "").split("?")[0];
  var m = baseUrl.match(/\/[efv]\/([a-zA-Z0-9]+)/i);
  if (!m) m = baseUrl.match(/\/([a-zA-Z0-9]+)$/);
  return m ? m[1] : "";
}

function buildEmbedCandidates(url) {
  var candidates = [];
  function push(u) {
    if (!u) return;
    if (candidates.indexOf(u) === -1) candidates.push(u);
  }

  var base = getEmbedUrl(url);
  push(base);

  var videoId = extractVideoId(base);
  if (!videoId) return candidates;

  // Mirrors frecuentes de StreamWish cuando un host queda en "Loading..."
  // o un CDN regional falla.
  push("https://embedwish.com/e/" + videoId);
  push("https://sfastwish.com/e/" + videoId);
  push("https://strwish.com/e/" + videoId);
  push("https://streamwish.com/e/" + videoId);
  push("https://streamwish.to/e/" + videoId);
  return candidates;
}

function isLoadingIntermediaryPage(html) {
  if (!html) return false;
  var lower = html.toLowerCase();
  return lower.indexOf("page is loading, please wait") !== -1 ||
         (lower.indexOf("loading...") !== -1 && lower.indexOf("main.js") !== -1);
}

function buildMasterUrlCandidates(masterUrl, embedUrl) {
  var candidates = [];
  function push(url) {
    if (!url) return;
    if (candidates.indexOf(url) === -1) candidates.push(url);
  }

  push(masterUrl);

  var embedOriginM = embedUrl.match(/^(https?:\/\/[^\/?#]+)/i);
  var embedOrigin = embedOriginM ? embedOriginM[1] : "";
  if (!embedOrigin) return candidates;

  // Fallback cuando el CDN absoluto está bloqueado/caído.
  var pathM = masterUrl.match(/^https?:\/\/[^\/?#]+(\/[^?#]+(?:\?[^#]*)?)/i);
  if (pathM) {
    push(embedOrigin + pathM[1]);
  } else if (masterUrl.startsWith("/")) {
    push(embedOrigin + masterUrl);
  }

  return candidates;
}

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  var embedCandidates = buildEmbedCandidates(url);
  var embedUrl = embedCandidates[0] || getEmbedUrl(url);
  var embedOrigin = "https://streamwish.com";
  var html = "";
  var picked = false;

  for (var ec = 0; ec < embedCandidates.length; ec++) {
    var candidateEmbed = embedCandidates[ec];
    var originM = candidateEmbed.match(/^(https?:\/\/[^\/?#]+)/i);
    var candidateOrigin = originM ? originM[1] : "https://streamwish.com";
    console.log("[streamwish] Fetching: " + candidateEmbed);
    var tryHtml = http.get(candidateEmbed, {
      "Referer": candidateEmbed,
      "Origin": candidateOrigin,
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
    });
    if (!tryHtml || tryHtml.length === 0) continue;
    if (isLoadingIntermediaryPage(tryHtml)) {
      console.log("[streamwish] Loading page detectada en " + candidateEmbed + ", probando mirror alterno");
      continue;
    }
    embedUrl = candidateEmbed;
    embedOrigin = candidateOrigin;
    html = tryHtml;
    picked = true;
    break;
  }

  if (!picked || !html || html.length === 0) {
    console.log("[streamwish] HTML vacío o nulo");
    return [];
  }
  console.log("[streamwish] HTML length: " + html.length);

  // Buscar m3u8 directamente en el HTML completo primero
  var masterUrls = extractM3U8List(html);
  if (masterUrls.length > 0) {
    console.log("[streamwish] M3U8 directos encontrados: " + masterUrls.length);
  }

  // Buscar el bloque <script> que contiene m3u8 o eval packed
  var scriptBlocks = [];
  var scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  var sm;
  while ((sm = scriptRe.exec(html)) !== null) {
    if (sm[1].indexOf("m3u8") !== -1 || sm[1].indexOf("eval(function") !== -1) {
      scriptBlocks.push(sm[1]);
    }
  }
  console.log("[streamwish] Script blocks con m3u8/eval: " + scriptBlocks.length);

  for (var i = 0; i < scriptBlocks.length; i++) {
    var script = scriptBlocks[i];

    // Desempaquetar si está obfuscado con eval(function(p,a,c,k...
    if (script.indexOf("eval(function") !== -1) {
      var unpacked = jsUnpack(script);
      if (unpacked) {
        console.log("[streamwish] jsUnpack OK, len=" + unpacked.length);
        script = unpacked;
      } else {
        console.log("[streamwish] jsUnpack falló");
      }
    }

    var found = extractM3U8List(script);
    for (var f = 0; f < found.length; f++) {
      if (masterUrls.indexOf(found[f]) === -1) {
        masterUrls.push(found[f]);
      }
    }
  }

  if (masterUrls.length === 0) {
    console.log("[streamwish] No M3U8. snippet1: " + html.substring(0, 800));
    console.log("[streamwish] No M3U8. snippet2: " + html.substring(800, 1600));
    return [];
  }
  console.log("[streamwish] M3U8 candidatos totales: " + masterUrls.length);

  // Obtener el playlist m3u8 y extraer variantes de calidad.
  // Probamos URL original y fallback en el dominio embed.
  var playlist = "";
  var selectedMasterUrl = masterUrls[0];
  var masterCandidates = [];
  for (var mi = 0; mi < masterUrls.length; mi++) {
    var expanded = buildMasterUrlCandidates(masterUrls[mi], embedUrl);
    for (var ei = 0; ei < expanded.length; ei++) {
      if (masterCandidates.indexOf(expanded[ei]) === -1) {
        masterCandidates.push(expanded[ei]);
      }
    }
  }
  for (var c = 0; c < masterCandidates.length; c++) {
    var candidate = masterCandidates[c];
    var tryPlaylist = http.get(candidate, {
      "Referer": embedUrl,
      "Origin": embedOrigin,
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
    });
    if (tryPlaylist && tryPlaylist.length > 0) {
      playlist = tryPlaylist;
      selectedMasterUrl = candidate;
      if (playlist.indexOf("#EXTM3U") !== -1) break;
    }
  }

  if (!playlist || playlist.indexOf("#EXTM3U") === -1) {
    // Si no hay manifest válido, NO devolver URLs candidatas no verificadas
    // (provocan errores -1004/-12860 en AVPlayer).
    console.log("[streamwish] Manifest inválido/inaccesible; se omite este mirror.");
    return [];
  }

  // Parsear variantes del m3u8
  var results = [];
  var lines = playlist.split("\n");
  var baseUrl = selectedMasterUrl.substring(0, selectedMasterUrl.lastIndexOf("/") + 1);

  for (var j = 0; j < lines.length; j++) {
    var line = lines[j].trim();
    if (line.indexOf("#EXT-X-STREAM-INF") === 0) {
      var resM = line.match(/RESOLUTION=(\d+x\d+)/);
      var bwM  = line.match(/BANDWIDTH=(\d+)/);
      var quality = resM ? resM[1] : (bwM ? Math.round(parseInt(bwM[1]) / 1000) + "k" : "HD");
      var nextLine = lines[j + 1] ? lines[j + 1].trim() : "";
      if (!nextLine || nextLine.indexOf("#") === 0) continue;
      var streamUrl = nextLine.startsWith("http") ? nextLine : baseUrl + nextLine;
      results.push({
        url: streamUrl,
        quality: quality,
        headers: { "Referer": embedUrl, "Origin": embedOrigin }
      });
    }
  }

  // Si no hay variantes, usar la URL master directamente
  if (results.length === 0) {
    results.push({
      url: selectedMasterUrl,
      quality: "HD",
      headers: { "Referer": embedUrl, "Origin": embedOrigin }
    });
  }

  return results;
}
