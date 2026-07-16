//! File I/O. Rust owns native OS work (ADR-0003); saves are atomic (write to
//! a temp sibling, then rename over the target) so a crash mid-write can never
//! corrupt an existing file.

use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

/// Generic text-file read. The frontend gives this its domain vocabulary:
/// `document.ts` wraps it for Documents, `workspace.ts` for Notes.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(Path::new(&path)).map_err(|err| format!("failed to read {path}: {err}"))
}

/// Generic atomic text-file write; same domain-vocabulary split as
/// [`read_text_file`]. Also used directly by SVG export.
#[tauri::command]
pub fn save_text_file(path: String, contents: String) -> Result<(), String> {
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

/// What a workspace entry is. Serializes to the exact lowercase strings the
/// frontend's `EntryKind` union switches on ("dir" / "document" / "note").
#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    Dir,
    Document,
    Note,
}

/// One level of a workspace directory.
#[derive(Serialize)]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub kind: EntryKind,
}

#[derive(Serialize)]
pub struct DirListing {
    pub path: String,
    pub entries: Vec<Entry>,
}

/// Directory names never surfaced in the workspace tree, alongside any name
/// starting with '.'. Keeps build/dependency noise out of the file list.
const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "bin",
    "obj",
    "dist",
    "build",
    "target",
    ".next",
    "out",
];

/// List exactly one level of `path` (not recursive): visible directories plus
/// `.excalidraw` documents and `.md` notes, directories first then files, each
/// group sorted case-insensitively by name.
#[tauri::command]
pub fn read_workspace_dir(path: String) -> Result<DirListing, String> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(Path::new(&path)).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let child = entry.path();
        let kind = if entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            if name.starts_with('.') || IGNORED_DIRS.contains(&name.as_str()) {
                continue;
            }
            EntryKind::Dir
        } else {
            match child.extension().and_then(|ext| ext.to_str()) {
                Some(ext) if ext.eq_ignore_ascii_case("excalidraw") => EntryKind::Document,
                Some(ext) if ext.eq_ignore_ascii_case("md") => EntryKind::Note,
                _ => continue,
            }
        };
        entries.push(Entry {
            name,
            path: child.to_string_lossy().into_owned(),
            kind,
        });
    }
    // Directories first, then case-insensitive by name within each group.
    entries.sort_by(|a, b| {
        let dir_first = (b.kind == EntryKind::Dir).cmp(&(a.kind == EntryKind::Dir));
        dir_first.then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(DirListing { path, entries })
}

/// Create the first free "Untitled.md" / "Untitled 2.md" / … in `dir` with a
/// starter heading. Returns the created absolute path.
#[tauri::command]
pub fn new_note(dir: String) -> Result<String, String> {
    let dir = Path::new(&dir);
    let mut n = 1;
    loop {
        let name = if n == 1 {
            "Untitled.md".to_string()
        } else {
            format!("Untitled {n}.md")
        };
        let candidate = dir.join(&name);
        if !candidate.exists() {
            fs::write(&candidate, "# Untitled\n").map_err(|e| e.to_string())?;
            return Ok(candidate.to_string_lossy().into_owned());
        }
        n += 1;
    }
}

/// Move/rename a path. Refuses to overwrite: `std::fs::rename` would silently
/// replace an existing target on Linux, which turns a typo into data loss.
#[tauri::command]
pub fn rename_path(from: String, to: String) -> Result<(), String> {
    let target = Path::new(&to);
    if target.exists() {
        return Err(format!("{to} already exists"));
    }
    fs::rename(Path::new(&from), target).map_err(|e| e.to_string())
}

/// Delete a file. v1 does not delete directories, so this is `remove_file` only.
#[tauri::command]
pub fn delete_path(path: String) -> Result<(), String> {
    fs::remove_file(Path::new(&path)).map_err(|e| e.to_string())
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
        save_text_file(path.clone(), r#"{"elements":[]}"#.into()).unwrap();
        assert_eq!(read_text_file(path).unwrap(), r#"{"elements":[]}"#);
    }

    #[test]
    fn save_replaces_existing_contents() {
        let dir = tempfile::tempdir().unwrap();
        let path = path_str(&dir, "doc.excalidraw");
        save_text_file(path.clone(), "old".into()).unwrap();
        save_text_file(path.clone(), "new".into()).unwrap();
        assert_eq!(read_text_file(path).unwrap(), "new");
    }

    #[test]
    fn save_leaves_no_temp_file_behind() {
        let dir = tempfile::tempdir().unwrap();
        let path = path_str(&dir, "doc.excalidraw");
        save_text_file(path, "x".into()).unwrap();
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
        let err = read_text_file(path.clone()).unwrap_err();
        assert!(err.contains(&path));
    }

    #[test]
    fn entry_kind_serializes_to_the_lowercase_strings_the_frontend_expects() {
        assert_eq!(serde_json::to_value(EntryKind::Dir).unwrap(), "dir");
        assert_eq!(
            serde_json::to_value(EntryKind::Document).unwrap(),
            "document"
        );
        assert_eq!(serde_json::to_value(EntryKind::Note).unwrap(), "note");
    }

    #[test]
    fn read_workspace_dir_filters_and_orders_one_level() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("note.md"), "# hi\n").unwrap();
        fs::write(root.join("drawing.excalidraw"), "{}").unwrap();
        fs::write(root.join("ignore.txt"), "nope").unwrap();
        fs::create_dir(root.join("node_modules")).unwrap();
        fs::create_dir(root.join("subdir")).unwrap();
        fs::create_dir(root.join(".hidden")).unwrap();

        let listing = read_workspace_dir(root.to_string_lossy().into_owned()).unwrap();

        // Directories first, then files; alphabetical within each group. The
        // .txt file, node_modules, and .hidden dir are all excluded.
        let got: Vec<(&str, EntryKind)> = listing
            .entries
            .iter()
            .map(|e| (e.name.as_str(), e.kind))
            .collect();
        assert_eq!(
            got,
            vec![
                ("subdir", EntryKind::Dir),
                ("drawing.excalidraw", EntryKind::Document),
                ("note.md", EntryKind::Note),
            ]
        );
        // Each entry's `path` is the child's absolute path.
        for entry in &listing.entries {
            assert_eq!(entry.path, root.join(&entry.name).to_string_lossy());
        }
    }

    #[test]
    fn new_note_picks_the_first_free_name() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().to_string_lossy().into_owned();

        let first = new_note(target.clone()).unwrap();
        let second = new_note(target).unwrap();

        assert!(first.ends_with("Untitled.md"), "got {first}");
        assert!(second.ends_with("Untitled 2.md"), "got {second}");
        assert!(Path::new(&first).exists());
        assert!(Path::new(&second).exists());
    }

    #[test]
    fn rename_path_moves_a_file() {
        let dir = tempfile::tempdir().unwrap();
        let from = path_str(&dir, "a.md");
        let to = path_str(&dir, "b.md");
        fs::write(&from, "x").unwrap();

        rename_path(from.clone(), to.clone()).unwrap();

        assert!(!Path::new(&from).exists());
        assert!(Path::new(&to).exists());
    }

    #[test]
    fn rename_path_refuses_to_clobber_an_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let from = path_str(&dir, "draft.md");
        let to = path_str(&dir, "notes.md");
        fs::write(&from, "draft").unwrap();
        fs::write(&to, "precious").unwrap();

        let err = rename_path(from.clone(), to.clone()).unwrap_err();

        assert!(err.contains("already exists"), "got {err}");
        assert_eq!(fs::read_to_string(&to).unwrap(), "precious");
        assert!(Path::new(&from).exists());
    }

    #[test]
    fn delete_path_removes_a_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = path_str(&dir, "gone.md");
        fs::write(&path, "x").unwrap();

        delete_path(path.clone()).unwrap();

        assert!(!Path::new(&path).exists());
    }
}
