// p45: P3-3 홈 화면 앱·오프라인(PWA) — manifest · 서비스 워커 캐시 · 인터넷 끊겨도 열림 · «홈 화면에 추가» 단추
// 서비스 워커는 file:// 에서 안 돌아서, 작업판 폴더를 localhost 로 잠깐 띄워 시험한다(/ 와 /index.html → app.html).
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const http = require('http'), fs = require('fs'), path = require('path');
const WORK = process.env.WORK || '/home/claude/work';
const FILE = process.env.APP || WORK + '/app.html', DIR = path.dirname(FILE);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp' };
const pngSize = f => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
(async () => {
  const srv = http.createServer((q, s) => {
    let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/' || u === '/index.html') u = '/' + path.basename(FILE);
    const f = path.join(DIR, u);
    if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const URL0 = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };

  /* 파일 */
  const man = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  chk(man.display === 'standalone' && man.start_url === './' && man.short_name === '어디다 두지', `manifest: ${man.short_name} · ${man.display} · 시작 ${man.start_url}`);
  const sizes = man.icons.map(i => { const [w, h] = pngSize(path.join(DIR, i.src)); return `${i.src} ${w}×${h}${i.purpose ? ' ' + i.purpose : ''}` + (i.sizes === `${w}x${h}` ? '' : ' ✗크기'); });
  chk(sizes.every(s => !s.includes('✗')) && man.icons.some(i => i.purpose === 'maskable'), '아이콘: ' + sizes.join(' · '));
  const html = fs.readFileSync(FILE, 'utf8'), sw = fs.readFileSync(path.join(DIR, 'sw.js'), 'utf8');
  const bnum = (html.match(/const BUILD = "([^"]+)"/) || [])[1] || '';
  chk(html.includes('<link rel="manifest" href="manifest.json">') && html.includes('apple-mobile-web-app-capable'), '완성본 머리에 manifest·apple 메타');
  chk(sw.includes('const CACHE = "rp-' + bnum.replace(/[^0-9A-Za-z]+/g, '-') + '"'), 'sw.js 캐시 이름 = 판 번호');

  /* 서비스 워커 · 오프라인 */
  const c = await b.newContext({ viewport: { width: 1600, height: 900 } }); const p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL0); await p.waitForTimeout(600);
  const reg = await p.evaluate(async () => { const r = await Promise.race([navigator.serviceWorker.ready, new Promise(z => setTimeout(z, 8000))]);
    return !!(r && r.active); });
  chk(reg, '서비스 워커 등록·작동');
  await p.waitForTimeout(800);
  const cached = await p.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks.find(k => k.startsWith('rp-')));
    return { keys: ks.filter(k => k.startsWith('rp-')).length, n: (await c.keys()).length }; });
  chk(cached.keys === 1 && cached.n >= 18, `캐시 1개 · 파일 ${cached.n}개(앱·사용법 그림 11·아이콘·manifest)`);
  await p.reload(); await p.waitForTimeout(500);
  chk(await p.evaluate(() => !!navigator.serviceWorker.controller), '다시 열면 서비스 워커가 페이지를 맡음');
  await c.setOffline(true);
  await p.reload(); await p.waitForTimeout(900);
  const off = await p.evaluate(() => ({ v: document.getElementById('introVer').textContent, peek: !!document.getElementById('isPeek') }));
  chk(off.v === bnum && off.peek, '인터넷을 끊고 새로고침해도 열림(판 번호 같음)');
  await p.click('#isPeek'); await p.waitForTimeout(1200);
  if (!(await p.$eval('#guide', n => n.classList.contains('open')))) { await p.click('#helpBtn'); await p.waitForTimeout(400); }
  await p.waitForTimeout(400);
  chk(await p.$eval('#gImg', i => i.complete && i.naturalWidth > 0), '끊긴 채로 사용법 그림도 보임');
  await p.keyboard.press('Escape');
  await p.goto(URL0 + '?from=home'); await p.waitForTimeout(700);
  chk((await p.$eval('#introVer', n => n.textContent)) === bnum, '끊긴 채로 주소 뒤에 ?… 가 붙어도 열림');
  await c.setOffline(false);
  const st = await p.evaluate(() => !!localStorage.getItem('room-planner/3'));
  chk(st, '방 저장(localStorage)은 그대로');
  chk(await p.$eval('#installBtn', n => n.hidden), '데스크톱: «홈 화면에 추가» 단추 없음');
  await c.close();

  /* 폰 — 설치 단추 */
  const phone = ua => b.newContext(Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, ua ? { userAgent: ua } : {}));
  let q = await (await phone()).newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.goto(URL0); await q.waitForTimeout(600);
  chk(await q.$eval('#installBtn', n => n.hidden), '폰(안드로이드 크롬): 설치 신호 전엔 단추 없음');
  await q.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => { window.__asked = 1; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
  await q.click('#isPeek'); await q.waitForTimeout(1300);
  if (await q.$('#guide.open')) { await q.keyboard.press('Escape'); await q.waitForTimeout(300); }
  await q.tap('#tabbar [data-tab="more"]'); await q.waitForTimeout(400);
  const ib = await q.$eval('#installBtn', n => { const r = n.getBoundingClientRect(); return { hidden: n.hidden, h: Math.round(r.height), t: n.textContent.trim() }; });
  chk(!ib.hidden && ib.h >= 32, `설치 신호 → «도구» 에 «${ib.t}» (${ib.h}px)`);
  await q.tap('#installBtn'); await q.waitForTimeout(300);
  chk(await q.evaluate(() => window.__asked === 1) && await q.$eval('#installBtn', n => n.hidden), '누르면 크롬 설치 창 → 설치하면 단추 사라짐');
  await q.context().close();
  q = await (await phone('Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1')).newPage();
  q.on('pageerror', e => errs.push(e.message));
  await q.goto(URL0); await q.waitForTimeout(600);
  await q.click('#isPeek'); await q.waitForTimeout(1300);
  if (await q.$('#guide.open')) { await q.keyboard.press('Escape'); await q.waitForTimeout(300); }
  await q.tap('#tabbar [data-tab="more"]'); await q.waitForTimeout(400);
  await q.tap('#installBtn'); await q.waitForTimeout(300);
  chk((await q.textContent('#toast')).includes('홈 화면에 추가'), '아이폰 사파리: 단추 → «공유 → 홈 화면에 추가» 안내');
  await q.context().close();
  q = await (await phone('Mozilla/5.0 (Linux; Android 14; SM-S918N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36;KAKAOTALK 2410800')).newPage();
  await q.goto(URL0); await q.waitForTimeout(600);
  await q.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => {}; window.dispatchEvent(e); });
  chk(await q.$eval('#installBtn', n => n.hidden), '카톡 인앱: 설치 단추 안 보임(먼저 크롬으로)');
  await q.context().close();

  console.log('\npageerror :', errs.length, errs.slice(0, 3));
  console.log(ok && !errs.length ? '전부 통과' : '실패 있음');
  await b.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
