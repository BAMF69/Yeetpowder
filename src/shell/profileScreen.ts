import type { Screen, Shell } from "./app";
import { localProfile, saveProfile } from "../game/playerProfile";
import { OPERATORS, playerProfile, type OperatorId } from "../net/profile";
export function profileScreen(shell: Shell): Screen {
  const profile = localProfile(), root = document.createElement("section"); root.className = "screen dim"; root.style.cssText = "color:#e7edf8;font-family:system-ui,sans-serif";
  const form = document.createElement("form"); form.className = "panel narrow"; root.append(form);
  const title = document.createElement("h2"); title.textContent = "Choose your operator"; form.append(title);
  const nameLabel = document.createElement("label"); nameLabel.textContent = "Player name "; nameLabel.style.display = "block";
  const name = document.createElement("input"); name.name = "playerName"; name.maxLength = 20; name.value = profile.name; name.setAttribute("autocomplete", "nickname"); name.style.cssText = "font:inherit;padding:10px;width:90%;margin:10px 0"; nameLabel.append(name); form.append(nameLabel);
  const label = document.createElement("label"); label.textContent = "Operator "; label.style.display = "block";
  const select = document.createElement("select"); select.name = "operator"; select.style.cssText = "font:inherit;padding:10px;width:100%;margin:10px 0";
  for (const [id, op] of Object.entries(OPERATORS)) { const option = document.createElement("option"); option.value = id; option.textContent = op.name; select.append(option); }
  select.value = profile.operator; label.append(select); form.append(label);
  const preview = document.createElement("div"); preview.style.cssText = "font:900 40px system-ui;text-align:center;padding:25px;border:2px solid;margin:15px 0;clip-path:polygon(8% 0,100% 0,92% 100%,0 100%)";
  let closed = false;
  let modelPreview: { select(id: OperatorId): void; dispose(): void } | undefined;
  const portrait = document.createElement("div"); form.append(portrait);
  void import("../game/yeet/operatorPreview").then(({ operatorPreview }) => {
    if (!closed) modelPreview = operatorPreview(portrait, select.value as OperatorId, shell.params.has("noart"));
  }).catch(() => { portrait.textContent = "3D preview unavailable; your operator choice will still be saved."; });
  const update = () => { const op = OPERATORS[select.value as OperatorId]; modelPreview?.select(select.value as OperatorId); preview.textContent = op.name.toUpperCase(); preview.style.color = op.color; preview.style.background = `linear-gradient(125deg,${op.color}35,#101827)`; };
  select.onchange = update; update(); form.append(preview);
  const save = document.createElement("button"); save.type = "submit"; save.textContent = "Save operator"; save.style.cssText = "font:inherit;padding:12px;width:100%;background:#ffd84a;border:0;font-weight:bold";
  const back = document.createElement("button"); back.type = "button"; back.textContent = "Back"; back.onclick = () => shell.back(); back.style.cssText = "font:inherit;padding:10px;width:100%;margin-top:8px";
  form.append(save, back); form.onsubmit = (e) => { e.preventDefault(); saveProfile(playerProfile({ name: name.value, operator: select.value as OperatorId })); shell.back(); };
  root.addEventListener("keydown", (e) => { if (e.key !== "Escape") e.stopPropagation(); });
  return { id: "player-profile", root, cancel: () => shell.back(), enter: () => name.focus(), leave: () => { closed = true; modelPreview?.dispose(); } };
}
