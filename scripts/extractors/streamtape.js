// StreamTape Extractor — Kazemi JS
// =========================================================

const EXTRACTOR = {
  id: "streamtape",
  name: "StreamTape",
  version: "1.0.0",
  aliases: ["stape", "streamtp", "streamtape"],
  domains: [
    "streamtape.com",
    "streamtape.net",
    "streamtape.xyz",
    "streamtape.to",
    "streamtape.cc",
    "shavetape.cash"
  ]
};

// Convierte cualquier URL de streamtape al formato /e/<id>
function getEmbedUrl(url) {
  var base = "https://streamtape.com/e/";
  if (url.indexOf(base) === 0) return url;
  // Extraer el ID del path: /v/<id>/ o /e/<id>/
  var parts = url.split("/");
  // partes: ["https:", "", "streamtape.com", "v", "<id>", ...]
  var id = null;
  for (var i = 0; i < parts.length; i++) {
    if ((parts[i] === "v" || parts[i] === "e") && parts[i + 1]) {
      id = parts[i + 1].split("?")[0];
      break;
    }
  }
  return id ? base + id : url;
}

function extractVideos(url) {
  var embedUrl = getEmbedUrl(url);
  console.log("[streamtape] Fetching: " + embedUrl);

  var html = http.get(embedUrl, {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Referer": "https://streamtape.com/"
  });

  if (!html || html.length === 0) {
    console.log("[streamtape] HTML vacío");
    return [];
  }

  // Buscar el script que contiene robotlink
  // Patrón: document.getElementById('robotlink').innerHTML = '<parte1>' + ('xcd<parte2>'...
  var marker = "document.getElementById('robotlink')";
  var idx = html.indexOf(marker);
  if (idx === -1) {
    console.log("[streamtape] No se encontró robotlink");
    return [];
  }

  // Extraer desde el marker hasta el siguiente ; o newline
  var segment = html.substring(idx, idx + 500);

  // Parte 1: innerHTML = '<parte1>'
  var p1Match = segment.match(/innerHTML\s*=\s*'([^']+)'/);
  if (!p1Match) {
    console.log("[streamtape] No se encontró parte1 en: " + segment);
    return [];
  }
  var part1 = p1Match[1];

  // Parte 2: + ('xcd<parte2>'  — el prefijo 'xcd' se descarta
  var p2Match = segment.match(/\+\s*\('xcd([^']+)'/);
  if (!p2Match) {
    // Intentar sin prefijo xcd
    var p2AltMatch = segment.match(/\+\s*\('([^']+)'/);
    if (!p2AltMatch) {
      console.log("[streamtape] No se encontró parte2 en: " + segment);
      return [];
    }
    var part2 = p2AltMatch[1];
  } else {
    var part2 = p2Match[1];
  }

  var videoUrl = "https:" + part1 + part2;
  console.log("[streamtape] URL extraída: " + videoUrl);

  return [{
    url: videoUrl,
    quality: "HD",
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      "Referer": "https://streamtape.com/"
    }
  }];
}
