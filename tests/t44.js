// p44: P3-2 사용법 그림 분리 — 완성본은 가볍게, 그림은 guide/NN.webp 를 «사용법» 을 열 때 불러온다
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const fs = require('fs'), path = require('path');
const WORK = process.env.WORK || '/home/claude/work';
const FILE = process.env.APP || WORK + '/app.html', APP = 'file://' + FILE;
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const html = fs.readFileSync(FILE, 'utf8');
  const files = fs.readdirSync(path.join(path.dirname(FILE), 'guide')).filter(f => /^\d\d\.webp$/.test(f));
  const inside = files.filter(f => html.includes(fs.readFileSync(path.join(path.dirname(FILE), 'guide', f)).toString('base64').slice(0, 200)));
  chk(Buffer.byteLength(html) < 500000 && inside.length === 0, `완성본 500KB 미만 — 사용법 그림은 안에 없음(${inside.length})`);   // p53 — 420KB 에 닿아 올림(사용자 결정 2026-10-02). 뜻은 그대로: 그림이 다시 안에 들어오면 수백 KB 가 늘어 걸린다
  chk(files.length === 11, `guide/ 폴더 그림 ${files.length}장`);

  const c = await b.newContext({ viewport: { width: 1600, height: 900 } }); const p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message));
  const got = []; p.on('request', r => { if (/guide\/\d\d\.webp/.test(r.url())) got.push(r.url().match(/\d\d\.webp/)[0]); });
  await p.goto(APP); await p.waitForTimeout(700);
  const ver = await p.$eval('#introVer', n => n.textContent);
  chk(+(ver.match(/p(\d+)/) || [0, 0])[1] >= 44, '판 번호 p44 이상 (' + ver + ')');
  chk(got.length === 0, '첫 화면에서는 그림을 안 받는다 (' + got.length + '장)');
  await p.click('#isPeek'); await p.waitForTimeout(1500);           // 첫 방문 — 사용법이 저절로 뜬다
  const open1 = await p.$eval('#guide', n => n.classList.contains('open'));
  const im = await p.$eval('#gImg', i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight }));
  chk(open1 && im.src === 'guide/01.webp' && im.ok, `첫 방문 사용법: ${im.src} ${im.w}×${im.h}`);
  await p.waitForTimeout(500);
  chk(new Set(got).size === 11, `사용법을 열면 11장을 미리 받는다 (${new Set(got).size}장)`);
  const all = [];
  for (let i = 0; i < 11; i++) {
    const s = await p.$eval('#gImg', i => ({ ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight, t: document.getElementById('gTitle').textContent }));
    all.push(s); if (i < 10) { await p.click('#gNext'); await p.waitForTimeout(120); }
  }
  chk(all.every(s => s.ok), '11장 모두 그려짐: ' + all.map(s => s.w + '×' + s.h).join(' '));
  chk(all[10].t === '링크로 보내기', '마지막 장 «링크로 보내기»');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('#helpBtn'); await p.waitForTimeout(300);
  chk(await p.$eval('#gImg', i => i.complete && i.naturalWidth === 756), '«사용법» 다시 열기 → 첫 장 그대로');
  await c.close();

  console.log('\npageerror :', errs.length, errs.slice(0, 3));
  console.log(ok && !errs.length ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
