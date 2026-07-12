// Copies Excalidraw's fonts and locales from node_modules into public/ so
// they ship with the app and load from "/" offline (window.EXCALIDRAW_ASSET_PATH).
// Runs before `dev` and `build` (see package.json); output is gitignored.
import { cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = `${root}node_modules/@excalidraw/excalidraw/dist/prod`;
const target = `${root}public`;

for (const dir of ["fonts", "locales"]) {
  rmSync(`${target}/${dir}`, { recursive: true, force: true });
  cpSync(`${source}/${dir}`, `${target}/${dir}`, { recursive: true });
}
console.log("[sync-excalidraw-assets] fonts + locales synced to public/");
