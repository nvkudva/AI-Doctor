import { chromium } from 'playwright';
const base = process.argv[2], label = process.argv[3] || 'run';
const browser = await chromium.launch();
async function session(role) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [], reqs = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + String(e).slice(0, 160)));
  page.on('response', r => { const u = r.url(); if (u.includes('54321')) reqs.push(r.status() + ' ' + r.request().method() + ' ' + u.replace('http://127.0.0.1:54321', '').split('&select')[0].slice(0, 110)); });
  await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Confirm you are 18 or older').click();
  await page.getByText(role === 'doctor' ? 'Fake doctor' : 'Fake patient').click();
  await page.waitForTimeout(5000);
  console.log(`[${label}/${role}] url=${page.url()}`);
  console.log(`[${label}/${role}] text= ${(await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600)}`);
  if (role === 'doctor') {
    const card = page.locator('button, [role="button"]').filter({ hasText: /min ago|Just now|h ago|d ago/ }).first();
    if (await card.count()) { await card.click(); await page.waitForTimeout(2500);
      console.log(`[${label}/doctor] case url=${page.url()}`);
      console.log(`[${label}/doctor] case= ${(await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600)}`); }
    else console.log(`[${label}/doctor] NO QUEUE CARD`);
  } else {
    await page.goto(base + '/patient/records', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2000);
    console.log(`[${label}/patient] records= ${(await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400)}`);
  }
  console.log(`[${label}/${role}] REQ:\n` + [...new Set(reqs)].join('\n'));
  console.log(`[${label}/${role}] consoleErrors=${errors.length} ${errors.slice(0, 5).join(' | ')}`);
  await ctx.close();
}
await session('doctor'); await session('patient');
await browser.close();
