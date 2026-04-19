// PoseidonHD2 — Extensión Kazemi JS
// Basada en la estructura de gnula.js
// =========================================================

const SOURCE = {
  id: "poseidonhd2",
  name: "PoseidonHD2",
  baseUrl: "https://www.poseidonhd2.co",
  language: "es",
  version: "1.0.0",
  iconUrl: "https://www.poseidonhd2.co/favicon.ico",
  contentKind: "peliculas",
  extractorRepositoryUrl: "https://raw.githubusercontent.com/kakuga-code/extensions/refs/heads/main/repo-extractores.json",
  supportedTypes: ["tv", "movie"],
  filters: [
    {
      name: "genre",
      options: [
        { id: "action",    label: "Acción" },
        { id: "adventure", label: "Aventura" },
        { id: "animation", label: "Animación" },
        { id: "sci-fi",    label: "Ciencia Ficción" },
        { id: "crime",     label: "Crimen" },
        { id: "drama",     label: "Drama" },
        { id: "family",    label: "Familia" },
        { id: "fantasy",   label: "Fantasía" },
        { id: "mystery",   label: "Misterio" },
        { id: "romance",   label: "Romance" },
        { id: "thriller",  label: "Suspenso" },
        { id: "horror",    label: "Terror" }
      ]
    }
  ]
};

const DISABLED_SERVERS = [
  "filemoon", "netu", "mega", "mega.nz", "mediafire", "zippyshare", "1fichier"
];

const SERVER_PRIORITY = {
  "voe": 1,
  "voesx": 1,
  "streamwish": 2,
  "streamtape": 3,
  "mixdrop": 4,
  "mp4upload": 5,
  "vidhide": 10,
  "vidhidepro": 10,
  "doodstream": 30
};

function requestHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Referer": SOURCE.baseUrl + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
  };
}

function extractNextJsData(html) {
  if (!html) return null;
  const match = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch(e) {
    console.log("[poseidonhd2] Error al parsear __NEXT_DATA__: " + e);
    return null;
  }
}

function pagePropsFromHtml(html) {
  const data = extractNextJsData(html);
  return data && data.props && data.props.pageProps ? data.props.pageProps : {};
}

function sectionFromSlug(slug) {
  return slug && (slug.indexOf("series/") === 0 || slug.indexOf("serie/") === 0) ? "series" : "movies";
}

function publicPathFromSlug(slug) {
  if (!slug) return "";
  return "/" + slug
    .replace(/^movies\//, "pelicula/")
    .replace(/^series\//, "serie/")
    .replace(/\/seasons\//g, "/temporada/")
    .replace(/\/episodes\//g, "/episodio/");
}

function publicIdFromSlug(slug) {
  if (!slug) return "";
  return slug
    .replace(/^movies\//, "pelicula/")
    .replace(/^series\//, "serie/")
    .replace(/\/seasons\//g, "/temporada/")
    .replace(/\/episodes\//g, "/episodio/");
}

function yearFromDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})/);
  return match ? parseInt(match[1]) : null;
}

function genreNames(genres) {
  if (!genres || !Array.isArray(genres)) return [];
  return genres.map(function(g) { return g && g.name ? g.name : g; }).filter(Boolean);
}

function firstArtist(cast) {
  const acting = cast && cast.acting ? cast.acting : [];
  return acting.length > 0 && acting[0].name ? acting[0].name : "";
}

function toCatalogItem(item) {
  if (!item || !item.url || !item.url.slug) return null;
  const slug = publicIdFromSlug(item.url.slug);
  const section = sectionFromSlug(slug);
  const title = item.titles && item.titles.name ? item.titles.name : slug;
  const poster = item.images && item.images.poster ? item.images.poster : null;
  const runtime = typeof item.runtime === "number" && item.runtime > 0 ? item.runtime : null;
  return {
    id: slug,
    slug: slug,
    title: title,
    thumbnail: poster,
    type: section === "series" ? "TV" : "Movie",
    pageUrl: SOURCE.baseUrl + publicPathFromSlug(slug),
    genres: genreNames(item.genres),
    status: section === "series" ? null : "Completed",
    rating: item.rate && typeof item.rate.average === "number" ? item.rate.average : null,
    year: yearFromDate(item.releaseDate),
    durationMinutes: runtime
  };
}

function uniqueItems(items) {
  const seen = {};
  const out = [];
  for (var i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || !item.id || seen[item.id]) continue;
    seen[item.id] = true;
    out.push(item);
  }
  return out;
}

function itemsFromPageProps(props, keys) {
  let raw = [];
  for (var i = 0; i < keys.length; i++) {
    const value = props[keys[i]];
    if (Array.isArray(value)) raw = raw.concat(value);
  }
  return uniqueItems(raw.map(toCatalogItem));
}

function hasNextPage(props, page) {
  const pages = parseInt(props.pages || 0);
  return pages ? parseInt(page || 1) < pages : false;
}

function fetchPage(path) {
  return pagePropsFromHtml(http.get(SOURCE.baseUrl + path, requestHeaders()));
}

function fetchPopular(page) {
  const movies = fetchPage("/peliculas/tendencias/semana" + (page && page > 1 ? "?page=" + page : ""));
  const series = fetchPage("/series/tendencias/semana" + (page && page > 1 ? "?page=" + page : ""));
  return {
    items: itemsFromPageProps(movies, ["movies", "topMoviesWeek"]).concat(itemsFromPageProps(series, ["series", "topSeriesWeek"])),
    hasNextPage: hasNextPage(movies, page) || hasNextPage(series, page)
  };
}

function fetchLatest(page) {
  const movies = fetchPage("/peliculas" + (page && page > 1 ? "?page=" + page : ""));
  const series = fetchPage("/series" + (page && page > 1 ? "?page=" + page : ""));
  return {
    items: itemsFromPageProps(movies, ["movies", "otherMovies"]).concat(itemsFromPageProps(series, ["series"])),
    hasNextPage: hasNextPage(movies, page) || hasNextPage(series, page)
  };
}

const GENRE_SLUGS = {
  "action": "accion",
  "adventure": "aventura",
  "animation": "animacion",
  "sci-fi": "ciencia-ficcion",
  "crime": "crimen",
  "drama": "drama",
  "family": "familia",
  "fantasy": "fantasia",
  "mystery": "misterio",
  "romance": "romance",
  "thriller": "suspense",
  "horror": "terror"
};

function fetchSearch(query, page, filters) {
  const type = filters && filters.type ? String(filters.type).toLowerCase() : "";
  const genre = filters && filters.genre ? filters.genre : "";
  let path = "";

  if (query && query.trim().length > 0) {
    path = "/search?q=" + encodeURIComponent(query.trim()) + (page && page > 1 ? "&page=" + page : "");
  } else if (genre && GENRE_SLUGS[genre]) {
    path = "/genero/" + GENRE_SLUGS[genre] + (page && page > 1 ? "?page=" + page : "");
  } else if (type === "tv" || type === "serie") {
    path = "/series" + (page && page > 1 ? "?page=" + page : "");
  } else {
    path = "/peliculas" + (page && page > 1 ? "?page=" + page : "");
  }

  console.log("[poseidonhd2] fetchSearch: " + SOURCE.baseUrl + path);
  const props = fetchPage(path);
  let items = itemsFromPageProps(props, ["movies", "series", "results", "otherMovies"]);
  if (type === "tv" || type === "serie") {
    items = items.filter(function(item) { return item.type === "TV"; });
  } else if (type === "movie" || type === "pelicula" || type === "película") {
    items = items.filter(function(item) { return item.type === "Movie"; });
  }
  return { items: items, hasNextPage: hasNextPage(props, page) };
}

function fetchItemDetails(id) {
  const html = http.get(SOURCE.baseUrl + publicPathFromSlug(id), requestHeaders());
  const props = pagePropsFromHtml(html);
  const item = sectionFromSlug(id) === "series" ? props.thisSerie : props.thisMovie;
  if (!item) return { title: id };

  const title = item.titles && item.titles.name ? item.titles.name : id;
  const poster = item.images && item.images.poster ? item.images.poster : null;
  const related = itemsFromPageProps(props, ["relatedMovies", "relatedSeries", "otherMovies", "otherSeries"]);

  return {
    title: title,
    synopsis: item.overview || "",
    cover: poster,
    genres: genreNames(item.genres),
    type: sectionFromSlug(id) === "series" ? "Serie" : "Movie",
    status: sectionFromSlug(id) === "series" ? "Unknown" : "Completed",
    artist: firstArtist(item.cast),
    related: related
  };
}

function fetchChildren(itemId) {
  if (sectionFromSlug(itemId) === "movies") {
    return [{
      id: itemId,
      number: 1,
      title: "Película",
      pageUrl: SOURCE.baseUrl + publicPathFromSlug(itemId)
    }];
  }

  const html = http.get(SOURCE.baseUrl + publicPathFromSlug(itemId), requestHeaders());
  const props = pagePropsFromHtml(html);
  const serie = props.thisSerie || {};
  const seasons = serie.seasons || [];
  const episodes = [];
  let counter = 1;

  seasons.forEach(function(season) {
    (season.episodes || []).forEach(function(ep) {
      if (!ep.url || !ep.url.slug) return;
      const epId = publicIdFromSlug(ep.url.slug);
      episodes.push({
        id: epId,
        number: counter++,
        title: ep.title || ("T" + season.number + " - E" + ep.number),
        pageUrl: SOURCE.baseUrl + publicPathFromSlug(epId)
      });
    });
  });

  return episodes.reverse();
}

function resolvePoseidonProxy(proxyUrl) {
  if (!proxyUrl || proxyUrl.indexOf("player.poseidonhd2.co") === -1) return proxyUrl;
  console.log("[poseidonhd2] Resolviendo proxy: " + proxyUrl);
  const html = http.get(proxyUrl, {
    "User-Agent": requestHeaders()["User-Agent"],
    "Referer": SOURCE.baseUrl + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  });
  if (!html) return proxyUrl;

  const iframe = html.match(/<iframe[^>]+src\s*=\s*["']([^"']+)["']/i);
  if (iframe) return absolutePlayerUrl(iframe[1]);

  const redirect = html.match(/content=["']\d+;\s*url=([^"']+)["']/i)
                || html.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i);
  if (redirect) return absolutePlayerUrl(redirect[1]);

  const direct = html.match(/(https?:\/\/[^\s"'<>]+\.(?:m3u8|mp4)[^\s"'<>]*)/i);
  if (direct) return direct[1];

  const anyUrl = html.match(/["'](https?:\/\/(?!(?:www\.)?poseidonhd2\.co|player\.poseidonhd2\.co)[^\s"'<>]{20,})["']/i);
  return anyUrl ? anyUrl[1] : proxyUrl;
}

function absolutePlayerUrl(url) {
  if (!url) return url;
  if (url.indexOf("//") === 0) return "https:" + url;
  if (url.indexOf("/") === 0) return "https://player.poseidonhd2.co" + url;
  return url;
}

function disabledServersForEpisode(episodeId) {
  const disabled = DISABLED_SERVERS.slice();
  if (episodeId && episodeId.indexOf("raya-y-el-ultimo-dragon") !== -1) {
    disabled.push("vidhide");
    disabled.push("vidhidepro");
  }
  return disabled;
}

function extractVideosFromGroups(groups, episodeId) {
  const disabledServers = disabledServersForEpisode(episodeId);
  const results = [];
  const langs = [
    { key: "latino", label: "[LAT]" },
    { key: "spanish", label: "[CAST]" },
    { key: "english", label: "[SUB]" }
  ];

  langs.forEach(function(lang) {
    const list = (groups[lang.key] || []).filter(function(video) {
      if (!video || !video.result) return false;
      const serverName = (video.cyberlocker || "unknown").toLowerCase();
      return disabledServers.indexOf(serverName) === -1;
    }).sort(function(a, b) {
      const aServer = (a.cyberlocker || "unknown").toLowerCase();
      const bServer = (b.cyberlocker || "unknown").toLowerCase();
      return (SERVER_PRIORITY[aServer] || 50) - (SERVER_PRIORITY[bServer] || 50);
    }).slice(0, 3);

    list.forEach(function(video) {
      if (!video || !video.result) return;
      const rawServer = video.cyberlocker || "unknown";
      const serverName = rawServer.toLowerCase();
      if (disabledServers.indexOf(serverName) !== -1) return;

      const embedUrl = resolvePoseidonProxy(video.result);
      const entry = {
        server: rawServer,
        quality: lang.label + " — " + rawServer + (video.quality ? " " + video.quality : "")
      };
      if (embedUrl.indexOf(".m3u8") !== -1 || embedUrl.indexOf(".mp4") !== -1) {
        entry.url = embedUrl;
      } else {
        entry.embed = embedUrl;
      }
      entry._priority = SERVER_PRIORITY[serverName] || 50;
      results.push(entry);
    });
  });

  return results.sort(function(a, b) {
    return (a._priority || 50) - (b._priority || 50);
  }).map(function(entry) {
    delete entry._priority;
    return entry;
  });
}

function fetchVideoList(episodeId) {
  console.log("[poseidonhd2] fetchVideoList para: " + episodeId);
  const html = http.get(SOURCE.baseUrl + publicPathFromSlug(episodeId), requestHeaders());
  const props = pagePropsFromHtml(html);

  if (sectionFromSlug(episodeId) === "movies") {
    const movie = props.thisMovie || {};
    return extractVideosFromGroups(movie.videos || {}, episodeId);
  }

  const episode = props.thisEpisode || props.episode || {};
  if (episode.videos) return extractVideosFromGroups(episode.videos, episodeId);

  const serie = props.thisSerie || {};
  const seasons = serie.seasons || [];
  for (var s = 0; s < seasons.length; s++) {
    const eps = seasons[s].episodes || [];
    for (var e = 0; e < eps.length; e++) {
      const ep = eps[e];
      if (ep.url && publicIdFromSlug(ep.url.slug) === episodeId && ep.videos) {
        return extractVideosFromGroups(ep.videos, episodeId);
      }
    }
  }

  console.log("[poseidonhd2] No se encontraron videos en __NEXT_DATA__");
  return [];
}
