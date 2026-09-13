/* global document, Image */
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const name = process.argv[2] || 'chromium';
const root = 'test-results/scene-preservation-' + name;
await mkdir(root, { recursive: true });
const browser = await (name === 'webkit' ? webkit : chromium).launch({headless: true});
const page = await browser.newPage({viewport:{width:1440,height:950},reducedMotion:'reduce',deviceScaleFactor:1.8});
const errors=[]; const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const results=[]; const native=[];
try {
  await page.goto('http://127.0.0.1:4174/');
  for (const time of ['dawn','day','dusk','night']) {
    for (const alpha of [false,true]) {
      const result = await page.evaluate(async ({time,alpha})=>{
        const {probeGlowScene}=await import('/tests/browser/fixtures/glowSceneProbe.ts');
        return probeGlowScene(time,alpha);
      },{time,alpha});
      for(const key of ['beforeCapture','afterCapture']) {
        if(result[key]) { await writeFile(`${root}/${time}-alpha-${alpha}-${key}.png`,Buffer.from(result[key].split(',')[1],'base64')); delete result[key]; }
      }
      results.push(result); console.log(JSON.stringify(result));
      assert.equal(result.available,true,'WebGL fixture must execute, not skip');
      assert.equal(result.status,time==='day'?'off':alpha?'sampled-radial-native-color':'core-only-capability');
      assert.deepEqual(result.beforeBackground,result.afterBackground,'background must be byte-identical');
      assert.ok(result.afterCore.every((v,i)=>Math.abs(v-result.beforeCore[i])<=1),'shaded core must survive capture');
      assert.equal(result.darkenedPixels,0,'glow must never erase existing lit pixels');
      assert.ok(result.failures.every(v=>v===0),'framebuffer copy must not emit a GL error');
      assert.equal(result.readError,0);
    }
  }
  // Test the actual production build, not only an isolated emission fixture.
  await page.goto('http://127.0.0.1:4175/');
  await page.getByRole('button',{name:'PLAY WITHOUT BROWSER SAVING'}).click();
  await page.locator('.warfare-grid').getByRole('button',{name:/Intelligence and reconnaissance/i}).click();
  await page.locator('#strategic-end-state').selectOption('access');
  await page.locator('#strategic-primary-theory').selectOption('sun-tzu');
  await page.locator('#strategic-partner-theory').selectOption('clausewitz');
  await page.locator('#strategic-guardrail').selectOption('escalation');
  await page.getByRole('button',{name:'CONTINUE TO FORCE DESIGN',exact:true}).click();
  for(const label of ['Fleet aviation ship','Multi-role frigate','Air-independent patrol submarine']) await page.getByRole('button',{name:'Add one '+label,exact:true}).click();
  await page.getByRole('button',{name:'EMBARKED AVIATION',exact:true}).click();
  for(const label of ['Deck-launched multirole aircraft','Maritime mission helicopter']) await page.getByRole('button',{name:'Add one '+label,exact:true}).click();
  await page.waitForTimeout(800);
  const plot = page.locator('.battlefield-canvas');
  const capture = async (label) => {
    await page.waitForFunction(()=>document.querySelector('.battlefield-canvas')?.getAttribute('data-webgl')==='ready');
    const canvas = plot.locator(':scope > canvas');
    const png = await canvas.screenshot();
    await writeFile(`${root}/app-${label}.png`,png);
    const metrics = await page.evaluate(async (encoded)=>{
      const image=new Image(); image.src='data:image/png;base64,'+encoded; await image.decode();
      const buffer=document.createElement('canvas'); buffer.width=image.width;buffer.height=image.height;
      const ctx=buffer.getContext('2d');ctx.drawImage(image,0,0);
      const pixels=ctx.getImageData(0,0,buffer.width,buffer.height).data;let lit=0;
      for(let i=0;i<pixels.length;i+=4) if(pixels[i]+pixels[i+1]+pixels[i+2]>12)lit++;
      const host=document.querySelector('.battlefield-canvas');
      const gl=host.querySelector(':scope > canvas').getContext('webgl2');
      return {litFraction:lit/(pixels.length/4),width:buffer.width,height:buffer.height,profile:host.dataset.dreamGlowProfile,sources:Number(host.dataset.dreamGlowSources),alpha:gl.getContextAttributes().alpha};
    },png.toString('base64'));
    native.push({label,...metrics}); console.log(label,JSON.stringify(metrics));
    assert.equal(metrics.alpha,true,'production canvas must use RGBA storage');
    assert.ok(metrics.litFraction>0.9,'native scene must not become a black glow-only frame');
    assert.equal(metrics.profile,label.startsWith('day-')?'off':'sampled-radial-native-color');
    if(!label.startsWith('day-'))assert.ok(metrics.sources>0,'native registered entities must render their glow');
  };
  for(const time of ['dawn','day','dusk','night']) {
    await page.locator('.time-control').getByRole('button',{name:time,exact:true}).click();
    await page.locator('.depth-control').getByRole('button',{name:'air',exact:true}).click();
    await plot.focus(); for(let i=0;i<16;i++)await plot.press('ArrowDown');
    await capture(time+'-air-side');
    for(let i=0;i<20;i++)await plot.press('ArrowUp');
    await capture(time+'-air-overhead');
    await page.locator('.depth-control').getByRole('button',{name:'surface',exact:true}).click(); await capture(time+'-surface');
    await page.locator('.depth-control').getByRole('button',{name:'subsurface',exact:true}).click(); await capture(time+'-subsurface');
  }
  assert.deepEqual(pageErrors,[]);
  assert.deepEqual(errors.filter(e=>/WebGL|shader|GL_INVALID/i.test(e)),[]);
} finally {
  await writeFile(root+'/metrics.json',JSON.stringify({browser:name,results,native,errors,pageErrors},null,2));
  await browser.close();
}
