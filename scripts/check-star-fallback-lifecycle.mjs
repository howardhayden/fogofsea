/* global window, document, getComputedStyle */
import assert from 'node:assert/strict';
import { webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const out='test-results/dense-starfield';await mkdir(out,{recursive:true});
const browser=await webkit.launch({headless:true});const results=[];
try {
 for(const port of [4176,4178]) {
  const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'no-preference'});
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(async()=>{const {DreamGlowRenderer}=await import('/app/dreamGlowRenderer.ts');const draw=DreamGlowRenderer.prototype.render;DreamGlowRenderer.prototype.render=function(scene,camera,...rest){window.__app={pipeline:this,scene,camera,rest};return draw.call(this,scene,camera,...rest);};});
  await page.getByRole('button',{name:'PLAY WITHOUT BROWSER SAVING'}).click();
  await page.locator('.time-control').getByRole('button',{name:'night',exact:true}).click();
  await page.locator('.depth-control').getByRole('button',{name:'stars',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.battlefield-canvas')?.dataset.renderedLayer==='stars');
  const r=await page.evaluate(()=>{
   const plot=document.querySelector('.battlefield-canvas');const stars=[...plot.querySelectorAll('.fallback-stars i')];
   const states=()=>[...new Set(stars.map(e=>getComputedStyle(e).animationPlayState))];
   const ready=states(),layer=plot.dataset.renderedLayer,webgl=plot.dataset.webgl;
   delete plot.dataset.renderedLayer;const beforeFrame=states();plot.dataset.renderedLayer=layer;
   plot.dataset.webgl='unavailable';const unavailable=states();plot.dataset.webgl=webgl;
   const {pipeline,scene,camera,rest}=window.__app;pipeline.render(scene,camera,...rest);
   const gl=pipeline.renderer.getContext();const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   let nonopaque=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255)nonopaque++;
   return {port:location.port,stars:stars.length,ready,beforeFrame,unavailable,nonopaque,glError:gl.getError()};
  });
  results.push(r);assert.ok(r.stars>0);assert.deepEqual(r.ready,['paused']);assert.deepEqual(r.beforeFrame,['running']);assert.deepEqual(r.unavailable,['running']);assert.equal(r.nonopaque,0);assert.equal(r.glError,0);await page.close();
  const fallback=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'no-preference'});
  await fallback.addInitScript(()=>{const get=globalThis.HTMLCanvasElement.prototype.getContext;globalThis.HTMLCanvasElement.prototype.getContext=function(type,...args){return /^(webgl2?|experimental-webgl)$/.test(type)?null:get.call(this,type,...args);};});
  await fallback.goto(`http://127.0.0.1:${port}/`);
  await fallback.getByRole('button',{name:'PLAY WITHOUT BROWSER SAVING'}).click();
  await fallback.locator('.time-control').getByRole('button',{name:'night',exact:true}).click();
  await fallback.locator('.depth-control').getByRole('button',{name:'stars',exact:true}).click();
  const noGpu=await fallback.evaluate(()=>({webgl:document.querySelector('.battlefield-canvas').dataset.webgl,states:[...new Set([...document.querySelectorAll('.fallback-stars i')].map(e=>getComputedStyle(e).animationPlayState))]}));
  results.push({port,noGpu});assert.equal(noGpu.webgl,'unavailable');assert.deepEqual(noGpu.states,['running']);
  await fallback.emulateMedia({reducedMotion:'reduce'});
  const reduced=await fallback.evaluate(()=>[...new Set([...document.querySelectorAll('.fallback-stars i')].map(e=>getComputedStyle(e).animationName))]);
  assert.deepEqual(reduced,['none']);results.push({port,reduced});await fallback.close();
 }
} finally {await writeFile(out+'/fallback-lifecycle.json',JSON.stringify(results,null,2));await browser.close();}
