// Filemoon Extractor — Kazemi JS
// =========================================================

const EXTRACTOR = {
  id: "filemoon",
  name: "Filemoon",
  version: "1.0.0",
  domains: [
    "filemoon.sx",
    "filemoon.to",
    "filemoon.in",
    "filemoon.nl",
    "filemoon.com",
    "filemoon.lat",
    "filemoon.art",
    "bysejikuar.com",
    "kerapoxy.cc",
    "filemoon.wf",
    "filemoon.am"
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

// Extrae el bloque de script que contiene 'eval' y 'm3u8'
function findTargetScript(html) {
  var scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  var match;
  while ((match = scriptRe.exec(html)) !== null) {
    var content = match[1];
    if (content.indexOf("eval") !== -1 && content.indexOf("m3u8") !== -1) {
      return content;
    }
  }
  return null;
}

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  console.log("[filemoon] Fetching: " + url);
  
  var host = "";
  try { host = url.split("/")[2]; } catch(e) { host = "filemoon.sx"; }

  var baseHeaders = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Referer": url,
    "Origin": "https://" + host
  };

  var html = http.get(url, baseHeaders);
  if (!html || html.length === 0) {
    console.log("[filemoon] HTML vacío");
    return [];
  }

  // 1. Buscar el script objetivo en la página principal
  var targetScript = findTargetScript(html);

  // 2. Si no está, verificar si hay un iframe y buscar ahí adentro
  if (!targetScript) {
    console.log("[filemoon] No encontrado directamente. HTML snippet: " + html.substring(0, 500));
    var iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (iframeMatch) {
      var iframeUrl = iframeMatch[1];
      if (iframeUrl.indexOf("http") !== 0) {
        iframeUrl = "https://" + host + iframeUrl;
      }
      console.log("[filemoon] Fetching iframe: " + iframeUrl);
      baseHeaders["Referer"] = url;
      baseHeaders["Origin"] = "https://" + host;
      var iframeHtml = http.get(iframeUrl, baseHeaders);
      if (iframeHtml) {
        console.log("[filemoon] iframe HTML snippet: " + iframeHtml.substring(0, 500));
        targetScript = findTargetScript(iframeHtml);
        // Si tampoco tiene script, buscar m3u8 directamente en el HTML del iframe
        if (!targetScript) {
          var directInIframe = iframeHtml.match(/(https?:[^"'\s]+\.m3u8[^"'\s]*)/);
          if (directInIframe) {
            console.log("[filemoon] m3u8 directo en iframe: " + directInIframe[1]);
            return [{ url: directInIframe[1], quality: "Filemoon - Auto", headers: baseHeaders }];
          }
        }
      }
    } else {
      // Sin iframe — buscar m3u8 directamente en el HTML principal
      var directM3u8 = html.match(/(https?:[^"'\s]+\.m3u8[^"'\s]*)/);
      if (directM3u8) {
        console.log("[filemoon] m3u8 directo en HTML: " + directM3u8[1]);
        return [{ url: directM3u8[1], quality: "Filemoon - Auto", headers: baseHeaders }];
      }
    }
  }

  if (!targetScript) {
    console.log("[filemoon] No se encontró script m3u8 ni URL directa");
    return [];
  }

  // 3. Desempaquetar el script JS
  var unpacked = jsUnpack(targetScript);
  if (!unpacked) {
    console.log("[filemoon] Falló el JsUnpack");
    return [];
  }

  // 4. Extraer la URL del m3u8 (master) del código desempaquetado
  // Busca el patrón: file:"https://...m3u8..."
  var masterUrlMatch = unpacked.match(/file\s*:\s*["'](https?[^"']+\.m3u8[^"']*)["']/i);
  if (!masterUrlMatch) {
    console.log("[filemoon] No se pudo extraer la URL master del string desempaquetado");
    return [];
  }

  var masterUrl = masterUrlMatch[1];
  console.log("[filemoon] Master URL encontrada: " + masterUrl);

  // 5. Extraer Subtítulos (sub.info en query params o mediante fetch en el js)
  var subtitles = [];
  var subUrl = null;
  
  var querySubMatch = url.match(/[?&]sub\.info=([^&]+)/);
  if (querySubMatch) {
    subUrl = decodeURIComponent(querySubMatch[1]);
  } else {
    var fetchMatch = unpacked.match(/fetch\(['"]([^'"]+)['"]\)/);
    if (fetchMatch) subUrl = fetchMatch[1];
  }

  if (subUrl) {
    console.log("[filemoon] URL de subtítulos encontrada: " + subUrl);
    try {
      var subDataStr = http.get(subUrl, baseHeaders);
      if (subDataStr) {
        var subData = JSON.parse(subDataStr);
        if (Array.isArray(subData)) {
          for (var k = 0; k < subData.length; k++) {
            if (subData[k].file && subData[k].label) {
              subtitles.push({
                url: subData[k].file,
                label: subData[k].label,
                language: subData[k].label.toLowerCase().substring(0, 3)
              });
            }
          }
        }
      }
    } catch (e) {
      console.log("[filemoon] Error parseando subtítulos: " + e.message);
    }
  }

  // 6. Extraer y parsear calidades del HLS (equivalente al PlaylistUtils de Kotlin)
  var playlistInfo = http.get(masterUrl, baseHeaders);
  var results = [];

  if (playlistInfo && playlistInfo.indexOf("#EXTM3U") !== -1 && playlistInfo.indexOf("#EXT-X-STREAM-INF") !== -1) {
    var lines = playlistInfo.split("\n");
    var baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);

    for (var j = 0; j < lines.length; j++) {
      var line = lines[j].trim();
      if (line.indexOf("#EXT-X-STREAM-INF") === 0) {
        var resM = line.match(/RESOLUTION=(\d+x\d+)/);
        var quality = resM ? resM[1] : "HD";
        var nextLine = lines[j + 1] ? lines[j + 1].trim() : "";
        
        if (nextLine && nextLine.indexOf("#") !== 0) {
          var streamUrl = nextLine.indexOf("http") === 0 ? nextLine : baseUrl + nextLine;
          results.push({
            url: streamUrl,
            quality: "Filemoon - " + quality,
            headers: baseHeaders,
            subtitles: subtitles.length > 0 ? subtitles : undefined
          });
        }
      }
    }
  }

  // Si falló el parseo de variantes, devolvemos el master m3u8 directamente
  if (results.length === 0) {
    results.push({
      url: masterUrl,
      quality: "Filemoon - Auto",
      headers: baseHeaders,
      subtitles: subtitles.length > 0 ? subtitles : undefined
    });
  }

  return results;
}