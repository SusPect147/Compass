// ============================================================================
// Cache-busting stamper — runs during deploy (GitHub Actions).
//
// Rewrites every LOCAL .js / .css reference in the root *.html files,
// replacing any existing ?v=... with a fresh version tied to the current
// commit. Users therefore always download the new code after a deploy and
// never see a stale cached bundle.
//
// Usage:  node scripts/stamp-assets.mjs <version>
//         (falls back to the current timestamp when no version is given)
// ============================================================================
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = (process.argv[2] || Date.now().toString(36)).substring(0, 12);

// Matches src/href attributes pointing to LOCAL js/css files (not http/https CDNs),
// with an optional existing ?v=... query that gets replaced.
const ASSET_RE = /(src|href)=("|')(\.?\/?(?:js|css)\/[^"'?]+\.(?:js|css))(?:\?[^"']*)?("|')/g;

const htmlFiles = readdirSync(root).filter(f => f.endsWith('.html'));
let totalRefs = 0;

for (const file of htmlFiles) {
    const path = resolve(root, file);
    const original = readFileSync(path, 'utf8');
    let count = 0;
    const updated = original.replace(ASSET_RE, (_m, attr, q1, assetPath, q2) => {
        count++;
        return `${attr}=${q1}${assetPath}?v=${version}${q2}`;
    });
    if (count > 0 && updated !== original) {
        writeFileSync(path, updated);
    }
    totalRefs += count;
    console.log(`stamped ${file}: ${count} asset reference(s)`);
}

console.log(`\nDone. Version "${version}" applied to ${totalRefs} reference(s) in ${htmlFiles.length} HTML file(s).`);
