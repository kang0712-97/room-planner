// p36: 가구 치수 수정 · 복제
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const c = await b.newContext({ viewport:{ width:1600, height:900 } }); const p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message));
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')));
  const walk = async () => ((await p.textContent('#plan')).match(/최소 통로 (\d+)/) || [])[1];
  const score = async () => ((await p.textContent('.scorebox')).match(/(\d+)/) || [])[1];
  const pick = async nm => { await p.click(`#listIn .fitem .nm:text-is("${nm}")`); await p.waitForTimeout(400); };
  await p.goto(APP); await p.waitForTimeout(700);
  await p.click('#isPeek'); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  const w0 = await walk(), s0 = await score();
  console.log('   처음: 통로', w0, '· 점수', s0);
  await pick('침대');
  chk(await p.isVisible('#selEdit') && await p.isVisible('#selDup'), '고른 가구 칸에 «치수 수정»·«복제»');
  await p.click('#selEdit'); await p.waitForTimeout(400);
  chk(await p.textContent('#afTitle') === '가구 수정' && await p.textContent('#afAdd') === '저장' && await p.inputValue('#afW') === '1150' && await p.inputValue('#afD') === '2100',
      '수정 창: 제목·버튼·값 채움');
  await p.fill('#afW', '1500'); await p.fill('#afD', '2000'); await p.click('#afAdd'); await p.waitForTimeout(700);
  const w1 = await walk(), s1 = await score();
  let s = await st(); const bed = s.catalog.find(k => k.name === '침대');
  chk(bed.w === 1500 && bed.d === 2000, '침대 규격 1500×2000 저장');
  chk(w1 !== w0 && s1 !== s0, `통로 ${w0}→${w1}, 점수 ${s0}→${s1} 즉시 바뀜`);
  const bi = s.items.find(i => i.cat === bed.id), rm = s.rooms.find(r => r.id === bi.room);
  chk(bi.x >= 0 && bi.x + 1500 <= rm.w && bi.y + 2000 <= rm.d, `방 안에 맞춤 (x ${bi.x}, y ${bi.y})`);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(500);
  s = await st();
  chk(s.catalog.find(k => k.name === '침대').w === 1150 && await walk() === w0 && await score() === s0, '되돌리기 한 번에 원래대로(규격·통로·점수)');
  // 너무 크게
  await pick('침대'); await p.click('#selEdit'); await p.waitForTimeout(300);
  await p.fill('#afW', '3000'); await p.click('#afAdd'); await p.waitForTimeout(400);
  chk(await p.$eval('#addModal', e => e.classList.contains('open')) && (await p.textContent('#toast')).includes('커져서') && (await st()).catalog.find(k => k.name === '침대').w === 1150,
      '방보다 커지면 저장 안 함 · 창 유지');
  await p.click('#afCancel'); await p.waitForTimeout(300);
  // 복제
  const n0 = (await st()).items.length;
  await pick('책상');
  const d0 = (await st()).items.find(i => (i.uid === 'I_' + (s.catalog.find(k => k.name === '책상').id)));
  await p.click('#selDup'); await p.waitForTimeout(500);
  s = await st();
  const desks = s.items.filter(i => s.catalog.find(k => k.id === i.cat).name === '책상');
  chk(s.items.length === n0 + 1 && desks.length === 2, `복제 → 가구 ${n0}→${s.items.length}, 책상 2개`);
  chk((await p.$$eval('#listIn .fitem .nm', e => e.filter(x => x.textContent === '책상').length)) === 2, '목록에도 책상 2개');
  chk(await p.textContent('#selBox .read-h span') === '책상', '복제본이 골라진 상태');
  // 복제본 수정 → 원본은 그대로(규격 복사)
  await p.click('#selEdit'); await p.waitForTimeout(300);
  await p.fill('#afName', '작은 책상'); await p.fill('#afW', '1000'); await p.click('#afAdd'); await p.waitForTimeout(600);
  s = await st();
  const orig = s.catalog.find(k => k.name === '책상'), small = s.catalog.find(k => k.name === '작은 책상');
  chk(orig && orig.w === 1200 && small && small.w === 1000 && small.id !== orig.id, `같은 규격을 쓰면 이 가구만 바뀜 (책상 ${orig && orig.w}, 작은 책상 ${small && small.w}, id ${small && small.id})`);
  chk((await p.textContent('#toast')).includes('이 가구만'), '안내: ' + await p.textContent('#toast'));
  // 추가 창은 원래 모습으로
  await p.click('#addBtn'); await p.waitForTimeout(300);
  chk(await p.textContent('#afTitle') === '새 가구 추가' && await p.textContent('#afAdd') === '추가' && await p.inputValue('#afName') === '', '«가구» 추가 창은 원래대로(빈 칸)');
  await p.click('#afCancel');
  // 보관함 가구도 수정
  await p.reload(); await p.waitForTimeout(900);
  if (await p.$('#intro:not([hidden])')) { await p.keyboard.press('Escape'); await p.waitForTimeout(1200); }
  await p.screenshot({ path:(process.env.WORK || '/home/claude/work') + '/p36_desk.png' });
  await c.close();
  // 폰
  const c2 = await b.newContext({ viewport:{ width:360, height:740 }, isMobile:true, hasTouch:true }); const q = await c2.newPage();
  q.on('pageerror', e => errs.push(e.message));
  await q.goto(APP); await q.waitForTimeout(700); await q.click('#isPeek'); await q.waitForTimeout(1500);
  if (await q.$('#guide.open')) { await q.keyboard.press('Escape'); await q.waitForTimeout(300); }
  await q.click('#tabbar [data-tab="list"]'); await q.waitForTimeout(400);
  await q.click('#listIn .fitem .nm:text-is("책상")'); await q.waitForTimeout(500);
  await q.click('#sbInfo'); await q.waitForTimeout(500);
  chk(!(await q.isVisible('#selEdit')) && !(await q.isVisible('#selDup')) && !(await q.isVisible('#selRot')), '폰: «상태» 시트의 고른 가구 칸에는 버튼 없음(p38 — 아래 줄 «수정» 과 중복)');
  await q.locator('#selBox').screenshot({ path:(process.env.WORK || '/home/claude/work') + '/p36_phone.png' });
  await q.click('#tabbar [data-tab="stat"]'); await q.waitForTimeout(300);
  await q.click('#selbar [data-sb="edit"]'); await q.waitForTimeout(500);
  chk(await q.$eval('#addModal', e => e.classList.contains('open')) && await q.textContent('#afTitle') === '가구 수정', '폰: 수정 창 열림');
  await q.screenshot({ path:(process.env.WORK || '/home/claude/work') + '/p36_phone_edit.png' });
  await c2.close();
  console.log('\npageerror :', errs.length, errs, ok ? '\n전부 통과' : '\n실패 있음');
  await b.close();
})();
