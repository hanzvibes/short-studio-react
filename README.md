# Short Studio — React/Next.js

Editor NLE (ala After Effects / CapCut) untuk paket `threejs-cinematic-short`.
Port dari studio vanilla v3.17 (`studio/index.html` + `studio.js`) ke **Next.js 15 +
React 19 + TypeScript**. Tampilan tetap NLE gelap seperti aslinya.

## Yang TIDAK diubah

- **12 template HTML di `public/templates/` disalin byte-identik** dari
  `threejs-cinematic-short/assets/` — isi, kredit `@hanzvibes`, three.js r128,
  voice-over, dan semua cerita tetap persis seperti aslinya. Jangan edit file
  di folder ini; studio hanya mengganti teks di memori (srcdoc iframe).
- `SKILL.md` disalin apa adanya sebagai dokumentasi skill sumber.
- Logika ekspor di `scripts/export.mjs` dipertahankan (Playwright + ffmpeg);
  hanya jalurnya disesuaikan dari `assets/` ke `public/templates/`.

## Cara jalanin

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build produksi (harus hijau)
npm start        # jalankan hasil build
```

Template butuh internet saat preview: three.js r128 dimuat dari CDN
(jsDelivr) di dalam iframe template, sama seperti studio aslinya.

## Struktur folder

```
app/
  layout.tsx     # <html lang="id" data-theme="dark"> + metadata
  page.tsx       # me-render <Studio />
  globals.css    # CSS NLE dari index.html asli (verbatim) + penyesuaian kecil
components/
  Studio.tsx     # seluruh studio: project bin, viewer, transport, timeline,
                 # inspector, menu bar, palet perintah, tema, tur, status bar
lib/
  studio.ts      # registry template, BRIDGE window.__st, setText,
                 # parseDefaults, helper waktu — sama seperti studio.js
public/
  templates/     # 12 template HTML (byte-identik, jangan diedit)
  templates.json # registry template (label, durasi, teks default)
scripts/
  export.mjs     # ekspor MP4: Playwright + ffmpeg (lihat bawah)
SKILL.md         # skill threejs-cinematic-short sumber (v3.14)
```

## Cara kerja (bridge — kenapa template tidak perlu diubah)

Studio mengambil HTML template lewat `fetch("/templates/<file>")`, mengganti
teks judul/sub/end card di string (`setText`), menyuntikkan bridge kecil
sebelum `</body>`, lalu memuatnya sebagai `srcdoc` iframe. Bridge mengekspos
`window.__st` (`gT`, `seek`, `play`, `pause`, `len`, `caps`, `shots`, `mute`)
dan menyembunyikan chrome player bawaan template (`#go` / `#gui`).
Scrub selalu lewat `renderAt(t)` di dalam iframe, jadi frame presisi dan
deterministik. File template di disk tidak pernah diubah.

## Fitur

- Project bin kiri: 12 template + cari + penanda teks diubah; pilihan terakhir
  diingat (localStorage + `#hash` URL, bisa di-bookmark).
- Viewer 9:16 tengah: HUD, garis bantu aman, zoom fit/75%/50%, layar penuh,
  caption yang sedang tayang di bawah viewer.
- Transport: play/pause (klik preview juga), ±5 dtk, ±1 frame, awal/akhir,
  loop, suara (Web Speech `vMute`).
- Timeline bawah: ruler + track V1 Shots, T1 Captions (warna per pembicara),
  A1 Narasi; playhead bisa digeser, zoom/fit, snapping, hide/lock track;
  klik klip = pilih + lompat.
- Inspector kanan: tab Teks / Shot / Caption / Props; edit judul, subjudul,
  end card, semua caption (teks, mulai, selesai, pembicara), semua shot
  (waktu + 6 angka kamera/lookAt), narasi VO, dan props scene (posisi/skala/
  warna maskot, papan skor, monitor, layar, mug, jendela, lampu — sesuai
  template, lihat matriks di bawah). Satu tombol Terapkan (Ctrl+Enter)
  menerapkan semua edit sekaligus dengan me-mount ulang preview; error
  validasi (merah) memblokir Terapkan, peringatan (kuning) tidak.
  Edit per template tersimpan di localStorage (`ss.edits.v1`); Reset di
  tiap tab mengembalikan ke asli.
- Video Buatan Saya (panel kiri, bawah daftar template): simpan edit saat
  ini sebagai video baru (dari template asal, template asli tidak pernah
  diubah). Entri tersimpan di localStorage (`ss.mine.v1`), bisa dibuka,
  diedit lagi, dan diunduh sebagai file .html lengkap.
- Palet perintah (Ctrl/⌘+K atau `/`), menu bar (File/Edit/Komposisi/
  Tampilan/Bantuan), tema gelap (default) / terang, tur singkat 5 langkah,
  status bar, toast.
- Pintasan: Space/K putar-jeda, ←/→ ±1 dtk, Shift+←/→ ±5 dtk,
  Alt+←/→ ±1 frame, `[`/`]` shot, `,`/`.` caption, Home/End, M suara,
  L loop, G garis bantu, F fit timeline, E ekspor, T panel Project,
  R muat ulang, D tema, `?` pintasan.

## Editor caption / shot / VO / props — matriks per template

Semua edit diterapkan dengan menulis ulang nilai literal di string HTML
template (srcdoc iframe) — pola yang sama seperti `setText`: `setCaps` /
`setShots` / `setVO` / `setProps` di `lib/studio.ts`, cermin JS-nya di
`scripts/apply-edit.mjs` (dipakai `scripts/export.mjs --edit`). Penggantian
array memakai bracket-matching, bukan regex `[\s\S]*?`. File template di
disk tidak pernah diubah.

Format spec kanonik (dipakai Studio, `apply-edit.mjs`, `export.mjs --edit`):

```json
{ "file": "template-code.html", "title": "...", "sub": "...", "end": "...",
  "caps": [[t0, t1, "teks", 0], ...],
  "shots": [[t0, [x, y, z], [x, y, z]], ...],
  "vo": ["...", ...],
  "props": { "claude.x": -1.5, "codex.color": "#7b8cff" } }
```

- `vo` opsional: bila caps diedit dan `vo` tidak diisi, `VO[i]` := teks caps
  baru (VO literal diganti; VO turunan `caps.map(c=>c[2])` sudah mengikuti
  otomatis — UI memberi peringatan ini).
- `props`: kunci = id prop dari `PROP_DEFS` (`lib/studio.ts`), nilai number,
  `"#rrggbb"`, atau array (prop array — ditulis ulang utuh). Warna aksen juga
  menyinkronkan `CC[i]` (warna bubble). Format kanonik object map; CLI
  `apply-edit.mjs` juga menerima bentuk array
  `[{"id": "claude.x", "value": -1.5}]` (alias lama).
- Validasi: caps/shots terurut, `0<=t0<t1<=LEN`, tidak tumpang tindih,
  speaker 0..2, kata/detik ≤2.5 (peringatan di UI Studio, ERROR di CLI
  `apply-edit.mjs`); props: jarak antar maskot >0.1 dan ≥2.5 (anggaran
  geser-ke-tengah), gap antar monitor ≥0.2, |x| maskot ≤3.2 + framing shot 0
  (lebar tampak = 0,975 × jarak kamera).

| Template | Teks | Caps | Shots | VO | Props yang bisa diedit |
|---|---|---|---|---|---|
| template.html (Versus) | ✓ | ✓ (7, speaker) | ✓ (9) | turunan caps | claude.x, codex.x, codex.scale, claude/codex.color, board.y, monitor claude/codex.x |
| template-trio.html | ✓ | ✓ (9, speaker) | ✓ (10) | turunan caps | + gemini.x, gemini.scale, gemini.color, monitor gemini.x (12 props) |
| template-code.html | ✓ | ✓ (8, speaker) | ✓ (10) | turunan caps | 12 props: 8 Versus + board.claude.start/final, board.codex.start/final (`CL0/CL1/CX0/CX1`) |
| template-kuota.html | ✓ | ✓ (14, speaker) | ✓ (13) | literal (14) | 9 props: 8 Versus + tank.curve (`RK` keyframe [detik, %]) |
| template-rival.html | ✓ | ✓ (13, speaker) | ✓ (12) | literal (13) | 9 props: 8 Versus + rival.notes (`NT`) |
| template-perang.html | ✓ | ✓ (13, speaker) | ✓ (15) | literal (13) | claude/codex.x (via `gx`), claude.scale, codex.scale (via `gs`), claude/codex.color, board.y, war.spawns (`SP`), war.catapults (`EV`) — tanpa monitor (tidak pakai mkMon) |
| template-typing.html | ✓ | ✓ (6, tanpa speaker) | ✓ (8) | literal (6) | claude.color, screen.x/y, mug.x, window.x, lamp.x |
| template-deploy.html | ✓ | ✓ (8, tanpa speaker) | ✓ (9) | turunan caps | sama seperti typing |
| template-bughunter.html | ✓ | ✓ (10, speaker) | ✓ (11) | literal (10) | 8 props: 6 typing + typing.windows (`WIN`), typing.lines (`TL`) |
| template-bomb.html | ✓ | ✓ (10, speaker) | ✓ (11) | literal (10) | 8 props, sama seperti bughunter |
| template-meeting.html | ✓ | ✓ (10, speaker) | ✓ (10) | literal (10) | 8 props: claude.color, screen.x/y, window.x, lamp.x, typing.windows, typing.lines, meeting.end (`MEET_END`) — tanpa mug |
| template-sleep.html | ✓ | ✓ (3, speaker) | ✓ (10) | literal (3) | sama seperti typing |

Batasan eksplisit (bukan bug — prop sengaja tidak dipalsukan, field
ditampilkan nonaktif dengan alasan di UI; daftar lengkap + alasan di SKILL.md):

- Posisi X maskot tunggal (typing/deploy/bughunter/bomb/meeting/sleep):
  dihitung di `frame()` dari sway/turn, bukan nilai literal.
- Posisi Z maskot dan ekspresi (`drawFace`): Z dihitung di `frame()`;
  ekspresi mengikuti faktor cerita (marah/senang/syok/lelah) yang terikat
  pada beat — bukan nilai literal.
- Skala Claude (kecuali perang via `gs[0]`): skala 1 implisit, tidak ada
  literalnya. Di perang, skala efektif = `gs` (frame menimpa `G[i].scale`
  tiap frame) — `dm.scale.setScalar` di sana tidak berpengaruh.
- Boss sleep (`boss.position.set(30,0,0)`): figur latar yang diparkir jauh
  di luar frame (x=30), bukan maskot utama — tidak diekspos sebagai prop.
- Benteng perang dan keyboard rival: benteng tersebar di banyak panggilan
  `box()`; posisi dasar keyboard ditimpa tiap frame oleh `kx`.
- Skor papan selain template-code (sinus / envelope / `REM(t)` / `EV`) dan
  warna cairan tangki kuota (ditimpa tiap frame dari `REM(t)`) dihitung,
  bukan literal — edit sumbernya (`tank.curve`, `war.spawns`,
  `war.catapults`). Skor papan code (`CL0/CL1/CX0/CX1`) dan kurva tangki
  (`RK`) ADALAH literal dan bisa diedit (lihat matriks).
- Beat cerita (`T_BOARD`/`T_REF`/`T_BUG`/`T_FIX`/`T_TIE` di code): konstanta
  bersama papan + monitor + caps/shots — mengubah satu literal saja merusak
  sinkron. `MEET_END` (meeting) adalah pengecualian karena memang dipakai
  bersama timer + confetti + spin + layar.
- `template-sleep` shots mengandung komentar `//` di dalam array —
  parser mengabaikannya (bracket-matching sadar komentar).
- VO 4 template turunan (`template.html`, `template-code.html`,
  `template-deploy.html`, `template-trio.html`): `VO=caps.map(c=>c[2])`;
  edit VO eksplisit mengubahnya menjadi array literal.

## CLI apply-edit.mjs (terapkan spec edit tanpa membuka Studio)

```bash
# Bantuan + daftar props yang bisa diedit di satu template (nilai saat ini):
node scripts/apply-edit.mjs --help
node scripts/apply-edit.mjs --list-props template-code.html

# Terapkan spec edit JSON (contoh teruji di scripts/examples/):
node scripts/apply-edit.mjs --file template-code.html --edit scripts/examples/spec-code-pr-kecil.json --out /tmp/out-code.html
node scripts/apply-edit.mjs --file template-kuota.html --edit scripts/examples/spec-kuota-hemat.json --out /tmp/out-kuota.html

# Jalan pintas teks saja (tanpa spec):
node scripts/apply-edit.mjs --file template-code.html --title 'Judul' --sub 'Sub' --end 'Akhir' --out out.html
```

Aturan keras CLI: validasi gagal / pola tidak ditemukan = exit non-zero dan
TIDAK ada output yang ditulis (caps tumpang tindih, speaker di luar 0..2,
kata/detik > 2,5, gap maskot < 2,5, id props tidak dikenal, props yang tidak
tersedia di template itu, `--out` di dalam `public/templates/` atau sama
dengan input). Sesudah edit, CLI menjalankan `node --check` pada semua blok
`<script>` inline hasil edit dan memastikan kredit `@hanzvibes` tidak
berkurang. `lint_short.py` tidak ada di repo ini — ambil dari skill pack
`threejs-cinematic-short` (`python3 <skill-pack>/scripts/lint_short.py out.html`).

## Verifikasi headless (VM ini)

`scripts/verify-headless.mjs` — buka studio di Chromium headless, tunggu
"Preview siap", cek bridge `__st`, screenshot preview + stage, uji seek/play.
`scripts/verify-all.mjs` — memuat semua 12 template satu per satu (LEN, jumlah
shot/caption, canvas WebGL) + uji alur edit teks (Terapkan → judul di iframe
berubah). Hasil terakhir: 12/12 OK, 0 error console.

Catatan lingkungan: Chromium headless di VM ini tidak bisa mencapai CDN
(`ERR_CONNECTION_RESET` lewat egress proxy; `curl` ke host yang sama berhasil),
padahal template memuat three.js r128 dari CDN. Kedua skrip verifikasi
mengalihkan request CDN ke salinan three r128 lokal (`/tmp/ss-vendor/`,
diunduh via curl) — hanya intersepsi jaringan saat verifikasi, template di
disk tidak diubah. Di browser normal (termasuk tablet Rehan) CDN dimuat
langsung tanpa intersepsi ini.

## Ekspor MP4

```bash
npm i -D playwright && npx playwright install chromium   # sekali saja
npm run export -- --file template-code.html --fps 60 --out out.mp4
# dengan teks kustom (tombol Ekspor di studio membuatkan perintahnya):
node scripts/export.mjs --file template-code.html --title 'Gemini vs Claude' --sub 'adu cepat' --end 'Siapa menang?' --out out.mp4
```

Skrip membuka template di Chromium headless, memanggil `renderAt(i/fps)`
per frame, screenshot `#stage`, lalu menyambungnya dengan ffmpeg.
Perkiraan: 30 detik × 60 fps = 1.800 frame.

**Batasan:** ekspor **tidak menyertakan audio** — Web Speech tidak bisa
dirender. Untuk narasi, buat TTS offline (mis. piper/edge-tts) dari `VO[]` +
waktu `caps`, lalu mux dengan ffmpeg. Butuh Chromium + ffmpeg + internet
(template memuat three.js dari CDN).

## Selisih dari studio vanilla (dicatat, bukan dihapus diam-diam)

- Menu bar: posisi popup menu disederhanakan (posisi tetap di bawah topbar,
  bukan tepat di bawah tombol menu yang diklik).
- ResizeObserver `tidyClips` (klip shot sempit hanya tampil nomor) diganti
  perhitungan lebar berbasis persentase klip — hasilnya sama untuk ukuran
  timeline normal.
- Mode ringan layar sentuh (`lite`: preview render 1x, loop UI diperlambat)
  dipertahankan di loop sync, tapi class CSS `.lite` tidak lagi dipasang di
  `<html>` — animasi UI tetap dimatikan lewat `prefers-reduced-motion`.
- `studio/_audit.html` tidak di-port (alat audit internal, bukan bagian studio).
- `studio/server.mjs` tidak diperlukan lagi — digantikan `next dev` / `next start`.
- **Fix drawer 2026-11-17:** port awal lupa menyinkronkan `document.body`
  class `drawer-open`/`drawer-closed` (vanilla `studio.js` melakukannya di
  `drawer()`), hanya class di `div.app` yang tidak dipakai CSS mana pun —
  akibatnya drawer tidak bisa dibuka di layar ≤1180px (tablet) dan tidak
  bisa ditutup di layar lebar. Sekarang `useEffect` di `Studio.tsx`
  menyinkronkan body class + `ss.drawer`; terverifikasi headless 390px
  (klik ☰ → drawer muncul, x=4, visible) dan 1440px (klik ☰ → drawer
  hilang, `display:none`). Bukti: `verification/drawer-mobile390-open.png`,
  `verification/drawer-desktop1440-closed.png`.
