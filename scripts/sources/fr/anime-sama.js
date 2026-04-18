// anime-sama — Extensión Kazemi JS
// =========================================================

const SOURCE = {
  id: "anime-sama",
  name: "Anime-Sama",
  baseUrl: "https://anime-sama.to",
  language: "fr",
  version: "1.0.0",
  iconUrl: "https://anime-sama.to/img/icon.png",
  contentKind: "anime",
  extractorRepositoryUrl: "https://raw.githubusercontent.com/kakuga-code/extensions/refs/heads/main/repo-extractores.json",
  supportedTypes: ["Anime", "Film", "Autres"],
  supportsPopular: false,
  filters: [
    {
      name: "type",
      options: [
        { id: "Anime",  label: "Anime" },
        { id: "Film",   label: "Film" },
        { id: "Autres", label: "Autres" }
      ]
    },
    {
      name: "genre",
      options: [
        { id: "Action",                          label: "Action" },
        { id: "Aventure",                        label: "Aventure" },
        { id: "Comédie",                         label: "Comédie" },
        { id: "Drame",                           label: "Drame" },
        { id: "Fantastique",                     label: "Fantastique" },
        { id: "Fantasy",                         label: "Fantasy" },
        { id: "Horreur",                         label: "Horreur" },
        { id: "Isekai",                          label: "Isekai" },
        { id: "Magie",                           label: "Magie" },
        { id: "Mechas",                          label: "Méchas" },
        { id: "Mystère",                         label: "Mystère" },
        { id: "Psychologique",                   label: "Psychologique" },
        { id: "Romance",                         label: "Romance" },
        { id: "School Life",                     label: "School Life" },
        { id: "Science-fiction",                 label: "Science-fiction" },
        { id: "Seinen",                          label: "Seinen" },
        { id: "Shôjo",                           label: "Shôjo" },
        { id: "Shônen",                          label: "Shônen" },
        { id: "Slice of Life",                   label: "Slice of Life" },
        { id: "Sport",                           label: "Sport" },
        { id: "Surnaturel",                      label: "Surnaturel" },
        { id: "Thriller",                        label: "Thriller" }
      ]
    }
  ]
};

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": SOURCE.baseUrl + "/"
};

const FILTERED_PAGE_SIZE = 24;

// ── Helpers ──────────────────────────────────────────────

function httpGet(url) {
  try {
    return http.get(url, DEFAULT_HEADERS);
  } catch (e) {
    console.log("[anime-sama] GET error " + url + ": " + e);
    return null;
  }
}

function decodeHtml(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, function(_, n) { return String.fromCharCode(parseInt(n, 10)); });
}

function serverNameFromUrl(url) {
  if (!url) return "Unknown";
  const m = url.match(/^https?:\/\/(?:www\.)?([^/]+)/i);
  if (!m) return "Unknown";
  const host = m[1].toLowerCase();
  if (host.indexOf("vidmoly") !== -1) return "Vidmoly";
  if (host.indexOf("sibnet") !== -1) return "Sibnet";
  if (host.indexOf("sendvid") !== -1) return "Sendvid";
  if (host.indexOf("oneupload") !== -1) return "Oneupload";
  if (host.indexOf("smoothpre") !== -1) return "Smoothpre";
  if (host.indexOf("ok.ru") !== -1) return "Okru";
  if (host.indexOf("voe") !== -1) return "Voe";
  if (host.indexOf("dood") !== -1) return "DoodStream";
  if (host.indexOf("streamtape") !== -1) return "StreamTape";
  if (host.indexOf("streamwish") !== -1) return "StreamWish";
  return m[1].split(".")[0];
}

// ── Catalog ───────────────────────────────────────────────

function fetchPopular(page) {
  return fetchSearch("", page, {});
}

function fetchLatest(page) {
  return fetchSearch("", page, {});
}

function fetchSearch(query, page, filters) {
  console.log("[anime-sama] fetchSearch filters=" + JSON.stringify(filters));
  if (!query || query.trim().length === 0) {
    const hasFilters = !!(
      filters &&
      ((filters.type && filters.type.trim()) || (filters.genre && filters.genre.trim()))
    );

    if (hasFilters) {
      return fetchFilteredCatalogue(page || 1, filters);
    }

    const pageNum = page || 1;
    const url = SOURCE.baseUrl + "/catalogue/?page=" + pageNum;
    const html = httpGet(url);
    const items = parseCatalogueCards(html, filters);
    const totalPages = parseTotalPages(html);
    return { items: items, hasNextPage: pageNum < totalPages };
  }

  const body = "query=" + encodeURIComponent(query.trim());
  const headers = {
    "User-Agent": DEFAULT_HEADERS["User-Agent"],
    "Referer": SOURCE.baseUrl + "/",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest"
  };

  try {
    const html = http.post(
      SOURCE.baseUrl + "/template-php/defaut/fetch.php",
      body,
      headers
    );
    return { items: parseSearchCards(html), hasNextPage: false };
  } catch (e) {
    console.log("[anime-sama] Search error: " + e);
    return { items: [], hasNextPage: false };
  }
}

function fetchFilteredCatalogue(page, filters) {
  const targetPage = page || 1;
  const startIndex = (targetPage - 1) * FILTERED_PAGE_SIZE;
  const endIndex = startIndex + FILTERED_PAGE_SIZE;
  const firstHtml = httpGet(SOURCE.baseUrl + "/catalogue/?page=1");
  if (!firstHtml) return { items: [], hasNextPage: false };

  const totalPages = parseTotalPages(firstHtml);
  const matchedItems = [];
  const seen = {};
  var pageNum = 1;
  var html = firstHtml;

  while (pageNum <= totalPages) {
    appendUniqueCatalogueItems(matchedItems, seen, parseCatalogueCards(html, filters));

    if (matchedItems.length >= endIndex) {
      return {
        items: matchedItems.slice(startIndex, endIndex),
        hasNextPage: true
      };
    }

    pageNum++;
    if (pageNum > totalPages) break;
    html = httpGet(SOURCE.baseUrl + "/catalogue/?page=" + pageNum);
    if (!html) continue;
  }

  return {
    items: matchedItems.slice(startIndex, endIndex),
    hasNextPage: matchedItems.length > endIndex
  };
}

function appendUniqueCatalogueItems(target, seen, sourceItems) {
  for (var i = 0; i < sourceItems.length; i++) {
    var item = sourceItems[i];
    if (seen[item.id]) continue;
    seen[item.id] = true;
    target.push(item);
  }
}

function parseTotalPages(html) {
  if (!html) return 1;
  // Pagination links look like href="...?page=44" — grab the largest number
  var max = 1;
  var re = /[?&]page=(\d+)/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  return max;
}

function parseCatalogueCards(html, filters) {
  if (!html) return [];
  const items = [];
  const seen = {};
  const filterType  = filters && filters.type  ? filters.type.toLowerCase()  : null;
  const filterGenre = filters && filters.genre ? filters.genre.toLowerCase() : null;

  // Split HTML into per-card chunks using catalog-card as delimiter
  const chunks = html.split(/(?=<div[^>]+class="[^"]*catalog-card)/);

  for (var ci = 0; ci < chunks.length; ci++) {
    const block = chunks[ci];

    const slugM = block.match(/href="https?:\/\/anime-sama\.to\/catalogue\/([^/"]+)/i);
    if (!slugM) continue;
    const slug = slugM[1];
    if (seen[slug]) continue;

    // Extract type — look for "Types" label then the next info-value
    const typeM = block.match(/>Types<\/span>[\s\S]*?<p[^>]*class="info-value"[^>]*>([\s\S]*?)<\/p>/i);
    const cardType = typeM ? typeM[1].trim().toLowerCase() : "";

    if (!filterType && cardType.indexOf("scans") !== -1 && cardType.indexOf("anime") === -1 && cardType.indexOf("film") === -1) continue;
    if (filterType && cardType.indexOf(filterType) === -1) continue;

    // Extract genres
    const genreM = block.match(/>Genres<\/span>[\s\S]*?<p[^>]*class="info-value"[^>]*>([\s\S]*?)<\/p>/i);
    const cardGenres = genreM ? genreM[1].toLowerCase() : "";
    if (filterGenre && cardGenres.indexOf(filterGenre) === -1) continue;

    const imgM = block.match(/<img[^>]+src="([^"]+)"/i);
    const titM = block.match(/class="card-title"[^>]*>([^<]+)<\/h2>/i);
    if (!titM) continue;

    seen[slug] = true;
    const itemType = cardType.indexOf("film") !== -1 && cardType.indexOf("anime") === -1 ? "movie" : "tv";
    items.push({
      id: slug,
      title: decodeHtml(titM[1].trim()),
      thumbnail: imgM ? imgM[1].trim() : "",
      type: itemType,
      pageUrl: SOURCE.baseUrl + "/catalogue/" + slug + "/"
    });
  }
  return items;
}

function parseSearchCards(html) {
  if (!html) return [];
  const items = [];
  const re = /<a[^>]+href="([^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h3[^>]*>(.*?)<\/h3>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].trim();
    const slugM = href.match(/\/catalogue\/([^/]+)/);
    if (!slugM) continue;
    const slug = slugM[1];
    items.push({
      id: slug,
      title: decodeHtml(m[3].trim()),
      thumbnail: m[2].trim(),
      type: "TV",
      pageUrl: href.indexOf("http") === 0 ? href : SOURCE.baseUrl + href
    });
  }
  return items;
}

// ── Detail ────────────────────────────────────────────────

function fetchItemDetails(slug) {
  const url = SOURCE.baseUrl + "/catalogue/" + slug + "/";
  const html = httpGet(url);
  if (!html) return { title: slug };

  // Title from <title> tag — format: "Show Title | Anime-Sama - ..."
  const pageTitleM = html.match(/<title>([^<]+)<\/title>/i);
  const rawTitle = pageTitleM ? pageTitleM[1].split("|")[0].trim() : slug;
  const title = decodeHtml(rawTitle);

  // Synopsis from meta description
  const synM = html.match(/<meta name="description"[^>]+content="([^"]+)"/i);
  const synopsis = synM ? synM[1].trim() : "";

  // Cover from og:image
  const coverM = html.match(/<meta property="og:image"[^>]+content="([^"]+)"/i);
  const cover = coverM ? coverM[1].trim() : null;

  // Genres — single <a> after "Genres" header containing comma-separated list
  const genreM = html.match(/Genres[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
  const genres = genreM
    ? genreM[1].split(",").map(function (g) { return g.trim(); }).filter(Boolean)
    : [];

  return {
    title: title,
    synopsis: synopsis,
    cover: cover,
    genres: genres,
    type: "TV",
    status: null,
    related: [],
    pageUrl: url
  };
}

// ── Episode List ──────────────────────────────────────────

function fetchChildren(slug) {
  const detailUrl = SOURCE.baseUrl + "/catalogue/" + slug + "/";
  const html = httpGet(detailUrl);
  if (!html) return [];

  // Strip block comments before parsing to avoid matching commented-out seasons
  const stripped = html.replace(/\/\*[\s\S]*?\*\//g, "");

  // Extract panneauAnime("label", "seasonPath") calls
  const seasonRe = /panneauAnime\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g;
  const seasons = [];
  let sm;
  while ((sm = seasonRe.exec(stripped)) !== null) {
    const label = sm[1];
    const path = sm[2];
    // Skip template/placeholder entries
    if (label === "nom" || path === "url") continue;
    seasons.push({ label: label, path: path });
  }

  if (seasons.length === 0) return [];

  const allEpisodes = [];
  var globalCounter = 1;

  seasons.forEach(function (season) {
    const episodesUrl = SOURCE.baseUrl + "/catalogue/" + slug + "/" + season.path + "/episodes.js";
    const js = httpGet(episodesUrl);
    if (!js) return;

    // Parse first eps array to count episodes (all eps arrays have same length)
    const firstArrayM = js.match(/var\s+eps\d+\s*=\s*\[([\s\S]*?)\]/);
    if (!firstArrayM) return;

    const urlRe = /'([^']+)'/g;
    let um;
    var epIndex = 0;
    while ((um = urlRe.exec(firstArrayM[1])) !== null) {
      allEpisodes.push({
        id: slug + "|" + season.path + "|" + epIndex,
        number: globalCounter,
        title: season.label + " — Ép. " + (epIndex + 1),
        pageUrl: SOURCE.baseUrl + "/catalogue/" + slug + "/" + season.path + "/"
      });
      epIndex++;
      globalCounter++;
    }
  });

  return allEpisodes;
}

// ── Video List ────────────────────────────────────────────

function fetchVideoList(episodeIdStr) {
  // episodeIdStr format: "{slug}|{seasonPath}|{epIndex}"
  const parts = episodeIdStr.split("|");
  const slug = parts[0];
  const seasonPath = parts[1];
  const epIndex = parseInt(parts[2], 10);

  const episodesUrl = SOURCE.baseUrl + "/catalogue/" + slug + "/" + seasonPath + "/episodes.js";
  console.log("[anime-sama] Fetching episodes.js: " + episodesUrl);

  const js = httpGet(episodesUrl);
  if (!js) {
    console.log("[anime-sama] episodes.js not found");
    return [];
  }

  // Extract all eps arrays: var eps1 = [...], var eps2 = [...], etc.
  const results = [];
  const arrayRe = /var\s+(eps\d+)\s*=\s*\[([\s\S]*?)\]/g;
  let am;

  while ((am = arrayRe.exec(js)) !== null) {
    const arrayName = am[1]; // eps1, eps2, ...
    const arrayContent = am[2];

    // Collect all URLs in this array
    const urls = [];
    const urlRe = /'([^']+)'/g;
    let um;
    while ((um = urlRe.exec(arrayContent)) !== null) {
      urls.push(um[1]);
    }

    if (epIndex >= urls.length) continue;

    const embedUrl = urls[epIndex];
    if (!embedUrl || embedUrl.length < 5) continue;

    const serverName = serverNameFromUrl(embedUrl);
    const mirrorNum = arrayName.replace("eps", "");

    const u = embedUrl.toLowerCase();
    const hasNativeExtractor = u.indexOf("dingtezuni.com") !== -1
      || u.indexOf("minochinos.com") !== -1
      || u.indexOf("vidhide") !== -1
      || u.indexOf("sendvid.com") !== -1
      || u.indexOf("sibnet.ru") !== -1
      || u.indexOf("ok.ru") !== -1
      || u.indexOf("voe.sx") !== -1
      || u.indexOf("dood") !== -1
      || u.indexOf("streamtape.com") !== -1
      || u.indexOf("streamwish") !== -1
      || u.indexOf("mp4upload.com") !== -1
      || u.indexOf("mixdrop") !== -1
      || u.indexOf("uqload") !== -1
      || u.indexOf("yourupload.com") !== -1;
    const needsBrowser = !hasNativeExtractor;

    results.push({
      server: serverName,
      quality: serverName + " — M" + mirrorNum,
      embed: embedUrl,
      browserSession: needsBrowser
    });
  }

  console.log("[anime-sama] Found " + results.length + " mirrors");
  return results;
}
