/* Actual app animation. No readPixels/gl.finish occurs in timing windows. */
import { webkit } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='test-results/glow-performance';await mkdir(out,{recursive:true});
const browser=await webkit.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1.8,reducedMotion:'no-preference'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));const records=[];
try{
 await page.goto('http://127.0.0.1:4174/');
 await page.evaluate(async()=>{
  const {DreamGlowRenderer}=await import('/app/dreamGlowRenderer.ts');const render=DreamGlowRenderer.prototype.render;
  DreamGlowRenderer.prototype.render=function(scene,camera){window.__glow={pipeline:this,scene,camera};const start=performance.now();
   const result=window.__useBaseline&&window.__baseline?window.__baseline.render(scene,camera):render.call(this,scene,camera);
   if(window.__frames)window.__frames.push({at:start,submission:performance.now()-start});return result;
  };
 });
 await page.getByRole('button',{name:'PLAY WITHOUT BROWSER SAVING'}).click();
 await page.locator('.warfare-grid').getByRole('button',{name:/Intelligence and reconnaissance/i}).click();
 for(const [id,value] of [['#strategic-end-state','access'],['#strategic-primary-theory','sun-tzu'],['#strategic-partner-theory','clausewitz'],['#strategic-guardrail','escalation']])await page.locator(id).selectOption(value);
 await page.getByRole('button',{name:'CONTINUE TO FORCE DESIGN',exact:true}).click();
 for(const label of ['Fleet aviation ship','Multi-role frigate','Air-independent patrol submarine'])for(let i=0;i<2;i++)await page.getByRole('button',{name:'Add one '+label,exact:true}).click();
 await page.getByRole('button',{name:'EMBARKED AVIATION',exact:true}).click();
 for(const label of ['Deck-launched multirole aircraft','Maritime mission helicopter'])for(let i=0;i<3;i++)await page.getByRole('button',{name:'Add one '+label,exact:true}).click();
 await page.locator('.time-control').getByRole('button',{name:'night',exact:true}).click();
 await page.locator('.depth-control').getByRole('button',{name:'air',exact:true}).click();await page.waitForTimeout(1000);
 await page.evaluate(async()=>{const {DreamGlowRenderer:Baseline}=await import('/app/dreamGlowBaseline.ts');const {pipeline}=window.__glow;window.__baseline=new Baseline(pipeline.renderer,pipeline.subjects.map(s=>s.root));});
 for(const variant of ['baseline','candidate','candidate','baseline']){
  await page.evaluate(v=>{window.__useBaseline=v==='baseline';},variant);await page.waitForTimeout(1500);
  await page.evaluate(()=>{window.__frames=[];window.__measureStart=performance.now();});await page.waitForTimeout(5000);
  const record=await page.evaluate(()=>{const frames=window.__frames;window.__frames=null;const p=window.__useBaseline?window.__baseline:window.__glow.pipeline;return {duration:performance.now()-window.__measureStart,frames,intervals:frames.slice(1).map((f,i)=>f.at-frames[i].at),sources:p.renderedSubjects,status:p.status,sourcePixels:p.sourceTargetPixels??p.emission.width*p.emission.height};});
  records.push({variant,...record});console.log('motion-comparison',variant,JSON.stringify(record));
  assert.ok(record.frames.length>0);assert.ok(record.sources>0);assert.equal(record.status,'sampled-radial-native-color');
 }
 await page.evaluate(()=>{window.__useBaseline=false;window.__baseline.dispose();window.__baseline=null;});assert.deepEqual(errors,[]);
}finally{await writeFile(out+'/motion-comparison.json',JSON.stringify({browser:'macOS WebKit',records,errors},null,2));await browser.close();}
