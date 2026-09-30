// 회귀 시험 한꺼번에 돌리기 — GitHub Actions 와 컨테이너 공용.
//   node tests/ci.js [chromium|webkit] [--update]
// 실패 조건: ① 종료 코드 ≠ 0  ② 출력에 ✗ 또는 ❌  ③ (chromium) 정리한 출력이 tests/expected/<시험>.txt 와 다름
// 정리 = 걸린 시간(ms)·판 번호·날짜·힙 크기·브라우저 콘솔의 네트워크 오류 줄을 지운다. 기대값(점수·통로·px·좌표)은 그대로 비교된다.
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const BR = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'chromium';
const UPDATE = process.argv.includes('--update');
const T = __dirname, ROOT = path.resolve(T, '..');
const WORK = process.env.WORK || fs.mkdtempSync(path.join(os.tmpdir(), 'rp-'));
fs.mkdirSync(WORK, { recursive: true });
const SRC = process.env.SRC_HTML || path.join(ROOT, 'index.html');
for (const n of ['app.html', 'app22.html']) fs.copyFileSync(SRC, path.join(WORK, n));
/* p44 — 사용법 그림은 완성본 옆 guide/ 폴더 */
const GD = path.join(path.dirname(SRC), 'guide');
if (fs.existsSync(GD)) { fs.mkdirSync(path.join(WORK, 'guide'), { recursive: true });
  for (const f of fs.readdirSync(GD)) fs.copyFileSync(path.join(GD, f), path.join(WORK, 'guide', f)); }
/* p45 — 홈 화면 앱(PWA) 파일도 옆에 */
for (const f of ['sw.js', 'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png']) {
  const s = path.join(path.dirname(SRC), f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(WORK, f)); }
if (!fs.existsSync(path.join(WORK, 'photo.jpg'))) {
  const r = spawnSync('python3', [path.join(T, 'mkphoto.py'), path.join(WORK, 'photo.jpg')], { stdio: 'inherit' });
  if (r.status) { console.error('photo.jpg 를 못 만들었다(pip install pillow)'); process.exit(1); }
}
const ALL = ['t16','t16b','t16c','t17','t18','tux','tguide','t19','t19b','t21','t22','t23','t31','t32','t34','t34b','t35','t36','t37','t38','t39','t40','t41','t42','t43','t44','t45','t46'];
const WEBKIT = ['t19', 't21', 't23'];          // t22·t40 은 CDP(크롬 전용)를 쓴다
const LIST = (process.env.TESTS ? process.env.TESTS.split(',') : (BR === 'webkit' ? WEBKIT : ALL));

function norm(out) {
  const L = out.replace(/\r/g, '').split('\n'), keep = [];
  for (let i = 0; i < L.length; i++) {
    let l = L[i];
    if (/^pageerror\s*:\s*\[/.test(l)) {                 // pageerror : [ ... ] — 네트워크 콘솔 줄은 빼고 센다
      let block = l; while (!/\]\s*$/.test(block) && i + 1 < L.length) block += '\n' + L[++i];
      const real = (block.match(/'[^']*'/g) || []).filter(s => !/ERR_|console:/.test(s));
      keep.push('pageerror : ' + (real.length ? real.join(', ') : '0')); continue;
    }
    if (/^\s*$/.test(l)) continue;
    l = l.replace(/\d+(\.\d+)?\s?ms\b/g, '#ms')
         .replace(/20\d\d-\d\d-\d\d · p\d+/g, 'BUILD')
         .replace(/20\d{6}(_\d{4})?/g, 'DATE')
         .replace(/힙 증가 [\d.]+MB/g, '힙 증가 #MB')
         .replace(/창 \d+px/g, '창 #px')                       // t23 — 시트가 열리는 중에 재면 몇 px 흔들린다(판정은 ✓/❌ 가 한다)
         .replace(/"w":\d+/g, '"w":#')                          // tux — 버튼 폭은 글꼴 반올림으로 1px 흔들린다(보는 것은 높이)
         .replace(/\s+$/, '');
    const ms = l.indexOf('#ms'); if (ms >= 0 && l.length > ms + 33) l = l.slice(0, ms + 33) + '…';   // 앞의 ms 자릿수만큼 뒤가 밀린다(slice 로 자른 줄)
    keep.push(l);
  }
  return keep.join('\n') + '\n';
}

let bad = 0; const t0 = Date.now();
for (const t of LIST) {
  const s = Date.now();
  const r = spawnSync('node', [path.join(T, t + '.js')], { cwd: WORK, encoding: 'utf8', timeout: 300000,
    env: Object.assign({}, process.env, { APP: path.join(WORK, 'app.html'), APP22: path.join(WORK, 'app22.html'), WORK, BROWSER: BR }) });
  const out = (r.stdout || '') + (r.stderr || ''), n = norm(out), why = [];
  if (r.status !== 0) why.push('종료 코드 ' + r.status + (r.signal ? ' ' + r.signal : ''));
  const x = out.split('\n').filter(l => /✗|❌/.test(l)); if (x.length) why.push('실패 줄 ' + x.length);
  const ef = path.join(T, 'expected', t + '.txt');
  if (BR === 'chromium') {
    if (UPDATE) fs.writeFileSync(ef, n);
    else if (fs.existsSync(ef)) {
      const e = fs.readFileSync(ef, 'utf8').split('\n'), g = n.split('\n'), d = [];
      for (let k = 0; k < Math.max(e.length, g.length); k++) if (e[k] !== g[k]) d.push(`   ${k + 1}행\n     기대: ${e[k]}\n     실제: ${g[k]}`);
      if (d.length) { why.push('기대 출력과 다름 ' + d.length + '줄'); x.push(...d.slice(0, 8)); }
    }
  }
  console.log(`${why.length ? '✗' : '✓'} ${t.padEnd(6)} ${((Date.now() - s) / 1000).toFixed(0).padStart(3)}s ${why.join(' · ')}`);
  if (why.length) { bad++; console.log(x.slice(0, 12).join('\n')); if (r.status !== 0) console.log(out.split('\n').slice(-15).join('\n')); }
}
console.log(`\n${BR} · ${LIST.length}벌 · ${((Date.now() - t0) / 1000).toFixed(0)}초 · ${bad ? '실패 ' + bad + '벌' : '전부 통과'}${UPDATE ? ' (기대 출력 갱신)' : ''}`);
process.exit(bad ? 1 : 0);
