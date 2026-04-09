// MegaCloud Extractor — Kazemi JS
// =========================================================

const EXTRACTOR = {
  id: "megacloud",
  name: "MegaCloud",
  version: "1.4.0",
  domains: [
    "megacloud.blog",
    "megacloud.tv",
    "megacloud.net",
    "rabbitstream.net",
    "vizcloud.co",
    "vizcloud2.online",
    "vizcloud3.online",
    "dokicloud.one",
    "vizcloud.online"
  ]
};

// ── Helpers ──────────────────────────────────────────────

function getEmbedId(url) {
  // Extrae el ID del video de cualquier variante de URL MegaCloud
  // Soporta: /embed-2/v3/e-1/<id>, /embed-2/e-1/<id>, /e-1/<id>, /v2/<id>
  var idM = url.match(/\/e-1\/([a-zA-Z0-9]+)/);
  if (!idM) idM = url.match(/\/v2\/([a-zA-Z0-9]+)/);
  if (!idM) idM = url.match(/\/([a-zA-Z0-9]{10,})(?:\?|$)/);
  return idM ? idM[1] : null;
}

// ── Decryption (V3 Shuffling) ────────────────────────────

function decrypt(cipher, secret, nonce) {
  console.log("[megacloud] Attempting decryption (cipher len: " + cipher.length + ")");
  var helperUrl = "https://megacloud-keys.vercel.app/decryption-v3";
  var fullUrl = helperUrl + "?encrypted_data=" + encodeURIComponent(cipher) + "&nonce=" + encodeURIComponent(nonce) + "&secret=" + encodeURIComponent(secret);
  var resStr = http.get(fullUrl, { "User-Agent": "Kazemi/1.0.0" });
  try {
    var res = JSON.parse(resStr);
    return res.file || null;
  } catch(e) {
    console.log("[megacloud] Decryption helper error: " + e.message);
    return null;
  }
}

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  var host = url.split("/")[2];
  var id = getEmbedId(url);
  if (!id) {
    console.log("[megacloud] Error: No se pudo extraer el ID de: " + url);
    return [];
  }

  // Usar la URL original para fetch (no reconstruir, puede tener paths distintos como /v3/)
  var embedUrl = url;
  console.log("[megacloud] Fetching embed: " + embedUrl);
  var html = http.get(embedUrl, {
    "Referer": "https://" + host + "/",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  if (!html) {
    console.log("[megacloud] Error: HTML vacío para " + embedUrl);
    return [];
  }

  console.log("[megacloud] HTML len: " + html.length);

  // Extraer el "nonce" (_k) — 48 caracteres alfanuméricos
  var nonce = "";
  var nonceM = html.match(/\b([a-zA-Z0-9]{48})\b/);
  if (nonceM) {
    nonce = nonceM[1];
  } else {
    // Patrón 2: var _0x... = "16chars" + "16chars" + "16chars"
    var nonceBlocks = html.match(/"([a-zA-Z0-9]{16})"\s*\+\s*"([a-zA-Z0-9]{16})"\s*\+\s*"([a-zA-Z0-9]{16})"/);
    if (nonceBlocks) {
      nonce = nonceBlocks[1] + nonceBlocks[2] + nonceBlocks[3];
    }
  }

  if (!nonce) {
    console.log("[megacloud] Error: No se pudo extraer el nonce. HTML snippet (0-2000): " + html.substring(0, 2000));
    return [];
  }
  console.log("[megacloud] Nonce: " + nonce.substring(0, 10) + "...");

  // API getSources
  var sourcesUrl = "https://" + host + "/embed-2/v3/e-1/getSources?id=" + id + "&_k=" + nonce;
  console.log("[megacloud] getSources URL: " + sourcesUrl);
  var sourcesStr = http.get(sourcesUrl, {
    "X-Requested-With": "XMLHttpRequest",
    "Referer": embedUrl,
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  console.log("[megacloud] getSources response: " + (sourcesStr ? sourcesStr.substring(0, 200) : "EMPTY"));

  var data;
  try { data = JSON.parse(sourcesStr); } catch(e) {
    console.log("[megacloud] JSON parse error: " + e.message);
    return [];
  }

  if (!data.sources || data.sources.length === 0) {
    console.log("[megacloud] No sources in response. encrypted=" + data.encrypted);
    return [];
  }

  // El campo encrypted tiene default true (igual que la implementación de referencia en Kotlin)
  var isEncrypted = (data.encrypted !== false);

  // Obtener secreto para descifrar si es necesario
  var secret = "";
  if (isEncrypted) {
    var keysStr = http.get("https://raw.githubusercontent.com/yogesh-hacker/MegacloudKeys/refs/heads/main/keys.json");
    try {
      var keys = JSON.parse(keysStr);
      secret = keys.mega || "";
      console.log("[megacloud] Key obtenida: " + secret.substring(0, 8) + "...");
    } catch(e) {
      console.log("[megacloud] Error al obtener llaves: " + e.message);
    }
  }

  // Parsear subtítulos: solo kind === "captions" (igual que referencia Kotlin)
  var subtitles = [];
  if (Array.isArray(data.tracks)) {
    data.tracks.forEach(function(t) {
      if (!t.file || t.kind !== "captions") return;
      subtitles.push({
        url: t.file,
        language: t.label ? t.label.toLowerCase().substring(0, 5) : "und",
        label: t.label || "Unknown",
        isDefault: t.default === true
      });
    });
  }
  console.log("[megacloud] Subtitles: " + subtitles.length);

  console.log("[megacloud] encrypted=" + isEncrypted + " sources=" + data.sources.length);
  var results = [];
  data.sources.forEach(function(source) {
    var fileUrl = source.file;
    if (isEncrypted && fileUrl && fileUrl.indexOf(".m3u8") === -1) {
      console.log("[megacloud] Desencriptando source...");
      fileUrl = decrypt(fileUrl, secret, nonce);
    }
    if (fileUrl) {
      results.push({
        url: fileUrl,
        quality: "Multi-Quality (m3u8)",
        headers: {
          "Referer": "https://" + host + "/",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        subtitles: subtitles
      });
    }
  });

  console.log("[megacloud] Results: " + results.length);
  return results;
}
