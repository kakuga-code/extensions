// Megaup / AnimeKai Extractor — Kazemi JS
// Handles: https://anikai.to/iframe/<TOKEN>  and  https://megaup.nl/e/<ID>
//
// Key insight: when JS is disabled in a browser, anikai's iframe HTML exposes
// the real megaup video URL in plain text (noscript / source element).
// We try to read that HTML to get the megaup ID, then fetch the media JSON.
// =========================================================

const EXTRACTOR = {
  id: "megaup",
  name: "Megaup",
  version: "1.2.8",
  domains: ["anikai.to", "megaup.nl", "megaup.cc", "megaup.live"],
  aliases: ["animekai", "megaup"]
};

var STREAM_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

function parseJsonLoose(text) {
  if (!text) return null;
  var s = ("" + text).trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch (_) { }
  var start = s.indexOf("{"); var end = s.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(s.substring(start, end + 1)); } catch (_) { }
  }
  return null;
}

function normalizeSubtitleTracks(value) {
  var raw = [];
  if (!value) return raw;
  if (Array.isArray(value)) raw = value;
  else if (Array.isArray(value.tracks)) raw = value.tracks;
  else if (Array.isArray(value.subtitles)) raw = value.subtitles;
  else if (Array.isArray(value.captions)) raw = value.captions;

  var out = [];
  var seen = {};
  for (var i = 0; i < raw.length; i++) {
    var t = raw[i] || {};
    var kind = (t.kind || t.type || "").toString().toLowerCase();
    if (kind && kind !== "captions" && kind !== "subtitles" && kind !== "subtitle" && kind !== "vtt") continue;

    var url = t.url || t.file || t.src || t.link;
    if (!url || typeof url !== "string") continue;
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen[url]) continue;
    seen[url] = true;

    var label = (t.label || t.name || t.lang || t.language || "Subtitle").toString();
    var language = (t.language || t.lang || t.srclang || label || "und").toString().toLowerCase();
    out.push({
      url: url,
      language: language.substring(0, 12) || "und",
      label: label,
      isDefault: t.default === true || t.isDefault === true
    });
    if (out.length >= 20) break;
  }
  return out;
}

function decMegaPayload(encrypted) {
  if (!encrypted) return null;
  var body = JSON.stringify({ text: encrypted, agent: STREAM_UA });
  var hdrs = { "Content-Type": "application/json" };
  var lastErr = "";
  for (var attempt = 0; attempt < 3; attempt++) {
    var resp = http.post("https://enc-dec.app/api/dec-mega", body, hdrs);
    var s = resp ? ("" + resp).trim() : "";
    if (s.length < 2) {
      lastErr = "empty";
      continue;
    }
    var dj = parseJsonLoose(s);
    if (!dj) {
      lastErr = "parse";
      continue;
    }
    var result = dj.result;
    if (typeof result === "string") result = parseJsonLoose(result) || result;
    var sources = result && result.sources;
    if (sources && sources[0] && sources[0].file) {
      return {
        url: sources[0].file,
        subtitles: normalizeSubtitleTracks(result)
      };
    }
    lastErr = "no-sources";
  }
  console.log("[megaup-ext] decMega failed after retries: " + lastErr);
  return null;
}

function decMega(encrypted) {
  var payload = decMegaPayload(encrypted);
  return payload ? payload.url : null;
}

function playbackResult(url, referer, subtitles) {
  var origin = "";
  var originM = (referer || "").match(/^(https?:\/\/[^\/]+)/i);
  if (originM) origin = originM[1];
  var out = {
    url: url,
    quality: "Multi-Quality (m3u8)",
    headers: {
      "Referer": referer,
      "User-Agent": STREAM_UA
    }
  };
  if (origin) out.headers["Origin"] = origin;
  if (subtitles && subtitles.length > 0) out.subtitles = subtitles;
  return out;
}

function isPlausibleMegaupId(id) {
  if (!id) return false;
  var s = "" + id;
  var lower = s.toLowerCase();
  if (s.length < 12 || s.length > 80) return false;
  if (lower.indexOf("cf-") === 0 || lower.indexOf("error") !== -1) return false;
  if (
    lower === "player-container" ||
    lower === "player_container" ||
    lower === "video-player" ||
    lower === "media-player" ||
    lower === "embed-player"
  ) return false;
  if (lower.indexOf("container") !== -1 || lower.indexOf("wrapper") !== -1) return false;
  return /^[A-Za-z0-9_-]+$/.test(s);
}

// Fetch the embed page HTML and extract the real video URL or media token
function streamFromEmbedPage(embedUrl) {
  var html = http.get(embedUrl, {
    "Referer": "https://anikai.to/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "User-Agent": STREAM_UA
  });
  console.log("[megaup-ext] embed html len=" + (html ? html.length : 0));
  if (!html || html.length < 50) return null;

  // Cloudflare / error pages — avoid bogus media ids like "cf-error-details"
  var hl = html.toLowerCase();
  if (hl.indexOf("cf-error-details") !== -1 || (hl.indexOf("cloudflare") !== -1 && hl.indexOf("ray id") !== -1)) {
    console.log("[megaup-ext] embed looks like CF/error page, skipping parse");
    return null;
  }

  // Direct m3u8 in page
  var m3u8M = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/);
  if (m3u8M) {
    console.log("[megaup-ext] found m3u8 in embed html");
    return { url: m3u8M[1], referer: embedUrl };
  }

  // sources array in JS
  var srcM = html.match(/sources\s*[=:]\s*(\[[\s\S]*?\])/);
  if (srcM) {
    try {
      var arr = JSON.parse(srcM[1]);
      if (arr && arr[0] && arr[0].file) {
        console.log("[megaup-ext] found sources in embed html");
        return { url: arr[0].file, referer: embedUrl };
      }
    } catch (_) {}
  }

  var origin = embedUrl.match(/^(https?:\/\/[^\/]+)/);
  origin = origin ? origin[1] : "";

  // First try the canonical ID from /e/<id>. The embed markup often contains
  // generic DOM ids like "player-container", which are not media ids.
  var pathId = embedUrl.match(/\/e\/([A-Za-z0-9_\-]+)/);
  if (pathId && isPlausibleMegaupId(pathId[1])) {
    console.log("[megaup-ext] trying path id=" + pathId[1].substring(0, 30));
    var hosts = [origin];
    if (origin.indexOf("megaup.nl") === -1) hosts.push("https://megaup.nl");
    if (origin.indexOf("megaup.live") === -1) hosts.push("https://megaup.live");
    if (origin.indexOf("megaup.cc") === -1) hosts.push("https://megaup.cc");
    for (var i = 0; i < hosts.length; i++) {
      var mUrl = hosts[i] + "/media/" + pathId[1];
      var mResp = http.get(mUrl, {
        "Referer": embedUrl,
        "Origin": hosts[i],
        "Accept": "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": STREAM_UA
      });
      console.log("[megaup-ext] path media[" + i + "] len=" + (mResp ? mResp.length : 0) + " preview=" + (mResp ? mResp.substring(0, 80) : ""));
      var fj = parseJsonLoose(mResp);
      if (fj && typeof fj.result === "string" && fj.result.length > 10) {
        var fp = decMegaPayload(fj.result);
        if (fp && fp.url) return { url: fp.url, referer: hosts[i] + "/", subtitles: fp.subtitles };
      }
    }
  }

  // Look for explicit media token/id in the page.
  var mediaIdM = html.match(/\/media\/([A-Za-z0-9_\-]+)/);
  if (!mediaIdM) mediaIdM = html.match(/(?:mediaId|data-id|video-id)\s*[=:]\s*["']([A-Za-z0-9_\-]+)["']/);

  if (mediaIdM) {
    var mid = mediaIdM[1];
    if (!isPlausibleMegaupId(mid)) {
      console.log("[megaup-ext] skipping suspicious mediaId=" + (mid || ""));
      mediaIdM = null;
    }
  }

  if (mediaIdM) {
    console.log("[megaup-ext] found mediaId in embed=" + mediaIdM[1].substring(0, 30));
    var mediaUrl = origin + "/media/" + mediaIdM[1];
    var resp = http.get(mediaUrl, {
      "Referer": embedUrl,
      "Origin": origin,
      "Accept": "application/json, text/plain, */*",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": STREAM_UA
    });
    console.log("[megaup-ext] media resp len=" + (resp ? resp.length : 0) + " preview=" + (resp ? resp.substring(0, 80) : ""));
    var mj = parseJsonLoose(resp);
    if (mj && typeof mj.result === "string" && mj.result.length > 10) {
      var mp = decMegaPayload(mj.result);
      if (mp && mp.url) return { url: mp.url, referer: origin + "/", subtitles: mp.subtitles };
    }
  }

  // Log fragment of HTML for debugging
  console.log("[megaup-ext] embed html preview=" + html.substring(0, 300));
  return null;
}

// Legacy direct API call (kept as last resort)
function streamFromMegaupId(videoId, preferredHost) {
  var hosts = ["megaup.nl", "megaup.live", "megaup.cc"];
  if (preferredHost) {
    hosts = [preferredHost].concat(hosts.filter(function(h) { return h !== preferredHost; }));
  }
  for (var i = 0; i < hosts.length; i++) {
    var host = hosts[i];
    var embedRef = "https://" + host + "/e/" + videoId;
    var mediaUrl = "https://" + host + "/media/" + videoId;
    var resp = http.get(mediaUrl, {
      "Referer": embedRef,
      "Origin": "https://" + host,
      "Accept": "application/json, text/plain, */*",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": STREAM_UA
    });
    console.log("[megaup-ext] direct media[" + i + "] id=" + videoId + " host=" + host + " len=" + (resp ? resp.length : 0) + " preview=" + (resp ? resp.substring(0, 80) : ""));
    var mj = parseJsonLoose(resp);
    if (!mj || typeof mj.result !== "string" || mj.result.length < 10) continue;
    var payload = decMegaPayload(mj.result);
    if (payload && payload.url) return { url: payload.url, referer: "https://" + host + "/", subtitles: payload.subtitles };
  }
  return null;
}

function extractVideos(url) {
  console.log("[megaup-ext] url=" + url.substring(0, 80));

  // ── Case A: direct megaup URL ────────────────────────────────────────
  if (url.indexOf("megaup.") !== -1) {
    // Strategy 1: fetch embed page and extract stream
    var rEmbed = streamFromEmbedPage(url);
    if (rEmbed) return [playbackResult(rEmbed.url, rEmbed.referer, rEmbed.subtitles)];

    // Strategy 2: direct API (legacy fallback)
    var idM = url.match(/\/e\/([A-Za-z0-9_\-]+)/);
    if (idM) {
      var hostM = url.match(/megaup\.([a-z]+)/);
      var preferHost = hostM ? "megaup." + hostM[1] : null;
      var r = streamFromMegaupId(idM[1], preferHost);
      if (r) return [playbackResult(r.url, r.referer, r.subtitles)];
    }
    return [];
  }

  // ── Case B: anikai.to/iframe/TOKEN ──────────────────────────────────
  var token = url.replace(/^.*\/iframe\//, "").split("?")[0].split("#")[0];

  // ── Strategy 1: fetch iframe page directly ──────────────────────────
  var rIframe = streamFromEmbedPage(url);
  if (rIframe) return [playbackResult(rIframe.url, rIframe.referer, rIframe.subtitles)];

  // ── Strategy 2: dec-kai the iframe token ─────────────────────────────
  var decResp = http.post(
    "https://enc-dec.app/api/dec-kai",
    JSON.stringify({ text: token }),
    { "Content-Type": "application/json" }
  );
  console.log("[megaup-ext] dec-kai resp=" + (decResp ? decResp.substring(0, 120) : "null"));
  var dj = parseJsonLoose(decResp);
  if (dj && dj.status === 200) {
    var innerResult = dj.result;
    if (typeof innerResult === "string") {
      innerResult = parseJsonLoose(innerResult) || { url: innerResult };
    }
    
    // Check for direct sources array
    var innerSubtitles = normalizeSubtitleTracks(innerResult);
    if (innerResult && innerResult.sources && innerResult.sources[0] && innerResult.sources[0].file) {
      return [playbackResult(innerResult.sources[0].file, "https://anikai.to/", innerSubtitles)];
    }

    var innerUrl = (typeof innerResult === "string" ? innerResult : (innerResult.url || innerResult.link)) || "";
    if (innerUrl) {
      if (innerUrl.match(/\.m3u8/)) return [playbackResult(innerUrl, "https://anikai.to/", innerSubtitles)];
      var megaId = innerUrl.match(/megaup\.(?:nl|cc|live)\/e\/([A-Za-z0-9_\-]+)/);
      if (megaId) {
        var r2 = streamFromMegaupId(megaId[1]);
        if (r2) return [playbackResult(r2.url, r2.referer, r2.subtitles && r2.subtitles.length ? r2.subtitles : innerSubtitles)];
      }
      if (innerUrl.indexOf("anikai.to/iframe/") !== -1) return extractVideos(innerUrl);
    }
  }

  // ── Strategy 3: /media/ endpoint on anikai (deprecated fallback) ────
  var mediaUrl = url.replace("/iframe/", "/media/").replace("/e/", "/media/");
  var mediaResp = http.get(mediaUrl, { "Referer": "https://anikai.to/", "User-Agent": STREAM_UA });
  var mj = parseJsonLoose(mediaResp);
  if (mj && typeof mj.result === "string" && mj.result.length > 10) {
    var mp = decMegaPayload(mj.result);
    if (mp && mp.url) return [playbackResult(mp.url, "https://anikai.to/", mp.subtitles)];
  }

  // ── Strategy 4: links/view fallback ────────────────────────────────
  var encResp = http.get("https://enc-dec.app/api/enc-kai?text=" + encodeURIComponent(token), { "Referer": "https://anikai.to/" });
  var encJ = parseJsonLoose(encResp);
  if (encJ && encJ.result) {
    var viewResp = http.get(
      "https://anikai.to/ajax/links/view?id=" + encodeURIComponent(token) + "&_=" + encodeURIComponent(encJ.result),
      { "Referer": "https://anikai.to/", "X-Requested-With": "XMLHttpRequest", "User-Agent": STREAM_UA }
    );
    var vj = parseJsonLoose(viewResp);
    if (vj && typeof vj.result === "string" && vj.result.length > 10) {
      var dc2 = http.post("https://enc-dec.app/api/dec-kai", JSON.stringify({ text: vj.result }), { "Content-Type": "application/json" });
      var dcj2 = parseJsonLoose(dc2);
      if (dcj2 && dcj2.status === 200) {
        var inner2 = typeof dcj2.result === "string" ? parseJsonLoose(dcj2.result) : dcj2.result;
        var url2 = inner2 && (inner2.url || inner2.link);
        if (url2 && url2.indexOf("megaup") !== -1) {
          var id2 = url2.match(/\/e\/([A-Za-z0-9_\-]+)/);
          if (id2) {
            var r3 = streamFromMegaupId(id2[1]);
            var inner2Subtitles = normalizeSubtitleTracks(inner2);
            if (r3) return [playbackResult(r3.url, r3.referer, r3.subtitles && r3.subtitles.length ? r3.subtitles : inner2Subtitles)];
          }
        }
      }
    }
  }

  // ── Strategy 5: iframe HTML (Last Resort) ──────────────────────────
  var htmlLast = http.get(url, { "Referer": "https://anikai.to/", "User-Agent": STREAM_UA, "Accept": "text/html,*/*;q=0.8" });
  if (htmlLast && htmlLast.length > 100) {
    var m3u8Direct = htmlLast.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/);
    if (m3u8Direct) return [{ url: m3u8Direct[1], quality: "Multi-Quality (m3u8)", headers: { "Referer": "https://anikai.to/" } }];
    var megaM = htmlLast.match(/megaup\.(?:nl|cc|live)\/e\/([A-Za-z0-9_\-]+)/);
    if (megaM) {
      var r4 = streamFromMegaupId(megaM[1]);
      if (r4) return [{ url: r4.url, quality: "Multi-Quality (m3u8)", headers: { "Referer": r4.referer } }];
    }
  }

  console.log("[megaup-ext] all strategies failed");
  return [];
}
