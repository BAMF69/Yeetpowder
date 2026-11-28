// ---------------------------------------------------------------------------
// hud.ts
// Purpose : The play HUD over the 3D view, in the approved Blast Zone look (2026-11-28, ADR 0009, mockup
//           docs/mockups/hud/index.html): gunmetal plates with cut corners and diamond-plate tread, cream stencil
//           paint for words (Saira Stencil One), Teko for every number, hot pink only for danger and the current
//           slot. Crosshair and hit marker, health with heal uses, weapon plate with ammo and reload, owned-weapon
//           strip, copter heat, stamina, speed (only during launches), cascading stamps ("YEET!", "BONK!"), a quiet
//           feed for knockouts and pickups, a notice line under the crosshair, a damage wedge from the hit's side,
//           the Spin Doctor scope, stars while stunned, speed lines, the controls hint and "Click to play".
// Usage   : const hud = new YeetHud(hostEl, TUNING.weaponOrder); hud.update(dt, state) each frame;
//           hud.pop("YEET!") stamps; hud.feedLine("KNOCKED OUT", name); hud.feedNote("PICKED UP · BOOMSTICK");
//           hud.notice("LAUNCH CAMERA ON"); hud.hurtFlash(bearing); hud.setTouch(onSlot) on phones; hud.dispose().
// Notes   : Two layers, both pointer-events off except their own tap targets:
//             .yh  (z 5) under the touch buttons (z 6): scope, effects, plates, stamps. The scope's black mask must
//                  stay here, below the buttons (the 2026-11-28 bug: lifting this whole layer to z 7 for tappable
//                  slots hid FIRE/AIM under the mask while scoped).
//             .yhT (z 7) above the touch buttons, touch only: the weapon chip, its picker and the owned-weapon strip.
//           Sizes follow ui_scale and text_scale (--ui-scale / --text-scale on <html>, set by the shell).
//           reduce_motion turns stamp motion and speed lines off. Tunables: hudLayout.ts HUD_TUNING.
//           DEBUG: ?hud-demo fires sample stamps, feed lines, a notice and a hit every 2 s (YeetWorld).
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// Updated : 2026-11-28 with Claude (Opus 5.5, claude-opus-5-5): Blast Zone HUD rebuild (ADR 0009)
// ---------------------------------------------------------------------------

import { TUNING, type WeaponId } from "../../core/yeet/tuning";
import { HUD_TUNING, stampSlot, wedgeAt } from "./hudLayout";
import { weaponIconSvg } from "./weaponIcons";
import { TOUCH_HP_WIDTH, TOUCH_STRIP_RIGHT } from "../touchControls";

export interface HudState {
  weapon: number;
  heat: number; // 0..1
  overheated: boolean;
  showHeat: boolean;
  speed: number;
  stunned: boolean;
  locked: boolean;
  autoplay: boolean;
  /** 0..1: how strong the speed lines are. */
  rush: number;
  reduceMotion: boolean;
  /** The Spin Doctor's scope covers the view. */
  scoped: boolean;
  /** Which guns you own (slots of the others are hidden from the strip, dimmed in the picker). */
  owned: boolean[];
  /** 0..1 health, or null when nothing can hurt you (Sandbox). */
  hp: number | null;
  /** Shown big in the middle while knocked out ("" when not). */
  banner: string;
  /** Dummies knocked out this run (Tab shows it; kept for callers), or null. */
  kos: number | null;
  /** The level or match line: shown as a notice whenever it changes (Tab and pause hold the score). */
  level: string;
  /** 0..1 sprint stamina, and whether you are winded (emptied it). */
  stamina: number;
  winded: boolean;
  /** Tumbling: show the tip. */
  tumbling: boolean;
  /** Rounds in the magazine and its size; reload progress 0..1 (0 = not reloading). */
  ammo: number;
  magSize: number;
  reload: number;
  /** A short equipment line under the weapon name (shield stance, the Rocket Axe's grenades), or "". */
  extra?: string;
  /** Health-pack uses and timers (ADR 0007), or undefined to hide the pips. */
  heal?: { uses: number; max: number; applying: number; cooldown: number };
  /** Rounds loaded per weapon slot (the touch picker shows them), or undefined. */
  mags?: number[];
}

/** Diamond-plate tread, toned to gunmetal (the riveted menu style's tread, darker so text sits on it). */
const TREAD = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><g transform='rotate(45 5.5 5.5)'><rect x='1' y='4.2' width='9' height='2.6' rx='1.3' fill='%23000' opacity='.6' transform='translate(.6 .8)'/><rect x='1' y='4.2' width='9' height='2.6' rx='1.3' fill='%23575b62'/><rect x='1.6' y='4.4' width='7.8' height='.8' rx='.4' fill='%23a3a8ae' opacity='.55'/></g><g transform='rotate(-45 16.5 16.5)'><rect x='12' y='15.2' width='9' height='2.6' rx='1.3' fill='%23000' opacity='.6' transform='translate(.6 .8)'/><rect x='12' y='15.2' width='9' height='2.6' rx='1.3' fill='%23575b62'/><rect x='12.6' y='15.4' width='7.8' height='.8' rx='.4' fill='%23a3a8ae' opacity='.55'/></g></svg>")`;

/** The HUD's style sheet (exported for tests/hudStyle.test.ts, which guards the approved look). */
export const HUD_CSS = `
.yh, .yhT { --k: var(--ui-scale, 1); --tk: calc(var(--ui-scale, 1) * var(--text-scale, 1));
  --cream: #e8dcc4; --cream-dim: #a9a08d; --pink: #ff2e88; --ink: #141416;
  --sl: env(safe-area-inset-left, 0px); --sr: env(safe-area-inset-right, 0px);
  --st: env(safe-area-inset-top, 0px); --sb: env(safe-area-inset-bottom, 0px);
  --stencil: "Saira Stencil One", "Black Ops One", Impact, sans-serif; --num: Teko, "Arial Narrow", sans-serif;
  --stamp: "Black Ops One", "Saira Stencil One", Impact, sans-serif;
  position: fixed; inset: 0; pointer-events: none; color: var(--cream); font-family: var(--num); }
.yh { z-index: 5; }
/* the shell's subtitle bar (announcer, sound captions) sits above the bottom plates while playing */
#subtitles { bottom: calc(6vh + 64px); }
.yhT { z-index: 7; }
.yh-num { font-family: var(--num); font-weight: 600; line-height: .8; font-variant-numeric: tabular-nums; }
.yh-sten { font-family: var(--stencil); letter-spacing: .06em; text-transform: uppercase; font-weight: 400; }
.yh-shadow { text-shadow: 0 1px 0 #000, 0 0 6px rgba(0,0,0,.7); }
/* a plate: tread on gunmetal, cut corners, lit top lip, dark bottom lip */
.yh-plate { position: absolute; background: ${TREAD} 0 0 / 13px, linear-gradient(180deg, #34363b, #222327 60%, #1b1c1f);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.16), inset 0 -2px 0 rgba(0,0,0,.6), inset 0 0 0 1px #0d0d0e;
  clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px); }
/* a chip: plain metal (no tread behind small text) */
.yh-chip { position: absolute; background: linear-gradient(180deg, rgba(40,42,46,.88), rgba(20,21,24,.88));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px #0b0b0c;
  clip-path: polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px); }
.yh-rivet { position: absolute; width: 5px; height: 5px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #c9cdd2 0 1px, #5d6168 1.6px, #1d1e21 2.6px); }
.wi { display: block; fill: currentColor; filter: drop-shadow(0 1px 0 #000); }

/* ---- effects (behind everything else in this layer) ---- */
.yh-rush { position: absolute; inset: 0; opacity: 0;
  background: repeating-conic-gradient(from 0deg, rgba(232,220,196,0.45) 0deg 1.2deg, transparent 1.2deg 9deg);
  -webkit-mask: radial-gradient(circle, transparent 38%, #000 75%); mask: radial-gradient(circle, transparent 38%, #000 75%); }
.yh-scope { position: absolute; inset: 0; display: none; --r: min(44vh, 40vw);
  background: radial-gradient(circle var(--r) at 50% 50%, transparent calc(var(--r) - 1px), #000 var(--r)); }
.yh-scope::before, .yh-scope::after { content: ""; position: absolute; background: rgba(0, 0, 0, 0.85); }
.yh-scope::before { left: 50%; top: calc(50% - var(--r)); width: 1px; height: calc(var(--r) * 2); }
.yh-scope::after { top: 50%; left: calc(50% - var(--r)); height: 1px; width: calc(var(--r) * 2); }
.yh-wedge { position: absolute; inset: 0; opacity: 0; transition: opacity 0.35s;
  background: radial-gradient(ellipse 34% 60% at var(--wx, 0%) var(--wy, 50%), rgba(255,46,136,.45), transparent 70%); }
.yh-wedge.on { opacity: 1; transition: none; }
.yh-low { position: absolute; inset: 0; opacity: 0; transition: opacity .4s; box-shadow: inset 0 0 90px rgba(255,46,136,.28); }
.yh-low.on { opacity: 1; }

/* ---- crosshair, hit marker, stars ---- */
.yh-cross { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; transform: translate(-50%, -50%); }
.yh-cross i { position: absolute; background: var(--cream); box-shadow: 0 0 0 1px rgba(0,0,0,.55); }
.yh-cross i:nth-child(1) { left: 10px; top: 0; width: 2px; height: 7px; } .yh-cross i:nth-child(2) { left: 10px; bottom: 0; width: 2px; height: 7px; }
.yh-cross i:nth-child(3) { top: 10px; left: 0; height: 2px; width: 7px; } .yh-cross i:nth-child(4) { top: 10px; right: 0; height: 2px; width: 7px; }
.yh-hit { position: absolute; left: 50%; top: 50%; width: 34px; height: 34px; transform: translate(-50%, -50%) rotate(45deg);
  opacity: 0; transition: opacity 0.12s; }
.yh-hit i { position: absolute; background: var(--pink); box-shadow: 0 0 0 1px rgba(0,0,0,.4); }
.yh-hit i:nth-child(1) { left: 15.5px; top: 0; width: 3px; height: 9px; } .yh-hit i:nth-child(2) { left: 15.5px; bottom: 0; width: 3px; height: 9px; }
.yh-hit i:nth-child(3) { top: 15.5px; left: 0; height: 3px; width: 9px; } .yh-hit i:nth-child(4) { top: 15.5px; right: 0; height: 3px; width: 9px; }
.yh-hit.on { opacity: 1; transition: none; }
.yh-stars { position: absolute; left: 50%; top: 50%; width: 0; height: 0; display: none; }
.yh-stars span { position: absolute; font-size: calc(22px * var(--tk)); color: var(--cream); text-shadow: 0 1px 0 #000;
  transform: translate(-50%, -50%); }

/* ---- stamps: worn rubber-stamp ink; up to three cascade out left and right and fade ---- */
.yh-stamps { position: absolute; left: 50%; top: 34%; width: 0; height: 0; }
.yh-stamp { position: absolute; left: 0; top: 0; white-space: nowrap; font-family: var(--stamp); letter-spacing: .04em;
  font-size: calc(44px * var(--tk)); color: var(--cream); filter: url(#yh-grit); text-shadow: 3px 3px 0 rgba(255,46,136,.55);
  transition: transform .22s cubic-bezier(.2,.9,.3,1.2), opacity .22s; will-change: transform, opacity; }
.yh-stamp b { display: inline-block; font-weight: 400; padding: .06em .32em 0; border: .09em solid currentColor; }
.yh-stamp.red { color: var(--pink); text-shadow: 3px 3px 0 rgba(0,0,0,.55); }
/* impact: stamps for hits that hurt (BONK) land on a pink starburst, inked with the same grit */
.yh-stamp.impact { text-shadow: 3px 3px 0 rgba(0,0,0,.6); }
.yh-stamp.impact::before { content: ""; position: absolute; left: -16%; right: -16%; top: -55%; bottom: -55%; z-index: -1;
  background: var(--pink); opacity: .88; transform: rotate(9deg); clip-path: polygon(50.0% 0.0%, 55.4% 19.5%, 67.1% 3.0%, 68.0% 18.8%, 82.1% 11.7%, 73.7% 30.1%, 93.3% 25.0%, 83.8% 37.7%, 99.2% 41.3%, 81.0% 50.0%, 99.2% 58.7%, 83.8% 62.3%, 93.3% 75.0%, 73.7% 69.9%, 82.1% 88.3%, 68.0% 81.2%, 67.1% 97.0%, 55.4% 80.5%, 50.0% 100.0%, 43.7% 85.5%, 32.9% 97.0%, 34.5% 76.8%, 17.9% 88.3%, 22.4% 73.1%, 6.7% 75.0%, 20.9% 60.6%, 0.8% 58.7%, 14.0% 50.0%, 0.8% 41.3%, 20.9% 39.4%, 6.7% 25.0%, 22.4% 26.9%, 17.9% 11.7%, 34.5% 23.2%, 32.9% 3.0%, 43.7% 14.5%); }
.yh-stamp.gone { opacity: 0 !important; transition: opacity .3s; }
.yh-stamp.land { animation: yh-land .18s ease-out; }
@keyframes yh-land { from { opacity: 0; } to { opacity: 1; } }

/* ---- notice under the crosshair; speed; banner; tip ---- */
.yh-notice { position: absolute; left: 50%; top: calc(50% + 34px); transform: translateX(-50%); white-space: nowrap;
  font: 500 calc(18px * var(--tk))/1 var(--num); letter-spacing: .06em; text-transform: uppercase;
  padding: 4px 10px 1px; background: rgba(14,14,16,.7); opacity: 0; transition: opacity .3s; max-width: 80vw; overflow: hidden; text-overflow: ellipsis; }
.yh-notice.on { opacity: 1; transition: none; }
.yh-speed { position: absolute; left: 50%; top: calc(50% + 64px); transform: translateX(-50%); text-align: center;
  opacity: 0; transition: opacity .25s; }
.yh-speed.on { opacity: 1; }
.yh-speed .yh-num { font-size: calc(34px * var(--tk)); }
.yh-speed .yh-sten { font-size: calc(10px * var(--tk)); color: var(--cream-dim); margin-top: 2px; }
.yh-banner { position: absolute; left: 50%; top: 28%; transform: translate(-50%, -50%); display: none; text-align: center;
  font: 400 calc(34px * var(--tk))/1.1 var(--stencil); letter-spacing: .06em; text-transform: uppercase; color: var(--pink);
  text-shadow: 0 2px 0 #000, 0 0 10px rgba(0,0,0,.8); white-space: nowrap; }
.yh-tip { position: absolute; left: 50%; top: 72%; transform: translateX(-50%); display: none; max-width: 80vw; text-align: center;
  font: 500 calc(18px * var(--tk))/1.15 var(--num); letter-spacing: .05em; text-transform: uppercase; padding: 8px 14px 5px;
  background: rgba(14,14,16,.82); border-left: 3px solid var(--pink); }
.yh-tip em { font-style: normal; color: var(--pink); }
.yh-click { position: absolute; left: 50%; top: 58%; transform: translateX(-50%); padding: 10px 20px 6px;
  font: 400 calc(18px * var(--tk))/1 var(--stencil); letter-spacing: .08em; text-transform: uppercase;
  background: rgba(14,14,16,.82); box-shadow: inset 0 0 0 1px rgba(232,220,196,.4); }

/* ---- feed (top right) and controls hint (top left) ---- */
.yh-feed { position: absolute; right: calc(24px + var(--sr)); top: calc(20px + var(--st)); display: flex; flex-direction: column;
  align-items: flex-end; gap: 3px; }
.yh-feed div { font: 500 calc(17px * var(--tk))/1 var(--num); letter-spacing: .04em; text-transform: uppercase; padding: 4px 8px 2px;
  background: rgba(14,14,16,.72); border-left: 2px solid #55534e; animation: yh-fade 4s forwards; white-space: nowrap; }
.yh-feed em { font-style: normal; color: var(--pink); }
.yh-feed div.me { border-left-color: var(--pink); }
@keyframes yh-fade { 0%, 75% { opacity: 1; } 100% { opacity: 0; } }
.yh-hint { position: absolute; left: calc(24px + var(--sl)); top: calc(58px * var(--k) + var(--st)); /* under the shell's "Esc Pause" prompt */ max-width: 46vw;
  font: 500 calc(15px * var(--tk))/1.35 var(--num); letter-spacing: .04em; color: var(--cream-dim);
  background: rgba(14,14,16,.6); padding: 5px 9px 2px; }
.yh-hint .full { display: none; } .yh-hint.open .full { display: inline; } .yh-hint.open .chip { display: none; }
@media (pointer: coarse) { .yh-hint { display: none; } }
.yh-debugtag { position: absolute; transform: translate(-50%, -100%); font: 12px ui-monospace, monospace; color: #fff;
  background: rgba(0, 0, 0, 0.65); padding: 2px 6px; white-space: nowrap; display: none; }

/* ---- health plate (bottom left) ---- */
.yh-hp { position: absolute; left: calc(28px + var(--sl)); bottom: calc(28px + var(--sb)); width: calc(260px * var(--k));
  height: calc(48px * var(--k)); display: none; }
.yh-hp > .yh-plate { inset: 0; }
.yh-hp .yh-rivet { left: 7px; top: calc(50% - 2.5px); }
.yh-hp .val { position: absolute; left: calc(14px * var(--k)); top: calc(9px * var(--k)); width: calc(52px * var(--tk)); text-align: right; font-size: calc(36px * var(--tk)); }
.yh-hp .lbl { position: absolute; left: calc(74px * var(--k)); top: calc(9px * var(--k)); font-size: calc(11px * var(--tk)); color: var(--cream-dim); }
.yh-rail { position: absolute; height: calc(10px * var(--k)); background: #0e0e10; box-shadow: inset 0 0 0 1px #000, 0 1px 0 rgba(255,255,255,.08); }
.yh-rail b { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(180deg, #ece2cc, #b9ad94); transition: width .15s; }
.yh-rail::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, transparent 0 calc(10% - 2px), #0e0e10 calc(10% - 2px) 10%); }
.yh-hp .yh-rail { left: calc(74px * var(--k)); top: calc(27px * var(--k)); width: calc(120px * var(--k)); }
.yh-hp.low .yh-rail b { background: linear-gradient(180deg, #ff5aa3, #d81f6f); }
.yh-hp.low .val, .yh-hp.low .lbl { color: var(--pink); }
.yh-heal { position: absolute; left: calc(204px * var(--k)); top: calc(9px * var(--k)); width: calc(50px * var(--k)); }
.yh-pips { display: flex; gap: calc(5px * var(--k)); }
.yh-pip { position: relative; width: calc(12px * var(--k)); height: calc(12px * var(--k)); }
.yh-pip::before, .yh-pip::after { content: ""; position: absolute; background: var(--cream); }
.yh-pip::before { left: 33%; top: 0; width: 34%; height: 100%; } .yh-pip::after { top: 33%; left: 0; height: 34%; width: 100%; }
.yh-pip.used::before, .yh-pip.used::after { background: #4b4a47; }
.yh-heal .k { margin-top: calc(6px * var(--k)); font: 500 calc(13px * var(--tk))/1 var(--num); letter-spacing: .06em; color: var(--cream-dim); white-space: nowrap; }
.yh-heal.ready .k { color: var(--cream); }
.yh-stam { position: absolute; left: 0; right: 0; top: calc(-7px * var(--k)); height: calc(3px * var(--k)); background: rgba(0,0,0,.5); transition: opacity .3s; }
.yh-stam b { position: absolute; left: 0; top: 0; bottom: 0; background: var(--cream-dim); }
.yh-stam.winded b { background: var(--pink); }

/* ---- weapon plate and strip (bottom right) ---- */
.yh-wp { position: absolute; right: calc(28px + var(--sr)); bottom: calc(28px + var(--sb)); width: calc(250px * var(--k)); height: calc(64px * var(--k)); }
.yh-wp > .yh-plate { inset: 0; }
.yh-wp .r1 { right: 7px; top: 8px; } .yh-wp .r2 { right: 7px; bottom: 8px; }
.yh-wp .icon { position: absolute; left: calc(14px * var(--k)); top: calc(8px * var(--k)); width: calc(72px * var(--k)); color: var(--cream); }
.yh-wp .name { position: absolute; left: calc(14px * var(--k)); top: calc(40px * var(--k)); font-size: calc(14px * var(--tk)); max-width: calc(150px * var(--k)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.yh-wp .am { position: absolute; right: calc(18px * var(--k)); top: calc(12px * var(--k)); display: flex; align-items: baseline; gap: 2px; }
.yh-wp .ammo { font-size: calc(54px * var(--tk)); }
.yh-wp .mag { font-size: calc(26px * var(--tk)); color: var(--cream-dim); min-width: 1.4em; }
.yh-wp.empty .ammo { color: var(--pink); }
.yh-wp .rl { position: absolute; right: calc(22px * var(--k)); bottom: calc(9px * var(--k)); width: calc(80px * var(--k)); height: 4px; background: #0e0e10; display: none; }
.yh-wp .rl b { position: absolute; left: 0; top: 0; bottom: 0; background: var(--cream); }
.yh-wp .rlt { position: absolute; right: calc(22px * var(--k)); top: calc(4px * var(--k)); font-size: calc(9px * var(--tk)); display: none; }
.yh-wp.reloading .rl, .yh-wp.reloading .rlt { display: block; }
.yh-extra { position: absolute; right: calc(28px + var(--sr)); bottom: calc(28px + var(--sb) + 64px * var(--k) + 44px * var(--k));
  font: 500 calc(15px * var(--tk))/1 var(--num); letter-spacing: .05em; text-transform: uppercase; color: var(--cream-dim);
  text-shadow: 0 1px 0 #000; text-align: right; max-width: 46vw; }
.yh-strip { position: absolute; right: calc(28px + var(--sr)); bottom: calc(28px + var(--sb) + 64px * var(--k) + 8px); display: flex; gap: 3px; }
.yh-slot { position: relative; width: calc(60px * var(--k)); height: calc(34px * var(--k)); color: var(--cream-dim); }
.yh-slot .wi { position: absolute; left: 12%; top: 10%; width: 76%; }
.yh-slot .k { position: absolute; left: 2px; bottom: 0; font: 600 calc(13px * var(--tk))/1 var(--num); color: #7d786d; }
.yh-slot.on { color: var(--cream); }
.yh-slot.on .k { color: var(--pink); }
.yh-slot.on::after { content: ""; position: absolute; left: 4px; right: 4px; bottom: 0; height: 2px; background: var(--pink); }
.yh-slot.locked { display: none; }

/* ---- copter heat (bottom centre) ---- */
.yh-heat { position: absolute; left: 50%; bottom: calc(30px + var(--sb)); width: calc(220px * var(--k)); transform: translateX(-50%); display: none; text-align: center; }
.yh-heat .yh-sten { font-size: calc(11px * var(--tk)); margin-bottom: 4px; text-shadow: 0 1px 0 #000; }
.yh-heat .yh-rail { position: relative; width: 100%; height: calc(6px * var(--k)); }
.yh-heat.hot .yh-sten { color: var(--pink); }
.yh-heat.hot .yh-rail b { background: var(--pink); }

/* =================== touch (phones, tablets): compact corners, nothing in the middle third =================== */
.yh.touch .yh-wp, .yh.touch .yh-strip, .yh.touch .yh-hint, .yh.touch .yh-click { display: none !important; }
/* health chip: top left, after the touch layer's pause button (touchControls.ts places Pause and Heal around it) */
/* the chip grows with text size; touchControls.ts places Heal after it with the same sum (TOUCH_HP_WIDTH) */
.yh.touch .yh-hp { left: calc(52px * var(--k) + var(--sl)); top: calc(10px + var(--st)); bottom: auto; width: ${TOUCH_HP_WIDTH}; height: calc(34px * var(--k)); }
.yh.touch .yh-hp > .yh-plate { background: linear-gradient(180deg, rgba(40,42,46,.88), rgba(20,21,24,.88));
  clip-path: polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px); }
.yh.touch .yh-hp .yh-rivet, .yh.touch .yh-hp .lbl, .yh.touch .yh-heal { display: none !important; } /* the touch Heal chip shows the uses */
.yh.touch .yh-hp .val { left: calc(4px * var(--k)); top: calc(7px * var(--k)); width: calc(42px * var(--tk)); font-size: calc(28px * var(--tk)); }
.yh.touch .yh-hp .yh-rail { left: calc(52px * var(--tk)); top: calc(13px * var(--k)); width: calc(90px * var(--k)); height: calc(8px * var(--k)); }
.yh.touch .yh-stam { top: auto; bottom: calc(-6px * var(--k)); }
.yh.touch .yh-feed { top: calc(52px * var(--k) + var(--st)); right: calc(10px + var(--sr)); }
.yh.touch .yh-feed div { font-size: calc(14px * var(--tk)); }
.yh.touch .yh-feed div:nth-last-child(n+${HUD_TUNING.feedMaxTouch + 1}) { display: none; }
.yh.touch .yh-heat { bottom: auto; top: calc(14px + var(--st)); width: calc(140px * var(--k)); }
.yh.touch .yh-extra { right: calc(10px + var(--sr)); bottom: auto; top: calc(48px * var(--k) + var(--st)); font-size: calc(12px * var(--tk)); max-width: 40vw; }
.yh.touch .yh-stamp { font-size: calc(30px * var(--tk)); }
.yh.touch .yh-banner { font-size: calc(24px * var(--tk)); }
.yh.touch .yh-notice, .yh.touch .yh-tip { font-size: calc(14px * var(--tk)); }

/* the weapon chip (top right): tap to open the picker */
.yhT .yh-wchip { position: absolute; right: calc(10px + var(--sr)); top: calc(10px + var(--st)); width: calc(132px * var(--k)); height: calc(34px * var(--k));
  pointer-events: auto; touch-action: manipulation; }
.yhT .yh-wchip > .yh-chip { inset: 0; }
.yhT .yh-wchip .wi { position: absolute; left: calc(6px * var(--k)); top: calc(7px * var(--k)); width: calc(52px * var(--k)); color: var(--cream); }
.yhT .yh-wchip .am { position: absolute; left: calc(64px * var(--k)); top: calc(7px * var(--k)); display: flex; align-items: baseline; gap: 1px; }
.yhT .yh-wchip .ammo { font-size: calc(30px * var(--tk)); }
.yhT .yh-wchip .mag { font-size: calc(17px * var(--tk)); color: var(--cream-dim); }
.yhT .yh-wchip .caret { position: absolute; right: calc(9px * var(--k)); top: calc(13px * var(--k)); border: 5px solid transparent; border-top-color: var(--cream-dim); }
.yhT .yh-wchip.open .yh-chip { box-shadow: inset 0 -2px 0 var(--pink), inset 0 0 0 1px #0b0b0c; }
.yhT .yh-wchip.open .caret { border-top-color: transparent; border-bottom-color: var(--pink); top: calc(8px * var(--k)); }
.yhT .yh-wchip.empty .ammo { color: var(--pink); }
.yhT .yh-wchip .rl { position: absolute; left: calc(64px * var(--k)); bottom: calc(4px * var(--k)); width: calc(40px * var(--k)); height: 3px; background: #0e0e10; display: none; }
.yhT .yh-wchip .rl b { position: absolute; left: 0; top: 0; bottom: 0; background: var(--cream); }
.yhT .yh-wchip.reloading .rl { display: block; }
/* the picker: every weapon, owned ones tappable */
.yhT .yh-picker { position: absolute; right: calc(4px + var(--sr)); top: calc(46px * var(--k) + var(--st)); width: min(calc(290px * var(--k)), 70vw);
  display: none; grid-template-columns: 1fr 1fr; gap: 4px; padding: 6px; pointer-events: auto; touch-action: manipulation;
  max-height: calc(100vh - 140px); overflow-y: auto; }
.yhT .yh-picker.open { display: grid; }
.yhT .yh-pk { position: relative; height: calc(40px * var(--k)); background: rgba(16,17,19,.86); color: var(--cream-dim);
  clip-path: polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px); }
.yhT .yh-pk .wi { position: absolute; left: 8px; top: calc(6px * var(--k)); width: calc(46px * var(--k)); }
.yhT .yh-pk span { position: absolute; left: 8px; bottom: calc(4px * var(--k)); font-size: calc(9px * var(--tk)); white-space: nowrap; max-width: calc(100% - 12px); overflow: hidden; }
.yhT .yh-pk .n { position: absolute; right: 8px; top: calc(8px * var(--k)); font-size: calc(18px * var(--tk)); color: var(--cream); }
.yhT .yh-pk.on { color: var(--cream); box-shadow: inset 0 -2px 0 var(--pink); }
.yhT .yh-pk.locked { opacity: .35; }
/* the strip: owned weapons, bottom right between the move area and the buttons; swipe sideways to scroll */
.yhT .yh-tstrip { position: absolute; right: calc(${TOUCH_STRIP_RIGHT} + var(--sr)); bottom: calc(10px + var(--sb)); display: flex; gap: 4px;
  max-width: min(calc(196px * var(--k)), 34vw); overflow-x: auto; overscroll-behavior: contain; scrollbar-width: none;
  pointer-events: auto; touch-action: pan-x; padding-left: 14px;
  -webkit-mask: linear-gradient(90deg, transparent, #000 16px); mask: linear-gradient(90deg, transparent, #000 16px); }
.yhT .yh-tstrip::-webkit-scrollbar { display: none; }
.yhT .yh-ts { flex: none; width: calc(44px * var(--k)); height: calc(30px * var(--k)); display: grid; place-items: center;
  background: rgba(16,17,19,.62); color: var(--cream-dim);
  clip-path: polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px); }
.yhT .yh-ts .wi { width: 82%; }
.yhT .yh-ts.on { color: var(--cream); box-shadow: inset 0 -2px 0 var(--pink); }
.yhT .yh-ts.locked { display: none; }
.yhT.scoped .yh-tstrip { opacity: .5; }
`;

/** Rubber-stamp erosion: noise pits the ink and roughens the edges (approved values, mockup v2). */
const GRIT_SVG = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<filter id="yh-grit" x="-10%" y="-20%" width="120%" height="140%">
<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" result="n"/>
<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.75" result="holes"/>
<feComposite in="SourceGraphic" in2="holes" operator="in" result="pitted"/>
<feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="1" seed="3" result="w"/>
<feDisplacementMap in="pitted" in2="w" scale="2.5"/></filter></defs></svg>`;

const el = (cls: string, parent: HTMLElement, text = ""): HTMLDivElement => {
  const d = document.createElement("div");
  d.className = cls;
  if (text) d.textContent = text;
  parent.append(d);
  return d;
};

const setText = (e: HTMLElement, t: string): void => { if (e.textContent !== t) e.textContent = t; };

interface Stamp { el: HTMLDivElement; side: -1 | 1; t: number }

export class YeetHud {
  private readonly root: HTMLDivElement;
  /** The tap layer above the touch buttons (touch only). */
  private top: HTMLDivElement | null = null;
  private tag: HTMLDivElement | null = null;
  private readonly style: HTMLStyleElement;
  private readonly weapons: WeaponId[];
  private readonly hit: HTMLDivElement;
  private readonly stars: HTMLDivElement;
  private readonly slots: HTMLDivElement[] = [];
  private readonly heat: HTMLDivElement;
  private readonly heatFill: HTMLElement;
  private readonly heatLbl: HTMLDivElement;
  private readonly speed: HTMLDivElement;
  private readonly speedNum: HTMLDivElement;
  private readonly feed: HTMLDivElement;
  private readonly stampBox: HTMLDivElement;
  private readonly stamps: Stamp[] = [];
  private stampN = 0;
  private readonly notices: HTMLDivElement;
  private noticeT = 0;
  private lastLevel = "";
  private readonly rush: HTMLDivElement;
  private readonly click: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly scope: HTMLDivElement;
  private readonly cross: HTMLDivElement;
  private readonly hp: HTMLDivElement;
  private readonly hpVal: HTMLDivElement;
  private readonly hpFill: HTMLElement;
  private readonly heal: HTMLDivElement;
  private readonly pips: HTMLDivElement[] = [];
  private readonly healKey: HTMLDivElement;
  private readonly wedge: HTMLDivElement;
  private readonly low: HTMLDivElement;
  private readonly banner: HTMLDivElement;
  private readonly stam: HTMLDivElement;
  private readonly stamFill: HTMLElement;
  private readonly tip: HTMLDivElement;
  private readonly wp: HTMLDivElement;
  private readonly wpIcon: HTMLDivElement;
  private readonly wpName: HTMLDivElement;
  private readonly wpAmmo: HTMLDivElement;
  private readonly wpMag: HTMLDivElement;
  private readonly wpBar: HTMLElement;
  private readonly extra: HTMLDivElement;
  // touch pieces (made by setTouch)
  private chip: { root: HTMLDivElement; icon: HTMLDivElement; ammo: HTMLDivElement; mag: HTMLDivElement; bar: HTMLElement } | null = null;
  private picker: HTMLDivElement | null = null;
  private readonly pickerItems: HTMLDivElement[] = [];
  private readonly stripItems: HTMLDivElement[] = [];
  private strip: HTMLDivElement | null = null;
  private onSlot: ((i: number) => void) | null = null;
  private readonly off: Array<() => void> = [];
  private shownWeapon = -1;
  private stripShown = -1;
  private hitT = 0;
  private hurtT = 0;
  private starT = 0;
  private speedT = 0;
  private reduceMotion = false;
  private scoped = false;
  /** DEBUG ?hud-demo: stamps stay up so a slow headless capture can see the cascade. */
  private holdStamps = false;

  constructor(host: HTMLElement, weapons: readonly WeaponId[]) {
    this.weapons = [...weapons];
    this.style = document.createElement("style");
    this.style.textContent = HUD_CSS;
    document.head.append(this.style);
    this.root = el("yh", host);
    this.root.insertAdjacentHTML("beforeend", GRIT_SVG);
    // effects first (drawn underneath)
    this.rush = el("yh-rush", this.root);
    this.scope = el("yh-scope", this.root);
    this.wedge = el("yh-wedge", this.root);
    this.low = el("yh-low", this.root);
    this.cross = el("yh-cross", this.root);
    this.cross.innerHTML = "<i></i><i></i><i></i><i></i>";
    this.hit = el("yh-hit", this.root);
    this.hit.innerHTML = "<i></i><i></i><i></i><i></i>";
    this.stars = el("yh-stars", this.root);
    for (let i = 0; i < 5; i++) {
      const s = document.createElement("span");
      s.textContent = "★";
      this.stars.append(s);
    }
    this.stampBox = el("yh-stamps", this.root);
    this.notices = el("yh-notice", this.root);
    this.speed = el("yh-speed", this.root);
    this.speedNum = el("yh-num yh-shadow", this.speed);
    el("yh-sten", this.speed, "YETERS / S");
    this.banner = el("yh-banner", this.root);
    this.tip = el("yh-tip", this.root);
    this.tip.innerHTML = "Plant your feet to avoid getting blown off balance by <em>YEETPOWDER</em>";

    // health plate
    this.hp = el("yh-hp", this.root);
    el("yh-plate", this.hp);
    el("yh-rivet", this.hp);
    this.stam = el("yh-stam", this.hp);
    this.stamFill = document.createElement("b");
    this.stam.append(this.stamFill);
    this.hpVal = el("val yh-num yh-shadow", this.hp);
    el("lbl yh-sten", this.hp, "HEALTH");
    const rail = el("yh-rail", this.hp);
    this.hpFill = document.createElement("b");
    rail.append(this.hpFill);
    this.heal = el("yh-heal", this.hp);
    const pips = el("yh-pips", this.heal);
    for (let i = 0; i < TUNING.supplies.healthUses; i++) this.pips.push(el("yh-pip", pips));
    this.healKey = el("k", this.heal, "V · HEAL");

    // weapon plate, strip and equipment line
    this.wp = el("yh-wp", this.root);
    el("yh-plate", this.wp);
    el("yh-rivet r1", this.wp);
    el("yh-rivet r2", this.wp);
    this.wpIcon = el("icon", this.wp);
    this.wpName = el("name yh-sten yh-shadow", this.wp);
    const am = el("am", this.wp);
    this.wpAmmo = el("ammo yh-num yh-shadow", am);
    this.wpMag = el("mag yh-num", am);
    const rl = el("rl", this.wp);
    this.wpBar = document.createElement("b");
    rl.append(this.wpBar);
    el("rlt yh-sten", this.wp, "RELOADING");
    this.extra = el("yh-extra", this.root);
    const strip = el("yh-strip", this.root);
    this.weapons.forEach((w, i) => {
      const s = el("yh-slot", strip);
      s.innerHTML = `${weaponIconSvg(w)}<span class="k">${(i + 1) % 10}</span>`;
      this.slots.push(s);
    });

    this.heat = el("yh-heat", this.root);
    this.heatLbl = el("yh-sten", this.heat, "COPTER YEAT");
    const heatRail = el("yh-rail", this.heat);
    this.heatFill = document.createElement("b");
    heatRail.append(this.heatFill);

    // playtest (tablet duel): the full list took too much screen, so it starts as a chip and H opens it
    this.hint = el("yh-hint", this.root);
    el("chip", this.hint, "H · controls");
    el("full", this.hint,
      "WASD move · Space jump · Left click fire (aim at the floor to launch!) · Right click aim / brace shield · Shift sprint · R reload · V use health pack · 0 shield + pistol · 1–9 or wheel switch weapons · F slash / hold move · C launch camera · Backspace respawn · Esc pause · H hide");
    this.feed = el("yh-feed", this.root);
    this.click = el("yh-click", this.root, "Click to play");
  }

  /**
   * Touch controls are on: the HUD goes compact (health chip top left, weapon chip top right) and a tap layer above
   * the touch buttons gets the weapon chip (tap: picker), the picker and the owned-weapon strip (tap: switch, swipe:
   * scroll). The scope and effects stay in the lower layer, under the buttons.
   */
  setTouch(onSlot: (i: number) => void): void {
    this.root.classList.add("touch");
    this.onSlot = onSlot;
    const top = el("yhT", this.root.parentElement ?? document.body);
    this.top = top;
    // chip
    const root = el("yh-wchip", top);
    root.setAttribute("role", "button");
    root.setAttribute("aria-label", "Weapons");
    el("yh-chip", root);
    const icon = el("", root);
    const am = el("am", root);
    const ammo = el("ammo yh-num yh-shadow", am);
    const mag = el("mag yh-num", am);
    el("caret", root);
    const rl = el("rl", root);
    const bar = document.createElement("b");
    rl.append(bar);
    this.chip = { root, icon, ammo, mag, bar };
    this.listen(root, "pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.togglePicker();
    });
    // picker
    this.picker = el("yh-picker", top);
    this.weapons.forEach((w, i) => {
      const it = el("yh-pk", this.picker!);
      it.innerHTML = `${weaponIconSvg(w)}<span class="yh-sten">${TUNING.weapons[w].name}</span><b class="n yh-num"></b>`;
      this.listen(it, "pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (it.classList.contains("locked")) return;
        this.onSlot?.(i);
        this.togglePicker(false);
      });
      this.pickerItems.push(it);
    });
    // a tap anywhere else closes the picker (the tap still does its own job)
    this.listen(window, "pointerdown", (e) => {
      if (!this.picker?.classList.contains("open")) return;
      const t = e.target as Node | null;
      if (t && (this.picker.contains(t) || root.contains(t))) return;
      this.togglePicker(false);
    }, true);
    // strip: a tap switches, a sideways swipe scrolls (native overflow scrolling)
    this.strip = el("yh-tstrip", top);
    this.weapons.forEach((w, i) => {
      const it = el("yh-ts", this.strip!);
      it.innerHTML = weaponIconSvg(w);
      it.setAttribute("aria-label", TUNING.weapons[w].name);
      let x0 = 0, y0 = 0, id = -1;
      this.listen(it, "pointerdown", (e) => { id = e.pointerId; x0 = e.clientX; y0 = e.clientY; e.stopPropagation(); });
      this.listen(it, "pointerup", (e) => {
        if (e.pointerId !== id) return;
        id = -1;
        if (Math.hypot(e.clientX - x0, e.clientY - y0) > HUD_TUNING.stripTapSlop) return; // a swipe, not a tap
        this.onSlot?.(i);
      });
      this.listen(it, "pointercancel", () => (id = -1)); // the browser took the finger to scroll
      this.stripItems.push(it);
    });
  }

  private togglePicker(open?: boolean): void {
    if (!this.picker || !this.chip) return;
    const on = open ?? !this.picker.classList.contains("open");
    this.picker.classList.toggle("open", on);
    this.chip.root.classList.toggle("open", on);
  }

  /** Is the touch weapon picker open (tests, the world's pause logic)? */
  pickerOpen(): boolean {
    return !!this.picker?.classList.contains("open");
  }

  private listen<K extends keyof WindowEventMap>(t: EventTarget, type: K, fn: (e: WindowEventMap[K]) => void, capture = false): void {
    const h = fn as EventListener;
    t.addEventListener(type, h, capture);
    this.off.push(() => t.removeEventListener(type, h, capture));
  }

  /** H: open or close the controls list. */
  toggleHint(): void {
    this.hint.classList.toggle("open");
  }

  /**
   * A stamp ("YEET!", "BONK!"): it lands in the middle and pushes the older ones out to their sides (alternating),
   * smaller and fainter; at most HUD_TUNING.stamp.max on screen. Hidden while scoped so the reticle stays clear.
   * `impact`: the hit hurt (BONK): the stamp lands on a pink starburst.
   */
  pop(text: string, red = false, impact = false): void {
    const side: -1 | 1 = this.stampN++ % 2 ? 1 : -1;
    const d = el(`yh-stamp land${red ? " red" : ""}${impact ? " impact" : ""}`, this.stampBox);
    const b = document.createElement("b");
    b.textContent = text;
    d.append(b);
    this.stamps.unshift({ el: d, side, t: 0 });
    while (this.stamps.length > HUD_TUNING.stamp.max) this.stamps.pop()?.el.remove();
    this.placeStamps();
  }

  private placeStamps(): void {
    // the sideways step follows the screen width, so wide stamps on a laptop clear each other and fit on a phone
    const t = { ...HUD_TUNING.stamp, stepX: Math.min(window.innerWidth * HUD_TUNING.stamp.stepVw, HUD_TUNING.stamp.stepMax) };
    this.stamps.forEach((s, age) => {
      const p = stampSlot(age, s.side, t);
      const move = this.reduceMotion ? stampSlot(0, s.side, t) : p;
      s.el.style.transform = `translate(-50%, -50%) translate(${move.x}px, ${move.y}px) scale(${p.scale}) rotate(${p.rot}deg)`;
      s.el.style.opacity = String(p.opacity);
      // reduce_motion: older stamps do not slide; they simply step back and fade where they are
      if (this.reduceMotion && age > 0) s.el.style.opacity = String(p.opacity * 0.6);
    });
  }

  /** A feed line about you: "YOU <em>verb</em> who" (who is set as text, never HTML). */
  feedLine(verb: string, who: string): void {
    const d = el("me", this.feed);
    d.innerHTML = `YOU <em>${verb}</em> `;
    d.append(who);
    this.trimFeed(d);
  }

  /** A quiet feed line (pickups and other news), plain text. */
  feedNote(text: string): void {
    this.trimFeed(el("", this.feed, text));
  }

  private trimFeed(d: HTMLDivElement): void {
    d.addEventListener("animationend", () => d.remove());
    while (this.feed.childElementCount > HUD_TUNING.feedMax) this.feed.firstElementChild?.remove();
  }

  /** A short notice under the crosshair ("LAUNCH CAMERA ON", "+50 HEALTH"); a new one replaces the old. */
  notice(text: string): void {
    setText(this.notices, text);
    this.noticeT = HUD_TUNING.noticeLife;
  }

  hitMarker(): void {
    this.hitT = 0.12;
  }

  /** ?debug: a label at a screen point (x, y from -1 to 1, as Vector3.project gives), or hidden with null. */
  debugTag(text: string | null, x: number, y: number): void {
    if (!text) {
      if (this.tag) this.tag.style.display = "none";
      return;
    }
    if (!this.tag) this.tag = el("yh-debugtag", this.root);
    this.tag.style.display = "block";
    this.tag.textContent = text;
    this.tag.style.left = `${(x * 0.5 + 0.5) * 100}%`;
    this.tag.style.top = `${(0.5 - y * 0.5) * 100}%`;
  }

  /** Taking a hit: a pink wedge on the screen edge facing `bearing` (hudLayout.hitBearing); ahead when unknown. */
  hurtFlash(bearing = 0): void {
    const w = wedgeAt(bearing);
    this.wedge.style.setProperty("--wx", `${w.x}%`);
    this.wedge.style.setProperty("--wy", `${w.y}%`);
    this.hurtT = HUD_TUNING.hurtLife;
  }

  update(dt: number, s: HudState): void {
    if (s.reduceMotion !== this.reduceMotion) { this.reduceMotion = s.reduceMotion; this.placeStamps(); }
    this.hitT = Math.max(0, this.hitT - dt);
    this.hit.classList.toggle("on", this.hitT > 0);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.wedge.classList.toggle("on", this.hurtT > HUD_TUNING.hurtLife * 0.4);

    // stamps age out; the last third of a life fades
    for (let i = this.stamps.length - 1; i >= 0; i--) {
      const st = this.stamps[i];
      if (!this.holdStamps) st.t += dt;
      if (st.t > HUD_TUNING.stamp.life) { st.el.remove(); this.stamps.splice(i, 1); }
      else if (st.t > HUD_TUNING.stamp.life * 0.7) st.el.classList.add("gone");
    }
    this.stampBox.style.display = s.scoped ? "none" : "block";

    // notice: the level line shows whenever it changes (Tab and pause hold the score)
    if (s.level && s.level !== this.lastLevel) { this.lastLevel = s.level; this.notice(s.level); }
    this.noticeT = Math.max(0, this.noticeT - dt);
    this.notices.classList.toggle("on", this.noticeT > 0);

    // health and heal uses
    this.hp.style.display = s.hp === null ? "none" : "block";
    if (s.hp !== null) {
      const hp = Math.max(0, Math.min(1, s.hp));
      setText(this.hpVal, String(Math.round(hp * TUNING.player.hp)));
      this.hpFill.style.width = `${Math.round(hp * 100)}%`;
      const low = hp <= HUD_TUNING.lowHp && hp > 0;
      this.hp.classList.toggle("low", low);
      this.low.classList.toggle("on", low);
    } else this.low.classList.remove("on");
    this.heal.style.display = s.heal ? "block" : "none";
    if (s.heal) {
      const h = s.heal;
      this.pips.forEach((p, i) => p.classList.toggle("used", i >= h.uses));
      setText(this.healKey, h.applying > 0 ? `HEALING ${h.applying.toFixed(1)}S` : h.cooldown > 0 ? `HEAL ${Math.ceil(h.cooldown)}S` : "V · HEAL");
      this.heal.classList.toggle("ready", h.uses > 0 && h.applying === 0 && h.cooldown === 0);
    }
    this.stamFill.style.width = `${Math.round(s.stamina * 100)}%`;
    this.stam.classList.toggle("winded", s.winded);
    this.stam.style.opacity = s.stamina >= 0.999 && !s.winded ? "0" : "1";

    // weapon: plate (desktop) and chip, strip and picker (touch)
    const w = this.weapons[s.weapon];
    if (s.weapon !== this.shownWeapon && w) {
      this.shownWeapon = s.weapon;
      this.wpIcon.innerHTML = weaponIconSvg(w);
      setText(this.wpName, TUNING.weapons[w].name);
      if (this.chip) this.chip.icon.innerHTML = weaponIconSvg(w);
    }
    const reloading = s.reload > 0;
    const empty = s.ammo === 0 && !reloading;
    setText(this.wpAmmo, String(s.ammo));
    setText(this.wpMag, `/${s.magSize}`);
    this.wp.classList.toggle("reloading", reloading);
    this.wp.classList.toggle("empty", empty);
    this.wpBar.style.width = `${Math.round((1 - s.reload) * 100)}%`;
    setText(this.extra, s.extra ?? "");
    this.slots.forEach((e, i) => {
      e.classList.toggle("on", i === s.weapon);
      e.classList.toggle("locked", !s.owned[i]);
    });
    if (this.chip) {
      setText(this.chip.ammo, String(s.ammo));
      setText(this.chip.mag, `/${s.magSize}`);
      this.chip.root.classList.toggle("reloading", reloading);
      this.chip.root.classList.toggle("empty", empty);
      this.chip.bar.style.width = `${Math.round((1 - s.reload) * 100)}%`;
      this.stripItems.forEach((e, i) => {
        e.classList.toggle("on", i === s.weapon);
        e.classList.toggle("locked", !s.owned[i]);
      });
      if (this.strip && this.stripShown !== s.weapon) { // keep the gun in hand in view
        this.stripShown = s.weapon;
        const on = this.stripItems[s.weapon];
        if (on) this.strip.scrollLeft = Math.max(0, on.offsetLeft - (this.strip.clientWidth - on.offsetWidth) / 2);
      }
      if (this.pickerOpen()) this.pickerItems.forEach((e, i) => this.drawPick(e, i, s));
    }
    if (this.top) {
      this.top.classList.toggle("scoped", s.scoped);
      this.top.style.visibility = this.root.style.visibility;
      if (s.banner) this.togglePicker(false); // knocked out: the respawn flow owns the screen
    }

    // copter heat
    this.heat.style.display = s.showHeat ? "block" : "none";
    this.heatFill.style.width = `${Math.round(s.heat * 100)}%`;
    this.heat.classList.toggle("hot", s.overheated);
    setText(this.heatLbl, s.overheated ? "OVERYEATED · COOLING" : "COPTER YEAT");

    // speed: only while you are flying fast, held briefly after
    this.speedT = s.speed > HUD_TUNING.speedShow ? HUD_TUNING.speedHold : Math.max(0, this.speedT - dt);
    this.speed.classList.toggle("on", this.speedT > 0 && !s.scoped);
    if (this.speedT > 0) setText(this.speedNum, s.speed.toFixed(1));

    this.tip.style.display = s.tumbling ? "block" : "none";
    this.banner.style.display = s.banner ? "block" : "none";
    setText(this.banner, s.banner);
    this.rush.style.opacity = s.reduceMotion ? "0" : String(Math.min(0.85, s.rush));
    this.click.style.display = s.locked || s.autoplay ? "none" : "block";
    this.scoped = s.scoped;
    this.scope.style.display = s.scoped ? "block" : "none";
    this.cross.style.display = s.scoped ? "none" : "block";
    this.stars.style.display = s.stunned ? "block" : "none";
    if (s.stunned) {
      this.starT += dt;
      [...this.stars.children].forEach((c, i) => {
        const a = this.starT * 6 + (i / 5) * Math.PI * 2;
        (c as HTMLElement).style.left = `${Math.cos(a) * 48}px`;
        (c as HTMLElement).style.top = `${Math.sin(a) * 20 - 30}px`;
      });
    }
  }

  private drawPick(e: HTMLDivElement, i: number, s: HudState): void {
    e.classList.toggle("on", i === s.weapon);
    e.classList.toggle("locked", !s.owned[i]);
    const n = e.querySelector(".n") as HTMLElement;
    setText(n, s.owned[i] ? String(i === s.weapon ? s.ammo : s.mags?.[i] ?? "") : "");
  }

  /**
   * DEBUG (?hud-demo): sample feedback for checking the look in real play: three cascading stamps, feed lines, a
   * notice, a hit marker and a damage wedge from the left. The world calls it every couple of seconds.
   */
  demo(): void {
    this.holdStamps = true;
    for (const [t, red, hit] of [["YEET!", false, false], ["KABOOM!", true, false], ["BONK!", false, true]] as const) this.pop(t, red, hit);
    this.feedLine("KNOCKED OUT", "Spectre");
    this.feedNote("PICKED UP · Spin Doctor");
    this.notice("LAUNCH CAMERA ON");
    this.hitMarker();
    this.hurtFlash(-Math.PI / 2);
  }

  /** Hide the HUD (level overview, replays, the respawn screen). */
  setVisible(visible: boolean): void {
    this.root.style.visibility = visible ? "visible" : "hidden";
    if (this.top) this.top.style.visibility = this.root.style.visibility;
    if (!visible) this.togglePicker(false);
  }

  /** Is the Spin Doctor scope drawn (tests)? */
  isScoped(): boolean {
    return this.scoped;
  }

  dispose(): void {
    for (const f of this.off) f();
    this.off.length = 0;
    this.top?.remove();
    this.root.remove();
    this.style.remove();
  }
}

// ---------------------------------------------------------------------------
// End of hud.ts
// ---------------------------------------------------------------------------
