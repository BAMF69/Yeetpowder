// Render the actual selectable assets and exercise the real profile form.
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
await mkdir("captures/progress", {recursive:true});
const server = await createServer({logLevel:"silent",server:{host:"127.0.0.1",port:4188,hmr:false,open:false}}); await server.listen();
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1200,height:1440}}); page.setDefaultTimeout(180000);
const errors = [], downloads = [];
page.on("pageerror", e=>errors.push(String(e)));
page.on("console", m=>{if(m.type()==="warn" && m.text().includes("skin: no bone")) errors.push(m.text()); if(m.type()==="error") errors.push(m.text());});
page.on("request",r=>{if(r.url().includes("/models/operators/")) downloads.push(r.url());});
try {
 await page.goto(server.resolvedUrls.local[0],{waitUntil:"domcontentloaded",timeout:180000});
 await page.evaluate(async()=>{
   const {profileScreen}=await import("/src/shell/profileScreen.ts");
   window.qaScreen=profileScreen({params:new URLSearchParams(),back:()=>{}}); document.body.replaceChildren(window.qaScreen.root);
 });
 await page.waitForSelector("select[name=operator]");
 assert.equal(await page.locator("select[name=operator] option").count(),15);
 await page.locator("select[name=operator]").selectOption("ninja");
 await page.waitForFunction(()=>document.querySelector("canvas[aria-label]"));
 await page.evaluate(async()=>{const {loadOperatorArt}=await import("/src/game/yeet/operatorArt.ts");if(!await loadOperatorArt("ninja"))throw Error("Ninja did not load");});
 await page.locator("input[name=playerName]").fill("Rig Test"); await page.getByText("Save operator",{exact:true}).click();
 assert.equal(await page.evaluate(async()=>(await import("/src/game/playerProfile.ts")).localProfile().operator),"ninja");
 assert(downloads.every(url=>url.endsWith("/ninja.glb")),"profile preview must not download the whole catalogue");
 await page.screenshot({path:"captures/progress/operator-profile.png"});
 await page.evaluate(async()=>{
   window.qaScreen.leave();
   const THREE=await import("/node_modules/three/build/three.module.js"), {makeOperative}=await import("/src/game/yeet/operative.ts"), {loadOperatorArt,enableOperatorArt}=await import("/src/game/yeet/operatorArt.ts"), {OPERATOR_MODELS,OPERATORS}=await import("/src/net/profile.ts");
   enableOperatorArt(true); document.body.replaceChildren(); document.body.style.cssText="margin:0;background:#111827;overflow:auto";
   const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1200,1440);document.body.append(renderer.domElement);
   const label=document.createElement("div");label.style.cssText="position:absolute;inset:0;pointer-events:none;color:white;font:bold 18px system-ui";document.body.append(label);
   window.gallery={renderer,items:[]};
   for (const [i,[id]] of Object.entries(Object.keys(OPERATOR_MODELS).map(id=>[id]))) {
     const n=Number(i), x=(n%3)*400,y=Math.floor(n/3)*360;
     const text=document.createElement("div");text.textContent=OPERATORS[id].name;text.style.cssText=`position:absolute;left:${x+14}px;top:${y+12}px`;label.append(text);
     const scene=new THREE.Scene();scene.background=new THREE.Color(0x172336);scene.add(new THREE.HemisphereLight(0xcce9ff,0x605060,2.4));
     const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(2,4,4);scene.add(light);
     const camera=new THREE.PerspectiveCamera(34,400/360,0.1,30);camera.position.set(0,0.15,3.8);camera.lookAt(0,-0.05,0);
     const op=makeOperative("#6286d9");op.setOperator(id);op.useSkin(await loadOperatorArt(id));op.root.rotation.y=0.28;scene.add(op.root);
     window.gallery.items.push({op,scene,camera,x,y});
   }
   window.drawGallery=(pose)=>{
     renderer.setScissorTest(true);
     for (const {op,scene,camera,x,y} of window.gallery.items) {
       op.setPose({weapon:pose===3?"shield":"shotgun",speed:pose===2?7:0,onGround:true,aim:pose===1||pose===3?1:0,pitch:0.15,fling:0,tumbling:false,dead:false,kneel:0});op.update(1,camera);
       renderer.setViewport(x,1440-y-360,400,360);renderer.setScissor(x,1440-y-360,400,360);renderer.render(scene,camera);
     }
   };window.drawGallery(0);
 });
 for(const [pose,name] of ["ready","aimed","running","shield"].entries()) {await page.evaluate(p=>window.drawGallery(p),pose);await page.screenshot({path:`captures/progress/operators-${name}.png`});}
 await page.evaluate(async()=>{
   const {enableOperatorArt,loadOperatorArt}=await import("/src/game/yeet/operatorArt.ts");enableOperatorArt(false);if(await loadOperatorArt("soldier")!==null)throw Error("noart ignored");
   for(const {op}of window.gallery.items)op.dispose();window.gallery.renderer.dispose();
 });
 await page.goto(`${server.resolvedUrls.local[0]}?play&level=industrial`,{waitUntil:"domcontentloaded",timeout:180000});
 await page.waitForFunction(async()=>{const {game}=await import("/src/main.ts");return game.loaded&&game.world?.body?.root.getObjectByName("Spine02");},null,{timeout:180000});
 await page.keyboard.down("KeyW");await page.waitForTimeout(500);await page.keyboard.up("KeyW");
 await page.mouse.down({button:"right"});await page.waitForTimeout(300);await page.mouse.up({button:"right"});await page.keyboard.press("KeyR");
 await page.screenshot({path:"captures/progress/operator-in-game.png"});
 await page.goto(`${server.resolvedUrls.local[0]}?play&level=industrial&noart`,{waitUntil:"domcontentloaded",timeout:180000});
 await page.waitForFunction(async()=>{const {game}=await import("/src/main.ts");return game.loaded&&game.world?.body;},null,{timeout:180000});
 assert.equal(await page.evaluate(async()=>{const {game}=await import("/src/main.ts");return !!game.world.body.root.getObjectByName("Spine02");}),false);
 assert.equal(new Set(downloads).size,11); assert.deepEqual(errors,[]);
 console.log("OPERATOR_BROWSER_OK: 15 profile choices, saved Ninja, lazy downloads, all 11 rendered in ready/aim/run/shield poses, no missing bones, noart honoured");
} finally {await browser.close();await server.close();}

