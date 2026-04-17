// AnimeKai — Extensión Kazemi JS
// Fuente: https://anikai.to
// =========================================================

const SOURCE = {
  id: "animekai",
  name: "AnimeKai",
  baseUrl: "https://anikai.to",
  language: "en",
  version: "1.0.2",
  iconUrl: "https://anikai.to/favicon.ico",
  contentKind: "anime",
  extractorRepositoryUrl: "https://raw.githubusercontent.com/kakuga-code/extensions/refs/heads/main/repo-extractores.json",
  supportsPopular: true,
  supportedTypes: ["tv", "movie", "ova", "special", "ona", "music"],
  nativeSortCriteria: ["trending", "updated_date", "added_date", "release_date", "title_az", "avg_score", "most_viewed"],
  filters: [
    {
      name: "genre",
      options: [
        { id: "47",  label: "Action" },
        { id: "1",   label: "Adventure" },
        { id: "235", label: "Avant Garde" },
        { id: "184", label: "Boys Love" },
        { id: "7",   label: "Comedy" },
        { id: "127", label: "Demons" },
        { id: "66",  label: "Drama" },
        { id: "8",   label: "Ecchi" },
        { id: "34",  label: "Fantasy" },
        { id: "926", label: "Girls Love" },
        { id: "436", label: "Gourmet" },
        { id: "196", label: "Harem" },
        { id: "421", label: "Horror" },
        { id: "77",  label: "Isekai" },
        { id: "225", label: "Iyashikei" },
        { id: "555", label: "Josei" },
        { id: "35",  label: "Kids" },
        { id: "78",  label: "Magic" },
        { id: "857", label: "Mahou Shoujo" },
        { id: "92",  label: "Martial Arts" },
        { id: "219", label: "Mecha" },
        { id: "134", label: "Military" },
        { id: "27",  label: "Music" },
        { id: "48",  label: "Mystery" },
        { id: "356", label: "Parody" },
        { id: "240", label: "Psychological" },
        { id: "798", label: "Reverse Harem" },
        { id: "145", label: "Romance" },
        { id: "9",   label: "School" },
        { id: "36",  label: "Sci-Fi" },
        { id: "189", label: "Seinen" },
        { id: "183", label: "Shoujo" },
        { id: "37",  label: "Shounen" },
        { id: "125", label: "Slice of Life" },
        { id: "220", label: "Space" },
        { id: "10",  label: "Sports" },
        { id: "350", label: "Super Power" },
        { id: "49",  label: "Supernatural" },
        { id: "322", label: "Suspense" },
        { id: "241", label: "Thriller" },
        { id: "126", label: "Vampire" }
      ]
    },
    {
      name: "type",
      options: [
        { id: "tv",      label: "TV" },
        { id: "movie",   label: "Movie" },
        { id: "ova",     label: "OVA" },
        { id: "ona",     label: "ONA" },
        { id: "special", label: "Special" },
        { id: "music",   label: "Music" }
      ]
    },
    {
      name: "order",
      options: [
        { id: "updated_date",   label: "Updated Date" },
        { id: "release_date",   label: "Release Date" },
        { id: "end_date",       label: "End Date" },
        { id: "added_date",     label: "Added Date" },
        { id: "trending",       label: "Trending" },
        { id: "title_az",       label: "Name A-Z" },
        { id: "avg_score",      label: "Average Score" },
        { id: "mal_score",      label: "MAL Score" },
        { id: "most_viewed",    label: "Most Viewed" },
        { id: "most_followed",  label: "Most Followed" },
        { id: "episode_count",  label: "Episode Count" }
      ]
    }
  ]
};

// ── HTTP headers ──────────────────────────────────────────

var AJAX_HEADERS = {
  "Referer": "https://anikai.to/",
  "X-Requested-With": "XMLHttpRequest"
};

var PAGE_HEADERS = {
  "Referer": "https://anikai.to/"
};

var STREAM_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

// ── enc-dec.app helpers ───────────────────────────────────

function encodeToken(text) {
  var resp = http.get(
    "https://enc-dec.app/api/enc-kai?text=" + encodeURIComponent(text),
    PAGE_HEADERS
  );
  try {
    var j = JSON.parse(resp);
    return (j && j.result) ? j.result : "";
  } catch (e) {
    console.log("[animekai] encodeToken error: " + e);
    return "";
  }
}

function decodeKai(text) {
  var resp = http.post(
    "https://enc-dec.app/api/dec-kai",
    JSON.stringify({ text: text }),
    { "Content-Type": "application/json" }
  );
  try {
    var j = JSON.parse(resp);
    if (!j || j.status !== 200) return null;
    return j.result;
  } catch (e) {
    console.log("[animekai] decodeKai error: " + e);
    return null;
  }
}

// Obtiene el m3u8 final desde un embed URL de megaup.nl
// Flujo: /e/ID → /media/ID (JSON encriptado) → dec-mega → sources[0].file (m3u8)
function getMegaupStream(embedUrl) {
  var mediaUrl = embedUrl.replace("/e/", "/media/");
  var mediaResp = http.get(mediaUrl, {
    "Referer": "https://anikai.to/",
    "User-Agent": STREAM_UA
  });
  var encrypted = "";
  try {
    var mj = JSON.parse(mediaResp);
    encrypted = (mj && mj.result) ? mj.result : "";
  } catch (e) {
    console.log("[animekai] getMegaupStream parse error: " + e);
    return null;
  }
  if (!encrypted) return null;

  var decResp = http.post(
    "https://enc-dec.app/api/dec-mega",
    JSON.stringify({ text: encrypted, agent: STREAM_UA }),
    { "Content-Type": "application/json" }
  );
  try {
    var dj = JSON.parse(decResp);
    var sources = dj && dj.result && dj.result.sources;
    return (sources && sources[0] && sources[0].file) ? sources[0].file : null;
  } catch (e) {
    console.log("[animekai] dec-mega parse error: " + e);
    return null;
  }
}

// ── JSON unwrapping helpers ───────────────────────────────

// Extract HTML string from {"status":"ok","result":"..."} or {"status":"ok","result":{"html":"..."}}
function extractAjaxHtml(resp) {
  if (!resp) return "";
  try {
    var j = JSON.parse(resp);
    if (!j) return "";
    var r = j.result;
    if (typeof r === "string") return r;
    if (r && typeof r.html === "string") return r.html;
    return "";
  } catch (e) {
    return resp; // not JSON, return as-is
  }
}

// ── HTML parsing ──────────────────────────────────────────

function decodeHtml(s) {
  if (!s) return "";
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(parseInt(d, 10)); });
}

// Parse search AJAX results: <a class="aitem" href="/watch/...">
function parseSearchItems(html) {
  var items = [];
  // Each search item is <a class="aitem" href="/watch/SLUG"> ... </a>
  // (not nested with other aitems inside)
  var re = /<a\s+class="aitem"\s+href="([^"]+)"[\s\S]*?(?=<a\s+class="aitem"|<div class="sfoot"|$)/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var block = m[0];
    var href  = m[1];
    var slug  = (href.match(/\/watch\/([^/?#]+)/) || [])[1];
    if (!slug) continue;

    var titleM = block.match(/<h6[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h6>/i);
    var title  = titleM ? decodeHtml(titleM[1].trim()) : slug;

    var imgM = block.match(/<img[^>]+src="([^"]+)"/);
    var thumb = imgM ? imgM[1] : null;
    if (thumb) thumb = thumb.replace(/@\d+\.jpg$/, ".jpg"); // upgrade to full size

    var typeM = block.match(/<span><b>(TV|MOVIE|OVA|ONA|SPECIAL|MUSIC)<\/b><\/span>/i);
    var type = typeM ? typeM[1].trim() : null;

    items.push({
      id: slug,
      slug: slug,
      title: title,
      thumbnail: thumb,
      type: type,
      genres: [],
      status: null,
      pageUrl: SOURCE.baseUrl + "/watch/" + slug
    });
  }
  return items;
}

// Parse browser page items: <div class="aitem"><a href="/watch/..." class="poster">...
function parseBrowserItems(html) {
  var items = [];
  var re = /<div\s+class="aitem">([\s\S]*?)(?=<div\s+class="aitem">|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div class="pagination|<div class="page-)/g;
  // Simpler: just match each aitem block until the next one or end
  re = /<div\s+class="aitem">([\s\S]*?<a\s+class="title"[^>]*>[^<]+<\/a>[\s\S]*?<\/div>\s*<\/div>)/g;

  var m;
  while ((m = re.exec(html)) !== null) {
    var block = m[1];

    var hrefM = block.match(/<a\s+href="(\/watch\/[^"]+)"\s+class="poster"/);
    if (!hrefM) continue;
    var slug = hrefM[1].replace(/^\/watch\//, "");

    var titleM = block.match(/<a\s+class="title"[^>]*title="([^"]+)"[^>]*>/);
    if (!titleM) titleM = block.match(/<a\s+class="title"[^>]*>([^<]+)<\/a>/);
    var title = titleM ? decodeHtml(titleM[1].trim()) : slug;

    var imgM = block.match(/<img[^>]+(?:data-src|src)="([^"]+)"/);
    var thumb = imgM ? imgM[1] : null;
    if (thumb) thumb = thumb.replace(/@\d+\.jpg$/, ".jpg");

    var typeM = block.match(/<span><b>(TV|MOVIE|OVA|ONA|SPECIAL|MUSIC)<\/b><\/span>/i);
    var type = typeM ? typeM[1].trim() : null;

    items.push({
      id: slug,
      slug: slug,
      title: title,
      thumbnail: thumb,
      type: type,
      genres: [],
      status: null,
      pageUrl: SOURCE.baseUrl + "/watch/" + slug
    });
  }
  return items;
}

function hasNextPage(html, page) {
  return html.indexOf("page=" + (page + 1)) !== -1
      || html.indexOf("page=" + (page + 1) + "&") !== -1;
}

// ── Catalog ───────────────────────────────────────────────

function browseCatalog(sort, type, page) {
  var params = "sort=" + encodeURIComponent(sort) + "&page=" + page;
  if (type) params += "&type[]=" + encodeURIComponent(type);
  var url  = SOURCE.baseUrl + "/browser?" + params;
  var html = http.get(url, PAGE_HEADERS);
  console.log("[animekai] browse url=" + url + " len=" + html.length);
  var items = parseBrowserItems(html);
  console.log("[animekai] browse items=" + items.length);
  return {
    items: items,
    hasNextPage: hasNextPage(html, page)
  };
}

function fetchPopular(page) {
  return browseCatalog("trending", null, page);
}

function fetchLatest(page) {
  return browseCatalog("updated_date", null, page);
}

function buildBrowserParams(query, page, filters) {
  var params = "page=" + page;
  if (query && query.trim().length > 0)
    params += "&keyword=" + encodeURIComponent(query.trim());
  if (filters) {
    if (filters.genre) params += "&genre[]=" + encodeURIComponent(filters.genre);
    if (filters.type)  params += "&type[]="  + encodeURIComponent(filters.type);
    if (filters.order) params += "&sort="    + encodeURIComponent(filters.order);
  }
  return params;
}

function fetchSearch(query, page, filters) {
  var hasQuery = query && query.trim().length > 0;
  var hasFilters = filters && (filters.genre || filters.type || filters.order);

  if (!hasQuery && !hasFilters) {
    // Plain browse — use popular
    return browseCatalog("trending", null, page);
  }

  var params = buildBrowserParams(query, page, filters);
  var url    = SOURCE.baseUrl + "/browser?" + params;
  var html   = http.get(url, PAGE_HEADERS);
  console.log("[animekai] search url=" + url + " len=" + html.length);
  var items = parseBrowserItems(html);
  console.log("[animekai] search items=" + items.length);
  return {
    items: items,
    hasNextPage: hasNextPage(html, page)
  };
}

// ── Detail ────────────────────────────────────────────────

function fetchItemDetails(id) {
  var url  = SOURCE.baseUrl + "/watch/" + id;
  var html = http.get(url, PAGE_HEADERS);
  console.log("[animekai] details url=" + url + " len=" + html.length);

  // Title: <h1 itemprop="name" class="title" data-jp="..." >Naruto</h1>
  var titleM = html.match(/<h1[^>]*itemprop="name"[^>]*>([^<]+)<\/h1>/i);
  if (!titleM) titleM = html.match(/<h1[^>]*class="[^"]*\btitle\b[^"]*"[^>]*>([^<]+)<\/h1>/i);
  var title = titleM ? decodeHtml(titleM[1].trim()) : id;

  // Synopsis: <div class="desc text-expand">...
  var synM = html.match(/<div[^>]*class="[^"]*\bdesc\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  var synopsis = synM ? decodeHtml(synM[1].replace(/<[^>]+>/g, "").trim()) : "";

  // Cover: <img itemprop="image" src="...">
  var coverM = html.match(/<img[^>]+itemprop="image"[^>]+src="([^"]+)"/i);
  var cover  = coverM ? coverM[1] : null;

  // Genres: <a href="/genres/...">Action</a>
  var genres  = [];
  var genreRe = /<a[^>]+href="\/genres\/[^"]*"[^>]*>([^<]+)<\/a>/g;
  var gm;
  while ((gm = genreRe.exec(html)) !== null) {
    var g = decodeHtml(gm[1].trim());
    if (g && genres.indexOf(g) === -1) genres.push(g);
  }

  // Status: <div>Status:</div><span>Finished Airing</span> (variable structure)
  var statusM = html.match(/Status<\/div>\s*<div[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i);
  if (!statusM) statusM = html.match(/Status[\s\S]{0,80}?<span[^>]*>([^<]+)<\/span>/i);
  var status = statusM ? decodeHtml(statusM[1].trim()) : null;

  // Type: extraer del breadcrumb <a href="/tv">TV</a> (más fiable que el detail panel)
  var typeM = html.match(/breadcrumb-item[^>]*><a[^>]*href="\/(tv|movie|ova|ona|special|music)"/i);
  if (!typeM) typeM = html.match(/<span><b>(TV|MOVIE|OVA|ONA|SPECIAL|MUSIC)<\/b><\/span>/i);
  var type = typeM ? typeM[1].toUpperCase() : null;

  return {
    title: title,
    synopsis: synopsis,
    cover: cover,
    pageUrl: url,
    genres: genres,
    type: type,
    status: status,
    related: []
  };
}

// ── Episodes ──────────────────────────────────────────────

function fetchChildren(itemId) {
  var url  = SOURCE.baseUrl + "/watch/" + itemId;
  var html = http.get(url, PAGE_HEADERS);
  console.log("[animekai] fetchChildren itemId=" + itemId + " html len=" + html.length);

  // ani_id: <div ... id="anime-rating" ... data-id="c4S88Q"> (alphanumeric, not numeric)
  var aniIdM = html.match(/id="anime-rating"[^>]*data-id="([^"]+)"/);
  if (!aniIdM) aniIdM = html.match(/data-id="([^"]+)"[^>]*id="anime-rating"/);
  // Fallback: ttip-btn button carries the same ani_id in data-tip
  if (!aniIdM) aniIdM = html.match(/class="ttip-btn"\s+data-tip="([A-Za-z0-9_-]+)"/);
  // Fallback: user-bookmark or w2g-trigger
  if (!aniIdM) aniIdM = html.match(/(?:user-bookmark|w2g-trigger)[^>]+data-id="([A-Za-z0-9_-]+)"/);
  if (!aniIdM) {
    console.log("[animekai] ani_id NOT FOUND para: " + itemId);
    return [];
  }
  var aniId = aniIdM[1];
  console.log("[animekai] ani_id=" + aniId);

  var enc = encodeToken(aniId);
  console.log("[animekai] enc=" + (enc ? "OK len=" + enc.length : "FAILED"));
  if (!enc) return [];

  var epsResp = http.get(
    SOURCE.baseUrl + "/ajax/episodes/list?ani_id=" + aniId + "&_=" + encodeURIComponent(enc),
    AJAX_HEADERS
  );
  console.log("[animekai] epsResp len=" + epsResp.length);
  var epsHtml = extractAjaxHtml(epsResp);
  console.log("[animekai] epsHtml len=" + epsHtml.length);

  var episodes = [];
  // Real HTML: <a href="#" num="1" slug="1" langs="3" token="abc123" class=""> 1 <span data-jp="">Title</span> </a>
  // Flexible regex — doesn't require strict attribute order
  var epRe = /<a\s([^>]+)>([\s\S]*?)<\/a>/g;
  var em;
  while ((em = epRe.exec(epsHtml)) !== null) {
    var attrs   = em[1];
    var content = em[2];

    var numM   = attrs.match(/\bnum="([^"]+)"/);
    var tokenM = attrs.match(/\btoken="([^"]+)"/);
    if (!numM || !tokenM) continue;

    var num   = numM[1];
    var token = tokenM[1];

    var langsM = attrs.match(/\blangs="(\d+)"/);
    var langs  = langsM ? parseInt(langsM[1], 10) : 0;

    var nameM = content.match(/<span[^>]*>([^<]+)<\/span>/);
    var name  = nameM ? decodeHtml(nameM[1].trim()) : "";

    var langLabel = langs === 1 ? "Sub" : langs === 2 ? "Dub" : langs === 3 ? "Sub+Dub" : "";

    var epTitle = "Ep. " + num;
    if (name) epTitle += " — " + name;
    if (langLabel) epTitle += " (" + langLabel + ")";

    episodes.push({
      id:      token,          // just the token — fetchVideoList uses it directly
      number:  parseInt(num, 10),
      title:   epTitle,
      pageUrl: SOURCE.baseUrl + "/watch/" + itemId + "?ep=" + num
    });
  }

  console.log("[animekai] episodios encontrados=" + episodes.length);
  episodes.sort(function (a, b) { return a.number - b.number; });
  return episodes;
}

// ── Video List ────────────────────────────────────────────

function fetchVideoList(episodeId) {
  // episodeId is the episode token directly
  var epToken = episodeId;
  console.log("[animekai] fetchVideoList token=" + epToken);

  var enc = encodeToken(epToken);
  console.log("[animekai] token enc=" + (enc ? "OK" : "FAILED"));
  if (!enc) return [];

  var serversResp = http.get(
    SOURCE.baseUrl + "/ajax/links/list?token=" + encodeURIComponent(epToken) + "&_=" + encodeURIComponent(enc),
    AJAX_HEADERS
  );
  console.log("[animekai] serversResp len=" + serversResp.length);
  var serversHtml = extractAjaxHtml(serversResp);
  console.log("[animekai] serversHtml len=" + serversHtml.length);

  // Parse server groups: <div class="server-items lang-group" data-id="sub|softsub|dub">
  // Each contains: <span class="server" data-sid="3" data-eid="..." data-lid="...">Server 1</span>
  var langMap = { "sub": "Sub", "softsub": "SoftSub", "dub": "Dub" };

  var entries = [];
  var groupRe = /<div\s+class="server-items[^"]*"\s+data-id="([^"]+)"[^>]*>([\s\S]*?)<\/div>/g;
  var gm;
  while ((gm = groupRe.exec(serversHtml)) !== null) {
    var lang = langMap[gm[1]] || gm[1];
    var groupHtml = gm[2];
    var srvRe = /<span[^>]+\bdata-sid="([^"]*)"[^>]+\bdata-lid="([^"]+)"[^>]*>([^<]+)<\/span>/g;
    var sm;
    while ((sm = srvRe.exec(groupHtml)) !== null) {
      entries.push({
        sid:  sm[1],
        lid:  sm[2],
        name: sm[3].trim(),
        lang: lang
      });
    }
  }

  console.log("[animekai] servidores encontrados=" + entries.length);

  var results = [];
  // Limit to stay within request budget
  var limit = Math.min(entries.length, 4);
  for (var i = 0; i < limit; i++) {
    var e = entries[i];
    var encLid = encodeToken(e.lid);
    if (!encLid) continue;

    var viewResp = http.get(
      SOURCE.baseUrl + "/ajax/links/view?id=" + encodeURIComponent(e.lid) + "&_=" + encodeURIComponent(encLid),
      AJAX_HEADERS
    );

    // viewResp = {"status":"ok","result":"<encrypted_blob>"}
    var encrypted = "";
    try {
      var vj = JSON.parse(viewResp);
      encrypted = (vj && typeof vj.result === "string") ? vj.result : "";
    } catch (err) { continue; }

    if (!encrypted) continue;

    // Decode kai → {url: "https://megaup.nl/e/...", skip:{...}}
    var decoded = decodeKai(encrypted);
    if (!decoded) continue;

    var embedUrl = typeof decoded === "string" ? decoded : (decoded.url || "");
    if (!embedUrl) continue;

    // Resolver megaup → m3u8 final via /media/ + dec-mega
    var m3u8 = getMegaupStream(embedUrl);
    console.log("[animekai] m3u8 " + e.lang + ": " + (m3u8 ? m3u8.substring(0, 60) : "FAILED"));
    if (!m3u8) continue;

    results.push({
      url:     m3u8,
      server:  "animekai-" + e.lang.toLowerCase(),
      quality: e.lang + " — " + e.name
    });
  }

  console.log("[animekai] resultados=" + results.length);
  return results;
}
