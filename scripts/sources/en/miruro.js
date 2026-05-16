// miruro — Kazemi JS extension (catalog via AniList; playback = Miruro /watch in browser)
// Official domains: https://www.miruro.com (#domains) — miruro.tv, miruro.to, miruro.bz, miruro.ru
// Style aligned with anime-sama.js (sections; domain list only for picking a healthy SOURCE.baseUrl).
// =========================================================

/** Domains listed on https://www.miruro.com as official — used only to pick one healthy `SOURCE.baseUrl`. */
const MIRURO_OFFICIAL_BASES = [
  "https://www.miruro.to",
  "https://www.miruro.tv",
  "https://www.miruro.bz",
  "https://www.miruro.ru"
];

/**
 * Public site host for /info and /watch links (same UI as the browser; see miruro.tv watch pages).
 * .tv/.to/.bz/.ru are the same product — only used in init for /health; links stay on .tv so they
 * match what users open on the web (e.g. https://www.miruro.tv/watch/21/one-piece?ep=1161).
 */
/** Public watch/info links; pipe uses `SOURCE.baseUrl` after init (often miruro.to). */
const MIRURO_PUBLIC_ORIGIN = "https://www.miruro.to";
const MIRURO_PIPE_OBF_KEY_HEX = "71951034f8fbcf53d89db52ceb3dc22c";
const MIRURO_DISABLED_PROVIDERS = {
  ally: true,
  bee: true,
  /** Often return Cloudflare HTML instead of pipe JSON when hammered. */
  arc: true,
  hop: true
};

/** Same order as Miruro UI /  */
const MIRURO_PROVIDER_PRIORITY = ["kiwi", "telli", "bun", "nun", "dune", "hop"];

const ANILIST_GRAPHQL = "https://graphql.anilist.co";

const SOURCE = {
  id: "miruro",
  name: "Miruro",
  baseUrl: MIRURO_OFFICIAL_BASES[0],
  language: "en",
  version: "1.0.0",
  iconUrl: "https://www.miruro.tv/icon-light-1024x1024.png",
  contentKind: "anime",
  extractorRepositoryUrl: "https://raw.githubusercontent.com/kakuga-code/extensions/refs/heads/main/repo-extractores.json",
  supportsPopular: true,
  supportedTypes: ["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "TV_SHORT"],
  filters: [
    {
      name: "type",
      options: [
        { id: "", label: "All formats" },
        { id: "TV", label: "TV" },
        { id: "MOVIE", label: "Movie" },
        { id: "OVA", label: "OVA" },
        { id: "ONA", label: "ONA" },
        { id: "SPECIAL", label: "Special" },
        { id: "TV_SHORT", label: "TV Short" }
      ]
    },
    {
      name: "order",
      options: [
        { id: "", label: "Default (popular)" },
        { id: "POPULARITY_DESC", label: "Popularity" },
        { id: "UPDATED_AT_DESC", label: "Recently updated" },
        { id: "SCORE_DESC", label: "Average score" },
        { id: "FAVOURITES_DESC", label: "Favourites" },
        { id: "START_DATE_DESC", label: "Start date" },
        { id: "TITLE_ROMAJI", label: "Title A–Z" }
      ]
    },
    {
      name: "genre",
      options: [
        { id: "", label: "All genres" },
        { id: "Action", label: "Action" },
        { id: "Adventure", label: "Adventure" },
        { id: "Comedy", label: "Comedy" },
        { id: "Drama", label: "Drama" },
        { id: "Fantasy", label: "Fantasy" },
        { id: "Horror", label: "Horror" },
        { id: "Mecha", label: "Mecha" },
        { id: "Music", label: "Music" },
        { id: "Mystery", label: "Mystery" },
        { id: "Psychological", label: "Psychological" },
        { id: "Romance", label: "Romance" },
        { id: "Sci-Fi", label: "Sci-Fi" },
        { id: "Slice of Life", label: "Slice of Life" },
        { id: "Sports", label: "Sports" },
        { id: "Supernatural", label: "Supernatural" },
        { id: "Thriller", label: "Thriller" },
        { id: "Isekai", label: "Isekai" }
      ]
    }
  ]
};

// Miruro's player config is static enough to use as a safety net when Kazemi's
// runtime receives a truncated watch HTML before `window.__SSR_CONFIG__`.
const MIRURO_DEFAULT_PLAYER_CONFIG = {
  streaming: {
    kiwi: {
      capabilities: { sub: true, ssub: false },
      relationship: null,
      visible: true
    },
    telli: {
      capabilities: { sub: true, ssub: false },
      relationship: "embed",
      visible: true
    },
    ally: {
      capabilities: { sub: true, ssub: false },
      relationship: null,
      visible: true
    },
    bee: {
      capabilities: { sub: false, ssub: true },
      relationship: null,
      visible: true
    },
    dune: {
      capabilities: { sub: false, ssub: true },
      relationship: null,
      visible: true
    },
    bun: {
      capabilities: { sub: false, ssub: true },
      relationship: "embed",
      visible: true
    },
    nun: {
      capabilities: { sub: true, ssub: false },
      relationship: "embed",
      visible: true
    },
    hop: {
      capabilities: { sub: false, ssub: true },
      relationship: null,
      visible: true
    }
  },
  providerOrder: ["kiwi", "telli", "ally", "bee", "dune", "bun", "nun", "hop"]
};

// ── Mirror init (callback order = array order) ─────────────────────────

function httpGetRaw(url, headers) {
  try {
    return http.get(
      url,
      headers || {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json,text/plain,*/*"
      }
    );
  } catch (e) {
    console.log("[miruro] GET raw error " + url + ": " + e);
    return null;
  }
}

/** GET HTML (watch pages ship `window.__SSR_CONFIG__` with streaming / provider order). */
function httpGetHtml(url) {
  return httpGetRaw(url, {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  });
}

var _miruroPakoReady = false;

function miruroGlobalRef() {
  if (typeof global !== "undefined") return global;
  if (typeof globalThis !== "undefined") return globalThis;
  return this;
}

function miruroGetPako() {
  var g = miruroGlobalRef();
  if (g && g.__miruroPakoLib && g.__miruroPakoLib.ungzip) return g.__miruroPakoLib;
  if (typeof pako !== "undefined" && pako.ungzip) return pako;
  if (g && g.pako && g.pako.ungzip) return g.pako;
  return null;
}

/**
 * Loads pako for pipe gunzip.
 * UMD is forced through a module.exports shim — plain eval does not expose `pako` in JavaScriptCore.
 */
function ensureMiruroPako() {
  if (_miruroPakoReady && miruroGetPako()) return true;
  try {
    var code = httpGetRaw("https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js", {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/javascript,*/*"
    });
    if (!code || code.indexOf("ungzip") === -1) {
      console.log("[miruro] pako download invalid");
      return false;
    }
    var loader = new Function(
      "src",
      "var module = { exports: {} }; var exports = module.exports; eval(src); " +
        "if (exports.ungzip) return exports; " +
        "if (typeof pako !== 'undefined' && pako.ungzip) return pako; " +
        "return null;"
    );
    var lib = loader(code);
    if (!lib || !lib.ungzip) {
      console.log("[miruro] pako not available after load");
      return false;
    }
    var g = miruroGlobalRef();
    g.__miruroPakoLib = lib;
    g.pako = lib;
    _miruroPakoReady = true;
    return true;
  } catch (e) {
    console.log("[miruro] pako load failed: " + e);
    return false;
  }
}

function miruroPureAtob(input) {
  var str = String(input || "").replace(/=+$/, "");
  if (str.length % 4 === 1) return "";
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  var output = "";
  var bc = 0;
  var bs = 0;
  var buffer;
  var i = 0;
  while ((buffer = str.charAt(i++))) {
    buffer = chars.indexOf(buffer);
    if (buffer === -1) continue;
    bs = bc % 4 ? bs * 64 + buffer : buffer;
    if (bc++ % 4) output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
  }
  return output;
}

function miruroBase64UrlEncodeJson(obj) {
  var json = JSON.stringify(obj || {});
  var encoded = btoa(unescape(encodeURIComponent(json)));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function miruroBase64UrlToBytes(raw) {
  var s = String(raw || "")
    .replace(/[\r\n\t ]+/g, "")
    .replace(/[^A-Za-z0-9\-_+/=]/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  var rem = s.length % 4;
  if (rem) s += Array(5 - rem).join("=");
  /** Large Miruro pipe bodies (~2M+ chars); single atob can fail or misbehave on some runtimes. */
  var CHUNK = 262144;
  CHUNK -= CHUNK % 4;
  function miruroAtob(slice) {
    return miruroPureAtob(slice);
  }
  if (s.length <= CHUNK) {
    var bin0 = miruroAtob(s);
    var out0 = new Uint8Array(bin0.length);
    for (var z = 0; z < bin0.length; z++) out0[z] = bin0.charCodeAt(z) & 255;
    return out0;
  }
  var pieces = [];
  var total = 0;
  for (var off = 0; off < s.length; ) {
    var end = Math.min(off + CHUNK, s.length);
    end -= (end - off) % 4;
    if (end <= off) end = Math.min(off + 4, s.length);
    var slice = s.slice(off, end);
    var bin = miruroAtob(slice);
    total += bin.length;
    pieces.push(bin);
    off = end;
  }
  var out = new Uint8Array(total);
  var pos = 0;
  for (var p = 0; p < pieces.length; p++) {
    var b = pieces[p];
    for (var j = 0; j < b.length; j++) out[pos++] = b.charCodeAt(j) & 255;
  }
  return out;
}

function miruroBinaryStringToBytes(raw) {
  var s = String(raw || "");
  var out = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 255;
  return out;
}

function miruroBytesFromRaw(raw) {
  var s = String(raw || "");
  if (!s) return new Uint8Array(0);
  s = s.replace(/^\uFEFF/, "");
  var trimmed = s.replace(/^[\r\n\t ]+|[\r\n\t ]+$/g, "");
  if (trimmed.indexOf("H4sI") === 0 || /^[A-Za-z0-9\-_+/=\r\n\t ]+$/.test(trimmed)) {
    return miruroBase64UrlToBytes(trimmed);
  }
  var c0 = s.charCodeAt(0) & 255;
  var c1 = s.length > 1 ? (s.charCodeAt(1) & 255) : -1;
  var c2 = s.length > 2 ? (s.charCodeAt(2) & 255) : -1;
  if (c0 === 31 && c1 === 139 && c2 === 8) {
    return miruroBinaryStringToBytes(s);
  }
  return miruroBase64UrlToBytes(s);
}

function miruroApiOrigin() {
  return String(SOURCE.baseUrl || MIRURO_PUBLIC_ORIGIN).replace(/\/+$/, "");
}

function miruroBytesLookLikeGzip(bytes) {
  return !!bytes && bytes.length >= 3 && bytes[0] === 31 && bytes[1] === 139 && bytes[2] === 8;
}

function miruroTryDecompressToText(bytes) {
  if (!bytes || !bytes.length || !ensureMiruroPako()) return null;
  var p = miruroGetPako();
  if (!p) return null;
  try {
    return p.ungzip(bytes, { to: "string" });
  } catch (e1) {
    try {
      return p.inflate(bytes, { to: "string" });
    } catch (e2) {}
  }
  return null;
}

/**
 * Miruro secure pipe body (base64) — 
 * XOR+gunzip first (x-obfuscated: 2), then plain gunzip (x-obfuscated: 1).
 */
function miruroDecodePipeResponseText(raw) {
  if (!raw) return null;
  var trimmed = String(raw).replace(/^\uFEFF/, "").trim();
  if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") return trimmed;
  if (trimmed.charAt(0) === "<") return null;

  var bytes = miruroBytesFromRaw(trimmed);
  if (!bytes.length) return null;

  var xored = miruroXorBytes(new Uint8Array(bytes), MIRURO_PIPE_OBF_KEY_HEX);
  var text = miruroTryDecompressToText(xored);
  if (text) return text;

  text = miruroTryDecompressToText(bytes);
  if (text) return text;

  try {
    return miruroTextFromBytes(bytes);
  } catch (e3) {
    return null;
  }
}

function miruroXorBytes(bytes, keyHex) {
  if (!bytes || !bytes.length || !keyHex) return bytes;
  var key = [];
  for (var i = 0; i + 1 < keyHex.length; i += 2) {
    key.push(parseInt(keyHex.substr(i, 2), 16) & 255);
  }
  if (!key.length) return bytes;
  var out = new Uint8Array(bytes.length);
  for (var j = 0; j < bytes.length; j++) out[j] = bytes[j] ^ key[j % key.length];
  return out;
}

function miruroTextFromBytes(bytes) {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  var chunk = 32768;
  var parts = [];
  for (var i = 0; i < bytes.length; i += chunk) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length))));
  }
  return parts.join("");
}

function miruroSecurePipeJson(path, query, refererUrl) {
  var payload = {
    path: path,
    method: "GET",
    query: query || {},
    body: null,
    version: "0.2.0"
  };
  var origin = miruroApiOrigin();
  var url = origin + "/api/secure/pipe?e=" + miruroBase64UrlEncodeJson(payload);
  var raw = httpGetRaw(url, {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "identity",
    Origin: origin,
    Referer: refererUrl || origin + "/"
  });
  if (!raw) {
    console.log("[miruro] secure pipe empty path=" + path + " api=" + origin);
    return null;
  }
  try {
    if (raw.charAt(0) === "{" || raw.charAt(0) === "[") return JSON.parse(raw);
    if (raw.charAt(0) === "<") {
      console.log("[miruro] secure pipe html path=" + path + " head=" + raw.substring(0, 80));
      return null;
    }
    if (raw.length < 200 && raw.indexOf("error") !== -1) {
      console.log("[miruro] secure pipe error path=" + path + " body=" + raw);
      return null;
    }
    var text = miruroDecodePipeResponseText(raw);
    if (!text) {
      console.log(
        "[miruro] secure pipe decode empty path=" +
          path +
          " rawLen=" +
          raw.length +
          " pako=" +
          !!miruroGetPako()
      );
      return null;
    }
    return JSON.parse(text);
  } catch (e) {
    console.log(
      "[miruro] secure pipe parse failed path=" + path + ": " + e + " rawLen=" + String(raw).length
    );
    return null;
  }
}

/**
 * Extracts a top-level JSON object right after `marker` (e.g. `window.__SSR_CONFIG__=`).
 * Handles strings with braces and escapes; Miruro payloads are JSON with double quotes only.
 */
function extractJsonObjectAfterMarker(html, marker) {
  var h = String(html || "");
  var i = h.indexOf(marker);
  if (i === -1) return null;
  i += marker.length;
  while (i < h.length && (h[i] === " " || h[i] === "\n" || h[i] === "\r" || h[i] === "\t")) i++;
  if (h[i] !== "{") return null;
  var depth = 0;
  var start = i;
  var inStr = false;
  var esc = false;
  var quote = null;
  for (var j = i; j < h.length; j++) {
    var c = h[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === quote) {
        inStr = false;
        quote = null;
      }
    } else {
      if (c === '"') {
        inStr = true;
        quote = '"';
      } else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          var slice = h.substring(start, j + 1);
          try {
            return JSON.parse(slice);
          } catch (e) {
            console.log("[miruro] JSON parse after marker failed: " + e);
            return null;
          }
        }
      }
    }
  }
  return null;
}

/** Same visible labels as Miruro’s Provider `<select>` (value = `pid:sub` / `pid:ssub`). */
function miruroProviderLabel(pid, meta, langKey) {
  var segs = [pid];
  if (meta && meta.relationship === "embed") segs.push("embed");
  if (langKey === "sub") segs.push("h-sub");
  else if (langKey === "ssub") segs.push("s-sub");
  return segs.join(" · ");
}

function miruroExtractorServerId(pid, langKey) {
  if (pid === "telli") return "kwik:" + langKey;
  return pid + ":" + langKey;
}

/**
 * Builds one PlaybackOption per provider track from SSR config embedded in the watch HTML.
 * All rows share the same /watch URL; Miruro stores the chosen provider in localStorage, not the URL.
 */
function buildMiruroProviderPlaybackOptionsFromSSR(config, embedUrl) {
  if (!config || !config.streaming || !config.providerOrder) return null;
  var streaming = config.streaming;
  var order = config.providerOrder;
  var out = [];
  for (var oi = 0; oi < order.length; oi++) {
    var pid = order[oi];
    if (MIRURO_DISABLED_PROVIDERS[pid]) continue;
    if (pid === "telli") continue;
    var meta = streaming[pid];
    if (!meta || meta.visible === false) continue;
    var caps = meta.capabilities || {};
    if (caps.sub) {
      out.push({
        server: miruroExtractorServerId(pid, "sub"),
        quality: "Miruro — " + miruroProviderLabel(pid, meta, "sub"),
        embed: embedUrl,
        browserSession: true
      });
    }
    if (caps.ssub) {
      out.push({
        server: miruroExtractorServerId(pid, "ssub"),
        quality: "Miruro — " + miruroProviderLabel(pid, meta, "ssub"),
        embed: embedUrl,
        browserSession: true
      });
    }
  }
  return out.length ? out : null;
}

/**
 * Pings /health on each official host; sets SOURCE.baseUrl to the first healthy origin.
 * .tv / .to / .bz / .ru are the same Miruro app (official fallbacks), not separate “servers”
 * in the player — only one watch URL is exposed; switching domain = re-run init / reload source.
 */
function initMiruroBaseFromMirrors() {
  ensureMiruroPako();
  for (var i = 0; i < MIRURO_OFFICIAL_BASES.length; i++) {
    var base = MIRURO_OFFICIAL_BASES[i].replace(/\/+$/, "");
    var raw = httpGetRaw(base + "/health?_t=" + Date.now());
    if (raw && raw.indexOf("\"status\"") !== -1 && raw.indexOf("ok") !== -1) {
      SOURCE.baseUrl = base;
      console.log("[miruro] Active origin: " + SOURCE.baseUrl);
      return;
    }
  }
  console.log("[miruro] No /health response; keeping default baseUrl=" + SOURCE.baseUrl);
}

initMiruroBaseFromMirrors();

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Content-Type": "application/json",
  Referer: SOURCE.baseUrl + "/"
};

// ── Helpers ─────────────────────────────────────────────────────────────

function decodeHtml(str) {
  if (!str) return str;
  return String(str)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, function (_, n) {
      return String.fromCharCode(parseInt(n, 10));
    })
    .replace(/\s+/g, " ")
    .trim();
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

function anilistPost(bodyObj) {
  try {
    var raw = http.post(ANILIST_GRAPHQL, JSON.stringify(bodyObj), DEFAULT_HEADERS);
    return safeJsonParse(raw);
  } catch (e) {
    console.log("[miruro] AniList POST error: " + e);
    return null;
  }
}

/** Short slug for /watch/{id}/{slug} (same idea as Miruro’s OT + kT). */
function pickShortTitle(title) {
  var en = (title && title.english && title.english.trim()) || "";
  var ro = (title && title.romaji && title.romaji.trim()) || "";
  var candidates = [en, ro].filter(Boolean);
  if (!candidates.length) return "";
  candidates.sort(function (a, b) {
    return a.length - b.length;
  });
  return candidates[0];
}

function slugifyTitle(id, title) {
  try {
    var base = pickShortTitle(title) || String(id);
    var s = String(base);
    if (typeof s.normalize === "function") {
      s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    s = s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    if (!s || s === String(id)) return String(id);
    return s;
  } catch (e) {
    return String(id);
  }
}

function mediaFormatToItemType(format) {
  var f = (format || "").toString().toUpperCase();
  if (f === "MOVIE") return "movie";
  return "tv";
}

function anilistStatusLabel(status) {
  var m = {
    RELEASING: "Airing",
    FINISHED: "Finished",
    NOT_YET_RELEASED: "Not yet aired",
    CANCELLED: "Cancelled",
    HIATUS: "Hiatus"
  };
  return m[status] || status || null;
}

function isNotYetAiredMedia(media) {
  return !!(media && media.status === "NOT_YET_RELEASED");
}

/**
 * Max episode index for listing (AniList often leaves episodes null for long runners).
 */
function maxEpisodeNumberFromMedia(media) {
  if (!media) return 1;
  if (typeof media.episodes === "number" && media.episodes > 0) {
    return Math.min(media.episodes, 2500);
  }
  var next = media.nextAiringEpisode && typeof media.nextAiringEpisode.episode === "number"
    ? media.nextAiringEpisode.episode
    : 0;
  if (next > 0) return Math.min(Math.max(next, 1), 2500);
  if (media.status === "FINISHED") return 24;
  return Math.max(next, 1);
}

function watchPath(anilistId, slug) {
  if (!slug || slug === String(anilistId)) return "/watch/" + anilistId;
  return "/watch/" + anilistId + "/" + slug;
}

// ── Catalog ─────────────────────────────────────────────────────────────

function fetchPopular(page) {
  return fetchSearch("", page || 1, { order: "POPULARITY_DESC" });
}

function fetchLatest(page) {
  return fetchSearch("", page || 1, { order: "UPDATED_AT_DESC" });
}

function fetchSearch(query, page, filters) {
  var pageNum = Math.max(1, parseInt(page, 10) || 1);
  var perPage = 20;
  var q = (query || "").trim();
  var orderPick = (filters && filters.order) || "";
  var sort = orderPick;
  if (!sort) {
    sort = q ? "SEARCH_MATCH" : "POPULARITY_DESC";
  }

  var genreVal = filters && filters.genre && String(filters.genre).trim() ? String(filters.genre).trim() : "";
  var formatVal = filters && filters.type && String(filters.type).trim() ? String(filters.type).trim() : "";

  /**
   * AniList treats explicit JSON null for genre/format as a real filter and returns no rows.
   * Only include those arguments in the document + variables when the user set a value.
   */
  var varDecl = "$page: Int, $perPage: Int, $sort: [MediaSort], $statusNotIn: [MediaStatus]";
  var mediaArgs = "type: ANIME, sort: $sort, isAdult: false, status_not_in: $statusNotIn";
  var variables = {
    page: pageNum,
    perPage: perPage,
    sort: [sort],
    statusNotIn: ["NOT_YET_RELEASED"]
  };

  if (q.length) {
    varDecl += ", $search: String";
    mediaArgs += ", search: $search";
    variables.search = q;
  }
  if (genreVal) {
    varDecl += ", $genre: String";
    mediaArgs += ", genre: $genre";
    variables.genre = genreVal;
  }
  if (formatVal) {
    varDecl += ", $format: MediaFormat";
    mediaArgs += ", format: $format";
    variables.format = formatVal;
  }

  var gql =
    "query (" +
    varDecl +
    ") { Page(page: $page, perPage: $perPage) { pageInfo { hasNextPage total } " +
    " media(" +
    mediaArgs +
    ") { id title { english romaji native } coverImage { large extraLarge } format episodes status averageScore seasonYear } } }";

  console.log("[miruro] fetchSearch page=" + pageNum + " sort=" + sort + " q=" + (q || "(browse)"));
  var parsed = anilistPost({ query: gql, variables: variables });
  if (parsed && parsed.errors && parsed.errors.length) {
    console.log("[miruro] AniList errors: " + JSON.stringify(parsed.errors));
  }
  if (!parsed || !parsed.data || !parsed.data.Page) {
    return { items: [], hasNextPage: false };
  }

  var pageData = parsed.data.Page;
  var mediaList = pageData.media || [];
  var items = [];
  for (var i = 0; i < mediaList.length; i++) {
    var m = mediaList[i];
    if (!m || m.id == null) continue;
    if (isNotYetAiredMedia(m)) continue;
    var idStr = String(m.id);
    var titleObj = m.title || {};
    var title =
      titleObj.english ||
      titleObj.romaji ||
      titleObj.native ||
      "Title " + idStr;
    var thumb = (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || "";
    var slug = slugifyTitle(m.id, titleObj);
    items.push({
      id: idStr,
      title: title,
      thumbnail: thumb,
      type: mediaFormatToItemType(m.format),
      pageUrl: MIRURO_PUBLIC_ORIGIN + "/info/" + idStr + "/" + slug
    });
  }

  var hasNext = !!(pageData.pageInfo && pageData.pageInfo.hasNextPage);
  return { items: items, hasNextPage: hasNext };
}

// ── Detail ──────────────────────────────────────────────────────────────

function fetchItemDetails(anilistId) {
  var gql =
    "query ($id: Int) { Media(id: $id) { id title { english romaji native } description bannerImage " +
    "coverImage { extraLarge large } genres format episodes status averageScore seasonYear " +
    "nextAiringEpisode { episode } } }";
  var parsed = anilistPost({ query: gql, variables: { id: parseInt(anilistId, 10) } });
  var media = parsed && parsed.data && parsed.data.Media;
  if (!media) {
    return { title: String(anilistId), pageUrl: MIRURO_PUBLIC_ORIGIN + "/info/" + anilistId };
  }

  var titleObjEarly = media.title || {};
  if (isNotYetAiredMedia(media)) {
    var t0 =
      titleObjEarly.english ||
      titleObjEarly.romaji ||
      titleObjEarly.native ||
      String(media.id);
    return {
      title: t0,
      synopsis: "",
      cover: null,
      genres: media.genres || [],
      type: mediaFormatToItemType(media.format).toUpperCase(),
      status: anilistStatusLabel(media.status),
      related: [],
      pageUrl: MIRURO_PUBLIC_ORIGIN + "/info/" + media.id + "/" + slugifyTitle(media.id, titleObjEarly)
    };
  }

  var titleObj = media.title || {};
  var title =
    titleObj.english ||
    titleObj.romaji ||
    titleObj.native ||
    String(media.id);
  var cover =
    (media.coverImage && (media.coverImage.extraLarge || media.coverImage.large)) ||
    media.bannerImage ||
    null;
  var slug = slugifyTitle(media.id, titleObj);

  return {
    title: title,
    synopsis: decodeHtml(media.description || ""),
    cover: cover,
    genres: media.genres || [],
    type: mediaFormatToItemType(media.format).toUpperCase(),
    status: anilistStatusLabel(media.status),
    related: [],
    pageUrl: MIRURO_PUBLIC_ORIGIN + "/info/" + media.id + "/" + slug
  };
}

// ── Episode list ────────────────────────────────────────────────────────

function fetchChildren(anilistId) {
  var gql =
    "query ($id: Int) { Media(id: $id) { id title { english romaji } format episodes status " +
    "nextAiringEpisode { episode } } }";
  var parsed = anilistPost({ query: gql, variables: { id: parseInt(anilistId, 10) } });
  var media = parsed && parsed.data && parsed.data.Media;
  if (!media) return [];
  if (isNotYetAiredMedia(media)) return [];

  var slug = slugifyTitle(media.id, media.title || {});
  var maxEp = maxEpisodeNumberFromMedia(media);
  var pub = MIRURO_PUBLIC_ORIGIN.replace(/\/+$/, "");
  var path = watchPath(media.id, slug);

  var out = [];
  for (var n = 1; n <= maxEp; n++) {
    out.push({
      id: media.id + "|" + n + "|" + slug,
      number: n,
      title: "Episode " + n,
      pageUrl: pub + path + "?ep=" + n
    });
  }
  console.log("[miruro] fetchChildren id=" + anilistId + " episodes=" + out.length);
  return out;
}

// ── Video list (single Miruro web session) ───────────────────────────────

function miruroWatchUrlForEpisode(baseOrigin, anilistId, slug, epNum) {
  var b = String(baseOrigin || "").replace(/\/+$/, "");
  var path = watchPath(anilistId, slug);
  return b + path + "?ep=" + encodeURIComponent(String(epNum));
}

function findMiruroProviderEpisode(episodesPayload, provider, category, epNum) {
  var providers = episodesPayload && episodesPayload.providers;
  var bucket = providers && providers[provider] && providers[provider].episodes;
  var list = bucket && bucket[category];
  if (!list || !list.length) return null;
  for (var i = 0; i < list.length; i++) {
    if (parseInt(list[i].number, 10) === parseInt(epNum, 10)) return list[i];
  }
  return null;
}

function filterMiruroWebDuplicates(options) {
  var rows = options || [];
  var miruroHls = [];
  var other = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || {};
    var baseServer = String(row.server || "").split(":")[0];
    if (MIRURO_DISABLED_PROVIDERS[baseServer]) continue;
    if (row.embed && String(row.embed).indexOf("/watch/") !== -1 && !row.url) continue;
    if (row.url && String(row.server || "").indexOf("miruro-") === 0) miruroHls.push(row);
    else other.push(row);
  }
  if (miruroHls.length) return miruroHls.concat(other);
  return other.length ? other : rows;
}

function miruroSubtitleTracks(items) {
  var raw = items || [];
  var out = [];
  var seen = Object.create(null);
  for (var i = 0; i < raw.length; i++) {
    var item = raw[i] || {};
    var url = item.url || item.file;
    if (!url || seen[url]) continue;
    seen[url] = true;
    out.push({
      url: String(url),
      language: item.language || item.lang || "und",
      label: item.label || item.language || "Subtitles",
      isDefault: !!(item.isDefault || item.default)
    });
  }
  return out;
}

function miruroEpisodeSourceConfigs(episodesPayload, epNum) {
  var providers = episodesPayload && episodesPayload.providers;
  if (!providers) return [];
  var configs = [];
  for (var provider in providers) {
    if (!providers.hasOwnProperty(provider)) continue;
    if (MIRURO_DISABLED_PROVIDERS[provider]) continue;
    var buckets = providers[provider] && providers[provider].episodes;
    if (!buckets) continue;
    for (var category in buckets) {
      if (!buckets.hasOwnProperty(category)) continue;
      var list = buckets[category];
      if (!Array.isArray(list)) continue;
      for (var i = 0; i < list.length; i++) {
        var ep = list[i];
        if (parseInt(ep && ep.number, 10) !== parseInt(epNum, 10)) continue;
        if (!ep || !ep.id) continue;
        configs.push({
          provider: String(provider).toLowerCase(),
          category: String(category).toLowerCase(),
          episodeId: String(ep.id)
        });
        break;
      }
    }
  }
  configs.sort(function (a, b) {
    var ai = MIRURO_PROVIDER_PRIORITY.indexOf(a.provider);
    var bi = MIRURO_PROVIDER_PRIORITY.indexOf(b.provider);
    if (ai < 0) ai = 99;
    if (bi < 0) bi = 99;
    return ai - bi;
  });
  return configs;
}

function miruroOptionsHaveHls(options) {
  for (var i = 0; i < (options || []).length; i++) {
    var u = options[i] && options[i].url;
    if (u && String(u).indexOf(".m3u8") !== -1) return true;
  }
  return false;
}

function collectMiruroVideoStreams(payload, category) {
  if (!payload) return { streams: [], subtitles: [] };
  var videoArray = payload.sources || payload.streams || [];
  var subArray = miruroSubtitleTracks(payload.subtitles || []);
  if (!videoArray.length) {
    var keys = [category, "sub", "ssub", "dub", "hdub", "hsub"];
    for (var k = 0; k < keys.length; k++) {
      var bucket = payload[keys[k]];
      if (!bucket) continue;
      if (bucket.streams && bucket.streams.length) {
        videoArray = bucket.streams;
        subArray = miruroSubtitleTracks(bucket.subtitles || subArray);
        break;
      }
      if (bucket.sources && bucket.sources.length) {
        videoArray = bucket.sources;
        subArray = miruroSubtitleTracks(bucket.subtitles || subArray);
        break;
      }
    }
  }
  return { streams: videoArray, subtitles: subArray };
}

var MIRURO_STREAM_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function miruroEmbedPageForStream(stream, provider) {
  var ref = stream && stream.referer;
  if (provider === "kiwi" || provider === "telli" || (ref && String(ref).indexOf("kwik.") !== -1)) {
    return ref || "https://kwik.cx/";
  }
  if (ref) return ref;
  return miruroApiOrigin() + "/";
}

/** owocdn / uwucdn require Kwik Referer+Origin or they return 403. */
function miruroStreamRequestHeaders(stream, provider) {
  var embedPage = miruroEmbedPageForStream(stream, provider);
  if (provider === "kiwi" || provider === "telli" || embedPage.indexOf("kwik.") !== -1) {
    return {
      Referer: "https://kwik.cx/",
      Origin: "https://kwik.cx",
      "User-Agent": MIRURO_STREAM_UA
    };
  }
  var origin = String(embedPage).replace(/\/+$/, "");
  return {
    Referer: embedPage,
    Origin: origin,
    "User-Agent": MIRURO_STREAM_UA
  };
}

function miruroSortStreamsForPlayback(streams) {
  var list = (streams || []).slice();
  list.sort(function (a, b) {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    var ah = (a.resolution && a.resolution.height) || 0;
    var bh = (b.resolution && b.resolution.height) || 0;
    return bh - ah;
  });
  return list;
}

function normalizeMiruroPlaybackOptions(provider, category, payload) {
  if (!payload) return [];
  var collected = collectMiruroVideoStreams(payload, category);
  var streams = miruroSortStreamsForPlayback(collected.streams);
  if (!streams || !streams.length) return [];

  var hasDirect = false;
  for (var d = 0; d < streams.length; d++) {
    var dt = (streams[d] && streams[d].type) || "";
    if (dt === "hls" || dt === "mp4") hasDirect = true;
  }

  var out = [];
  var seen = Object.create(null);
  var hlsCount = 0;
  for (var i = 0; i < streams.length; i++) {
    var s = streams[i] || {};
    if (!s.url || seen[s.url]) continue;
    if (s.type === "embed" && hasDirect) continue;

    seen[s.url] = true;
    var streamUrl = String(s.url || "").replace("/stream/", "/hls/").replace("uwu.m3u8", "owo.m3u8");
    var headers = miruroStreamRequestHeaders(s, provider);
    var embedPage = miruroEmbedPageForStream(s, provider);

    var quality =
      s.quality ||
      (s.resolution && s.resolution.height ? s.resolution.height + "p" : null) ||
      s.type ||
      "Auto";
    var langTag = category.indexOf("dub") !== -1 ? "DUB" : "SUB";
    var title = "Miruro — " + provider + " (" + quality + ") [" + langTag + "]";
    var subtitles = category.indexOf("sub") !== -1 ? collected.subtitles : [];

    if (s.type === "hls" || streamUrl.indexOf(".m3u8") !== -1 || streamUrl.indexOf(".mp4") !== -1) {
      if (hlsCount >= 4) continue;
      hlsCount++;
      out.push({
        server: provider + ":" + category,
        quality: title,
        url: streamUrl,
        embed: embedPage,
        headers: headers,
        subtitles: subtitles
      });
    } else if (s.type === "embed" || String(streamUrl).indexOf("kwik.") !== -1) {
      out.push({
        server: "kwik",
        quality: title + " (embed)",
        embed: streamUrl,
        headers: headers
      });
    }
  }
  return out;
}

function fetchMiruroDynamicPlaybackOptions(anilistId, epNum, episodesPayload, watchReferer) {
  if (!episodesPayload) {
    episodesPayload = miruroSecurePipeJson("episodes", { anilistId: String(anilistId) }, watchReferer);
  }
  if (!episodesPayload || !episodesPayload.providers) {
    console.log("[miruro] episodes mapping missing for id=" + anilistId);
    return [];
  }
  var configs = miruroEpisodeSourceConfigs(episodesPayload, epNum);
  console.log("[miruro] source configs ep=" + epNum + " count=" + configs.length);
  if (!configs.length) return [];

  var out = [];
  for (var i = 0; i < configs.length; i++) {
    var cfg = configs[i];
    var srcQuery = {
      episodeId: cfg.episodeId,
      provider: cfg.provider,
      category: cfg.category,
      ttl: 86400
    };
    if (cfg.provider === "dune" || cfg.provider === "zoro" || cfg.provider === "arc") {
      srcQuery.anilistId = parseInt(anilistId, 10);
    }
    var payload = miruroSecurePipeJson("sources", srcQuery, watchReferer);
    if (!payload) {
      console.log("[miruro] sources empty " + cfg.provider + "/" + cfg.category);
      continue;
    }
    var options = normalizeMiruroPlaybackOptions(cfg.provider, cfg.category, payload);
    if (!options.length) {
      console.log("[miruro] sources no streams " + cfg.provider + "/" + cfg.category);
      continue;
    }
    for (var j = 0; j < options.length; j++) out.push(options[j]);
  }
  return out;
}

/**
 * episodeId: "{anilistId}|{episodeNum}|{slug}" (slug optional; see fetchChildren)
 *
 * Provider rows match labels from the Miruro watch HTML (`window.__SSR_CONFIG__`: providerOrder +
 * streaming capabilities). Each row opens the same /watch URL; the site chooses the stream after
 * load (Kazemi cannot drive Miruro’s encrypted pipe / localStorage provider key from JS alone).
 */
function fetchVideoList(episodeIdStr) {
  var parts = String(episodeIdStr || "").split("|");
  var alId = (parts[0] || "").trim();
  if (!alId) return [];

  var epNum = parseInt(parts[1], 10);
  if (!isFinite(epNum) || epNum < 1) epNum = 1;

  var slug = parts.length > 2 && parts[2] ? String(parts[2]).trim() : "";
  if (!slug) slug = alId;

  var pub = MIRURO_PUBLIC_ORIGIN.replace(/\/+$/, "");
  var embedUrl = miruroWatchUrlForEpisode(pub, alId, slug, epNum);

  var episodesPayload = miruroSecurePipeJson("episodes", { anilistId: String(alId) }, embedUrl);
  var directOptions = fetchMiruroDynamicPlaybackOptions(alId, epNum, episodesPayload, embedUrl);

  if (directOptions.length) {
    var playable = filterMiruroWebDuplicates(directOptions);
    console.log(
      "[miruro] fetchVideoList ep=" +
        epNum +
        " direct=" +
        playable.length +
        " api=" +
        miruroApiOrigin()
    );
    return playable;
  }

  var html = httpGetHtml(embedUrl);
  var ssrCfg = html ? extractJsonObjectAfterMarker(html, "window.__SSR_CONFIG__=") : null;
  var fromSSR = buildMiruroProviderPlaybackOptionsFromSSR(ssrCfg, embedUrl);
  if (fromSSR && fromSSR.length) {
    console.log(
      "[miruro] fetchVideoList ep=" + epNum + " providers=" + fromSSR.length + " (SSR labels only)"
    );
    return fromSSR;
  }

  var fallbackProviders = buildMiruroProviderPlaybackOptionsFromSSR(MIRURO_DEFAULT_PLAYER_CONFIG, embedUrl);
  if (fallbackProviders && fallbackProviders.length) {
    console.log(
      "[miruro] fetchVideoList ep=" +
        epNum +
        " url=" +
        embedUrl +
        " providers=" +
        fallbackProviders.length +
        " (default config fallback; htmlLen=" +
        (html ? html.length : 0) +
        ")"
    );
    return fallbackProviders;
  }

  console.log("[miruro] fetchVideoList ep=" + epNum + " url=" + embedUrl + " (fallback, no providers)");

  return [
    {
      server: "miruro-page",
      quality: "WEB — Miruro player — Ep " + epNum,
      embed: embedUrl,
      browserSession: true
    }
  ];
}
