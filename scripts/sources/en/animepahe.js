// animepahe — Kazemi JS Extension
// =========================================================

const SOURCE = {
  id: "animepahe",
  name: "AnimePahe",
  baseUrl: "https://animepahe.pw",
  language: "en",
  version: "1.0.0",
  iconUrl: "https://animepahe.com/packs/static/images/logo_b3f36f69f4ec52eb2e4289f8f8f3e7a0.png",
  contentKind: "anime",
  extractorRepositoryUrl: "https://raw.githubusercontent.com/kakuga-code/extensions/refs/heads/main/repo-extractores.json",
  supportsPopular: false,
  filters: []
};

const API_BASE = "https://animepahe.com/api";
const PAGE_SIZE = 8;
const MAX_CHILD_PAGES = 12;
const MAX_CHILD_FETCH_MS = 20000;
// Reusar la misma sesión/cookies para evitar repetir el challenge en cada request.
var _ddosInstance = null;
// /a/{id numérico} → UUID de sesión (evita doble GET al abrir ficha + episodios).
var _animeSessionCache = Object.create(null);

// ── Helpers ──────────────────────────────────────────────

function decodeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeJsonParse(raw) {
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function episodeNumberFromTitle(title, fallback) {
  var m = String(title || "").match(/(?:episode|ep)\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!m) return fallback;
  var n = parseFloat(m[1]);
  return isNaN(n) ? fallback : n;
}

function normalizePoster(url) {
  if (!url) return null;
  if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return url;
  if (url.indexOf("//") === 0) return "https:" + url;
  return "https://animepahe.com" + (url.charAt(0) === "/" ? "" : "/") + url;
}

/** Ruta de catálogo / detalle: siempre /a/{anime_id numérico} (Tachiyomi AnimePahe.kt). */
function toAnimePageUrl(catalogId) {
  var id = String(catalogId || "").trim();
  if (!id) return "https://animepahe.com/";
  return "https://animepahe.com/a/" + id;
}

function toPlayUrl(animeSession, episodeSession) {
  return "https://animepahe.com/play/" + animeSession + "/" + episodeSession;
}

function stableIdForSearchItem(item) {
  // airing: anime_id + anime_title + snapshot | search: id + title + poster
  if (item.anime_id != null && item.anime_id !== "") return String(item.anime_id);
  if (item.id != null && item.id !== "") return String(item.id);
  if (item.session) return String(item.session);
  if (item.anime_session) return String(item.anime_session);
  return "";
}

function titleForCatalogItem(item, fallbackId) {
  return item.anime_title || item.title || item.name || ("Anime " + (fallbackId || ""));
}

function posterForCatalogItem(item) {
  return normalizePoster(item.snapshot || item.poster || item.cover);
}

function hasNextPageFromApi(data) {
  var cur = parseInt(data.current_page, 10);
  var last = parseInt(data.last_page, 10);
  if (isNaN(cur)) cur = 1;
  if (isNaN(last)) last = 1;
  return cur < last;
}

function extractSessionUuidFromAnimePage(html) {
  var canon = extractSingle(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  var og = extractSingle(html, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
  for (var i = 0; i < 2; i++) {
    var u = i === 0 ? canon : og;
    if (!u) continue;
    var m = u.match(/\/anime\/([\w-]+)\/?(?:\?|$)/i);
    if (m) return m[1];
  }
  var m2 = html.match(/\/anime\/([\w-]{8,})/i);
  return m2 ? m2[1] : "";
}

/**
 * La API m=release usa el UUID de sesión (tras /a/{anime_id} → /anime/{session}, ver AnimePahe.kt fetchSession).
 */
async function resolveAnimeSessionId(catalogOrSessionId) {
  var raw = String(catalogOrSessionId || "").trim();
  if (!raw) return "";
  if (!/^\d+$/.test(raw)) return raw;
  if (_animeSessionCache[raw]) return _animeSessionCache[raw];
  try {
    var url = toAnimePageUrl(raw);
    var html = await ddosFetchText(url, { Referer: "https://animepahe.com/" });
    var session = extractSessionUuidFromAnimePage(html);
    if (session) _animeSessionCache[raw] = session;
    return session;
  } catch (e) {
    return "";
  }
}

function detailPageUrl(itemId) {
  var id = String(itemId || "").trim();
  if (!id) return "https://animepahe.com/";
  if (/^\d+$/.test(id)) return toAnimePageUrl(id);
  return "https://animepahe.com/anime/" + id;
}

function animeSessionReferer(sessionUuid) {
  return "https://animepahe.com/anime/" + String(sessionUuid || "").replace(/^\/+/, "");
}

function ddosFetchText(url, headers) {
  if (!_ddosInstance) _ddosInstance = new DdosGuardInterceptor();
  return _ddosInstance.fetchWithBypass(url, headers || {}).then(function(resp) {
    return resp.text();
  });
}

function ddosFetchJson(url, headers) {
  return ddosFetchText(url, headers).then(function(text) {
    var parsed = safeJsonParse(text);
    return parsed || {};
  });
}

function extractSingle(str, re) {
  var m = str.match(re);
  return m ? m[1] : "";
}

function unescapeJsString(s) {
  if (!s) return "";
  return String(s)
    .replace(/\\\//g, "/")
    .replace(/\\x3A/gi, ":")
    .replace(/\\x2F/gi, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\\/g, "\\");
}

function normalizeKwikHls(url) {
  if (!url) return url;
  var u = String(url);
  // patrón conocido en referencia Luna
  u = u.replace("/stream/", "/hls/");
  u = u.replace("uwu.m3u8", "owo.m3u8");
  return u;
}

// ── Catalog ───────────────────────────────────────────────

function fetchPopular(page) {
  // AnimePahe doesn't expose a clean "popular" API endpoint publicly.
  return fetchLatest(page || 1);
}

function fetchLatest(page) {
  // Intentar endpoint de "airing/latest" y caer a búsqueda amplia.
  return fetchLatestFromApi(page || 1);
}

async function fetchLatestFromApi(page) {
  var pageNum = page || 1;
  var tries = [API_BASE + "?m=airing&page=" + pageNum];

  for (var i = 0; i < tries.length; i++) {
    try {
      var data = await ddosFetchJson(tries[i], { "Referer": "https://animepahe.com/" });
      var arr = Array.isArray(data.data) ? data.data : [];
      if (!arr.length) continue;
      var items = arr.map(function(item) {
        var sid = stableIdForSearchItem(item);
        return {
          id: sid,
          slug: sid,
          title: titleForCatalogItem(item, sid),
          thumbnail: posterForCatalogItem(item),
          type: item.type || "TV",
          pageUrl: toAnimePageUrl(sid)
        };
      }).filter(function(x) { return !!x.id; });
      if (items.length) {
        return {
          items: items,
          hasNextPage: hasNextPageFromApi(data)
        };
      }
    } catch (e) {}
  }

  // Fallback para no dejar vacía la pestaña.
  return fetchSearch("a", pageNum, {});
}

async function fetchSearch(query, page, filters) {
  var q = (query || "").trim();
  if (!q) q = "a";
  var pageNum = page || 1;
  var url = API_BASE + "?m=search&q=" + encodeURIComponent(q) + "&page=" + pageNum;

  try {
    var data = await ddosFetchJson(url, { "Referer": "https://animepahe.com/" });
    var arr = Array.isArray(data.data) ? data.data : [];
    var items = arr.map(function(item) {
      var sid = stableIdForSearchItem(item);
      return {
        id: sid,
        slug: sid,
        title: titleForCatalogItem(item, sid),
        thumbnail: posterForCatalogItem(item),
        type: item.type || "TV",
        pageUrl: toAnimePageUrl(sid)
      };
    }).filter(function(x) { return !!x.id; });

    return {
      items: items,
      hasNextPage: hasNextPageFromApi(data)
    };
  } catch (e) {
    console.log("[animepahe] fetchSearch error: " + e);
    return { items: [], hasNextPage: false };
  }
}

// ── Detail ────────────────────────────────────────────────

async function fetchItemDetails(itemId) {
  var animeSession = String(itemId || "");
  var url = detailPageUrl(animeSession);
  try {
    var html = await ddosFetchText(url, { "Referer": "https://animepahe.com/" });

    var title = decodeHtml(
      extractSingle(html, /<h1[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
      extractSingle(html, /<title>([^<]+)<\/title>/i).replace(/\s*\|\s*AnimePahe.*$/i, "")
    ) || animeSession;
    // Ejemplo frecuente: "One Piece Ep. 1-1159 :: animepahe"
    title = title
      .replace(/\s*Ep\.\s*\d+(?:-\d+)?\s*::\s*animepahe\s*$/i, "")
      .replace(/\s*::\s*animepahe\s*$/i, "")
      .trim();

    var synopsis = decodeHtml(
      extractSingle(html, /<div[^>]*class="[^"]*anime-synopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    );

    var aliases = decodeHtml(
      extractSingle(html, /<strong>\s*Synonyms:\s*<\/strong>([\s\S]*?)<\/p>/i)
    );
    if (aliases) synopsis = synopsis ? (synopsis + "\n\nSynonyms: " + aliases) : ("Synonyms: " + aliases);

    var air = decodeHtml(
      extractSingle(html, /<strong>\s*Aired:\s*<\/strong>([\s\S]*?)<\/p>/i)
    );
    var status = air || null;

    var cover = normalizePoster(
      extractSingle(html, /property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      extractSingle(html, /<img[^>]+class="[^"]*anime-poster[^"]*"[^>]+src=["']([^"']+)["']/i)
    );

    var genres = [];
    var genresRaw = decodeHtml(
      extractSingle(html, /<strong>\s*Genres:\s*<\/strong>([\s\S]*?)<\/p>/i)
    );
    if (genresRaw) {
      genres = genresRaw.split(",").map(function(g) { return g.trim(); }).filter(Boolean);
    }

    if (/^\d+$/.test(animeSession)) {
      var sid = extractSessionUuidFromAnimePage(html);
      if (sid) _animeSessionCache[animeSession] = sid;
    }

    return {
      title: title,
      synopsis: synopsis || "",
      cover: cover,
      genres: genres,
      type: "TV",
      status: status,
      related: [],
      pageUrl: url
    };
  } catch (e) {
    console.log("[animepahe] fetchItemDetails error: " + e);
    return { title: animeSession, synopsis: "", genres: [], related: [], pageUrl: url };
  }
}

// ── Episodes ───────────────────────────────────────────────

async function fetchChildren(itemId) {
  var catalogId = String(itemId || "");
  if (!catalogId) return [];

  var animeSession = await resolveAnimeSessionId(catalogId);
  if (!animeSession) {
    console.log("[animepahe] fetchChildren: no session for id=" + catalogId);
    return [];
  }

  var episodes = [];
  var seenSessions = {};
  var page = 1;
  var lastPage = 1;
  var startedAt = Date.now();

  try {
    do {
      if ((Date.now() - startedAt) > MAX_CHILD_FETCH_MS) {
        console.log("[animepahe] fetchChildren reached time budget");
        break;
      }
      if (page > MAX_CHILD_PAGES) {
        console.log("[animepahe] fetchChildren reached page budget");
        break;
      }
      var api = API_BASE + "?m=release&id=" + encodeURIComponent(animeSession) +
        "&sort=episode_asc&page=" + page;
      var data = await ddosFetchJson(api, { "Referer": animeSessionReferer(animeSession) });

      var rows = Array.isArray(data.data) ? data.data : [];
      rows.forEach(function(ep, idx) {
        var epSession = ep.session || "";
        if (!epSession || seenSessions[epSession]) return;
        seenSessions[epSession] = true;
        var epNum = ep.episode;
        var number = (typeof epNum === "number") ? epNum : episodeNumberFromTitle(String(epNum || ""), episodes.length + idx + 1);
        episodes.push({
          id: JSON.stringify({
            animeSession: animeSession,
            episodeSession: epSession,
            episodeNumber: number
          }),
          number: number,
          title: "Episode " + number,
          pageUrl: toPlayUrl(animeSession, epSession)
        });
      });

      lastPage = parseInt(data.last_page || 1, 10);
      if (isNaN(lastPage) || lastPage < 1) lastPage = 1;
      page++;
    } while (page <= lastPage);

    episodes.sort(function(a, b) { return a.number - b.number; });
    return episodes;
  } catch (e) {
    console.log("[animepahe] fetchChildren error: " + e);
    return [];
  }
}

// ── Video List ────────────────────────────────────────────

async function fetchVideoList(episodeId) {
  var parsed = safeJsonParse(episodeId || "");
  if (!parsed || !parsed.animeSession || !parsed.episodeSession) return [];

  var playUrl = toPlayUrl(parsed.animeSession, parsed.episodeSession);
  var out = [];

  try {
    var html = await ddosFetchText(playUrl, { "Referer": animeSessionReferer(parsed.animeSession) });

    // Tachiyomi videoListParse: #resolutionMenu > button[data-src] (kwik); pickDownload hrefs resuelven stream en app Kotlin.
    var resBlockM = html.match(/<div[^>]*\bid\s*=\s*["']resolutionMenu["'][^>]*>([\s\S]*?)<\/div>/i);
    var btnTags = [];
    if (resBlockM) {
      var btnRe = /<button\s+([^>]*)>/gi;
      var bm;
      while ((bm = btnRe.exec(resBlockM[1])) !== null) {
        btnTags.push(bm[1]);
      }
    }

    for (var bi = 0; bi < btnTags.length; bi++) {
      var tagAttr = btnTags[bi];
      var src = extractSingle(tagAttr, /\bdata-src\s*=\s*["']([^"']+)["']/i);
      if (!src) continue;
      if (src.indexOf("//") === 0) src = "https:" + src;
      var res = extractSingle(tagAttr, /\bdata-resolution\s*=\s*["']([^"']*)["']/i) || "";
      var audio = extractSingle(tagAttr, /\bdata-audio\s*=\s*["']([^"']*)["']/i) || "jpn";
      var qualityLabel = res ? (String(res).toLowerCase().indexOf("p") >= 0 ? String(res) : res + "p") : ("Mirror " + (bi + 1));
      var title = qualityLabel + " • " + (audio === "eng" ? "Dub" : "Sub");
      var isKwik = /kwik\./i.test(src);
      out.push({
        server: isKwik ? "kwik" : "animepahe",
        quality: title,
        embed: src,
        browserSession: true,
        headers: { referer: "https://kwik.cx/" }
      });
    }

    // Fallback: cualquier button con data-src (HTML sin ids o variantes).
    if (out.length === 0) {
      var re = /<button[^>]*\bdata-src\s*=\s*["']([^"']+)["'][^>]*>/gi;
      var m;
      while ((m = re.exec(html)) !== null) {
        var src2 = m[1];
        var tag = m[0];
        if (src2.indexOf("//") === 0) src2 = "https:" + src2;
        var res2 = extractSingle(tag, /\bdata-resolution\s*=\s*["']([^"']*)["']/i) || "Unknown";
        var audio2 = extractSingle(tag, /\bdata-audio\s*=\s*["']([^"']*)["']/i) || "jpn";
        var title2 = res2 + "p • " + (audio2 === "eng" ? "Dub" : "Sub");
        out.push({
          server: /kwik\./i.test(src2) ? "kwik" : "animepahe",
          quality: title2,
          embed: src2,
          browserSession: true,
          headers: { referer: "https://kwik.cx/" }
        });
      }
    }

    // Fallback generic iframe capture
    if (out.length === 0) {
      var ifr = /<iframe[^>]+src="([^"]+)"/gi;
      var im;
      while ((im = ifr.exec(html)) !== null) {
        out.push({
          server: "embed",
          quality: "Embed",
          embed: im[1],
          browserSession: true
        });
      }
    }

    // Fallback 2: buscar directamente enlaces de kwik en el HTML
    if (out.length === 0) {
      var kwikRe = /https?:\/\/(?:www\.)?kwik\.[^"'\\\s<]+/gi;
      var km;
      while ((km = kwikRe.exec(html)) !== null) {
        out.push({
          server: "kwik",
          quality: "Kwik",
          embed: km[0],
          browserSession: true,
          headers: { referer: "https://kwik.cx/" }
        });
      }
    }

    // Unique by embed URL
    var seen = {};
    return out.filter(function(x) {
      if (!x.embed) return false;
      if (seen[x.embed]) return false;
      seen[x.embed] = true;
      return true;
    });
  } catch (e) {
    console.log("[animepahe] fetchVideoList error: " + e);
    return [];
  }
}

async function resolveKwikToDirect(kwikUrl, refererUrl) {
  try {
    var kwikHtml = await ddosFetchText(kwikUrl, {
      "Referer": refererUrl || "https://animepahe.com/",
      "User-Agent": "Mozilla/5.0"
    });
    if (!kwikHtml) return null;

    // Algunos mirrors usan doble empaquetado eval(p,a,c,k,e,d)
    var scriptBody = extractSingle(kwikHtml, /<script>([\s\S]*?)<\/script>/i);
    if (!scriptBody) return null;

    var unpacked = null;
    if (scriptBody.indexOf("));eval(") !== -1) {
      var parts = scriptBody.split("));eval(");
      if (parts.length === 2) {
        var layer2 = parts[1].substring(0, parts[1].length - 1);
        unpacked = unpack(layer2);
      }
    } else if (scriptBody.indexOf("eval(function(p,a,c,k,e,d)") !== -1) {
      unpacked = unpack(scriptBody);
    } else {
      unpacked = scriptBody;
    }
    if (!unpacked) return null;

    var m =
      unpacked.match(/const\s+source\s*=\s*\\?['"]([^'"]+)['"]/i) ||
      unpacked.match(/source\s*:\s*\\?['"]([^'"]+\.m3u8[^'"]*)['"]/i) ||
      unpacked.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"]*/i);
    if (!m) return null;

    var raw = m[1] || m[0] || "";
    if (!raw) return null;
    raw = unescapeJsString(raw).replace(/\\+$/, "");
    return normalizeKwikHls(raw);
  } catch (e) {
    return null;
  }
}

// ── Packed JS unpacker (para Kwik) ────────────────────────

class Unbaser {
  constructor(base) {
    this.ALPHABET = {
      62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
      95: "' !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'"
    };
    this.dictionary = {};
    this.base = base;
    if (36 < base && base < 62) {
      this.ALPHABET[base] = this.ALPHABET[base] || this.ALPHABET[62].substr(0, base);
    }
    if (2 <= base && base <= 36) {
      this.unbase = function(v) { return parseInt(v, base); };
    } else {
      var alphabet = this.ALPHABET[base];
      if (!alphabet) throw Error("Unsupported base encoding.");
      for (var i = 0; i < alphabet.length; i++) this.dictionary[alphabet[i]] = i;
      this.unbase = this._dictunbaser.bind(this);
    }
  }

  _dictunbaser(value) {
    var ret = 0;
    var chars = String(value).split("").reverse();
    for (var i = 0; i < chars.length; i++) {
      ret += Math.pow(this.base, i) * (this.dictionary[chars[i]] || 0);
    }
    return ret;
  }
}

function unpack(source) {
  function filterArgs(src) {
    var juicers = [
      /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\), *(\d+), *(.*)\)\)/,
      /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\)/
    ];
    for (var i = 0; i < juicers.length; i++) {
      var args = juicers[i].exec(src);
      if (!args) continue;
      return {
        payload: args[1],
        radix: parseInt(args[2], 10),
        count: parseInt(args[3], 10),
        symtab: args[4].split("|")
      };
    }
    throw Error("Could not parse p.a.c.k.e.r input");
  }

  var p = filterArgs(source);
  if (p.count !== p.symtab.length) throw Error("Malformed p.a.c.k.e.r symtab");
  var unbase = new Unbaser(p.radix);

  function lookup(word) {
    var value = p.radix === 1 ? p.symtab[parseInt(word, 10)] : p.symtab[unbase.unbase(word)];
    return value || word;
  }

  return p.payload.replace(/\b\w+\b/g, lookup);
}

// ── DDoS-Guard bypass ────────────────────────────────────
// URLSession de iOS maneja cookies automáticamente. El interceptor solo
// necesita hacer las peticiones al check.js y al probe para que el sistema
// almacene la cookie __ddg2_. No gestionamos cookies manualmente.

class DdosGuardInterceptor {
  constructor() {
    this._ddgId = "";
    this._baseDomain = "";
  }

  async _resolveChallenge(targetUrl) {
    if (this._ddgId) return true;
    try {
      var wellKnown = await fetchv2("https://check.ddos-guard.net/check.js", {
        "Referer": targetUrl,
        "User-Agent": "Mozilla/5.0"
      }, "GET");
      var js = await wellKnown.text();

      var localPathM = js.match(/['"](\/\.well-known\/ddos-guard\/[^'"]+)['"]/);
      if (!localPathM) return false;

      // Extraer el ID directamente del path
      var idMatch = localPathM[1].match(/\/id\/([^\/]+)/);
      if (!idMatch) return false;
      this._ddgId = idMatch[1];

      var baseM = String(targetUrl).match(/^(https?:\/\/[^\/]+)/i);
      if (!baseM) return false;
      this._baseDomain = baseM[1];

      // Hacer ping al probe para que el servidor registre la cookie
      // (no necesitamos leer la respuesta, solo activar el Set-Cookie del servidor)
      var localUrl = this._baseDomain + localPathM[1];
      await fetchv2(localUrl, {
        "Referer": targetUrl,
        "User-Agent": "Mozilla/5.0",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      }, "GET");

      return true;
    } catch (e) {
      return false;
    }
  }

  async fetchWithBypass(url, headers) {
    var h = headers || {};

    // Resolver challenge antes de la primera petición
    if (!this._ddgId) {
      await this._resolveChallenge(url);
    }

    // Inyectar la cookie manualmente en cada petición
    if (this._ddgId) {
      h["Cookie"] = "__ddg2_=" + this._ddgId;
    }

    // Primer intento
    var resp = await fetchv2(url, h, "GET", null);

    // Si es 403, reintentar con nuevo challenge
    if (resp.status === 403) {
      this._ddgId = "";
      var got = await this._resolveChallenge(url);
      if (got) {
        h["Cookie"] = "__ddg2_=" + this._ddgId;
        return fetchv2(url, h, "GET", null);
      }
      return resp;
    }

    var txt = await resp.text();

    var blocked =
      txt.indexOf("ddos-guard/js-challenge") !== -1 ||
      txt.indexOf("DDoS-Guard") !== -1 ||
      txt.indexOf("data-ddg-origin") !== -1;

    if (!blocked) {
      resp.text = async function() { return txt; };
      return resp;
    }

    // Challenge detectado — reintentar
    this._ddgId = "";
    var got = await this._resolveChallenge(url);
    if (!got) {
      resp.text = async function() { return txt; };
      return resp;
    }
    h["Cookie"] = "__ddg2_=" + this._ddgId;
    return fetchv2(url, h, "GET", null);
  }
}
