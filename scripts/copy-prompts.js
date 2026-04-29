#!/usr/bin/env node
// Copy src/prompts/*.md → dist/prompts/*.md so the bundled handler can read them
// at runtime via fs.readFileSync(path.join(__dirname, "prompts", `${name}.md`)).
const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "..", "src", "prompts");
const outDir = path.join(__dirname, "..", "dist", "prompts");

fs.mkdirSync(outDir, { recursive: true });

const entries = fs.readdirSync(srcDir).filter((f) => f.endsWith(".md"));
for (const file of entries) {
  fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
}

console.log(`Copied ${entries.length} prompt file(s) to ${outDir}`);
