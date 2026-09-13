import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const name = process.argv[2] || 'chromium';
const root = 'test-results/scene-preservation-' + name;
await mkdir(root, { recursive: true });
const browser = await (name === 'webkit' ? webkit : chromium).launch({headless: true});
const page = await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
await page.goto('http://127.0.0.1:4174/');
const results=[];
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
  }
}
await writeFile(root+'/metrics.json',JSON.stringify({browser:name,results,errors},null,2));
console.log('Browser console errors:', JSON.stringify(errors));
await browser.close();
