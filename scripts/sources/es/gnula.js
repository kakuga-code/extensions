// Gnula — Extensión Kazemi JS
// =========================================================

const SOURCE = {
  id: "gnula",
  name: "Gnula",
  baseUrl: "https://gnula.life",
  language: "es",
  version: "1.0.0",
  iconUrl: "https://gnula.life/favicon.ico",
  contentKind: "peliculas",
  supportedTypes: ["tv", "movie"],
  filters: [
    {
      name: "genre",
      options: [
        { id: "action",    label: "Acción" },
        { id: "animation", label: "Animación" },
        { id: "crime",     label: "Crimen" },
        { id: "family",    label: "Família" },
        { id: "mystery",   label: "Misterio" },
        { id: "thriller",  label: "Suspenso" },
        { id: "adventure", label: "Aventura" },
        { id: "sci-fi",    label: "Ciencia Ficción" },
        { id: "drama",     label: "Drama" },
        { id: "fantasy",   label: "Fantasía" },
        { id: "romance",   label: "Romance" },
        { id: "horror",    label: "Terror" }
      ]
    }
  ]
};

const DISABLED_SERVERS = ["filemoon","netu","doodstream","mega", "mega.nz", "mediafire", "zippyshare", "1fichier"];

// ── Helpers ──────────────────────────────────────────────

// Extrae el objeto JSON incrustado por Next.js en la página
function extractNextJsData(html) {
  if (!html) return null;
  const scriptRe = /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;
  const match = html.match(scriptRe);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch(e) {
      console.log("[gnula] Error al parsear __NEXT_DATA__: " + e);
    }
  }
  return null;
}

// forceSection: "series" | "movies" | null (autodetect)
function parseDirectory(html, forceSection) {
  const data = extractNextJsData(html);
  if (!data) return { items: [], hasNextPage: false };

  const pageProps = data.props && data.props.pageProps ? data.props.pageProps : {};
  const results = pageProps.results || {};
  const arr = results.data || [];

  const items = arr.map(function(item) {
    const title = (item.titles && item.titles.name) ? item.titles.name : "Desconocido";
    let poster = (item.images && item.images.poster) ? item.images.poster : null;
    if (poster) poster = poster.replace("/original/", "/w200/");

    const urlSlug = typeof item.slug === "string"
      ? item.slug
      : (item.slug && item.slug.name ? item.slug.name : "");

    // Si sabemos la sección por la URL consultada, usarla directamente
    var section = forceSection || "movies";
    if (!forceSection) {
      // fallback: intentar detectar por campos del item
      const slugData = item.url || {};
      const pageUrlStr = (slugData.canonical || slugData.path || slugData.slug || "").toLowerCase();
      const typeStr = (item.type || "").toLowerCase();
      if (pageUrlStr.indexOf("series/") !== -1 || typeStr.indexOf("serie") !== -1 || typeStr === "tv") {
        section = "series";
      }
    }

    // Normalizar tipo a valores canónicos
    const type = section === "series" ? "TV" : "Movie";
    const id = section + "/" + urlSlug;

    // Extraer rating, año, duración y géneros
    const rating = (item.rate && typeof item.rate.average === "number") ? item.rate.average : null;
    let year = null;
    if (item.releaseDate) {
      const dateMatch = item.releaseDate.match(/^(\d{4})/);
      year = dateMatch ? parseInt(dateMatch[1]) : null;
    }
    const durationMinutes = (item.runtime && typeof item.runtime === "number") ? item.runtime : null;
    const genres = (item.genres && Array.isArray(item.genres))
      ? item.genres.map(function(g) { return g.name || g; }).filter(Boolean)
      : [];

    // Status: si está disponible en el item
    let status = null;
    if (item.status) {
      const statusLower = item.status.toLowerCase();
      if (statusLower.includes("airing") || statusLower.includes("emisión")) status = "Ongoing";
      else if (statusLower.includes("finished") || statusLower.includes("concluido")) status = "Completed";
      else if (statusLower.includes("upcoming") || statusLower.includes("estrenar")) status = "Upcoming";
    }

    return {
      id: id,
      title: title,
      thumbnail: poster,
      type: type,
      pageUrl: SOURCE.baseUrl + "/" + id,
      genres: genres,
      status: status,
      rating: rating,
      year: year,
      durationMinutes: durationMinutes
    };
  });

  // Gnula.kt busca un paginador con la clase "visually-hidden" que diga "Next"
  const hasNextPage = html.indexOf("Next</span>") !== -1 || html.indexOf('rel="next"') !== -1;

  return {
    items: items,
    hasNextPage: hasNextPage
  };
}

// ── Catalog ───────────────────────────────────────────────

function fetchPopular(page) {
  const moviesHtml = http.get(SOURCE.baseUrl + "/archives/movies/page/" + page);
  const seriesHtml = http.get(SOURCE.baseUrl + "/archives/series/page/" + page);
  const movies = parseDirectory(moviesHtml, "movies");
  const series = parseDirectory(seriesHtml, "series");
  return {
    items: movies.items.concat(series.items),
    hasNextPage: movies.hasNextPage || series.hasNextPage
  };
}

function fetchLatest(page) {
  const moviesHtml = http.get(SOURCE.baseUrl + "/archives/movies/releases/page/" + page);
  const seriesHtml = http.get(SOURCE.baseUrl + "/archives/series/releases/page/" + page);
  const movies = parseDirectory(moviesHtml, "movies");
  const series = parseDirectory(seriesHtml, "series");
  return {
    items: movies.items.concat(series.items),
    hasNextPage: movies.hasNextPage || series.hasNextPage
  };
}

// Mapeo de géneros canónicos (inglés) → slug de gnula.life
const GENRE_SLUGS = {
  "action":        "accion",
  "animation":     "animacion",
  "crime":         "crimen",
  "family":        "familia",
  "mystery":       "misterio",
  "thriller":      "suspenso",
  "adventure":     "aventura",
  "sci-fi":        "ciencia-ficcion",
  "drama":         "drama",
  "fantasy":       "fantasia",
  "romance":       "romance",
  "horror":        "terror"
};

// Prefijo de sección según tipo
function sectionPrefix(type) {
  if (type === "tv") return "series";
  return "movies"; // default películas
}

function fetchSearch(query, page, filters) {
  const type  = (filters && filters.type)  ? filters.type.toLowerCase() : "";
  const genre = (filters && filters.genre) || "";
  const section = sectionPrefix(type); // "movies" o "series"

  // Nota: Gnula no soporta parámetros de ordenamiento en sus URLs, desactivado

  // Sin texto de búsqueda — navegar por directorio
  if (!query || query.trim().length === 0) {
    let url;
    // Nota: Gnula no soporta filtro simultáneo de tipo + género
    // Prioridad: género > tipo > sin filtros

    if (genre && GENRE_SLUGS[genre]) {
      // Filtrar solo por género (ignora tipo si está presente)
      // Estructura: /genres/{slug} (página 1) o /genres/{slug}/page/{page} (página 2+)
      if (page === 1 || page === "1") {
        url = SOURCE.baseUrl + "/genres/" + GENRE_SLUGS[genre];
      } else {
        url = SOURCE.baseUrl + "/genres/" + GENRE_SLUGS[genre] + "/page/" + page;
      }
      console.log("[gnula] fetchSearch genre: " + url);
      // Sin tipo específico: retornar mezclado (series y películas)
      return parseDirectory(http.get(url), null);
    } else if (type) {
      // Solo tipo, sin género
      url = SOURCE.baseUrl + "/archives/" + section + "/page/" + page;
      console.log("[gnula] fetchSearch type only: " + url);
      return parseDirectory(http.get(url), section);
    } else {
      // Sin filtros: mostrar todos
      url = SOURCE.baseUrl + "/archives/" + section + "/page/" + page;
      console.log("[gnula] fetchSearch browse: " + url);
      return parseDirectory(http.get(url), section);
    }
  }

  // Con texto — búsqueda libre (gnula no soporta filtro de tipo en búsqueda)
  const url = SOURCE.baseUrl + "/search?q=" + encodeURIComponent(query.trim()) + "&p=" + page;
  console.log("[gnula] fetchSearch query: " + url);
  // Para búsqueda de texto gnula mezcla — no podemos saber el tipo por la URL,
  // pero podemos pedir ambas secciones por separado si hay tipo forzado
  if (type === "tv" || type === "serie") {
    return parseDirectory(http.get(url), "series");
  } else if (type === "movie" || type === "película") {
    return parseDirectory(http.get(url), "movies");
  }
  // Sin tipo: retornar mezclado (el slug no tiene info de sección, asumir movie como fallback)
  return parseDirectory(http.get(url), null);
}

// ── Anime Detail ──────────────────────────────────────────

function fetchItemDetails(id) {
  // id viene como "movies/slug" o "series/slug"
  const html = http.get(SOURCE.baseUrl + "/" + id);
  const data = extractNextJsData(html);
  if (!data) return { title: id };

  const post = (data.props && data.props.pageProps && data.props.pageProps.post) ? data.props.pageProps.post : {};
  
  const title = (post.titles && post.titles.name) ? post.titles.name : id.replace(/^(movies|series)\//, "");
  const poster = (post.images && post.images.poster) ? post.images.poster : null;
  const overview = post.overview || "";
  
  const genres = (post.genres || []).map(function(g) { return g.name; }).filter(Boolean);

  let artist = "";
  if (post.cast && post.cast.acting && post.cast.acting.length > 0) {
    artist = post.cast.acting[0].name || "";
  }

  const isMovie = id.indexOf("movies/") !== -1;
  const status = isMovie ? "Completed" : "Unknown";

  return {
    title: title,
    synopsis: overview,
    cover: poster,
    genres: genres,
    type: isMovie ? "Movie" : "Serie",
    status: status,
    artist: artist, // Adaptado del field artist
    related: []
  };
}

// ── Episode List ──────────────────────────────────────────

function fetchChildren(itemId) {
  const animeId = itemId;
  const html = http.get(SOURCE.baseUrl + "/" + animeId);
  const data = extractNextJsData(html);
  if (!data) return [];

  // Si es una película, retornamos un único episodio ficticio apuntando a la misma página
  if (animeId.indexOf("movies/") !== -1) {
    return [{
      id: animeId,
      number: 1,
      title: "Película",
      pageUrl: SOURCE.baseUrl + "/" + animeId
    }];
  }

  // Si es una serie (SeasonModel), mapeamos las temporadas y episodios
  const post = (data.props && data.props.pageProps && data.props.pageProps.post) ? data.props.pageProps.post : {};
  const seasons = post.seasons || [];
  
  const allEpisodes = [];
  let epCounter = 1;

  seasons.forEach(function(season) {
    const sNum = season.number || 0;
    (season.episodes || []).forEach(function(ep) {
      if (!ep.slug || !ep.slug.name) return;
      
      // La URL del episodio en Gnula para series es:
      // /series/{slug.name}/seasons/{slug.season}/episodes/{slug.episode}
      const epId = "series/" + ep.slug.name + "/seasons/" + ep.slug.season + "/episodes/" + ep.slug.episode;
      
      allEpisodes.push({
        id: epId,
        number: epCounter++,
        title: "T" + sNum + " - E" + ep.number + " - " + (ep.title || "Episodio"),
        pageUrl: SOURCE.baseUrl + "/" + epId
      });
    });
  });

  // Kazemi JS normalmente espera la lista en orden descendente (del más nuevo al más viejo)
  return allEpisodes.reverse(); 
}

// ── Video List ────────────────────────────────────────────

// Resuelve el proxy player.gnula.life/player.php?h=... al embed real
// El proxy devuelve HTML con un <iframe src="..."> o un redirect meta/Location
function resolveGnulaProxy(proxyUrl) {
  console.log("[gnula] Resolviendo proxy: " + proxyUrl);
  
  // Añadir headers para evitar bloqueos
  const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Referer": "https://gnula.life/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  };
  
  const html = http.get(proxyUrl, headers);
  console.log("[gnula] Proxy HTML length=" + (html ? html.length : 0) + " preview=" + (html ? html.substring(0, 200) : "null"));
  if (!html || html.length === 0) return proxyUrl;

  // Buscar iframe src - patrón más flexible
  const iframeMatch = html.match(/<iframe[^>]+src\s*=\s*["']([^"']+)["']/i);
  if (iframeMatch) {
    const iframeSrc = iframeMatch[1];
    console.log("[gnula] Proxy → iframe: " + iframeSrc);
    // Asegurar que la URL sea absoluta
    if (iframeSrc.startsWith("//")) {
      return "https:" + iframeSrc;
    } else if (iframeSrc.startsWith("/")) {
      return "https://player.gnula.life" + iframeSrc;
    }
    return iframeSrc;
  }

  // Buscar meta refresh o window.location
  const metaMatch = html.match(/content=["']\d+;\s*url=([^"']+)["']/i)
                 || html.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/);
  if (metaMatch) {
    const redirectUrl = metaMatch[1];
    console.log("[gnula] Proxy → redirect: " + redirectUrl);
    // Asegurar que la URL sea absoluta
    if (redirectUrl.startsWith("//")) {
      return "https:" + redirectUrl;
    } else if (redirectUrl.startsWith("/")) {
      return "https://player.gnula.life" + redirectUrl;
    }
    return redirectUrl;
  }

  // URL directa de stream (m3u8, mp4, etc.)
  const streamMatch = html.match(/(https?:\/\/[^\s"'<>]+\.(?:m3u8|mp4|mkv|avi|mov)[^\s"'<>]*)/i);
  if (streamMatch) {
    console.log("[gnula] Proxy → stream directo: " + streamMatch[1]);
    return streamMatch[1];
  }

  // Buscar URLs en atributos data-src, data-url, etc.
  const dataUrlMatch = html.match(/data-(?:src|url)\s*=\s*["']([^"']+)["']/i);
  if (dataUrlMatch) {
    const dataUrl = dataUrlMatch[1];
    console.log("[gnula] Proxy → data-url: " + dataUrl);
    if (dataUrl.startsWith("//")) {
      return "https:" + dataUrl;
    } else if (dataUrl.startsWith("/")) {
      return "https://player.gnula.life" + dataUrl;
    }
    return dataUrl;
  }

  // Cualquier URL https en el HTML que no sea gnula
  const anyUrlMatch = html.match(/["'](https?:\/\/(?!(?:gnula|player\.gnula))[^\s"'<>]{20,})["']/);
  if (anyUrlMatch) {
    console.log("[gnula] Proxy → URL encontrada: " + anyUrlMatch[1]);
    return anyUrlMatch[1];
  }

  console.log("[gnula] Proxy no resuelto");
  return proxyUrl;
}

// Recrea la lógica toVideoList de Gnula.kt
function extractVideosFromPlayers(players) {
  const results = [];
  const langs = [
    { key: "latino", label: "[LAT]" },
    { key: "spanish", label: "[CAST]" },
    { key: "english", label: "[SUB]" }
  ];

  langs.forEach(function(langObj) {
    const pList = players[langObj.key] || [];
    pList.forEach(function(p) {
      if (!p.result) return;

      const serverName = (p.cyberlocker || "unknown").toLowerCase();
      if (DISABLED_SERVERS.indexOf(serverName) !== -1) return;

      const serverLabel = p.cyberlocker || "Unknown";

      // Si el resultado pasa por el proxy de gnula, resolverlo primero
      let embedUrl = p.result;
      if (embedUrl.indexOf("player.gnula.life") !== -1) {
        embedUrl = resolveGnulaProxy(embedUrl);
      }

      // Verificar si la URL es de doodstream (incluyendo redirección a playmogo)
      const isDoodstream = serverName.includes("doodstream") || 
                          embedUrl.includes("doodstream.com") || 
                          embedUrl.includes("dood.to") ||
                          embedUrl.includes("dood.wf") ||
                          embedUrl.includes("dood.ws") ||
                          embedUrl.includes("dood.pm") ||
                          embedUrl.includes("dood.cx") ||
                          embedUrl.includes("dood.sh") ||
                          embedUrl.includes("dood.la") ||
                          embedUrl.includes("dood.re") ||
                          embedUrl.includes("dood.watch") ||
                          embedUrl.includes("doodstream.co") ||
                          embedUrl.includes("doodstream.net") ||
                          embedUrl.includes("dsvplay.com") ||
                          embedUrl.includes("playmogo.com");

      // Para doodstream, siempre usar embed para que el extractor JS lo procese
      const isDirectStream = embedUrl.indexOf(".m3u8") !== -1 || embedUrl.indexOf(".mp4") !== -1;
      const entry = {
        server: serverLabel,
        quality: langObj.label + " — " + serverLabel
      };
      
      if (isDirectStream && !isDoodstream) {
        entry.url = embedUrl;
      } else {
        entry.embed = embedUrl;
      }
      
      console.log("[gnula] Video entry: " + serverLabel + " -> " + (entry.url ? "url: " + entry.url.substring(0, 80) : "embed: " + entry.embed.substring(0, 80)));
      results.push(entry);
    });
  });

  console.log("[gnula] Total videos extraídos de players: " + results.length);
  return results;
}

function fetchVideoList(episodeId) {
  console.log("[gnula] fetchVideoList para: " + episodeId);
  
  // Headers mejorados para evitar Cloudflare y bloqueos
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": SOURCE.baseUrl + "/",
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
  
  const html = http.get(SOURCE.baseUrl + "/" + episodeId, headers);
  console.log("[gnula] HTML obtenido, length: " + (html ? html.length : 0));
  
  // Verificar si hay Cloudflare challenge
  if (html && (html.includes("cf-browser-verification") || 
               html.includes("cloudflare") || 
               html.includes("challenge-form") ||
               html.includes("jschl_vc") ||
               html.includes("jschl_answer"))) {
    console.log("[gnula] Cloudflare detectado, intentando con headers alternativos...");
    
    // Headers alternativos más simples
    const altHeaders = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      "Referer": SOURCE.baseUrl + "/",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    };
    
    const altHtml = http.get(SOURCE.baseUrl + "/" + episodeId, altHeaders);
    if (altHtml && !altHtml.includes("cf-browser-verification")) {
      console.log("[gnula] Headers alternativos funcionaron, length: " + altHtml.length);
      const data = extractNextJsData(altHtml);
      if (!data) {
        console.log("[gnula] No se pudo extraer __NEXT_DATA__ con headers alternativos");
        return [];
      }
      // Continuar con el procesamiento normal usando altHtml
      return processVideoListData(altHtml, data, episodeId);
    }
  }
  
  const data = extractNextJsData(html);
  if (!data) {
    console.log("[gnula] No se pudo extraer __NEXT_DATA__");
    return [];
  }
  
  return processVideoListData(html, data, episodeId);
}

// Función auxiliar para procesar los datos de video list
function processVideoListData(html, data, episodeId) {

  let players = {};
  
  // Dependiendo de si es película o episodio (serie), el objeto "players" está en distinto lugar
  if (episodeId.indexOf("movies/") !== -1) {
    const post = (data.props && data.props.pageProps && data.props.pageProps.post) ? data.props.pageProps.post : {};
    players = post.players || {};
    console.log("[gnula] Película - players encontrados: " + Object.keys(players).length + " idiomas");
  } else {
    const episode = (data.props && data.props.pageProps && data.props.pageProps.episode) ? data.props.pageProps.episode : {};
    players = episode.players || {};
    console.log("[gnula] Episodio - players encontrados: " + Object.keys(players).length + " idiomas");
  }

  // Log detallado de los players encontrados
  Object.keys(players).forEach(function(lang) {
    const pList = players[lang] || [];
    console.log("[gnula] Idioma " + lang + ": " + pList.length + " servidores");
    pList.forEach(function(p, i) {
      console.log("[gnula]   [" + lang + "][" + i + "] " + (p.cyberlocker || "unknown") + ": " + (p.result ? p.result.substring(0, 80) : "null"));
    });
  });

  const videos = extractVideosFromPlayers(players);
  console.log("[gnula] Total videos extraídos: " + videos.length);
  
  return videos;
}
