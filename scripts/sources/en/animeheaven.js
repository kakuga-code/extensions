// AnimeHeaven — Extensión Kazemi JS
// Fuente: https://animeheaven.me
// =========================================================

const SOURCE = {
  id: "animeheaven",
  name: "AnimeHeaven",
  baseUrl: "https://animeheaven.me",
  language: "en",
  version: "1.0.0",
  iconUrl: "https://animeheaven.me/favicon.ico",
  contentKind: "anime",
  extractorRepositoryUrl: "https://raw.githubusercontent.com/kakuga-code/extensions/refs/heads/main/repo-extractores.json",
  supportsPopular: true,
  supportedTypes: ["tv", "movie", "ova", "ona", "special"],
  filters: [
    {
      name: "genre",
      options: [
        { id: "Action", label: "Action" },
        { id: "Adventure", label: "Adventure" },
        { id: "Comedy", label: "Comedy" },
        { id: "Drama", label: "Drama" },
        { id: "Fantasy", label: "Fantasy" },
        { id: "Romance", label: "Romance" },
        { id: "School", label: "School" },
        { id: "Sci-Fi", label: "Sci-Fi" },
        { id: "Shounen", label: "Shounen" },
        { id: "Slice Of Life", label: "Slice Of Life" },
        { id: "Sports", label: "Sports" },
        { id: "Supernatural", label: "Supernatural" }
      ]
    }
  ]
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

function attr(html, name) {
  var re = new RegExp("\\b" + name + "=['\"]([^'\"]+)['\"]", "i");
  var m = (html || "").match(re);
  return m ? decodeHtml(m[1]) : "";
}

function makeItem(id, title, image, extra) {
  return {
    id: id,
    slug: id,
    title: title,
    thumbnail: absoluteUrl(image),
    type: "TV",
    status: extra && extra.status ? extra.status : null,
    genres: extra && extra.genres ? extra.genres : [],
    pageUrl: SOURCE.baseUrl + "/anime.php?" + id
  };
}

function parseCardItems(html) {
  var out = [];
  var seen = {};
  var re = /<div\s+class=['"]chart\s+bc1['"][\s\S]*?<\/div>\s*<\/div>/gi;
  var m;
  while ((m = re.exec(html || "")) !== null) {
    var block = m[0];
    var idM = block.match(/href=['"]anime\.php\?([^'"]+)['"]/i);
    if (!idM) continue;
    var id = idM[1];
    if (seen[id]) continue;
    seen[id] = true;

    var titleM = block.match(/class=['"]charttitle\s+c['"][\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    var imageM = block.match(/<img[^>]+src=['"]([^'"]+)['"][^>]*>/i);
    var title = titleM ? cleanText(titleM[1]) : cleanText(attr(imageM ? imageM[0] : "", "alt"));
    if (!title) continue;

    out.push(makeItem(id, title, imageM ? imageM[1] : null, {}));
  }
  return out;
}

function parseSearchItems(html) {
  var out = [];
  var seen = {};
  var re = /<div\s+class=['"]similarimg['"][\s\S]*?<\/div>\s*<\/div>/gi;
  var m;
  while ((m = re.exec(html || "")) !== null) {
    var block = m[0];
    var idM = block.match(/href=['"]anime\.php\?([^'"]+)['"]/i);
    if (!idM) continue;
    var id = idM[1];
    if (seen[id]) continue;
    seen[id] = true;

    var titleM = block.match(/class=['"]similarname\s+c['"][\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    var imageM = block.match(/<img[^>]+src=['"]([^'"]+)['"][^>]*>/i);
    var title = titleM ? cleanText(titleM[1]) : cleanText(attr(imageM ? imageM[0] : "", "alt"));
    if (!title) continue;

    out.push(makeItem(id, title, imageM ? imageM[1] : null, {}));
  }
  return out;
}

function fetchSearch(query, page, filters) {
  var q = (query || "").trim();
  var url;
  if (q) {
    url = SOURCE.baseUrl + "/search.php?s=" + encodeURIComponent(q);
  } else if (filters && filters.genre) {
    url = SOURCE.baseUrl + "/tags.php?tag=" + encodeURIComponent(filters.genre);
  } else {
    url = SOURCE.baseUrl + "/new.php";
  }

  var html = getHtml(url);
  console.log("[animeheaven] search url=" + url + " len=" + html.length);
  var items = parseSearchItems(html);
  if (items.length === 0) items = parseCardItems(html);
  console.log("[animeheaven] search items=" + items.length);
  return { items: items, hasNextPage: false };
}

function fetchPopular(page) {
  var html = getHtml(SOURCE.baseUrl + "/popular.php");
  var items = parseCardItems(html);
  console.log("[animeheaven] popular items=" + items.length);
  return { items: items, hasNextPage: false };
}

function fetchLatest(page) {
  var html = getHtml(SOURCE.baseUrl + "/new.php");
  var items = parseCardItems(html);
  console.log("[animeheaven] latest items=" + items.length);
  return { items: items, hasNextPage: false };
}

function fetchItemDetails(id) {
  var html = getHtml(SOURCE.baseUrl + "/anime.php?" + encodeURIComponent(id));
  var titleM = html.match(/<div\s+class=['"]infotitle\s+c['"]>([\s\S]*?)<\/div>/i);
  var descM = html.match(/<div\s+class=['"]infodes\s+c['"]>([\s\S]*?)<\/div>/i);
  var imgM = html.match(/<img[^>]+class=['"]posterimg['"][^>]+src=['"]([^'"]+)['"]/i);
  if (!imgM) imgM = html.match(/<img[^>]+src=['"]([^'"]+)['"][^>]*class=['"]posterimg['"]/i);

  var genres = [];
  var tagRe = /<div\s+class=['"]boxitem\s+bc2\s+c1['"]>([\s\S]*?)<\/div>/gi;
  var tm;
  while ((tm = tagRe.exec(html)) !== null) {
    var tag = cleanText(tm[1]);
    if (tag && genres.indexOf(tag) === -1) genres.push(tag);
  }

  var infoM = html.match(/<div\s+class=['"]infoyear\s+c['"]>([\s\S]*?)<\/div>\s*<\/div>/i);
  var info = infoM ? cleanText(infoM[1]) : "";
  var yearM = info.match(/Year:\s*([0-9? -]+)/i);
  var scoreM = info.match(/Score:\s*([0-9.]+\/10)/i);
  var epM = info.match(/Episodes:\s*([0-9.+]+)/i);
  var status = yearM && yearM[1].indexOf("?") !== -1 ? "Ongoing" : null;

  return {
    id: id,
    slug: id,
    title: titleM ? cleanText(titleM[1]) : id,
    synopsis: descM ? cleanText(descM[1]) : "",
    thumbnail: imgM ? absoluteUrl(imgM[1]) : null,
    banner: imgM ? absoluteUrl(imgM[1]) : null,
    type: "TV",
    status: status,
    genres: genres,
    year: yearM ? yearM[1].trim() : null,
    rating: scoreM ? scoreM[1] : null,
    episodeCount: epM ? epM[1] : null,
    pageUrl: SOURCE.baseUrl + "/anime.php?" + id,
    recommendations: parseSearchItems(html)
  };
}

function fetchChildren(itemId) {
  var html = getHtml(SOURCE.baseUrl + "/anime.php?" + encodeURIComponent(itemId));
  console.log("[animeheaven] fetchChildren itemId=" + itemId + " html len=" + html.length);

  var titleM = html.match(/<div\s+class=['"]infotitle\s+c['"]>([\s\S]*?)<\/div>/i);
  var seriesTitle = titleM ? cleanText(titleM[1]) : "";
  var episodes = [];
  var seen = {};
  var re = /<a[^>]+(?:onmouseover|onclick)=['"]gate[ha]\(['"]([a-f0-9]{16,})['"]\)['"][\s\S]*?<\/a>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var block = m[0];
    var key = m[1];
    if (seen[key]) continue;
    seen[key] = true;

    var epM = block.match(/<div\s+class=['"][^'"]*watch2[^'"]*['"]>([\s\S]*?)<\/div>/i);
    var label = epM ? cleanText(epM[1]) : String(episodes.length + 1);
    var number = parseFloat(label.replace(/[^0-9.]/g, ""));
    if (isNaN(number)) number = episodes.length + 1;

    episodes.push({
      id: itemId + "|" + key + "|" + label,
      number: number,
      title: (seriesTitle ? seriesTitle + " - " : "") + "Episode " + label,
      pageUrl: SOURCE.baseUrl + "/gate.php"
    });
  }

  episodes.sort(function (a, b) { return a.number - b.number; });
  console.log("[animeheaven] episodios encontrados=" + episodes.length);
  return episodes;
}

function fetchVideoList(episodeId) {
  var parts = String(episodeId || "").split("|");
  var showId = parts[0] || "";
  var key = parts[1] || episodeId;
  var label = parts[2] || "";
  var referer = showId ? SOURCE.baseUrl + "/anime.php?" + showId : SOURCE.baseUrl + "/";

  console.log("[animeheaven] fetchVideoList key=" + key);
  var html = getHtml(SOURCE.baseUrl + "/gate.php", {
    "Referer": referer,
    "Cookie": "key=" + key
  });

  var out = [];
  var seen = {};
  var sourceRe = /<source[^>]+src=['"]([^'"]+)['"][^>]*type=['"]video\/mp4['"][^>]*>/gi;
  var m;
  while ((m = sourceRe.exec(html)) !== null) {
    var url = decodeHtml(m[1]);
    if (!url || seen[url]) continue;
    seen[url] = true;
    var hostM = url.match(/^https?:\/\/([^\/]+)/i);
    var host = hostM ? hostM[1].split(".")[0].toUpperCase() : "MP4";
    out.push({
      url: url,
      server: "animeheaven-" + host.toLowerCase(),
      quality: "MP4" + (label ? " — Ep. " + label : ""),
      headers: { "Referer": SOURCE.baseUrl + "/gate.php" }
    });
  }

  var downloadM = html.match(/href=['"]([^'"]*video\.mp4\?[^'"]+&d)['"]/i);
  if (downloadM) {
    var durl = decodeHtml(downloadM[1]);
    if (durl && !seen[durl]) {
      out.push({
        url: durl,
        server: "animeheaven-download",
        quality: "MP4 — Download",
        headers: { "Referer": SOURCE.baseUrl + "/gate.php" }
      });
    }
  }

  console.log("[animeheaven] videos encontrados=" + out.length);
  return out;
}
