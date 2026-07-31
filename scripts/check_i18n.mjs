import { readFileSync, existsSync } from "fs";

const LOCALES = ["en", "hu", "de", "fr", "es"];

function load(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function flatten(obj, prefix = "") {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(result, flatten(v, key));
    } else {
      result[key] = v;
    }
  }
  return result;
}

// Load all
const data = {};
for (const lang of LOCALES) {
  const path = `src/i18n/locales/${lang}/translation.json`;
  if (!existsSync(path)) {
    console.error(`MISSING: ${path}`);
    process.exit(1);
  }
  data[lang] = flatten(load(path));
}

const allKeys = new Set(Object.values(data).flatMap((d) => Object.keys(d)));

// 1. Missing keys in each language
console.log("\n=== HIÁNYZÓ KULCSOK ===\n");
for (const lang of LOCALES) {
  const keys = new Set(Object.keys(data[lang]));
  const missing = [...allKeys].filter((k) => !keys.has(k));
  if (missing.length > 0) {
    console.log(`[${lang}] ${missing.length} hiányzó kulcs:`);
    for (const k of missing) console.log(`  - ${k}`);
    console.log();
  }
}

// 2. Find values that are still English in non-English files
console.log("\n=== FORDÍTATLAN ANGOL SZÖVEGEK ===\n");
for (const lang of LOCALES) {
  if (lang === "en") continue;
  let found = 0;
  for (const [key, val] of Object.entries(data[lang])) {
    const enVal = data["en"][key];
    if (val === enVal && val.length > 3 && !enVal.startsWith("{{")) {
      console.log(`[${lang}] ${key}: "${val.slice(0, 80)}..."`);
      found++;
    }
  }
  if (found === 0) console.log(`[${lang}] ✅ Minden kulcs le van fordítva`);
  console.log();
}

// 3. Summary
console.log("\n=== ÖSSZEGZÉS ===\n");
for (const lang of LOCALES) {
  console.log(`[${lang}] ${Object.keys(data[lang]).length} kulcs`);
}
