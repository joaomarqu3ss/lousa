//! Export commands. Raster (PNG/JPEG) and SVG are produced in the webview and
//! handed here only to be written to disk; PDF is produced *here* — the
//! frontend sends the scene's SVG and Rust renders a true vector PDF with
//! `svg2pdf` (ADR-0005), so it stays crisp at any zoom or print size.

use std::path::Path;

use base64::{engine::general_purpose::STANDARD, Engine};

use crate::fs::atomic_write;

/// Write already-encoded bytes (a PNG/JPEG blob from the webview) to disk.
/// The payload is base64 so it survives the JSON IPC boundary compactly.
#[tauri::command]
pub fn write_binary_file(path: String, data_base64: String) -> Result<(), String> {
    let bytes = STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|err| format!("invalid base64 payload: {err}"))?;
    atomic_write(Path::new(&path), &bytes).map_err(|err| format!("failed to write {path}: {err}"))
}

/// Convert the scene's SVG into a vector PDF and write it to disk.
#[tauri::command]
pub fn export_pdf(path: String, svg: String) -> Result<(), String> {
    let pdf = svg_to_pdf(&svg)?;
    atomic_write(Path::new(&path), &pdf).map_err(|err| format!("failed to write {path}: {err}"))
}

// usvg reads fonts from a database, not from the SVG's embedded @font-face, and
// Excalidraw's handwritten families won't be installed — so unmatched text must
// resolve to a font that actually exists, or it silently vanishes from the PDF.
// usvg resolves generic families (and its own ultimate fallback) through
// fontdb's generic mappings, which default to Arial/Times — absent on many
// Linux boxes — so we repoint them at an installed font.
const SANS_FALLBACKS: &[&str] = &[
    "Segoe UI",       // Windows
    "Helvetica Neue", // macOS
    "DejaVu Sans",    // most Linux
    "Liberation Sans",
    "Noto Sans",
    "Arial",
];

const MONO_FALLBACKS: &[&str] = &[
    "Cascadia Code",
    "Consolas",
    "DejaVu Sans Mono",
    "Liberation Mono",
    "Menlo",
];

fn svg_to_pdf(svg: &str) -> Result<Vec<u8>, String> {
    let mut options = svg2pdf::usvg::Options::default();
    let db = options.fontdb_mut();
    db.load_system_fonts();

    if let Some(sans) = first_available_family(db, SANS_FALLBACKS) {
        // Serif is usvg's ultimate fallback, so it must resolve too; cursive and
        // fantasy rarely appear but should degrade to something real as well.
        db.set_sans_serif_family(sans.clone());
        db.set_serif_family(sans.clone());
        db.set_cursive_family(sans.clone());
        db.set_fantasy_family(sans);
    }
    if let Some(mono) = first_available_family(db, MONO_FALLBACKS) {
        db.set_monospace_family(mono);
    }

    let tree = svg2pdf::usvg::Tree::from_str(svg, &options)
        .map_err(|err| format!("invalid SVG: {err}"))?;
    svg2pdf::to_pdf(
        &tree,
        svg2pdf::ConversionOptions::default(),
        svg2pdf::PageOptions::default(),
    )
    .map_err(|err| format!("SVG-to-PDF conversion failed: {err}"))
}

/// First of `preferences` that the font database actually contains.
fn first_available_family(
    db: &svg2pdf::usvg::fontdb::Database,
    preferences: &[&str],
) -> Option<String> {
    let installed: std::collections::HashSet<String> = db
        .faces()
        .flat_map(|face| face.families.iter().map(|(name, _)| name.clone()))
        .collect();
    preferences
        .iter()
        .find(|pref| installed.contains(**pref))
        .map(|pref| pref.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60">
        <rect x="10" y="10" width="80" height="40" fill="none" stroke="black" stroke-width="2"/>
    </svg>"#;

    #[test]
    fn produces_a_valid_pdf() {
        let pdf = svg_to_pdf(SVG).unwrap();
        // Every PDF starts with the "%PDF-" magic bytes.
        assert!(pdf.starts_with(b"%PDF-"), "output is not a PDF");
        assert!(pdf.len() > 100, "PDF suspiciously small");
    }

    #[test]
    fn rejects_malformed_svg() {
        assert!(svg_to_pdf("not an svg at all").is_err());
    }

    #[test]
    fn write_binary_file_decodes_and_writes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("out.png").to_string_lossy().into_owned();
        // base64 of the PNG magic bytes
        let payload = STANDARD.encode([0x89, b'P', b'N', b'G']);
        write_binary_file(path.clone(), payload).unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), [0x89, b'P', b'N', b'G']);
    }

    #[test]
    fn write_binary_file_rejects_bad_base64() {
        assert!(write_binary_file("/tmp/whatever".into(), "!!!not-base64!!!".into()).is_err());
    }
}
