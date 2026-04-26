// AllAnime — Extensión Kazemi JS
// Basada en la extensión de Tachiyomi/Aniyomi
// Usa API GraphQL para mayor estabilidad
// =========================================================

const SOURCE = {
  id: "allanime",
  name: "AllAnime",
  baseUrl: "https://allmanga.to",
  apiUrl: "https://api.allanime.day/api",
  language: "en",
  version: "1.0.2",
  iconUrl: "https://allmanga.to/favicon.ico",
  contentKind: "anime",
  extractorRepositoryUrl: "https://raw.githubusercontent.com/kakuga-code/extensions/refs/heads/main/repo-extractores.json",
  nativeSortCriteria: ["rating", "added", "title", "name-desc"],
  filters: [
    {
      name: "genre",
      options: [
        { id: "action",        label: "Action" },
        { id: "adventure",     label: "Adventure" },
        { id: "cars",          label: "Cars" },
        { id: "comedy",        label: "Comedy" },
        { id: "dementia",      label: "Dementia" },
        { id: "demons",        label: "Demons" },
        { id: "drama",         label: "Drama" },
        { id: "ecchi",         label: "Ecchi" },
        { id: "fantasy",       label: "Fantasy" },
        { id: "game",          label: "Game" },
        { id: "harem",         label: "Harem" },
        { id: "historical",    label: "Historical" },
        { id: "horror",        label: "Horror" },
        { id: "isekai",        label: "Isekai" },
        { id: "josei",         label: "Josei" },
        { id: "kids",          label: "Kids" },
        { id: "magic",         label: "Magic" },
        { id: "martial-arts",  label: "Martial Arts" },
        { id: "mecha",         label: "Mecha" },
        { id: "military",      label: "Military" },
        { id: "music",         label: "Music" },
        { id: "mystery",       label: "Mystery" },
        { id: "parody",        label: "Parody" },
        { id: "police",        label: "Police" },
        { id: "psychological", label: "Psychological" },
        { id: "romance",       label: "Romance" },
        { id: "samurai",       label: "Samurai" },
        { id: "school",        label: "School" },
        { id: "sci-fi",        label: "Sci-Fi" },
        { id: "seinen",        label: "Seinen" },
        { id: "shoujo",        label: "Shoujo" },
        { id: "shoujo-ai",     label: "Shoujo Ai" },
        { id: "shounen",       label: "Shounen" },
        { id: "shounen-ai",    label: "Shounen Ai" },
        { id: "slice-of-life", label: "Slice of Life" },
        { id: "space",         label: "Space" },
        { id: "sports",        label: "Sports" },
        { id: "super-power",   label: "Super Power" },
        { id: "supernatural",  label: "Supernatural" },
        { id: "thriller",      label: "Thriller" },
        { id: "vampire",       label: "Vampire" },
        { id: "yaoi",          label: "Yaoi" },
        { id: "yuri",          label: "Yuri" }
      ]
    },
    {
      name: "order",
      options: [
        { id: "rating",    label: "Top" },
        { id: "added",     label: "Update" },
        { id: "title",     label: "Name Asc" },
        { id: "name-desc", label: "Name Desc" }
      ]
    }
  ]
};

// Servidores deshabilitados (por problemas de calidad o publicidad)
const DISABLED_SERVERS = ["filemoon", "mega", "mega.nz", "mediafire", "zippyshare", "1fichier"];

const PAGE_SIZE = 26;
const THUMBNAIL_PROXY = "https://wp.youtube-anime.com/{0}?w=250";
const ALLANIME_EMBED_BASE = "https://allanime.day";

// ── GraphQL Queries ──────────────────────────────────────

const POPULAR_QUERY = `
  query($type: VaildPopularTypeEnumType!, $size: Int!, $page: Int, $dateRange: Int) {
    queryPopular(type: $type, size: $size, dateRange: $dateRange, page: $page) {
      total
      recommendations {
        anyCard {
          _id
          name
          thumbnail
          englishName
          nativeName
          slugTime
        }
      }
    }
  }
`;

const SEARCH_QUERY = `
  query($search: SearchInput, $limit: Int, $page: Int, $translationType: VaildTranslationTypeEnumType, $countryOrigin: VaildCountryOriginEnumType) {
    shows(search: $search, limit: $limit, page: $page, translationType: $translationType, countryOrigin: $countryOrigin) {
      pageInfo {
        total
      }
      edges {
        _id
        name
        thumbnail
        englishName
        nativeName
        slugTime
        type
      }
    }
  }
`;

const DETAILS_QUERY = `
  query($_id: String!) {
    show(_id: $_id) {
      name
      englishName
      nativeName
      thumbnail
      description
      type
      season
      score
      genres
      status
      studios
    }
  }
`;

const EPISODES_QUERY = `
  query($_id: String!) {
    show(_id: $_id) {
      _id
      availableEpisodesDetail
    }
  }
`;

const STREAMS_QUERY = `
  query($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
    episode(showId: $showId, translationType: $translationType, episodeString: $episodeString) {
      sourceUrls
    }
  }
`;

// ── Helpers ──────────────────────────────────────────────

function decodeHtml(html) {
  if (!html) return "";
  return html
    .replace(/"/g, '"')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/'/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, function(_, dec) { return String.fromCharCode(dec); })
    .replace(/<br\s*\/?>/gi, "\n");
}

function slugify(str) {
  return str.replace(/[^a-zA-Z0-9]/g, "-").replace(/-{2,}/g, "-").toLowerCase();
}

function thumbnailUrl(url) {
  if (!url) return null;
  if (url.startsWith("https://")) {
    return THUMBNAIL_PROXY.replace("{0}", url.replace("https://", ""));
  }
  return THUMBNAIL_PROXY.replace("{0}", "aln.youtube-anime.com/" + url);
}

function absoluteStreamUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return ALLANIME_EMBED_BASE + url;
  return url;
}

function buildGraphQLRequest(query, variables) {
  const payload = JSON.stringify({ query: query, variables: variables });
  return http.post(SOURCE.apiUrl, payload, {
    "Content-Type": "application/json",
    "Accept": "*/*",
    "Origin": SOURCE.baseUrl,
    "Referer": SOURCE.baseUrl + "/"
  });
}

function parseGraphQLResponse(respStr) {
  var data = JSON.parse(respStr);

  // AllAnime cifra algunas respuestas de GraphQL en data.tobeparsed. Primero
  // probamos el layout AES-GCM actual de AllAnime y dejamos CTR como fallback.
  if (data && data.data && data.data.tobeparsed) {
    try {
      var key = "SimtVuagFbGR2K7P";
      var keysToTry = [key, key.split("").reverse().join("")];
      var decrypted = "";

      if (typeof crypto !== "undefined") {
        if (crypto.allanimeDecryptBase64) {
          try {
            decrypted = crypto.allanimeDecryptBase64(data.data.tobeparsed) || "";
          } catch (_) {}
        }

        for (var ki = 0; ki < keysToTry.length && !decrypted; ki++) {
          var k = keysToTry[ki];

          if (crypto.aesCtrDecryptBase64) {
            try {
              var ctrCandidate = crypto.aesCtrDecryptBase64(data.data.tobeparsed, k) || "";
              if (ctrCandidate && ctrCandidate.charAt(0) === "{") {
                decrypted = ctrCandidate;
              }
            } catch (_) {}
          }
        }
      }

      if (decrypted) {
        var decryptedData = JSON.parse(decrypted);

        // Algunas respuestas devuelven el payload dentro de data o directamente
        // como un objeto con episode/sourceUrls.
        if (decryptedData && decryptedData.data && typeof decryptedData.data === "object") {
          decryptedData = decryptedData.data;
        }

        if (decryptedData && typeof decryptedData === "object") {
          Object.assign(data.data, decryptedData);
          delete data.data.tobeparsed;
          console.log("[allanime] Respuesta cifrada descifrada: " + Object.keys(data.data).join(", "));
        }
      }

      if (!data.data.episode) {
        console.log("[allanime] tobeparsed no descifrado; usando fallback si está disponible");
      }
    } catch(e) {
      console.log("[allanime] Error descifrando tobeparsed: " + e);
    }
  }

  return data;
}

function parseAnimeFromEdges(edges) {
  const items = [];
  edges.forEach(function(ani) {
    const title = ani.englishName || ani.name;
    const id = ani._id;
    const slugTime = ani.slugTime || "";
    const slug = slugify(ani.englishName || ani.name);
    const type = ani.type || null;
    
    items.push({
      id: id + "<&sep>" + slugTime + "<&sep>" + slug,
      slug: slug,
      title: title,
      thumbnail: thumbnailUrl(ani.thumbnail),
      type: type,
      genres: [],
      status: null,
      pageUrl: SOURCE.baseUrl + "/bangumi/" + id
    });
  });
  return items;
}

// ── Catalog ───────────────────────────────────────────────

function fetchPopular(page) {
  const variables = {
    type: "anime",
    size: PAGE_SIZE,
    dateRange: 7,
    page: page
  };
  
  try {
    const respStr = buildGraphQLRequest(POPULAR_QUERY, variables);
    const data = parseGraphQLResponse(respStr);
    
    if (data.data && data.data.queryPopular && data.data.queryPopular.recommendations) {
      const edges = data.data.queryPopular.recommendations
        .filter(function(rec) { return rec.anyCard != null; })
        .map(function(rec) { return rec.anyCard; });
      
      return {
        items: parseAnimeFromEdges(edges),
        hasNextPage: edges.length === PAGE_SIZE
      };
    }
  } catch(e) {
    console.log("[allanime] Error en fetchPopular: " + e);
  }
  
  return { items: [], hasNextPage: false };
}

function fetchLatest(page) {
  const variables = {
    search: { allowAdult: true, allowUnknown: true },
    limit: PAGE_SIZE,
    page: page,
    translationType: "sub",
    countryOrigin: "ALL"
  };
  
  try {
    const respStr = buildGraphQLRequest(SEARCH_QUERY, variables);
    const data = parseGraphQLResponse(respStr);
    
    if (data.data && data.data.shows && data.data.shows.edges) {
      return {
        items: parseAnimeFromEdges(data.data.shows.edges),
        hasNextPage: data.data.shows.edges.length === PAGE_SIZE
      };
    }
  } catch(e) {
    console.log("[allanime] Error en fetchLatest: " + e);
  }
  
  return { items: [], hasNextPage: false };
}

// Mapeo de tipos de la UI a valores de AllAnime API
const TYPE_MAP = {
  "tv": "TV",
  "movie": "Movie",
  "ova": "OVA",
  "ona": "ONA",
  "special": "Special"
};

// Mapeo de orden de la UI a valores de AllAnime API
// Basado en las URLs reales de AllAnime: sortBy=Top, sortBy=Latest_Update, sortBy=Name_ASC
const ORDER_MAP = {
  "rating":    "Top",
  "added":     "Latest_Update",
  "title":     "Name_ASC",
  "name-desc": "Name_DESC"
};

// Mapeo de géneros canónicos (minúsculas) a formato AllAnime (Title Case)
const GENRE_MAP = {
  "action": "Action",
  "adventure": "Adventure",
  "cars": "Cars",
  "comedy": "Comedy",
  "dementia": "Dementia",
  "demons": "Demons",
  "drama": "Drama",
  "ecchi": "Ecchi",
  "fantasy": "Fantasy",
  "game": "Game",
  "harem": "Harem",
  "historical": "Historical",
  "horror": "Horror",
  "isekai": "Isekai",
  "josei": "Josei",
  "kids": "Kids",
  "magic": "Magic",
  "martial-arts": "Martial Arts",
  "mecha": "Mecha",
  "military": "Military",
  "music": "Music",
  "mystery": "Mystery",
  "parody": "Parody",
  "police": "Police",
  "psychological": "Psychological",
  "romance": "Romance",
  "samurai": "Samurai",
  "school": "School",
  "sci-fi": "Sci-Fi",
  "seinen": "Seinen",
  "shoujo": "Shoujo",
  "shoujo-ai": "Shoujo Ai",
  "shounen": "Shounen",
  "shounen-ai": "Shounen Ai",
  "slice-of-life": "Slice of Life",
  "space": "Space",
  "sports": "Sports",
  "super-power": "Super Power",
  "supernatural": "Supernatural",
  "thriller": "Thriller",
  "vampire": "Vampire",
  "yaoi": "Yaoi",
  "yuri": "Yuri"
};

function fetchSearch(query, page, filters) {
  let variables;
  
  console.log("[allanime] fetchSearch query='" + query + "' page=" + page + " filters=" + JSON.stringify(filters));
  
  if (!query || query.trim() === "") {
    // Filtros sin búsqueda por texto
    // La API necesita un query explícito vacío para procesar los filtros
    variables = {
      search: { query: "", allowAdult: true, allowUnknown: true },
      limit: PAGE_SIZE,
      page: page,
      translationType: "sub",
      countryOrigin: "ALL"
    };
    
    if (filters) {
      // Mapear género - convertir "action" -> "Action", etc.
      if (filters.genre && filters.genre !== "all" && filters.genre !== "") {
        const mappedGenre = GENRE_MAP[filters.genre.toLowerCase()] || filters.genre;
        variables.search.genres = [mappedGenre];
        console.log("[allanime] Filtro género: " + filters.genre + " -> " + mappedGenre);
      }
      // Mapear tipo (convertir "tv" -> "TV", etc.)
      if (filters.type && filters.type !== "all" && filters.type !== "") {
        const mappedType = TYPE_MAP[filters.type.toLowerCase()] || filters.type;
        variables.search.types = [mappedType];
        console.log("[allanime] Filtro tipo: " + filters.type + " -> " + mappedType);
      }
      // Mapear orden (convertir "rating" -> "Popular", etc.)
      if (filters.order && filters.order !== "all" && filters.order !== "" && filters.order !== "update") {
        const mappedOrder = ORDER_MAP[filters.order.toLowerCase()] || filters.order;
        variables.search.sortBy = mappedOrder;
        console.log("[allanime] Filtro orden: " + filters.order + " -> " + mappedOrder);
      }
      if (filters.season && filters.season !== "all" && filters.season !== "") {
        variables.search.season = filters.season;
      }
      if (filters.year && filters.year !== "all" && filters.year !== "") {
        variables.search.year = parseInt(filters.year, 10);
      }
      if (filters.origin && filters.origin !== "ALL" && filters.origin !== "") {
        variables.countryOrigin = filters.origin;
      }
    }
    
    console.log("[allanime] fetchSearch variables: " + JSON.stringify(variables));
  } else {
    // Búsqueda por texto
    variables = {
      search: { query: query.trim(), allowAdult: true, allowUnknown: true },
      limit: PAGE_SIZE,
      page: page,
      translationType: "sub",
      countryOrigin: "ALL"
    };
    
    // Aplicar filtros adicionales también en búsqueda por texto
    if (filters) {
      if (filters.genre && filters.genre !== "all" && filters.genre !== "") {
        const mappedGenre = GENRE_MAP[filters.genre.toLowerCase()] || filters.genre;
        variables.search.genres = [mappedGenre];
        console.log("[allanime] Búsqueda con filtro género: " + filters.genre + " -> " + mappedGenre);
      }
      if (filters.type && filters.type !== "all" && filters.type !== "") {
        const mappedType = TYPE_MAP[filters.type.toLowerCase()] || filters.type;
        variables.search.types = [mappedType];
        console.log("[allanime] Búsqueda con filtro tipo: " + filters.type + " -> " + mappedType);
      }
      if (filters.order && filters.order !== "all" && filters.order !== "" && filters.order !== "update") {
        const mappedOrder = ORDER_MAP[filters.order.toLowerCase()] || filters.order;
        variables.search.sortBy = mappedOrder;
        console.log("[allanime] Búsqueda con filtro orden: " + filters.order + " -> " + mappedOrder);
      }
    }
  }
  
  try {
    const respStr = buildGraphQLRequest(SEARCH_QUERY, variables);
    const data = parseGraphQLResponse(respStr);
    
    if (data.data && data.data.shows && data.data.shows.edges) {
      return {
        items: parseAnimeFromEdges(data.data.shows.edges),
        hasNextPage: data.data.shows.edges.length === PAGE_SIZE
      };
    }
  } catch(e) {
    console.log("[allanime] Error en fetchSearch: " + e);
  }
  
  return { items: [], hasNextPage: false };
}

// ── Anime Detail ──────────────────────────────────────────

function fetchItemDetails(id) {
  // El ID puede venir como "id<&sep>slugTime<&sep>slug"
  const parts = id.split("<&sep>");
  const showId = parts[0];
  
  const variables = { _id: showId };
  
  try {
    const respStr = buildGraphQLRequest(DETAILS_QUERY, variables);
    const data = parseGraphQLResponse(respStr);
    
    if (data.data && data.data.show) {
      const show = data.data.show;
      
      let description = show.description || "";
      description = decodeHtml(description.replace(/<br>/g, "br2n")).replace(/br2n/g, "\n");
      description += "\n\nType: " + (show.type || "Unknown");
      if (show.season) {
        description += "\nAired: " + (show.season.quarter || "-") + " " + (show.season.year || "-");
      }
      if (show.score) {
        description += "\nScore: " + show.score + "★";
      }
      
      let status = "Desconocido";
      if (show.status === "Releasing") status = "En emisión";
      else if (show.status === "Finished") status = "Concluido";
      else if (show.status === "Not Yet Released") status = "Por estrenar";
      
      return {
        title: show.englishName || show.name || id,
        synopsis: description,
        cover: thumbnailUrl(show.thumbnail),
        genres: show.genres || [],
        type: show.type || "Unknown",
        status: status,
        related: []
      };
    }
  } catch(e) {
    console.log("[allanime] Error en fetchItemDetails: " + e);
  }
  
  return {
    title: id,
    synopsis: "",
    cover: null,
    genres: [],
    type: null,
    status: null,
    related: []
  };
}

// ── Episode List ──────────────────────────────────────────

function fetchChildren(itemId) {
  const animeId = itemId;
  const parts = animeId.split("<&sep>");
  const showId = parts[0];
  
  const variables = { _id: showId };
  
  try {
    const respStr = buildGraphQLRequest(EPISODES_QUERY, variables);
    const data = parseGraphQLResponse(respStr);
    
    if (data.data && data.data.show) {
      const show = data.data.show;
      const episodes = [];
      
      // Obtener lista de episodios sub
      if (show.availableEpisodesDetail && show.availableEpisodesDetail.sub) {
        show.availableEpisodesDetail.sub.forEach(function(ep) {
          const num = parseFloat(ep) || 0;
          const epNum = isNaN(num) ? 1 : num;
          
          // Guardar solo los parámetros necesarios, no la query completa
          const epParams = JSON.stringify({
            showId: showId,
            episodeString: ep,
            translationType: "sub"
          });
          
          episodes.push({
            id: epParams,
            number: epNum,
            title: "Episodio " + ep,
            pageUrl: SOURCE.baseUrl + "/bangumi/" + showId
          });
        });
      }
      
      return episodes.reverse();
    }
  } catch(e) {
    console.log("[allanime] Error en fetchChildren: " + e);
  }
  
  return [];
}

// ── Server Name Detection ──────────────────────────────────

function serverNameFromUrl(url, sourceName) {
  // Si sourceName está disponible, usarlo para detectar el servidor
  if (sourceName) {
    const s = sourceName.toLowerCase();
    // Detectar por sourceName exacto o parcial
    if (s.indexOf("voe") !== -1) return "Voe";
    if (s.indexOf("ok") !== -1 && s.indexOf("okru") === -1 && s.indexOf("ok.") === -1) return "Okru"; // evitar falsos positivos
    if (s.indexOf("filemoon") !== -1 || s.indexOf("fm") !== -1) return "Filemoon";
    if (s.indexOf("uqload") !== -1) return "Uqload";
    if (s.indexOf("mp4upload") !== -1) return "Mp4upload";
    if (s.indexOf("mp4") !== -1 && s.indexOf("mp4upload") === -1 && s.indexOf("yt-mp4") === -1 && s.indexOf("s-mp4") === -1 && s.indexOf("luf-mp4") === -1) return "Mp4upload";
    if (s.indexOf("dood") !== -1 || s.indexOf("playmogo") !== -1) return "DoodStream";
    if (s.indexOf("streamlare") !== -1) return "Streamlare";
    if (s.indexOf("wish") !== -1 || s.indexOf("streamwish") !== -1) return "StreamWish";
    if (s.indexOf("burstcloud") !== -1) return "BurstCloud";
    if (s.indexOf("fastream") !== -1) return "Fastream";
    if (s.indexOf("upstream") !== -1) return "Upstream";
    if (s.indexOf("tape") !== -1 || s.indexOf("streamtape") !== -1) return "StreamTape";
    if (s.indexOf("hide") !== -1 || s.indexOf("streamhide") !== -1) return "StreamHide";
    if (s.indexOf("filelions") !== -1 || s.indexOf("lion") !== -1) return "FileLions";
    if (s.indexOf("vudeo") !== -1 || s.indexOf("vudea") !== -1) return "Vudeo";
    if (s.indexOf("mega") !== -1) return "Mega";
    // Detectar servidores AllAnime específicos
    if (s.indexOf("uni") !== -1) return "AllAnime";
    if (s.indexOf("yt-mp4") !== -1) return "Yt-mp4";
    if (s.indexOf("s-mp4") !== -1) return "S-mp4";
    if (s.indexOf("luf-mp4") !== -1) return "Luf-Mp4";
    if (s.indexOf("vn-hls") !== -1) return "VidNest";
    if (s.indexOf("fm-hls") !== -1) return "Filemoon";
  }
  
  // Si no se pudo detectar con sourceName, intentar con URL
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

// ── Video List ────────────────────────────────────────────

function fetchVideoList(episodeId) {
  const results = [];
  
  try {
    console.log("[allanime] fetchVideoList episodeId=" + episodeId.substring(0, 100));
    
    // Parsear el episodeId para obtener los parámetros
    var epParams;
    try {
      epParams = JSON.parse(episodeId);
    } catch(e) {
      console.log("[allanime] Error parseando episodeId: " + e);
      return [];
    }
    
    var showId = epParams.showId;
    var episodeString = epParams.episodeString;
    var translationType = epParams.translationType || "sub";
    
    console.log("[allanime] showId=" + showId + " ep=" + episodeString + " type=" + translationType);
    
    // Construir el payload GraphQL para obtener los streams
    var graphqlPayload = JSON.stringify({
      query: STREAMS_QUERY,
      variables: {
        showId: showId,
        translationType: translationType,
        episodeString: episodeString
      }
    });
    
    console.log("[allanime] Enviando GraphQL query...");
    
    var respStr = http.post(SOURCE.apiUrl, graphqlPayload, {
      "Content-Type": "application/json",
      "Accept": "*/*",
      "Origin": SOURCE.baseUrl,
      "Referer": SOURCE.baseUrl + "/"
    });
    
    console.log("[allanime] Response length: " + (respStr ? respStr.length : 0));
    
    var data = parseGraphQLResponse(respStr);
    
    // Log de errores de GraphQL
    if (data.errors) {
      console.log("[allanime] GraphQL errors: " + JSON.stringify(data.errors));
    }
    
    if (data.data && data.data.episode) {
      var episode = data.data.episode;
      console.log("[allanime] Episode data keys: " + Object.keys(episode).join(", "));
      
      // sourceUrls puede ser un string JSON o un array de objetos
      var sourceUrls = episode.sourceUrls;
      if (typeof sourceUrls === "string") {
        try {
          sourceUrls = JSON.parse(sourceUrls);
        } catch(e) {
          console.log("[allanime] Error parseando sourceUrls string: " + e);
          sourceUrls = [];
        }
      }
      
      if (!Array.isArray(sourceUrls)) {
        sourceUrls = sourceUrls ? [sourceUrls] : [];
      }
      
      console.log("[allanime] sourceUrls count: " + sourceUrls.length);
      
      sourceUrls.forEach(function(video, idx) {
        if (!video) return;
        
        // Ahora la API devuelve objetos con sourceUrl, sourceName, type, priority
        var videoUrl = video.sourceUrl || "";
        var sourceName = video.sourceName || "unknown";
        var videoType = video.type || "";
        var priority = video.priority || 0;
        
        if (!videoUrl) {
          console.log("[allanime] Video sin URL en índice " + idx);
          return;
        }
        
        // Desencriptar URLs que empiezan con "-"
        if (videoUrl.startsWith("-")) {
          videoUrl = decryptSource(videoUrl);
          videoUrl = absoluteStreamUrl(videoUrl);
          console.log("[allanime] URL desencriptada[" + idx + "]: " + videoUrl.substring(0, 80));
        } else {
          videoUrl = absoluteStreamUrl(videoUrl);
          console.log("[allanime] URL directa[" + idx + "]: " + videoUrl.substring(0, 80));
        }
        
        // Obtener nombre del servidor usando detección por sourceName y URL
        var serverName = serverNameFromUrl(videoUrl, sourceName);
        console.log("[allanime] Server[" + idx + "]: " + sourceName + " -> " + serverName + " Type: " + videoType + " Priority: " + priority);
        
        // Verificar si el servidor está deshabilitado
        var isDisabled = DISABLED_SERVERS.some(function(ds) {
          return serverName.toLowerCase().indexOf(ds.toLowerCase()) !== -1 || videoUrl.toLowerCase().indexOf(ds.toLowerCase()) !== -1;
        });
        
        if (isDisabled) {
          console.log("[allanime] Server deshabilitado: " + serverName);
          return;
        }
        
        // Resolver URLs de clock de AllAnime (S-mp4, Luf-Mp4, etc.)
        // El endpoint correcto es /apivtwo/clock.json (no /apivtwo/clock, que devuelve HTML)
        if (videoUrl.indexOf("allanime.day/apivtwo/clock") !== -1) {
          // Convertir /clock? a /clock.json?
          var clockUrl = videoUrl.replace("/apivtwo/clock?", "/apivtwo/clock.json?");
          try {
            var clockResp = http.get(clockUrl, {
              "Referer": SOURCE.baseUrl + "/",
              "Accept": "application/json"
            });
            var clockData = JSON.parse(clockResp);
            if (clockData.links && clockData.links.length > 0) {
              clockData.links.forEach(function(lnk, lIdx) {
                var link = lnk.link || lnk.mp4 || "";
                if (!link) return;
                var label = serverName;
                if (lnk.resolutionStr) label += " " + lnk.resolutionStr;
                else label += " — HD";
                console.log("[allanime] Clock[" + idx + "." + lIdx + "]: " + link.substring(0, 80));
                results.push({
                  url: link,
                  server: serverName,
                  quality: label,
                  subtitles: lnk.subtitles || []
                });
              });
            } else {
              console.log("[allanime] Clock sin links[" + idx + "]: " + clockResp.substring(0, 120));
            }
          } catch(clockErr) {
            console.log("[allanime] Error resolviendo clock[" + idx + "]: " + clockErr);
          }
          return;
        }

        // Detectar URLs directas de video (m3u8 / mp4)
        var lowerUrl = videoUrl.toLowerCase();
        var isDirect = lowerUrl.indexOf(".m3u8") !== -1 || lowerUrl.indexOf(".mp4") !== -1;

        if (isDirect) {
          results.push({
            url: videoUrl,
            server: serverName,
            quality: serverName + " — HD"
          });
        } else {
          results.push({
            embed: videoUrl,
            server: serverName,
            quality: serverName + " — HD"
          });
        }
      });
    } else {
      console.log("[allanime] No se encontró episode en la respuesta");
      if (data.data) {
        console.log("[allanime] Response data keys: " + Object.keys(data.data).join(", "));
      }

      // Fallback: algunos episodios no exponen episode/sourceUrls por la ruta
      // principal y sí entregan información de video vía episodeInfos.
      try {
        var epNum = parseFloat(episodeString);
        if (!isNaN(epNum)) {
          var epInfoPayload = JSON.stringify({
            query: "query($showId:String!,$episodeNumStart:Float!,$episodeNumEnd:Float!){ episodeInfos(showId:$showId,episodeNumStart:$episodeNumStart,episodeNumEnd:$episodeNumEnd){ episodeIdNum vidInforssub vidInforsdub vidInforsraw } }",
            variables: {
              showId: showId,
              episodeNumStart: epNum,
              episodeNumEnd: epNum
            }
          });

          var epInfoResp = http.post(SOURCE.apiUrl, epInfoPayload, {
            "Content-Type": "application/json",
            "Accept": "*/*",
            "Origin": SOURCE.baseUrl,
            "Referer": SOURCE.baseUrl + "/"
          });

          var epInfoData = parseGraphQLResponse(epInfoResp);
          var infos = (epInfoData && epInfoData.data && epInfoData.data.episodeInfos) ? epInfoData.data.episodeInfos : [];

          if (Array.isArray(infos) && infos.length > 0) {
            var info = infos[0];
            var vidInfo = null;
            if (translationType === "dub") vidInfo = info.vidInforsdub;
            else if (translationType === "raw") vidInfo = info.vidInforsraw;
            else vidInfo = info.vidInforssub || info.vidInforsdub || info.vidInforsraw;

            if (vidInfo && vidInfo.vidPath) {
              var directCandidate = "https://allanime.day/apivtwo/vidcdn.json?path=" + encodeURIComponent(vidInfo.vidPath);
              results.push({
                embed: directCandidate,
                server: "AllAnime",
                quality: "AllAnime — Fallback",
                browserSession: true,
                headers: {
                  "Accept": "*/*",
                  "Origin": SOURCE.baseUrl,
                  "Referer": SOURCE.baseUrl + "/"
                }
              });
              console.log("[allanime] Fallback episodeInfos vidPath detectado");
            }
          }
        }
      } catch (fallbackErr) {
        console.log("[allanime] Error en fallback episodeInfos: " + fallbackErr);
      }
    }
  } catch(e) {
    console.log("[allanime] Error en fetchVideoList: " + e);
  }
  
  console.log("[allanime] Mirrors encontrados: " + results.length);
  return results;
}

function decryptSource(str) {
  if (!str.startsWith("-")) return str;
  
  const hexPart = str.startsWith("--") ? str.substring(2) : str.substring(1);
  let result = "";
  
  for (let i = 0; i < hexPart.length; i += 2) {
    const byteVal = parseInt(hexPart.substring(i, i + 2), 16);
    const xored = byteVal ^ 56;
    result += String.fromCharCode(xored);
  }
  
  return result;
}
