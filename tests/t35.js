// p35: 링크로 보내기 / 받기
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const mk = async (vp) => { const c = await b.newContext({ viewport: vp || { width:1600, height:900 } });
    await c.grantPermissions(['clipboard-read','clipboard-write']);
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); return [c, p]; };
  const st = p => p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')));
  const roomItems = (s, rid) => s.items.filter(i => i.room === rid).map(i => { const c = s.catalog.find(k => k.id === i.cat);
    return [c.name, c.w, c.d, i.x, i.y, i.rot].join('|'); }).sort();

  // 보내는 쪽
  let [c1, p] = await mk();
  await p.goto(APP); await p.waitForTimeout(700);
  await p.click('#isPeek'); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  const s0 = await st(p); const sample = s0.rooms.find(r => r.sample) || s0.rooms[0];
  const orig = roomItems(s0, sample.id);
  await p.click('#shareBtn'); await p.waitForTimeout(500);
  chk(await p.$eval('#shModal', e => e.classList.contains('open')), '«공유» → 링크 창');
  const url = await p.inputValue('#shUrl');
  chk(/#r=[A-Za-z0-9_-]+$/.test(url) && url.length <= 2000, `링크 형식·길이 — # 뒤 ${url.length - url.indexOf('#')}자 (주소 전체 ≤2000; 폴더 경로에 따라 앞부분 길이가 달라서 # 뒤만 적는다)`);
  await p.click('#shCopy'); await p.waitForTimeout(300);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  chk(clip === url && (await p.textContent('#toast')).includes('복사'), '링크 복사 → 클립보드·안내');
  await p.click('#goHome'); await p.waitForTimeout(300);
  await p.click('#shareBtn'); await p.waitForTimeout(300);
  chk((await p.textContent('#toast')).includes('방에 먼저'), '집 화면에서는 «방에 들어가 주세요»');
  await c1.close();

  // 받는 쪽 (처음 온 사람)
  let [c2, q] = await mk();
  await q.goto(url); await q.waitForTimeout(1200);
  chk(await q.$eval('#confirmModal', e => e.classList.contains('open')), '받은 링크 → 확인 창');
  chk((await q.textContent('#cfText')).includes('가구 ' + orig.length + '개'), '확인 창 문구: ' + (await q.textContent('#cfText')));
  chk(await q.$eval('#intro', e => e.hidden), '인트로는 건너뜀');
  chk(!(await q.evaluate(() => location.hash)), '주소의 # 은 지워짐');
  const nRooms = (await st(q)).rooms.length;
  await q.click('#cfOk'); await q.waitForTimeout(1000);
  let s1 = await st(q); const nr = s1.rooms[s1.rooms.length - 1];
  chk(s1.rooms.length === nRooms + 1 && nr.name === sample.name + ' 2', `새 방 추가: ${nr.name} (방 ${nRooms}→${s1.rooms.length})`);
  chk(nr.w === sample.w && nr.d === sample.d && nr.doors.length === sample.doors.length && nr.windows.length === sample.windows.length, '방 크기·문·창문 같음');
  const got = roomItems(s1, nr.id);
  chk(JSON.stringify(got) === JSON.stringify(orig), `가구 ${got.length}개 자리·방향·치수 같음`);
  const planTxt = await q.textContent('#plan');
  chk(planTxt.includes('771'), '통로 771 그대로');
  chk(await q.textContent('#crumbRoom') === nr.name, '받은 방으로 들어감');
  const nCat = s1.catalog.length;
  // 같은 링크 한 번 더 — 가구 목록이 늘지 않는다
  await q.goto(url); await q.waitForTimeout(1000); await q.click('#cfOk'); await q.waitForTimeout(800);
  s1 = await st(q);
  chk(s1.catalog.length === nCat && s1.rooms.length === nRooms + 2 && s1.rooms[s1.rooms.length-1].name === sample.name + ' 3', `두 번째 받기: 가구 목록 ${nCat} 그대로, 이름 «${s1.rooms[s1.rooms.length-1].name}»`);
  await q.keyboard.press('Control+z'); await q.waitForTimeout(500);
  chk((await st(q)).rooms.length === nRooms + 1, '되돌리기로 받은 방 취소');
  // 취소
  await q.goto(url); await q.waitForTimeout(1000); await q.click('#cfNo'); await q.waitForTimeout(400);
  chk((await st(q)).rooms.length === nRooms + 1, '확인 창 «취소» → 아무것도 안 바뀜');
  // 망가진 링크
  for (const bad of ['#r=AAAA', '#r=' + url.split('#r=')[1].slice(0, 40), '#u=eyJ2Ijo5fQ', '#r=' + 'A'.repeat(9000)]){
    await q.goto(APP + bad); await q.waitForTimeout(900);
    const open = await q.$eval('#confirmModal', e => e.classList.contains('open'));
    const t = await q.textContent('#toast');
    chk(!open && /열 수 없어요/.test(t) && (await st(q)).rooms.length === nRooms + 1, `망가진 링크(${bad.length}자) → 안내만: ${t.slice(0, 26)}…`);
  }
  // 이미 열린 탭에 링크를 붙여 넣은 경우(hashchange)
  await q.goto(APP); await q.waitForTimeout(600);
  await q.evaluate(u => { location.hash = u.split('#')[1]; }, url); await q.waitForTimeout(900);
  chk(await q.$eval('#confirmModal', e => e.classList.contains('open')), '열린 탭에서 # 만 바뀌어도 확인 창');
  await c2.close();

  // 압축 없는 브라우저 흉내 → #u=
  let [c3, w] = await mk();
  await w.addInitScript(() => { delete window.CompressionStream; delete window.DecompressionStream; });
  await w.goto(APP); await w.waitForTimeout(600); await w.click('#isPeek'); await w.waitForTimeout(1400);
  if (await w.$('#guide.open')) { await w.keyboard.press('Escape'); await w.waitForTimeout(300); }
  await w.click('#shareBtn'); await w.waitForTimeout(400);
  const u2 = await w.inputValue('#shUrl');
  chk(/#u=/.test(u2), `압축 없는 브라우저 → #u= (# 뒤 ${u2.length - u2.indexOf('#')}자)`);
  await w.goto(u2); await w.waitForTimeout(900); await w.click('#cfOk'); await w.waitForTimeout(700);
  const s3 = await st(w); chk(JSON.stringify(roomItems(s3, s3.rooms[s3.rooms.length-1].id)) === JSON.stringify(orig), '#u= 링크도 그대로 받음');
  await c3.close();

  // 폰 폭: 도구 시트에 «공유»
  let [c4, ph] = await mk({ width:360, height:740 });
  await ph.goto(APP); await ph.waitForTimeout(600); await ph.click('#isPeek'); await ph.waitForTimeout(1500);
  if (await ph.$('#guide.open')) { await ph.keyboard.press('Escape'); await ph.waitForTimeout(300); }
  await ph.click('[data-tab="more"]'); await ph.waitForTimeout(400);
  chk(await ph.isVisible('#shareBtn'), '폰 «도구» 시트에 공유 버튼');
  await ph.click('#shareBtn'); await ph.waitForTimeout(500);
  chk(await ph.$eval('#shModal', e => e.classList.contains('open')), '폰(공유 API 없음) → 링크 창');
  await ph.screenshot({ path:(process.env.WORK || '/home/claude/work') + '/p35_phone.png' });
  await c4.close();

  console.log('\npageerror :', errs.length, errs, ok ? '\n전부 통과' : '\n실패 있음');
  await b.close();
})();
