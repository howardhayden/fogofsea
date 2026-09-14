/* global window */
import assert from 'node:assert/strict';
import { webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'test-results/dense-starfield'; await mkdir(out, {recursive:true});
const browser = await webkit.launch({headless:true});
const page = await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1.8,reducedMotion:'reduce'});
const errors = []; page.on('pageerror', e => errors.push(e.message));
page.on('console', m => {if(m.type()==='error' && /shader|WebGL|GL_INVALID/i.test(m.text())) errors.push(m.text());});
const visual = []; const timings = [];
try {
 await page.goto('http://127.0.0.1:4176/');
 for (const count of [0, 3072, 15360]) for (const dpr of [1, 1.8]) {
  await page.evaluate(async({count,dpr})=>{const {denseFixture}=await import('/tests/browser/fixtures/denseStarfield.ts');window.__dense=denseFixture(count,dpr);},{count,dpr});
  for (const [time,angle,reduced] of [[0,0,true],[7.3,0.7,false],[51,2.4,false],[201,-3.13,false]]) {
   const r = await page.evaluate(({time,angle,reduced})=>window.__dense.compare(time,angle,reduced),{time,angle,reduced});
   for(const key of ['beforeCapture','afterCapture']) {await writeFile(`${out}/${count}-${dpr}-${time}-${key}.png`, Buffer.from(r[key].split(',')[1],'base64'));delete r[key];}
   visual.push(r); console.log('visual',JSON.stringify(r));
   assert.equal(r.bad,0,'no changed frame pixels above one byte');assert.equal(r.glError,0);
   if(count) assert.ok(r.submitted>0 && r.submitted<count,'conservative offscreen culling must execute');
  }
  if(count && dpr===1.8) for(const orbit of [false,true]) for (const variant of ['baseline','candidate','candidate','baseline']) {
   await page.evaluate(async({variant,orbit})=>window.__dense.measure(variant,orbit,false,600),{variant,orbit});
   const r=await page.evaluate(async({variant,orbit})=>window.__dense.measure(variant,orbit,false,3000),{variant,orbit});
   timings.push(r);console.log('timing',count,orbit,variant,JSON.stringify({duration:r.duration,frames:r.frames.length}));
  }
  await page.evaluate(()=>{window.__dense.dispose();window.__dense=null;});
 }
 assert.deepEqual(errors,[]);
} finally {
 await writeFile(out+'/fixture-results.json',JSON.stringify({visual,timings,errors},null,2)); await browser.close();
}
