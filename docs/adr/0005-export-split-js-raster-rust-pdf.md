# SVG and raster exports happen in JS; PDF export happens in Rust

SVG, PNG, and JPEG exports use Excalidraw's own exporters in the webview (`exportToSvg` / `exportToBlob`; high resolution is a scale factor). PDF is the exception: the frontend generates the SVG and hands it over IPC to Rust, which converts it with `svg2pdf` (built on `usvg`) into a true vector PDF and writes it to disk. A JS-side PDF would embed a raster and go soft under zoom or print; the requirement is print-quality output at any resolution.

## Consequences

- Raster and SVG bytes are written to disk through Rust commands too (`write_binary_file`, base64 over IPC), so all file I/O stays in one place (ADR-0003).
- **Font fidelity in PDF is approximate.** usvg renders text from a font database, not from the SVG's embedded `@font-face`, so Excalidraw's handwritten fonts (Excalifont, etc.) are not reproduced — text falls back to an installed system sans-serif. The drawing's vector geometry is exact; matching the original typeface (by bundling the fonts as TTF and loading them into the fontdb) is a deliberate follow-up. Text still renders readably and in the correct position/size/colour.
