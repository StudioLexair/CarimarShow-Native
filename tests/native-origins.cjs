const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
(async()=>{const browser=await chromium.launch({args:['--no-sandbox']});
for(const host of ['appassets.androidplatform.net','carimarshow.local']){
 const ctx=await browser.newContext({serviceWorkers:'block'}),page=await ctx.newPage();const responses=[];
 page.on('response',r=>{if(r.url().includes('/api/tmdb'))responses.push(r.status())});
 await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.host!==host)return route.continue();const file=path.resolve(__dirname,'../public')+(u.pathname==='/'?'/index.html':u.pathname);const ext=file.split('.').pop();const mime={html:'text/html',js:'text/javascript',css:'text/css',json:'application/json',png:'image/png',jpg:'image/jpeg',webmanifest:'application/manifest+json'}[ext]||'application/octet-stream';if(fs.existsSync(file))return route.fulfill({body:fs.readFileSync(file),contentType:mime});return route.fulfill({status:404,body:''})});
 await page.goto('https://'+host+'/index.html#home');await page.locator('.hero').waitFor();console.log('NATIVE ONLINE',host,'responses',responses,'fallback notice',await page.locator('.notice').count());
 await page.goto('https://'+host+'/index.html#search');await page.locator('#query').fill('Tom Hanks');await page.locator('#searchType').selectOption('person');await page.locator('#searchForm button').click();await page.locator('#searchResults .person').first().waitFor();console.log('NATIVE SEARCH',host,await page.locator('#searchResults .person strong').first().innerText());await ctx.close();
}
await browser.close()})().catch(e=>{console.error(e);process.exit(1)});
