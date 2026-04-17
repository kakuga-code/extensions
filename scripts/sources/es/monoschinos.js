// MonosChinos2 — Extensión Kazemi JS
// =========================================================
// Sitio: https://vww.monoschinos2.net

const SOURCE = {
  id: "monoschinos",
  name: "MonosChinos",
  baseUrl: "https://vww.monoschinos2.net",
  language: "es",
  version: "1.0.2",
  iconUrl: "https://vww.monoschinos2.net/favicon.ico",
  contentKind: "anime",
  extractorRepositoryUrl: "https://raw.githubusercontent.com/kakuga-code/extensions/refs/heads/main/repo-extractores.json",
  supportsPopular: false,
  supportedTypes: ["anime", "audio-japones", "corto", "donghua", "especial", "ona", "ova", "pelicula", "pelicula-1080p", "sin-censura", "tv"],
  filters: [
    {
      name: "genre",
      options: [
        { id: "accion",                label: "Acción" },
        { id: "aenime",                label: "Aenime" },
        { id: "anime-latino",          label: "Anime Latino" },
        { id: "artes-marciales",       label: "Artes Marciales" },
        { id: "aventura",              label: "Aventura" },
        { id: "aventuras",             label: "Aventuras" },
        { id: "blu-ray",               label: "Blu-ray" },
        { id: "carreras",              label: "Carreras" },
        { id: "castellano",            label: "Castellano" },
        { id: "ciencia-ficcion",       label: "Ciencia Ficción" },
        { id: "comedia",               label: "Comedia" },
        { id: "comida",                label: "Comida" },
        { id: "cyberpunk",             label: "Cyberpunk" },
        { id: "demencia",              label: "Demencia" },
        { id: "dementia",              label: "Dementia" },
        { id: "demonios",              label: "Demonios" },
        { id: "deportes",              label: "Deportes" },
        { id: "drama",                 label: "Drama" },
        { id: "ecchi",                 label: "Ecchi" },
        { id: "escolares",             label: "Escolares" },
        { id: "escuela",               label: "Escuela" },
        { id: "espacial",              label: "Espacial" },
        { id: "fantasia",              label: "Fantasía" },
        { id: "gore",                  label: "Gore" },
        { id: "harem",                 label: "Harem" },
        { id: "historia-paralela",     label: "Historia paralela" },
        { id: "historico",             label: "Histórico" },
        { id: "horror",                label: "Horror" },
        { id: "infantil",              label: "Infantil" },
        { id: "josei",                 label: "Josei" },
        { id: "juegos",                label: "Juegos" },
        { id: "latino",                label: "Latino" },
        { id: "lucha",                 label: "Lucha" },
        { id: "magia",                 label: "Magia" },
        { id: "mecha",                 label: "Mecha" },
        { id: "militar",               label: "Militar" },
        { id: "misterio",              label: "Misterio" },
        { id: "monogatari",            label: "Monogatari" },
        { id: "musica",                label: "Música" },
        { id: "parodia",               label: "Parodia" },
        { id: "parodias",              label: "Parodias" },
        { id: "policia",               label: "Policía" },
        { id: "psicologico",           label: "Psicológico" },
        { id: "recuentos-de-la-vida",  label: "Recuentos de la vida" },
        { id: "recuerdos-de-la-vida",  label: "Recuerdos de la vida" },
        { id: "romance",               label: "Romance" },
        { id: "samurai",               label: "Samurai" },
        { id: "seinen",                label: "Seinen" },
        { id: "shojo",                 label: "Shojo" },
        { id: "shonen",                label: "Shonen" },
        { id: "shoujo",                label: "Shoujo" },
        { id: "shounen",               label: "Shounen" },
        { id: "shounen-ai",            label: "Shounen Ai" },
        { id: "sobrenatural",          label: "Sobrenatural" },
        { id: "superpoderes",          label: "Superpoderes" },
        { id: "suspenso",              label: "Suspenso" },
        { id: "terror",                label: "Terror" },
        { id: "vampiros",              label: "Vampiros" },
        { id: "yaoi",                  label: "Yaoi" },
        { id: "yuri",                  label: "Yuri" }
      ]
    },
    {
      name: "type",
      options: [
        { id: "anime",       label: "Anime" },
        { id: "audio-japones", label: "Audio Japonés" },
        { id: "corto",       label: "Corto" },
        { id: "donghua",     label: "Donghua" },
        { id: "especial",    label: "Especial" },
        { id: "ona",         label: "ONA" },
        { id: "ova",         label: "OVA" },
        { id: "pelicula",    label: "Película" },
        { id: "pelicula-1080p", label: "Película 1080p" },
        { id: "sin-censura", label: "Sin Censura" },
        { id: "tv",          label: "TV" }
      ]
    },
    {
      name: "status",
      options: [
        { id: "",             label: "Todos" },
        { id: "en-emision",   label: "En emisión" },
        { id: "finalizado",   label: "Finalizado" }
      ]
    },
    {
      name: "order",
      options: [
        { id: "desc", label: "Descendente" },
        { id: "asc",  label: "Ascendente" }
      ]
    }
  ]
};

const AJAX_HEADERS = {
  "accept": "application/json, text/javascript, */*; q=0.01",
  "accept-language": "es-419,es;q=0.8",
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
  "origin": SOURCE.baseUrl,
  "x-requested-with": "XMLHttpRequest"
};

// Servidores no soportados por el extractor nativo
const DISABLED_SERVERS = ["mega", "mega.nz", "mediafire", "zippyshare", "1fichier", "filemoon", "FILEMOON"];

// ── Helpers ──────────────────────────────────────────────

function encodeFormBody(params) {
  return Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
  }).join("&");
}

/**
 * Base64 decode — usa atob si está disponible (JavaScriptCore lo tiene).
 * Fallback manual si no existe.
 */
function b64Decode(str) {
  try {
    if (typeof atob === "function") return atob(str);
  } catch (e) {}
  // Fallback tabla manual
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  var output = "";
  var buf = 0, bits = 0;
  for (var i = 0; i < str.length; i++) {
    var c = chars.indexOf(str.charAt(i));
    if (c === 64) break;
    if (c === -1) continue;
    buf = (buf << 6) | c;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buf >> bits) & 0xFF);
    }
  }
  return output;
}

/**
 * Extrae atributo de imagen priorizando: data-src → data-lazy-src → srcset → src
 */
function getImageSrc(html, baseUrl) {
  var m = html.match(/data-src="([^"]+)"/);
  if (!m) m = html.match(/data-lazy-src="([^"]+)"/);
  if (!m) m = html.match(/srcset="([^ "]+)/);
  if (!m) m = html.match(/src="([^"]+)"/);
  if (!m) return null;
  var u = m[1];
  if (u.indexOf("anime.png") !== -1) return null;
  return u.startsWith("http") ? u : (baseUrl + u);
}

function normalizePath(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url.replace(SOURCE.baseUrl, "");
  if (url.startsWith("./")) return "/" + url.slice(2);
  return url.startsWith("/") ? url : ("/" + url);
}

function buildAbsoluteUrl(url) {
  if (!url) return SOURCE.baseUrl;
  return url.startsWith("http") ? url : (SOURCE.baseUrl + normalizePath(url));
}

function decodeHtmlEntities(text) {
  if (!text) return "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&Ntilde;/g, "Ñ")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&Aacute;/g, "Á")
    .replace(/&Eacute;/g, "É")
    .replace(/&Iacute;/g, "Í")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&Uacute;/g, "Ú")
    .replace(/&uuml;/g, "ü")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&nbsp;/g, " ");
}

function cleanText(text) {
  return decodeHtmlEntities((text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizeTypeLabel(rawType, id) {
  var value = (rawType || "").toLowerCase().trim();
  if (value === "tv" || value === "anime" || value === "serie" || value === "audio japonés" ||
      value === "audio japones" || value === "donghua" || value === "sin censura") return "Serie";
  if (value === "pelicula" || value === "película" || value === "pelicula 1080p" || value === "movie") return "Película";
  if (value === "corto") return "Especial";
  if (value === "ova") return "OVA";
  if (value === "ona") return "ONA";
  if (value === "especial" || value === "special") return "Especial";
  if (id && id.indexOf("/pelicula/") !== -1) return "Película";
  return "Serie";
}

function normalizeStatusLabel(rawStatus) {
  var value = (rawStatus || "").toLowerCase().trim();
  if (!value) return null;
  if (/en\s*emision|emisi[oó]n|ongoing/.test(value)) return "En emisión";
  if (/finalizado|concluido|completed/.test(value)) return "Concluido";
  if (/por\s*estrenar|proximamente|pr[oó]ximamente|upcoming/.test(value)) return "Por estrenar";
  return rawStatus;
}

/**
 * Parsea los items de la grilla `.ficha_efecto a`
 * HTML típico:
 *   <a href="/anime/slug">
 *     <img src="..." />
 *     <span class="title_cap">Título</span>
 *   </a>
 */
function parseAnimeGrid(html) {
  var items = [];
  // Cada entrada es un <a> dentro de .ficha_efecto
  var blockRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  var m;
  while ((m = blockRe.exec(html)) !== null) {
    var href = m[1];
    var inner = m[2];
    var path = normalizePath(href);
    // Solo los que sean rutas de anime
    if (path.indexOf("/anime/") === -1 && path.indexOf("/pelicula/") === -1) continue;
    var titleM = inner.match(/<([a-z0-9]+)[^>]*class="[^"]*\btitle_cap\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/i);
    if (!titleM) continue;
    var title = cleanText(titleM[2]);
    if (!title) continue;
    var cover = getImageSrc(inner, SOURCE.baseUrl);
    var typeM = inner.match(/<span[^>]*class="[^"]*\btext-muted\b[^"]*\bfs-6\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    var type = typeM ? normalizeTypeLabel(cleanText(typeM[1]), path) : null;
    // id = path sin dominio, ej: /anime/naruto-2002
    var id = path;
    items.push({
      id: id,
      slug: id,
      title: title,
      type: type,
      thumbnail: cover,
      pageUrl: buildAbsoluteUrl(href)
    });
  }
  return items;
}

function hasNextPage(html) {
  return /title="Siguiente p[áa]gina"/i.test(html) ||
         /rel="next"/i.test(html) ||
         /[?&]pag=\d+[^"]*["'][^>]*>\s*(?:Siguiente|›|»)/i.test(html) ||
         /class="[^"]*\bpage-link\b[^"]*"[^>]+href="[^"]*[?&]pag=\d+[^"]*"/i.test(html);
}

// ── Catálogo ─────────────────────────────────────────────

function fetchPopular(page) {
  var url = SOURCE.baseUrl + "/animes?pag=" + page;
  try {
    var html = http.get(url);
    return { items: parseAnimeGrid(html), hasNextPage: hasNextPage(html) };
  } catch (e) {
    console.log("[monoschinos] fetchPopular error: " + e);
    return { items: [], hasNextPage: false };
  }
}

function fetchLatest(page) {
  var url = SOURCE.baseUrl + "/animes?estado=en+emision&pag=" + page;
  try {
    var html = http.get(url);
    return { items: parseAnimeGrid(html), hasNextPage: hasNextPage(html) };
  } catch (e) {
    console.log("[monoschinos] fetchLatest error: " + e);
    return { items: [], hasNextPage: false };
  }
}

function fetchSearch(query, page, filters) {
  var url;
  var hasQuery = query && query.trim().length > 0;
  if (hasQuery) {
    url = SOURCE.baseUrl + "/animes?buscar=" + encodeURIComponent(query.trim()) + "&pag=" + page;
  } else {
    var params = "pag=" + page;
    if (filters) {
      if (filters.genre)  params += "&genero=" + encodeURIComponent(filters.genre);
      if (filters.type)   params += "&tipo="   + encodeURIComponent(filters.type);
      if (filters.status) params += "&estado=" + encodeURIComponent(filters.status);
      if (filters.order)  params += "&orden="  + encodeURIComponent(filters.order);
    }
    url = SOURCE.baseUrl + "/animes?" + params;
  }
  console.log("[monoschinos] fetchSearch url=" + url);
  try {
    var html = http.get(url);
    return { items: parseAnimeGrid(html), hasNextPage: hasNextPage(html) };
  } catch (e) {
    console.log("[monoschinos] fetchSearch error: " + e);
    return { items: [], hasNextPage: false };
  }
}

// ── Detalle del anime ─────────────────────────────────────

function fetchItemDetails(id) {
  // id puede ser "/anime/slug" o "/pelicula/slug"
  var url = id.startsWith("http") ? id : (SOURCE.baseUrl + id);
  try {
    var html = http.get(url);

    // Título: <h1 class="... text-capitalize ...">Título</h1>
    var titleM = html.match(/<h1[^>]*class="[^"]*text-capitalize[^"]*"[^>]*>([\s\S]*?)<\/h1>/);
    var title = titleM ? cleanText(titleM[1]) : id;

    // Sinopsis: <p> dentro de .mb-3
    var synM = html.match(/class="[^"]*mb-3[^"]*"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/);
    var synopsis = synM ? cleanText(synM[1]) : "";

    // Portada: img dentro de .gap-3
    var coverBlockM = html.match(/class="[^"]*gap-3[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    var cover = coverBlockM ? getImageSrc(coverBlockM[1], SOURCE.baseUrl) : null;
    if (!cover) {
      var ogM = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
      if (!ogM) ogM = html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/);
      if (ogM) cover = ogM[1];
    }

    // Géneros: <span> dentro de .lh-lg
    var genres = [];
    var genreBlockM = html.match(/class="[^"]*lh-lg[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (genreBlockM) {
      var spanRe = /<span[^>]*>([\s\S]*?)<\/span>/g;
      var sm;
      while ((sm = spanRe.exec(genreBlockM[1])) !== null) {
        var g = cleanText(sm[1]);
        if (g) genres.push(g);
      }
    }

    // Tipo: bloque principal de información, ej. <dt>Tipo:</dt><dd>Anime</dd>
    var type = null;
    var typeM = html.match(/<dt>\s*Tipo:\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i);
    if (!typeM) typeM = html.match(/<span[^>]*class="badge[^"]*"[^>]*>\s*(Anime|OVA|ONA|Pel[ií]cula|Especial|TV)\s*<\/span>/i);
    if (typeM) type = normalizeTypeLabel(cleanText(typeM[1]), id);
    else type = normalizeTypeLabel("", id);

    // Estado: tarjeta visible "Estado" -> siguiente div con el valor
    var status = null;
    var statusCardRe = /<div[^>]*class="[^"]*ms-2[^"]*"[^>]*>\s*<div[^>]*class="[^"]*text-muted[^"]*"[^>]*>\s*([^<]+)\s*<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    var stm;
    while ((stm = statusCardRe.exec(html)) !== null) {
      var label = cleanText(stm[1]).toLowerCase();
      if (label.indexOf("estado") !== -1) {
        status = normalizeStatusLabel(cleanText(stm[2]));
        break;
      }
    }
    if (!status) {
      var statusM = html.match(/Estado[\s\S]*?<div[^>]*>\s*(En emision|En emisión|Finalizado|Concluido|Por estrenar)\s*<\/div>/i);
      if (statusM) status = normalizeStatusLabel(cleanText(statusM[1]));
    }

    return {
      title: title,
      synopsis: synopsis,
      cover: cover,
      genres: genres,
      type: type,
      status: status,
      related: []
    };
  } catch (e) {
    console.log("[monoschinos] fetchItemDetails error: " + e);
    return { title: id, synopsis: "Error al cargar detalles." };
  }
}

// ── Lista de episodios ────────────────────────────────────

function fetchChildren(itemId) {
  var url = itemId.startsWith("http") ? itemId : (SOURCE.baseUrl + itemId);
  try {
    var html = http.get(url);

    // <div id="dt" data-e="TOTAL" data-i="I" data-u="U">
    var dtM = html.match(/<[^>]+id="dt"[^>]+>/);
    if (!dtM) {
      console.log("[monoschinos] fetchChildren: no #dt found at " + url);
      return [];
    }
    var dtTag = dtM[0];
    var totalM = dtTag.match(/data-e="(\d+)"/);
    var iM     = dtTag.match(/data-i="([^"]+)"/);
    var uM     = dtTag.match(/data-u="([^"]+)"/);
    if (!totalM || !iM || !uM) {
      console.log("[monoschinos] fetchChildren: missing dt attributes");
      return [];
    }

    var total   = parseInt(totalM[1], 10);
    var dataI   = iM[1];
    var dataU   = uM[1];
    var perPage = 50;
    var pages   = Math.ceil(total / perPage);

    var episodes = [];
    for (var p = 1; p <= pages; p++) {
      var body = encodeFormBody({ acc: "episodes", i: dataI, u: dataU, p: String(p) });
      var refHeaders = Object.assign({}, AJAX_HEADERS, { "referer": url });
      var resp = http.post(SOURCE.baseUrl + "/ajax_pagination", body, refHeaders);
      var eps = parseEpisodes(resp);
      for (var j = 0; j < eps.length; j++) episodes.push(eps[j]);
    }

    // Orden ascendente por número
    episodes.sort(function (a, b) { return a.number - b.number; });
    return episodes;
  } catch (e) {
    console.log("[monoschinos] fetchChildren error: " + e);
    return [];
  }
}

/**
 * Parsea la respuesta AJAX de episodios.
 * Cada episodio: <a class="ko" href="/ver/slug-NUM">
 *   <h2>... Capítulo NUM ...</h2>
 *   <span class="fs-6">Nombre</span>
 * </a>
 */
function parseEpisodes(html) {
  var results = [];
  var epRe = /<a[^>]+class="[^"]*\bko\b[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  var m;
  while ((m = epRe.exec(html)) !== null) {
    var href  = m[1];
    var inner = m[2];
    var numM  = inner.match(/Cap[íi]tulo\s+([\d.]+)/i);
    var nameM = inner.match(/class="[^"]*fs-6[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    var epNum = numM ? parseFloat(numM[1]) : 0;
    var epName = nameM ? nameM[1].replace(/<[^>]+>/g, "").trim() : ("Episodio " + epNum);
    var id = normalizePath(href);
    results.push({
      id: id,
      number: epNum,
      title: epName,
      pageUrl: buildAbsoluteUrl(href)
    });
  }
  return results;
}

// ── Lista de videos ───────────────────────────────────────

function fetchVideoList(episodeId) {
  var url = episodeId.startsWith("http") ? episodeId : (SOURCE.baseUrl + episodeId);
  try {
    var html = http.get(url);

    // <div class="opt" data-encrypt="BASE64_VALUE">
    var encM = html.match(/class="[^"]*\bopt\b[^"]*"[^>]+data-encrypt="([^"]+)"/);
    if (!encM) {
      console.log("[monoschinos] fetchVideoList: no .opt[data-encrypt] at " + url);
      return [];
    }
    var encryptVal = encM[1];

    var body = encodeFormBody({ acc: "opt", i: encryptVal });
    var refHeaders = Object.assign({}, AJAX_HEADERS, { "referer": url });
    var serverHtml = http.post(SOURCE.baseUrl + "/ajax_pagination", body, refHeaders);

    // Cada opción: <... data-player="BASE64_ENCODED_URL" ...>
    var results = [];
    var playerRe = /data-player="([^"]+)"/g;
    var pm;
    while ((pm = playerRe.exec(serverHtml)) !== null) {
      var encoded = pm[1];
      var decoded;
      try { decoded = b64Decode(encoded); } catch (e) { continue; }
      if (!decoded || decoded.length < 4) continue;
      var serverName = detectServer(decoded);
      if (DISABLED_SERVERS.indexOf(serverName.toLowerCase()) !== -1) continue;
      results.push({
        url: decoded,
        server: serverName,
        quality: serverName
      });
    }
    console.log("[monoschinos] fetchVideoList: " + results.length + " videos en " + url);
    return results;
  } catch (e) {
    console.log("[monoschinos] fetchVideoList error: " + e);
    return [];
  }
}

function detectServer(url) {
  var u = url.toLowerCase();
  if (u.indexOf("voe") !== -1)                         return "Voe";
  if (u.indexOf("uqload") !== -1)                      return "Uqload";
  if (u.indexOf("ok.ru") !== -1 || u.indexOf("okru") !== -1) return "Okru";
  if (u.indexOf("filemoon") !== -1 || u.indexOf("moonplayer") !== -1 ||
      u.indexOf("bysejikuar") !== -1 || u.indexOf("bysesukior") !== -1 ||
      u.indexOf("kerapoxy") !== -1 ||
      u.indexOf("minochinos") !== -1 || u.indexOf("hanerix") !== -1 ||
      u.indexOf("filel") !== -1)                                       return "Filemoon";
  if (u.indexOf("wishembed") !== -1 || u.indexOf("streamwish") !== -1 ||
      u.indexOf("strwish") !== -1 || u.indexOf("wishfast") !== -1 ||
      u.indexOf("sfastwish") !== -1 || u.indexOf("dhcplay") !== -1)   return "StreamWish";
  if (u.indexOf("streamtape") !== -1 || u.indexOf("stape") !== -1)    return "StreamTape";
  if (u.indexOf("doodstream") !== -1 || u.indexOf("dood.") !== -1 ||
      u.indexOf("ds2play") !== -1 || u.indexOf("doods.") !== -1)      return "DoodStream";
  if (u.indexOf("filelions") !== -1 || u.indexOf("lion") !== -1)      return "FileLions";
  if (u.indexOf("mp4upload") !== -1)                                   return "Mp4Upload";
  if (u.indexOf("mixdrop") !== -1)                                     return "MixDrop";
  return "Externo";
}
