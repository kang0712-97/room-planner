// p46: ① 폰 고른 가구 줄 «보관(꺼내기)»·«삭제»  ② 사용 측정(GoatCounter) — 무엇을 보내고 무엇을 안 보내는지
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const http = require('http'), fs = require('fs'), path = require('path');
const WORK = process.env.WORK || '/home/claude/work';
const FILE = process.env.APP || WORK + '/app.html', DIR = path.dirname(FILE);
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const st = p => p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')));

  /* ── ① 폰 · 고른 가구 줄 ── */
  for (const W of [390, 360]) {
    const c = await b.newContext({ viewport: { width: W, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + FILE); await p.waitForTimeout(700);
    if (W === 390) { const ver = await p.$eval('#introVer', n => n.textContent); chk(+(ver.match(/p(\d+)/) || [0, 0])[1] >= 46, '판 번호 p46 이상 (' + ver + ')'); }
    await p.click('#isPeek'); await p.waitForTimeout(1300);
    if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    const uid = await p.evaluate(() => { for (const g of document.querySelectorAll('#plan .fg')) if (g.getAttribute('aria-label').startsWith('옷서랍 ')) return g.getAttribute('data-uid'); });
    const bb = await (await p.$(`#plan .fg[data-uid="${uid}"] rect.body`)).boundingBox();
    await p.tap(`#plan .fg[data-uid="${uid}"] rect.body`, { position: { x: bb.width / 2, y: bb.height / 2 }, force: true }); await p.waitForTimeout(400);
    const bar = await p.evaluate(() => { const s = document.getElementById('selbar'); const acts = [...s.querySelectorAll('.sb-act')].filter(n => !n.hidden);
      const info = document.getElementById('sbInfo').getBoundingClientRect();
      return { labels: acts.map(n => n.textContent.trim()), small: acts.filter(n => { const r = n.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length,
        over: s.scrollWidth > s.clientWidth + 1, right: Math.max(...acts.map(n => n.getBoundingClientRect().right)) <= innerWidth, info: Math.round(info.width), nm: document.getElementById('sbNm').textContent }; });
    chk(bar.labels.join('·') === '수정·복제·보관·삭제' && bar.small === 0 && !bar.over && bar.right,
        `${W}px: 고른 가구 줄 [${bar.labels.join(' · ')}] 44px 이상 · 화면 안 · 이름 칸 ${bar.info}px («${bar.nm}»)`);
    if (W === 360) { chk(bar.info >= 60, `360px 에서도 이름 칸 60px 이상 (${bar.info}px)`); await c.close(); continue; }
    await p.screenshot({ path: WORK + '/p46_selbar.png' });
    await p.tap('#selbar [data-sb="store"]'); await p.waitForTimeout(400);
    let s = await st(p), it = s.items.find(i => i.uid === uid);
    const lbl = await p.$eval('#sbStoreL', n => n.textContent);
    chk(it.room === null && lbl === '꺼내기' && (await p.textContent('#toast')).includes('보관함'), '«보관» → 보관함으로 · 단추가 «꺼내기» 로');
    await p.tap('#selbar [data-sb="store"]'); await p.waitForTimeout(400);
    s = await st(p); it = s.items.find(i => i.uid === uid);
    chk(it.room !== null && await p.$eval('#sbStoreL', n => n.textContent) === '보관', '«꺼내기» → 방 안으로 · 단추가 다시 «보관»');
    const n0 = s.items.length;
    await p.tap('#selbar [data-sb="del"]'); await p.waitForTimeout(300);
    const cf = await p.evaluate(() => ({ open: document.getElementById('confirmModal').classList.contains('open'), t: document.getElementById('cfText').textContent }));
    chk(cf.open && cf.t.includes('옷서랍'), '«삭제» → 확인 창: ' + cf.t.slice(0, 30) + '…');
    await p.tap('#cfOk'); await p.waitForTimeout(400);
    s = await st(p);
    chk(s.items.length === n0 - 1 && !s.items.some(i => i.uid === uid) && !(await p.$eval('body', n => n.classList.contains('has-sel'))), '확인 → 지워지고 고른 가구 줄 닫힘');
    await p.tap('#undoBtn').catch(() => {}); await p.waitForTimeout(300);
    chk((await st(p)).items.some(i => i.uid === uid), '되돌리기로 살아남');
    await c.close();
  }

  /* ── ② 사용 측정 ── 작업판 완성본을 GC="t46test" 로 바꾼 사본을 127.0.0.1 로 띄운다 */
  const html = fs.readFileSync(FILE, 'utf8');
  chk(/const GC = "[a-z0-9-]*";/.test(html), '완성본에 GC 자리(build.py 가 pwa/goatcounter.txt 로 채움)');
  const variants = { '/app.html': html, '/gc.html': html.replace(/const GC = "[^"]*";/, 'const GC = "t46test";') };
  const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const body = variants[u === '/' ? '/app.html' : u];
    if (body) { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return r.end(body); }
    const f = path.join(DIR, u); if (fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200); return fs.createReadStream(f).pipe(r); }
    r.writeHead(404); r.end(); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${srv.address().port}`;
  const run = async (page, fn) => {
    const c = await b.newContext({ viewport: { width: 1600, height: 900 }, acceptDownloads: true }); const got = [];
    await c.route(/goatcounter\.com/, r => { got.push(new URL(r.request().url())); r.fulfill({ status: 204, body: '' }); });
    const p = await c.newPage(); p.on('pageerror', e => { if (!/x-t46/.test(e.message)) errs.push(e.message); });
    await p.goto(base + page); await p.waitForTimeout(800); await fn(p); await p.waitForTimeout(500); await c.close(); return got; };
  const off = await run('/app.html', async p => { await p.click('#isPeek'); await p.waitForTimeout(800); });
  chk(off.length === 0, `시험 서버(127.0.0.1)는 ?gctest 가 없으면 안 보냄 (${off.length}건)`);
  const got = await run('/gc.html?gctest', async p => {
    await p.click('#isPeek'); await p.waitForTimeout(1300);
    if (await p.$('#guide.open')) { await p.waitForTimeout(100); chk(await p.$eval('.gnote', n => n.textContent.includes('쿠키를 쓰지 않고')), '사용법 창에 측정 안내 한 줄'); await p.keyboard.press('Escape'); }
    await p.click('#addBtn'); await p.waitForTimeout(300);
    await p.fill('#afName', '비밀 책상'); await p.fill('#afW', '1000'); await p.fill('#afD', '600'); await p.fill('#afH', '720');
    await p.click('#afAdd'); await p.waitForTimeout(300);
    await p.click('#shareBtn'); await p.waitForTimeout(500); await p.click('#shClose').catch(() => {});
    await p.click('#bkBtn'); await p.waitForTimeout(200);
    await Promise.all([p.waitForEvent('download'), p.click('#bkSave')]);
    await p.evaluate(() => setTimeout(() => { throw new Error('x-t46 오류 시험'); }, 0)); await p.waitForTimeout(200);
  });
  const ev = got.map(u => ({ p: u.searchParams.get('p'), e: u.searchParams.get('e'), all: decodeURIComponent(u.search) }));
  const view = ev.find(x => x.p === '/' && !x.e), names = ev.filter(x => x.e === 'true').map(x => x.p);
  chk(got.every(u => u.hostname === 't46test.goatcounter.com' && u.pathname === '/count'), `보내는 곳은 t46test.goatcounter.com/count 하나 (${got.length}건)`);
  chk(!!view && /^\d+,\d+,\d/.test(new URL('http://x/?' + view.all.slice(1)).searchParams.get('s') || ''), '열 때 방문 한 번(p=/ · 화면 크기)');
  chk(['가구 추가', '링크 보내기', '백업'].every(n => names.includes(n)) && names.some(n => n.startsWith('오류: ') && n.includes('x-t46')),
      '이벤트: ' + names.map(n => n.replace(/x-t46.*/, 'x-t46…')).join(' · '));
  const leak = ev.filter(x => /비밀 책상|침대|옷장|#r=|room-planner\/3|2460|5100/.test(x.all));
  chk(leak.length === 0, '가구 이름·방 크기·공유 링크·저장 내용은 안 보냄 (' + leak.length + '건)');
  srv.close();

  console.log('\npageerror :', errs.length, errs.slice(0, 3));
  console.log(ok && !errs.length ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
