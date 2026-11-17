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
- Inspector kanan: tab Teks / Shot / Caption; edit judul, subjudul, end card;
  Terapkan teks (Ctrl+Enter) memuat ulang preview di waktu yang sama;
  Kembalikan teks asli. Edit diingat per template selama tab terbuka.
- Palet perintah (Ctrl/⌘+K atau `/`), menu bar (File/Edit/Komposisi/
  Tampilan/Bantuan), tema gelap (default) / terang, tur singkat 5 langkah,
  status bar, toast.
- Pintasan: Space/K putar-jeda, ←/→ ±1 dtk, Shift+←/→ ±5 dtk,
  Alt+←/→ ±1 frame, `[`/`]` shot, `,`/`.` caption, Home/End, M suara,
  L loop, G garis bantu, F fit timeline, E ekspor, T panel Project,
  R muat ulang, D tema, `?` pintasan.

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
