// VOE Extractor — Kazemi JS
// =========================================================

const EXTRACTOR = {
  id: "voe",
  aliases: ["voe"],
  name: "VOE",
  version: "1.0.1",
  domains: [
    "voe.sx",
    "voe-storage.com",
    "voe.observer",
    "voe.casa",
    "voe.com",
    "reputationsfaintly.com",
    "thepizzatime.com",
    "jefferycontrolmodel.com"  // Nuevo dominio de redirección
  ]
};

// ── Helpers ──────────────────────────────────────────────

function rot13(str) {
  return str.replace(/[a-zA-Z]/g, function(c) {
    return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
  });
}

function replacePatterns(str) {
  const patterns = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
  let res = str;
  patterns.forEach(function(p) {
    res = res.split(p).join("_");
  });
  return res;
}

function removeUnderscores(str) {
  return str.split("_").join("");
}

function charShift(str, shift) {
  let res = "";
  for (let i = 0; i < str.length; i++) {
    res += String.fromCharCode(str.charCodeAt(i) - shift);
  }
  return res;
}

function reverse(str) {
  return str.split("").reverse().join("");
}

/**
 * Motor de descifrado F7 de VOE
 */
function decryptF7(encoded) {
  try {
    console.log("[voe] Iniciando descifrado F7");
    let v1 = rot13(encoded);
    let v2 = replacePatterns(v1);
    let v3 = removeUnderscores(v2);
    let v4 = atob(v3);
    let v5 = charShift(v4, 3);
    let v6 = reverse(v5);
    let v7 = atob(v6);
    return JSON.parse(v7);
  } catch (e) {
    console.log("[voe] Error en decryptF7: " + e.message);
    return null;
  }
}

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  console.log("[voe] Fetching: " + url);
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://voe.sx/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
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
  if (!html) {
    console.log("[voe] HTML vacío, intentando con headers alternativos...");
    // Headers alternativos más simples
    const altHeaders = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      "Referer": "https://voe.sx/",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    };
    html = http.get(url, altHeaders);
    if (!html) return [];
  }

  // 1. Verificar redirecciones (window.location, meta refresh, etc.)
  let finalUrl = url;
  
  // a) Redirección window.location
  const windowRedirectM = html.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/);
  if (windowRedirectM) {
    const redirectUrl = windowRedirectM[1];
    console.log("[voe] Siguiendo redirección window.location: " + redirectUrl);
    finalUrl = redirectUrl;
    if (finalUrl.startsWith("//")) {
      finalUrl = "https:" + finalUrl;
    } else if (finalUrl.startsWith("/")) {
      const baseDomain = url.match(/^(https?:\/\/[^\/]+)/)[1];
      finalUrl = baseDomain + finalUrl;
    }
    html = http.get(finalUrl, headers);
    if (!html) return [];
  }
  
  // b) Redirección meta refresh (poco común pero posible)
  if (!windowRedirectM && html.includes("http-equiv=\"refresh\"")) {
    const metaRefreshM = html.match(/content=["']\d+;\s*url=([^"']+)["']/i);
    if (metaRefreshM) {
      const redirectUrl = metaRefreshM[1];
      console.log("[voe] Siguiendo redirección meta refresh: " + redirectUrl);
      finalUrl = redirectUrl;
      if (finalUrl.startsWith("//")) {
        finalUrl = "https:" + finalUrl;
      } else if (finalUrl.startsWith("/")) {
        const baseDomain = url.match(/^(https?:\/\/[^\/]+)/)[1];
        finalUrl = baseDomain + finalUrl;
      }
      html = http.get(finalUrl, headers);
      if (!html) return [];
    }
  }
  
  // c) Si la URL ya es jefferycontrolmodel.com pero el HTML parece vacío o tiene Cloudflare
  if (finalUrl.includes("jefferycontrolmodel.com") && (!html || html.length < 100 || html.includes("cf-browser-verification"))) {
    console.log("[voe] URL redirigida a jefferycontrolmodel.com, intentando con headers específicos...");
    const jefferyHeaders = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      "Referer": "https://voe.sx/",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Origin": "https://voe.sx"
    };
    html = http.get(finalUrl, jefferyHeaders);
    if (!html) return [];
  }

  // 2. Extraer JSON codificado del script applicaton/json
  // Formato: <script type="application/json">["ENCODED_STRING"]</script>
  const scriptMatch = html.match(/<script[^>]+type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    console.log("[voe] No se encontró bloque application/json, buscando patrones alternativos...");
    
    // Buscar patrones alternativos
    const altScriptMatch = html.match(/<script[^>]+id="player"[^>]*>([\s\S]*?)<\/script>/);
    if (altScriptMatch) {
      const scriptContent = altScriptMatch[1];
      // Buscar JSON en el script del player
      const jsonMatch = scriptContent.match(/JSON\.parse\(atob\('([^']+)'\)\)/);
      if (jsonMatch) {
        const encodedString = jsonMatch[1];
        console.log("[voe] Encontrado JSON en script player, encoded length: " + encodedString.length);
        const decrypted = decryptF7(encodedString);
        if (decrypted) {
          return processDecryptedData(decrypted, url);
        }
      }
    }
    
    // Buscar en cualquier script que contenga datos
    const allScripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
    for (let i = 0; i < allScripts.length; i++) {
      const scriptContent = allScripts[i].match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
      if (scriptContent.includes("atob(") && scriptContent.includes("JSON.parse")) {
        const jsonMatch = scriptContent.match(/atob\('([^']+)'\)/);
        if (jsonMatch) {
          const encodedString = jsonMatch[1];
          console.log("[voe] Encontrado JSON en script genérico, encoded length: " + encodedString.length);
          const decrypted = decryptF7(encodedString);
          if (decrypted) {
            return processDecryptedData(decrypted, url);
          }
        }
      }
    }
    
    return [];
  }

  const rawJsonBlock = scriptMatch[1].trim();
  const encodedStringM = rawJsonBlock.match(/\["([^"]+)"\]/);
  if (!encodedStringM) {
    console.log("[voe] No se pudo extraer el string del array JSON");
    return [];
  }

  const encodedString = encodedStringM[1];
  console.log("[voe] Encoded string length: " + encodedString.length);

  // 3. Descifrar
  const decrypted = decryptF7(encodedString);
  if (!decrypted) {
    console.log("[voe] Falló el descifrado del JSON");
    return [];
  }

  return processDecryptedData(decrypted, url);
}

// Función auxiliar para procesar datos descifrados
function processDecryptedData(decrypted, url) {
  const results = [];
  const m3u8 = decrypted["source"] || decrypted["file"] || decrypted["hls"];
  const mp4 = decrypted["direct_access_url"] || decrypted["url"] || decrypted["mp4"];
  
  console.log("[voe] Datos descifrados keys: " + Object.keys(decrypted).join(", "));

  if (m3u8) {
    // Es el master m3u8, devolvemos como opción principal
    // El motor de Kazemi se encargará de validar si es HLS
    results.push({
      url: m3u8,
      quality: "Voe:HLS",
      headers: { "Referer": url }
    });
    console.log("[voe] Encontrado HLS: " + m3u8.substring(0, 80));
  }

  if (mp4) {
    results.push({
      url: mp4,
      quality: "Voe:MP4",
      headers: { "Referer": url }
    });
    console.log("[voe] Encontrado MP4: " + mp4.substring(0, 80));
  }

  // Si no encontramos URLs directas, buscar en estructuras anidadas
  if (results.length === 0) {
    // Buscar en arrays o objetos anidados
    const searchInObject = (obj, path = "") => {
      if (typeof obj === "string" && (obj.includes(".m3u8") || obj.includes(".mp4"))) {
        console.log("[voe] Encontrado URL en " + path + ": " + obj.substring(0, 80));
        results.push({
          url: obj,
          quality: "Voe:" + (obj.includes(".m3u8") ? "HLS" : "MP4"),
          headers: { "Referer": url }
        });
      } else if (Array.isArray(obj)) {
        obj.forEach((item, idx) => searchInObject(item, path + "[" + idx + "]"));
      } else if (typeof obj === "object" && obj !== null) {
        Object.keys(obj).forEach(key => searchInObject(obj[key], path + "." + key));
      }
    };
    
    searchInObject(decrypted);
  }

  console.log("[voe] Extraídos " + results.length + " enlaces");
  return results;
}
