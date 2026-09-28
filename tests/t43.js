// p43: 방을 잃지 않게 — 인앱 브라우저(카톡 등) 안내 띠 · 백업 권유 띠
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const WORK = process.env.WORK || '/home/claude/work';
const APP = 'file://' + (process.env.APP || WORK + '/app.html');
const UA_KAKAO = 'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36;KAKAOTALK 2410800';
const UA_INSTA_A = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 Instagram 350.0.0.0.0 Android';
const UA_INSTA_I = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0.0';
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const bar = p => p.evaluate(() => { const n = document.getElementById('noteBar'); const g = document.getElementById('nbGo');
    return { on: !n.hidden, text: document.getElementById('nbText').textContent, go: g.hidden ? null : g.textContent, href: g.getAttribute('href') }; });
  const bk = p => p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/bk') || 'null'));

  /* ── ① 데스크톱 · 보통 브라우저: 백업 권유 ── */
  let c = await b.newContext({ viewport: { width: 1600, height: 900 }, acceptDownloads: true }); let p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(800);
  const ver = await p.$eval('#introVer', n => n.textContent);
  chk(+(ver.match(/p(\d+)/) || [0, 0])[1] >= 43, '판 번호 p43 이상 (' + ver + ')');
  chk(!(await bar(p)).on, '보통 브라우저 · 처음: 안내 띠 없음');
  await p.click('#isPeek'); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await p.click('#listIn .fitem .nm:text-is("옷서랍")'); await p.waitForTimeout(300);
  const rot = async k => { for (let i = 0; i < k; i++) { await p.click('#rotBtn'); await p.waitForTimeout(40); } await p.waitForTimeout(200); };
  await rot(19);
  chk(!(await bar(p)).on && (await bk(p)).n === 19, `바꾼 횟수 19 → 아직 조용함 (n=${(await bk(p)).n})`);
  await rot(1); let s = await bar(p);
  chk(s.on && s.go === '백업 파일 저장' && s.text.includes('백업'), '20번째 → 백업 권유 띠: ' + s.text.slice(0, 40) + '…');
  const tb = await p.evaluate(() => { const r = document.getElementById('noteBar').getBoundingClientRect(), t = document.querySelector('.bar').getBoundingClientRect();
    return { top: Math.round(r.top), barBottom: Math.round(t.bottom) }; });
  chk(tb.top >= tb.barBottom, `띠가 툴바를 가리지 않음 (띠 위 ${tb.top} ≥ 툴바 아래 ${tb.barBottom})`);
  await p.click('#nbNo'); await p.waitForTimeout(200);
  chk(!(await bar(p)).on && (await bk(p)).next === 50, '«닫기» → 사라지고 30번 뒤(50)에 다시');
  await rot(29); chk(!(await bar(p)).on, '49번까지 조용함');
  await rot(1); chk((await bar(p)).on, '50번째 → 다시 권유');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#nbGo')]);
  await p.waitForTimeout(300);
  const k = await bk(p);
  chk(/room-planner-backup-\d{8}\.json/.test(dl.suggestedFilename()) && !(await bar(p)).on && k.n === 0 && k.at > 0,
      `띠의 «백업 파일 저장» → ${dl.suggestedFilename().replace(/\d{8}/, 'DATE')} 받고 띠 닫힘 · 셈 0`);
  await p.evaluate(() => localStorage.setItem('room-planner/bk', JSON.stringify({ n: 25, at: 0, next: 20 })));
  await p.reload(); await p.waitForTimeout(900);
  chk((await bar(p)).on, '다시 열 때 이미 20번 넘게 바꿨으면 → 처음부터 권유');
  await p.evaluate(() => localStorage.setItem('room-planner/bk', JSON.stringify({ n: 3, at: 0, next: 20 })));
  await p.click('#nbNo'); await p.click('#isPeek'); await p.waitForTimeout(1200);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await p.click('#bkBtn'); await p.waitForTimeout(300);
  const [d2] = await Promise.all([p.waitForEvent('download'), p.click('#bkSave')]);
  await p.waitForTimeout(200);
  chk((await bk(p)).n === 0, '툴바 «백업» 창에서 받아도 셈 0');
  await c.close();

  /* ── ② 폰 · 카톡 인앱 ── */
  const phone = ua => b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ua });
  c = await phone(UA_KAKAO); p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP + '#r=AAAA'); await p.waitForTimeout(1000);
  s = await bar(p);
  chk(s.on && s.text.startsWith('카톡 안에서 열었어요') && s.go === '크롬으로 열기', '카톡(안드로이드): ' + s.text.slice(0, 50) + '… [' + s.go + ']');
  chk(s.href.startsWith('kakaotalk://web/openExternal?url=') && decodeURIComponent(s.href.split('url=')[1]).endsWith('app.html#r=AAAA'),
      '«크롬으로 열기» = kakaotalk://web/openExternal (공유 링크 #r= 까지 그대로)');
  const top = await p.evaluate(() => { const r = document.getElementById('nbGo').getBoundingClientRect();
    const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!(e && e.closest('#noteBar')); });
  chk(top, '첫 화면(인트로) 위에서도 띠의 단추가 눌림');
  const bb = await (await p.$('#nbGo')).boundingBox();
  chk(bb.height >= 32, `단추 높이 ${Math.round(bb.height)}px (≥32)`);
  await p.screenshot({ path: WORK + '/p43_kakao.png' });
  await p.tap('#nbNo'); await p.waitForTimeout(200);
  await p.goto(APP); await p.waitForTimeout(800);
  chk(!(await bar(p)).on, '«닫기» 뒤 같은 세션에선 다시 안 뜸');
  await c.close();

  /* ── ③ 인스타그램 인앱 — 안드로이드 / 아이폰 ── */
  c = await phone(UA_INSTA_A); p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(800); s = await bar(p);
  chk(s.on && s.text.startsWith('인스타그램 안에서') && /^intent:\/\/.*#Intent;scheme=https;package=com\.android\.chrome;end$/.test(s.href), '인스타(안드로이드) → 크롬 intent');
  await c.close();
  c = await phone(UA_INSTA_I); p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(800); s = await bar(p);
  chk(s.on && s.go === null && s.text.includes('다른 브라우저로 열기') && s.text.includes('사파리'), '인스타(아이폰) → 단추 없이 «⋯ → 다른 브라우저로 열기» 안내');
  await c.close();

  console.log('\npageerror :', errs.length, errs.slice(0, 3));
  console.log(ok && !errs.length ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
