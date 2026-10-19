import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = path.resolve(__dirname, "..", "out");
const docsDir = path.resolve(__dirname, "..", "..", "docs");

if (!fs.existsSync(outDir)) {
  console.error("❌ 'out' directory not found. Please run 'next build' first.");
  process.exit(1);
}

console.log(`📦 Copying static build from ${outDir} to ${docsDir}...`);

// Ensure docs directory exists
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// Copy out/* to docs/
fs.cpSync(outDir, docsDir, { recursive: true, force: true });

// Ensure .nojekyll exists in docs/ for GitHub Pages
const nojekyllPath = path.join(docsDir, ".nojekyll");
fs.writeFileSync(nojekyllPath, "", "utf-8");
console.log("✅ Created docs/.nojekyll (disables Jekyll on GitHub Pages)");

console.log("🎉 Successfully deployed website build to docs/ for GitHub Pages!");
