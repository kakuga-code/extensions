// Blender Open Movies — Extensión Kazemi JS
// =========================================================

/**
 * Mapeo de categorías PeerTube (Nombres en español → ID numérico real)
 * IDs obtenidos directamente de la API de video.blender.org
 */
const CATEGORY_MAP = {
  "activismo": 14,
  "animales": 16,
  "arte": 4,
  "ciencia y tecnología": 15,
  "cocina": 18,
  "comedia": 9,
  "deportes": 5,
  "educación": 13,
  "entretenimiento": 10,
  "juegos": 7,
  "música": 1,
  "niños": 17,
  "noticias y política": 11,
  "películas": 2,
  "personalidades": 8,
  "transporte": 3,
  "tutorial": 12,
  "viajes": 6
};

/**
 * Opciones de ordenamiento disponibles en PeerTube
 * Valor → parámetro sort de la API
 */
const SORT_MAP = {
  "Añadido recientemente": "-createdAt",
  "Fecha de publicación": "-originallyPublishedAt",
  "Nombre": "name",
  "Visualizaciones recientes": "-trending",
  "Caliente": "-hot",
  "Me gusta": "-likes",
  "Visualizaciones globales": "-views"
};

/**
 * Tipo de vídeo (VOD / Live / Ambos)
 * Valor → parámetro isLive de la API (undefined = ambos)
 */
const LIVE_MAP = {
  "Vídeos en directo": "true",
  "Vídeos en VOD": "false"
};

const SOURCE = {
  id: "blender",
  name: "Blender Open Movies",
  baseUrl: "https://video.blender.org",
  language: "es",
  version: "1.2.0",
  iconUrl: "https://video.blender.org/favicon.ico",
  contentKind: "movie",
  filters: [
    {
      name: "genre",
      options: Object.keys(CATEGORY_MAP).map(function (key) {
        return { id: String(CATEGORY_MAP[key]), label: key.charAt(0).toUpperCase() + key.slice(1) };
      })
    },
    {
      name: "type",
      options: [
        { id: "live", label: "Vídeos en directo" },
        { id: "vod", label: "Vídeos en VOD" }
      ]
    },
    {
      name: "order",
      options: [
        { id: "-createdAt", label: "Añadido recientemente" },
        { id: "-originallyPublishedAt", label: "Fecha de publicación original" },
        { id: "name", label: "Nombre" },
        { id: "-trending", label: "Visualizaciones recientes" },
        { id: "-hot", label: "Caliente" },
        { id: "-likes", label: "Me gusta" },
        { id: "-views", label: "Visualizaciones globales" }
      ]
    }
  ]
};

const CHANNEL_NAME = "blender_open_movies";
const CHANNEL_HANDLE = "blender_open_movies@video.blender.org";

// ── Helpers ──────────────────────────────────────────────

/**
 * Construye la cadena de query-params a partir de los filtros
 */
function buildFilterParams(filters) {
  let params = "";

  // Género / categoría (directamente como número)
  if (filters && filters.genre) {
    const genres = Array.isArray(filters.genre) ? filters.genre : [filters.genre];
    genres.forEach(function (g) {
      params += "&categoryOneOf=" + g;
    });
  }

  // Tipo de vídeo (VOD / Live)
  if (filters && filters.type) {
    if (filters.type === "live") {
      params += "&live=true";
    } else if (filters.type === "vod") {
      params += "&c=true";
    }
  } else {
    // Sin filtro de tipo = ambos (todos)
    params += "&live=true&c=true";
  }

  // Ordenamiento
  if (filters && filters.order) {
    params += "&sort=" + encodeURIComponent(filters.order);
  }

  return params;
}

/**
 * Mapea la respuesta JSON de PeerTube a items de Kazemi
 */
function parseVideos(data) {
  if (!data || !data.data) return [];
  return data.data.map(function (v) {
    return {
      id: v.uuid,
      slug: v.uuid,
      title: v.name,
      thumbnail: v.thumbnailPath
        ? (v.thumbnailPath.startsWith("http") ? v.thumbnailPath : SOURCE.baseUrl + v.thumbnailPath)
        : null,
      type: "Movie",
      genres: v.category ? [v.category.label] : (v.tags || []),
      status: "Completed",
      pageUrl: v.url
    };
  });
}

// ── Catalog ───────────────────────────────────────────────

function fetchPopular(page) {
  const count = 20;
  const start = (page - 1) * count;
  const url = SOURCE.baseUrl
    + "/api/v1/video-channels/" + CHANNEL_NAME
    + "/videos?sort=-likes&count=" + count + "&start=" + start + "&isLive=false";

  try {
    const json = http.get(url);
    const data = JSON.parse(json);
    return {
      items: parseVideos(data),
      hasNextPage: (data.start + data.data.length) < data.total
    };
  } catch (e) {
    console.log("[blender] Error in fetchPopular: " + e);
    return { items: [], hasNextPage: false };
  }
}

function fetchLatest(page) {
  const count = 20;
  const start = (page - 1) * count;
  const url = SOURCE.baseUrl
    + "/api/v1/video-channels/" + CHANNEL_NAME
    + "/videos?sort=-publishedAt&count=" + count + "&start=" + start + "&isLive=false";

  try {
    const json = http.get(url);
    const data = JSON.parse(json);
    return {
      items: parseVideos(data),
      hasNextPage: (data.start + data.data.length) < data.total
    };
  } catch (e) {
    console.log("[blender] Error in fetchLatest: " + e);
    return { items: [], hasNextPage: false };
  }
}

function fetchSearch(query, page, filters) {
  const count = 20;
  const start = (page - 1) * count;

  // Ordenamiento por defecto: me gusta (igual que la URL de referencia)
  const defaultSort = "-likes";

  let filterParams = buildFilterParams(filters);

  // Si el order no está en los filtros, añadir por defecto
  if (!filters || !filters.order) {
    filterParams += "&sort=" + defaultSort;
  }

  let url;
  if (!query || query.trim().length === 0) {
    // Sin texto: navegar el canal con filtros
    url = SOURCE.baseUrl
      + "/api/v1/video-channels/" + CHANNEL_NAME
      + "/videos?count=" + count + "&start=" + start + filterParams;
  } else {
    // Búsqueda global con filtro de canal
    url = SOURCE.baseUrl
      + "/api/v1/search/videos?search=" + encodeURIComponent(query.trim())
      + "&videoChannelHandleOneOf=" + encodeURIComponent(CHANNEL_HANDLE)
      + "&count=" + count + "&start=" + start + filterParams;
  }

  try {
    const json = http.get(url);
    const data = JSON.parse(json);
    return {
      items: parseVideos(data),
      hasNextPage: data.total ? (data.start + data.data.length) < data.total : false
    };
  } catch (e) {
    console.log("[blender] Error in fetchSearch: " + e);
    return { items: [], hasNextPage: false };
  }
}

// ── Filtros disponibles (legacy, mantenido por compatibilidad) ───────────

function fetchFilters() {
  return [
    {
      id: "genre",
      name: "Género",
      type: "multi-select",
      options: Object.keys(CATEGORY_MAP).map(function (key) {
        return { value: String(CATEGORY_MAP[key]), label: key.charAt(0).toUpperCase() + key.slice(1) };
      })
    },
    {
      id: "type",
      name: "Tipo",
      type: "select",
      options: [
        { value: "live", label: "Vídeos en directo" },
        { value: "vod", label: "Vídeos en VOD" }
      ]
    },
    {
      id: "order",
      name: "Ordenar por",
      type: "select",
      options: [
        { value: "-createdAt", label: "Añadido recientemente" },
        { value: "-originallyPublishedAt", label: "Fecha de publicación original" },
        { value: "name", label: "Nombre" },
        { value: "-trending", label: "Visualizaciones recientes" },
        { value: "-hot", label: "Caliente" },
        { value: "-likes", label: "Me gusta" },
        { value: "-views", label: "Visualizaciones globales" }
      ]
    }
  ];
}

// ── Item Detail ──────────────────────────────────────────

function fetchItemDetails(id) {
  const url = SOURCE.baseUrl + "/api/v1/videos/" + id;

  try {
    const json = http.get(url);
    const v = JSON.parse(json);

    return {
      title: v.name,
      synopsis: v.description || v.truncatedDescription || "",
      cover: v.thumbnailPath
        ? (v.thumbnailPath.startsWith("http") ? v.thumbnailPath : SOURCE.baseUrl + v.thumbnailPath)
        : null,
      genres: v.category ? [v.category.label] : (v.tags || []),
      type: "Movie",
      status: "Completed",
      artist: v.account ? v.account.displayName : "Blender Studio",
      related: []
    };
  } catch (e) {
    console.log("[blender] Error in fetchItemDetails: " + e);
    return { title: id, synopsis: "Error al cargar detalles" };
  }
}

// ── Episode List ──────────────────────────────────────────

function fetchChildren(itemId) {
  return [{
    id: itemId,
    number: 1,
    title: "Película completa",
    pageUrl: SOURCE.baseUrl + "/videos/watch/" + itemId
  }];
}

// ── Video List ────────────────────────────────────────────

function fetchVideoList(episodeId) {
  const url = SOURCE.baseUrl + "/api/v1/videos/" + episodeId;

  try {
    const json = http.get(url);
    const v = JSON.parse(json);

    const results = [];

    // Archivos directos MP4
    if (v.files && Array.isArray(v.files)) {
      v.files.forEach(function (f) {
        results.push({
          url: f.fileUrl,
          server: "PeerTube Directo",
          quality: f.resolution ? f.resolution.label : "Original"
        });
      });
    }

    // Playlists HLS
    if (v.streamingPlaylists && Array.isArray(v.streamingPlaylists)) {
      v.streamingPlaylists.forEach(function (p) {
        results.push({
          url: p.playlistUrl,
          server: "PeerTube HLS",
          quality: "Auto (HLS)"
        });
      });
    }

    // Ordenar por resolución descendente
    return results.sort(function (a, b) {
      const qA = parseInt(a.quality) || 0;
      const qB = parseInt(b.quality) || 0;
      return qB - qA;
    });
  } catch (e) {
    console.log("[blender] Error in fetchVideoList: " + e);
    return [];
  }
}
