//! Document file I/O. Rust owns native OS work (ADR-0003); saves are atomic
//! (write to a temp sibling, then rename over the target) so a crash
//! mid-write can never corrupt an existing document.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

#[tauri::command]
pub fn read_document(path: String) -> Result<String, String> {
    fs::read_to_string(Path::new(&path)).map_err(|err| format!("failed to read {path}: {err}"))
}

#[tauri::command]
pub fn save_document(path: String, contents: String) -> Result<(), String> {
    atomic_write(Path::new(&path), contents.as_bytes())
        .map_err(|err| format!("failed to save {path}: {err}"))
}

/// Write `bytes` to `target` atomically: a crash mid-write leaves the existing
/// file untouched. Shared by document saves and exports (`export` module).
pub(crate) fn atomic_write(target: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let tmp = temp_sibling(target);
    let mut file = fs::File::create(&tmp)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    drop(file);
    // `rename` replaces the target atomically on both Linux and Windows.
    if let Err(err) = fs::rename(&tmp, target) {
        let _ = fs::remove_file(&tmp);
        return Err(err);
    }
    Ok(())
}

/// `<name>.tmp` next to the target, so the rename never crosses a filesystem.
fn temp_sibling(target: &Path) -> PathBuf {
    let mut name = target.file_name().unwrap_or_default().to_os_string();
    name.push(".tmp");
    target.with_file_name(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn path_str(dir: &tempfile::TempDir, name: &str) -> String {
        dir.path().join(name).to_string_lossy().into_owned()
    }

    #[test]
    fn roundtrips_a_document() {
        let dir = tempfile::tempdir().unwrap();
        let path = path_str(&dir, "doc.excalidraw");
        save_document(path.clone(), r#"{"elements":[]}"#.into()).unwrap();
        assert_eq!(read_document(path).unwrap(), r#"{"elements":[]}"#);
    }

    #[test]
    fn save_replaces_existing_contents() {
        let dir = tempfile::tempdir().unwrap();
        let path = path_str(&dir, "doc.excalidraw");
        save_document(path.clone(), "old".into()).unwrap();
        save_document(path.clone(), "new".into()).unwrap();
        assert_eq!(read_document(path).unwrap(), "new");
    }

    #[test]
    fn save_leaves_no_temp_file_behind() {
        let dir = tempfile::tempdir().unwrap();
        let path = path_str(&dir, "doc.excalidraw");
        save_document(path, "x".into()).unwrap();
        let leftovers: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .filter(|n| n.to_string_lossy().ends_with(".tmp"))
            .collect();
        assert!(
            leftovers.is_empty(),
            "temp files left behind: {leftovers:?}"
        );
    }

    #[test]
    fn read_missing_file_reports_the_path() {
        let dir = tempfile::tempdir().unwrap();
        let path = path_str(&dir, "missing.excalidraw");
        let err = read_document(path.clone()).unwrap_err();
        assert!(err.contains(&path));
    }
}
