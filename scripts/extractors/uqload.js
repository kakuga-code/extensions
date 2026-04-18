// Uqload Extractor — Kazemi JS
// =========================================================

const EXTRACTOR = {
  id: "uqload",
  aliases: ["uq", "uqload"],
  name: "Uqload",
  version: "1.0.0",
  domains: [
    "uqload.is",
    "uqload.co",
    "uqload.com",
    "uqload.to",
    "uqload.ws"
  ]
};

const BASE_URL = "https://uqload.is/";

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  // 1. Reemplazar el host por la URL base (uqload.is) si es diferente
  var fixedUrl = url;
  if (url.toLowerCase().indexOf(BASE_URL) !== 0) {
    // Reemplaza cualquier dominio por https://uqload.is/
    fixedUrl = url.replace(/https?:\/\/(?:www\.)?[^\/]+\//, BASE_URL);
  }

  console.log("[uqload] Fetching: " + fixedUrl);

  // Realizar la petición GET
  var html = http.get(fixedUrl, {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Referer": BASE_URL
  });

  if (!html || html.length === 0) {
    console.log("[uqload] HTML vacío");
    return [];
  }

  // 2. Buscar el script que contiene la data de sources (equivalente a script:containsData(sources:))
  // Se busca el patrón: sources: ["<URL_DEL_VIDEO>"
  var sourceMatch = html.match(/sources:\s*\[\s*"([^"]+)"/);
  
  if (!sourceMatch) {
    console.log("[uqload] No se encontró 'sources: [\"' en el HTML");
    return [];
  }

  var videoUrl = sourceMatch[1].trim();

  // 3. Validar que la cadena no esté vacía y comience con "http"
  if (!videoUrl || videoUrl.indexOf("http") !== 0) {
    console.log("[uqload] URL de video inválida o vacía: " + videoUrl);
    return [];
  }

  console.log("[uqload] URL extraída exitosamente: " + videoUrl);

  // 4. Retornar el objeto de video con los headers requeridos
  return [{
    url: videoUrl,
    quality: "Uqload",
    headers: {
      "Referer": BASE_URL
    }
  }];
}