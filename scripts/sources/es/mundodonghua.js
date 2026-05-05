// MundoDonghua — Extensión Kazemi JS
// =========================================================

const SOURCE = {
  id: "mundodonghua",
  name: "Mundo Donghua",
  baseUrl: "https://www.mundodonghua.com",
  language: "es",
  version: "1.0.0",
  iconUrl: "https://www.mundodonghua.com/images/favicon.png",
  contentKind: "Donghua",
  supportsPopular: false,
  extractorRepositoryUrl: "https://raw.githubusercontent.com/kakuga-code/extensions/refs/heads/main/repo-extractores.json",
  supportedTypes: ["donghua", "especial", "pelicula"],
  nativeSortCriteria: ["nombre"],
  filters: [
    {
      name: "genre",
      options: [
        { id: "accion",              label: "Acción" },
        { id: "artes-marciales",     label: "Artes Marciales" },
        { id: "aventura",            label: "Aventura" },
        { id: "ciencia-ficcion",     label: "Ciencia Ficción" },
        { id: "comedia",             label: "Comedia" },
        { id: "comida",              label: "Comida" },
        { id: "cultivacion",         label: "Cultivación" },
        { id: "demonios",            label: "Demonios" },
        { id: "deportes",            label: "Deportes" },
        { id: "drama",               label: "Drama" },
        { id: "ecchi",               label: "Ecchi" },
        { id: "escolar",             label: "Escolar" },
        { id: "fantasia",            label: "Fantasía" },
        { id: "harem-inverso",       label: "Harem Inverso" },
        { id: "harem",               label: "Harem" },
        { id: "historico",           label: "Historico" },
        { id: "idols",               label: "Idols" },
        { id: "juegos",              label: "Juegos" },
        { id: "lucha",               label: "Lucha" },
        { id: "magia",               label: "Magia" },
        { id: "mechas",              label: "Mechas" },
        { id: "militar",             label: "Militar" },
        { id: "misterio",            label: "Misterio" },
        { id: "mitologia",           label: "Mitología" },
        { id: "musica",              label: "Música" },
        { id: "parodia",             label: "Parodia" },
        { id: "pelicula",            label: "Película" },
        { id: "por-definir",         label: "Por Definir" },
        { id: "psicologico",         label: "Psicológico" },
        { id: "reencarnacion",       label: "Reencarnación" },
        { id: "romance",             label: "Romance" },
        { id: "seinen",              label: "Seinen" },
        { id: "shojo",               label: "Shojo" },
        { id: "shonen",              label: "Shonen" },
        { id: "sobrenatural",        label: "Sobrenatural" },
        { id: "sucesos-de-la-vida",  label: "Sucesos de la Vida" },
        { id: "superpoderes",        label: "Superpoderes" },
        { id: "suspenso",            label: "Suspenso" },
        { id: "terror",              label: "Terror" },
        { id: "vampiros",            label: "Vampiros" },
        { id: "venganza",            label: "Venganza" },
        { id: "viaje-a-otro-mundo",  label: "Viaje a Otro Mundo" },
        { id: "videojuegos",         label: "Videojuegos" },
        { id: "yaoi",                label: "Yaoi" },
        { id: "zombis",              label: "Zombis" }
      ]
    }
  ]
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
    .replace(/&#(\d+);/g, function(_, dec) { return String.fromCharCode(dec); })
    .replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ").replace(/&iexcl;/g, "¡").replace(/&iquest;/g, "¿")
    .replace(/&Aacute;/g, "Á").replace(/&Eacute;/g, "É").replace(/&Iacute;/g, "Í").replace(/&Oacute;/g, "Ó").replace(/&Uacute;/g, "Ú")
    .replace(/&Ntilde;/g, "Ñ");
}

function cleanTitle(title) {
  if (!title) return "";
  return title.trim();
}

function absoluteUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return SOURCE.baseUrl + (path.startsWith("/") ? path : "/" + path);
}

function parseDirectoryItems(html) {
  const items = [];
  const seen = {};
  const cardRe = /<div class="item[^"]*">[\s\S]*?<a href="\/donghua\/([^"]+)"[^>]*>[\s\S]*?<img src="([^"]+)"[^>]*>[\s\S]*?<div class="badge show ([^"]+)">([^<]*)<\/div>[\s\S]*?<h5[^>]*>([\s\S]*?)<\/h5>/gi;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const slug = m[1].trim();
    if (!slug || seen[slug]) continue;
    seen[slug] = true;
    const thumbnail = absoluteUrl(m[2]);
    const badgeClass = m[3];
    const badgeText = decodeHtml(m[4].trim());
    const titleRaw = m[5].replace(/<[^>]+>/g, "").trim();
    const title = cleanTitle(decodeHtml(titleRaw));

    let type = "TV";
    if (badgeText.toLowerCase() === "especial") {
      type = "Especial";
    } else if (badgeText.toLowerCase() === "película" || badgeText.toLowerCase() === "pelicula") {
      type = "Película";
    } else if (badgeText.toLowerCase() === "donghua" || badgeClass.toLowerCase() === "donghua") {
      type = "TV";
    }

    items.push({
      id: slug,
      slug: slug,
      title: title,
      thumbnail: thumbnail,
      type: type,
      genres: [],
      status: null,
      pageUrl: SOURCE.baseUrl + "/donghua/" + slug
    });
  }
  return items;
}

function fetchDirectory(url) {
  console.log("[mundodonghua] fetchDirectory url=" + url);
  const html = http.get(url);
  if (!html) return { items: [], hasNextPage: false };

  const items = parseDirectoryItems(html);
  console.log("[mundodonghua] fetchDirectory items=" + items.length);

  // Detectar si hay página siguiente buscando en la paginación
  const hasNextPage = html.indexOf('href="' + url.replace(SOURCE.baseUrl, '').replace(/\/$/, '') + '/') !== -1 ||
                      html.indexOf('href="' + url.replace(SOURCE.baseUrl, '').replace(/\/$/, '') + '/') !== -1;

  return {
    items: items,
    hasNextPage: items.length >= 24 // MundoDonghua muestra ~24 items por página
  };
}

// ── Catalog ───────────────────────────────────────────────

function fetchPopular(page) {
  // Populares desactivado: el sitio no tiene un catálogo realmente separado.
  return { items: [], hasNextPage: false };
}

function fetchLatest(page) {
  // MundoDonghua no tiene una página de "series recientes".
  // /lista-episodios muestra episodios individuales, no series.
  // Usamos el directorio completo como fallback.
  return fetchDirectory(SOURCE.baseUrl + "/lista-donghuas" + (page > 1 ? "/" + page : ""));
}

function fetchSearch(query, page, filters) {
  // Si no hay texto de búsqueda, usamos filtros
  if (!query || query.trim().length === 0) {
    let url = SOURCE.baseUrl + "/lista-donghuas";

    if (filters) {
      const genreMap = {
        "action": "accion", "adventure": "aventura", "martial-arts": "artes-marciales",
        "sci-fi": "ciencia-ficcion", "comedy": "comedia", "food": "comida",
        "cultivation": "cultivacion", "demons": "demonios", "sports": "deportes",
        "drama": "drama", "ecchi": "ecchi", "school": "escolar",
        "fantasy": "fantasia", "reverse-harem": "harem-inverso", "harem": "harem",
        "historical": "historico", "idols": "idols", "game": "juegos",
        "fight": "lucha", "magic": "magia", "mecha": "mechas",
        "military": "militar", "mystery": "misterio", "mythology": "mitologia",
        "music": "musica", "parody": "parodia", "movie": "pelicula",
        "undefined": "por-definir", "psychological": "psicologico", "reincarnation": "reencarnacion",
        "romance": "romance", "seinen": "seinen", "shoujo": "shojo",
        "shounen": "shonen", "supernatural": "sobrenatural", "slice-of-life": "sucesos-de-la-vida",
        "super-power": "superpoderes", "suspense": "suspenso", "horror": "terror",
        "vampire": "vampiros", "revenge": "venganza", "isekai": "viaje-a-otro-mundo",
        "video-game": "videojuegos", "yaoi": "yaoi", "zombies": "zombis"
      };

      if (filters.genre) {
        const genreVal = genreMap[filters.genre.toLowerCase()] || filters.genre;
        url = SOURCE.baseUrl + "/genero/" + encodeURIComponent(genreVal);
      }
    }

    if (page > 1) {
      url = url + "/" + page;
    }

    console.log("[mundodonghua] fetchSearch (filtros) url=" + url);
    return fetchDirectory(url);
  }

  // Búsqueda por texto: el sitio no tiene endpoint real.
  // Hacemos barrido progresivo de pocas páginas para equilibrar
  // cobertura y velocidad.
  const q = query.trim().toLowerCase();
  console.log("[mundodonghua] fetchSearch (texto) q=" + q);
  const maxPagesToScan = 5;
  const perPage = 24;
  const filtered = [];
  const seen = {};

  for (let p = 1; p <= maxPagesToScan; p++) {
    const url = SOURCE.baseUrl + "/lista-donghuas" + (p > 1 ? "/" + p : "");
    const html = http.get(url);
    if (!html) break;
    const pageItems = parseDirectoryItems(html);
    if (pageItems.length === 0) break;

    for (let i = 0; i < pageItems.length; i++) {
      const item = pageItems[i];
      if (seen[item.slug]) continue;
      seen[item.slug] = true;
      if (item.title.toLowerCase().indexOf(q) !== -1) {
        filtered.push(item);
      }
    }

    // Si ya tenemos suficientes resultados para la página solicitada, no seguimos.
    if (filtered.length >= page * perPage) {
      break;
    }
  }

  const start = (page - 1) * perPage;
  const paged = filtered.slice(start, start + perPage);
  return {
    items: paged,
    hasNextPage: filtered.length > (start + perPage)
  };
}

// ── Anime Detail ──────────────────────────────────────────

function fetchItemDetails(id) {
  const url = SOURCE.baseUrl + "/donghua/" + id;
  const html = http.get(url);
  if (!html) {
    return {
      title: id,
      synopsis: "",
      cover: null,
      genres: [],
      type: null,
      status: "Desconocido",
      related: []
    };
  }

  // Título
  const titleM = html.match(/<div class="sf fc-dark ls-title-serie">([^<]+)<\/div>/);
  const title = titleM ? cleanTitle(decodeHtml(titleM[1].trim())) : id;

  // Sinopsis
  const descM = html.match(/<p class="text-justify fc-dark">([\s\S]*?)<\/p>/);
  const synopsis = descM ? decodeHtml(descM[1].replace(/<[^>]+>/g, "").trim()) : "";

  // Cover (banner-side-serie o la imagen principal)
  const coverM = html.match(/banner-side-serie"\s*style="background-image: url\(([^)]+)\)/);
  let cover = null;
  if (coverM) {
    cover = absoluteUrl(coverM[1].replace(/['"]/g, ""));
  }
  if (!cover) {
    const imgM = html.match(/<div class="side-banner">[\s\S]*?<img[^>]+src="([^"]+)"/);
    if (imgM) cover = absoluteUrl(imgM[1]);
  }

  // Géneros
  const genres = [];
  const genreRe = /<a href="\/genero\/[^"]+"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/gi;
  const genreSeen = {};
  let gm;
  while ((gm = genreRe.exec(html)) !== null) {
    const g = decodeHtml(gm[1].trim());
    if (!genreSeen[g]) { genreSeen[g] = true; genres.push(g); }
  }

  // Estado
  let status = "Desconocido";
  if (html.indexOf('class="badge bg-success">En Emisión') !== -1) {
    status = "En emisión";
  } else if (html.indexOf('class="badge bg-default">Finalizada') !== -1) {
    status = "Finalizado";
  }

  // Tipo
  let type = null;
  const typeM = html.match(/Tipo:\s*([\s\S]{0,50}?)<\/p>/);
  if (typeM) {
    type = decodeHtml(typeM[1].replace(/<[^>]+>/g, "").trim());
  }
  if (!type || type.length === 0 || type.toLowerCase() === "desconocido") {
    type = "TV";
  }

  const result = {
    title: title,
    synopsis: synopsis,
    cover: cover,
    pageUrl: SOURCE.baseUrl + "/donghua/" + id,
    genres: genres,
    type: type,
    status: status,
    related: []
  };
  console.log("[mundodonghua] fetchItemDetails result=" + JSON.stringify(result));
  return result;
}

// ── Episode List ──────────────────────────────────────────

function fetchChildren(itemId) {
  console.log("[mundodonghua] fetchChildren itemId=" + itemId);
  const url = SOURCE.baseUrl + "/donghua/" + itemId;
  console.log("[mundodonghua] fetchChildren url=" + url);
  const html = http.get(url);
  if (!html) {
    console.log("[mundodonghua] fetchChildren html empty");
    return [];
  }

  const episodes = [];
  const seen = {};

  // Patrón para extraer episodios de la lista
  const epRe = /href="https:\/\/www\.mundodonghua\.com\/ver\/([^"]+)\/([0-9]+)"/g;
  let em;
  while ((em = epRe.exec(html)) !== null) {
    const slug = em[1];
    const epNum = parseInt(em[2], 10);
    if (slug !== itemId || isNaN(epNum) || seen[epNum]) continue;
    seen[epNum] = true;
    episodes.push({
      id: itemId + "/" + epNum,
      number: epNum,
      title: "Episodio " + epNum,
      pageUrl: SOURCE.baseUrl + "/ver/" + itemId + "/" + epNum,
    });
  }

  // Fallback: buscar también URLs relativas
  if (episodes.length === 0) {
    const epRe2 = new RegExp('href="(?:https://www\\.mundodonghua\\.com)?/ver/' + itemId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '/([0-9]+)"', "g");
    let em2;
    while ((em2 = epRe2.exec(html)) !== null) {
      const epNum = parseInt(em2[1], 10);
      if (isNaN(epNum) || seen[epNum]) continue;
      seen[epNum] = true;
      episodes.push({
        id: itemId + "/" + epNum,
        number: epNum,
        title: "Episodio " + epNum,
        pageUrl: SOURCE.baseUrl + "/ver/" + itemId + "/" + epNum,
      });
    }
  }

  // Si no se encontraron episodios, intentar obtener el total del badge
  if (episodes.length === 0) {
    const totalEpM = html.match(/Episodios:\s*<span[^>]*>([0-9]+)<\/span>/);
    if (totalEpM) {
      const total = parseInt(totalEpM[1], 10);
      for (let i = 1; i <= total; i++) {
        episodes.push({
          id: itemId + "/" + i,
          number: i,
          title: "Episodio " + i,
          pageUrl: SOURCE.baseUrl + "/ver/" + itemId + "/" + i,
        });
      }
    }
  }

  console.log("[mundodonghua] fetchChildren total=" + episodes.length);
  return episodes.sort(function(a, b) { return a.number - b.number; });
}

// ── Video List ────────────────────────────────────────────

function toBase36(n) {
  const digits = "0123456789abcdefghijklmnopqrstuvwxyz";
  if (n === 0) return "0";
  let res = "";
  while (n > 0) {
    res = digits[n % 36] + res;
    n = Math.floor(n / 36);
  }
  return res;
}

function deobfuscatePacker(p, a, c, kStr) {
  const k = kStr.split("|");
  const base = a;
  return p.replace(/\b([0-9a-z]+)\b/g, function(word) {
    const index = parseInt(word, base);
    if (isNaN(index) || index < 0 || index >= c) return word;
    const replacement = k[index];
    return (replacement !== undefined && replacement !== "") ? replacement : word;
  });
}

function extractIframeUrls(html) {
  const results = [];
  const seen = {};

  // Buscar evals de packer que inyectan iframes.
  // MundoDonghua rota el contenido del packer con frecuencia, así que el patrón
  // no depende de un radix fijo ni de un tamaño exacto de bloque.
  const packerRe = /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\((['"])([\s\S]*?)\1,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])([\s\S]*?)\5\.split\(\s*['"]\|['"]\s*\)/gi;

  let pm;
  while ((pm = packerRe.exec(html)) !== null) {
    const packed = pm[2];
    const a = parseInt(pm[3], 10);
    const c = parseInt(pm[4], 10);
    const kStr = pm[6] || "";

    if (!packed || isNaN(a) || isNaN(c) || !kStr) continue;

    const decoded = deobfuscatePacker(packed, a, c, kStr);
    const srcRe = /src=(?:\\+)?["']((?:https?:)?\/\/[^"']+)["']/gi;
    let sm;
    while ((sm = srcRe.exec(decoded)) !== null) {
      let url = sm[1].trim();
      if (url.startsWith("//")) url = "https:" + url;
      // Algunos bloques ofuscados dejan escapes residuales al final.
      url = url.replace(/\\+$/g, "").replace(/["']+$/g, "");
      if (!/^https?:\/\//i.test(url)) continue;
      if (!seen[url]) {
        seen[url] = true;
        const hostM = url.match(/^https?:\/\/([^\/]+)/i);
        const host = hostM ? hostM[1] : "unknown";
        let serverName = host
          .replace(/^www\./i, "")
          .replace(/\.com$/i, "")
          .replace(/\.sx$/i, "")
          .replace(/\.pro$/i, "");
        serverName = serverName.charAt(0).toUpperCase() + serverName.slice(1);
        results.push({ embed: url, server: serverName, quality: "" });
      }
    }
  }

  return results;
}

function fetchVideoList(episodeId) {
  console.log("[mundodonghua] fetchVideoList episodeId=" + episodeId);
  const url = SOURCE.baseUrl + "/ver/" + episodeId;
  console.log("[mundodonghua] fetchVideoList url=" + url);
  const html = http.get(url);
  if (!html) {
    console.log("[mundodonghua] No se pudo obtener la página del episodio");
    return [];
  }

  const results = [];
  const seen = {};

  // Extraer iframes de los evals packer
  const iframeResults = extractIframeUrls(html);
  for (let i = 0; i < iframeResults.length; i++) {
    const r = iframeResults[i];
    if (!seen[r.embed]) {
      seen[r.embed] = true;
      results.push(r);
    }
  }

  // También buscar el player Asura (JWPlayer) - extraer fuentes HLS si están disponibles
  const asuraScriptM = html.match(/jwplayer\("asura_player"\)\.setup\(\{[\s\S]*?sources:\s*\[(.*?)\]/);
  if (asuraScriptM) {
    const sourcesBlock = asuraScriptM[1];
    const sourceRe = /\{\s*file:\s*"([^"]+)"\s*,\s*label:\s*"([^"]*)"\s*\}/g;
    let sm;
    while ((sm = sourceRe.exec(sourcesBlock)) !== null) {
      const fileUrl = sm[1];
      const label = sm[2] || "Default";
      if (!seen[fileUrl]) {
        seen[fileUrl] = true;
        results.push({ embed: fileUrl, server: "Asura", quality: label });
      }
    }
  }

  // Buscar tabs de servidores para nombrarlos mejor
  const tabRe = /<li id="([^"]+)_tab"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/g;
  let tm;
  const tabNames = {};
  while ((tm = tabRe.exec(html)) !== null) {
    const tabId = tm[1];
    const tabName = tm[2].replace(/<[^>]+>/g, "").replace(/Ads/gi, "").trim();
    tabNames[tabId] = tabName;
  }

  // Asignar nombres de servidor basados en los tabs
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const host = r.embed.match(/^https?:\/\/([^\/]+)/);
    if (host) {
      const domain = host[1];
      // Mapear dominios a nombres de tabs
      if (domain.indexOf("bysewihe") !== -1 && tabNames.fmoon) {
        r.server = tabNames.fmoon;
      } else if (domain.indexOf("voe") !== -1 && tabNames.amagi) {
        r.server = tabNames.amagi;
      } else if (domain.indexOf("vidhide") !== -1 && tabNames.vhide) {
        r.server = tabNames.vhide;
      } else if (domain.indexOf("embedwish") !== -1 && tabNames.swish) {
        r.server = tabNames.swish;
      } else if (domain.indexOf("nemonic") !== -1 || domain.indexOf("mdplayer") !== -1) {
        r.server = tabNames.asura || "Asura";
      }
    }
  }

  console.log("[mundodonghua] fetchVideoList servers=" + results.length);
  return results;
}
