# SVG and raster exports happen in JS; PDF export happens in Rust

SVG, PNG, and JPEG exports use Excalidraw's own exporters in the webview (`exportToSvg` / `exportToBlob`; high resolution is a scale factor). PDF is the exception: the frontend generates the SVG and hands it over IPC to Rust, which converts it with `resvg`/`usvg` + `svg2pdf` into a true vector PDF and writes it to disk. A JS-side PDF would embed a raster and go soft under zoom or print; the requirement is print-quality output at any resolution.
