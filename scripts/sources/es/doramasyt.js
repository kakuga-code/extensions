// Doramasyt — Extensión Kazemi JS
// =========================================================

const SOURCE = {
  id: "doramasyt",
  name: "Doramasyt",
  baseUrl: "https://www.doramasyt.com",
  language: "es",
  version: "1.0.1",
  iconUrl: "https://www.doramasyt.com/favicon.ico",
  contentKind: "anime",
  typeFilterKey: "category",
  filters: [
    {
      name: "type",
      options: [
        { id: "dorama", label: "Dorama" },
        { id: "live-action", label: "Live Action" },
        { id: "pelicula", label: "Película" },
        { id: "serie-turcas", label: "Series Turcas" }
      ]
    },
    {
      name: "genre",
      options: [
        { id: "policial", label: "Policial" },
        { id: "romance", label: "Romance" },
        { id: "comedia", label: "Comedia" },
        { id: "escolar", label: "Escolar" },
        { id: "accion", label: "Acción" },
        { id: "thriller", label: "Thriller" },
        { id: "drama", label: "Drama" },
        { id: "misterio", label: "Misterio" },
        { id: "fantasia", label: "Fantasia" },
        { id: "historico", label: "Histórico" },
        { id: "belico", label: "Bélico" },
        { id: "militar", label: "Militar" },
        { id: "medico", label: "Médico" },
        { id: "ciencia-ficcion", label: "Ciencia Ficción" },
        { id: "sobrenatural", label: "Sobrenatural" },
        { id: "horror", label: "Horror" },
        { id: "politica", label: "Política" },
        { id: "familiar", label: "Familiar" },
        { id: "melodrama", label: "Melodrama" },
        { id: "deporte", label: "Deporte" },
        { id: "comida", label: "Comida" },
        { id: "supervivencia", label: "Supervivencia" },
        { id: "aventuras", label: "Aventuras" },
        { id: "artes-marciales", label: "Artes Marciales" },
        { id: "recuentos-de-la-vida", label: "Recuentos de la vida" },
        { id: "amistad", label: "Amistad" },
        { id: "psicologico", label: "Psicológico" },
        { id: "yuri", label: "Yuri" },
        { id: "k-drama", label: "K-Drama" },
        { id: "j-drama", label: "J-Drama" },
        { id: "c-drama", label: "C-Drama" },
        { id: "hk-drama", label: "HK-Drama" },
        { id: "tw-drama", label: "TW-Drama" },
        { id: "thai-drama", label: "Thai-Drama" },
        { id: "idols", label: "Idols" },
        { id: "suspenso", label: "Suspenso" },
        { id: "negocios", label: "Negocios" },
        { id: "time-travel", label: "Time Travel" },
        { id: "crimen", label: "Crimen" },
        { id: "yaoi", label: "Yaoi" },
        { id: "legal", label: "Legal" },
        { id: "juvenil", label: "Juvenil" },
        { id: "musical", label: "Musical" },
        { id: "reality-show", label: "Reality Show" },
        { id: "documental", label: "Documental" },
        { id: "turcas", label: "Turcas" }
      ]
    }
  ]
};

const DISABLED_SERVERS = ["filemoon","mega", "mega.nz", "mediafire", "zippyshare", "1fichier"];

function decodeHtml(text) {
  return (text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú")
    .replace(/&Aacute;/g, "Á").replace(/&Eacute;/g, "É").replace(/&Iacute;/g, "Í").replace(/&Oacute;/g, "Ó").replace(/&Uacute;/g, "Ú")
    .replace(/&ntilde;/g, "ñ").replace(/&Ntilde;/g, "Ñ")
    .replace(/&uuml;/g, "ü").replace(/&Uuml;/g, "Ü")
    .replace(/&#(\d+);/g, function (_, dec) { return String.fromCharCode(parseInt(dec, 10)); });
}

function cleanText(text) {
  return decodeHtml((text || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function normalizeUrl(url) {
  if (!url) return null;
  var value = String(url).trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^\/\//.test(value)) return "https:" + value;
  var absoluteM = value.match(/https?:\/\/[^\s"']+/i);
  if (absoluteM) return absoluteM[0];
  if (value.charAt(0) === "/") return SOURCE.baseUrl + value;
  return SOURCE.baseUrl + "/" + value.replace(/^\/+/, "");
}

function isCloudflareBlocked(html) {
  var body = (html || "").toLowerCase();
  if (!body) return false;
  return body.indexOf("cf-mitigated") !== -1 ||
    body.indexOf("cf-browser-verification") !== -1 ||
    body.indexOf("cf_chl_opt") !== -1 ||
    body.indexOf("just a moment") !== -1 && body.indexOf("<title>just a moment") !== -1 ||
    body.indexOf("checking your browser") !== -1 ||
    body.indexOf("attention required!") !== -1;
}

function assertNotCloudflare(html) {
  if (isCloudflareBlocked(html)) {
    throw new Error("Doramasyt está protegido por Cloudflare en este momento. Intenta más tarde o usa otra fuente temporalmente.");
  }
}

function getHtml(url) {
  var html = http.get(url);
  assertNotCloudflare(html);
  return html;
}

function hasNextPage(html) {
  return /rel=["']next["']/i.test(html || "");
}

function inferCatalogType(filters) {
  if (filters && filters.category === "pelicula") return "Movie";
  return "TV";
}

function inferDetailType(html) {
  var infoTypeM = html.match(/<dt>\s*Tipo:\s*<\/dt>\s*<dd>([^<]+)<\/dd>/i);
  var badges = html.match(/<span[^>]+class="[^"]*badge[^"]*text-bg-dark[^"]*"[^>]*>[^<]+<\/span>/gi) || [];
  var badgeType = "";
  for (var i = 0; i < badges.length; i++) {
    var textM = badges[i].match(/>([^<]+)</);
    var badgeText = cleanText(textM ? textM[1] : "");
    if (/^(Pelicula|Película|Dorama|Live Action|Serie(?:s)? Turcas?)$/i.test(badgeText)) {
      badgeType = badgeText;
      break;
    }
  }
  var raw = cleanText((infoTypeM && infoTypeM[1]) || badgeType || "").toLowerCase();
  if (raw.indexOf("pelicula") !== -1 || raw.indexOf("película") !== -1) return "Movie";
  return "TV";
}

function parseCards(html, filters) {
  var out = [];
  var seen = {};
  var itemType = inferCatalogType(filters);
  // Structure: <li class="...ficha_efecto"> <a href="..."> ... <img data-src="..."> ... <h3 class="...title_cap">Title</h3>
  var re = /<li[^>]+class="[^"]*ficha_efecto[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"[\s\S]*?<h3[^>]+class="[^"]*title_cap[^"]*"[^>]*>([\s\S]*?)<\/h3>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var pageUrl = normalizeUrl(m[1]);
    if (!pageUrl || seen[pageUrl]) continue;
    seen[pageUrl] = true;
    out.push({
      id: pageUrl,
      title: cleanText(m[3]),
      thumbnail: normalizeUrl(m[2]),
      type: itemType,
      pageUrl: pageUrl
    });
  }
  return out;
}

function buildFilterQuery(filters) {
  var parts = [];
  if (filters && filters.category && filters.category !== "all_category") parts.push("categoria=" + encodeURIComponent(filters.category));
  if (filters && filters.genre && filters.genre !== "all_genre") parts.push("genero=" + encodeURIComponent(filters.genre));
  if (filters && filters.year && filters.year !== "all_year") parts.push("fecha=" + encodeURIComponent(filters.year));
  if (filters && filters.letter && filters.letter !== "all_letter") parts.push("letra=" + encodeURIComponent(filters.letter));
  return parts.length ? ("?" + parts.join("&")) : "";
}

function fetchPopular(page) {
  var url = SOURCE.baseUrl + "/doramas?p=" + page;
  var html = getHtml(url);
  return { items: parseCards(html, {}), hasNextPage: hasNextPage(html) };
}

function fetchLatest(page) {
  var url = SOURCE.baseUrl + "/emision?p=" + page;
  var html = getHtml(url);
  return { items: parseCards(html, {}), hasNextPage: hasNextPage(html) };
}

function fetchSearch(query, page, filters) {
  var q = (query || "").trim();
  var url;
  if (q) {
    url = SOURCE.baseUrl + "/buscar?q=" + encodeURIComponent(q);
  } else {
    url = SOURCE.baseUrl + "/doramas" + buildFilterQuery(filters || {});
    url += (url.indexOf("?") === -1 ? "?" : "&") + "p=" + page;
  }
  var html = getHtml(url);
  return { items: parseCards(html, filters || {}), hasNextPage: hasNextPage(html) };
}

function fetchItemDetails(id) {
  var url = /^https?:\/\//i.test(id) ? id : normalizeUrl(id);
  var html = getHtml(url);

  var titleM = html.match(/<h1[^>]*class="[^"]*text-capitalize[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  var descM = html.match(/<div[^>]*class="[^"]*mb-3[^"]*"[^>]*>\s*<p>([\s\S]*?)<\/p>/i);
  var ogImageM = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
  var lazyCoverM = html.match(/<img[^>]+(?:data-src|data-lazy-src)="([^"]*\/thumbs\/imagen\/[^"]+)"[^>]*>/i);
  var coverM = ogImageM || lazyCoverM || html.match(/<img[^>]+(?:data-src|data-lazy-src|src)="([^"]+)"[^>]*>/i);

  var genres = [];
  var genreRe = /<span[^>]*>([^<]+)<\/span>/gi;
  var g;
  while ((g = genreRe.exec(html)) !== null) {
    var val = cleanText(g[1]);
    if (!val || genres.indexOf(val) !== -1) continue;
    genres.push(val);
  }

  var status = "Unknown";
  var infoTexts = [];
  var infoRe = /<[^>]+class="[^"]*ms-2[^"]*"[^>]*>([^<]+)</gi;
  var inf;
  while ((inf = infoRe.exec(html)) !== null) infoTexts.push(cleanText(inf[1]));
  for (var i = 0; i < infoTexts.length; i++) {
    var t = infoTexts[i].toLowerCase();
    if (t.indexOf("finalizado") !== -1) status = "Completed";
    if (t.indexOf("estreno") !== -1 || t.indexOf("emision") !== -1 || t.indexOf("emisión") !== -1) status = "Ongoing";
  }

  return {
    title: cleanText(titleM ? titleM[1] : ""),
    synopsis: cleanText(descM ? descM[1] : ""),
    cover: normalizeUrl(coverM ? coverM[1] : null),
    genres: genres,
    type: inferDetailType(html),
    status: status,
    related: []
  };
}


function decodeB64(str) {
  try {
    if (typeof atob === "function") return atob(str);
  } catch (e) {}
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  var out = "";
  var buffer = 0;
  var bits = 0;
  for (var i = 0; i < str.length; i++) {
    var c = chars.indexOf(str.charAt(i));
    if (c < 0) continue;
    if (c === 64) break;
    buffer = (buffer << 6) | c;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xFF);
    }
  }
  return out;
}

var AJAX_HEADERS = {
  "accept": "application/json, text/javascript, */*; q=0.01",
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
  "origin": SOURCE.baseUrl,
  "x-requested-with": "XMLHttpRequest"
};

function encodeFormBody(params) {
  return Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
  }).join("&");
}

function fetchChildren(itemId) {
  var pageUrl = /^https?:\/\//i.test(itemId) ? itemId : normalizeUrl(itemId);
  var html = getHtml(pageUrl);
  if (!html) return [];

  // Extract CSRF token
  var csrfM = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/i);
  if (!csrfM) {
    console.log("[doramasyt] fetchChildren: no CSRF token found");
    return [];
  }
  var csrf = csrfM[1];

  // Extract AJAX URL from caplist section
  var ajaxM = html.match(/class="caplist"[^>]+data-ajax="([^"]+)"/i);
  if (!ajaxM) {
    console.log("[doramasyt] fetchChildren: no data-ajax URL found");
    return [];
  }
  var ajaxUrl = ajaxM[1];
  var refHeaders = Object.assign({}, AJAX_HEADERS, { "referer": pageUrl });

  // First POST: get episode numbers + paginate_url
  var metaStr = http.post(ajaxUrl, encodeFormBody({ "_token": csrf }), refHeaders);
  if (!metaStr) return [];
  var meta;
  try { meta = JSON.parse(metaStr); } catch (e) {
    console.log("[doramasyt] fetchChildren: failed to parse meta JSON: " + e);
    return [];
  }

  var eps = meta.eps || [];
  var perpage = parseInt(meta.perpage, 10) || 50;
  var paginateUrl = meta.paginate_url;
  if (!paginateUrl || eps.length === 0) return [];

  var totalPages = Math.ceil(eps.length / perpage);
  var episodes = [];

  for (var p = 1; p <= totalPages; p++) {
    var pageStr = http.post(paginateUrl, encodeFormBody({ "_token": csrf, "p": String(p) }), refHeaders);
    if (!pageStr) continue;
    var pageData;
    try { pageData = JSON.parse(pageStr); } catch (e) {
      console.log("[doramasyt] fetchChildren: failed to parse page " + p + " JSON: " + e);
      continue;
    }
    var caps = pageData.caps || [];
    for (var i = 0; i < caps.length; i++) {
      var cap = caps[i];
      var epUrl = normalizeUrl(cap.url);
      if (!epUrl) continue;
      var num = parseFloat(cap.episodio);
      episodes.push({ id: epUrl, number: num, title: "Capítulo " + num, pageUrl: epUrl });
    }
  }

  episodes.sort(function (a, b) { return a.number - b.number; });
  return episodes;
}

function extractServerLabel(url) {
  var lower = (url || "").toLowerCase();
  if (lower.indexOf("voe") !== -1) return "Voe";
  if (lower.indexOf("streamwish") !== -1 || lower.indexOf("wishembed") !== -1) return "StreamWish";
  if (lower.indexOf("ok.ru") !== -1 || lower.indexOf("okru") !== -1) return "Okru";
  if (lower.indexOf("uqload") !== -1) return "Uqload";
  if (lower.indexOf("filemoon") !== -1 || lower.indexOf("moonplayer") !== -1) return "Filemoon";
  if (lower.indexOf("mixdrop") !== -1) return "MixDrop";
  if (lower.indexOf("dood") !== -1) return "DoodStream";
  if (lower.indexOf("streamtape") !== -1 || lower.indexOf("stape") !== -1) return "StreamTape";
  if (lower.indexOf("filelions") !== -1) return "FileLions";
  return "Player";
}

function normalizeServerLabel(label) {
  var text = cleanText(label || "");
  if (!text) return "Player";
  var lower = text.toLowerCase();
  if (lower === "mxdrop") return "MixDrop";
  if (lower === "lulu") return "Lulu";
  if (lower === "voe") return "Voe";
  if (lower === "mp4upload") return "Mp4Upload";
  if (lower === "filemoon") return "Filemoon";
  if (lower === "doodstream") return "DoodStream";
  if (lower === "streamtape") return "StreamTape";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function extractIframeSrc(html) {
  if (!html) return null;
  var iframeM = html.match(/<iframe[^>]+src="([^"]+)"/i);
  return normalizeUrl(iframeM ? iframeM[1] : null);
}

function extractPlayerButtons(html) {
  var buttons = [];
  var re = /<button[^>]+class="[^"]*play-video[^"]*"[^>]+data-player="([^"]+)"([^>]*)>([^<]+)<\/button>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var attrs = m[2] || "";
    var usaApiM = attrs.match(/data-usa-api="([^"]+)"/i);
    buttons.push({
      dataPlayer: m[1],
      usaApi: usaApiM ? usaApiM[1] : "1",
      label: cleanText(m[3])
    });
  }
  return buttons;
}

function fetchVideoList(episodeId) {
  var url = /^https?:\/\//i.test(episodeId) ? episodeId : normalizeUrl(episodeId);
  var html = getHtml(url);
  if (!html) return [];

  var out = [];
  var seen = {};
  var playerKeyM = html.match(/<div[^>]+class="player"[^>]+data-key="([^"]+)"/i);
  var playerKey = normalizeUrl(playerKeyM ? playerKeyM[1] : null);
  var buttons = extractPlayerButtons(html);

  for (var i = 0; i < buttons.length; i++) {
    var button = buttons[i];
    var serverName = normalizeServerLabel(button.label);
    if (DISABLED_SERVERS.some(function (s) { return button.label.toLowerCase().indexOf(s) !== -1; })) continue;

    var resolved = null;
    if (button.usaApi === "1" && playerKey) {
      var playerUrl = playerKey + button.dataPlayer + "&player=" + encodeURIComponent(button.label);
      var playerHtml = getHtml(playerUrl);
      resolved = extractIframeSrc(playerHtml) || playerUrl;
    } else {
      resolved = normalizeUrl(button.dataPlayer);
    }

    if (!resolved || /embed-undef\.html/i.test(resolved)) continue;
    if (!resolved || seen[resolved]) continue;
    seen[resolved] = true;

    if (/\.m3u8(\?|$)|\.mp4(\?|$)/i.test(resolved)) {
      out.push({
        url: resolved,
        quality: "Auto",
        server: serverName,
        headers: { "Referer": url }
      });
    } else {
      out.push({
        embed: resolved,
        server: serverName,
        quality: "Embed"
      });
    }
  }

  if (out.length > 0) {
    return out;
  }

  var playerRe = /data-player="([^"]+)"/gi;
  var m;
  while ((m = playerRe.exec(html)) !== null) {
    var encoded = m[1];
    var decoded = decodeB64(encoded || "").trim();
    if (!decoded || seen[decoded]) continue;
    seen[decoded] = true;

    var label = extractServerLabel(decoded);
    var disabled = DISABLED_SERVERS.some(function (s) { return decoded.toLowerCase().indexOf(s) !== -1; });
    if (disabled) continue;

    if (/\.m3u8(\?|$)|\.mp4(\?|$)/i.test(decoded)) {
      out.push({
        url: decoded,
        quality: "Auto",
        server: label,
        headers: { "Referer": url }
      });
    } else {
      out.push({
        embed: decoded,
        server: label,
        quality: "Embed"
      });
    }
  }
  return out;
}

function fetchEpisodeList(itemId) {
  return fetchChildren(itemId);
}
