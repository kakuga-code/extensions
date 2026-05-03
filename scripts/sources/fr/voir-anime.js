// voir-anime — Extension Kazemi JS
// =========================================================

const SOURCE = {
  id: "voir-anime",
  name: "Voiranime",
  baseUrl: "https://voir-anime.to",
  language: "fr",
  version: "1.0.0",
  iconUrl: "https://voir-anime.to/wp-content/uploads/2021/04/voiranime-logo.png",
  contentKind: "anime",
  extractorRepositoryUrl: "https://raw.githubusercontent.com/kakuga-code/extensions/refs/heads/main/repo-extractores.json",
  supportsPopular: true,
  supportedTypes: ["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "TV_SHORT"],
  filters: [
    {
      name: "language",
      options: [
        { id: "", label: "Tous" },
        { id: "vostfr", label: "VOSTFR" },
        { id: "vf", label: "VF" }
      ]
    },
    {
      name: "status",
      options: [
        { id: "", label: "Tous" },
        { id: "ongoing", label: "En cours" },
        { id: "completed", label: "Termine" }
      ]
    }
  ]
};

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": SOURCE.baseUrl + "/"
};
const IMAGE_PROXY_PREFIX = "https://proxy-imaga-sora.kurzmathis4.workers.dev/?url=";

const SERVER_ALIASES = {
  voe: "voe",
  streamtape: "streamtape",
  stape: "streamtape",
  doodstream: "doodstream",
  dood: "doodstream",
  streamwish: "streamwish",
  wishembed: "streamwish",
  filemoon: "filemoon",
  moonplayer: "filemoon",
  vidhide: "vidhide",
  streamhide: "vidhide",
  luluvdo: "vidhide",
  yourupload: "yourupload",
  vidmoly: "vidmoly",
  sendvid: "sendvid",
  sibnet: "sibnet",
  okru: "okru",
  "ok.ru": "okru",
  uqload: "uqload",
  mixdrop: "mixdrop",
  mp4upload: "mp4upload"
};

function httpGet(url, headers) {
  try {
    return http.get(url, headers || DEFAULT_HEADERS);
  } catch (e) {
    console.log("[voir-anime] GET error " + url + ": " + e);
    return "";
  }
}

function decodeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 10)); });
}

function stripTags(html) {
  return decodeHtml((html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function toAbsoluteUrl(url) {
  if (!url) return "";
  if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return url;
  if (url.indexOf("//") === 0) return "https:" + url;
  if (url.charAt(0) === "/") return SOURCE.baseUrl + url;
  return SOURCE.baseUrl + "/" + url;
}

function toImageUrl(url) {
  var abs = toAbsoluteUrl(url);
  if (!abs) return "";
  if (abs.indexOf(IMAGE_PROXY_PREFIX) === 0) return abs;
  return IMAGE_PROXY_PREFIX + encodeURIComponent(abs);
}

/**
 * URL de portada fiable : priorise <img> dans les blocs thumb (Madara),
 * puis data-src / srcset (meilleure largeur) / src.
 * Évite de prendre iframe src= (YouTube) ou autres src hors poster.
 */
function extractPosterUrlFromHtmlBlock(block) {
  if (!block) return "";

  var lower = block.toLowerCase();
  var idx = lower.indexOf("item-thumb");
  if (idx < 0) idx = lower.indexOf("tab-thumb");
  var scope = idx >= 0 ? block.slice(idx, idx + 8000) : block;

  var imgM = scope.match(/<img[^>]+>/i);
  if (!imgM) imgM = block.match(/<img[^>]+>/i);
  if (!imgM) return "";
  var imgTag = imgM[0];

  var ds = imgTag.match(/\sdata-src="([^"]+)"/i);
  if (ds && ds[1] && ds[1].indexOf("data:") !== 0) return toAbsoluteUrl(decodeHtml(ds[1]));

  var ss = imgTag.match(/\ssrcset="([^"]+)"/i);
  if (ss && ss[1]) {
    var parts = ss[1].split(",");
    var bestUrl = "";
    var bestW = 0;
    for (var i = 0; i < parts.length; i++) {
      var seg = parts[i].trim().split(/\s+/);
      if (!seg[0]) continue;
      var u = decodeHtml(seg[0]);
      var w = 0;
      if (seg[1]) {
        var wm = seg[1].match(/^(\d+)w$/i);
        if (wm) w = parseInt(wm[1], 10);
      }
      if (w >= bestW) {
        bestW = w;
        bestUrl = u;
      }
    }
    if (bestUrl && bestUrl.indexOf("data:") !== 0) return toAbsoluteUrl(bestUrl);
  }

  var sr = imgTag.match(/\ssrc="([^"]+)"/i);
  if (sr && sr[1] && sr[1].indexOf("data:") !== 0) return toAbsoluteUrl(decodeHtml(sr[1]));

  return "";
}

function extractAnimeSlug(url) {
  var abs = toAbsoluteUrl(url);
  var m = abs.match(/\/anime\/([^/?#]+)\/?$/i);
  return m ? m[1] : null;
}

/** true si l'URL est la fiche série (/anime/slug/), pas un lien chapitre */
function isSeriesAnimePageUrl(url) {
  var u = toAbsoluteUrl(url).replace(/\/+$/, "");
  return /\/anime\/[^/]+$/.test(u);
}

function parseTypeLabel(raw) {
  var t = (raw || "").toUpperCase();
  if (t.indexOf("MOVIE") !== -1 || t.indexOf("FILM") !== -1) return "Movie";
  if (t.indexOf("OVA") !== -1) return "OVA";
  if (t.indexOf("ONA") !== -1) return "ONA";
  if (t.indexOf("SPECIAL") !== -1) return "Special";
  if (t.indexOf("TV_SHORT") !== -1 || t.indexOf("SHORT") !== -1) return "TV Short";
  return "TV";
}

function parseCatalogCards(html) {
  if (!html) return [];
  var items = [];
  var seen = {};
  var cardRe = /<div[^>]+class="[^"]*(?:c-tabs-item__content|page-item-detail|c-tabs-item__content-wrapper)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  var m;
  while ((m = cardRe.exec(html)) !== null) {
    var block = m[1];
    var hrefM = block.match(/<a[^>]+href="([^"]*\/anime\/[^"]+)"[^>]*>/i);
    if (!hrefM) continue;
    var href = toAbsoluteUrl(hrefM[1]);
    var slug = extractAnimeSlug(href);
    if (!slug || seen[slug]) continue;

    var titleM = block.match(/<h3[^>]*class="[^"]*h4[^"]*"[^>]*>([\s\S]*?)<\/h3>/i) ||
                 block.match(/title="([^"]+)"/i) ||
                 block.match(/alt="([^"]+)"/i);
    var title = titleM ? stripTags(titleM[1]) : slug;
    if (!title) title = slug;

    var thumb = toImageUrl(extractPosterUrlFromHtmlBlock(block));

    var typeM = block.match(/<h5[^>]*>\s*Type\s*<\/h5>[\s\S]*?<div[^>]*class="[^"]*summary-content[^"]*"[^>]*>\s*([^<]+)\s*<\/div>/i);
    var mediaType = parseTypeLabel(typeM ? stripTags(typeM[1]) : "");

    seen[slug] = true;
    items.push({
      id: slug,
      slug: slug,
      title: title,
      thumbnail: thumb,
      type: mediaType,
      pageUrl: href
    });
  }

  if (items.length > 0) return items;

  // Fallback: parse all top-level anime links when card classes change.
  var linkRe = /<a[^>]+href="([^"]*\/anime\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = linkRe.exec(html)) !== null) {
    var animeUrl = toAbsoluteUrl(m[1]);
    if (animeUrl.indexOf("/anime/") === -1) continue;
    if (!isSeriesAnimePageUrl(animeUrl)) continue;
    var slug2 = extractAnimeSlug(animeUrl);
    if (!slug2 || seen[slug2]) continue;
    var inner = m[2];
    var tM = inner.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) ||
             inner.match(/title="([^"]+)"/i) ||
             inner.match(/alt="([^"]+)"/i);
    var fallbackTitle = tM ? stripTags(tM[1]) : slug2;
    if (!fallbackTitle) continue;
    var thumbFb = toImageUrl(extractPosterUrlFromHtmlBlock(inner));
    items.push({
      id: slug2,
      slug: slug2,
      title: fallbackTitle,
      thumbnail: thumbFb,
      type: "TV",
      pageUrl: animeUrl
    });
    seen[slug2] = true;
  }
  return items;
}

function hasNextPage(html, page) {
  if (!html) return false;
  var n = page + 1;
  var nextA = new RegExp("/page/" + n + "(?:/|[^0-9]|$)", "i");
  return nextA.test(html) || /class="nextpostslink"/i.test(html) || /rel="next"/i.test(html);
}

function applyLocalFilters(items, filters) {
  if (!filters) return items;
  var language = (filters.language || "").toLowerCase();
  var status = (filters.status || "").toLowerCase();
  return items.filter(function (item) {
    var title = (item.title || "").toLowerCase();
    if (language === "vf" && title.indexOf("(vf)") === -1 && title.indexOf(" vf") === -1) return false;
    if (language === "vostfr" && title.indexOf("(vf)") !== -1) return false;
    if (status === "ongoing" && title.indexOf("saison terminee") !== -1) return false;
    return true;
  });
}

// -- Catalog -------------------------------------------------

function fetchPopular(page) {
  var pageNum = page || 1;
  var url = SOURCE.baseUrl + "/nouveaux-ajouts/";
  if (pageNum > 1) url += "page/" + pageNum + "/";
  var html = httpGet(url);
  return {
    items: parseCatalogCards(html),
    hasNextPage: hasNextPage(html, pageNum)
  };
}

function fetchLatest(page) {
  return fetchSearch("", page || 1, {});
}

function fetchSearch(query, page, filters) {
  var pageNum = page || 1;
  var url;
  if (query && query.trim().length > 0) {
    url = SOURCE.baseUrl + "/?s=" + encodeURIComponent(query.trim()) + "&post_type=wp-manga";
  } else {
    url = SOURCE.baseUrl + "/liste/page/" + pageNum + "/";
  }
  var html = httpGet(url);
  var items = applyLocalFilters(parseCatalogCards(html), filters);
  return { items: items, hasNextPage: (!query || !query.trim()) && hasNextPage(html, pageNum) };
}

// -- Details -------------------------------------------------

function fetchItemDetails(slug) {
  var url = slug.indexOf("http") === 0 ? slug : (SOURCE.baseUrl + "/anime/" + slug + "/");
  var html = httpGet(url);
  if (!html) return { title: slug, pageUrl: url };

  var titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
               html.match(/<title>([^<]+)<\/title>/i);
  var title = titleM ? stripTags(titleM[1]).replace(/\s*-\s*Voiranime.*$/i, "") : slug;

  var synopsisM = html.match(/<div[^>]+class="[^"]*summary__content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                  html.match(/<div[^>]+class="[^"]*description-summary[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  var synopsis = synopsisM ? stripTags(synopsisM[1]) : "";

  var coverM =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (!coverM) {
    var sumImg = html.match(/<div[^>]+class="[^"]*summary_image[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (sumImg) coverM = [null, extractPosterUrlFromHtmlBlock(sumImg[0])];
  }
  if (!coverM || !coverM[1]) {
    var wp = html.match(/<img[^>]+class="[^"]*wp-post-image[^"]*"[^>]+src=["']([^"']+)["']/i);
    if (wp) coverM = wp;
  }
  var cover = coverM && coverM[1] ? toImageUrl(coverM[1]) : "";

  var genres = [];
  var genreBlockM = html.match(/Genres?[\s\S]{0,200}<div[^>]*class="[^"]*summary-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (genreBlockM) {
    var genreRe = /<a[^>]*>([^<]+)<\/a>/gi;
    var gm;
    while ((gm = genreRe.exec(genreBlockM[1])) !== null) {
      var g = stripTags(gm[1]);
      if (g) genres.push(g);
    }
  }

  var typeM = html.match(/Type[\s\S]{0,200}<div[^>]*class="[^"]*summary-content[^"]*"[^>]*>\s*([^<]+)\s*<\/div>/i);
  var statusM = html.match(/Status[\s\S]{0,200}<div[^>]*class="[^"]*summary-content[^"]*"[^>]*>\s*([^<]+)\s*<\/div>/i);

  return {
    title: title,
    synopsis: synopsis,
    cover: cover,
    genres: genres,
    type: parseTypeLabel(typeM ? stripTags(typeM[1]) : ""),
    status: statusM ? stripTags(statusM[1]) : null,
    related: [],
    pageUrl: url
  };
}

// -- Episodes ------------------------------------------------

function extractEpisodeNumber(title, url, fallback) {
  var t = (title || "");
  var m = t.match(/(?:episode|ep|oav|special|film)\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (m) return parseFloat(m[1]);
  var u = (url || "");
  var n = u.match(/-([0-9]+(?:\.[0-9]+)?)(?:-[a-z]+)?\/?$/i);
  if (n) return parseFloat(n[1]);
  return fallback;
}

function fetchChildren(itemId) {
  var url = itemId.indexOf("http") === 0 ? itemId : (SOURCE.baseUrl + "/anime/" + itemId + "/");
  var html = httpGet(url);
  if (!html) return [];

  var episodes = [];
  var seen = {};
  var epRe = /<li[^>]+class="[^"]*wp-manga-chapter[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  var fallback = 1;
  while ((m = epRe.exec(html)) !== null) {
    var epUrl = toAbsoluteUrl(m[1]);
    var epTitle = stripTags(m[2]);
    if (!epUrl || seen[epUrl]) continue;
    seen[epUrl] = true;
    episodes.push({
      id: epUrl,
      number: extractEpisodeNumber(epTitle, epUrl, fallback),
      title: epTitle || ("Episode " + fallback),
      pageUrl: epUrl
    });
    fallback++;
  }

  episodes.sort(function (a, b) { return a.number - b.number; });
  for (var i = 0; i < episodes.length; i++) {
    if (!episodes[i].number || episodes[i].number <= 0) episodes[i].number = i + 1;
  }
  return episodes;
}

// -- Video list ---------------------------------------------

function canonicalServerFromUrl(url) {
  if (!url) return "embed";
  var hostM = url.match(/^https?:\/\/([^/]+)/i);
  var host = hostM ? hostM[1].toLowerCase() : "";
  if (host.indexOf("ok.ru") !== -1) return "okru";
  var parts = host.split(".");
  var first = parts.length > 0 ? parts[0] : host;
  first = first.replace(/[^a-z0-9]/g, "");
  return SERVER_ALIASES[first] || SERVER_ALIASES[host] || first || "embed";
}

function collectEmbedUrls(html, pageUrl) {
  var embedUrls = [];
  var seen = {};
  var m;

  var iframeRe = /<iframe[^>]+src="([^"]+)"/gi;
  while ((m = iframeRe.exec(html)) !== null) {
    var iframe = toAbsoluteUrl(decodeHtml(m[1]));
    if (iframe && !seen[iframe]) {
      seen[iframe] = true;
      embedUrls.push(iframe);
    }
  }

  var redirectRe = /data-redirect="([^"]+)"/gi;
  while ((m = redirectRe.exec(html)) !== null) {
    var redirectPage = toAbsoluteUrl(decodeHtml(m[1]));
    if (!redirectPage) continue;
    var redirectHtml = httpGet(redirectPage, {
      "User-Agent": DEFAULT_HEADERS["User-Agent"],
      "Referer": pageUrl || SOURCE.baseUrl + "/"
    });
    var frameM = redirectHtml.match(/<iframe[^>]+src="([^"]+)"/i);
    if (!frameM) continue;
    var nested = toAbsoluteUrl(decodeHtml(frameM[1]));
    if (nested && !seen[nested]) {
      seen[nested] = true;
      embedUrls.push(nested);
    }
  }
  return embedUrls;
}

function fetchVideoList(episodeId) {
  var pageUrl = episodeId.indexOf("http") === 0 ? episodeId : toAbsoluteUrl(episodeId);
  var html = httpGet(pageUrl);
  if (!html) return [];

  var embeds = collectEmbedUrls(html, pageUrl);
  var results = [];
  for (var i = 0; i < embeds.length; i++) {
    var embed = embeds[i];
    var server = canonicalServerFromUrl(embed);
    results.push({
      server: server,
      quality: server.toUpperCase(),
      embed: embed
    });
  }
  return results;
}
