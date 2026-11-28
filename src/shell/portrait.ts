// ---------------------------------------------------------------------------
// portrait.ts
// Purpose : The operator list in picker order and a live 3D portrait of one operator, shared by the Operator
//           screen, the home screen's operator tile and the respawn screen.
// Usage   : const p = livePortrait(box, "ninja", noart, () => stillOpen); p.get()?.select("robot"); p.get()?.dispose()
// Notes   : The renderer (game/yeet/operatorPreview.ts) loads on demand, so the menus do not pull three in up
//           front. alive() is checked when it arrives: a screen closed meanwhile gets no renderer. No WebGL: a
//           plain figure icon, and the choice still saves.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-26
// ---------------------------------------------------------------------------
import { OPERATORS, type OperatorId } from "../net/profile";
import { icon } from "./icons";

export const OPERATOR_IDS = Object.keys(OPERATORS) as OperatorId[];
export type Preview = { select(id: OperatorId): void; dispose(): void };

export function livePortrait(host: HTMLElement, op: OperatorId, noart: boolean, alive: () => boolean): { get(): Preview | undefined } {
  let preview: Preview | undefined;
  void import("../game/yeet/operatorPreview").then(({ operatorPreview }) => {
    if (alive()) preview = operatorPreview(host, op, noart);
  }).catch(() => { host.append(icon("person", "mk-icon")); });
  return { get: () => preview };
}

// ---------------------------------------------------------------------------
// End of portrait.ts
// ---------------------------------------------------------------------------
