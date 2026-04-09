// StreamWish Extractor — Kazemi JS
// =========================================================

const EXTRACTOR = {
  id: "streamwish",
  name: "StreamWish",
  version: "1.0.0",
  domains: [
    "streamwish.com",
    "streamwish.to",
    "streamwish.site",
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
  var p = script.match(/\}\s*\(\s*'([\s\S]*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([\s\S]*)'\s*\.split/);
  if (!p) return null;
  try {
    var payload = p[1];
    var radix   = parseInt(p[2], 10);
    var count   = parseInt(p[3], 10);
    var keys    = p[4].split("|");
    function decode(c) {
      var n = parseInt(c, radix);
      return (n < keys.length && keys[n]) ? keys[n] : c;
    }
    return payload.replace(/\b\w+\b/g, decode);
  } catch(e) { return null; }
}

// Extrae la URL m3u8 de un bloque de script
function extractM3U8(script) {
  var m = script.match(/https[^"'\s]*\.m3u8[^"'\s]*/);
  return m ? m[0] : null;
}

// Construye la URL embed canónica, forzando un dominio anti-bloqueo
function getEmbedUrl(url) {
  var baseUrl = url.split("?")[0];
  var match = baseUrl.match(/\/[efv]\/([a-zA-Z0-9]+)/);
  if (!match) match = baseUrl.match(/\/([a-zA-Z0-9]+)$/);
  
  var videoId = match ? match[1] : "";
  if (videoId) {
      // sfastwish.com o swdyu.com son mirrors activos que esquivan bloqueos de ISP en España
      return "https://sfastwish.com/e/" + videoId;
  }
  return url;
}

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  var embedUrl = getEmbedUrl(url);
  console.log("[streamwish] Fetching: " + embedUrl);
  var html = http.get(embedUrl, {
    "Referer": "https://streamwish.com/",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
  });

  if (!html || html.length === 0) {
    console.log("[streamwish] HTML vacío o nulo");
    return [];
  }
  console.log("[streamwish] HTML length: " + html.length);

  // Buscar m3u8 directamente en el HTML completo primero
  var directM3u8 = extractM3U8(html);
  if (directM3u8) {
    console.log("[streamwish] M3U8 directo encontrado: " + directM3u8);
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

  var masterUrl = directM3u8 || null;

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

    masterUrl = extractM3U8(script);
    if (masterUrl) {
      console.log("[streamwish] M3U8 encontrado en script[" + i + "]: " + masterUrl);
      break;
    }
  }

  if (!masterUrl) {
    console.log("[streamwish] No M3U8. snippet1: " + html.substring(0, 800));
    console.log("[streamwish] No M3U8. snippet2: " + html.substring(800, 1600));
    return [];
  }

  // Obtener el playlist m3u8 y extraer variantes de calidad
  var playlist = http.get(masterUrl, {
    "Referer": embedUrl,
    "Origin": "https://streamwish.com"
  });

  if (!playlist || playlist.indexOf("#EXTM3U") === -1) {
    // Es directamente el stream, devolver como una sola opción
    return [{
      url: masterUrl,
      quality: "HD",
      headers: { "Referer": embedUrl }
    }];
  }

  // Parsear variantes del m3u8
  var results = [];
  var lines = playlist.split("\n");
  var baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);

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
        headers: { "Referer": embedUrl }
      });
    }
  }

  // Si no hay variantes, usar la URL master directamente
  if (results.length === 0) {
    results.push({
      url: masterUrl,
      quality: "HD",
      headers: { "Referer": embedUrl }
    });
  }

  return results;
}
