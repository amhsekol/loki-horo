#!/usr/bin/env node
// ---------------------------------------------------------------------------
// bundle-rules.mjs — build-time script.
//
// Reads the lagna-bucket JSONL files produced by the rules_ingest pipeline
// (one JSON object per line) and bundles them into a single JSON file that
// ships with the app (shared/astro/rules.bundled.json). This means the
// composer never needs filesystem access at runtime — it just imports the
// JSON, exactly like guruji-rules.ts does with guruji-rules.seed.json.
//
// Usage:
//   node scripts/bundle-rules.mjs
//   node scripts/bundle-rules.mjs --src /custom/path/lagna_buckets --out shared/astro/rules.bundled.json
//
// Source of truth for input: /home/user/workspace/rules_ingest/out/lagna_buckets/*.jsonl
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, ".."); // tamil-astro/

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--src") out.src = argv[++i];
    else if (argv[i] === "--out") out.out = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

const DEFAULT_SRC = "/home/user/workspace/rules_ingest/out/lagna_buckets";
const SRC_DIR = args.src ?? DEFAULT_SRC;
const OUT_FILE = args.out ?? join(REPO_ROOT, "shared/astro/rules.bundled.json");

// Lagna bucket filename -> canonical English sign name (matches RASIS[i].en
// in shared/astro/constants.ts, lower-cased, transliteration only).
const LAGNA_FILE_TO_SIGN = {
  mesha: "mesha",
  rishaba: "rishaba",
  mithuna: "mithuna",
  kataka: "kataka",
  simha: "simha",
  kanni: "kanni",
  thula: "thula",
  vrischika: "vrischika", // note: file uses "vrischika"; RASIS uses "Viruchiga" — normalized in rule-loader
  dhanu: "dhanu",
  makara: "makara",
  kumbha: "kumbha",
  meena: "meena",
};

const SPECIAL_FILES = new Set(["_overrides", "_exceptions"]);

function readJsonlFile(path) {
  const raw = readFileSync(path, "utf-8");
  const lines = raw.split("\n");
  const records = [];
  let lineNo = 0;
  for (const line of lines) {
    lineNo++;
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch (err) {
      console.error(`[bundle-rules] JSON parse error in ${basename(path)}:${lineNo}: ${err.message}`);
    }
  }
  return records;
}

function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`[bundle-rules] Source directory not found: ${SRC_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(SRC_DIR).filter((f) => f.endsWith(".jsonl"));
  if (files.length === 0) {
    console.error(`[bundle-rules] No .jsonl files found in ${SRC_DIR}`);
    process.exit(1);
  }

  /** @type {Record<string, any[]>} */
  const lagnaBuckets = {};
  /** @type {any[]} */
  let overrides = [];
  /** @type {any[]} */
  let exceptions = [];

  let totalRules = 0;
  const idSeen = new Set();
  let dupCount = 0;

  for (const file of files) {
    const stem = basename(file, ".jsonl");
    const records = readJsonlFile(join(SRC_DIR, file));
    totalRules += records.length;

    for (const r of records) {
      if (r && typeof r === "object" && r.id) {
        if (idSeen.has(r.id)) dupCount++;
        idSeen.add(r.id);
      }
      // Tag every rule with its source bucket for traceability.
      r.__bucket = stem;
    }

    if (SPECIAL_FILES.has(stem)) {
      if (stem === "_overrides") overrides = records;
      else if (stem === "_exceptions") exceptions = records;
      continue;
    }

    const signKey = LAGNA_FILE_TO_SIGN[stem] ?? stem;
    lagnaBuckets[signKey] = records;
  }

  const missingLagnas = Object.keys(LAGNA_FILE_TO_SIGN).filter((k) => !lagnaBuckets[k]);
  if (missingLagnas.length > 0) {
    console.warn(`[bundle-rules] WARNING: missing lagna buckets for: ${missingLagnas.join(", ")}`);
  }

  const bundle = {
    generatedAt: new Date().toISOString(),
    sourceDir: SRC_DIR,
    totalRules,
    duplicateIdCount: dupCount,
    lagnaBuckets,
    overrides,
    exceptions,
  };

  writeFileSync(OUT_FILE, JSON.stringify(bundle), "utf-8");

  console.log(`[bundle-rules] Wrote ${OUT_FILE}`);
  console.log(`[bundle-rules] Lagnas bundled: ${Object.keys(lagnaBuckets).sort().join(", ")}`);
  for (const [k, v] of Object.entries(lagnaBuckets).sort()) {
    console.log(`[bundle-rules]   ${k}: ${v.length} rules`);
  }
  console.log(`[bundle-rules] overrides: ${overrides.length} rules`);
  console.log(`[bundle-rules] exceptions: ${exceptions.length} rules`);
  console.log(`[bundle-rules] total rules: ${totalRules} (duplicate ids seen: ${dupCount})`);
}

main();
