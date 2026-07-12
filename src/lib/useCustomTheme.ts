/**
 * React binding for the user's custom interface colors.
 *
 * Holds the CustomTheme, persists it app-wide, and keeps a single <style> element
 * in <head> in sync so edits restyle Excalidraw's chrome live. The generated CSS
 * targets `.excalidraw`/`.excalidraw.theme--dark` and is appended after the app's
 * stylesheet, so it overrides both the stock and chalk-teal defaults by source
 * order without touching the DOM Excalidraw owns.
 */

import { useCallback, useEffect, useState } from "react";
import {
  buildCustomThemeCss,
  EMPTY_CUSTOM_THEME,
  loadCustomTheme,
  saveCustomTheme,
  type CustomTheme,
} from "./customTheme";

const STYLE_ELEMENT_ID = "lousa-custom-theme";

export interface CustomThemeControl {
  custom: CustomTheme;
  /** Set a single channel; pass null to clear it back to the default. */
  setChannel: (channel: keyof CustomTheme, value: string | null) => void;
  /** Clear every channel. */
  reset: () => void;
}

export function useCustomTheme(): CustomThemeControl {
  const [custom, setCustom] = useState<CustomTheme>(loadCustomTheme);

  // Reflect the theme into a single managed <style> element and persist it.
  // The element is intentionally never removed: this hook is an app-lifetime
  // singleton, so keeping the node avoids a teardown flash and re-create churn.
  useEffect(() => {
    let style = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ELEMENT_ID;
      document.head.appendChild(style);
    }
    style.textContent = buildCustomThemeCss(custom);
    saveCustomTheme(custom);
  }, [custom]);

  const setChannel = useCallback((channel: keyof CustomTheme, value: string | null) => {
    setCustom((prev) => ({ ...prev, [channel]: value }));
  }, []);

  const reset = useCallback(() => setCustom(EMPTY_CUSTOM_THEME), []);

  return { custom, setChannel, reset };
}
