// AniZone — Extensión Kazemi JS
// Fuente: https://anizone.to
// =========================================================

const SOURCE = {
  id: "anizone",
  name: "AniZone",
  baseUrl: "https://anizone.to",
  language: "en",
  version: "1.0.0",
  iconUrl: "https://anizone.to/favicon.ico",
  contentKind: "anime",
  extractorRepositoryUrl: "https://raw.githubusercontent.com/kakuga-code/extensions/refs/heads/main/repo-extractores.json",
  supportsPopular: false,
  supportedTypes: ["tv", "movie", "ova", "ona", "special"]
};

var PAGE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  "Referer": SOURCE.baseUrl + "/"
};

function decodeHtml(text) {
  return (text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, function (_, dec) { return String.fromCharCode(parseInt(dec, 10)); });
}

function cleanText(text) {
  return decodeHtml((text || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(url) {
  if (!url) return null;
  var value = String(url).trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^\/\//.test(value)) return "https:" + value;
  if (value.charAt(0) === "/") return SOURCE.baseUrl + value;
  return SOURCE.baseUrl + "/" + value.replace(/^\/+/, "");
}

function getHtml(url, extraHeaders) {
  var headers = {};
  for (var k in PAGE_HEADERS) headers[k] = PAGE_HEADERS[k];
  if (extraHeaders) {
    for (var h in extraHeaders) headers[h] = extraHeaders[h];
  }
  return http.get(url, headers);
}

function parseCatalogItems(html) {
  var out = [];
  var byId = {};

  // Primary: <img src="..." alt="..."> immediately followed by <a href="/anime/{id}" title="...">
  var re = /<img\s+src="([^"]+)"[^>]*alt="([^"]+)"[\s\S]{0,600}?<a[^>]+href="(?:https?:\/\/[^\/'"]+)?\/anime\/([a-z0-9]+)[^"]*"\s+title="([^"]+)"/gi;
  var m;
  while ((m = re.exec(html || "")) !== null) {
    var thumb = absoluteUrl(m[1]);
    var id = m[3];
    var title = cleanText(m[4]) || cleanText(m[2]) || id;
    if (!id || byId[id]) continue;
    byId[id] = {
      id: id,
      slug: id,
      title: title,
      thumbnail: thumb,
      type: "TV",
      status: null,
      genres: [],
      pageUrl: SOURCE.baseUrl + "/anime/" + id
    };
    out.push(byId[id]);
  }

  // Fallback: extraer IDs desde Livewire.navigate(...) en caso de markup parcial.
  if (out.length === 0) {
    var seen = {};
    var navRe = /Livewire\.navigate\(['"](?:https?:)?\/\/anizone\.to\/anime\/([a-z0-9]+)['"]\)/gi;
    while ((m = navRe.exec(html || "")) !== null) {
      var nid = m[1];
      if (!nid || seen[nid]) continue;
      seen[nid] = true;
      out.push({
        id: nid,
        slug: nid,
        title: nid,
        thumbnail: null,
        type: "TV",
        status: null,
        genres: [],
        pageUrl: SOURCE.baseUrl + "/anime/" + nid
      });
    }
  }

  // Fallback extra: buscar cualquier referencia a /anime/{id} en HTML/JS
  // (incluye URLs escapadas tipo https:\/\/anizone.to\/anime\/id).
  if (out.length === 0) {
    var seenAny = {};
    var anyRe = /(?:https?:\\?\/\\?\/anizone\.to\\?\/anime\\?\/|\/anime\/)([a-z0-9]+)(?!\/[0-9]+)/gi;
    while ((m = anyRe.exec(html || "")) !== null) {
      var aid = m[1];
      if (!aid || seenAny[aid]) continue;
      seenAny[aid] = true;
      out.push({
        id: aid,
        slug: aid,
        title: aid,
        thumbnail: null,
        type: "TV",
        status: null,
        genres: [],
        pageUrl: SOURCE.baseUrl + "/anime/" + aid
      });
    }
  }

  return out;
}

function fetchLatest(page) {
  var html = getHtml(SOURCE.baseUrl + "/");
  var items = parseCatalogItems(html);
  console.log("[anizone] latest items=" + items.length);
  return { items: items, hasNextPage: false };
}

function fetchPopular(page) {
  var html = getHtml(SOURCE.baseUrl + "/");
  var items = parseCatalogItems(html);
  // Detección estricta de challenge para evitar falsos positivos.
  if (/performing security verification/i.test(html || "")
      || (/ray id:/i.test(html || "") && /enable javascript and cookies to continue/i.test(html || ""))) {
    console.log("[anizone] homepage protected by Cloudflare challenge");
  }
  console.log("[anizone] popular items=" + items.length);
  return { items: items, hasNextPage: false };
}

// Type values: 1=TV, 2=Movie, 3=OVA, 4=ONA, 5=Special
// Sort values: latest (default), title-asc, title-desc, score-desc
var FILTER_DEFS = [
  {
    id: "type",
    name: "Type",
    type: "select",
    options: [
      { id: "", name: "All" },
      { id: "1", name: "TV" },
      { id: "2", name: "Movie" },
      { id: "3", name: "OVA" },
      { id: "4", name: "ONA" },
      { id: "5", name: "Special" }
    ]
  },
  {
    id: "sort",
    name: "Sort",
    type: "select",
    options: [
      { id: "", name: "Latest" },
      { id: "title-asc", name: "Title (A-Z)" },
      { id: "title-desc", name: "Title (Z-A)" },
      { id: "score-desc", name: "Score" }
    ]
  }
];

function fetchFilters() {
  return FILTER_DEFS;
}

function fetchSearch(query, page, filters) {
  var q = (query || "").trim();
  var params = [];
  if (q) params.push("search=" + encodeURIComponent(q));
  if (filters) {
    if (filters.type) params.push("type=" + encodeURIComponent(filters.type));
    if (filters.sort) params.push("sort=" + encodeURIComponent(filters.sort));
  }
  var url = SOURCE.baseUrl + "/anime" + (params.length ? "?" + params.join("&") : "");
  var html = getHtml(url);
  var items = parseCatalogItems(html);
  if (items.length === 0 && q) {
    // Fallback: directorio filtrado localmente
    var dirHtml = getHtml(SOURCE.baseUrl + "/anime");
    var qlc = q.toLowerCase();
    items = parseCatalogItems(dirHtml).filter(function (it) {
      return (it.title || "").toLowerCase().indexOf(qlc) !== -1;
    });
  }
  console.log("[anizone] search url=" + url + " items=" + items.length);
  return { items: items, hasNextPage: false };
}

function parseInfoMeta(html) {
  var out = {
    type: null,
    status: null,
    episodeCount: null,
    year: null
  };
  var lineM = html.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*([\s\S]*?)<\/p>/i);
  var text = lineM ? cleanText(lineM[1]) : "";
  var typeM = text.match(/\b(TV Series|TV|Movie|OVA|ONA|Special)\b/i);
  if (typeM) out.type = typeM[1].replace(/\s+Series$/i, "").toUpperCase();
  var statusM = text.match(/\b(Ongoing|Completed|Finished)\b/i);
  if (statusM) out.status = statusM[1];
  var epsM = text.match(/([0-9]+)\s+Episodes?/i);
  if (epsM) out.episodeCount = epsM[1];
  var yearM = text.match(/\b(19|20)\d{2}\b/);
  if (yearM) out.year = yearM[0];
  return out;
}

function fetchItemDetails(id) {
  var url = SOURCE.baseUrl + "/anime/" + encodeURIComponent(id);
  var html = getHtml(url);
  var titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  var synopsisM = html.match(/<h3[^>]*>\s*Synopsis\s*<\/h3>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
  if (!synopsisM) synopsisM = html.match(/<h3[^>]*class=['"][^'"]*sr-only[^'"]*['"][^>]*>\s*Synopsis\s*<\/h3>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
  var imgM = html.match(/<img[^>]+(?:src|data-src)=['"]([^'"]+)['"][^>]*>/i);
  var genres = [];
  var gRe = /<a[^>]+href=['"]\/tags\/[^'"]+['"][^>]*>([\s\S]*?)<\/a>/gi;
  var gm;
  while ((gm = gRe.exec(html)) !== null) {
    var g = cleanText(gm[1]);
    if (g && genres.indexOf(g) === -1) genres.push(g);
  }
  var meta = parseInfoMeta(html);
  return {
    id: id,
    slug: id,
    title: titleM ? cleanText(titleM[1]) : id,
    synopsis: synopsisM ? cleanText(synopsisM[1]).replace(/^[*]\s*/, "") : "",
    thumbnail: imgM ? absoluteUrl(imgM[1]) : null,
    banner: imgM ? absoluteUrl(imgM[1]) : null,
    type: meta.type || "TV",
    status: meta.status,
    genres: genres,
    year: meta.year,
    episodeCount: meta.episodeCount,
    pageUrl: url,
    recommendations: []
  };
}

function fetchChildren(itemId) {
  var url = SOURCE.baseUrl + "/anime/" + encodeURIComponent(itemId);
  var html = getHtml(url);
  var episodes = [];
  var seen = {};
  var re = /<a[^>]+href=['"](?:https?:\/\/[^\/'"]+)?\/anime\/([a-z0-9]+)\/([0-9]+)(?:\/)?['"][^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var animeId = m[1];
    var epNumber = m[2];
    var block = m[3] || "";
    var key = animeId + "|" + epNumber;
    if (seen[key]) continue;
    seen[key] = true;

    var h3M = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    var h4M = block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
    var title = h3M ? cleanText(h3M[1]) : "";
    if (!title) title = "Episode " + epNumber;
    if (/^episode\s*\d+$/i.test(title) && h4M) {
      var sub = cleanText(h4M[1]);
      if (sub) title += " - " + sub;
    }

    // Evita que entren metadatos de UI en el título (tipo, fecha, score, etc).
    title = title
      .replace(/\b(Regular Episode|Special|Opening\/Ending|Trailer\/Promo\/Ads|Parody\/Fandub|Other)\b.*$/i, "")
      .replace(/\b(19|20)\d{2}-\d{2}-\d{2}\b.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();

    var n = parseInt(epNumber, 10);
    if (isNaN(n)) n = episodes.length + 1;

    episodes.push({
      id: key,
      number: n,
      title: title,
      pageUrl: SOURCE.baseUrl + "/anime/" + animeId + "/" + epNumber
    });
  }
  episodes.sort(function (a, b) { return a.number - b.number; });
  console.log("[anizone] episodios encontrados=" + episodes.length);
  return episodes;
}

function collectUrls(html, re, out, seen, server, quality, headers) {
  var m;
  while ((m = re.exec(html)) !== null) {
    var raw = decodeHtml(m[1] || "").trim();
    if (!raw) continue;
    var url = absoluteUrl(raw);
    if (!url || seen[url]) continue;
    seen[url] = true;
    out.push({
      url: url,
      server: server,
      quality: quality,
      headers: headers || { "Referer": SOURCE.baseUrl + "/" }
    });
  }
}

function parseSubtitleTracks(html) {
  var subtitles = [];
  var seen = {};
  var trackRe = /<track\b[^>]*>/gi;
  var tm;
  while ((tm = trackRe.exec(html || "")) !== null) {
    var tag = tm[0];
    if (!/\bkind=['"]?subtitles['"]?/i.test(tag)) continue;

    var srcM = tag.match(/\bsrc=(['"])(.*?)\1/i);
    if (!srcM) srcM = tag.match(/\bsrc=([^\s>]+)/i); // AniZone usa src sin comillas
    if (!srcM) continue;

    var src = absoluteUrl(decodeHtml(srcM[2] || srcM[1] || ""));
    if (!src || seen[src]) continue;
    seen[src] = true;

    var labelM = tag.match(/\blabel=(['"])(.*?)\1/i);
    if (!labelM) labelM = tag.match(/\blabel=([^\s>]+)/i);
    var langM = tag.match(/\bsrclang=(['"])(.*?)\1/i);
    if (!langM) langM = tag.match(/\bsrclang=([^\s>]+)/i);
    var isDefault = /\bdefault\b/i.test(tag);

    subtitles.push({
      url: src,
      language: (langM ? String(langM[2] || langM[1] || "").toLowerCase() : "und"),
      label: (labelM ? decodeHtml(String(labelM[2] || labelM[1] || "")).replace(/[-_]/g, " ").trim() : "Subtitle"),
      isDefault: isDefault
    });
  }
  return subtitles;
}

function fetchVideoList(episodeId) {
  var parts = String(episodeId || "").split("|");
  var animeId = parts[0] || "";
  var ep = parts[1] || "";
  var url = SOURCE.baseUrl + "/anime/" + encodeURIComponent(animeId) + "/" + encodeURIComponent(ep);
  var html = getHtml(url);
  var out = [];
  var seen = {};
  var subtitles = parseSubtitleTracks(html);

  // Prefer <media-player src="..."> — exact and unambiguous
  var mediaPlayerM = html.match(/<media-player[^>]+\ssrc=['"]([^'"]+\.m3u8[^'"]*)['"]/i);
  if (!mediaPlayerM) mediaPlayerM = html.match(/<media-player[^>]+\ssrc=['"]([^'"]+\.mp4[^'"]*)['"]/i);
  if (mediaPlayerM) {
    var mpUrl = absoluteUrl(decodeHtml(mediaPlayerM[1]));
    if (mpUrl && !seen[mpUrl]) {
      seen[mpUrl] = true;
      var isHls = mpUrl.indexOf(".m3u8") !== -1;
      out.push({
        url: mpUrl,
        server: isHls ? "anizone-hls" : "anizone-mp4",
        quality: isHls ? "HLS" : "MP4",
        headers: { "Referer": url }
      });
    }
  }

  // Fallback: scan all m3u8/mp4 URLs in page
  if (out.length === 0) {
    collectUrls(
      html,
      /(https?:\/\/[^"'\\\s]+\.m3u8(?:\?[^"'\\\s]*)?)/gi,
      out,
      seen,
      "anizone-hls",
      "HLS",
      { "Referer": url }
    );
    collectUrls(
      html,
      /(https?:\/\/[^"'\\\s]+\.mp4(?:\?[^"'\\\s]*)?)/gi,
      out,
      seen,
      "anizone-mp4",
      "MP4",
      { "Referer": url }
    );
  }

  if (subtitles.length > 0) {
    for (var i = 0; i < out.length; i++) {
      out[i].subtitles = subtitles;
    }
  }

  // Only fall back to embeds when no direct streams were found
  if (out.length === 0) {
    var iframeRe = /<iframe[^>]+src=['"]([^'"]+)['"][^>]*>/gi;
    var m;
    while ((m = iframeRe.exec(html)) !== null) {
      var embed = absoluteUrl(m[1]);
      if (!embed || seen[embed]) continue;
      seen[embed] = true;
      out.push({
        embed: embed,
        server: "anizone-embed",
        quality: "Embed",
        headers: { "Referer": url },
        subtitles: subtitles
      });
    }
  }

  console.log("[anizone] videos encontrados=" + out.length + " subtitles=" + subtitles.length);
  return out;
}
