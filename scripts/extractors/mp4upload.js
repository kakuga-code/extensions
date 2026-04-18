// Mp4upload Extractor — Kazemi JS
// =========================================================

const EXTRACTOR = {
  id: "mp4upload",
  aliases: ["mp4", "mp4u", "mp4upload"],
  name: "Mp4Upload",
  version: "1.0.0",
  domains: [
    "mp4upload.com",
    "www.mp4upload.com",
    "mp4upload.to",
    "mp4upload.net"
  ]
};

// ── Helpers ──────────────────────────────────────────────

// JsUnpacker: desempaqueta scripts eval(function(p,a,c,k,e,d){...})
// Reutilizado de streamwish.js
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

// Extrae la URL del video del script (formato: .src("...") o src:"...")
function extractVideoUrl(script) {
  // Buscar patrones comunes
  // 1. .src("http://...")
  var m1 = script.match(/\.src\s*\(\s*["']([^"']+)["']\s*\)/);
  if (m1) return m1[1];
  
  // 2. src:"http://..."
  var m2 = script.match(/src\s*:\s*["']([^"']+)["']/);
  if (m2) return m2[1];
  
  // 3. player.src="http://..."
  var m3 = script.match(/player\.src\s*=\s*["']([^"']+)["']/);
  if (m3) return m3[1];
  
  return null;
}

// Extrae la resolución (HEIGHT=xxx) o width x height
function extractResolution(script) {
  // HEIGHT=480
  var heightMatch = script.match(/\WHEIGHT\s*=\s*(\d+)/);
  if (heightMatch) return heightMatch[1] + "p";
  
  // WIDTH=... HEIGHT=...
  var whMatch = script.match(/WIDTH\s*=\s*(\d+).*?HEIGHT\s*=\s*(\d+)/i);
  if (whMatch) return whMatch[2] + "p";
  
  // 1920x1080
  var resMatch = script.match(/(\d+)\s*x\s*(\d+)/);
  if (resMatch) return resMatch[2] + "p";
  
  return null;
}

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  console.log("[mp4upload] Fetching: " + url);
  
  var headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Referer": "https://www.mp4upload.com/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
  };
  
  var html = http.get(url, headers);
  if (!html || html.length === 0) {
    console.log("[mp4upload] HTML vacío o nulo");
    return [];
  }
  
  console.log("[mp4upload] HTML length: " + html.length);
  
  // Buscar scripts que contengan eval o player.src
  var scriptContent = null;
  
  // Primero buscar script con eval(function(p,a,c,k,e,d))
  var evalScriptMatch = html.match(/<script[^>]*>[\s\S]*?eval\s*\(\s*function\s*\(p,a,c,k,e,d\)[\s\S]*?<\/script>/i);
  if (evalScriptMatch) {
    var fullScript = evalScriptMatch[0];
    var innerMatch = fullScript.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (innerMatch) {
      scriptContent = innerMatch[1];
      console.log("[mp4upload] Encontrado script eval, length: " + scriptContent.length);
    }
  }
  
  // Si no, buscar script que contenga player.src
  if (!scriptContent) {
    var playerScriptMatch = html.match(/<script[^>]*>[\s\S]*?player\.src[\s\S]*?<\/script>/i);
    if (playerScriptMatch) {
      var fullScript = playerScriptMatch[0];
      var innerMatch = fullScript.match(/<script[^>]*>([\s\S]*?)<\/script>/);
      if (innerMatch) {
        scriptContent = innerMatch[1];
        console.log("[mp4upload] Encontrado script player.src, length: " + scriptContent.length);
      }
    }
  }
  
  // Si aún no, buscar cualquier script que pueda contener la URL de video
  if (!scriptContent) {
    // Buscar todos los scripts y tomar el primero que parezca tener URL de video
    var scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    var match;
    while ((match = scriptRegex.exec(html)) !== null) {
      var content = match[1];
      if (content.indexOf("http") !== -1 && (content.indexOf(".mp4") !== -1 || content.indexOf(".m3u8") !== -1)) {
        scriptContent = content;
        console.log("[mp4upload] Encontrado script con URL de video, length: " + content.length);
        break;
      }
    }
  }
  
  if (!scriptContent) {
    console.log("[mp4upload] No se encontró ningún script relevante");
    return [];
  }
  
  // Desempaquetar si es necesario
  if (scriptContent.indexOf("eval(function") !== -1) {
    var unpacked = jsUnpack(scriptContent);
    if (unpacked) {
      console.log("[mp4upload] Script desempaquetado, length: " + unpacked.length);
      scriptContent = unpacked;
    } else {
      console.log("[mp4upload] Falló el desempaquetado del script");
    }
  }
  
  // Extraer URL del video
  var videoUrl = extractVideoUrl(scriptContent);
  if (!videoUrl) {
    console.log("[mp4upload] No se pudo extraer la URL del video del script");
    // Intentar buscar URL directa en todo el HTML como último recurso
    var directUrlMatch = html.match(/https?:\/\/[^"'\s]+\.(mp4|m3u8|mkv|avi|mov)[^"'\s]*/i);
    if (directUrlMatch) {
      videoUrl = directUrlMatch[0];
      console.log("[mp4upload] URL encontrada por regex directa: " + videoUrl);
    } else {
      return [];
    }
  }
  
  // Asegurar que la URL sea absoluta
  if (videoUrl.startsWith("//")) {
    videoUrl = "https:" + videoUrl;
  } else if (videoUrl.startsWith("/")) {
    var domainMatch = url.match(/^(https?:\/\/[^\/]+)/);
    if (domainMatch) {
      videoUrl = domainMatch[1] + videoUrl;
    }
  }
  
  // Extraer resolución
  var resolution = extractResolution(scriptContent) || extractResolution(html) || "HD";
  
  console.log("[mp4upload] URL extraída: " + videoUrl);
  console.log("[mp4upload] Resolución: " + resolution);
  
  return [{
    url: videoUrl,
    quality: "Mp4Upload - " + resolution,
    headers: headers
  }];
}