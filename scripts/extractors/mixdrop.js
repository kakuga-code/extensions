// MixDrop Extractor — Kazemi JS
// =========================================================

var EXTRACTOR = {
  id: "mixdrop",
  aliases: ["mx", "md", "mixdrop"],
  name: "MixDrop",
  version: "1.0.1",
  domains: [
    "mixdrop.co",
    "mixdrop.to",
    "mixdrop.ag",
    "mixdrop.sx",
    "mixdrop.bz",
    "mixdrop.ch",
    "mixdrop.club",
    "mixdrop.gl",
    "mixdrop.vc",
    "mixdrop24.com",
    "mixdrop.top",
    "mdy48tn97.com",
    "mdbekjwqa.pw",
    "mxdrop.to"
  ]
};

var SOURCE = {
  id: EXTRACTOR.id,
  name: EXTRACTOR.name,
  baseUrl: "https://mixdrop.co",
  language: "all",
  version: EXTRACTOR.version
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

// Busca script que contenga eval y MDCore
function findMDCoreScript(html) {
  // Buscar todos los scripts
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const scriptContent = match[1];
    // Verificar si contiene eval y MDCore
    if (scriptContent.includes("eval") && scriptContent.includes("MDCore")) {
      return scriptContent;
    }
  }
  return null;
}

// Extrae la URL del video del script desempaquetado
function extractVideoUrl(unpacked) {
  // Buscar Core.wurl="..."
  const wurlMatch = unpacked.match(/Core\.wurl\s*=\s*["']([^"']+)["']/);
  if (wurlMatch) {
    let videoUrl = wurlMatch[1];
    // Asegurar que tenga el protocolo
    if (videoUrl.startsWith("//")) {
      videoUrl = "https:" + videoUrl;
    } else if (!videoUrl.startsWith("http")) {
      videoUrl = "https://" + videoUrl;
    }
    return videoUrl;
  }
  return null;
}

// Extrae subtítulos del script desempaquetado
function extractSubtitles(unpacked) {
  const subMatch = unpacked.match(/Core\.remotesub\s*=\s*["']([^"']+)["']/);
  if (subMatch) {
    let subUrl = subMatch[1];
    // Decodificar URL si está codificada
    try {
      subUrl = decodeURIComponent(subUrl);
    } catch (e) {
      // Si falla, usar tal cual
    }
    // Asegurar que tenga el protocolo
    if (subUrl.startsWith("//")) {
      subUrl = "https:" + subUrl;
    } else if (!subUrl.startsWith("http")) {
      subUrl = "https://" + subUrl;
    }
    return subUrl;
  }
  return null;
}

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  console.log("[mixdrop] Fetching: " + url);
  
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "Referer": "https://mixdrop.co/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
  };
  
  let html = http.get(url, headers);
  if (!html || html.length === 0) {
    console.log("[mixdrop] HTML vacío o nulo");
    return [];
  }
  
  console.log("[mixdrop] HTML length: " + html.length);
  
  // 1. Buscar script con eval y MDCore
  const script = findMDCoreScript(html);
  if (!script) {
    console.log("[mixdrop] No se encontró script con eval y MDCore");
    return [];
  }
  
  console.log("[mixdrop] Script encontrado, length: " + script.length);
  
  // 2. Desempaquetar el script
  const unpacked = jsUnpack(script);
  if (!unpacked) {
    console.log("[mixdrop] No se pudo desempaquetar el script");
    return [];
  }
  
  console.log("[mixdrop] Script desempaquetado, length: " + unpacked.length);
  console.log("[mixdrop] Unpacked preview: " + unpacked.substring(0, 200));
  
  // 3. Extraer URL del video
  const videoUrl = extractVideoUrl(unpacked);
  if (!videoUrl) {
    console.log("[mixdrop] No se pudo extraer la URL del video");
    return [];
  }
  
  console.log("[mixdrop] Video URL encontrada: " + videoUrl);
  
  // 4. Extraer subtítulos (opcional)
  const subtitleUrl = extractSubtitles(unpacked);
  const results = [];
  
  // Construir objeto de video
  const videoEntry = {
    url: videoUrl,
    quality: "MixDrop",
    headers: {
      "Referer": "https://mixdrop.co/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
    }
  };
  
  // Añadir subtítulos si existen
  if (subtitleUrl) {
    console.log("[mixdrop] Subtítulos encontrados: " + subtitleUrl);
    videoEntry.subtitles = [{
      url: subtitleUrl,
      lang: "sub",
      format: "vtt"
    }];
  }
  
  results.push(videoEntry);
  console.log("[mixdrop] Extraído 1 enlace");
  
  return results;
}