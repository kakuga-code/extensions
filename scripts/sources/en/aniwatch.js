// Aniwatch — Extensión Kazemi JS
// =========================================================

const SOURCE = {
  id: "aniwatch",
  name: "Aniwatch",
  baseUrl: "https://aniwatchtv.to",
  language: "en",
  version: "1.0.0",
  iconUrl: "https://aniwatchtv.to/favicon.ico",
  contentKind: "anime"
};

// ── Tablas de filtros ─────────────
// Géneros: ahora Aniwatch usa slugs de texto directamente (no IDs numéricos)
const GENRE_SLUGS = {
  "action":"action","adventure":"adventure","cars":"cars","comedy":"comedy","dementia":"dementia",
  "demons":"demons","drama":"drama","ecchi":"ecchi","fantasy":"fantasy","game":"game",
  "harem":"harem","historical":"historical","horror":"horror","isekai":"isekai","josei":"josei",
  "kids":"kids","magic":"magic","martial-arts":"marial-arts","mecha":"mecha","military":"military",
  "music":"music","mystery":"mystery","parody":"parody","police":"police","psychological":"psychological",
  "romance":"romance","samurai":"samurai","school":"school","sci-fi":"sci-fi","seinen":"seinen",
  "shoujo":"shoujo","shoujo-ai":"shoujo-ai","shounen":"shounen","shounen-ai":"shounen-ai",
  "slice-of-life":"slice-of-life","space":"space","sports":"sports","super-power":"super-power",
  "supernatural":"supernatural","thriller":"thriller","vampire":"vampire"
};
// Tipos: valores numéricos del <select name="type">
const TYPE_IDS = {
  "movie":"1","tv":"2","ova":"3","ona":"4","special":"5","music":"6"
};
const SORT_IDS = {
  "default":"default","recently_added":"recently_added",
  "recently_updated":"recently_updated","rating":"score",
  "added":"recently_added","title":"name_az"
};

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
    .replace(/&#(\d+);/g, function(match, dec) { return String.fromCharCode(dec); });
}

function parseAnimeItems(html, sourceBase) {
  const items = [];
  if (!html) return [];

  // Cada item: <a class="film-poster-ahref" href="/slug" data-id="N" title="Title">
  // La portada está en el <img data-src="..."> que precede al link en el mismo bloque flw-item
  // Dividimos por flw-item para asociar portada + datos correctamente
  const segments = html.split(/class="[^"]*flw-item[^"]*"/);
  // El primer segmento es antes del primer item, lo ignoramos
  for (var i = 1; i < segments.length; i++) {
    var seg = segments[i];
    // Cortamos al inicio del siguiente flw-item para no mezclar datos
    var nextItemIdx = seg.indexOf('class="flw-item');
    if (nextItemIdx !== -1) seg = seg.substring(0, nextItemIdx);

    // Buscar el bloque del link film-poster-ahref (atributos en cualquier orden)
    var ahrefIdx = seg.indexOf('film-poster-ahref');
    if (ahrefIdx === -1) continue;
    // Retroceder hasta el < del <a
    var aStart = seg.lastIndexOf('<a ', ahrefIdx);
    if (aStart === -1) continue;
    var aEnd = seg.indexOf('>', ahrefIdx);
    if (aEnd === -1) continue;
    var aTag = seg.substring(aStart, aEnd + 1);

    var hrefM  = aTag.match(/href="\/([^"?#]+)/);
    var titleM = aTag.match(/title="([^"]+)"/);
    if (!hrefM || !titleM) continue;

    var slug  = hrefM[1];
    var title = decodeHtml(titleM[1]);
    var coverM = seg.match(/<img[^>]+data-src="([^"]+)"/);
    var cover  = coverM ? coverM[1] : null;
    var jnameM = seg.match(/data-jname="([^"]+)"/);
    var jname  = jnameM ? decodeHtml(jnameM[1]) : null;
    // Tipo: primer span.fdi-item (TV, Movie, OVA, etc.)
    var typeM  = seg.match(/class="fdi-item[^"]*">([^<]+)<\/span>/);
    var itemType = typeM ? typeM[1].trim() : "Anime";

    items.push({
      id: slug,
      slug: slug,
      title: title || jname || slug,
      thumbnail: cover,
      type: itemType,
      pageUrl: sourceBase + "/" + slug
    });
  }

  console.log("[aniwatch] Found " + items.length + " items");
  return items;
}

function hasNextPage(html) {
  return html.includes('title="Next"') || html.includes('page-item') && html.includes('aria-label="Next"');
}

// ── Catalog ───────────────────────────────────────────────

function fetchPopular(page) {
  const url = SOURCE.baseUrl + "/most-popular?page=" + page;
  const html = http.get(url, {
    "Referer": SOURCE.baseUrl + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
  });
  return {
    items: parseAnimeItems(html, SOURCE.baseUrl),
    hasNextPage: hasNextPage(html)
  };
}

function fetchLatest(page) {
  const url = SOURCE.baseUrl + "/recently-updated?page=" + page;
  const html = http.get(url, {
    "Referer": SOURCE.baseUrl + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
  });
  return {
    items: parseAnimeItems(html, SOURCE.baseUrl),
    hasNextPage: hasNextPage(html)
  };
}

function fetchSearch(query, page, filters) {
  let url = SOURCE.baseUrl;
  if (!query || query.trim() === "") {
    // Filtros: géneros usan slugs de texto, tipos usan IDs numéricos
    url += "/filter?page=" + page;
    if (filters) {
      if (filters.genre)  url += "&genres=" + (GENRE_SLUGS[filters.genre] || filters.genre);
      if (filters.type)   url += "&type="   + (TYPE_IDS[filters.type]  || filters.type);
      if (filters.order)  url += "&sort="   + (SORT_IDS[filters.order] || filters.order);
      if (filters.status) url += "&status=" + filters.status;
    }
  } else {
    url += "/search?keyword=" + encodeURIComponent(query.trim()) + "&page=" + page;
  }
  
  console.log("[aniwatch] fetchSearch url=" + url);
  const html = http.get(url, {
    "Referer": SOURCE.baseUrl + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
  });
  return {
    items: parseAnimeItems(html, SOURCE.baseUrl),
    hasNextPage: hasNextPage(html)
  };
}

// ── Anime Detail ──────────────────────────────────────────

function fetchItemDetails(id) {
  // La URL de detalle es /{slug}, no /watch/{slug}
  const html = http.get(SOURCE.baseUrl + "/" + id, {
    "Referer": SOURCE.baseUrl + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
  });

  // Título: buscar data-jname y texto del h1 por separado (atributos en cualquier orden)
  var title = "";
  var jname = null;
  var h1BlockM = html.match(/<h1[^>]*film-name[^>]*>([\s\S]*?)<\/h1>/);
  if (h1BlockM) {
    var h1Tag = h1BlockM[0];
    var jnameM = h1Tag.match(/data-jname="([^"]+)"/);
    if (jnameM) jname = decodeHtml(jnameM[1].trim());
    // El texto visible del h1 (entre las etiquetas, excluyendo sub-tags)
    var textM = h1BlockM[1].replace(/<[^>]+>/g, "").trim();
    if (textM) title = decodeHtml(textM);
  }
  // Fallback: capitalizar el slug
  if (!title) {
    title = id.replace(/-\d+$/, "").replace(/-/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  }

  // Sinopsis: dentro de .film-description > div.text
  const synM = html.match(/class="film-description[\s\S]*?<div[^>]*class="text"[^>]*>([\s\S]*?)<\/div>/);
  const synopsis = synM ? decodeHtml(synM[1].replace(/<[^>]+>/g, "").trim()) : "";

  // Portada: <div class="anisc-poster"><img data-src="..."> (lazy loading)
  const coverM = html.match(/class="anisc-poster"[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"/);
  const cover  = coverM ? coverM[1] : null;

  // Estado: "Airing", "Finished Airing", etc.
  const statusM = html.match(/Status:[\s\S]*?<span[^>]*>([^<]+)<\/span>/);

  // Tipo: "TV", "Movie", "OVA", "ONA", "Special"
  // Estructura: <span class="item head">Type:</span> <span class="name">TV</span>  o  <a ...>TV</a>
  var animeType = null;
  // Buscar el bloque "Type:" y extraer el texto del primer <a> o <span class="name"> que lo sigue
  var typeIdx = html.indexOf(">Type:<");
  if (typeIdx === -1) typeIdx = html.indexOf("Type:</");
  if (typeIdx !== -1) {
    var typeSnippet = html.substring(typeIdx, typeIdx + 400);
    var typeM2 = typeSnippet.match(/<a[^>]*>([^<]{1,30})<\/a>/);
    if (!typeM2) typeM2 = typeSnippet.match(/class="name"[^>]*>([^<]{1,30})<\/span>/);
    if (typeM2) animeType = typeM2[1].trim().toLowerCase();
  }
  console.log("[aniwatch] type extracted: " + animeType);

  // Géneros — deduplicar igual que jkanime
  const genres = [];
  const genreSeen = {};
  const genreRe = /\/genre\/[^"]+">([^<]+)<\/a>/g;
  let gm;
  while ((gm = genreRe.exec(html)) !== null) {
    const g = decodeHtml(gm[1].trim());
    if (!genreSeen[g]) { genreSeen[g] = true; genres.push(g); }
  }

  // Relacionados: bloque "Related Anime" con items film-poster
  const related = [];
  const relIdx = html.indexOf("Related Anime");
  if (relIdx !== -1) {
    // Tomar el bloque hasta el siguiente block_area-header o fin
    var relEnd = html.indexOf("block_area-header", relIdx + 20);
    var relBlock = relEnd !== -1 ? html.substring(relIdx, relEnd) : html.substring(relIdx, relIdx + 8000);
    // Cada item: data-src="cover" ... href="/slug" ... title="Title"
    var relRe = /data-src="([^"]+)"[\s\S]*?href="\/([^"?#]+)"[\s\S]*?title="([^"]+)"/g;
    var rm;
    while ((rm = relRe.exec(relBlock)) !== null) {
      var relSlug = rm[2];
      // Excluir el mismo anime
      if (relSlug === id) continue;
      related.push({ id: relSlug, title: decodeHtml(rm[3].trim()), cover: rm[1] });
    }
  }

  return {
    title: title,
    alternateTitle: jname !== title ? jname : null,
    synopsis: synopsis,
    cover: cover,
    genres: genres,
    status: statusM ? decodeHtml(statusM[1].trim()) : null,
    type: animeType,
    related: related
  };
}

// ── Episode List ──────────────────────────────────────────

function fetchChildren(itemId) {
  const animeId = itemId;
  // Extract numerical id from slug (wa-mo-ki-37 -> 37)
  let numId;
  const idM = animeId.match(/-(\d+)$/);
  if (idM) {
    numId = idM[1];
  } else {
    // Si no esta en el slug, quiza necesitemos cargar la pagina de detalles para encontrar el data-id
    // Pero por ahora intentamos extraerlo de los botones de la pagina si estuvieramos ahi.
    return [];
  }
  
  const url = SOURCE.baseUrl + "/ajax/v2/episode/list/" + numId;
  const resStr = http.get(url, {
    "Referer": SOURCE.baseUrl + "/watch/" + animeId,
    "X-Requested-With": "XMLHttpRequest"
  });
  let res;
  try { res = JSON.parse(resStr); } catch(e) { return []; }
  
  const html = res.html || "";
  const episodes = [];
  // Los atributos del <a ep-item> están en líneas separadas, usamos split por ep-item
  const epSegments = html.split('ep-item');
  for (var ei = 1; ei < epSegments.length; ei++) {
    var epSeg = epSegments[ei];
    var epNextIdx = epSeg.indexOf('ep-item');
    if (epNextIdx !== -1) epSeg = epSeg.substring(0, epNextIdx);
    var epNumM   = epSeg.match(/data-number="([^"]+)"/);
    var epIdM    = epSeg.match(/data-id="([^"]+)"/);
    var epTitleM = epSeg.match(/title="([^"]+)"/);
    if (!epNumM || !epIdM) continue;
    var epId    = epIdM[1];
    var epNum   = parseInt(epNumM[1], 10);
    var epTitle = epTitleM ? decodeHtml(epTitleM[1]) : "Episode " + epNum;
    episodes.push({
      id: epId,
      number: epNum,
      title: epTitle,
      pageUrl: SOURCE.baseUrl + "/watch/" + animeId + "?ep=" + epId
    });
  }
  return episodes; // ya vienen en orden ascendente del servidor
}

// ── Video List ────────────────────────────────────────────

function fetchVideoList(episodeId) {
  // episodeId is the numerical ID from data-id
  const url = SOURCE.baseUrl + "/ajax/v2/episode/servers?episodeId=" + episodeId;
  const resStr = http.get(url, {
    "X-Requested-With": "XMLHttpRequest"
  });
  let res;
  try { res = JSON.parse(resStr); } catch(e) { return []; }
  
  const html = res.html || "";
  const results = [];

  // Atributos multilínea: split por "server-item" y extraer cada atributo por separado
  const srvSegments = html.split('server-item');
  for (var si = 1; si < srvSegments.length; si++) {
    var srvSeg = srvSegments[si];
    var srvNext = srvSeg.indexOf('server-item');
    if (srvNext !== -1) srvSeg = srvSeg.substring(0, srvNext);

    var srvIdM   = srvSeg.match(/data-id="([^"]+)"/);
    var srvTypeM = srvSeg.match(/data-type="([^"]+)"/);
    var srvNameM = srvSeg.match(/<a[^>]*>([^<]+)<\/a>/);
    if (!srvIdM || !srvTypeM || !srvNameM) continue;

    var srvId   = srvIdM[1];
    var srvType = srvTypeM[1];
    var srvName = srvNameM[1].trim();

    var srcStr = http.get(SOURCE.baseUrl + "/ajax/v2/episode/sources?id=" + srvId, {
      "X-Requested-With": "XMLHttpRequest",
      "Referer": SOURCE.baseUrl + "/watch/" + episodeId
    });
    var src;
    try { src = JSON.parse(srcStr); } catch(e) { continue; }
    if (!src.link) continue;

    // Parsear subtítulos externos (VTT) — la API los devuelve en src.tracks
    var subtitles = [];
    if (Array.isArray(src.tracks)) {
      src.tracks.forEach(function(t) {
        if (!t.file || t.kind !== "captions") return;
        subtitles.push({
          url: t.file,
          language: t.label ? t.label.toLowerCase().substring(0, 5) : "und",
          label: t.label || "Unknown",
          isDefault: t.default === true
        });
      });
    }

    results.push({
      embed: src.link,
      server: srvName.toLowerCase(),
      quality: srvType.toUpperCase() + " — " + srvName,
      subtitles: subtitles
    });
  }
  return results;
}
