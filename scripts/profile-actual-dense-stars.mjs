/* global window, document, Image, performance */
import assert from 'node:assert/strict';
import {webkit} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const out='test-results/dense-starfield';await mkdir(out,{recursive:true});
const browser=await webkit.launch({headless:true});
const beforeImages=new Map(); const comparisons=[]; const motion=[]; const errors=[];
try {
 for(const [round,variant] of ['baseline','candidate','candidate','baseline'].entries()) {
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1.8,reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error' && /WebGL|shader|GL_INVALID/i.test(m.text()))errors.push(m.text());});
  await page.addInitScript(()=>{let state=0xc0ffee;Object.defineProperty(globalThis.crypto,'getRandomValues',{configurable:true,value:(view)=>{const bytes=new Uint8Array(view.buffer,view.byteOffset,view.byteLength);for(let i=0;i<bytes.length;i++){state^=state<<13;state^=state>>>17;state^=state<<5;bytes[i]=state&255;}return view;}});});
  await page.goto(`http://127.0.0.1:${variant==='baseline'?4174:4176}/`);
  await page.evaluate(async()=>{const {DreamGlowRenderer}=await import('/app/dreamGlowRenderer.ts');const render=DreamGlowRenderer.prototype.render;
   DreamGlowRenderer.prototype.render=function(scene,camera,...rest){window.__app={pipeline:this,scene,camera};const at=performance.now();const result=render.call(this,scene,camera,...rest);if(window.__frames)window.__frames.push({at,cpu:performance.now()-at});return result;};
  });
  await page.getByRole('button',{name:'PLAY WITHOUT BROWSER SAVING'}).click();
  await page.locator('.warfare-grid').getByRole('button',{name:/Intelligence and reconnaissance/i}).click();
  for(const [id,value] of [['#strategic-end-state','access'],['#strategic-primary-theory','sun-tzu'],['#strategic-partner-theory','clausewitz'],['#strategic-guardrail','escalation']])await page.locator(id).selectOption(value);
  await page.getByRole('button',{name:'CONTINUE TO FORCE DESIGN',exact:true}).click();
  for(const label of ['Fleet aviation ship','Multi-role frigate','Air-independent patrol submarine'])await page.getByRole('button',{name:'Add one '+label,exact:true}).click();
  await page.getByRole('button',{name:'EMBARKED AVIATION',exact:true}).click();
  for(const label of ['Deck-launched multirole aircraft','Maritime mission helicopter'])await page.getByRole('button',{name:'Add one '+label,exact:true}).click();
  await page.waitForTimeout(700);
  if(round<2) for(const time of ['dawn','day','dusk','night']) {
   await page.locator('.time-control').getByRole('button',{name:time,exact:true}).click();
   for(const view of ['stars','sky','air-side','air-overhead','surface','subsurface']) {
    await page.locator('.depth-control').getByRole('button',{name:view.startsWith('air')?'air':view,exact:true}).click();
    if(view.startsWith('air')){const plot=page.locator('.battlefield-canvas');await plot.focus();for(let i=0;i<20;i++)await plot.press(view==='air-side'?'ArrowDown':'ArrowUp');}
    const label=`${time}-${view}`;
    const r=await page.evaluate(()=>{const {pipeline,scene,camera}=window.__app;pipeline.render(scene,camera,scene.getObjectByName('procedural-starfield'));const gl=pipeline.renderer.getContext();return {capture:pipeline.renderer.domElement.toDataURL(),total:Number(document.querySelector('.battlefield-canvas').dataset.starfieldStars),submitted:scene.getObjectByName('distant-faceted-star-points')?.count??0,sources:pipeline.renderedSubjects,status:pipeline.status,error:gl.getError()};});
    await writeFile(`${out}/app-${variant}-${label}.png`,Buffer.from(r.capture.split(',')[1],'base64'));
    assert.equal(r.error,0);
    if(variant==='baseline')beforeImages.set(label,r);
    else {
     const b=beforeImages.get(label);assert.ok(b);assert.equal(r.total,b.total,'canonical density changed');assert.equal(r.sources,b.sources,'glow source lost');assert.equal(r.status,b.status,'glow disabled');
     const diff=await page.evaluate(async({b,a})=>{const decode=async(raw)=>{const i=new Image();i.src=raw;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};const [left,right]=await Promise.all([decode(b),decode(a)]);let changed=0,bad=0,max=0;for(let i=0;i<left.length;i+=4){let d=0;for(let c=0;c<4;c++)d=Math.max(d,Math.abs(left[i+c]-right[i+c]));if(d)changed++;if(d>1)bad++;max=Math.max(max,d);}return {changed,bad,max};},{b:b.capture,a:r.capture});
     comparisons.push({label,total:r.total,baselineSubmitted:b.submitted,candidateSubmitted:r.submitted,sources:r.sources,status:r.status,...diff});console.log('app-compare',JSON.stringify(comparisons.at(-1)));
     assert.equal(diff.bad,0,'complete application pixels changed');
    }
   }
  }
  await page.locator('.time-control').getByRole('button',{name:'night',exact:true}).click();
  await page.emulateMedia({reducedMotion:'no-preference'});
  for(const view of ['stars','air']){
   await page.locator('.depth-control').getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(2000);
   await page.evaluate(()=>{window.__frames=[];window.__start=performance.now();});await page.waitForTimeout(6000);
   const r=await page.evaluate(()=>{const frames=window.__frames;window.__frames=null;const {pipeline,scene}=window.__app;return {duration:performance.now()-window.__start,frames,intervals:frames.slice(1).map((f,i)=>f.at-frames[i].at),total:Number(document.querySelector('.battlefield-canvas').dataset.starfieldStars),submitted:scene.getObjectByName('distant-faceted-star-points')?.count??0,sources:pipeline.renderedSubjects,status:pipeline.status};});
   motion.push({round,variant,view,...r});console.log('app-motion',JSON.stringify({round,variant,view,frames:r.frames.length,total:r.total,submitted:r.submitted,duration:r.duration}));assert.ok(r.frames.length>0);
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);
}finally{await writeFile(out+'/application-results.json',JSON.stringify({comparisons,motion,errors},null,2));await browser.close();}
