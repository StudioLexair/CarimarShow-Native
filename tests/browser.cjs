const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const output=process.env.TEST_OUTPUT||'artifacts';fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await ctx.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.BASE||'https://carimarshow-native.vercel.app';
 await page.goto(base,{waitUntil:'networkidle'});
 await page.locator('.hero h2').waitFor();console.log('HOME',await page.locator('.hero h2').innerText(),'cards',await page.locator('.card').count());
 await page.screenshot({path:path.join(output,'CarimarShow-Escritorio.png'),fullPage:true});
 await page.locator('.save').first().click();await page.waitForTimeout(100);
 await page.goto(base+'/#list');await page.locator('.card').first().waitFor();console.log('LIST',await page.locator('.card').count());
 await page.locator('.poster-link').first().click();await page.locator('.detail-hero').waitFor();console.log('DETAIL cast',await page.locator('.cast .person').count(),'trailer',await page.locator('a[href*="youtube.com/watch"]').count());
 if(await page.locator('.cast .person').count()){await page.locator('.cast .person').first().click();await page.locator('.person-header').waitFor();console.log('PERSON filmography',await page.locator('.card').count());}
 await page.goto(base+'/#search');await page.locator('#query').fill('Tom Hanks');await page.locator('#searchType').selectOption('person');await page.locator('#searchForm button').click();await page.locator('#searchResults .person').first().waitFor();console.log('SEARCH',await page.locator('#searchResults .person').count());
 await page.goto(base+'/#settings');await page.locator('#clearCache').waitFor();console.log('SETTINGS',await page.locator('.stat strong').allTextContents());
 await page.evaluate(async()=>{await navigator.serviceWorker.ready});
 await ctx.setOffline(true);await page.goto(base+'/#home');await page.locator('.hero').waitFor();console.log('OFFLINE reload',await page.locator('.card').count(),await page.locator('.notice').innerText());
 await page.goto(base+'/#list');await page.locator('.card').first().waitFor();console.log('OFFLINE list',await page.locator('.card').count());
 await ctx.setOffline(false);
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1});const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));await mp.goto(base,{waitUntil:'networkidle'});await mp.locator('.hero').waitFor();await mp.screenshot({path:path.join(output,'CarimarShow-Movil.png'),fullPage:true});console.log('MOBILE overflow',await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 await mobile.close();await ctx.close();
 // Primer arranque offline de un contenedor: archivos empaquetados, sin SW ni datos guardados.
 const native=await browser.newContext({serviceWorkers:'block'});const np=await native.newPage();
 await native.route('**/*',async route=>{const u=new URL(route.request().url());if(u.host==='appassets.androidplatform.net'){let file=path.resolve(__dirname,'../public')+(u.pathname==='/'?'/index.html':u.pathname);const ext=file.split('.').pop();const type={html:'text/html',js:'text/javascript',css:'text/css',json:'application/json',png:'image/png',jpg:'image/jpeg',webmanifest:'application/manifest+json'}[ext]||'application/octet-stream';if(fs.existsSync(file))return route.fulfill({status:200,contentType:type,body:fs.readFileSync(file)});}return route.abort();});
 await np.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false}));await np.goto('https://appassets.androidplatform.net/index.html#home');await np.locator('.hero').waitFor();console.log('NATIVE first offline',await np.locator('.card').count(),await np.locator('.hero-image').evaluate(i=>i.complete&&i.naturalWidth>0));await np.locator('.poster-link').first().click();await np.locator('.detail-hero').waitFor();console.log('NATIVE offline detail cast',await np.locator('.cast .person').count());
 console.log('JS ERRORS',JSON.stringify(errors));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
