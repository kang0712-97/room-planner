/* 이걸 어디다 두지? — 서비스 워커 (p45, P3-3 홈 화면 앱·오프라인)
   build.py 가 2026-10-02-p55 를 판 번호로 바꿔 sw.js 로 쓴다. 판이 바뀌면 이 파일이 바뀌어 브라우저가 새 워커를 받는다.
   ① 설치 때 앱·사용법 그림·아이콘을 캐시에 담는다 → 인터넷 없이도 열린다.
   ② 페이지(index.html)는 «인터넷 먼저» — 연결되면 늘 새 판, 끊기면 캐시. 그래서 «고쳤는데 그대로» 가 생기지 않는다.
   ③ 그 밖의 파일(그림·아이콘)은 캐시 먼저.
   ⚠️ 방 데이터는 여기와 상관없다(localStorage). 캐시를 지워도 방은 남는다. */
const CACHE = "rp-2026-10-02-p55";
const CORE = ["./", "index.html", "manifest.json", "icon-180.png", "icon-192.png", "icon-512.png", "icon-512-maskable.png",
  "guide/01.webp", "guide/02.webp", "guide/03.webp", "guide/04.webp", "guide/05.webp", "guide/06.webp",
  "guide/07.webp", "guide/08.webp", "guide/09.webp", "guide/10.webp", "guide/11.webp"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith("rp-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;           /* 구글 글꼴 등 바깥 파일은 건드리지 않는다 */
  if (r.mode === "navigate"){
    e.respondWith(fetch(r).then(res => {
      if (res.ok){ const cp = res.clone(); caches.open(CACHE).then(c => c.put("index.html", cp)); }
      return res;
    }).catch(() => caches.match("index.html").then(m => m || caches.match("./"))));
    return;
  }
  e.respondWith(caches.match(r, { ignoreSearch:true }).then(m => m || fetch(r).then(res => {
    if (res.ok){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }
    return res;
  })));
});
