/* Test-only profiling. Synchronous GPU completion is never used by the app. */
import { webkit } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
const out = 'test-results/glow-performance'; await mkdir(out,{recursive:true});
const browser = await webkit.launch({headless:true});
const page = await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1.8,reducedMotion:'reduce'});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:4174/');
 await page.evaluate(async()=>{
   const {DreamGlowRenderer}=await import('/app/dreamGlowRenderer.ts');
   const render=DreamGlowRenderer.prototype.render;
   DreamGlowRenderer.prototype.render=function(scene,camera){window.__glow={pipeline:this,scene,camera};return render.call(this,scene,camera);};
 });
 await page.getByRole('button',{name:'PLAY WITHOUT BROWSER SAVING'}).click();
 await page.locator('.warfare-grid').getByRole('button',{name:/Intelligence and reconnaissance/i}).click();
 for(const [id,value] of [['#strategic-end-state','access'],['#strategic-primary-theory','sun-tzu'],['#strategic-partner-theory','clausewitz'],['#strategic-guardrail','escalation']])await page.locator(id).selectOption(value);
 await page.getByRole('button',{name:'CONTINUE TO FORCE DESIGN',exact:true}).click();
 for(const label of ['Fleet aviation ship','Multi-role frigate','Air-independent patrol submarine'])for(let i=0;i<2;i++)await page.getByRole('button',{name:'Add one '+label,exact:true}).click();
 await page.getByRole('button',{name:'EMBARKED AVIATION',exact:true}).click();
 for(const label of ['Deck-launched multirole aircraft','Maritime mission helicopter'])for(let i=0;i<3;i++)await page.getByRole('button',{name:'Add one '+label,exact:true}).click();
 await page.locator('.time-control').getByRole('button',{name:'night',exact:true}).click();
 await page.locator('.depth-control').getByRole('button',{name:'air',exact:true}).click(); await page.waitForTimeout(600);
 const records=[];
 for(const layer of ['air','surface','subsurface']){
  await page.locator('.depth-control').getByRole('button',{name:layer,exact:true}).click(); await page.waitForTimeout(100);
  const record=await page.evaluate(async()=>{
   const {pipeline,scene,camera}=window.__glow; const r=pipeline.renderer,gl=r.getContext();
   let active=null;const original=r.render.bind(r);
   r.render=(s,c)=>{const start=performance.now();original(s,c);if(active)active.push({kind:s===scene?'full-scene':s===pipeline.screenScene?(pipeline.screenMesh.material===pipeline.glowMaterial?'glow':'composite'):'source',ms:performance.now()-start});};
   const cpu=[],finished=[],steps=[],intervals=[];let last=null;
   const t0=performance.now();pipeline.render(scene,camera);gl.finish();const warmup=performance.now()-t0;
   r.info.autoReset=false;
   for(let i=0;i<12;i++){
    await new Promise(requestAnimationFrame);const now=performance.now();if(last!==null)intervals.push(now-last);last=now;
    r.info.reset();active=[];const start=performance.now();pipeline.render(scene,camera);cpu.push(performance.now()-start);gl.finish();finished.push(performance.now()-start);steps.push(active);active=null;
   }
   const debug=gl.getExtension('WEBGL_debug_renderer_info');
   const result={cpu,finished,intervals,warmup,steps,subjects:pipeline.renderedSubjects,registered:pipeline.subjects.length,draws:r.info.render.calls,triangles:r.info.render.triangles,programs:r.info.programs.length,size:[gl.drawingBufferWidth,gl.drawingBufferHeight],renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unknown',webglError:gl.getError()};
   r.render=original;r.info.autoReset=true;return result;
  });records.push({layer,...record});console.log(layer,JSON.stringify(record));
 }
 await writeFile(out+'/baseline-profile.json',JSON.stringify({browser:'macOS WebKit',records,errors},null,2));
 if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();}
