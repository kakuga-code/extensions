// AniTube — Extensión Kazemi JS
// =========================================================

const SOURCE = {
  id: "anitube",
  name: "AniTube",
  baseUrl: "https://www.anitube.news",
  language: "pt-BR",
  version: "1.0.0",
  iconUrl: "https://www.anitube.news/wp-content/uploads/cropped-Favicon6-32x32.png",
  contentKind: "anime",
  filters: [
    {
      name: "genre",
      options: [
        { id: "acao", label: "Ação" },
        { id: "artes marciais", label: "Artes Marciais" },
        { id: "aventura", label: "Aventura" },
        { id: "comedia", label: "Comédia" },
        { id: "comedia romantica", label: "Comédia Romântica" },
        { id: "drama", label: "Drama" },
        { id: "ecchi", label: "Ecchi" },
        { id: "esporte", label: "Esporte" },
        { id: "fantasia", label: "Fantasia" },
        { id: "ficcao cientifica", label: "Ficção Científica" },
        { id: "jogos", label: "Jogos" },
        { id: "magia", label: "Magia" },
        { id: "mecha", label: "Mecha" },
        { id: "misterio", label: "Mistério" },
        { id: "musical", label: "Musical" },
        { id: "romance", label: "Romance" },
        { id: "seinen", label: "Seinen" },
        { id: "shoujo ai", label: "Shoujo-ai" },
        { id: "shounen", label: "Shounen" },
        { id: "slice of life", label: "Slice Of Life" },
        { id: "sobrenatural", label: "Sobrenatural" },
        { id: "superpoder", label: "Superpoder" },
        { id: "terror", label: "Terror" },
        { id: "vida escolar", label: "Vida Escolar" }
      ]
    },
    {
      name: "type",
      options: [
        { id: "legendado", label: "Legendado" },
        { id: "dublado", label: "Dublado" }
      ]
    },
    {
      name: "letter",
      options: [
        { id: "", label: "Todas" },
        { id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" },
        { id: "d", label: "D" }, { id: "e", label: "E" }, { id: "f", label: "F" },
        { id: "g", label: "G" }, { id: "h", label: "H" }, { id: "i", label: "I" },
        { id: "j", label: "J" }, { id: "k", label: "K" }, { id: "l", label: "L" },
        { id: "m", label: "M" }, { id: "n", label: "N" }, { id: "o", label: "O" },
        { id: "p", label: "P" }, { id: "q", label: "Q" }, { id: "r", label: "R" },
        { id: "s", label: "S" }, { id: "t", label: "T" }, { id: "u", label: "U" },
        { id: "v", label: "V" }, { id: "w", label: "W" }, { id: "x", label: "X" },
        { id: "y", label: "Y" }, { id: "z", label: "Z" }
      ]
    }
  ]
};

function decodeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8217;|&#039;|&apos;/g, "'")
    .replace(/&#038;|&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, function (_, dec) { return String.fromCharCode(parseInt(dec, 10)); })
    .replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú")
    .replace(/&Aacute;/g, "Á").replace(/&Eacute;/g, "É").replace(/&Iacute;/g, "Í").replace(/&Oacute;/g, "Ó").replace(/&Uacute;/g, "Ú")
    .replace(/&atilde;/g, "ã").replace(/&otilde;/g, "õ").replace(/&acirc;/g, "â").replace(/&ecirc;/g, "ê").replace(/&ocirc;/g, "ô")
    .replace(/&Atilde;/g, "Ã").replace(/&Otilde;/g, "Õ").replace(/&Acirc;/g, "Â").replace(/&Ecirc;/g, "Ê").replace(/&Ocirc;/g, "Ô")
    .replace(/&ccedil;/g, "ç").replace(/&Ccedil;/g, "Ç");
}

function stripTags(text) {
  return decodeHtml((text || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "));
}

function cleanText(text) {
  return stripTags(text).replace(/\s+/g, " ").trim();
}

function normalizeUrl(url) {
  if (!url) return null;
  if (url.indexOf("http") === 0) return url;
  if (url.charAt(0) === "/") return SOURCE.baseUrl + url;
  return SOURCE.baseUrl + "/" + url.replace(/^\/+/, "");
}

function parseTypeLabel(label, title) {
  var value = (label || "").toLowerCase();
  var titleValue = (title || "").toLowerCase();
  if (value.indexOf("dublado") !== -1 || titleValue.indexOf("dublado") !== -1) return "TV";
  if (titleValue.indexOf("filme") !== -1 || titleValue.indexOf("movie") !== -1) return "Movie";
  return "TV";
}

function extractIdFromUrl(url) {
  var match = (url || "").match(/\/video\/([^/?#]+)\/?/i);
  if (match && match[1]) return match[1];
  return (url || "").replace(/^https?:\/\/[^/]+/i, "").replace(/[/?#]+$/g, "");
}

function parseAniItems(html) {
  var items = [];
  var seen = {};
  var regex = /<div class="aniItem">\s*<a href="([^"]+)"[^>]*title="([^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<div class="aniCC">([^<]*)<\/div>[\s\S]*?<div class="aniItemNome">\s*([\s\S]*?)\s*<\/div>/gi;
  var match;
  while ((match = regex.exec(html)) !== null) {
    var pageUrl = normalizeUrl(match[1]);
    var id = extractIdFromUrl(pageUrl);
    if (!id || seen[id]) continue;
    seen[id] = true;
    var title = cleanText(match[5] || match[2]);
    var lang = cleanText(match[4]);
    items.push({
      id: id,
      slug: id,
      title: title,
      thumbnail: normalizeUrl(match[3]),
      type: parseTypeLabel(lang, title),
      genres: [],
      status: null,
      pageUrl: pageUrl
    });
  }
  return items;
}

function extractSection(html, markerClass) {
  if (!html || !markerClass) return "";
  var start = html.indexOf('class="' + markerClass + '"');
  if (start === -1) return "";

  var trackStart = html.lastIndexOf("<div", start);
  if (trackStart === -1) trackStart = start;

  var depth = 0;
  var pos = trackStart;
  while (pos < html.length) {
    var nextOpen = html.indexOf("<div", pos);
    var nextClose = html.indexOf("</div>", pos);
    if (nextClose === -1) break;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      pos = nextOpen + 4;
    } else {
      depth -= 1;
      pos = nextClose + 6;
      if (depth <= 0) {
        return html.substring(trackStart, pos);
      }
    }
  }
  return "";
}

function fetchHomeSection(markerClass) {
  var html = http.get(SOURCE.baseUrl + "/");
  if (!html) return { items: [], hasNextPage: false };
  var section = extractSection(html, markerClass);
  return {
    items: parseAniItems(section || html),
    hasNextPage: false
  };
}

function hasNextPage(html) {
  return /class="next page-numbers"/i.test(html);
}

function fetchCatalogPage(url) {
  var html = http.get(url);
  if (!html) return { items: [], hasNextPage: false };
  return {
    items: parseAniItems(html),
    hasNextPage: hasNextPage(html)
  };
}

function buildListUrl(page, filters) {
  var type = filters && filters.type ? String(filters.type) : "";
  var letter = filters && filters.letter ? String(filters.letter).toLowerCase() : "";
  var base = SOURCE.baseUrl + "/lista-de-animes-online";

  if (type === "dublado") base = SOURCE.baseUrl + "/lista-de-animes-dublados-online";
  else if (type === "legendado") base = SOURCE.baseUrl + "/lista-de-animes-legendados-online";

  if (page > 1) base += "/page/" + page + "/";
  if (letter) base += (base.indexOf("?") === -1 ? "?" : "&") + "letra=" + encodeURIComponent(letter);
  return base;
}

function fetchPopular(page) {
  if (page === 1) {
    var home = fetchHomeSection("main-carousel");
    if (home.items.length > 0) return home;
  }
  return fetchCatalogPage(buildListUrl(page, {}));
}

function fetchLatest(page) {
  if (page === 1) {
    var home = fetchHomeSection("main-carousel-an");
    if (home.items.length > 0) return home;
  }
  return fetchCatalogPage(buildListUrl(page, {}));
}

function fetchSearch(query, page, filters) {
  if (query && query.trim()) {
    var url = SOURCE.baseUrl + "/?s=" + encodeURIComponent(query.trim());
    var html = http.get(url);
    if (!html) return { items: [], hasNextPage: false };
    return {
      items: parseAniItems(html),
      hasNextPage: false
    };
  }

  if (filters && filters.genre) {
    var genreUrl = SOURCE.baseUrl + "/?s=" + encodeURIComponent(String(filters.genre).trim());
    var genreHtml = http.get(genreUrl);
    if (!genreHtml) return { items: [], hasNextPage: false };
    return {
      items: parseAniItems(genreHtml),
      hasNextPage: false
    };
  }

  return fetchCatalogPage(buildListUrl(page, filters || {}));
}

function fetchItemDetails(id) {
  var url = /^https?:\/\//i.test(id) ? id : (SOURCE.baseUrl + "/video/" + id + "/");
  var html = http.get(url);
  if (!html) {
    return {
      title: id,
      synopsis: "",
      genres: [],
      related: []
    };
  }

  var titleM = html.match(/<div class="pagAniTitulo">[\s\S]*?<h1>([\s\S]*?)<\/h1>/i);
  var coverM = html.match(/<div id="capaAnime">[\s\S]*?<img[^>]+src="([^"]+)"/i);
  var synopsisM = html.match(/<div id="sinopse2">([\s\S]*?)<\/div>/i);
  var genreM = html.match(/<b>Gênero:<\/b>\s*([^<]+)/i);
  var statusM = html.match(/<b>Tipo de Episódio:<\/b>\s*([^<]+)/i);
  var formatM = html.match(/<b>Formato:<\/b>\s*([^<]+)/i);

  var genres = [];
  if (genreM && genreM[1]) {
    genres = cleanText(genreM[1]).split(/\s*,\s*/).filter(function (x) { return !!x; });
  }

  return {
    title: cleanText(titleM ? titleM[1] : id),
    synopsis: cleanText(synopsisM ? synopsisM[1] : ""),
    cover: normalizeUrl(coverM ? coverM[1] : null),
    genres: genres,
    type: parseTypeLabel(statusM ? statusM[1] : "", formatM ? formatM[1] : ""),
    status: statusM ? cleanText(statusM[1]) : null,
    related: []
  };
}

function fetchChildren(itemId) {
  var url = /^https?:\/\//i.test(itemId) ? itemId : (SOURCE.baseUrl + "/video/" + itemId + "/");
  var html = http.get(url);
  if (!html) return [];

  var episodes = [];
  var seen = {};
  var regex = /<a href="([^"]+)" title="([^"]*Epis[oó]dio\s*([0-9]+)[^"]*)">/gi;
  var match;

  while ((match = regex.exec(html)) !== null) {
    var epUrl = normalizeUrl(match[1]);
    var epId = extractIdFromUrl(epUrl);
    if (!epId || seen[epId]) continue;
    seen[epId] = true;
    var number = parseFloat(match[3]) || (episodes.length + 1);
    episodes.push({
      id: epId,
      number: number,
      title: cleanText(match[2]),
      pageUrl: epUrl
    });
  }

  episodes.sort(function (a, b) { return a.number - b.number; });
  return episodes;
}

function extractQualityLabel(url) {
  if (!url) return "Auto";
  var match = url.match(/(\d{3,4})p/i);
  return match && match[1] ? match[1] + "p" : "Auto";
}

function extractStreamFromIframe(url) {
  if (!url) return null;
  if (url.indexOf("videohls.php?d=") !== -1) {
    var direct = url.match(/[?&]d=([^&]+)/i);
    if (direct && direct[1]) return decodeURIComponent(direct[1]);
  }

  var html = http.get(url, { "Referer": SOURCE.baseUrl + "/" });
  if (!html) return null;

  var m3u8Match = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
  if (m3u8Match && m3u8Match[0]) return m3u8Match[0];

  var directMatch = html.match(/src="https:\/\/api\.anivideo\.net\/videohls\.php\?d=([^"&]+\.m3u8[^"]*)"/i);
  if (directMatch && directMatch[1]) return decodeURIComponent(directMatch[1]);

  return null;
}

function resolveNestedEmbed(url, episodeReferer) {
  if (!url) return null;
  try {
    var headers = episodeReferer ? { "Referer": episodeReferer } : null;
    var html = http.get(url, headers);
    if (!html) return null;

    var nestedIframe = html.match(/<iframe[^>]+src="([^"]+)"[^>]*><\/iframe>/i);
    if (nestedIframe && nestedIframe[1]) {
      return normalizeUrl(nestedIframe[1]);
    }
  } catch (e) {}
  return null;
}

function parsePlayerLabels(html) {
  var labels = {};
  var labelRe = /<div class="pagEpiAbasItem[^"]*"(?:\s+[^>]*)?aba-target="([^"]+)"[^>]*>([\s\S]*?)<\/div>/gi;
  var match;
  while ((match = labelRe.exec(html)) !== null) {
    labels[match[1]] = cleanText(match[2]);
  }
  return labels;
}

function fetchVideoList(episodeId) {
  var url = /^https?:\/\//i.test(episodeId) ? episodeId : (SOURCE.baseUrl + "/video/" + episodeId + "/");
  var html = http.get(url);
  if (!html) return [];

  var videos = [];
  var seen = {};
  var labels = parsePlayerLabels(html);
  var blockRe = /<div id="([^"]+)" class="pagEpiAbasContainer[^"]*"[\s\S]*?<iframe[^>]+src="([^"]+)"[^>]*>[\s\S]*?<\/iframe>[\s\S]*?<\/div>/gi;
  var match;

  while ((match = blockRe.exec(html)) !== null) {
    var blockId = match[1];
    var iframeUrl = normalizeUrl(match[2]);
    var streamUrl = extractStreamFromIframe(iframeUrl);
    var label = labels[blockId] || (iframeUrl.indexOf("api.anivideo.net") !== -1 ? "Player FHD" : "Player");
    var normalizedLabel = (label || "").toLowerCase().replace(/\s+/g, " ").trim();

    // Blogger/Player 1 no es reproducible de forma confiable en Kazemi.
    if (normalizedLabel === "player 1") continue;

    if (streamUrl) {
      if (seen[streamUrl]) continue;
      seen[streamUrl] = true;
      videos.push({
        url: streamUrl,
        quality: extractQualityLabel(streamUrl),
        server: label,
        headers: {
          "Referer": iframeUrl.indexOf("api.anivideo.net") !== -1 ? "https://api.anivideo.net/" : SOURCE.baseUrl + "/"
        }
      });
      continue;
    }

    if (seen[iframeUrl]) continue;
    var resolvedEmbed = resolveNestedEmbed(iframeUrl, url) || iframeUrl;
    if (seen[resolvedEmbed]) continue;
    seen[resolvedEmbed] = true;
    videos.push({
      embed: resolvedEmbed,
      server: label,
      quality: "Embed"
    });
  }

  return videos;
}

function fetchEpisodeList(itemId) {
  return fetchChildren(itemId);
}
