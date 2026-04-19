// JKAnime — Extensión Kazemi JS
// =========================================================

const SOURCE = {
  id: "jkanime",
  name: "JKanime",
  baseUrl: "https://jkanime.net",
  language: "es",
  version: "1.1.6",
  iconUrl: "https://jkanime.net/favicon.ico",
  contentKind: "anime",
  extractorRepositoryUrl: "https://raw.githubusercontent.com/kakuga-code/extensions/refs/heads/main/repo-extractores.json",
  supportedTypes: ["animes", "peliculas", "especiales", "ovas", "onas"],
  nativeSortCriteria: ["popularidad", "nombre"],
  filters: [
    {
      name: "genre",
      options: [
        { id: "accion",          label: "Acción" },
        { id: "aventura",        label: "Aventura" },
        { id: "autos",           label: "Autos" },
        { id: "comedia",         label: "Comedia" },
        { id: "dementia",        label: "Dementia" },
        { id: "demonios",        label: "Demonios" },
        { id: "drama",           label: "Drama" },
        { id: "ecchi",           label: "Ecchi" },
        { id: "fantasia",        label: "Fantasía" },
        { id: "harem",           label: "Harem" },
        { id: "historico",       label: "Histórico" },
        { id: "isekai",          label: "Isekai" },
        { id: "josei",           label: "Josei" },
        { id: "juegos",          label: "Juegos" },
        { id: "magia",           label: "Magia" },
        { id: "artes-marciales", label: "Artes Marciales" },
        { id: "mecha",           label: "Mecha" },
        { id: "militar",         label: "Militar" },
        { id: "misterio",        label: "Misterio" },
        { id: "musica",          label: "Música" },
        { id: "nios",            label: "Niños" },
        { id: "parodia",         label: "Parodia" },
        { id: "policial",        label: "Policial" },
        { id: "psicologico",     label: "Psicológico" },
        { id: "romance",         label: "Romance" },
        { id: "samurai",         label: "Samurai" },
        { id: "colegial",        label: "Colegial" },
        { id: "sci-fi",          label: "Sci-Fi" },
        { id: "seinen",          label: "Seinen" },
        { id: "shoujo",          label: "Shoujo" },
        { id: "shoujo-ai",       label: "Shoujo Ai" },
        { id: "shounen",         label: "Shounen" },
        { id: "shounen-ai",      label: "Shounen Ai" },
        { id: "space",           label: "Space" },
        { id: "deportes",        label: "Deportes" },
        { id: "super-poderes",   label: "Super Poderes" },
        { id: "sobrenatural",    label: "Sobrenatural" },
        { id: "terror",          label: "Terror" },
        { id: "thriller",        label: "Thriller" },
        { id: "vampiros",        label: "Vampiros" },
        { id: "yaoi",            label: "Yaoi" },
        { id: "yuri",            label: "Yuri" },
        { id: "cosas-de-la-vida",label: "Cosas de la vida" },
        { id: "latino",          label: "Español Latino" }
      ]
    },
    {
      name: "type",
      options: [
        { id: "animes",    label: "Animes" },
        { id: "peliculas", label: "Películas" },
        { id: "especiales",label: "Especiales" },
        { id: "ovas",      label: "OVAs" },
        { id: "onas",      label: "ONAs" }
      ]
    },
    {
      name: "order",
      options: [
        { id: "popularidad", label: "Por popularidad" },
        { id: "nombre",      label: "Por nombre (A-Z)" }
      ]
    }
  ]
};

const DISABLED_SERVERS = ["filemoon", "mega", "mega.nz", "mediafire", "zippyshare", "1fichier"];

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

function cleanTitle(title) {
  if (!title) return "";
  // Si ya tiene espacios, probablemente está bien
  if (title.indexOf(" ") !== -1) return title;
  // Reemplazar guiones por espacios y capitalizar
  return title
    .split("-")
    .map(function(word) {
      if (!word) return "";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

// Extrae un bloque JSON (objeto o array) de forma robusta ignorando llaves/corchetes en strings
function extractJSBlock(html, marker, openChar, closeChar) {
  const start = html.indexOf(marker);
  if (start === -1) return null;
  
  let i = start + marker.length;
  // Avanzar hasta encontrar el caracter de apertura
  while (i < html.length && html[i] !== openChar && html[i] !== '\n') { i++; }
  if (i >= html.length || html[i] !== openChar) return null;
  
  const blockStart = i;
  let depth = 0;
  let inStr = false;
  let escape = false;
  
  for (; i < html.length; i++) {
    const c = html[i];
    if (escape) { escape = false; continue; }
    if (c === "\\" && inStr) { escape = true; continue; }
    if ((c === '"' || c === "'") && !inStr) { inStr = c; continue; }
    if (c === inStr) { inStr = false; continue; }
    if (inStr) continue;
    
    if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) return html.substring(blockStart, i + 1);
    }
  }
  return null;
}

function parseDirectoryItemsFromHtml(html, defaultType) {
  const items = [];
  const seen = {};
  // Soporta tanto bloques clásicos anime__item como tarjetas genéricas con data-setbg
  const cardRe = /<a[^>]+href="(https?:\/\/jkanime\.net\/([^/"?#]+)\/|\/([^/"?#]+)\/)"[^>]*>[\s\S]*?(?:<h5[^>]*>\s*(?:<a[^>]*>)?([^<]+)(?:<\/a>)?\s*<\/h5>|alt="([^"]+)")[\s\S]*?(?:data-setbg|src)=["']([^"']+)["']/gi;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const slug = (m[2] || m[3] || "").trim();
    if (!slug || slug === "directorio" || slug === "buscar") continue;
    if (seen[slug]) continue;
    seen[slug] = true;
    const title = cleanTitle(decodeHtml((m[4] || m[5] || slug).trim()));
    const pageUrl = m[1].startsWith("http") ? m[1] : (SOURCE.baseUrl + "/" + slug + "/");
    const thumbnail = m[6] || null;
    items.push({
      id: slug,
      slug: slug,
      title: title,
      thumbnail: thumbnail,
      type: defaultType || null,
      genres: [],
      status: null,
      pageUrl: pageUrl
    });
  }
  return items;
}

function extractLatestEpisodeNumber(html, animeId) {
  if (!html) return 0;

  const specificPatterns = [
    new RegExp('id=["\\\']uep["\\\'][\\s\\S]*?/' + animeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '/(\\d+)/', 'i'),
    new RegExp('/' + animeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '/(\\d+)/', 'g')
  ];

  let best = 0;

  const directLatest = html.match(specificPatterns[0]);
  if (directLatest && directLatest[1]) {
    best = Math.max(best, parseInt(directLatest[1], 10) || 0);
  }

  let match;
  while ((match = specificPatterns[1].exec(html)) !== null) {
    const value = parseInt(match[1], 10);
    if (!isNaN(value) && value > best) best = value;
  }

  return best;
}

function fetchDirectory(url, defaultType) {
  console.log("[jkanime] fetchDirectory url=" + url);
  const html = http.get(url);
  if (!html) return { items: [], hasNextPage: false };

  const markers = [
    "var animes = ",
    "var animes=",
    "let animes = ",
    "let animes=",
    "const animes = ",
    "const animes="
  ];
  let jsonStr = null;
  for (let mi = 0; mi < markers.length && !jsonStr; mi++) {
    jsonStr = extractJSBlock(html, markers[mi], "{", "}");
  }
  if (!jsonStr) {
      // Fallback HTML cuando el sitio cambia el script o responde markup sin var animes
      const fallbackItems = parseDirectoryItemsFromHtml(html, defaultType);
      console.log("[jkanime] Fallback HTML items=" + fallbackItems.length);
      return {
        items: fallbackItems,
        hasNextPage: /[?&]p=\d+/.test(url) ? fallbackItems.length > 0 : html.indexOf("p=") !== -1
      };
  }

  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch(e) {
    console.log("[jkanime] JSON.parse falló en var animes");
    return { items: [], hasNextPage: false };
  }

  const items = [];
  if (data.data && Array.isArray(data.data)) {
    data.data.forEach(function(a) {
      // Tipo: si no está en el JSON, usar el parámetro defaultType (cuando se filtra por tipo específico)
      let type = a.tipo || defaultType || null;
      if (type) {
        const lowerType = type.toLowerCase();
        // Reconocer tanto formas singulares como plurales (jkanime puede usar ambas)
        if (lowerType === "serie" || lowerType === "anime" || lowerType === "animes" || lowerType === "tv") {
          type = "Serie";
        } else if (lowerType === "pelicula" || lowerType === "peliculas" || lowerType === "película" || lowerType === "movie") {
          type = "Película";
        } else if (lowerType === "ova" || lowerType === "ovas") {
          type = "OVA";
        } else if (lowerType === "ona" || lowerType === "onas") {
          type = "ONA";
        } else if (lowerType === "especial" || lowerType === "especiales" || lowerType === "special") {
          type = "Especial";
        } else {
          type = null;  // Si no es un tipo reconocido, dejar null
        }
      }

      items.push({
        id: a.slug,
        slug: a.slug,
        title: cleanTitle(decodeHtml(a.title)),
        thumbnail: a.image,
        type: type,               // null si no disponible en catálogo
        genres: [],               // Genres only available in detail view
        status: null,             // Status only available in detail view
        pageUrl: a.url || (SOURCE.baseUrl + "/" + a.slug + "/")
      });
    });
  }
  
  console.log("[jkanime] fetchDirectory items=" + items.length);
  return {
    items: items,
    hasNextPage: !!data.next_page_url
  };
}

// ── Catalog ───────────────────────────────────────────────

function fetchPopular(page) {
  return fetchDirectory(SOURCE.baseUrl + "/directorio?filtro=popularidad&p=" + page);
}

function fetchLatest(page) {
  const result = fetchDirectory(SOURCE.baseUrl + "/directorio?p=" + page);
  result.items = result.items.slice().reverse();
  return result;
}

function fetchSearch(query, page, filters) {
  // Si no hay búsqueda de texto, usamos el directorio con los filtros combinados
  if (!query || query.trim().length === 0) {
      // JKAnime usa la ruta /directorio para filtrar por género, año, tipo, etc.
      let url = SOURCE.baseUrl + "/directorio?p=" + page;
      let defaultType = null;  // Usar como fallback si el tipo no está en el JSON
      let sortOrder = null;
      console.log("[jkanime] fetchSearch filters=" + JSON.stringify(filters));
      if (filters) {
          // Mapeo de llaves genéricas de la app a llaves específicas de JKAnime
          const keyMap = {
              "genre": "genero",
              "type": "tipo",
              "order": "filtro"
          };
          // Mapeo de géneros canónicos (inglés) → slugs de JKAnime (español)
          const genreMap = {
              "action":"accion","adventure":"aventura","cars":"autos",
              "comedy":"comedia","dementia":"dementia","demons":"demonios",
              "drama":"drama","ecchi":"ecchi","fantasy":"fantasia",
              "game":"juegos","harem":"harem","historical":"historico",
              "horror":"terror","isekai":"isekai","josei":"josei",
              "kids":"nios","magic":"magia","martial-arts":"artes-marciales",
              "mecha":"mecha","military":"militar","music":"musica",
              "mystery":"misterio","parody":"parodia","police":"policial",
              "psychological":"psicologico","romance":"romance","samurai":"samurai",
              "school":"colegial","sci-fi":"sci-fi","seinen":"seinen",
              "shoujo":"shoujo","shoujo-ai":"shoujo-ai","shounen":"shounen","shounen-ai":"shounen-ai",
              "slice-of-life":"cosas-de-la-vida","space":"space","sports":"deportes",
              "super-power":"super-poderes","supernatural":"sobrenatural","thriller":"thriller",
              "vampire":"vampiros","yaoi":"yaoi","yuri":"yuri"
          };
          // Mapeo de valores que difieren entre la app y el sitio
          const valMap = {
              "genre": genreMap,
              "type": {
                  "movie": "peliculas",
                  "special": "especiales",
                  "tv": "animes",
                  "ona": "onas",
                  "ova": "ovas"
              },
              "order": {
                  "rating": "popularidad",
                  "added": "",
                  "title": "nombre"
              }
          };
          // Mapeo inverso: valores URL → valores canónicos
          const canonicalMap = {
              "peliculas": "Movie",
              "especiales": "Special",
              "animes": "TV",
              "onas": "ONA",
              "ovas": "OVA"
          };

          for (var key in filters) {
              var val = filters[key];
              if (!val) continue;
              var targetKey = keyMap[key] || key;
              // Buscar en valMap con case-insensitive para tipos (TV, Movie, Special, etc.)
              var targetVal = val;
              if (valMap[key]) {
                  // Intentar con el valor exacto primero
                  targetVal = valMap[key][val];
                  // Si no encuentra, intentar con minúsculas
                  if (!targetVal) {
                      targetVal = valMap[key][val.toLowerCase()];
                  }
                  // Si sigue sin encontrar, usar el valor original
                  if (!targetVal) {
                      targetVal = val;
                  }
              }
              if (targetVal !== "") {
                  url += "&" + targetKey + "=" + encodeURIComponent(targetVal);
                  // Si es un filtro de tipo, guardar el valor canonical como fallback
                  if (key === "type") {
                      // Mapear el valor URL al valor canónico (ej: "animes" → "TV")
                      defaultType = canonicalMap[targetVal] || targetVal;
                  }
              } else if (key === "order" && targetKey === "filtro") {
                  // En JKAnime "Por fecha" es el valor vacío, pero conviene enviarlo explícitamente.
                  url += "&filtro=";
              }

              if (key === "order") {
                  // El sitio separa el criterio (`filtro`) de la dirección (`orden`).
                  // Para A-Z necesitamos forzar ascendente; para fecha/popularidad dejamos el default descendente.
                  sortOrder = targetVal === "nombre" ? "asc" : "";
              }
          }

          if (sortOrder !== null) {
              url += "&orden=" + encodeURIComponent(sortOrder);
          }
      }
      console.log("[jkanime] fetchSearch (filtros) url=" + url);
      return fetchDirectory(url, defaultType);
  }
  
  // Búsqueda de texto (JKAnime ignora filtros si hay texto en la búsqueda manual)
  const q = encodeURIComponent(query.trim().replace(/\s+/g, "_"));
  // El sitio no usa paginación estándar /1/ /2/ para la búsqueda de texto, usamos la raíz de búsqueda
  const url = SOURCE.baseUrl + "/buscar/" + q + "/"; 
  console.log("[jkanime] fetchSearch (texto) url=" + url);
  
  const html = http.get(url);
  if (!html) return { items: [], hasNextPage: false };

  // CASO 1: Redirección automática a la página del anime (único resultado)
  if (html.indexOf("anime__details__content") !== -1) {
      console.log("[jkanime] Búsqueda redirigida a página de anime unico");
      const titleM = html.match(/<div[^>]*class="[^"]*anime_info[^"]*"[^>]*>\s*<h3[^>]*>(.*?)<\/h3>/);
      const coverM = html.match(/<div[^>]*class="[^"]*anime_pic[^"]*"[^>]*>\s*<img[^>]+src="([^"]+)"/);
      const canonicalM = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
      
      const title = titleM ? titleM[1].replace(/<[^>]+>/g, "").trim() : query;
      const pageUrl = canonicalM ? canonicalM[1] : url;
      const slugM = pageUrl.match(/jkanime\.net\/([^/]+)/);
      const slug = slugM ? slugM[1] : title;

      return {
          items: [{
              id: slug,
              slug: slug,
              title: cleanTitle(title),
              thumbnail: coverM ? coverM[1] : null,
              type: null,           // Type not available in search redirect
              genres: [],           // Genres not available in search
              status: null,         // Status not available in search
              pageUrl: pageUrl
          }],
          hasNextPage: false
      };
  }

  // CASO 2: Lista de resultados habitual
  const items = [];
  const itemRe = /<div\s+class="anime__item">([\s\S]*?)<\/div>\s*<\/div>/g;
  let m;
  while ((m = itemRe.exec(html)) !== null) {
      const block = m[1];
      const linkM = block.match(/href="([^"]+)"/);
      const titleM = block.match(/<h5><a[^>]*>([^<]+)<\/a><\/h5>/);
      const thumbM = block.match(/data-setbg="([^"]+)"/);
      
      if (linkM && titleM) {
          const matchedUrl = linkM[1];
          const title = decodeHtml(titleM[1].trim());
          const slugM = matchedUrl.match(/jkanime\.net\/([^/]+)/);
          const slug = slugM ? slugM[1] : title;

          items.push({
              id: slug,
              slug: slug,
              title: cleanTitle(title),
              thumbnail: thumbM ? thumbM[1] : null,
              type: null,           // Type not available in search results
              genres: [],           // Genres not available in search
              status: null,         // Status not available in search
              pageUrl: matchedUrl
          });
      }
  }
  
  console.log("[jkanime] fetchSearch items=" + items.length);
  // La búsqueda de texto en JKAnime suele mostrar todos los resultados en una sola página 
  // o no tiene un patrón de paginación compatible con /buscar/
  return {
      items: items,
      hasNextPage: false 
  };
}

// ── Anime Detail ──────────────────────────────────────────

function fetchItemDetails(id) {
  const html = http.get(SOURCE.baseUrl + "/" + id + "/");
  const titleM = html.match(/<div[^>]*class="[^"]*anime_info[^"]*"[^>]*>[\s\S]*?<h3[^>]*>(.*?)<\/h3>/i);
  const descM = html.match(/<p[^>]*class="[^"]*scroll[^"]*"[^>]*>([\s\S]*?)<\/p>/);
  const coverM = html.match(/<div[^>]*class="[^"]*anime_pic[^"]*"[^>]*>\s*<img[^>]+src="([^"]+)"/);
  
  const genres = [];
  const genreRe = /href="[^"]*\/genero\/[^"]+">([^<]+)<\/a>/g;
  const genreSeen = {};
  let gm;
  while ((gm = genreRe.exec(html)) !== null) {
    const g = decodeHtml(gm[1].trim());
    if (!genreSeen[g]) { genreSeen[g] = true; genres.push(g); }
  }
  
  let status = "Desconocido";
  if (html.includes("En emision")) status = "En emisión";
  else if (html.includes("Concluido")) status = "Concluido";
  else if (html.includes("Por estrenar")) status = "Por estrenar";
  
  let type = null;
  const typeM = html.match(/li rel="tipo"><span>Tipo:<\/span>\s*([^<]+)/i) || html.match(/<span>Tipo:<\/span>\s*([^<]+)/i);
  if (typeM) {
      type = decodeHtml(typeM[1].replace(/<[^>]+>/g, "").trim());
      if (type.toLowerCase() === "ona" || type.toLowerCase() === "tv") type = "Anime";
  }

  // ── Relacionados ──────────────────────────────────────────
  // Estructura: <h5 id="aditional">Relación</h5> seguido de <a href="...slug...">Título</a>
  const related = [];
  const relatedBlockM = html.match(/Temporadas y relacionados[\s\S]*?(?=<section|$)/);
  if (relatedBlockM) {
    const block = relatedBlockM[0];
    // Extraemos pares relación + links: cada <h5> define la relación para los <a> que vienen después
    const entryRe = /<h5[^>]*id="aditional"[^>]*>\s*([^<]+)\s*<\/h5>([\s\S]*?)(?=<h5|$)/g;
    let em;
    while ((em = entryRe.exec(block)) !== null) {
      const relation = decodeHtml(em[1].trim());
      const linksBlock = em[2];
      const linkRe = /<a[^>]+href="https?:\/\/jkanime\.net\/([^/"]+)\/"[^>]*>([^<]+)<\/a>/g;
      let lm;
      while ((lm = linkRe.exec(linksBlock)) !== null) {
        const slug = lm[1];
        // El título viene como "Nombre (Tipo) " — limpiamos el tipo entre paréntesis
        const rawTitle = decodeHtml(lm[2].trim());
        const title = rawTitle.replace(/\s*\([^)]+\)\s*$/, "").trim();
        // Fallback cover: intentar CDN principal si el alternativo falla
        const cover = "https://cdn.jkdesa.com/assets/images/animes/image/" + slug + ".jpg";
        related.push({ id: slug, title: title, relation: relation, cover: cover });
      }
    }
  }

  return {
    title: titleM ? cleanTitle(decodeHtml(titleM[1].replace(/<[^>]+>/g, "").trim())) : id,
    synopsis: descM ? decodeHtml(descM[1].replace(/<[^>]+>/g, "").trim()) : "",
    cover: coverM ? coverM[1] : null,
    genres: genres,
    type: type,
    status: status,
    related: related
  };
}

// ── Episode List ──────────────────────────────────────────

function fetchChildren(itemId) {
  const animeId = itemId;
  const url = SOURCE.baseUrl + "/" + animeId + "/";
  const html = http.get(url);
  
  let allEpisodes = [];
  
  // ESTRATEGIA 1: Obtener episodios directamente del HTML (múltiples patrones)
  const epRe = /<a[^>]+href="(?:https?:\/\/jkanime\.net)?\/[^"]+\/(\d+)\/?"[^>]*>\s*(?:<span[^>]*>\s*)?(?:EP\s*)?(\d+)(?:\s*<\/span>)?\s*<\/a>/g;
  let em;
  const seen = {};
  while ((em = epRe.exec(html)) !== null) {
      const epNum = parseInt(em[2], 10);
      if (!seen[epNum]) {
          seen[epNum] = true;
          allEpisodes.push({
              id: animeId + "/" + epNum,
              number: epNum,
              title: "Episodio " + epNum,
              pageUrl: SOURCE.baseUrl + "/" + animeId + "/" + epNum + "/"
          });
      }
  }

  // ESTRATEGIA 1b: Fallback por URLs de episodios en cualquier parte del HTML/JS
  if (allEpisodes.length === 0) {
      const anyEpRe = new RegExp("https?:\\/\\/jkanime\\.net\\/" + animeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\/(\\d+)\\/?", "g");
      let am;
      while ((am = anyEpRe.exec(html)) !== null) {
          const epNum = parseInt(am[1], 10);
          if (!isNaN(epNum) && !seen[epNum]) {
              seen[epNum] = true;
              allEpisodes.push({
                  id: animeId + "/" + epNum,
                  number: epNum,
                  title: "Episodio " + epNum,
                  pageUrl: SOURCE.baseUrl + "/" + animeId + "/" + epNum + "/"
              });
          }
      }
  }
  
  // Si no se encontraron episodios por HTML, intentar con AJAX (puede fallar por token expirado)
  if (allEpisodes.length === 0) {
      const cTokenM = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/);
      const aIdM = html.match(/data-anime="([^"]+)"/);
      
      if (cTokenM && aIdM) {
          try {
              const csfrToken = cTokenM[1];
              const internalId = aIdM[1];
              const tokenBody = "_token=" + encodeURIComponent(csfrToken);
              const ajaxHeaders = {
                  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                  "X-Requested-With": "XMLHttpRequest",
                  "X-CSRF-TOKEN": csfrToken,
                  "Referer": url,
                  "Origin": SOURCE.baseUrl
              };
              
              const respText = http.post(SOURCE.baseUrl + "/ajax/episodes/" + internalId + "/1", tokenBody, ajaxHeaders);
              
              let json = JSON.parse(respText);
              
              if (json.data && Array.isArray(json.data)) {
                  json.data.forEach(function(ep) {
                      allEpisodes.push({
                          id: animeId + "/" + ep.number,
                          number: ep.number,
                          title: "Episodio " + ep.number,
                          pageUrl: SOURCE.baseUrl + "/" + animeId + "/" + ep.number + "/"
                      });
                  });
                  
                  const firstEp = json.from || 1;
                  const lastEp = (json.total || 0) + firstEp - 1;
                  const totalPages = json.last_page || Math.ceil((json.total || 0) / (json.per_page || 30)) || 1;
                  
                  for (let i = (json.to || 0) + 1; i <= lastEp; i++) {
                      allEpisodes.push({
                          id: animeId + "/" + i,
                          number: i,
                          title: "Episodio " + i,
                          pageUrl: SOURCE.baseUrl + "/" + animeId + "/" + i + "/"
                      });
                  }

                  // Si la API expone paginación real, traer más páginas para series largas.
                  if (totalPages > 1) {
                      for (let p = 2; p <= totalPages; p++) {
                          try {
                              const pageResp = http.post(
                                  SOURCE.baseUrl + "/ajax/episodes/" + internalId + "/" + p,
                                  tokenBody,
                                  ajaxHeaders
                              );
                              const pageJson = JSON.parse(pageResp);
                              if (pageJson.data && Array.isArray(pageJson.data)) {
                                  pageJson.data.forEach(function(ep) {
                                      const epNum = parseInt(ep.number, 10);
                                      if (!isNaN(epNum) && !seen[epNum]) {
                                          seen[epNum] = true;
                                          allEpisodes.push({
                                              id: animeId + "/" + epNum,
                                              number: epNum,
                                              title: "Episodio " + epNum,
                                              pageUrl: SOURCE.baseUrl + "/" + animeId + "/" + epNum + "/"
                                          });
                                      }
                                  });
                              }
                          } catch (pe) {}
                      }
                  }
              }
          } catch(e) {
              console.log("[jkanime] Error en fetchChildren AJAX: " + e);
          }
      }
  }

  // ESTRATEGIA 3: si el sitio bloquea el AJAX o devuelve una página parcial,
  // usar el último episodio visible para reconstruir una lista sintética.
  if (allEpisodes.length <= 1) {
      const latestEpisode = extractLatestEpisodeNumber(html, animeId);
      if (latestEpisode > allEpisodes.length) {
          allEpisodes = [];
          for (let i = 1; i <= latestEpisode; i++) {
              allEpisodes.push({
                  id: animeId + "/" + i,
                  number: i,
                  title: "Episodio " + i,
                  pageUrl: SOURCE.baseUrl + "/" + animeId + "/" + i + "/"
              });
          }
          console.log("[jkanime] fetchChildren fallback latestEpisode=" + latestEpisode);
      }
  }
  
  // Normalizar y deduplicar por número antes de devolver al host.
  const deduped = [];
  const dedupSeen = {};
  allEpisodes
    .sort(function(a, b) { return a.number - b.number; })
    .forEach(function(ep) {
      const epNum = parseInt(ep.number, 10);
      if (isNaN(epNum) || dedupSeen[epNum]) return;
      dedupSeen[epNum] = true;
      deduped.push({
        id: animeId + "/" + epNum,
        number: epNum,
        title: ep.title || ("Episodio " + epNum),
        pageUrl: ep.pageUrl || (SOURCE.baseUrl + "/" + animeId + "/" + epNum + "/")
      });
    });

  console.log("[jkanime] fetchChildren total=" + deduped.length);
  return deduped.reverse(); // Orden descendente
}

// ── Video List ────────────────────────────────────────────

function normalizeJKUrl(url) {
  return url
    .replace("/jkokru.php?u=", "http://ok.ru/videoembed/")
    .replace("/jkvmixdrop.php?u=", "https://mixdrop.ag/e/")
    .replace("/jksw.php?u=", "https://sfastwish.com/e/");
}


function fetchVideoList(episodeId) {
  const html = http.get(SOURCE.baseUrl + "/" + episodeId + "/");
  const results = [];
  const seen = {};

  const scriptM = html.match(/(var video = \[\];[\s\S]*?)<\/script>/);
  if (!scriptM) {
    console.log("[jkanime] No se encontró el script html de videos");
    return results;
  }

  const scriptData = scriptM[1];
  const isRemote = scriptData.includes("= remote+'");
  let serversJsonStr = null;

  if (isRemote) {
    const remoteServerM = scriptData.match(/var remote = '([^']+)';/);
    const remotePathM = scriptData.match(/= remote\+'([^']+)';/);
    if (remoteServerM && remotePathM) {
      serversJsonStr = http.get(remoteServerM[1] + remotePathM[1]);
    }
  } else {
    serversJsonStr = extractJSBlock(scriptData, "var servers = ", "[", "]");
  }

  if (serversJsonStr) {
    try {
      const arr = JSON.parse(serversJsonStr);
      console.log("[jkanime] Servidores JS encontrados: " + arr.length);
      arr.forEach(function(item) {
        if (!item.remote) return;
        let url;
        try { url = atob(item.remote).trim(); } catch(e) { url = item.remote.trim(); }
        const serverName = (item.server || "unknown").toLowerCase();
        const serverLabel = item.server || "Unknown";
        if (DISABLED_SERVERS.indexOf(serverName) !== -1) return;
        url = normalizeJKUrl(url);
        const hostM = url.match(/^https?:\/\/([^/?#]+)/i);
        if (!hostM) return;
        const host = hostM[1];
        const lang = item.lang === 1 ? "[JAP]" : (item.lang === 3 ? "[LAT]" : "");
        if (host === "jkanime.net" || host.slice(-11) === ".jkanime.net") {
          if (!seen[url]) {
            seen[url] = true;
            results.push({ embed: url, server: "jkplayer", quality: lang + " — " + serverLabel });
          }
          return;
        }
        if (seen[url]) return;
        seen[url] = true;
        results.push({ embed: url, server: serverLabel, quality: lang + " — " + serverLabel });
      });
    } catch(e) {
      console.log("[jkanime] JSON.parse falló en var servers");
    }
  }

  // Servidores listados en el HTML como <a data-id>
  const bgServersRe = /<a[^>]+data-id="([^"]+)"[^>]*class="[^"]*lg_(\d+)[^"]*"[^>]*>([^<]+)<\/a>/g;
  let sm;
  while ((sm = bgServersRe.exec(html)) !== null) {
    const serverId = sm[1];
    const langCode = parseInt(sm[2], 10);
    const serverLabel = sm[3].trim();
    const serverName = serverLabel.toLowerCase();
    if (DISABLED_SERVERS.indexOf(serverName) !== -1) continue;
    const videoRegex = new RegExp("video\\[" + serverId + "\\]\\s*=\\s*'<iframe[^>]+src=\"([^\"]+)\"");
    const vm = scriptData.match(videoRegex);
    if (!vm) continue;
    let url = normalizeJKUrl(vm[1]);
    const lang2 = langCode === 1 ? "[JAP]" : (langCode === 3 ? "[LAT]" : "");
    if (url.startsWith("/jk.php") || url.startsWith("/jkplayer/")) {
      const internalUrl = SOURCE.baseUrl + url;
      if (!seen[internalUrl]) {
        seen[internalUrl] = true;
        results.push({ embed: internalUrl, server: "jkplayer", quality: lang2 + " — " + serverLabel });
      }
      continue;
    }
    if (url.indexOf("jkanime.net") !== -1) {
      if (!seen[url]) {
        seen[url] = true;
        results.push({ embed: url, server: "jkplayer", quality: lang2 + " — " + serverLabel });
      }
      continue;
    }
    const hostM2 = url.match(/^https?:\/\/([^/?#]+)/i);
    if (!hostM2) continue;
    if (seen[url]) continue;
    seen[url] = true;
    results.push({ embed: url, server: serverLabel, quality: lang2 + " — " + serverLabel });
  }

  return results;
}
