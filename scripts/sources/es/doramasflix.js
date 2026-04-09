// Doramasflix — Extensión Kazemi JS
// =========================================================

const SOURCE = {
  id: "doramasflix",
  name: "Doramasflix",
  baseUrl: "https://doramasflix.in",
  language: "es",
  version: "1.0.2",
  iconUrl: "https://doramasflix.in/favicon.ico",
  contentKind: "anime"
};
const DISABLED_SERVERS = ["filemoon", "mega", "mega.nz", "mediafire", "zippyshare", "1fichier"];

const API_URL = "https://sv1.fluxcedene.net/api/gql";
const ACCESS_PLATFORM = "95j8cNjP19_NeJAzoyz14A9_BXkWDMTc3NTU0MzQwMw==";

const API_HEADERS = {
  "authority": "sv1.fluxcedene.net",
  "accept": "application/json, text/plain, */*",
  "content-type": "application/json;charset=UTF-8",
  "origin": "https://doramasflix.in",
  "referer": "https://doramasflix.in/",
  "platform": "doramasflix",
  "authorization": "Bear",
  "x-access-jwt-token": "",
  "x-access-platform": ACCESS_PLATFORM
};

// Filtro de categorías (Géneros en la UI)
const GENRE_FILTERS = [
  { name: "Doramas", value: "doramas" },
  { name: "Películas", value: "peliculas" },
  { name: "Variedades", value: "variedades" }
];

// Géneros individuales disponibles en el sitio web (para detalles)
const GENRE_MAP = {
  "accion": "Acción",
  "aventura": "Aventura",
  "ciencia-ficcion": "Ciencia ficción",
  "comedia": "Comedia",
  "crimen": "Crimen",
  "documental": "Documental",
  "drama": "Drama",
  "familia": "Familia",
  "fantasia": "Fantasía",
  "history": "History",
  "misterio": "Misterio",
  "music": "Music",
  "politica": "Política",
  "romance": "Romance",
  "soap": "Soap",
  "terror": "Terror",
  "thriller": "Thriller",
  "war": "War"
};

const LANG_MAP = {
  "36": "[ENG]", "37": "[CAST]", "38": "[LAT]", "192": "[SUB]",
  "1327": "[POR]", "13109": "[COR]", "13110": "[JAP]", "13111": "[MAN]",
  "13112": "[TAI]", "13113": "[FIL]", "13114": "[IND]", "343422": "[VIET]"
};

const SERVER_ID_MAP = {
  "1230": "Voe",
  "1233": "Uqload",
  "958695": "Filemoon",
  "1232": "DoodStream",
  "7286": "DoodStream",
  "1113": "Okru",
  "1231": "Fastream",
  "1234": "StreamWish",
  "1235": "Upstream",
  "1236": "StreamTape",
  "1237": "StreamHide"
};

const GET_EPISODE_LINKS_QUERY = "query GetEpisodeLinks($id: MongoID!, $app: String) { getEpisodeLinks(id: $id, app: $app) { links_online __typename } }";
const GET_MOVIE_LINKS_QUERY = "query GetMovieLinks($id: MongoID!, $app: String) { getMovieLinks(id: $id, app: $app) { links_online __typename } }";

// ── Helpers ──────────────────────────────────────────────

function getImageUrl(url, isThumb) {
  if (!url) return null;
  if (url.indexOf("http") === 0) return url;
  if (isThumb) return "https://image.tmdb.org/t/p/w220_and_h330_face" + url;
  return "https://image.tmdb.org/t/p/w500" + url;
}

function getLang(id) {
  return LANG_MAP[String(id)] || ("[" + id + "]");
}

function postGQL(bodyObj) {
  try {
    const resStr = http.post(API_URL, JSON.stringify(bodyObj), API_HEADERS);
    return JSON.parse(resStr);
  } catch (e) {
    console.log("[doramasflix] Error GraphQL: " + e);
    return null;
  }
}

function extractNextData(html) {
  if (!html) return null;
  const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    console.log("[doramasflix] Error parseando __NEXT_DATA__: " + e);
    return null;
  }
}

function extractApolloState(html) {
  const data = extractNextData(html);
  if (data && data.props && data.props.pageProps && data.props.pageProps.apolloState) {
    return data.props.pageProps.apolloState;
  }
  return null;
}

function mapItem(item) {
  const title = item.name + (item.name_es ? " (" + item.name_es + ")" : "");
  const poster = item.poster_path || item.poster;
  const typename = item.__typename ? item.__typename.toLowerCase() : "dorama";
  const isTVShow = item.isTVShow === true;
  const urlType = typename === "movie" ? "peliculas-online" : "doramas-online";
  const genreList = (item.genres || []).map(function (g) { return g.name || g; }).filter(Boolean);

  // Normalize type to canonical values: TV, Movie, OVA, ONA, Special, Unknown
  let type;
  if (typename === "movie") {
    type = "Movie";
  } else if (isTVShow) {
    type = "TV";  // Variedades are TV shows
  } else {
    type = "TV";  // Doramas are TV shows
  }

  // Extract rating (vote_average from API)
  const rating = item.vote_average || null;

  // Extract year from first_air_date or release_date
  let year = null;
  if (item.first_air_date) {
    year = parseInt(item.first_air_date.substring(0, 4), 10) || null;
  } else if (item.release_date) {
    year = parseInt(item.release_date.substring(0, 4), 10) || null;
  }

  return {
    id: typename + "|" + item.slug + "|" + item._id,
    slug: item.slug,
    title: title,
    thumbnail: getImageUrl(poster, true),
    type: type,
    genres: genreList,       // Return as array instead of comma-separated string
    status: null,            // Status not available in catalog
    rating: rating,          // Rating from vote_average
    year: year,              // Year extracted from air_date or release_date
    pageUrl: SOURCE.baseUrl + "/" + urlType + "/" + item.slug + "?id=" + item._id
  };
}

function parsePagination(json, rootKey) {
  if (!json || !json.data || !json.data[rootKey]) return { items: [], hasNextPage: false };
  const pagination = json.data[rootKey];
  const hasNextPage = pagination.pageInfo ? pagination.pageInfo.hasNextPage : false;
  return {
    items: (pagination.items || []).map(mapItem),
    hasNextPage: hasNextPage
  };
}

// ── Catalog ───────────────────────────────────────────────

const DORAMA_LIST_QUERY = "query listDoramas($page: Int, $perPage: Int, $sort: SortFindManyDoramaInput, $filter: FilterFindManyDoramaInput) { paginationDorama(page: $page, perPage: $perPage, sort: $sort, filter: $filter) { count pageInfo { currentPage hasNextPage hasPreviousPage __typename } items { _id name name_es slug cast names overview languages created_by popularity poster_path vote_average backdrop_path first_air_date episode_run_time isTVShow poster backdrop genres { name slug __typename } networks { name slug __typename } __typename } __typename } }";

const MOVIE_LIST_QUERY = "query listMovies($page: Int, $perPage: Int, $sort: SortFindManyMovieInput, $filter: FilterFindManyMovieInput) { paginationMovie(page: $page, perPage: $perPage, sort: $sort, filter: $filter) { count pageInfo { currentPage hasNextPage hasPreviousPage __typename } items { _id name name_es slug cast names overview languages popularity poster_path vote_average backdrop_path release_date runtime poster backdrop genres { name __typename } networks { name __typename } __typename } __typename } }";

function fetchPopular(page) {
  const body = {
    operationName: "listDoramas",
    variables: { page: page, sort: "POPULARITY_DESC", perPage: 32, filter: { isTVShow: false } },
    query: DORAMA_LIST_QUERY
  };
  return parsePagination(postGQL(body), "paginationDorama");
}

function fetchLatest(page) {
  const body = {
    operationName: "listDoramas",
    variables: { page: page, sort: "CREATEDAT_DESC", perPage: 32, filter: { isTVShow: false } },
    query: DORAMA_LIST_QUERY
  };
  return parsePagination(postGQL(body), "paginationDorama");
}

function fetchSearch(query, page, filters) {
  if (!query || query.trim().length === 0) {
    // Filtro por categoría (Doramas, Películas, Variedades)
    if (filters && filters.genre) {
      if (filters.genre === "peliculas") {
        const body = {
          operationName: "listMovies",
          variables: { perPage: 32, sort: "CREATEDAT_DESC", filter: {}, page: page },
          query: MOVIE_LIST_QUERY
        };
        return parsePagination(postGQL(body), "paginationMovie");
      } else if (filters.genre === "variedades") {
        // Variedades = TV Shows (isTVShow: true)
        const body = {
          operationName: "listDoramas",
          variables: { page: page, sort: "CREATEDAT_DESC", perPage: 32, filter: { isTVShow: true } },
          query: DORAMA_LIST_QUERY
        };
        return parsePagination(postGQL(body), "paginationDorama");
      }
      // "doramas" o cualquier otro género: usar filtro isTVShow: false
    }
    // Por defecto: Doramas (isTVShow: false)
    return fetchPopular(page);
  }

  // Búsqueda por texto — la API no soporta paginación en searchAll
  const body = {
    operationName: "searchAll",
    variables: { input: query.trim().replace(/\+/g, " ") },
    query: "query searchAll($input: String!) { searchDorama(input: $input, limit: 32) { _id slug name name_es poster_path poster __typename } searchMovie(input: $input, limit: 32) { _id name name_es slug poster_path poster __typename } }"
  };

  const json = postGQL(body);
  if (!json || !json.data) return { items: [], hasNextPage: false };

  const list = [].concat(json.data.searchDorama || [], json.data.searchMovie || []);
  return { items: list.map(mapItem), hasNextPage: false };
}

// ── Anime Detail ──────────────────────────────────────────

function fetchItemDetails(idStr) {
  const parts = idStr.split("|");
  const type = parts[0] || "dorama";
  const slug = parts[1] || idStr;
  const id = parts[2] || "";

  const path = type === "movie"
    ? "/peliculas-online/" + slug + "?id=" + id
    : "/doramas-online/" + slug + "?id=" + id;

  const html = http.get(SOURCE.baseUrl + path);
  const apolloState = extractApolloState(html);
  if (!apolloState) return { title: slug };

  let dorama = null;
  var genres = [];
  var artist = "";

  for (var key in apolloState) {
    const obj = apolloState[key];
    if (!dorama && key.match(/^(Movie|Dorama):[a-f0-9]/i)) {
      dorama = obj;
    }
    if (obj && obj.name && key.match(/Genre:/i)) {
      genres.push(obj.name);
    }
  }

  if (!dorama) return { title: slug };

  if (dorama.cast && dorama.cast.json && dorama.cast.json.length > 0) {
    artist = dorama.cast.json[0].name || "";
  }

  const itemType = (dorama.__typename || type).toLowerCase();
  const isTVShow = dorama.isTVShow === true;
  const title = dorama.name + (dorama.name_es ? " (" + dorama.name_es + ")" : "");

  // Normalize type to canonical values: TV, Movie, OVA, ONA, Special, Unknown
  let normalizedType;
  if (itemType === "movie") {
    normalizedType = "Movie";
  } else if (isTVShow || itemType === "dorama") {
    normalizedType = "TV";
  } else {
    normalizedType = "Unknown";
  }

  // Map status if available (movies: Completed, TV shows: typically Ongoing or Unknown)
  let mappedStatus = null;
  if (itemType === "movie") {
    mappedStatus = "Completed";
  } else if (isTVShow) {
    // For TV shows, try to infer from air_date if available
    if (dorama.first_air_date || dorama.air_date) {
      const airDate = new Date(dorama.first_air_date || dorama.air_date).getTime();
      const now = new Date().getTime();
      if (airDate > now) {
        mappedStatus = "Upcoming";
      } else {
        mappedStatus = "Ongoing";  // Could be ongoing or completed, default to ongoing
      }
    }
  }

  return {
    title: title,
    synopsis: dorama.overview || "",
    cover: getImageUrl(dorama.poster_path || dorama.poster || "", false),
    genres: genres,
    artist: artist,
    status: mappedStatus,
    type: normalizedType,
    related: []
  };
}

// ── Episode List ──────────────────────────────────────────

function fetchChildren(idStr) {
  const parts = idStr.split("|");
  const type = parts[0];
  const slug = parts[1];
  const id = parts[2];

  // Películas: un solo episodio ficticio
  if (type === "movie") {
    return [{
      id: "movie|" + slug + "|" + id,
      number: 1,
      title: "Película",
      pageUrl: SOURCE.baseUrl + "/peliculas-online/" + slug + "?id=" + id
    }];
  }

  const seasonJson = postGQL({
    operationName: "listSeasons",
    variables: { serie_id: id },
    query: "query listSeasons($serie_id: MongoID!) { listSeasons(sort: NUMBER_ASC, filter: {serie_id: $serie_id}) { slug season_number poster_path air_date serie_name poster backdrop __typename } }"
  });

  if (!seasonJson || !seasonJson.data || !seasonJson.data.listSeasons) return [];

  var allEpisodes = [];
  var globalCounter = 1;

  seasonJson.data.listSeasons.forEach(function (season) {
    const epJson = postGQL({
      operationName: "listEpisodes",
      variables: { serie_id: id, season_number: season.season_number },
      query: "query listEpisodes($season_number: Float!, $serie_id: MongoID!) { listEpisodes(sort: NUMBER_ASC, filter: {type_serie: \"dorama\", serie_id: $serie_id, season_number: $season_number}) { _id name slug serie_name serie_name_es serie_id still_path air_date season_number episode_number languages poster backdrop __typename } }"
    });

    if (!epJson || !epJson.data || !epJson.data.listEpisodes) return;

    epJson.data.listEpisodes.forEach(function (ep) {
      const epNum = ep.episode_number || globalCounter;
      const epName = ep.name ? ("- " + ep.name) : ("- Capítulo " + epNum);
      const uploadDate = ep.air_date ? new Date(ep.air_date).getTime() : undefined;
      allEpisodes.push({
        id: "episode|" + ep.slug + "|" + ep._id,
        number: globalCounter,
        title: "T" + ep.season_number + " E" + epNum + " " + epName,
        pageUrl: SOURCE.baseUrl + "/episodios/" + ep.slug,
        dateUpload: uploadDate || 0
      });
      globalCounter++;
    });
  });

  return allEpisodes.reverse();
}

// ── Video List ────────────────────────────────────────────

function decodeJWT(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // We use the base64 part of the JWT
    const payloadStr = atob(parts[1]);
    const payload = JSON.parse(payloadStr);
    if (payload && payload.link) {
      return atob(payload.link);
    }
  } catch (e) {
    console.log("[doramasflix] Error decodificando JWT: " + e);
  }
  return null;
}

function resolveFkPlayer(link) {
  if (!link) return link;

  // Method 1: Direct JWT identification from URL
  if (link.indexOf("/e/") !== -1) {
    const token = link.split("/e/")[1];
    const decoded = decodeJWT(token);
    if (decoded) return decoded;
  }

  // Method 2: HTML Scraping (Fallback)
  try {
    const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" };
    const html = http.get(link, headers);
    const data = extractNextData(html);
    if (!data) return link;

    const token = (data.props && data.props.pageProps && data.props.pageProps.token)
      || (data.query && data.query.token);

    if (!token) return link;

    const decoded = decodeJWT(token);
    if (decoded) return decoded;

    const domainMatch = link.match(/^https?:\/\/([^/?#]+)/i);
    const domain = domainMatch ? domainMatch[1] : "fkplayer.xyz";
    const resStr = http.post(
      "https://fkplayer.xyz/api/decoding",
      JSON.stringify({ token: token }),
      { "origin": "https://" + domain, "content-type": "application/json" }
    );

    const resJson = JSON.parse(resStr);
    if (resJson && resJson.link) {
      return atob(resJson.link);
    }
  } catch (e) {
    console.log("[doramasflix] Error resolviendo fkplayer: " + e);
  }
  return link;
}

function serverNameFromUrl(url, serverId) {
  if (serverId && SERVER_ID_MAP[String(serverId)]) {
    return SERVER_ID_MAP[String(serverId)];
  }

  const u = url.toLowerCase();
  if (u.indexOf("voe") !== -1) return "Voe";
  if (u.indexOf("ok.ru") !== -1 || u.indexOf("okru") !== -1 || u.indexOf("ok.kz") !== -1) return "Okru";
  if (u.indexOf("filemoon") !== -1 || u.indexOf("moonplayer") !== -1 || u.indexOf("filel") !== -1) return "Filemoon";
  if (u.indexOf("uqload") !== -1) return "Uqload";
  if (u.indexOf("mp4upload") !== -1) return "Mp4upload";
  if (u.indexOf("dood") !== -1 || u.indexOf("playmogo") !== -1) return "DoodStream";
  if (u.indexOf("streamlare") !== -1) return "Streamlare";
  if (u.indexOf("wishembed") !== -1 || u.indexOf("streamwish") !== -1 || u.indexOf("strwish") !== -1 || u.indexOf("sfastwish") !== -1) return "StreamWish";
  if (u.indexOf("burstcloud") !== -1) return "BurstCloud";
  if (u.indexOf("fastream") !== -1) return "Fastream";
  if (u.indexOf("upstream") !== -1) return "Upstream";
  if (u.indexOf("streamtape") !== -1 || u.indexOf("stape") !== -1) return "StreamTape";
  if (u.indexOf("streamhide") !== -1 || u.indexOf("ahvsh") !== -1) return "StreamHide";
  if (u.indexOf("filelions") !== -1 || u.indexOf("lion") !== -1) return "FileLions";
  if (u.indexOf("vudeo") !== -1 || u.indexOf("vudea") !== -1) return "Vudeo";
  if (u.indexOf("mega.nz") !== -1 || u.indexOf("mega.co") !== -1) return "Mega";
  return "Unknown";
}

function fetchVideoList(episodeIdStr) {
  const parts = episodeIdStr.split("|");
  const type = parts[0];
  const slug = parts[1];
  const id = parts[2];

  console.log("[doramasflix] Resolviendo mirrors para ID: " + id);

  var rawLinks = [];
  var seenLinks = {};

  function addLink(item) {
    const bestLink = item.embed || item.link;
    if (item && bestLink && !seenLinks[bestLink]) {
      seenLinks[bestLink] = true;
      rawLinks.push(item);
    }
  }

  // 1. Intentar via GraphQL API (Más robusto)
  try {
    const isMovie = type === "movie";
    const body = {
      operationName: isMovie ? "GetMovieLinks" : "GetEpisodeLinks",
      variables: { id: id, app: "com.asiapp.doramasgo" },
      query: isMovie ? GET_MOVIE_LINKS_QUERY : GET_EPISODE_LINKS_QUERY
    };

    const json = postGQL(body);
    const dataKey = isMovie ? "getMovieLinks" : "getEpisodeLinks";

    if (json && json.data && json.data[dataKey] && json.data[dataKey].links_online) {
      const links = json.data[dataKey].links_online;
      const list = Array.isArray(links.json) ? links.json : (Array.isArray(links) ? links : []);
      console.log("[doramasflix] API GQL devolvió " + list.length + " links");
      list.forEach(addLink);
    }
  } catch (e) {
    console.log("[doramasflix] Error GQL links: " + e);
  }

  // 2. Fallback: Scraping HTML (apolloState)
  if (rawLinks.length === 0) {
    console.log("[doramasflix] Fallback: Scraping HTML para links...");
    const url = type === "movie"
      ? SOURCE.baseUrl + "/peliculas-online/" + slug + "?id=" + id
      : SOURCE.baseUrl + "/episodios/" + slug;

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": SOURCE.baseUrl + "/"
    };

    const html = http.get(url, headers);
    const apolloState = extractApolloState(html);

    if (apolloState) {
      // Intentar hacer match con la llave exacta
      const exactKey = type === "movie" ? ("Movie:" + id) : ("Episode:" + id);
      if (apolloState[exactKey] && apolloState[exactKey].links_online) {
        const lo = apolloState[exactKey].links_online;
        const list = Array.isArray(lo.json) ? lo.json : (Array.isArray(lo) ? lo : []);
        list.forEach(addLink);
      }

      // Búsqueda exhaustiva profunda si no hay links aún
      if (rawLinks.length === 0) {
        function searchDeep(node) {
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) { node.forEach(searchDeep); return; }
          if (node.links_online) {
            const list = Array.isArray(node.links_online.json) ? node.links_online.json :
              (Array.isArray(node.links_online) ? node.links_online : []);
            list.forEach(addLink);
          }
          if (node.server) {
            const s = node.server.json || node.server;
            addLink(s);
          }
          if (node.link && typeof node.link === 'string') {
            addLink(node);
          }
          for (var key in node) {
            if (node.hasOwnProperty(key)) {
              searchDeep(node[key]);
            }
          }
        }
        searchDeep(apolloState);
      }
    }
  }

  var results = [];
  rawLinks.forEach(function (l) {
    var finalLink = l.embed || l.link;

    if (finalLink.indexOf("fkplayer.xyz") !== -1) {
      finalLink = resolveFkPlayer(finalLink);
    }

    if (!finalLink) return;

    const langLabel = getLang(l.lang);
    const serverName = serverNameFromUrl(finalLink, l.server);
    const isDisabled = DISABLED_SERVERS.some(function (ds) {
      return serverName.toLowerCase().indexOf(ds.toLowerCase()) !== -1 || finalLink.toLowerCase().indexOf(ds.toLowerCase()) !== -1;
    });

    if (isDisabled) return;

    const isDirectStream = finalLink.indexOf(".m3u8") !== -1 || finalLink.indexOf(".mp4") !== -1;

    const entry = {
      server: serverName,
      quality: langLabel + " — " + serverName
    };

    if (isDirectStream) {
      entry.url = finalLink;
    } else {
      entry.embed = finalLink;
    }

    results.push(entry);
  });

  return results;
}
