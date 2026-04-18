// xiaoheimi — Extensión Kazemi JS
// =========================================================

const SOURCE = {
  id: "xiaoheimi",
  name: "小宝影院",
  baseUrl: "https://xiaoheimi.cc",
  language: "zh",
  version: "1.0.0",
  iconUrl: "https://xiaoheimi.cc/favicon.ico",
  contentKind: "anime",
  extractorRepositoryUrl: "https://raw.githubusercontent.com/kakuga-code/extensions/refs/heads/main/repo-extractores.json",
  supportedTypes: ["tv", "movie"],
  supportsPopular: false
};

// Categorías disponibles
const CATEGORIES = [
  { name: "动漫", id: "5" },
  { name: "电视剧", id: "6" },
  { name: "电影", id: "7" },
  { name: "综艺", id: "3" },
  { name: "纪录片", id: "21" },
  { name: "短剧", id: "64" }
];

const GENRE_FILTERS = CATEGORIES.map(function (c) {
  return { name: c.name, value: c.id };
});

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": SOURCE.baseUrl + "/"
};

// ── Helpers ──────────────────────────────────────────────

function httpGet(url) {
  try {
    return http.get(url, DEFAULT_HEADERS);
  } catch (e) {
    console.log("[xiaoheimi] GET error " + url + ": " + e);
    return null;
  }
}

function extractIdFromUrl(url) {
  const m = url.match(/\/id\/(\d+)/);
  return m ? m[1] : null;
}

function parseCards(html) {
  if (!html) return [];
  const items = [];
  // Match each vod card block
  const cardRe = /<a[^>]+class="[^"]*myui-vodlist__thumb[^"]*"[^>]+href="([^"]+)"[^>]+title="([^"]+)"[^>]+data-original="([^"]+)"[^>]*>/gi;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const href = m[1];
    const title = m[2];
    const thumb = m[3];
    const id = extractIdFromUrl(href);
    if (!id) continue;
    items.push({
      id: id,
      title: title,
      thumbnail: thumb.indexOf("http") === 0 ? thumb : SOURCE.baseUrl + thumb,
      type: "TV",
      pageUrl: SOURCE.baseUrl + href
    });
  }
  return items;
}

function hasNextPage(html) {
  if (!html) return false;
  return html.indexOf('class="next"') !== -1 || html.indexOf('>下一页<') !== -1;
}

// ── Catalog ───────────────────────────────────────────────

function fetchPopular(page) {
  // Default: Anime category sorted by popularity (default sort for type listing)
  const url = SOURCE.baseUrl + "/index.php/vod/type/id/5/page/" + page + ".html";
  const html = httpGet(url);
  return {
    items: parseCards(html),
    hasNextPage: hasNextPage(html)
  };
}

function fetchLatest(page) {
  // Latest updates across all content
  const url = SOURCE.baseUrl + "/index.php/vod/type/id/5/page/" + page + ".html";
  const html = httpGet(url);
  return {
    items: parseCards(html),
    hasNextPage: hasNextPage(html)
  };
}

function fetchSearch(query, page, filters) {
  // Empty query: browse by category
  if (!query || query.trim().length === 0) {
    const catId = (filters && filters.genre) ? filters.genre : "5";
    const url = SOURCE.baseUrl + "/index.php/vod/type/id/" + catId + "/page/" + page + ".html";
    const html = httpGet(url);
    return {
      items: parseCards(html),
      hasNextPage: hasNextPage(html)
    };
  }

  // Search
  const q = encodeURIComponent(query.trim());
  const url = SOURCE.baseUrl + "/index.php/vod/search/wd/" + q + "/page/" + page + ".html";
  const html = httpGet(url);
  return {
    items: parseCards(html),
    hasNextPage: hasNextPage(html)
  };
}

// ── Detail ────────────────────────────────────────────────

function fetchItemDetails(id) {
  const url = SOURCE.baseUrl + "/index.php/vod/detail/id/" + id + ".html";
  const html = httpGet(url);
  if (!html) return { title: id };

  // Title
  const titleM = html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/i)
    || html.match(/<title>([^<]+?)\s*[-–]/i);
  const title = titleM ? titleM[1].trim() : id;

  // Synopsis
  const synM = html.match(/class="[^"]*myui-content__detail[^"]*"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  const synopsis = synM ? synM[1].replace(/<[^>]+>/g, "").trim() : "";

  // Cover image — the <img data-original> is a child of myui-content__thumb
  const coverM = html.match(/myui-content__thumb[\s\S]*?data-original="([^"]+)"/)
    || html.match(/property="og:image"\s+content="([^"]+)"/i);
  const cover = coverM ? (coverM[1].indexOf("http") === 0 ? coverM[1] : SOURCE.baseUrl + coverM[1]) : null;

  // Genres from breadcrumb or tags
  const genres = [];
  const genreRe = /\/index\.php\/vod\/type\/id\/\d+[^"]*"[^>]*>([^<]+)</gi;
  let gm;
  while ((gm = genreRe.exec(html)) !== null) {
    const g = gm[1].trim();
    if (g && g.length < 20) genres.push(g);
  }

  return {
    title: title,
    synopsis: synopsis,
    cover: cover,
    genres: genres,
    type: "TV",
    status: null,
    related: [],
    pageUrl: SOURCE.baseUrl + "/index.php/vod/detail/id/" + id + ".html"
  };
}

// ── Episode List ──────────────────────────────────────────

function fetchChildren(id) {
  const url = SOURCE.baseUrl + "/index.php/vod/detail/id/" + id + ".html";
  const html = httpGet(url);
  if (!html) return [];

  const episodes = [];
  const seen = {};

  // Use only playlist1 to list episodes — fetchVideoList handles all sids per episode
  const playlist1M = html.match(/id="playlist1"[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i);
  const ulContent = playlist1M ? playlist1M[1] : html;

  const epRe = /<a[^>]+href="([^"]+\/sid\/\d+\/nid\/(\d+)[^"]*)"[^>]*>([^<]*)<\/a>/gi;
  let epMatch;
  while ((epMatch = epRe.exec(ulContent)) !== null) {
    const nid = parseInt(epMatch[2], 10);
    if (seen[nid]) continue;
    seen[nid] = true;
    const epTitle = epMatch[3].trim() || ("第" + nid + "集");
    episodes.push({
      id: id + "|" + nid,
      number: nid,
      title: epTitle,
      pageUrl: SOURCE.baseUrl + epMatch[1]
    });
  }

  episodes.sort(function (a, b) { return a.number - b.number; });
  return episodes;
}

// ── Video List ────────────────────────────────────────────

function extractPlayerVar(html) {
  if (!html) return null;
  // Extract url and from fields directly — avoids JSON.parse on potentially truncated/encoded JSON
  const urlM = html.match(/player_aaaa\s*=\s*\{[^<]*?"url"\s*:\s*"([^"]+)"/);
  if (!urlM) return null;
  const fromM = html.match(/player_aaaa\s*=\s*\{[^<]*?"from"\s*:\s*"([^"]+)"/);
  return {
    url: urlM[1].replace(/\\\//g, "/"),
    from: fromM ? fromM[1] : ""
  };
}

// CDNs known to block requests without Referer (AVPlayer can't play them directly)
const BLOCKED_CDNS = ["dytt-tvs.com", "tvs-dytt.com"];

function cdnIsBlocked(url) {
  for (var i = 0; i < BLOCKED_CDNS.length; i++) {
    if (url.indexOf(BLOCKED_CDNS[i]) !== -1) return true;
  }
  return false;
}

function serverNameFromFlag(flag) {
  if (!flag) return "Unknown";
  const f = flag.toLowerCase();
  if (f.indexOf("m3u8") !== -1) return "M3U8";
  if (f.indexOf("mp4") !== -1) return "MP4";
  return flag;
}

function fetchVideoList(episodeIdStr) {
  // episodeIdStr format: "{showId}|{nid}"
  const parts = episodeIdStr.split("|");
  const showId = parts[0];
  const nid = parts[1] || "1";

  // Discover available sids from detail page
  const detailHtml = httpGet(SOURCE.baseUrl + "/index.php/vod/detail/id/" + showId + ".html");
  const sids = [];
  if (detailHtml) {
    const sidRe = /id="playlist(\d+)"/gi;
    let sm;
    while ((sm = sidRe.exec(detailHtml)) !== null) {
      sids.push(sm[1]);
    }
  }
  if (sids.length === 0) sids.push("1");

  const results = [];

  sids.forEach(function (sid) {
    const playUrl = SOURCE.baseUrl + "/index.php/vod/play/id/" + showId + "/sid/" + sid + "/nid/" + nid + ".html";
    console.log("[xiaoheimi] Fetching play page: " + playUrl);

    const html = httpGet(playUrl);
    const player = extractPlayerVar(html);
    if (!player || !player.url) {
      console.log("[xiaoheimi] No URL for sid=" + sid);
      return;
    }

    const videoUrl = player.url;

    if (cdnIsBlocked(videoUrl)) {
      console.log("[xiaoheimi] Skipping blocked CDN: " + videoUrl);
      return;
    }

    const serverName = serverNameFromFlag(player.from || "");
    const label = serverName + (sids.length > 1 ? " — 源" + sid : "");
    const isDirectStream = videoUrl.indexOf(".m3u8") !== -1 || videoUrl.indexOf(".mp4") !== -1;

    const entry = { server: serverName, quality: label };
    if (isDirectStream) {
      entry.url = videoUrl;
    } else {
      entry.embed = videoUrl;
    }
    results.push(entry);
  });

  return results;
}
