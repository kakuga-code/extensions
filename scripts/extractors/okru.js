// Okru Extractor — Kazemi JS
// =========================================================

const EXTRACTOR = {
  id: "okru",
  name: "Okru",
  version: "1.0.0",
  domains: [
    "ok.ru",
    "odnoklassniki.ru"
  ]
};

// Mapa de calidades basado en la estructura de OkruExtractor
const QUALITY_MAP = {
  "ultra": "2160p",
  "quad": "1440p",
  "full": "1080p",
  "hd": "720p",
  "sd": "480p",
  "low": "360p",
  "lowest": "240p",
  "mobile": "144p"
};

function fixQuality(quality) {
  return QUALITY_MAP[quality.toLowerCase()] || quality;
}

// ── Helpers de manipulación de strings ────────────────────
// Estas funciones emulan el comportamiento nativo de Kotlin
// para procesar el JSON ultra-escapado que entrega ok.ru

function substringAfter(str, marker) {
  var idx = str.indexOf(marker);
  if (idx === -1) return "";
  return str.substring(idx + marker.length);
}

function substringBefore(str, marker) {
  var idx = str.indexOf(marker);
  if (idx === -1) return str;
  return str.substring(0, idx);
}

function extractLinkStr(str, attr) {
  // Simula: substringAfter("$attr\\\":\\\"").substringBefore("\\\"").replace("\\\\u0026", "&")
  var marker = attr + '\\":\\"';
  var after = substringAfter(str, marker);
  if (!after) return null;
  var link = substringBefore(after, '\\"');
  
  // Limpia los ampersands escapados en múltiples niveles
  return link.split("\\\\u0026").join("&").split("\\u0026").join("&");
}

function videosFromJson(videoString) {
  // Extrae el array de videos dentro del string JSON escapado
  var startMarker = '\\"videos\\":[{\\"name\\":\\"';
  var afterStart = substringAfter(videoString, startMarker);
  if (!afterStart) return [];
  
  var arrayData = substringBefore(afterStart, "]");
  
  // Separa por nombre de calidad y revierte el array para mantener el orden de mejor a peor
  var splitMarker = '{\\"name\\":\\"';
  var items = arrayData.split(splitMarker).reverse();
  
  var results = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (!item) continue;
    
    var videoUrl = extractLinkStr(item, "url");
    if (!videoUrl) continue;
    
    var qualityRaw = substringBefore(item, '\\"');
    var quality = fixQuality(qualityRaw);
    
    // Solo se aceptan URLs seguras (https://)
    if (videoUrl.indexOf("https://") === 0) {
      results.push({
        url: videoUrl,
        quality: "Okru:" + quality,
        headers: { "Referer": "https://ok.ru/" }
      });
    }
  }
  return results;
}

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  console.log("[okru] Fetching: " + url);
  
  var html = http.get(url, {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Referer": "https://ok.ru/"
  });

  if (!html || html.length === 0) {
    console.log("[okru] HTML vacío");
    return [];
  }

  // Ok.ru almacena toda la configuración y los enlaces en un atributo "data-options"
  var match = html.match(/data-options=(['"])(.*?)\1/);
  if (!match) {
    console.log("[okru] No se encontró el bloque data-options");
    return [];
  }

  var videoString = match[2];
  
  // Desescapar entidades HTML estándar que el regex captura al leer el atributo
  videoString = videoString.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

  var results = [];

  // La lógica principal sigue un orden de prioridad exclusivo:
  // Si encuentra HLS lo usa, si no busca DASH, y si no, hace fallback al JSON interno de MP4.
  if (videoString.indexOf("ondemandHls") !== -1) {
    var hlsUrl = extractLinkStr(videoString, "ondemandHls");
    if (hlsUrl) {
      console.log("[okru] Encontrado enlace HLS");
      results.push({
        url: hlsUrl,
        quality: "Okru:HLS",
        headers: { "Referer": "https://ok.ru/" }
      });
    }
  } else if (videoString.indexOf("ondemandDash") !== -1) {
    var dashUrl = extractLinkStr(videoString, "ondemandDash");
    if (dashUrl) {
      console.log("[okru] Encontrado enlace DASH");
      results.push({
        url: dashUrl,
        quality: "Okru:DASH",
        headers: { "Referer": "https://ok.ru/" }
      });
    }
  } else {
    console.log("[okru] Buscando videos MP4 directos en el JSON...");
    results = videosFromJson(videoString);
  }

  console.log("[okru] Encontrados " + results.length + " enlaces de reproducción.");
  return results;
}