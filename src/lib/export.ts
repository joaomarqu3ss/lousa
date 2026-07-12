/**
 * Canvas export. SVG and raster (PNG/JPEG) are produced here in the webview
 * via Excalidraw's own exporters; PDF is produced in Rust from the scene's SVG
 * (ADR-0005). Every format is written to disk through a Rust command so file
 * I/O stays in one place (ADR-0003).
 */

import { exportToBlob, exportToSvg } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

// Raster exports render at this multiple of on-screen size for "high resolution".
const RASTER_SCALE = 3;
const EXPORT_PADDING = 16;
const JPEG_QUALITY = 0.92;

type ExportFormat = "svg" | "png" | "jpeg" | "pdf";

const FILTERS: Record<ExportFormat, { name: string; extensions: string[] }> = {
  svg: { name: "SVG image", extensions: ["svg"] },
  png: { name: "PNG image", extensions: ["png"] },
  jpeg: { name: "JPEG image", extensions: ["jpg", "jpeg"] },
  pdf: { name: "PDF document", extensions: ["pdf"] },
};

function sceneOpts(api: ExcalidrawImperativeAPI) {
  return {
    elements: api.getSceneElements(),
    appState: api.getAppState(),
    files: api.getFiles(),
    exportPadding: EXPORT_PADDING,
  };
}

async function pickPath(format: ExportFormat): Promise<string | null> {
  return save({
    defaultPath: `drawing.${FILTERS[format].extensions[0]}`,
    filters: [FILTERS[format]],
  });
}

/** Base64 (without the data-URL prefix) — reliable for large blobs, unlike btoa. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",", 2)[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function serializeSvg(api: ExcalidrawImperativeAPI, inlineFonts: boolean): Promise<string> {
  const svg = await exportToSvg({
    ...sceneOpts(api),
    // For a standalone .svg file we inline fonts so it renders anywhere; for
    // the PDF path usvg ignores them, so we skip the megabytes of base64.
    ...(inlineFonts ? {} : { skipInliningFonts: true as const }),
  });
  return new XMLSerializer().serializeToString(svg);
}

/**
 * Export the scene. Returns the written path, or `null` if the user cancelled
 * the save dialog. Throws on a real failure.
 */
export async function exportScene(
  api: ExcalidrawImperativeAPI,
  format: ExportFormat,
): Promise<string | null> {
  if (api.getSceneElements().length === 0) {
    throw new Error("Nothing to export — the canvas is empty.");
  }

  const path = await pickPath(format);
  if (!path) return null;

  if (format === "svg") {
    await invoke("save_document", { path, contents: await serializeSvg(api, true) });
  } else if (format === "pdf") {
    await invoke("export_pdf", { path, svg: await serializeSvg(api, false) });
  } else {
    const blob = await exportToBlob({
      ...sceneOpts(api),
      mimeType: format === "png" ? "image/png" : "image/jpeg",
      quality: JPEG_QUALITY,
      getDimensions: (width: number, height: number) => ({ width, height, scale: RASTER_SCALE }),
    });
    await invoke("write_binary_file", { path, dataBase64: await blobToBase64(blob) });
  }

  return path;
}
