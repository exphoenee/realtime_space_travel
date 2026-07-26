/**
 * Cross-platform build script for Realtime Space Travel.
 * Handles __BASE_HREF__ and __OG_DOMAIN__ replacements
 * after Vite builds the project.
 */

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

// --- Configuration ---
// Determine deployment type from npm script name or env
const deployTarget = process.argv[2] || process.env.DEPLOY_TARGET || "firebase"; // "firebase" | "gh-pages"

const configs = {
  firebase: {
    BASE_PATH: "/",
    OG_DOMAIN: "https://realtimespacetravel-e74e3.web.app",
  },
  "gh-pages": {
    BASE_PATH: "/realtime_space_travel/",
    OG_DOMAIN: "https://exphoenee.github.io/realtime_space_travel",
  },
};

const config = configs[deployTarget];

// Set env vars so Vite picks them up
process.env.VITE_BASE_PATH = config.BASE_PATH;

// --- Step 1: Run tsc + vite build ---
console.log(`\n🔨 Building for ${deployTarget}...`);
console.log(`   Base path: ${config.BASE_PATH}`);
console.log(`   OG domain: ${config.OG_DOMAIN}\n`);

try {
  execSync("npx tsc --noEmit && npx vite build", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env, VITE_BASE_PATH: config.BASE_PATH },
  });
} catch {
  process.exit(1);
}

// --- Step 2: Replace placeholders in dist/index.html ---
const htmlPath = "dist/index.html";
let html = readFileSync(htmlPath, "utf-8");

html = html
  .replace(/__BASE_HREF__/g, config.BASE_PATH)
  .replace(/__OG_DOMAIN__/g, config.OG_DOMAIN);

writeFileSync(htmlPath, html);

// --- Step 3: Verify ---
if (html.includes("__BASE_HREF__") || html.includes("__OG_DOMAIN__")) {
  console.error("❌ Some placeholders were NOT replaced in dist/index.html!");
  process.exit(1);
}

console.log(`✅ Build complete! OG image URL: ${config.OG_DOMAIN}/og.jpg`);
