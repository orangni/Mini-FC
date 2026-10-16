import { build } from "vite";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = resolve(
  process.argv[2] || resolve(root, "standalone/Mini-FC.html"),
);
const result = await build({
  root,
  configFile: false,
  logLevel: "warn",
  build: {
    write: false,
    target: "es2020",
    cssCodeSplit: false,
    lib: {
      entry: resolve(root, "src/main.js"),
      name: "MiniFCStandalone",
      formats: ["iife"],
      fileName: "game",
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const output = (Array.isArray(result) ? result[0] : result).output;
const js = output.find((f) => f.type === "chunk").code;
const css = output
  .filter((f) => f.type === "asset" && f.fileName.endsWith(".css"))
  .map((f) => f.source)
  .join("\n");
let html = await readFile(resolve(root, "index.html"), "utf8");
const icon = (await readFile(resolve(root, "public/favicon.svg"))).toString(
  "base64",
);
html = html.replace(
  /<script\b[^>]*\bsrc=["']\/src\/main\.js["'][^>]*><\/script>/,
  "",
);
html = html.replace("./favicon.svg", () => `data:image/svg+xml;base64,${icon}`);
html = html.replace(
  "</head>",
  () => `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>\n</head>`,
);
html = html.replace(
  "</body>",
  () => `<script>${js.replace(/<\/script/gi, "<\\/script")}</script>\n</body>`,
);
if (/<script[^>]+src=|<link[^>]+href=["'](?!data:)/i.test(html))
  throw new Error("An external resource remains.");
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, html);
console.log(
  `Single HTML: ${destination} (${Buffer.byteLength(html)} bytes). No external scripts, styles, images or CDN required.`,
);
