// ---------------------------------------------------------------------------
// menuKit.ts
// Purpose : The building blocks of the icon-first menus (docs/mockups/menu-redesign.html, approved 2026-11-26):
//           a GridMenu that the d-pad moves across spatially, big icon tiles with one word, picture tiles for
//           maps, small icon chips for single choices and toggles, +/- steppers, and the back-arrow header bar.
// Usage   : const m = new GridMenu();
//           grid.append(tile(m, i18n, { id: "party", icon: "party", label: "mk.party", accept: () => ... }).el)
//           pick(m, [chip(...), chip(...)], 0, (i) => mode = MODES[i])
// Notes   : Browser only (DOM). Every word goes through tl() (data-tr), numbers through val() (data-val), so the
//           pseudo-locale check keeps working. Every control is a Menu Item, so mouse, touch, keyboard and gamepad
//           reach all of them; screens get ui_cancel for back as before. Looks: .mk-* rules in shell.css.
//           Debug: ?debug logs each spatial move on the "ui" channel.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5), 2026-11-26
// ---------------------------------------------------------------------------
import type { I18n } from "../core/i18n";
import { Log } from "../core/log";
import { icon } from "./icons";
import { nextInDirection, type NavDir } from "./spatialNav";
import { Menu, el, tl, val, type Item } from "./ui";

const DIRS: Record<string, NavDir> = { ui_up: "up", ui_down: "down", ui_left: "left", ui_right: "right" };

/**
 * A Menu laid out as a grid of any shape: arrows move to the nearest item in that direction (spatialNav.ts).
 * An item with its own left/right (a stepper) keeps them; up/down still move away from it.
 */
export class GridMenu extends Menu {
  override handle(action: string): boolean {
    const dir = DIRS[action];
    if (!dir) return super.handle(action);
    const it = this.focused;
    if ((dir === "left" && it?.left) || (dir === "right" && it?.right)) return super.handle(action);
    const rects = this.items.map((i) => {
      const r = i.el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const next = nextInDirection(rects, this.index, dir);
    Log.debug("ui", `grid ${dir}: ${this.focused?.id} -> ${next >= 0 ? this.items[next].id : "(edge)"}`);
    if (next >= 0) { this.index = next; this.render(); }
    return true; // an edge swallows the press, so it never falls through to another handler
  }

  /** Focus the first item that is not disabled (screens call this on enter). */
  focusFirst(): void {
    const i = this.items.findIndex((it) => !it.el.classList.contains("mk-off"));
    if (i >= 0) { this.index = i; this.render(); }
  }
}

/** Marks a label screen-reader-only (drawn nowhere; the pseudo check skips its layout, never its words). */
export function sr<E extends HTMLElement>(e: E): E { e.dataset.sr = ""; return e; }

function button(cls: string): HTMLElement {
  const e = el("div", cls);
  e.setAttribute("role", "button");
  e.tabIndex = -1;
  return e;
}

export interface TileSpec {
  id: string;
  icon?: string;
  /** i18n key of the one word under the icon. */
  label: string;
  /** i18n key of a short line under the word (optional). */
  sub?: string;
  hero?: boolean;
  accept: () => void;
}

/** A big tile: icon, one word, maybe a short line. */
export function tile(m: Menu, i18n: I18n, spec: TileSpec): Item {
  const e = button(spec.hero ? "mk-tile mk-hero" : "mk-tile");
  if (spec.icon) e.append(icon(spec.icon));
  e.append(tl(i18n, spec.label, "mk-word"));
  if (spec.sub) e.append(tl(i18n, spec.sub, "mk-sub"));
  return m.add({ id: spec.id, el: e, accept: spec.accept });
}

/** A picture tile (a map): the picture fills it, its name sits on a band at the bottom. */
export function pictureTile(m: Menu, i18n: I18n, id: string, picture: Element, label: string, accept: () => void): Item {
  const e = button("mk-tile mk-picture");
  e.append(picture, tl(i18n, label, "mk-word"));
  return m.add({ id, el: e, accept });
}

/** A small square chip: an icon with a tiny word under it (mode, visibility, bots, difficulty). */
export function chip(m: Menu, i18n: I18n, id: string, iconName: string, label: string, accept: () => void = () => {}): Item {
  const e = button("mk-chip");
  e.append(icon(iconName), tl(i18n, label, "mk-chipword"));
  return m.add({ id, el: e, accept });
}

/** Marks one item of a group pressed; returns a setter. Disabled items (mk-off) cannot be picked. */
export function pick(items: Item[], initial: number, onChange: (index: number) => void): (index: number) => void {
  const set = (index: number) => {
    if (items[index]?.el.classList.contains("mk-off")) return;
    items.forEach((it, i) => it.el.setAttribute("aria-pressed", String(i === index)));
    onChange(index);
  };
  items.forEach((it, i) => { it.accept = () => set(i); });
  set(initial);
  return set;
}

/** An on/off chip. */
export function toggle(item: Item, initial: boolean, onChange: (on: boolean) => void): (on: boolean) => void {
  let on = initial;
  const set = (v: boolean) => { on = v; item.el.setAttribute("aria-pressed", String(on)); onChange(on); };
  item.accept = () => set(!on);
  set(initial);
  return set;
}

export interface StepperSpec<T extends number> {
  id: string;
  values: readonly T[];
  value: T;
  /** An icon after the number (trophy, clock ...). */
  icon?: string;
  /** Draw one person per unit (players, bots). */
  people?: boolean;
  /** i18n key read by the narrator. */
  label: string;
  onChange: (v: T) => void;
}

/** "−  8  ••••••••  +": left/right (or the buttons) step through the values. */
export function stepper<T extends number>(m: Menu, i18n: I18n, spec: StepperSpec<T>): Item & { set(v: T): void } {
  const e = el("div", "mk-stepper");
  const minus = button("mk-step"); minus.dataset.dir = "left"; minus.append(icon("minus"));
  const plus = button("mk-step"); plus.append(icon("plus"));
  const out = val("", "mk-num", spec.id + ".value");
  const people = el("span", "mk-people");
  const name = sr(tl(i18n, spec.label, "mk-hidden-label"));
  e.append(name, minus, out);
  if (spec.icon) e.append(icon(spec.icon, "mk-icon mk-stepicon"));
  if (spec.people) e.append(people);
  e.append(plus);
  let i = Math.max(0, spec.values.indexOf(spec.value));
  const draw = () => {
    out.textContent = String(spec.values[i]);
    if (spec.people) people.replaceChildren(...Array.from({ length: spec.values[i] }, () => icon("person", "mk-person")));
    minus.classList.toggle("mk-off", i === 0);
    plus.classList.toggle("mk-off", i === spec.values.length - 1);
  };
  const step = (d: number) => { i = Math.max(0, Math.min(spec.values.length - 1, i + d)); draw(); spec.onChange(spec.values[i]); };
  const item = m.add({ id: spec.id, el: e, role: "slider", left: () => step(-1), right: () => step(1) });
  draw();
  return Object.assign(item, { set(v: T) { const k = spec.values.indexOf(v); if (k >= 0) { i = k; draw(); } } });
}

/** The header: a big back arrow (an Item, so the pad reaches it), one title word, and room for a GO button. */
export function bar(m: Menu, i18n: I18n, title: string, back: () => void): { el: HTMLElement; right: HTMLElement } {
  const e = el("div", "mk-bar");
  const b = button("mk-back");
  b.append(icon("back"), sr(tl(i18n, "mk.back", "mk-hidden-label")));
  m.add({ id: "back", el: b, accept: back });
  const right = el("div", "mk-bar-right");
  e.append(b, tl(i18n, title, "mk-title", {}, "div"), right);
  return { el: e, right };
}

/** The big GO button (an Item). */
export function goButton(m: Menu, i18n: I18n, label: string, iconName: string, accept: () => void): Item {
  const e = button("mk-go");
  e.append(icon(iconName), tl(i18n, label, "mk-goword"));
  return m.add({ id: "go", el: e, accept });
}

/** A labelled column inside a setup screen. */
export function group(i18n: I18n, label?: string): HTMLElement {
  const g = el("div", "mk-group");
  if (label) g.append(tl(i18n, label, "mk-lbl", {}, "div"));
  return g;
}

// ---------------------------------------------------------------------------
// End of menuKit.ts
// ---------------------------------------------------------------------------
