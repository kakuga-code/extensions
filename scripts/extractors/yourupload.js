// YourUpload Extractor — Kazemi JS
// =========================================================

const EXTRACTOR = {
  id: "yourupload",
  aliases: ["yt", "yu", "yourupload"],
  name: "YourUpload",
  version: "1.0.0",
  domains: [
    "yourupload.com",
    "www.yourupload.com",
    "yourupload.to",
    "yourupload.net"
  ]
};

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  console.log("[yourupload] Fetching: " + url);
  
  var headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Referer": "https://www.yourupload.com/"
  };
  
  var html = http.get(url, headers);
  if (!html || html.length === 0) {
    console.log("[yourupload] HTML vacío o nulo");
    return [];
  }
  
  console.log("[yourupload] HTML length: " + html.length);
  
  // Buscar script que contenga jwplayerOptions
  var scriptMatch = html.match(/<script[^>]*>[\s\S]*?jwplayerOptions[\s\S]*?<\/script>/i);
  if (!scriptMatch) {
    console.log("[yourupload] No se encontró script con jwplayerOptions");
    // Intentar buscar cualquier script que pueda contener la URL
    scriptMatch = html.match(/<script[^>]*>[\s\S]*?file\s*:[\s\S]*?<\/script>/i);
    if (!scriptMatch) {
      console.log("[yourupload] No se encontró script con file:");
      return [];
    }
  }
  
  var fullScript = scriptMatch[0];
  var innerMatch = fullScript.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  if (!innerMatch) {
    console.log("[yourupload] No se pudo extraer contenido del script");
    return [];
  }
  
  var scriptContent = innerMatch[1];
  console.log("[yourupload] Script encontrado, length: " + scriptContent.length);
  
  // Buscar patrón file: 'http://...'
  var fileMatch = scriptContent.match(/file\s*:\s*['"]([^'"]+)['"]/);
  if (!fileMatch) {
    // Intentar otro patrón común: sources: [{file: '...'}]
    var sourcesMatch = scriptContent.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*['"]([^'"]+)['"]/);
    if (sourcesMatch) {
      fileMatch = sourcesMatch;
    } else {
      // Último intento: buscar URL directa en el script
      var urlMatch = scriptContent.match(/https?:\/\/[^'"]+\.(mp4|m3u8|mkv|avi|mov)[^'"]*/i);
      if (urlMatch) {
        fileMatch = {1: urlMatch[0]};
      }
    }
  }
  
  if (!fileMatch) {
    console.log("[yourupload] No se pudo extraer la URL del video del script");
    // Intentar buscar URL directa en todo el HTML como último recurso
    var directUrlMatch = html.match(/https?:\/\/[^"'\s]+\.(mp4|m3u8|mkv|avi|mov)[^"'\s]*/i);
    if (directUrlMatch) {
      fileMatch = {1: directUrlMatch[0]};
      console.log("[yourupload] URL encontrada por regex directa: " + fileMatch[1]);
    } else {
      return [];
    }
  }
  
  var videoUrl = fileMatch[1];
  
  // Asegurar que la URL sea absoluta
  if (videoUrl.startsWith("//")) {
    videoUrl = "https:" + videoUrl;
  } else if (videoUrl.startsWith("/")) {
    var domainMatch = url.match(/^(https?:\/\/[^\/]+)/);
    if (domainMatch) {
      videoUrl = domainMatch[1] + videoUrl;
    }
  }
  
  console.log("[yourupload] URL extraída: " + videoUrl);
  
  // Intentar extraer calidad/resolución si está disponible
  var quality = "YourUpload - HD";
  var qualityMatch = scriptContent.match(/quality\s*:\s*['"]([^'"]+)['"]/);
  if (qualityMatch) {
    quality = "YourUpload - " + qualityMatch[1];
  } else {
    var labelMatch = scriptContent.match(/label\s*:\s*['"]([^'"]+)['"]/);
    if (labelMatch) {
      quality = "YourUpload - " + labelMatch[1];
    }
  }
  
  return [{
    url: videoUrl,
    quality: quality,
    headers: headers
  }];
}