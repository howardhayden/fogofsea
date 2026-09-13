/* Test-only: baseline and candidate render the identical scene and camera. */
import assert from 'node:assert/strict';
import {webkit} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const out='test-results/glow-performance';await mkdir(out,{recursive:true});
const browser=await webkit.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1.8,reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const records=[];
try{
 await page.goto('http://127.0.0.1:4174/');
 await page.evaluate(async()=>{
  const {DreamGlowRenderer}=await import('/app/dreamGlowRenderer.ts');
  const render=DreamGlowRenderer.prototype.render;window.__instances=new Set();
  DreamGlowRenderer.prototype.render=function(scene,camera){window.__instances.add(this);window.__glow={pipeline:this,scene,camera};return render.call(this,scene,camera);};
 });
 await page.getByRole('button',{name:'PLAY WITHOUT BROWSER SAVING'}).click();
 await page.locator('.warfare-grid').getByRole('button',{name:/Intelligence and reconnaissance/i}).click();
 for(const [id,value] of [['#strategic-end-state','access'],['#strategic-primary-theory','sun-tzu'],['#strategic-partner-theory','clausewitz'],['#strategic-guardrail','escalation']])await page.locator(id).selectOption(value);
 await page.getByRole('button',{name:'CONTINUE TO FORCE DESIGN',exact:true}).click();
 for(const label of ['Fleet aviation ship','Multi-role frigate','Air-independent patrol submarine'])for(let i=0;i<2;i++)await page.getByRole('button',{name:'Add one '+label,exact:true}).click();
 await page.getByRole('button',{name:'EMBARKED AVIATION',exact:true}).click();
 for(const label of ['Deck-launched multirole aircraft','Maritime mission helicopter'])for(let i=0;i<3;i++)await page.getByRole('button',{name:'Add one '+label,exact:true}).click();
 await page.waitForTimeout(600);
 for(const time of ['dawn','day','dusk','night']){
  await page.locator('.time-control').getByRole('button',{name:time,exact:true}).click();
  for(const view of ['air-side','air-overhead','surface','subsurface']){
   await page.locator('.depth-control').getByRole('button',{name:view.startsWith('air')?'air':view,exact:true}).click();
   const plot=page.locator('.battlefield-canvas');
   if(view.startsWith('air')){await plot.focus();for(let i=0;i<20;i++)await plot.press(view==='air-side'?'ArrowDown':'ArrowUp');}
   const record=await page.evaluate(async()=>{
    const {DreamGlowRenderer:Baseline}=await import('/app/dreamGlowBaseline.ts');
    const {pipeline,scene,camera}=window.__glow;const r=pipeline.renderer,gl=r.getContext();
    const baseline=new Baseline(r,pipeline.subjects.map(s=>s.root));
    const read=()=>{const p=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
    const timing=async(p)=>{const start=performance.now();p.render(scene,camera);const submission=performance.now()-start;await new Promise(requestAnimationFrame);return {submission,delivery:performance.now()-start};};
    const beforeFirst=await timing(baseline);baseline.render(scene,camera);const before=read();const beforeCapture=r.domElement.toDataURL('image/png');
    const afterFirst=await timing(pipeline);pipeline.render(scene,camera);const after=read();const afterCapture=r.domElement.toDataURL('image/png');
    let changed=0,bad=0,darkened=0,maximum=0,lit=0;
    for(let i=0;i<before.length;i+=4){let delta=0;for(let c=0;c<3;c++){const d=Math.abs(before[i+c]-after[i+c]);maximum=Math.max(maximum,d);delta=Math.max(delta,d);}if(delta>0)changed++;if(delta>1)bad++;if(after[i]+after[i+1]+after[i+2]<before[i]+before[i+1]+before[i+2]-3)darkened++;if(after[i]+after[i+1]+after[i+2]>12)lit++;}
    const beforeTimings=[],afterTimings=[];for(let i=0;i<12;i++){if(i%2){afterTimings.push(await timing(pipeline));beforeTimings.push(await timing(baseline));}else{beforeTimings.push(await timing(baseline));afterTimings.push(await timing(pipeline));}}
    const sources=[baseline.renderedSubjects,pipeline.renderedSubjects];baseline.dispose();
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    return {beforeFirst,afterFirst,beforeTimings,afterTimings,changed,bad,darkened,maximum,litFraction:lit/(before.length/4),sources,status:pipeline.status,instances:window.__instances.size,glError:gl.getError(),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unknown',beforeCapture,afterCapture};
   });
   for(const key of ['beforeCapture','afterCapture']){await writeFile(`${out}/${time}-${view}-${key}.png`,Buffer.from(record[key].split(',')[1],'base64'));delete record[key];}
   records.push({time,view,...record});console.log(time,view,JSON.stringify(record));
   assert.equal(record.bad,0,'complete frame must preserve approved pixels within one byte');
   assert.equal(record.darkened,0,'no lost scene shading');assert.equal(record.glError,0);assert.equal(record.instances,1,'scene switches must retain one pipeline');
   assert.deepEqual(record.sources,[record.sources[0],record.sources[0]],'no emitters may be dropped');
   assert.equal(record.status,time==='day'?'off':'sampled-radial-native-color');
  }
 }
 assert.deepEqual(errors,[]);
}finally{await writeFile(out+'/comparison.json',JSON.stringify({browser:'macOS WebKit',records,errors},null,2));await browser.close();}
