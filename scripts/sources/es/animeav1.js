// AnimeAV1 — Extensión Kazemi JS
// https://animeav1.com — basado en animeflv.js + módulo Sora (Luna)
// =========================================================

const SOURCE = {
  id: "animeav1",
  name: "AnimeAV1",
  baseUrl: "https://animeav1.com",
  language: "es",
  version: "1.0.3",
  iconUrl: "https://animeav1.com/favicon.png",
  contentKind: "anime",
  extractorRepositoryUrl: "https://raw.githubusercontent.com/kakuga-code/extensions/refs/heads/main/repo-extractores.json",
  supportsPopular: true,
  supportedTypes: ["tv", "movie", "ova", "special"],
  filters: []
};

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  Referer: "https://animeav1.com/"
};

// ── Helpers ──────────────────────────────────────────────

function decodeHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, function (_, dec) {
      return String.fromCharCode(parseInt(dec, 10));
    })
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ");
}

function httpGet(url) {
  return http.get(url, DEFAULT_HEADERS);
}

function absUrl(path) {
  if (!path) return "";
  if (path.indexOf("http://") === 0 || path.indexOf("https://") === 0) return path;
  if (path.indexOf("//") === 0) return "https:" + path;
  var base = SOURCE.baseUrl.replace(/\/+$/, "");
  return path.charAt(0) === "/" ? base + path : base + "/" + path;
}

function hasNextCatalogPage(html, page) {
  if (!html) return false;
  var next = page + 1;
  return (
    html.indexOf("page=" + next) !== -1 ||
    html.indexOf("page=" + encodeURIComponent(String(next))) !== -1
  );
}

/**
 * Tarjetas del catálogo (mismo patrón que el módulo Sora).
 */
function parseCatalogItems(html) {
  var items = [];
  if (!html) return items;

  var re =
    /<article[^>]*class="[^"]*group\/item[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*alt="[^"]*"[^>]*>[\s\S]*?<h3[^>]*class="[^"]*text-lead[^"]*">([^<]+)<\/h3>[\s\S]*?<a[^>]+href="([^"]+)"/g;

  var m;
  while ((m = re.exec(html)) !== null) {
    var href = m[3].trim();
    if (href.indexOf("/media/") !== 0) continue;
    var slug = href.replace(/^\/media\//, "").replace(/\/+$/, "");
    if (!slug) continue;

    var title = decodeHtml(m[2].trim());
    var thumb = absUrl(m[1].trim());

    items.push({
      id: slug,
      slug: slug,
      title: title,
      thumbnail: thumb,
      type: null,
      genres: [],
      status: null,
      pageUrl: absUrl(href)
    });
  }
  return items;
}

function parseEmbeddedMedia(html) {
  if (!html) return null;
  var out = {
    title: "",
    synopsis: "",
    genres: [],
    type: null,
    status: null,
    cover: null,
    slug: ""
  };

  var blockM = html.match(/data:\{media:\{([\s\S]*?)\},uses:/);
  if (!blockM) return null;

  var block = blockM[1];
  var titleM = block.match(/title:"((?:\\.|[^"\\])*)"/);
  if (titleM) out.title = titleM[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');

  var slugM = block.match(/slug:"([^"]+)"/);
  if (slugM) out.slug = slugM[1];

  var synM = block.match(/synopsis:"((?:\\.|[^"\\])*)"/);
  if (synM) out.synopsis = synM[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');

  var genreRe = /name:"((?:\\.|[^"\\])*)"/g;
  var gm;
  while ((gm = genreRe.exec(block)) !== null) {
    var name = gm[1].replace(/\\"/g, '"');
    if (out.genres.indexOf(name) === -1) out.genres.push(name);
  }

  var coverM = html.match(/https:\/\/cdn\.animeav1\.com\/covers\/\d+\.jpg/);
  if (coverM) out.cover = coverM[0];

  if (html.indexOf("TV Anime") !== -1) out.type = "Serie";
  else if (html.indexOf("Película") !== -1 || html.indexOf("Movie") !== -1) out.type = "Película";
  else if (html.indexOf("OVA") !== -1) out.type = "OVA";
  else if (html.indexOf("Especial") !== -1) out.type = "Especial";

  if (html.indexOf("En emisión") !== -1) out.status = "En emisión";
  else if (html.indexOf("Finalizado") !== -1) out.status = "Finalizado";

  return out;
}

function parseEpisodesFromEmbedded(html, slug) {
  if (!html || !slug) return [];
  var m = html.match(/episodes:\[([\s\S]*?)\],/);
  if (!m) return [];

  var out = [];
  var pairRe = /\{id:(\d+),number:(\d+)\}/g;
  var pm;
  while ((pm = pairRe.exec(m[1])) !== null) {
    var epNum = parseInt(pm[2], 10);
    if (!isFinite(epNum)) continue;
    out.push({
      id: slug + "|" + epNum,
      number: epNum,
      title: "Episodio " + epNum,
      pageUrl: absUrl("/media/" + slug + "/" + epNum)
    });
  }
  return out;
}

function parseEpisodesFromHtml(html, slug) {
  if (!html || !slug) return [];
  var out = [];
  var seen = Object.create(null);
  var re = new RegExp(
    '<a[^>]+href="(/media/' + slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '/(\\d+))"[^>]*>\\s*<span class="sr-only">',
    "g"
  );
  var m;
  while ((m = re.exec(html)) !== null) {
    var epNum = parseInt(m[2], 10);
    if (!isFinite(epNum) || seen[epNum]) continue;
    seen[epNum] = true;
    out.push({
      id: slug + "|" + epNum,
      number: epNum,
      title: "Episodio " + epNum,
      pageUrl: absUrl(m[1])
    });
  }
  out.sort(function (a, b) {
    return a.number - b.number;
  });
  return out;
}

function extractZillaStreamUrl(html) {
  if (!html) return null;
  var m = html.match(/url:"(https:\/\/player\.zilla-networks\.com\/play\/[^"]+)"/i);
  if (!m) {
    m = html.match(/https:\/\/player\.zilla-networks\.com\/play\/[a-zA-Z0-9]+/i);
    if (!m) return null;
    return String(m[0]).replace("/play/", "/m3u8/");
  }
  return m[1].replace("/play/", "/m3u8/");
}

var SERVER_NAME_MAP = {
  hls: "zilla",
  mp4upload: "mp4upload",
  mp4: "mp4upload",
  mega: "mega",
  megaup: "megaup",
  upnshare: "upnshare",
  nshare: "nshare"
};

var SERVER_PRIORITY = {
  zilla: 1,
  mp4upload: 2,
  megaup: 3
};

var HIDDEN_SERVERS = {
  mega: true,
  upnshare: true,
  nshare: true
};

function canonicalServerName(label) {
  var key = String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return SERVER_NAME_MAP[key] || key;
}

function isHiddenServer(serverLabel, url) {
  var server = canonicalServerName(serverLabel);
  if (HIDDEN_SERVERS[server]) return true;
  var low = String(url || "").toLowerCase();
  return low.indexOf("mega.nz") !== -1 || low.indexOf("uns.bio") !== -1;
}

function streamHeadersForOrigin(origin) {
  return {
    Referer: origin + "/",
    Origin: origin.replace(/\/+$/, ""),
    "User-Agent": DEFAULT_HEADERS["User-Agent"]
  };
}

function playbackEntryFromSource(langTag, serverLabel, url) {
  var server = canonicalServerName(serverLabel);
  var quality = langTag + " — " + serverLabel;
  var low = String(url || "").toLowerCase();
  var siteHeaders = streamHeadersForOrigin(SOURCE.baseUrl);

  if (server === "zilla" || low.indexOf("zilla-networks.com") !== -1) {
    return {
      server: "zilla",
      quality: quality + " (HLS)",
      url: String(url).replace("/play/", "/m3u8/"),
      headers: streamHeadersForOrigin("https://player.zilla-networks.com")
    };
  }

  if (server === "mp4upload" || low.indexOf("mp4upload.com") !== -1) {
    return {
      server: "mp4upload",
      quality: quality,
      embed: url,
      headers: streamHeadersForOrigin("https://www.mp4upload.com")
    };
  }

  if (server === "megaup" || low.indexOf("megaup.") !== -1) {
    return {
      server: "megaup",
      quality: quality,
      embed: url,
      headers: siteHeaders
    };
  }

  return {
    server: server,
    quality: quality,
    embed: url,
    browserSession: true,
    headers: siteHeaders
  };
}

function parseEpisodeStreamSources(html) {
  var results = [];
  if (!html) return results;

  var blockM = html.match(/DUB:\[([\s\S]*?)\],SUB:\[([\s\S]*?)\]\},downloads:/);
  if (!blockM) {
    var fallback = extractZillaStreamUrl(html);
    if (fallback) {
      results.push({
        server: "zilla",
        quality: "SUB — HLS (HLS)",
        url: fallback,
        headers: streamHeadersForOrigin(SOURCE.baseUrl)
      });
    }
    return results;
  }

  var seen = Object.create(null);
  var entryRe = /\{server:"([^"]+)",url:"((?:\\.|[^"\\])*)"\}/g;

  function addBlock(block, langTag) {
    var match;
    while ((match = entryRe.exec(block)) !== null) {
      var url = match[2].replace(/\\"/g, '"').replace(/\\\//g, "/");
      if (!url || seen[url] || isHiddenServer(match[1], url)) continue;
      seen[url] = true;
      var row = playbackEntryFromSource(langTag, match[1], url);
      if (row) results.push(row);
    }
  }

  addBlock(blockM[1], "DUB");
  entryRe.lastIndex = 0;
  addBlock(blockM[2], "SUB");

  results.sort(function (a, b) {
    var pa = SERVER_PRIORITY[a.server] || 50;
    var pb = SERVER_PRIORITY[b.server] || 50;
    if (pa !== pb) return pa - pb;
    return String(a.quality).localeCompare(String(b.quality));
  });

  return results;
}

// ── Catalog ──────────────────────────────────────────────

function fetchPopular(page) {
  var url = SOURCE.baseUrl + "/catalogo?page=" + page;
  console.log("[animeav1] fetchPopular url=" + url);
  var html = httpGet(url);
  return {
    items: parseCatalogItems(html),
    hasNextPage: hasNextCatalogPage(html, page)
  };
}

function fetchLatest(page) {
  if (page > 1) {
    return fetchPopular(page);
  }
  var html = httpGet(SOURCE.baseUrl + "/");
  var items = parseCatalogItems(html);
  return {
    items: items,
    hasNextPage: items.length > 0
  };
}

function fetchSearch(query, page, filters) {
  var params = "page=" + page;
  if (query && String(query).trim().length > 0) {
    params += "&search=" + encodeURIComponent(String(query).trim());
  }
  var url = SOURCE.baseUrl + "/catalogo?" + params;
  console.log("[animeav1] fetchSearch url=" + url);
  var html = httpGet(url);
  return {
    items: parseCatalogItems(html),
    hasNextPage: hasNextCatalogPage(html, page)
  };
}

// ── Detail ───────────────────────────────────────────────

function fetchItemDetails(slug) {
  var mediaSlug = String(slug || "").replace(/^\/media\//, "").replace(/\/+$/, "");
  var url = absUrl("/media/" + mediaSlug);
  console.log("[animeav1] fetchItemDetails url=" + url);
  var html = httpGet(url);

  var embedded = parseEmbeddedMedia(html);
  var titleM = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  var entryM = html.match(/class="entry[^"]*"[^>]*>\s*<p>([\s\S]*?)<\/p>/i);

  var title = embedded && embedded.title ? embedded.title : mediaSlug;
  if (titleM) title = decodeHtml(titleM[1].replace(/<[^>]+>/g, "").trim());

  var synopsis = embedded && embedded.synopsis ? embedded.synopsis : "";
  if (!synopsis && entryM) {
    synopsis = decodeHtml(entryM[1].replace(/<[^>]+>/g, "").trim());
  }

  var cover = embedded && embedded.cover ? embedded.cover : null;
  if (!cover) {
    var imgM = html.match(/https:\/\/cdn\.animeav1\.com\/covers\/\d+\.jpg/);
    if (imgM) cover = imgM[0];
  }

  return {
    title: title,
    synopsis: synopsis,
    cover: cover,
    genres: (embedded && embedded.genres) || [],
    type: (embedded && embedded.type) || "Anime",
    status: (embedded && embedded.status) || null,
    related: [],
    pageUrl: url
  };
}

// ── Episodes ─────────────────────────────────────────────

function fetchChildren(slug) {
  var mediaSlug = String(slug || "").replace(/^\/media\//, "").replace(/\/+$/, "");
  var url = absUrl("/media/" + mediaSlug);
  console.log("[animeav1] fetchChildren url=" + url);
  var html = httpGet(url);

  var episodes = parseEpisodesFromEmbedded(html, mediaSlug);
  if (!episodes.length) episodes = parseEpisodesFromHtml(html, mediaSlug);

  console.log("[animeav1] fetchChildren slug=" + mediaSlug + " episodes=" + episodes.length);
  return episodes;
}

// ── Video list ───────────────────────────────────────────

function fetchVideoList(episodeIdStr) {
  var parts = String(episodeIdStr || "").split("|");
  var slug = (parts[0] || "").trim();
  var epNum = parseInt(parts[1], 10);
  if (!slug || !isFinite(epNum) || epNum < 1) return [];

  var pageUrl = absUrl("/media/" + slug + "/" + epNum);
  console.log("[animeav1] fetchVideoList url=" + pageUrl);
  var html = httpGet(pageUrl);
  if (!html) return [];

  var options = parseEpisodeStreamSources(html);
  console.log(
    "[animeav1] fetchVideoList ep=" +
      epNum +
      " mirrors=" +
      options.length +
      " servers=" +
      options.map(function (o) {
        return o.server;
      }).join(",")
  );
  return options;
}
