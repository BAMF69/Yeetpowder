// Exercise the production bundle at a GitHub Pages-style subpath, without preview flags or source imports.
import assert from "node:assert/strict";
import { preview } from "vite";
import { chromium } from "playwright";
import { readFile, mkdir } from "node:fs/promises";
const i=process.argv.indexOf("--url"), external=i>=0?process.argv[i+1]:null;
const server=external?null:await preview({base:"/Yeetpowder/",preview:{host:"127.0.0.1",port:4198,open:false}});
const base=external??server.resolvedUrls.local[0];
const manifest=JSON.parse(await readFile("docs/licenses/weapon-sources.json","utf8"));
const expected=manifest.map(row=>row.runtime.replace("public/","")).sort();
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:800,height:500}});page.setDefaultTimeout(180000);
await mkdir("captures/progress",{recursive:true});
await page.addInitScript(()=>localStorage.setItem("pages-art-qa/settings.json",JSON.stringify({version:1,display:{frame_cap:30},telemetry:{consent:"no"}})));
let logs=[],requests=[],errors=[];
page.on("console",m=>{logs.push(m.text());if(m.type()==="error"||m.type()==="warn"&&/did not load|unavailable/.test(m.text()))errors.push(m.text());});
page.on("pageerror",e=>errors.push(String(e)));
page.on("request",r=>requests.push(r.url()));
page.on("response",r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
async function until(check,label){const end=Date.now()+180000;while(!check()){if(Date.now()>end)throw Error(`Timeout ${label}: ${logs.slice(-12).join("\n")}`);await page.waitForTimeout(100);}}
try {
 const maps=["fight","duel","island","industrial","junkyard","island-party","industrial-party","junkyard-party","coliseum"];
 for(const [index,map] of maps.entries()) {
  logs=[];requests=[];errors=[];
  await page.goto(`${base}?data-dir=pages-art-qa&play&level=${map}&weapon=${[0,1,2,3,6,7,8,0,1][index]}`,{waitUntil:"domcontentloaded",timeout:180000});
  await until(()=>logs.some(s=>s.includes(`YEET_LEVEL_READY ${map}`)),map);
  for(const path of expected)assert(requests.some(url=>new URL(url).pathname.endsWith(`/Yeetpowder/${path}`)),`${map}: missing production ${path}`);
  for(const weapon of ["pistol","shotgun","sniper","copter","rocket","grenade"])assert(logs.some(s=>s.includes(`Meshy model in for ${weapon}`)),`${map}: ${weapon} still procedural`);
  assert(!requests.some(url=>url.includes("/assets_src/")),"Production must never fetch staging files");assert.deepEqual(errors,[]);
  // reviewed scenery (2026-11-26 level pass): every outdoor map draws its models from the Pages subpath, no fallbacks
  if(["island","industrial","junkyard","island-party","industrial-party","junkyard-party"].includes(map)){
   const ready=logs.find(s=>s.includes("SCENERY_READY"));assert(ready&&/fallbacks=0 /.test(ready)&&!/instances=0 /.test(ready),`${map}: scenery ${ready}`);
   assert(requests.some(url=>new URL(url).pathname.startsWith("/Yeetpowder/assets/models/scenery/")),`${map}: scenery not served from the Pages subpath`);
  }
  if(["industrial","island-party","junkyard-party","coliseum"].includes(map))await page.screenshot({path:`captures/progress/production-${map}.png`});
  console.log(`PRODUCTION_ART_OK ${map}: nine shipped assets, held/pickup model registration, no preview flag or missing files`);
 }
 logs=[];requests=[];errors=[];
 await page.goto(`${base}?data-dir=pages-art-qa&play&couch=2`,{waitUntil:"domcontentloaded",timeout:180000});
 await until(()=>logs.some(s=>s.includes("YEET_LEVEL_READY")&&s.includes("couch")),"couch");
 for(const path of expected)assert(requests.some(url=>new URL(url).pathname.endsWith(`/Yeetpowder/${path}`)),`couch: missing ${path}`);assert.deepEqual(errors,[]);
 console.log("PRODUCTION_ART_OK couch: shared production models loaded");
 logs=[];requests=[];errors=[];
 await page.goto(`${base}?data-dir=pages-art-qa&play&level=industrial&noart`,{waitUntil:"domcontentloaded",timeout:180000});
 await until(()=>logs.some(s=>s.includes("YEET_LEVEL_READY industrial")),"noart");
 assert(!requests.some(url=>url.includes("/models/approved/")||url.includes("/models/scenery/")));assert.deepEqual(errors,[]);
 console.log("PRODUCTION_ART_OK noart: procedural fallback, no replacement model requests");
} finally {await browser.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));}
