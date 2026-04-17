// AnimeFLV — Extensión Kazemi JS
// =========================================================

const SOURCE = {
  id: "animeflv",
  name: "AnimeFLV",
  baseUrl: "https://www4.animeflv.net",
  language: "es",
  version: "1.1.1",
  iconUrl: "https://www3.animeflv.net/favicon.ico",
  contentKind: "anime",
  extractorRepositoryUrl: "https://raw.githubusercontent.com/kakuga-code/extensions/refs/heads/main/repo-extractores.json",
  supportedTypes: ["tv", "movie", "special", "ova"],
  nativeSortCriteria: ["rating", "updated", "added", "title"],
  filters: [
    {
      name: "genre",
      options: [
        { id: "accion",              label: "Acción" },
        { id: "artes-marciales",     label: "Artes Marciales" },
        { id: "aventura",            label: "Aventuras" },
        { id: "carreras",            label: "Carreras" },
        { id: "ciencia-ficcion",     label: "Ciencia Ficción" },
        { id: "comedia",             label: "Comedia" },
        { id: "demencia",            label: "Demencia" },
        { id: "demonios",            label: "Demonios" },
        { id: "deportes",            label: "Deportes" },
        { id: "drama",               label: "Drama" },
        { id: "ecchi",               label: "Ecchi" },
        { id: "escolares",           label: "Escolares" },
        { id: "espacial",            label: "Espacial" },
        { id: "fantasia",            label: "Fantasía" },
        { id: "harem",               label: "Harem" },
        { id: "historico",           label: "Histórico" },
        { id: "infantil",            label: "Infantil" },
        { id: "josei",               label: "Josei" },
        { id: "juegos",              label: "Juegos" },
        { id: "magia",               label: "Magia" },
        { id: "mecha",               label: "Mecha" },
        { id: "militar",             label: "Militar" },
        { id: "misterio",            label: "Misterio" },
        { id: "musica",              label: "Música" },
        { id: "parodia",             label: "Parodia" },
        { id: "policia",             label: "Policía" },
        { id: "psicologico",         label: "Psicológico" },
        { id: "recuentos-de-la-vida",label: "Recuentos de la vida" },
        { id: "romance",             label: "Romance" },
        { id: "samurai",             label: "Samurai" },
        { id: "seinen",              label: "Seinen" },
        { id: "shoujo",              label: "Shoujo" },
        { id: "shounen",             label: "Shounen" },
        { id: "sobrenatural",        label: "Sobrenatural" },
        { id: "superpoderes",        label: "Superpoderes" },
        { id: "suspenso",            label: "Suspenso" },
        { id: "terror",              label: "Terror" },
        { id: "vampiros",            label: "Vampiros" },
        { id: "yaoi",                label: "Yaoi" },
        { id: "yuri",                label: "Yuri" }
      ]
    },
    {
      name: "type",
      options: [
        { id: "tv",      label: "TV" },
        { id: "movie",   label: "Película" },
        { id: "special", label: "Especial" },
        { id: "ova",     label: "OVA" }
      ]
    },
    {
      name: "order",
      options: [
        { id: "rating",  label: "Calificación" },
        { id: "updated", label: "Recientemente actualizados" },
        { id: "added",   label: "Recientemente agregados" },
        { id: "title",   label: "Nombre A-Z" }
      ]
    }
  ]
};

// Servidores que requieren extractor externo y no pueden reproducirse directamente
const DISABLED_SERVERS = [
  "netu", "mega", "mega.nz", "mediafire", "zippyshare", "1fichier",
  "filemoon", "fmoon", "moon"
];

// ── Helpers ──────────────────────────────────────────────

function decodeHtml(html) {
  if (!html) return "";
  return html
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, function(_, dec) { return String.fromCharCode(dec); })
    .replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ").replace(/&iexcl;/g, "¡").replace(/&iquest;/g, "¿")
    .replace(/&Aacute;/g, "Á").replace(/&Eacute;/g, "É").replace(/&Iacute;/g, "Í").replace(/&Oacute;/g, "Ó").replace(/&Uacute;/g, "Ú")
    .replace(/&Ntilde;/g, "Ñ");
}

function parseAnimeItems(html, sourceBase) {
  const items = [];
  // www4: <article class="Anime alt B"> o <article class="Anime ...">
  const articleRe = /<article[^>]*class="Anime[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
  let m;
  while ((m = articleRe.exec(html)) !== null) {
    const block = m[1];
    const slugM  = block.match(/href="\/anime\/([^"?#]+)"/);
    const titleM = block.match(/<h3[^>]*class="Title"[^>]*>([\s\S]*?)<\/h3>/);
    const coverM = block.match(/<img[^>]+src="([^"]+)"/);
    const typeM  = block.match(/<span[^>]*class="Type[^"]*"[^>]*>([^<]+)<\/span>/);
    if (!slugM || !titleM) continue;

    const slug  = slugM[1].trim();
    const title = decodeHtml(titleM[1].replace(/<[^>]+>/g, "").trim());
    const rawCover = coverM ? coverM[1] : null;
    const cover = rawCover
      ? (rawCover.startsWith("http") ? rawCover : sourceBase + rawCover)
      : null;

    // Tipo: solo si está explícitamente en el HTML
    let type = typeM ? typeM[1].trim() : null;
    if (type) {
      const lowerType = type.toLowerCase();
      if (lowerType === "tv" || lowerType === "anime") {
        type = "Serie";
      } else if (lowerType === "movie" || lowerType === "película" || lowerType === "pelicula") {
        type = "Película";
      } else if (lowerType === "ova") {
        type = "OVA";
      } else if (lowerType === "ona") {
        continue; // Skip ONA items
      } else if (lowerType === "special" || lowerType === "especial") {
        type = "Especial";
      }
    }

    items.push({
      id: slug,
      slug: slug,
      title: title,
      thumbnail: cover,
      type: type,
      genres: [],           // Genres only available in detail view
      status: null,         // Status only available in detail view
      pageUrl: sourceBase + "/anime/" + slug
    });
  }
  return items;
}

function hasNextPage(html) {
  return html.includes('rel="next"') || html.includes("»");
}

// Extrae el bloque JSON de `var videos = {...}` de forma robusta
// buscando llaves balanceadas en lugar de un regex simple
function extractVideosJSON(html) {
  const marker = "var videos = ";
  const start = html.indexOf(marker);
  if (start === -1) return null;
  let i = start + marker.length;
  if (html[i] !== "{") return null;
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (; i < html.length; i++) {
    const c = html[i];
    if (escape) { escape = false; continue; }
    if (c === "\\" && inStr) { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return html.substring(start + marker.length, i + 1);
    }
  }
  return null;
}

// ── Catalog ───────────────────────────────────────────────

function fetchPopular(page) {
  const html = http.get(SOURCE.baseUrl + "/browse?order=rating&page=" + page);
  return {
    items: parseAnimeItems(html, SOURCE.baseUrl),
    hasNextPage: hasNextPage(html)
  };
}

function fetchLatest(page) {
  const html = http.get(SOURCE.baseUrl + "/browse?order=added&page=" + page);
  return {
    items: parseAnimeItems(html, SOURCE.baseUrl),
    hasNextPage: hasNextPage(html)
  };
}

// Géneros canónicos (inglés) → slugs de AnimeFLV (español)
// Slugs exactos de AnimeFLV: https://www4.animeflv.net/browse
var GENRE_MAP_FLV = {
  "action":"accion",
  "adventure":"aventura",
  "cars":"carreras",
  "comedy":"comedia",
  "dementia":"demencia",
  "demons":"demonios",
  "drama":"drama",
  "ecchi":"ecchi",
  "fantasy":"fantasia",
  "game":"juegos",
  "harem":"harem",
  "historical":"historico",
  "horror":"terror",
  "josei":"josei",
  "kids":"infantil",
  "magic":"magia",
  "martial-arts":"artes-marciales",
  "mecha":"mecha",
  "military":"militar",
  "music":"musica",
  "mystery":"misterio",
  "parody":"parodia",
  "police":"policia",
  "psychological":"psicologico",
  "romance":"romance",
  "samurai":"samurai",
  "school":"escolares",
  "sci-fi":"ciencia-ficcion",
  "seinen":"seinen",
  "shoujo":"shoujo",
  "shounen":"shounen",
  "slice-of-life":"recuentos-de-la-vida",
  "space":"espacial",
  "sports":"deportes",
  "super-power":"superpoderes",
  "supernatural":"sobrenatural",
  "thriller":"suspenso",
  "vampire":"vampiros",
  "yaoi":"yaoi",
  "yuri":"yuri"
};

function fetchSearch(query, page, filters) {
  var params = "page=" + page;
  if (query && query.trim().length > 0) params += "&q=" + encodeURIComponent(query.trim());
  if (filters) {
    var genre = filters.genre ? (GENRE_MAP_FLV[filters.genre] || filters.genre) : "";
    if (genre)        params += "&genre[]=" + encodeURIComponent(genre);
    if (filters.type) params += "&type[]="  + encodeURIComponent(filters.type);
    if (filters.order) params += "&order="  + encodeURIComponent(filters.order);
  }
  const url = SOURCE.baseUrl + "/browse?" + params;
  console.log("[animeflv] fetchSearch url=" + url);
  const html = http.get(url);
  console.log("[animeflv] fetchSearch html len=" + (html ? html.length : 0));
  const items = parseAnimeItems(html, SOURCE.baseUrl);
  console.log("[animeflv] fetchSearch items=" + items.length);
  return {
    items: items,
    hasNextPage: hasNextPage(html)
  };
}

// ── Anime Detail ──────────────────────────────────────────

function fetchItemDetails(id) {
  const html = http.get(SOURCE.baseUrl + "/anime/" + id);
  const titleM = html.match(/<h1[^>]*class="[^"]*Title[^"]*"[^>]*>(.*?)<\/h1>/);
  const synopsisM = html.match(/<div[^>]*class="[^"]*Description[^"]*"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/);
  const coverM = html.match(/<div[^>]*class="[^"]*AnimeCover[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/);
  const typeM = html.match(/<span\s+class="Type[^"]*">([^<]+)<\/span>/i);
  const statusM = html.match(/<p\s+class="AnmStts">[\s\S]*?<span[^>]*>([^<]+)<\/span><\/p>/i);

  const genres = [];
  const genreRe = /\/browse\?genre[^"]*">([^<]+)<\/a>/g;
  let gm;
  while ((gm = genreRe.exec(html)) !== null) {
    genres.push(decodeHtml(gm[1].trim()));
  }

  const rawCover = coverM ? coverM[1] : null;
  const cover = rawCover
    ? (rawCover.startsWith("http") ? rawCover : SOURCE.baseUrl + rawCover)
    : null;

  let type = typeM ? decodeHtml(typeM[1].trim()) : "Anime";
  // Normalizar a tipos en español
  const lowerType = type.toLowerCase();
  if (lowerType === "tv" || lowerType === "anime") {
    type = "Serie";
  } else if (lowerType === "movie" || lowerType === "película" || lowerType === "pelicula") {
    type = "Película";
  } else if (lowerType === "ova") {
    type = "OVA";
  } else if (lowerType === "special" || lowerType === "especial") {
    type = "Especial";
  } else if (lowerType === "ona") {
    type = "ONA";
  } else {
    type = "Desconocido";
  }

  // ── Relacionados ──────────────────────────────────────────
  // Estructura: <ul class="ListAnmRel"><li ...><a href="/anime/slug">Título</a> (Relación)</li></ul>
  const related = [];
  const relBlockM = html.match(/<ul[^>]*class="ListAnmRel"[^>]*>([\s\S]*?)<\/ul>/);
  if (relBlockM) {
    const relRe = /<li[^>]*>\s*<a[^>]+href="\/anime\/([^"]+)"[^>]*>([^<]+)<\/a>\s*\(([^)]+)\)/g;
    let rm;
    while ((rm = relRe.exec(relBlockM[1])) !== null) {
      const slug = rm[1].trim();
      const title = decodeHtml(rm[2].trim());
      const relation = decodeHtml(rm[3].trim());
      // Obtener portada: hacer fetch del og:image de la página del relacionado
      var relCover = null;
      try {
        const relHtml = http.get(SOURCE.baseUrl + "/anime/" + slug);
        const ogM = relHtml.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
        if (ogM) relCover = ogM[1];
      } catch(e) {}
      related.push({ id: slug, title: title, relation: relation, cover: relCover });
    }
  }

  return {
    title: titleM ? decodeHtml(titleM[1].replace(/<[^>]+>/g, "").trim()) : id,
    synopsis: synopsisM ? decodeHtml(synopsisM[1].replace(/<[^>]+>/g, "").trim()) : "",
    cover: cover,
    pageUrl: "https://animeflv.net/anime/" + id,
    genres: genres,
    type: type,
    status: statusM ? decodeHtml(statusM[1].trim()) : null,
    related: related
  };
}

// ── Episode List ──────────────────────────────────────────

function fetchChildren(itemId) {
  const animeId = itemId;
  const html = http.get(SOURCE.baseUrl + "/anime/" + animeId);
  const m = html.match(/var episodes\s*=\s*(\[\[[\s\S]*?\]\]);/);
  if (!m) return [];

  let arr;
  try { arr = JSON.parse(m[1]); } catch(e) { return []; }

  return arr.map(function(ep) {
    const num = ep[0];
    // URL real de AnimeFLV: /ver/slug-numero
    const verSlug = animeId + "-" + num;
    return {
      id: verSlug,
      number: parseInt(num, 10),
      title: "Episodio " + num,
      pageUrl: SOURCE.baseUrl + "/ver/" + verSlug
    };
  }).reverse(); // orden ascendente
}

// ── Video List ────────────────────────────────────────────

function fetchVideoList(episodeId) {
  // episodeId puede llegar como "slug-num" o "slug/num" — normalizar a "slug-num"
  const normalizedId = episodeId.replace(/\/(\d+)$/, "-$1");
  const html = http.get(SOURCE.baseUrl + "/ver/" + normalizedId);

  const jsonStr = extractVideosJSON(html);
  if (!jsonStr) {
    console.log("[animeflv] No se encontró var videos en: " + SOURCE.baseUrl + "/ver/" + normalizedId);
    return [];
  }

  let videoMap;
  try { videoMap = JSON.parse(jsonStr); } catch(e) {
    console.log("[animeflv] JSON.parse falló en var videos");
    return [];
  }

  console.log("[animeflv] Servidores encontrados: " + Object.keys(videoMap).map(function(lang) {
    return lang + ":" + (Array.isArray(videoMap[lang]) ? videoMap[lang].length : 0);
  }).join(", "));

  const results = [];
  Object.keys(videoMap).forEach(function(lang) {
    const list = videoMap[lang];
    if (!Array.isArray(list)) return;
    list.forEach(function(v) {
      const directUrl = v.url || null;  // URL directa (mp4/m3u8 o embed con extractor)
      const embedUrl = v.code || null;  // URL embed (requiere WebView si no hay extractor)
      if (!directUrl && !embedUrl) return;
      const serverName = (v.server || v.title || "unknown").toLowerCase();
      if (DISABLED_SERVERS.indexOf(serverName) !== -1) return;
      // Si tiene URL directa, usarla como url (el extractor la intentará resolver)
      // Si solo tiene code/embed, marcarlo como embed para WebView fallback
      if (directUrl) {
        results.push({
          url: directUrl,
          server: serverName,
          quality: (lang === "ESP" ? "ESP" : "SUB") + " — " + (v.title || "HD")
        });
      } else {
        results.push({
          embed: embedUrl,
          server: serverName,
          quality: (lang === "ESP" ? "ESP" : "SUB") + " — " + (v.title || "HD")
        });
      }
    });
  });
  return results;
}
