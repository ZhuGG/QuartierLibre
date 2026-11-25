import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Vite copies these files directly, so they do not appear in its output bundle.
const publicResources = [
  "assets/arcade-abstract-v1.png",
  "assets/fonts/press-start-2p.ttf",
  "assets/hub-moon.png",
  "assets/hub-sun.png",
  "assets/panel-grain.png",
  "assets/retro-bay.png",
];

export function offlineApp() {
  let publicDir;
  return {
    name: "quartier-libre-offline",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      publicDir = config.publicDir;
    },
    async generateBundle(_options, bundle) {
      const manifestFile = "manifest.webmanifest";
      const manifest = JSON.parse(await readFile(join(publicDir, manifestFile), "utf8"));
      const worker = await readFile(new URL("./service-worker.js", import.meta.url), "utf8");
      const revision = createHash("sha256").update(worker);
      const files = Object.keys(bundle).filter((path) => !path.endsWith(".map")).sort();
      for (const path of files) {
        const item = bundle[path];
        revision.update(path).update(item.type === "asset" ? item.source : item.code);
      }
      const publicFiles = [manifestFile, ...publicResources, ...manifest.icons.map(({ src }) => src)];
      for (const path of publicFiles) {
        revision.update(path).update(await readFile(join(publicDir, path)));
      }

      const assets = [...new Set(["index.html", ...files, ...publicFiles])];
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `const revision = ${JSON.stringify(revision.digest("hex").slice(0, 16))};
const assets = ${JSON.stringify(assets)};
${worker}`,
      });
    },
  };
}
