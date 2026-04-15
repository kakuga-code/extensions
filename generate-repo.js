#!/usr/bin/env node
// generate-repo.js — Genera repo.json automáticamente desde los scripts

const fs = require("fs");
const path = require("path");

const GITHUB_RAW = "https://raw.githubusercontent.com/kakuga-code/extensions/main";
const REPO_META = {
  id: "kakuga-code-extensions",
  name: "Kakuga Code Extensions",
  url: "https://raw.githubusercontent.com/kakuga-code/extensions/main/repo.json",
  description: "Repositorio JSON para Kazemi generado a partir de kakuga-code/extensions.",
  iconUrl: "https://github.com/kakuga-code.png"
};

function extractMeta(content) {
  const idMatch     = content.match(/\bid\s*:\s*["']([^"']+)["']/);
  const nameMatch   = content.match(/\bname\s*:\s*["']([^"']+)["']/);
  const versionMatch= content.match(/\bversion\s*:\s*["']([^"']+)["']/);
  const langMatch   = content.match(/\blanguage\s*:\s*["']([^"']+)["']/);

  return {
    id:       idMatch      ? idMatch[1]      : null,
    name:     nameMatch    ? nameMatch[1]    : null,
    version:  versionMatch ? versionMatch[1] : "1.0.0",
    language: langMatch    ? langMatch[1]    : null
  };
}

function collectScripts(dir, relativePath) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const walk = (current, rel) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      const relPath  = path.join(rel, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.name.endsWith(".js")) {
        const content = fs.readFileSync(fullPath, "utf8");
        const meta    = extractMeta(content);
        if (meta.id && meta.name) {
          results.push({ meta, relPath });
        }
      }
    }
  };

  walk(dir, relativePath);
  return results;
}

const root = __dirname;

// Sources
const sourceFiles = collectScripts(
  path.join(root, "scripts", "sources"),
  "scripts/sources"
);
const sources = sourceFiles.map(({ meta, relPath }) => {
  const entry = {
    id:        meta.id,
    name:      meta.name,
    scriptUrl: `${GITHUB_RAW}/${relPath.replace(/\\/g, "/")}`,
    version:   meta.version
  };
  if (meta.language) entry.language = meta.language;
  return entry;
});

// Extractors
const extractorFiles = collectScripts(
  path.join(root, "scripts", "extractors"),
  "scripts/extractors"
);
const extractors = extractorFiles.map(({ meta, relPath }) => ({
  id:        meta.id,
  name:      meta.name,
  scriptUrl: `${GITHUB_RAW}/${relPath.replace(/\\/g, "/")}`,
  version:   meta.version
}));

const repo = { ...REPO_META, sources, extractors };

fs.writeFileSync(
  path.join(root, "repo.json"),
  JSON.stringify(repo),
  "utf8"
);

console.log(`repo.json generado: ${sources.length} sources, ${extractors.length} extractors`);
