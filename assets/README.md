# Brand assets

Source of truth for the Lousa logo. The mark is an **L** whose foot becomes a
fountain-pen nib.

| File            | What it is                                          | Use                               |
| --------------- | --------------------------------------------------- | --------------------------------- |
| `logo.svg`      | Full app icon — cream mark on a dark rounded square | Vector master for the app icon    |
| `logo-mark.svg` | Glyph only, transparent background                  | README, in-app About, any surface |
| `logo-1024.png` | 1024×1024 RGBA raster master                        | Input to `tauri icon`             |

## Regenerating the app icons

The platform icon set in `src-tauri/icons/` is generated — never hand-edit it:

```sh
pnpm tauri icon assets/logo-1024.png
```

This produces the Windows `.ico`, Linux PNGs, and macOS `.icns`. Delete the
`src-tauri/icons/android/` and `src-tauri/icons/ios/` output it also emits —
mobile is out of scope.
