import { TUNING, type WeaponId } from "../../core/yeet/tuning";
import type { PoseInput, V3 } from "./operativePose";

export interface HandAdjustment {
  position: V3;
  rotation: V3;
  /** A pinned hand's position is relative to the torso instead of its weapon anchor. */
  pinned?: boolean;
  /** Copied grips keep their wrist orientation relative to the weapon or pinned torso. */
  rotationSpace?: "weapon" | "torso";
}
export type GripConnections = Partial<Record<"right" | "left", HandAdjustment>>;

const TARGETS = {
  right: "Right hand",
  left: "Left hand",
  gun: "Gun",
  rightFoot: "Right foot",
  leftFoot: "Left foot",
  rightElbow: "Right elbow",
  leftElbow: "Left elbow",
  torso: "Torso",
  head: "Head",
};
type AdjustmentTarget = keyof typeof TARGETS;
export type GripAdjustment = Partial<Record<AdjustmentTarget, HandAdjustment>>;
type GripPresets = Partial<Record<WeaponId, GripAdjustment>>;
type Stance = "ready" | "aimed";
type PosePresets = Record<Stance, GripPresets>;
export type EditorPresets = PosePresets & { special?: Record<string, PosePresets> };
const STORAGE_KEY = "yeetpowder.grip-editor.poses.v1";
const LEGACY_STORAGE_KEY = "yeetpowder.grip-editor.v1";
const axes = ["X", "Y", "Z"];
const GUNBLADE_STATES: Partial<Record<WeaponId, readonly [string, string][]>> = {
  reaper: [["slash", "Slash"], ["hook", "Hook hold"], ["reap", "Yeetreap tuck"]],
  sakura: [["slash", "Slash"], ["stance", "Reverse stance"], ["dash", "Dash stance"], ["ultra", "Ultraslash"]],
  axe: [["slash", "Slash"], ["raise", "Raised axe"], ["grenade", "Grenade slash"]],
};

interface OperatorControls {
  options: readonly { id: string; name: string; available: boolean }[];
  select(id: string): void;
}

function readGripPresets(value: unknown, state = ""): GripPresets {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const validVector = (vector: unknown): vector is V3 => (
    Array.isArray(vector) && vector.length === 3 && vector.every((n) => typeof n === "number" && Number.isFinite(n))
  );
  const result: GripPresets = {};
  for (const id of TUNING.weaponOrder) {
    if (state && !GUNBLADE_STATES[id]?.some(([name]) => name === state)) continue;
    const preset = source[id];
    if (!preset || typeof preset !== "object") continue;
    for (const target of Object.keys(TARGETS) as AdjustmentTarget[]) {
      const part = (preset as GripAdjustment)[target];
      if (!validVector(part?.position) || !validVector(part?.rotation)) continue;
      const entry = result[id] ??= {};
      entry[target] = {
        position: part.position, rotation: part.rotation,
        ...(part.pinned === true ? { pinned: true } : {}),
        ...(part.rotationSpace === "weapon" || part.rotationSpace === "torso" ? { rotationSpace: part.rotationSpace } : {}),
      };
    }
  }
  return result;
}

export function readEditorPresets(value: unknown): EditorPresets {
  const source = value as Partial<EditorPresets> | undefined;
  const result: EditorPresets = { ready: readGripPresets(source?.ready), aimed: readGripPresets(source?.aimed) };
  for (const [state, bucket] of Object.entries(source?.special ?? {})) {
    const ready = readGripPresets(bucket?.ready, state);
    const aimed = readGripPresets(bucket?.aimed, state);
    if (Object.keys(ready).length || Object.keys(aimed).length) (result.special ??= {})[state] = { ready, aimed };
  }
  return result;
}

export function makeGripEditor(
  host: HTMLElement,
  canvas: HTMLElement,
  selectWeapon: (id: WeaponId) => void,
  handPosition: (side: "right" | "left", pinned: boolean) => V3 | null,
  captureHand: (side: "right" | "left", pinned: boolean) => HandAdjustment | undefined,
  startWeapon: WeaponId,
  startAngle: number,
  operators: OperatorControls,
  defaults?: EditorPresets,
  firstPerson = false,
) {
  const editorTitle = firstPerson ? "First-person grip editor" : "Third-person grip editor";
  const storageKey = firstPerson ? "yeetpowder.first-person-grips.v1" : STORAGE_KEY;
  const adjustable: AdjustmentTarget[] = firstPerson ? ["right", "left", "gun"] : Object.keys(TARGETS) as AdjustmentTarget[];
  let poses: EditorPresets = defaults ? structuredClone(defaults) : { ready: {}, aimed: {} };
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      poses = readEditorPresets(JSON.parse(saved));
    } else if (!firstPerson) {
      const legacy: GripPresets = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) ?? "{}") ?? {};
      if (Object.keys(legacy).length) poses = { ready: legacy, aimed: structuredClone(legacy) };
    }
  } catch { /* use defaults */ }
  let weapon = startWeapon;
  let target: AdjustmentTarget = "right";
  const history: EditorPresets[] = [];
  let activeEdit: HTMLInputElement | null = null;
  const panel = document.createElement("section");
  panel.setAttribute("aria-label", editorTitle);
  Object.assign(panel.style, {
    position: "absolute", left: "12px", top: "85px", zIndex: "8", maxHeight: "calc(100% - 165px)", overflow: "auto",
    padding: "12px", borderRadius: "10px", color: "#fff", background: "#131925ee", width: "260px",
    maxWidth: "calc(100vw - 24px)", font: "14px system-ui",
  });
  panel.addEventListener("keydown", (event) => event.stopPropagation());
  panel.addEventListener("keyup", (event) => event.stopPropagation());
  const title = document.createElement("strong");
  title.textContent = editorTitle;
  panel.append(title);
  const hint = document.createElement("div");
  hint.textContent = firstPerson ? "Animation previews recoil and reload." : "Drag to orbit. Scroll to zoom.";
  hint.style.marginTop = "4px";
  panel.append(hint);

  function field(name: string, input: HTMLElement): HTMLLabelElement {
    const label = document.createElement("label");
    Object.assign(label.style, { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", marginTop: "6px" });
    label.append(name, input);
    panel.append(label);
    return label;
  }
  const select = <T extends string>(name: string, options: readonly T[], describe: (value: T) => string) => {
    const input = document.createElement("select");
    for (const value of options) input.add(new Option(describe(value), value));
    field(name, input);
    return input;
  };
  const weapons = select("Weapon", TUNING.weaponOrder, (id) => TUNING.weapons[id].name);
  const operator = document.createElement("select");
  for (const { id, name, available } of operators.options) {
    const option = new Option(name, id);
    option.disabled = !available;
    operator.add(option);
  }
  field("Operator", operator);
  operator.onchange = () => operators.select(operator.value);
  const animation = document.createElement("input");
  animation.type = "checkbox";
  field("Animation", animation);
  const special = document.createElement("select");
  const specialField = field("Gunblade state", special);
  let specialWeapon: WeaponId | undefined;
  let specialStart: number | null = null;
  special.onchange = () => { specialStart = null; refresh(); };
  const targets = select("Adjust", adjustable, (id) => TARGETS[id]);
  const angles = document.createElement("input");
  angles.type = "range";
  angles.min = "-180";
  angles.max = "180";
  angles.step = "any";
  angles.value = String(Math.atan2(Math.sin(startAngle), Math.cos(startAngle)) * 180 / Math.PI);
  field("Camera orbit", angles).hidden = firstPerson;
  const distance = document.createElement("input");
  distance.type = "range";
  distance.min = "0.45";
  distance.max = "2.4";
  distance.step = "0.01";
  distance.value = "1";
  field("Camera distance", distance).hidden = firstPerson;
  if (firstPerson) {
    angles.parentElement!.style.display = "none";
    distance.parentElement!.style.display = "none";
  }
  let elevation = 0;
  let drag: { id: number; x: number; y: number } | null = null;
  const touchAction = canvas.style.touchAction;
  const cursor = canvas.style.cursor;
  const pointerEvents = new AbortController();
  const options = { signal: pointerEvents.signal };
  if (!firstPerson) {
  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || drag) return;
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement && panel.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    canvas.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.style.cursor = "grabbing";
  }, options);
  canvas.addEventListener("pointermove", (event) => {
    if (drag?.id !== event.pointerId) return;
    const next = angles.valueAsNumber - (event.clientX - drag.x) * 0.45;
    angles.value = String(((next + 180) % 360 + 360) % 360 - 180);
    elevation = Math.max(-65, Math.min(65, elevation + (event.clientY - drag.y) * 0.35));
    drag.x = event.clientX;
    drag.y = event.clientY;
  }, options);
  canvas.addEventListener("lostpointercapture", (event) => {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    canvas.style.cursor = "grab";
  }, options);
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? canvas.clientHeight : 1;
    const next = distance.valueAsNumber * Math.exp(event.deltaY * unit * 0.0015);
    distance.value = String(Math.max(Number(distance.min), Math.min(Number(distance.max), next)));
  }, { ...options, passive: false });
  }
  const aim = document.createElement("input");
  aim.type = "checkbox";
  field("Aimed pose", aim);
  const pin = document.createElement("input");
  pin.type = "checkbox";
  const pinField = field("Pin hand to body", pin);

  const poseName = (): Stance => aim.checked ? "aimed" : "ready";
  const entries = (stance: Stance, state: string, create = false): GripPresets => {
    if (!state) return poses[stance];
    if (!create) return poses.special?.[state]?.[stance] ?? {};
    const states = poses.special ??= {};
    return (states[state] ??= { ready: {}, aimed: {} })[stance];
  };
  const presets = () => entries(poseName(), special.value, true);
  const adjustment = (id: WeaponId) => {
    const normal = poses[poseName()][id];
    const override = special.value ? entries(poseName(), special.value)[id] : undefined;
    return override ? { ...normal, ...override } : normal;
  };
  const current = () => adjustment(weapon)?.[target];
  const save = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(poses)); } catch { /* export still works */ }
  };
  const remember = (control: HTMLInputElement | null = null) => {
    if (control && activeEdit === control) return;
    history.push(structuredClone(poses));
    if (history.length > 100) history.shift();
    activeEdit = control;
    undoButton.disabled = false;
  };
  const controls = (["position", "rotation"] as const).flatMap((kind) => axes.map((axis, index) => {
    const input = document.createElement("input");
    const slider = document.createElement("input");
    const position = kind === "position";
    input.type = "number";
    slider.type = "range";
    input.step = "any";
    slider.step = position ? "0.001" : "1";
    input.min = slider.min = position ? "-0.5" : "-180";
    input.max = slider.max = position ? "0.5" : "180";
    input.style.width = "68px";
    slider.style.width = "100%";
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", columnGap: "8px",
      alignItems: "center", marginTop: "8px",
    });
    const caption = document.createElement("span");
    caption.style.gridColumn = "1 / -1";
    row.append(caption, slider, input);
    panel.append(row);
    const apply = (value: number, control: HTMLInputElement) => {
      if (value === (current()?.[kind][index] ?? 0)) return;
      remember(control);
      const entry = presets()[weapon] ??= {};
      const values = entry[target] ??= structuredClone(current() ?? { position: [0, 0, 0], rotation: [0, 0, 0] });
      values[kind][index] = value;
      save();
    };
    slider.addEventListener("input", () => {
      input.value = slider.value;
      apply(slider.valueAsNumber, slider);
    });
    slider.addEventListener("change", () => { activeEdit = null; });
    input.addEventListener("input", () => {
      if (!input.validity.valid || !Number.isFinite(input.valueAsNumber)) return;
      slider.value = input.value;
      apply(input.valueAsNumber, input);
    });
    input.addEventListener("blur", () => {
      activeEdit = null;
      input.value = String(current()?.[kind][index] ?? 0);
    });
    return { input, slider, caption, row, axis, kind, index };
  }));
  const refresh = () => {
    activeEdit = null;
    weapons.value = weapon;
    targets.value = target;
    if (weapon !== specialWeapon) {
      const states = firstPerson ? undefined : GUNBLADE_STATES[weapon];
      special.replaceChildren(new Option("Normal", ""), ...(states ?? []).map(([id, title]) => new Option(title, id)));
      specialField.style.display = states ? "flex" : "none";
      specialStart = null;
      specialWeapon = weapon;
    }
    const otherPose = aim.checked ? "unaimed" : "aimed";
    copyHands.textContent = `Copy hands to ${otherPose}`;
    copyHandsAndGun.textContent = `Copy hands + gun to ${otherPose}`;
    const preset = current();
    const hand = target === "left" || target === "right";
    const elbow = target === "leftElbow" || target === "rightElbow";
    pinField.style.display = hand && !firstPerson ? "flex" : "none";
    pin.checked = hand && !firstPerson && Boolean(preset?.pinned);
    for (const { input, slider, caption, row, axis, kind, index } of controls) {
      row.hidden = elbow ? kind !== "rotation" || index > 1 : kind === "position" && !hand && target !== "gun";
      row.style.display = row.hidden ? "none" : "grid";
      const label = elbow ? (index === 0 ? "Elbow swivel (°)" : "Elbow bend (°)") : kind === "position"
        ? `${pin.checked ? "Body" : "Offset"} ${axis} (m)`
        : `${hand ? "Wrist" : "Rotation"} ${axis} (°)`;
      if (kind === "position") {
        const limit = hand ? 1.25 : 0.5;
        input.min = slider.min = String(-limit);
        input.max = slider.max = String(limit);
      }
      caption.textContent = label;
      input.setAttribute("aria-label", label);
      slider.setAttribute("aria-label", `${label} slider`);
      input.value = slider.value = String(preset?.[kind][index] ?? 0);
    }
    for (const option of destination.options) {
      option.disabled = option.value === weapon || (option.value !== "all" && !!special.value
        && !GUNBLADE_STATES[option.value as WeaponId]?.some(([state]) => state === special.value));
    }
    if (destination.selectedOptions[0]?.disabled) destination.value = "all";
  };
  weapons.onchange = () => { weapon = weapons.value as WeaponId; selectWeapon(weapon); refresh(); };
  targets.onchange = () => { target = targets.value as AdjustmentTarget; refresh(); };
  aim.onchange = refresh;
  pin.onchange = () => {
    if (target !== "left" && target !== "right") return;
    const position = handPosition(target, pin.checked);
    if (position) {
      const prior = current();
      remember();
      const entry = presets()[weapon] ??= {};
      const connection = prior?.rotationSpace && captureHand(target, pin.checked);
      entry[target] = connection || { position, rotation: prior?.rotation ?? [0, 0, 0], ...(pin.checked ? { pinned: true } : {}) };
      save();
    }
    refresh();
  };

  const button = (label: string, click: () => void) => {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = label;
    el.style.margin = "8px 6px 0 0";
    el.onclick = click;
    panel.append(el);
    return el;
  };
  const undo = () => {
    const previous = history.pop();
    if (!previous) return;
    poses = previous;
    undoButton.disabled = history.length === 0;
    save();
    refresh();
    status.textContent = "Undid the last adjustment.";
  };
  const undoButton = button("Undo", undo);
  undoButton.disabled = true;
  window.addEventListener("keydown", (event) => {
    if ((!event.ctrlKey && !event.metaKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== "z") return;
    event.preventDefault();
    event.stopPropagation();
    undo();
  }, { capture: true, signal: pointerEvents.signal });
  button("Reset adjustment", () => {
    if (!entries(poseName(), special.value)[weapon]?.[target]) return;
    remember();
    const active = presets();
    delete active[weapon]?.[target];
    if (!Object.keys(active[weapon] ?? {}).length) delete active[weapon];
    save();
    refresh();
  });
  button("Export grips", () => {
    const file = new Blob([JSON.stringify({ version: 4, ...(firstPerson ? { view: "first-person" } : {}), poses }, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = firstPerson ? "yeetpowder-first-person-grips.json" : "yeetpowder-third-person-grips.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const copyScope = select("Copy", firstPerson ? ["selected", "all"] as const : ["selected", "feet", "stance", "all"] as const, (scope) => ({
    selected: "Selected adjustment",
    feet: "Both feet",
    stance: "Feet, torso and head",
    all: "All edited parts",
  })[scope]);
  const destination = select("Copy to", ["all", ...TUNING.weaponOrder], (id) => (
    id === "all" ? "All other weapons" : TUNING.weapons[id].name
  ));
  const status = document.createElement("div");
  status.setAttribute("role", "status");
  status.style.marginTop = "6px";
  const copyToOtherPose = (includeGun: boolean) => {
    const source = adjustment(weapon);
    const connections: GripConnections = {
      right: firstPerson ? structuredClone(source?.right ?? { position: [0, 0, 0], rotation: [0, 0, 0] }) : captureHand("right", false),
      left: firstPerson ? structuredClone(source?.left ?? { position: [0, 0, 0], rotation: [0, 0, 0] }) : captureHand("left", false),
    };
    if (!connections.right && !connections.left) {
      status.textContent = "No hands are gripping this weapon in the preview.";
      return;
    }
    remember();
    const other = entries(aim.checked ? "ready" : "aimed", special.value, true);
    const pose = other[weapon] ??= {};
    if (connections.right) pose.right = connections.right;
    if (connections.left) pose.left = connections.left;
    if (includeGun) {
      if (source?.gun) pose.gun = structuredClone(source.gun);
      else delete pose.gun;
    }
    save();
    status.textContent = `Copied grip connections to the ${aim.checked ? "unaimed" : "aimed"} pose.`;
  };
  const copyHands = button("Copy hands to aimed", () => copyToOtherPose(false));
  const copyHandsAndGun = button("Copy hands + gun to aimed", () => copyToOtherPose(true));
  button("Copy adjustments", () => {
    const parts: AdjustmentTarget[] = copyScope.value === "feet" ? ["leftFoot", "rightFoot"]
      : copyScope.value === "stance" ? ["leftFoot", "rightFoot", "torso", "head"]
      : copyScope.value === "all" ? adjustable : [target];
    const active = entries(poseName(), special.value);
    const source = active[weapon];
    const edits = parts.flatMap((part) => source?.[part] ? [[part, source[part]] as const] : []);
    if (!edits.length) {
      status.textContent = "No saved adjustments to copy.";
      return;
    }
    const selected = destination.value;
    const recipients = TUNING.weaponOrder.filter((id) => id !== weapon && (selected === "all" || selected === id)
      && (!special.value || GUNBLADE_STATES[id]?.some(([state]) => state === special.value)));
    const changed = recipients.filter((id) => edits.some(([part, edit]) => (
      JSON.stringify(active[id]?.[part]) !== JSON.stringify(edit)
    )));
    if (changed.length) {
      remember();
      for (const id of changed) {
        const preset = active[id] ??= {};
        for (const [part, edit] of edits) preset[part] = structuredClone(edit);
      }
      save();
    }
    status.textContent = changed.length ? `Copied to ${changed.length} ${changed.length === 1 ? "weapon" : "weapons"}.` : "The selected weapons already match.";
  });
  const importFile = document.createElement("input");
  importFile.type = "file";
  importFile.accept = ".json,application/json";
  importFile.style.maxWidth = "100%";
  importFile.style.minWidth = "0";
  field("Import JSON", importFile);
  const importPoses = async (selectedOnly: boolean) => {
    const file = importFile.files?.[0];
    if (!file) {
      status.textContent = "Choose a grip JSON file first.";
      return;
    }
    const selectedWeapon = weapon;
    const selectedPose = poseName();
    const selectedState = special.value;
    try {
      const data = JSON.parse(await file.text());
      if (firstPerson !== (data?.view === "first-person")) {
        status.textContent = "Choose a grip file for this view.";
        return;
      }
      const shared = readGripPresets(data?.weapons);
      const incoming: EditorPresets = data?.version === 4
        ? readEditorPresets(data.poses)
        : { ready: shared, aimed: structuredClone(shared) };
      const selected = (selectedState ? incoming.special?.[selectedState] : incoming)?.[selectedPose][selectedWeapon];
      const count = [incoming, ...Object.values(incoming.special ?? {})].reduce(
        (sum, bucket) => sum + Object.keys(bucket.ready).length + Object.keys(bucket.aimed).length, 0,
      );
      if (selectedOnly ? !selected : !count) {
        status.textContent = selectedOnly ? "This file has no adjustments for the selected weapon and pose." : "This file has no recognized grip adjustments.";
        return;
      }
      remember();
      if (selectedOnly && selected) {
        const bucket = entries(selectedPose, selectedState, true);
        bucket[selectedWeapon] = { ...bucket[selectedWeapon], ...selected };
      } else {
        poses = incoming;
      }
      save();
      refresh();
      status.textContent = selectedOnly
        ? `Loaded ${TUNING.weapons[selectedWeapon].name} (${selectedPose}).`
        : `Loaded ${count} weapon poses.`;
    } catch {
      status.textContent = "Could not read that grip JSON file.";
    }
  };
  button("Load base file", () => { void importPoses(false); });
  button("Load selected pose", () => { void importPoses(true); });
  panel.append(status);
  refresh();
  host.append(panel);
  return {
    setWeapon(id: WeaponId) { if (weapon !== id) { weapon = id; refresh(); } },
    adjustment(id: WeaponId) { return adjustment(id) ?? null; },
    angle: () => angles.valueAsNumber * Math.PI / 180,
    elevation: () => elevation * Math.PI / 180,
    distance: () => distance.valueAsNumber,
    aiming: () => aim.checked,
    animating: () => animation.checked,
    specialPose(time: number): Partial<PoseInput> {
      const start = specialStart ??= time;
      const phase = (duration: number) => animation.checked
        ? Math.min(0.999, ((time - start) % (duration + 0.25)) / duration) : 0.4;
      switch (special.value) {
        case "hook": return { hook: true };
        case "reap": return { hook: true, flip: phase(0.7), onGround: false };
        case "stance": return { stance: true };
        case "dash": return { stance: true, speed: animation.checked ? 6 : 0 };
        case "raise": return { aim: 1 };
        case "slash": return { slash: phase(0.4) };
        case "ultra": return { slash: phase(0.2) };
        case "grenade": return { slash: phase(0.4), aim: 1 };
        default: return {};
      }
    },
    dispose() {
      pointerEvents.abort();
      if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
      canvas.style.touchAction = touchAction;
      canvas.style.cursor = cursor;
      panel.remove();
    },
  };
}
