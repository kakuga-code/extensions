// kwik — Kazemi JS Extractor
// =========================================================

const EXTRACTOR = {
  id: "kwik",
  name: "Kwik",
  version: "1.0.0",
  domains: ["kwik.cx", "kwik.si"],
  aliases: ["kwik"]
};

// ── Packed JS unpacker (same as animepahe) ─────────────────

class Unbaser {
  constructor(base) {
    this.ALPHABET = {
      62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
      95: "' !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'"
    };
    this.dictionary = {};
    this.base = base;
    if (36 < base && base < 62) {
      this.ALPHABET[base] = this.ALPHABET[base] || this.ALPHABET[62].substr(0, base);
    }
    if (2 <= base && base <= 36) {
      this.unbase = function(v) { return parseInt(v, base); };
    } else {
      var alphabet = this.ALPHABET[base];
      if (!alphabet) throw Error("Unsupported base encoding.");
      for (var i = 0; i < alphabet.length; i++) this.dictionary[alphabet[i]] = i;
      this.unbase = this._dictunbaser.bind(this);
    }
  }

  _dictunbaser(value) {
    var ret = 0;
    var chars = String(value).split("").reverse();
    for (var i = 0; i < chars.length; i++) {
      ret += Math.pow(this.base, i) * (this.dictionary[chars[i]] || 0);
    }
    return ret;
  }
}

function unpack(source) {
  function filterArgs(src) {
    var juicers = [
      /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\), *(\d+), *(.*)\)\)/,
      /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\)/
    ];
    for (var i = 0; i < juicers.length; i++) {
      var args = juicers[i].exec(src);
      if (!args) continue;
      return {
        payload: args[1],
        radix: parseInt(args[2], 10),
        count: parseInt(args[3], 10),
        symtab: args[4].split("|")
      };
    }
    throw Error("Could not parse p.a.c.k.e.r input");
  }

  var p = filterArgs(source);
  if (p.count !== p.symtab.length) throw Error("Malformed p.a.c.k.e.r symtab");
  var unbase = new Unbaser(p.radix);

  function lookup(word) {
    var value = p.radix === 1 ? p.symtab[parseInt(word, 10)] : p.symtab[unbase.unbase(word)];
    return value || word;
  }

  return p.payload.replace(/\b\w+\b/g, lookup);
}

// ── Helpers ────────────────────────────────────────────────

function unescapeJsString(s) {
  if (!s) return "";
  return String(s)
    .replace(/\\\//g, "/")
    .replace(/\\x3A/gi, ":")
    .replace(/\\x2F/gi, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\\/g, "\\");
}

function normalizeKwikHls(url) {
  if (!url) return url;
  var u = String(url);
  u = u.replace("/stream/", "/hls/");
  u = u.replace("uwu.m3u8", "owo.m3u8");
  return u;
}

// ── Extract ────────────────────────────────────────────────

function extractVideos(url) {
  try {
    var html = http.get(url, {
      "Referer": "https://animepahe.pw/",
      "User-Agent": "Mozilla/5.0"
    });
    if (!html) return [];

    // Kwik packs the player code in a double-eval script
    var scriptBody = "";
    var scriptMatch = html.match(/<script>eval\(function\(p,a,c,k,e,d\)[\s\S]*?<\/script>/i);
    if (scriptMatch) {
      scriptBody = scriptMatch[0].replace(/<\/?script>/g, "");
    }
    if (!scriptBody) return [];

    var unpacked = null;
    // Double-packed: eval(packed_cookie_helper);eval(packed_player)
    if (scriptBody.indexOf("));eval(") !== -1) {
      var parts = scriptBody.split("));eval(");
      if (parts.length === 2) {
        var layer2 = "eval(function" + parts[1];
        // Remove trailing ')' from the outer eval
        if (layer2.lastIndexOf(")") === layer2.length - 1) {
          layer2 = layer2.substring(0, layer2.length - 1);
        }
        unpacked = unpack(layer2);
      }
    } else if (scriptBody.indexOf("eval(function(p,a,c,k,e,d)") !== -1) {
      unpacked = unpack(scriptBody);
    } else {
      unpacked = scriptBody;
    }
    if (!unpacked) return [];

    var m =
      unpacked.match(/const\s+source\s*=\s*\\?['"]([^'"]+)['"]/i) ||
      unpacked.match(/source\s*:\s*\\?['"]([^'"]+\.m3u8[^'"]*)['"]/i) ||
      unpacked.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"]*/i);
    if (!m) return [];

    var raw = m[1] || m[0] || "";
    if (!raw) return [];
    raw = unescapeJsString(raw).replace(/\\+$/, "");
    var hlsUrl = normalizeKwikHls(raw);
    if (!hlsUrl) return [];

    return [{
      url: hlsUrl,
      quality: "Auto",
      headers: {
        "Referer": "https://kwik.cx/",
        "Origin": "https://kwik.cx"
      }
    }];
  } catch (e) {
    console.log("[kwik] extract error: " + e);
    return [];
  }
}
