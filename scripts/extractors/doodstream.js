// Doodstream Extractor — Kazemi JS
// =========================================================

const EXTRACTOR = {
  id: "doodstream",
  name: "Doodstream",
  version: "1.0.0",
  domains: [
    "doodstream.com",
    "www.doodstream.com",
    "dood.to",
    "dood.wf",
    "dood.ws",
    "dood.pm",
    "dood.cx",
    "dood.sh",
    "dood.la",
    "dood.re",
    "dood.watch",
    "doodstream.co",
    "doodstream.net",
    "dsvplay.com",  // Dominio alternativo visto en logs
    "playmogo.com", // Redirección desde doodstream.com
    "www.playmogo.com",
    "d-s.io"
  ]
};

// ── Helpers ──────────────────────────────────────────────

// Genera una cadena aleatoria para el hash
function createRandomString(length) {
  var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var result = '';
  for (var i = 0; i < length; i++) {
    result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return result;
}

// Extrae el host base de una URL
function getBaseUrl(url) {
  try {
    var match = url.match(/^(https?:\/\/[^\/]+)/);
    return match ? match[1] : "https://doodstream.com";
  } catch(e) {
    return "https://doodstream.com";
  }
}

// Extrae calidad del título de la página
function extractQualityFromTitle(html) {
  var titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (!titleMatch) return null;
  var title = titleMatch[1];
  var qualityMatch = title.match(/\d{3,4}p/i);
  return qualityMatch ? qualityMatch[0] : null;
}

// Busca el patrón /pass_md5/ en el HTML (puede estar en scripts)
function findMd5Path(html) {
  // Primero buscar directamente en el HTML
  var directMatch = html.match(/\/pass_md5\/[^'"]*/);
  if (directMatch) return directMatch[0];
  
  // Buscar en scripts que puedan contener la URL
  var scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  var match;
  while ((match = scriptRegex.exec(html)) !== null) {
    var scriptContent = match[1];
    var scriptMatch = scriptContent.match(/\/pass_md5\/[^'"]*/);
    if (scriptMatch) return scriptMatch[0];
  }
  
  return null;
}

// ── Extractor principal ───────────────────────────────────

function extractVideos(url) {
  console.log("[doodstream] Fetching: " + url);
  
  var headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Referer": "https://doodstream.com/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  };
  
  // Primera petición para obtener el HTML
  var html = http.get(url, headers);
  if (!html || html.length === 0) {
    console.log("[doodstream] HTML vacío o nulo");
    return [];
  }
  
  console.log("[doodstream] HTML length: " + html.length);
  
  // Verificar si la URL se redirigió a playmogo.com
  var actualUrl = url;
  if (url.includes("doodstream.com") && html.includes("playmogo.com")) {
    // Buscar redirección a playmogo en el HTML
    var redirectMatch = html.match(/window\.location\s*=\s*["']([^"']+playmogo[^"']+)["']/i) ||
                       html.match(/<meta[^>]+content=["']\d+;\s*url=([^"']+playmogo[^"']+)["']/i);
    if (redirectMatch) {
      actualUrl = redirectMatch[1];
      if (actualUrl.startsWith("//")) {
        actualUrl = "https:" + actualUrl;
      } else if (actualUrl.startsWith("/")) {
        actualUrl = "https://playmogo.com" + actualUrl;
      }
      console.log("[doodstream] Redirigiendo a: " + actualUrl);
      // Obtener HTML de la URL redirigida
      html = http.get(actualUrl, headers);
      if (!html || html.length === 0) {
        console.log("[doodstream] HTML redirigido vacío");
        return [];
      }
      console.log("[doodstream] HTML redirigido length: " + html.length);
    }
  }
  
  // Verificar si contiene el patrón '/pass_md5/'
  var md5Path = findMd5Path(html);
  if (!md5Path) {
    console.log("[doodstream] No se encontró patrón /pass_md5/ en el HTML");
    // Intentar buscar patrones alternativos
    var alternativeMatch = html.match(/\/pass_md5[^'"]*/);
    if (!alternativeMatch) {
      console.log("[doodstream] No se encontró ningún patrón MD5");
      // Buscar en scripts más complejos
      var scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      var match;
      while ((match = scriptRegex.exec(html)) !== null) {
        var scriptContent = match[1];
        // Buscar patrones como '/d/' o '/e/' que puedan contener el token
        var tokenMatch = scriptContent.match(/['"](?:\/d\/|\/e\/)([^'"\/]+)['"]/);
        if (tokenMatch) {
          var token = tokenMatch[1];
          console.log("[doodstream] Token encontrado en script: " + token);
          // Construir URL MD5 manualmente
          md5Path = "/pass_md5/" + token;
          break;
        }
      }
      if (!md5Path) {
        return [];
      }
    } else {
      md5Path = alternativeMatch[0];
    }
  }
  
  // Extraer calidad del título
  var extractedQuality = extractQualityFromTitle(html);
  var quality = "Doodstream - " + (extractedQuality || "HD");
  console.log("[doodstream] Calidad detectada: " + quality);
  
  var doodHost = getBaseUrl(actualUrl);
  var md5Url = doodHost + md5Path;
  var token = md5Path.substring(md5Path.lastIndexOf("/") + 1);
  
  console.log("[doodstream] MD5 URL: " + md5Url);
  console.log("[doodstream] Token: " + token);
  
  // Hacer la petición al endpoint MD5
  var md5Headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Referer": actualUrl,
    "Accept": "*/*",
    "Origin": doodHost
  };
  
  var videoUrlStart = http.get(md5Url, md5Headers);
  if (!videoUrlStart || videoUrlStart.length === 0) {
    console.log("[doodstream] Respuesta MD5 vacía");
    return [];
  }
  
  // Limpiar la respuesta (puede contener espacios o saltos de línea)
  videoUrlStart = videoUrlStart.trim();
  console.log("[doodstream] Respuesta MD5 (limpia): " + videoUrlStart);
  
  // Verificar que la respuesta sea una URL válida
  if (!videoUrlStart.startsWith("http")) {
    console.log("[doodstream] Respuesta MD5 no parece una URL válida: " + videoUrlStart);
    return [];
  }
  
  // Generar componentes para la URL final
  var randomString = createRandomString(10);
  var expiry = Date.now();
  
  // Construir URL final del video
  var videoUrl = videoUrlStart + randomString + "?token=" + token + "&expiry=" + expiry;
  console.log("[doodstream] URL del video construida: " + videoUrl);
  
  // Headers finales para reproducción
  var finalHeaders = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Referer": doodHost + "/",
    "Accept": "*/*",
    "Origin": doodHost
  };
  
  return [{
    url: videoUrl,
    quality: quality,
    headers: finalHeaders
  }];
}
