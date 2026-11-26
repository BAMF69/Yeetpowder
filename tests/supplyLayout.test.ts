import { describe, expect, it } from "vitest";
import { levelById, sandboxLevel } from "../src/core/yeet/levels";
import { NO_INPUT, YeetSim } from "../src/core/yeet/sim";
import { TUNING } from "../src/core/yeet/tuning";
const maps=["fight","duel","island","industrial","junkyard","island-party","industrial-party","junkyard-party","coliseum"];
describe("rare arena supplies",()=>{
 it.each(maps)("%s has no shotgun pickups, one grenade and one health pack away from spawns",id=>{
  const level=levelById(id);expect(level.pickups.some(p=>p.weapon==="shotgun")).toBe(false);
  expect(level.pickups.filter(p=>p.weapon==="grenade")).toHaveLength(1);
  const health=level.pickups.filter(p=>p.weapon==="health");expect(health).toHaveLength(1);
  for(const spawn of level.spawns??[level.spawn])expect(Math.hypot(health[0].pos.x-spawn.x,health[0].pos.z-spawn.z)).toBeGreaterThan(6);
  expect(level.startWeapons).toContain("shotgun");
 });
 it("keeps rare cooldowns through solo deaths and snapshots while normal weapons return quickly",()=>{
  const level=sandboxLevel();level.pickups=[{weapon:"grenade",pos:{...level.spawn}},{weapon:"health",pos:{...level.spawn}},{weapon:"sniper",pos:{...level.spawn}}];
  const sim=new YeetSim(structuredClone(TUNING),level);sim.step(NO_INPUT);
  expect(sim.pickups.map(p=>p.respawn)).toEqual([45,60,6]);sim.player.pos.x+=10;
  const peer=new YeetSim(structuredClone(TUNING),structuredClone(level));peer.importState(sim.exportState());
  sim.respawnPlayer(true);expect(sim.pickups[0].taken).toBe(true);expect(sim.pickups[1].taken).toBe(true);sim.player.pos.x+=10;
  for(let i=0;i<Math.ceil(6/TUNING.step)+1;i++)sim.step(NO_INPUT);
  expect(sim.pickups[2].taken).toBe(false);expect(sim.pickups[0].taken).toBe(true);expect(sim.pickups[1].taken).toBe(true);
  peer.importState(sim.exportState());for(let i=0;i<Math.ceil(39/TUNING.step)+2;i++){sim.step(NO_INPUT);peer.step(NO_INPUT);}
  expect(peer.exportState()).toEqual(sim.exportState());expect(sim.pickups[0].taken).toBe(false);expect(sim.pickups[1].taken).toBe(true);
 });
});
