// Copies the static frontend into www/ for Capacitor to bundle into the
// native app. The same files are served directly by the Node server for the
// web/PWA build, so www/ is a generated artifact (git-ignored).
import { rm, mkdir, cp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "www");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const files = ["index.html", "app.js", "styles.css", "manifest.json"];
for (const file of files) {
  await cp(join(root, file), join(out, file));
}
await cp(join(root, "icons"), join(out, "icons"), { recursive: true });

console.log(`Copied web assets to ${out}`);
