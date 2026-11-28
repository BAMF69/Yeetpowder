// ---------------------------------------------------------------------------
// menuType.ts
// Purpose : Which lettering the Blast Zone menus use. "stencil" (worn-edge stencil, Elaina's pick 2026-11-28) is the
//           game's look; "riveted" (diamond-plate nameplates) and "engraved" (cut into gunmetal) are kept for later.
// Usage   : root.dataset.type = menuType(shell.params)   // the CSS (shell.css "Blast Zone") styles by [data-type]
//           ?menu-type=riveted or ?menu-type=engraved previews the others; anything else falls back to stencil.
// Notes   : Mockup of all three: docs/mockups/grunge-styles.html. Fonts in src/shell/fonts (OFL, ASSET_LOG A-0024).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-28
// ---------------------------------------------------------------------------

export const MENU_TYPES = ["stencil", "riveted", "engraved"] as const;
export type MenuType = (typeof MENU_TYPES)[number];
export const DEFAULT_MENU_TYPE: MenuType = "stencil";

export function menuType(params: URLSearchParams): MenuType {
  const asked = params.get("menu-type");
  return (MENU_TYPES as readonly string[]).includes(asked ?? "") ? (asked as MenuType) : DEFAULT_MENU_TYPE;
}

// ---------------------------------------------------------------------------
// End of menuType.ts
// ---------------------------------------------------------------------------
