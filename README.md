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
- Inspector kanan: tab Teks / Shot / Caption / Objek; edit judul, subjudul,
  end card, semua caption (teks, mulai, selesai, pembicara), semua shot
  (waktu + 6 angka kamera/arah pandang), narasi, dan semua pengaturan objek
  (lihat matriks di bawah). Satu tombol Terapkan (Ctrl+Enter) menerapkan
  semua edit sekaligus dengan me-mount ulang preview; error validasi
  (merah) memblokir Terapkan, peringatan (kuning) tidak. Edit per template
  tersimpan di localStorage (`ss.edits.v1`); Kembalikan di tiap tab
  mengembalikan ke asli.
- Tab Objek: pilih objek dari daftar (nama awam + ikon, mis. "Maskot
  oranye", "Papan skor", "Tangki kuota") atau ketuk objek langsung di
  preview — header selalu menunjukkan "Sedang mengedit: <nama objek>".
  Semua angka jadi slider dengan label awam ("Geser kiri-kanan",
  "Besar-kecil", "Tinggi", "Goyangan") dan nilai + satuan yang tampil;
  perubahan slider langsung terlihat di preview (debounce ~250 mdtk,
  hanya bila lolos validasi — nilai yang ditolak menampilkan alasannya di
  bawah kontrol dan tidak mengubah preview). Warna pakai pemilih warna,
  wajah maskot biru pakai 5 tombol pilihan, skor papan / kurva tangki /
  jendela ketik / waktu muncul pasukan pakai slider per baris (+
  tambah/hapus). Teks (kode layar, obrolan, editor, daftar katapel,
  tombol) tetap kolom teks. Tidak ada istilah teknis di layar.
  Alur: Pilih objek → Atur pakai slider → Lihat di preview → Terapkan →
  Simpan sebagai video baru.
- Video Buatan Saya (panel kiri, bawah daftar template): simpan edit saat
  ini sebagai video baru (dari template asal, template asli tidak pernah
  diubah). Entri tersimpan di localStorage (`ss.mine.v1`), bisa dibuka,
  diedit lagi, dan diunduh sebagai file .html lengkap.
- Palet perintah (Ctrl/⌘+K atau `/`), menu bar (File/Edit/Komposisi/
  Tampilan/Bantuan), tema gelap (default) / terang, tur singkat 5 langkah,
  status bar, toast.
- **Alur HP satu layar (portrait ≤900px):** inspector jadi lembaran geser
  dari bawah (bottom sheet) supaya video tetap kelihatan saat mengedit —
  snap Peek 148px (default) / Half / Full / Closed + tombol pil "✎ Edit"
  saat tertutup. Gagang + header bisa diseret (jari), ketuk header
  Peek ↔ Half, tombol ⌄ ciutkan satu langkah, Esc ciutkan berurutan.
  Header sheet selalu kelihatan: tombol putar/jeda mini, judul konteks
  ("Sedang mengedit: <nama objek>" di tab Objek) + titik biru bila ada
  perubahan belum diterapkan, tombol Terapkan (sama seperti Terapkan di
  tiap tab), dan ⌄. Timeline otomatis terlipat jadi strip (header +
  ruler, tetap bisa scrub + Fit); tombol "▴ Timeline" membukanya lagi
  untuk memilih klip. Keyboard virtual: sheet naik otomatis Peek → Half
  dan tingginya di-clamp mengikuti `visualViewport`, lalu snap semula
  kembali saat keyboard tutup. Sheet saling-eksklusif dengan panel
  Project dan fokus viewer. Desktop dan landscape tidak berubah.
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
| template.html (Versus) | ✓ | ✓ (7, speaker) | ✓ (9) | turunan caps | **20**: Maskot oranye/biru, Mata, Papan skor, Layar kecil, Jalan cerita |
| template-trio.html | ✓ | ✓ (9, speaker) | ✓ (10) | turunan caps | **24**: 20 Versus + Maskot ungu + Layar kecil (ungu) |
| template-code.html | ✓ | ✓ (8, speaker) | ✓ (10) | turunan caps | **24**: Maskot oranye/biru, Mata, Papan skor (awal/akhir), Layar kecil, Layar besar (kode, perbaikan), Jalan cerita |
| template-kuota.html | ✓ | ✓ (14, speaker) | ✓ (13) | literal (14) | **28**: Maskot oranye/biru, Mata, Papan skor (baca/tulis), Layar kecil, Tangki kuota, Keyboard, Jalan cerita |
| template-rival.html | ✓ | ✓ (13, speaker) | ✓ (12) | literal (13) | **25**: Maskot oranye/biru, Mata, Papan skor, Layar kecil, Keyboard, Catatan tempel, Jalan cerita |
| template-perang.html | ✓ | ✓ (13, speaker) | ✓ (15) | literal (13) | **29**: Maskot oranye/biru, Mata, Papan skor, Pasukan kecil, Katapel, Benteng, Tombol & tagihan, Jalan cerita |
| template-typing.html | ✓ | ✓ (6, tanpa speaker) | ✓ (8) | literal (6) | **14**: Maskot oranye, Mata, Layar besar (kode), Cangkir, Jendela, Lampu, Jalan cerita |
| template-deploy.html | ✓ | ✓ (8, tanpa speaker) | ✓ (9) | turunan caps | **19**: 14 typing + Layar besar (perintah 1/2, galat, alur) |
| template-bughunter.html | ✓ | ✓ (10, speaker) | ✓ (11) | literal (10) | **15**: Maskot oranye, Mata, Layar besar, Cangkir, Jendela, Lampu, Tulisan yang diketik, Jalan cerita |
| template-bomb.html | ✓ | ✓ (10, speaker) | ✓ (11) | literal (10) | **17**: 15 bughunter + Layar besar (editor) + Bom |
| template-meeting.html | ✓ | ✓ (10, speaker) | ✓ (10) | literal (10) | **17**: Maskot oranye, Mata, Layar besar (obrolan), Jendela, Lampu, Cangkir, Tulisan yang diketik, Jalan cerita |
| template-sleep.html | ✓ | ✓ (3, speaker) | ✓ (10) | literal (3) | **19**: Maskot oranye, Mata, Layar besar (prompt, terbaru), Cangkir, Jendela, Lampu, Bos, Jalan cerita |

Total **251 slot** (107 id unik) di 12 template — **0 pengecualian**:
semua yang dulu tidak bisa diedit kini bisa (X maskot tunggal + goyangan,
ukuran & kedalaman maskot, ekspresi wajah & mata, boss tidur, benteng +
katapel + tombol + tagihan perang, skor papan non-code, tangki kuota,
keyboard, hitung mundur bom, isi layar, waktu cerita/beat, mug rapat).
Mekanisme tulisnya (J1–J7: inject-const, inject-line, wrap-arg, add-term,
multi-site, css-hex, block) didokumentasikan di SKILL.md; `lib/studio.ts`
dan `scripts/apply-edit.mjs` identik (dicek `scripts/sync-check.mjs`).
Nilai awal tiap prop: `node scripts/apply-edit.mjs --list-props <file>`.

Catatan:

- 7 prop tetap editor teks (bukan slider, karena nilainya bukan angka):
  `screen.editor` (Bom), `rival.notes`, `war.catapults`,
  `screen.pipeline` (Deploy), `screen.chat` (Rapat), `typing.lines`,
  `war.button` (Perang).
- Warna aksen maskot juga menyinkronkan garis tepi balon kata di 5
  template satu maskot — kecuali Sleep yang memang tidak punya garis tepi
  balon kata.
- Hitung mundur Bom kini sampai 00:01 tepat di detik bom jinak (23,4;
  dulu ~23,2).
- Batas gabungan tetap dijaga validasi: template satu maskot
  `|geser| + goyangan ≤ 1,2`; skor awal + goyangan papan ≤ 100; jarak
  benteng − katapel ≥ 1,3; urutan momen cerita harus tetap naik.
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
- **Perbaikan mobile/tablet 2026-11-17** (menindaklanjuti audit
  `verification/mobile-audit-2026-11-17.md` — 1 BLOCKER, 1 MAJOR, 10 MINOR,
  semua fixed; laporan + bukti screenshot:
  `verification/mobile-fix-2026-11-17.md`): tab inspector di ≤900px tidak
  lagi tertutup panel timeline (baris grid timeline dibuat `auto` di ≤900px
  dan ≤600px + `.inspector` ber-z-index); toolbar timeline muat di 390px
  (id `tlZoomOut`/`tlZoom`/`tlZoomIn`/`tlFit` ditambahkan sehingga aturan
  sembunyi zoom ≤600px berlaku); target sentuh ≥44px di layar ≤1180px;
  nama track tidak terpotong (kolom 140/112/100px); tour langkah 1 membuka
  drawer dulu lalu menutupnya lagi; transport muat di HP landscape
  (baris viewer 250px bila tinggi ≤500px); panah keyboard tidak men-seek
  saat slider zoom fokus; error validasi tampil inline di bawah baris yang
  salah; drawer terbuka sesudah Simpan sebagai video baru; header
  "Video Buatan Saya" satu baris; stage tablet landscape ~12–14% lebih
  besar; tombol Terapkan/Reset semua pane punya id; dialog (`<dialog open>`
  non-modal) diberi `z-index:80` supaya tidak tertutup konten workspace
  yang di-scroll. Template asli tidak disentuh; `npm run build` hijau;
  0 console error di semua run verifikasi.
- **Perbaikan landscape 2026-11-17** (menindaklanjuti audit
  `verification/landscape-audit-2026-11-17.md` + screenshot tablet Rehan
  1024×540; laporan + bukti screenshot:
  `verification/landscape-fix-2026-11-17.md`): akar masalah stage kecil
  BUKAN rumus `fitStage` (matematikanya benar) melainkan anggaran tinggi —
  di viewport pendek topbar + status + timeline + panel-h + now-cap +
  transport menghabiskan ~434 dari 540px. Perbaikan: (1) pita timeline
  ringkas `--tl-h:186px` bila tinggi ≤800px (ambang lama 760px meleset 8px
  untuk 1366×768, ukuran tablet landscape paling umum) dan `--tl-h:170px`
  bila ≤640px, plus `max-height` supaya panel tidak meluber menutupi
  status bar; (2) **mode fokus viewer** — tombol di panel-h viewer (ikon
  sudut, Esc untuk keluar) melipat timeline + transport + now-cap sehingga
  stage 9:16 mendapat seluruh tinggi workspace (1024×540: 77×137 →
  215×382; 1366×768: 187×333 → 334×594); (3) ambang label klip berbasis
  lebar piksel + panjang label (bukan % durasi): shot `<labelPx+8` nomor
  saja, `<labelPx+42` "Shot N" tanpa durasi/kamera, selebihnya lengkap —
  shot terpanjang 3,4–3,6 dtk tidak lagi "Sh…"; caption `<30px` hanya
  singkatan pembicara (Cl/Cx/Br), 30–70px teks ellipsis dengan padding
  dipadatkan; (4) `fitTimeline` atomik — lebar konten dihitung dari pps
  yang sama dengan state, menghilangkan jendela transien saat konten
  sempat lebih lebar dari viewport sesudah ganti template; (5) `fitStage`
  memakai padding 8px bila tinggi viewport ≤640px; (6) tombol play overlay
  `min(54px, 36%)` dari lebar frame + HUD stage disembunyikan lewat
  container query bila frame ≤150px. "Terapkan semua edit" abu-abu tanpa
  edit adalah BY-DESIGN (`disabled={!ready || !anyDirty || …}`) — keadaan
  dijelaskan baris status di bawah tombol yang kini selalu terlihat
  (aksi inspector sticky di bawah area scroll); "Simpan sebagai video baru"
  terverifikasi TIDAK terpotong di landscape (auditor: tepi bawah 113px di
  atas viewport di 1024×540). Template asli + `lib/studio.ts` tidak
  disentuh; `npm run build` hijau; 0 console error di semua lebar
  (1024×540, 1024×768, 1180×820, 1366×768, 1440×900, 1920×1080, sentuh +
  template Adu Kode) dan regresi 390px portrait.
