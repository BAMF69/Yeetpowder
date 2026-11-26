import { describe, expect, it } from "vitest";
import source from "../data/yeet/third-person-grips.json";
import { calibratedGrip, THIRD_PERSON_GRIPS } from "../src/game/yeet/thirdPersonGrips";
import { inputFromPlayer, type PoseInput } from "../src/game/yeet/operativePose";
import { YeetSim } from "../src/core/yeet/sim";
import { sandboxLevel } from "../src/core/yeet/levels";
import { TUNING, type WeaponId } from "../src/core/yeet/tuning";
const base: PoseInput={weapon:"pistol",speed:0,onGround:true,aim:0,pitch:0,fling:0,tumbling:false,dead:false,kneel:0};
describe("Shane's version-4 third-person grips",()=>{
 it("uses all eighteen exact ready/aimed weapon presets",()=>{
  for(const stance of ["ready","aimed"] as const) for(const [weapon,preset] of Object.entries(source.poses[stance])) {
   expect(calibratedGrip({...base,weapon:weapon as WeaponId,aim:stance==="aimed"?1:0})).toEqual(preset);
  }
 });
 it("blends matching spaces while keeping metre offsets and degree rotations",()=>{
  const grip=calibratedGrip({...base,aim:0.25})!;
  expect(grip.right!.position[0]).toBeCloseTo(0.09+(0.088-0.09)*0.25);
  expect(grip.right!.rotation[0]).toBeCloseTo(-14+(18+14)*0.25);
 });
 it("layers gunblade special states over their base hold and keeps copied wrist spaces",()=>{
  expect(calibratedGrip({...base,weapon:"reaper",hook:true})!.right).toEqual(source.poses.special.hook.ready.reaper.right);
  expect(calibratedGrip({...base,weapon:"reaper",hook:true,flip:0.4})!.gun).toEqual(source.poses.special.reap.ready.reaper.gun);
  expect(calibratedGrip({...base,weapon:"sakura",slash:0.4})!.gun).toEqual(source.poses.special.slash.ready.sakura.gun);
  expect(calibratedGrip({...base,weapon:"sakura",stance:true})!.gun).toEqual(source.poses.special.stance.ready.sakura.gun);
 });
 it("keeps calibrated holds while moving and reloading",()=>{
  expect(calibratedGrip({...base,speed:8})).toEqual(calibratedGrip(base));
  const sim=new YeetSim(structuredClone(TUNING),sandboxLevel());sim.player.weapon="sniper";sim.player.reloading=1;
  expect(calibratedGrip(inputFromPlayer(sim.player,sim.time,0,0))).toEqual(THIRD_PERSON_GRIPS.ready.sniper);
 });
 it("leaves shield, treatment and knockout poses independent",()=>{
  expect(calibratedGrip({...base,weapon:"shield"})).toBeNull();expect(calibratedGrip({...base,healing:true})).toBeNull();expect(calibratedGrip({...base,dead:true})).toBeNull();
 });
});
