import { readFileSync, writeFileSync, readdirSync } from "fs";

const files = readdirSync("plans").filter(
  (f) => f.endsWith(".md") && f !== "roadmap.md",
);

const replacements = [
  [/\[\[013-stripe-fraud-defense\]\]/g, "[[014-stripe-fraud-defense]]"],
  [/\[\[014-stripe-go-live\]\]/g, "[[015-stripe-go-live]]"],
];

for (const file of files) {
  const path = `plans/${file}`;
  let content = readFileSync(path, "utf8");
  let changed = false;
  for (const [pattern, replacement] of replacements) {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      changed = true;
      content = newContent;
    }
  }
  if (changed) {
    writeFileSync(path, content, "utf8");
    console.log(`Fixed: ${file}`);
  }
}
console.log("Done");
