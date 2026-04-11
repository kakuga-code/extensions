// VidNest Extractor — Kazemi JS
// =========================================================

console.log("[vidnest] Cargando extractor...");

const EXTRACTOR = {
  id: "vidnest",
  name: "VidNest",
  version: "1.0.0",
  domains: [
    "vidnest.io",
    "vidnest.pro"
  ]
};

console.log("[vidnest] EXTRACTOR definido:", JSON.stringify(EXTRACTOR));

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

// Extrae la URL del video del script
function extractVideoUrl(script) {
  // Buscar patrones comunes
  // 1. file: "http://..."
  var m1 = script.match(/file\s*:\s*["']([^"']+)["']/);
  if (m1) return m1[1];
  
  // 2. src: "http://..."
  var m2 = script.match(/src\s*:\s*["']([^"']+)["']/);
  if (m2) return m2[1];
  
  // 3. player.src = "http://..."
  var m3 = script.match(/player\.src\s*=\s*["']([^"']+)["']/);
  if (m3) return m3[1];
  
  // 4. .src("http://...")
  var m4 = script.match(/\.src\s*\(\s*["']([^"']+)["']\s*\)/);
  if (m4) return m4[1];
  
  return null;
}

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  console.log("[vidnest] Fetching: " + url);
  
  var headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Referer": "https://vidnest.io/"
  };
  
  // Obtener el HTML de la página de embed
  var html = http.get(url, headers);
  if (!html || html.length === 0) {
    console.log("[vidnest] HTML vacío o nulo");
    return [];
  }
  
  console.log("[vidnest] HTML length: " + html.length);
  
  // Extraer el file_code del HTML
  var fileCode = null;
  var fileCodeMatch = html.match(/name="file_code"\s+value="([^"]+)"/);
  if (fileCodeMatch) {
    fileCode = fileCodeMatch[1];
    console.log("[vidnest] file_code: " + fileCode);
  }
  
  // Si no se encontró file_code en el input, extraerlo del URL
  if (!fileCode) {
    var pathMatch = url.match(/\/e\/([a-zA-Z0-9]+)/);
    if (pathMatch) {
      fileCode = pathMatch[1];
      console.log("[vidnest] file_code extraído del URL: " + fileCode);
    }
  }
  
  if (!fileCode) {
    console.log("[vidnest] No se pudo extraer file_code");
    return [];
  }
  
  // Hacer POST al endpoint /dl para obtener la URL del video
  var postUrl = "https://vidnest.io/dl";
  var postHeaders = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Referer": url,
    "Content-Type": "application/x-www-form-urlencoded"
  };
  
  var postData = "op=embed&file_code=" + encodeURIComponent(fileCode) + "&auto=1&referer=";
  console.log("[vidnest] POST data: " + postData);
  
  var dlHtml = http.post(postUrl, postData, postHeaders);
  if (!dlHtml || dlHtml.length === 0) {
    console.log("[vidnest] Respuesta vacía del endpoint /dl");
    return [];
  }
  
  console.log("[vidnest] Respuesta /dl length: " + dlHtml.length);
  
  // Buscar la URL del video en la respuesta
  var videoUrl = null;
  
  // Buscar en scripts con eval
  var evalScriptMatch = dlHtml.match(/<script[^>]*>[\s\S]*?eval\s*\(\s*function\s*\(p,a,c,k,e,d\)[\s\S]*?<\/script>/i);
  if (evalScriptMatch) {
    var fullScript = evalScriptMatch[0];
    var innerMatch = fullScript.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (innerMatch) {
      var scriptContent = innerMatch[1];
      console.log("[vidnest] Encontrado script eval en /dl, length: " + scriptContent.length);
      
      // Desempaquetar si es necesario
      if (scriptContent.indexOf("eval(function") !== -1) {
        var unpacked = jsUnpack(scriptContent);
        if (unpacked) {
          console.log("[vidnest] Script desempaquetado, length: " + unpacked.length);
          scriptContent = unpacked;
        }
      }
      
      // Extraer URL del video
      videoUrl = extractVideoUrl(scriptContent);
      if (videoUrl) {
        console.log("[vidnest] URL extraída de script eval: " + videoUrl);
      }
    }
  }
  
  // Si no se encontró, buscar en cualquier script
  if (!videoUrl) {
    var scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    var match;
    while ((match = scriptRegex.exec(dlHtml)) !== null) {
      var content = match[1];
      if (content.indexOf("http") !== -1 && (content.indexOf(".mp4") !== -1 || content.indexOf(".m3u8") !== -1)) {
        videoUrl = extractVideoUrl(content);
        if (videoUrl) {
          console.log("[vidnest] URL extraída de script: " + videoUrl);
          break;
        }
      }
    }
  }
  
  // Si aún no, buscar URL directa en el HTML
  if (!videoUrl) {
    var directUrlMatch = dlHtml.match(/https?:\/\/[^"'\s]+\.(mp4|m3u8|mkv|avi|mov)[^"'\s]*/i);
    if (directUrlMatch) {
      videoUrl = directUrlMatch[0];
      console.log("[vidnest] URL encontrada por regex directa: " + videoUrl);
    }
  }
  
  // Buscar en scripts que contengan jwplayer o player
  if (!videoUrl) {
    var jwplayerScriptMatch = dlHtml.match(/<script[^>]*>[\s\S]*?jwplayer[\s\S]*?<\/script>/i);
    if (jwplayerScriptMatch) {
      var fullScript = jwplayerScriptMatch[0];
      var innerMatch = fullScript.match(/<script[^>]*>([\s\S]*?)<\/script>/);
      if (innerMatch) {
        var scriptContent = innerMatch[1];
        console.log("[vidnest] Encontrado script jwplayer, length: " + scriptContent.length);
        
        // Buscar URL en el script jwplayer
        var jwUrlMatch = scriptContent.match(/file\s*:\s*["']([^"']+)["']/);
        if (jwUrlMatch) {
          videoUrl = jwUrlMatch[1];
          console.log("[vidnest] URL extraída de jwplayer: " + videoUrl);
        }
        
        // Buscar setSource
        var setSourceMatch = scriptContent.match(/setSource\s*\(\s*["']([^"']+)["']/);
        if (setSourceMatch) {
          videoUrl = setSourceMatch[1];
          console.log("[vidnest] URL extraída de setSource: " + videoUrl);
        }
      }
    }
  }
  
  if (!videoUrl) {
    console.log("[vidnest] No se pudo extraer ninguna URL");
    console.log("[vidnest] Respuesta /dl preview: " + dlHtml.substring(0, Math.min(500, dlHtml.length)));
    return [];
  }
  
  // Asegurar que la URL sea absoluta
  if (videoUrl.startsWith("//")) {
    videoUrl = "https:" + videoUrl;
  } else if (videoUrl.startsWith("/")) {
    var domainMatch = postUrl.match(/^(https?:\/\/[^\/]+)/);
    if (domainMatch) {
      videoUrl = domainMatch[1] + videoUrl;
    }
  }
  
  // Determinar calidad basado en la URL o extensión
  var quality = "VidNest - HD";
  if (videoUrl.indexOf(".m3u8") !== -1) {
    quality = "VidNest - Auto";
  }
  
  console.log("[vidnest] URL final: " + videoUrl);
  console.log("[vidnest] Calidad: " + quality);
  
  return [{
    url: videoUrl,
    quality: quality,
    headers: headers
  }];
}
