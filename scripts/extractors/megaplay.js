// MegaPlay Extractor — Kazemi JS
// Covers megaplay.buzz and vidwish.live (VidHost/Vidcloud)
// API: GET /stream/getSources?id={cid} → {sources:{file:m3u8}, tracks:[...]}
// =========================================================

const EXTRACTOR = {
  id: "megaplay",
  name: "MegaPlay",
  version: "1.0.1",
  aliases: ["megaplay", "vidhost", "vidcloud", "vidwish"],
  domains: [
    "megaplay.buzz",
    "megaplay.icu",
    "vidwish.live",
    "player.hianime.dk"
  ]
};

// ── Helpers ───────────────────────────────────────────────

// MegaPlay / Vidwish embeds: el cid en la URL (/stream/s-2/12345/sub) es la fuente de verdad.
// El HTML del player suele ser un SPA sin `settings` en línea — antes solo se leía `const settings`.
function extractCidFromStreamUrl(pageUrl) {
  if (!pageUrl) return null;
  var m = String(pageUrl).match(/\/stream\/s-\d+\/([^\/\?]+)/i);
  return m ? m[1] : null;
}

function getSettings(html, host) {
  var m = html.match(/(?:const|var|let|window)\.?\s*settings\s*=\s*\{([\s\S]*?)\};/i);
  if (!m) return null;
  var block = m[1];

  function pick(key) {
    var r = block.match(new RegExp(key + "\\s*[=:]\\s*['\"]([^'\"]*)['\"]"));
    return r ? r[1] : null;
  }

  return {
    cid: pick("cid"),
    cidu: pick("cidu"),
    baseUrl: pick("base_url") || pick("baseUrl") || ("https://" + host + "/"),
    domain2: pick("domain2_url")
  };
}

function resolvePlayerPage(url) {
  // player.hianime.dk → megaplay.buzz (same API but needs redirect follow)
  // e.g. https://player.hianime.dk/stream/s-2/107257/sub
  // may redirect to megaplay.buzz or vidwish.live
  var html = http.get(url, {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    "Referer": "https://hianime.dk/"
  });
  if (!html || html.length < 100) return null;

  // Find the server link buttons to get the actual player domains
  var serverLinks = [];
  var sre = /href="(https?:\/\/[^"]+\/stream\/[^"]+)"/gi;
  var sm;
  while ((sm = sre.exec(html)) !== null) {
    serverLinks.push(sm[1]);
  }

  // Return the player HTML along with found server URLs
  return { html: html, serverLinks: serverLinks };
}

// ── Main extractor ─────────────────────────────────────────

function extractVideos(url) {
  var ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
  var hostM = url.match(/^https?:\/\/([^\/]+)/);
  var host = hostM ? hostM[1] : "";

  // For player.hianime.dk - load the page, get server links, process each
  if (host.indexOf("player.hianime.dk") !== -1) {
    var pageData = resolvePlayerPage(url);
    if (!pageData) {
      console.log("[megaplay] No se pudo cargar la página del player: " + url);
      return [];
    }
    var out = [];
    // Process the page itself (may be megaplay.buzz or vidwish.live served through the domain)
    var selfResult = extractFromPage(pageData.html, host, url);
    for (var i = 0; i < selfResult.length; i++) out.push(selfResult[i]);

    // Also process any server links found
    for (var s = 0; s < pageData.serverLinks.length; s++) {
      var sUrl = pageData.serverLinks[s];
      if (sUrl === url) continue;
      var sHostM = sUrl.match(/^https?:\/\/([^\/]+)/);
      var sHost = sHostM ? sHostM[1] : "";
      var sHtml = http.get(sUrl, {
        "User-Agent": ua,
        "Referer": "https://hianime.dk/"
      });
      if (sHtml && sHtml.length > 100) {
        var sResult = extractFromPage(sHtml, sHost, sUrl);
        for (var k = 0; k < sResult.length; k++) out.push(sResult[k]);
      }
    }
    console.log("[megaplay] player.hianime.dk total: " + out.length);
    return out;
  }

  // Direct megaplay.buzz or vidwish.live URL
  var html = http.get(url, {
    "User-Agent": ua,
    "Referer": "https://hianime.dk/"
  });
  if (!html || html.length < 100) {
    console.log("[megaplay] HTML vacío para: " + url);
    return [];
  }
  return extractFromPage(html, host, url);
}

function extractFromPage(html, host, pageUrl) {
  var cidFromUrl = extractCidFromStreamUrl(pageUrl);
  var settings = getSettings(html, host);
  var cid = cidFromUrl;
  if (!cid && settings && settings.cid) {
    cid = settings.cid;
  }
  if (settings && settings.cid && cidFromUrl && settings.cid !== cidFromUrl) {
    console.log("[megaplay] cid HTML (" + settings.cid + ") != URL (" + cidFromUrl + "), usando URL");
    cid = cidFromUrl;
  }
  if (!cid) {
    console.log("[megaplay] No se pudo determinar cid (URL ni settings) host=" + host);
    return [];
  }

  var baseUrl = (settings && settings.baseUrl) ? settings.baseUrl : null;
  if (!baseUrl) {
    if (host.indexOf("player.hianime.dk") !== -1) {
      baseUrl = "https://megaplay.buzz/";
    } else {
      baseUrl = "https://" + host + "/";
    }
  }
  var apiUrl = baseUrl.replace(/\/$/, "") + "/stream/getSources?id=" + encodeURIComponent(cid);

  console.log("[megaplay] API: " + apiUrl);

  var resp = http.get(apiUrl, {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    "Referer": pageUrl,
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json, */*"
  });

  if (!resp || resp.trim().charAt(0) !== '{') {
    console.log("[megaplay] Respuesta no JSON de getSources");
    return [];
  }

  var data;
  try {
    data = JSON.parse(resp);
  } catch (e) {
    console.log("[megaplay] JSON parse error: " + e);
    return [];
  }

  var m3u8 = null;
  if (data.sources) {
    m3u8 = data.sources.file || data.sources.url || null;
  } else if (data.file) {
    m3u8 = data.file;
  }

  if (!m3u8) {
    console.log("[megaplay] No se encontró m3u8 en respuesta");
    return [];
  }

  // Parse subtitle tracks
  var subtitles = [];
  var tracks = data.tracks || [];
  for (var t = 0; t < tracks.length; t++) {
    var track = tracks[t];
    if (!track.file) continue;
    var kind = (track.kind || "").toLowerCase();
    if (kind !== "captions" && kind !== "subtitles" && kind !== "") continue;
    subtitles.push({
      url: track.file,
      label: track.label || ("Track " + (t + 1)),
      isDefault: track["default"] === true || track["default"] === "true"
    });
  }

  console.log("[megaplay] m3u8=" + m3u8 + " subs=" + subtitles.length);

  return [{
    url: m3u8,
    quality: "HLS",
    headers: {
      "Referer": baseUrl,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
    },
    subtitles: subtitles
  }];
}
