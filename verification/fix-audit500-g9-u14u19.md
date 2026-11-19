# Perbaikan G9 — U14–U19: Visual tablet (HUD, kontras, target sentuh, label klip, header viewer, timecode)

- **Tanggal:** 2026-11-19 (WIB)
- **Acuan:** `verification/audit-500-2026-11-18.md` — U14 (V7/X5/F5/M1 + B9), U15 (V12/X3/F4/M2 + B9), U16 (V2/V13/X1/F8/m6 + B11), U17 (F1/F2/V3/V10/m1 + B10 parsial), U18 (W1 + B1), U19 (V5/F6 + B7)
- **Status: SELESAI — U14, U15, U17, U18, U19 hilang; U16 hilang di perangkat sentuh kecuali `.trk-mini` yang diselesaikan via area ketuk tak terlihat (lihat §6, sisa yang didokumentasikan).**
- **Tidak ada push / branch / merge** (koordinator yang push sesudah verifikasi). Folder lokal ini **tidak punya `.git`** (bukan checkout git) — sama seperti catatan G7/G8.

## 0. Metode ukur (penting — dua koreksi terhadap cara ukur audit)

1. **U14 — koordinat iframe:** `getBoundingClientRect()` elemen di dalam iframe mengembalikan koordinat relatif terhadap viewport *iframe*, bukan halaman. Run repro pertama saya memberi overlap **0 di semua lebar (SALAH)** — saya menangkapnya karena bertentangan dengan audit, lalu mengukur ulang dengan offset posisi iframe (`#wm.x + iframe.x`). Angka SEBELUM yang benar sesudah koreksi **cocok dengan audit** (1440: 426px² = audit 426px²; 1920: 815 ≈ audit 840px²; 1366 fokus: 801 ≈ audit 826px²) — metodenya tervalidasi.
2. **U16 — pointer sentuh vs mouse:** audit mengukur di headless pointer-halus (mouse). Di tablet nyata `pointer:coarse` berlaku dan sebagian besar aturan 44px studio SUDAH aktif. Jadi saya ukur **dua mode**: `fine` (seperti audit) dan `coarse` (konteks Playwright `hasTouch + isMobile`, `matchMedia("(pointer:coarse)")=true` — kondisi tablet nyata). Baseline sentuh yang jujur di 834 bukan 33/49, melainkan **1/27**; yang rusak parah justru **1440 sentuh: 51/73** karena aturan 44px lama dibatasi `max-width:1180px`. Perbaikan menyasar mode sentuh; hitungan `fine` sengaja TIDAK berubah (desktop tidak membengkak — lihat §6).
3. **Definisi hitung U16 "tombol kontrol":** `button` + `select` yang terlihat, **tidak termasuk klip timeline** (18 tombol `.clip`, ukurannya ditentukan konten/zoom — bukan kontrol) dan **slider range** (`#tlZoom`, thumb-nya target ketuk, bukan tombol). Angka SEBELUM ditulis ulang dengan definisi yang sama bila sebanding (1440 fine: 43/55, bukan 52/74 yang tercampur klip+slider; 834/390 tidak berubah karena klip di sana tersembunyi saat timeline terlipat).

## 1. Reproduksi — SEBELUM perbaikan (semua item ADA, dengan angka)

Server prod port 3319 (`npm run build` + `npm start -- --port 3319`), Playwright + `chrome-headless-shell`, profil browser baru per skenario, tur dimatikan (`ss.tour=1`) kecuali uji tur. Bukti angka: `~/workspace/g9-u14u19/repro-before.json`, `repro-u14-before.json`.

### U14 — chip HUD menutupi watermark (template Adu Kode, `#template-code`)

| Lebar | Normal res vs `#wm` | Fokus res vs `#wm` | res vs judul |
|---|---|---|---|
| 768 landscape (1024×768) | **346px²** | **779px²** | 0 |
| 1024×540 | 0 (HUD tersembunyi by-design, stage 92px) | **418px²** | 0 |
| 1180 landscape | **418px²** | **686px²** | 0 |
| 1366 landscape | **322px²** | **801px²** | 0 |
| 1440 | **426px²** | **617px²** | 0 |
| 1920 | **815px²** | **443px²** | 0 |

Chip "Comp 1" tidak pernah overlap (0 di semua lebar). **Nuansa:** klaim audit "1024 menumpuk judul saat fokus" **tidak terreproduksi lewat rect** (res vs judul = 0 di semua lebar, termasuk 1024 fokus) — yang tertutup di sana adalah `#wm` (418px²). Judul template (`#title`, `top:20%`, teks terpusat) memang tidak pernah bersentuhan dengan chip (y 6–24px vs judul y ≥80px). Screenshot: `fix-audit500-g9-u14u19-before-u14-1440.png`, `before-u14-*-focus.png` (6 lebar).

### U15 — kontras statusbar gagal AA (1440×900, `getComputedStyle` + rasio WCAG, sama seperti audit)

| | `.st-left` | `.st-mid` | `.st-right` |
|---|---|---|---|
| Gelap (`--faint #5d626b` di `#0e0f11`) | **5,98:1 ✓** | **3,13:1 ✗** | **3,13:1 ✗** |
| Terang (`--faint #9ba0a9` di `#f3f4f6`) | **4,52:1 ✓** | **2,39:1 ✗** | **2,39:1 ✗** |

Angka identik dengan audit. Screenshot: `before-u15-dark.png`, `before-u15-light.png`.

### U16 — target sentuh <44px

| Lebar | Fine (mouse) | Coarse (sentuh) | Sisa di coarse |
|---|---|---|---|
| 834 portrait | 24/28 | **1/27** | `.btn.primary` "Ekspor" 28×44 (ikon saja di ≤900px) |
| 390 portrait | 20/24 | **1/22** | sama (Ekspor 28×44) |
| 1440 | 43/55* | **51/73** | tb-icon 40px, ph-icon 36px, tbtn 38px, play 42px, tool 34px, btn 38px, btn.small 34px, tab 36px, mi 40px, vzoom 34px, menubar File/Edit 35–37px, trk-mini 26px |

\* definisi §0.3. Tombol tur (W3): **25px** di 390 (`Kembali 74,8×25, Lanjut 64,5×25` — sesuai audit). Penyebab yang ditemukan di kode: (a) blok 44px coarse lama dibatasi `@media (pointer:coarse) and (max-width:1180px)` — di 1440 tidak berlaku; (b) `.tour .btn.small{height:25px}` ber-spesifisitas (0,3,0) mengalahkan aturan coarse `.btn.small` (0,2,0) — tombol tur tetap 25px **bahkan di tablet nyata**; (c) `.sel-actions .btn{height:22px}` didefinisikan sesudah blok coarse sehingga menang atasnya; (d) tidak ada aturan coarse untuk `.menubar button` / `.seg button` / `.choice` / `.tour-skip` / `.mine-open` / `.edit-cap`.

### U17 — label klip timeline terpotong (template Adu Kode)

| Lebar | Caption terpotong | Shot `<small>` terpotong | Contoh title shot |
|---|---|---|---|
| 1440 | **8/8** (scrollW 129–180 vs clientW 35–107; mis. cap #1: 180 vs 59) | 2/10 (Shot 4: 76 vs 40; Shot 9: 59 vs 45) | `Shot 4 · 0:09` |
| 1366 | **8/8** | 0/10 | `Shot 4 · 0:09` |
| 1920 | **8/8** | 4/10 | `Shot 4 · 0:09` |

Caption tampil "Kodeku rap…" / "Tes bany…" — tapi di beberapa lebar terpotong tengah kata **tanpa "…"**. Title shot hanya `Shot 4 · 0:09` — **tanpa info kamera** ("0 · 1.55 · 5.4" hanya ada di `<small>` yang terpotong). Akar caption: teks caption adalah **node teks mentah di dalam flex** (`.clip-txt`) — `text-overflow:ellipsis` di kontainer flex tidak menjalar ke anonymous flex item. Screenshot: `before-u17-timeline-1440.png`.

### U18 — header viewer meluber di 390px portrait

| Template | `.viewer` scrollW / clientW | Fokus right | Garis bantu right | Layar penuh right |
|---|---|---|---|---|
| Trio | **475 / 380** | **419,9** | **449,9** | **479,9** |
| Adu Kode | 380 / 380 (muat) | 318,7 | 348,7 | 378,7 |

Pendorong overflow = `.panel-h` (panelHSw 475 = viewerSw): judul "Comp 1 · Trio (…)" 231,1px + chip "1080×1920 · 60 fps" 132,8px + 3 tombol 84px + padding/gap. Adu Kode muat karena labelnya pendek — Trio yang gagal (sesuai audit: "Di Trio pengguna kehilangan ketiga tombol sekaligus"). Screenshot: `before-u18-template-trio.png`.

### U19 — timecode tanpa pemisah di portrait ≤900px

| Lebar | `.tc em` display | Gap b→span | Timecode terbaca |
|---|---|---|---|
| 768 portrait | `none` | **0px** | `00:00:00:00/00:00:30:00` |
| 834 portrait | `none` | **0px** | `00:00:00:00/00:00:30:00` |
| 1180 portrait (820×1180) | `none` | **0px** | `00:00:00:00/00:00:30:00` |
| 390 portrait | `none` | 0px | `.t-center` **disembunyikan by-design**; yang terlihat `.nc-time` = `0:00 / 0:30` (sudah berpemisah) |

## 2. Akar

1. **U14:** `.stage-hud` pakai `justify-content:space-between` — chip kanan mendarat tepat di atas `#wm` (semua 12 template menaruh `#wm` di `top:3–4u; right:3–4u`).
2. **U15:** `--faint` terlalu muda di kedua tema (gelap `#5d626b`, terang `#9ba0a9`); `.statusbar` mewarisinya untuk `.st-mid`/`.st-right`.
3. **U16:** lihat §1-U16 (a)–(d): gate lebar 1180px, spesifisitas `.tour .btn.small`, urutan definisi `.sel-actions .btn`, dan kelompok kontrol tanpa aturan coarse sama sekali.
4. **U17:** teks caption node mentah di flex (ellipsis tidak jalan) + title shot tidak membawa `cams`.
5. **U18:** `.panel-t` tanpa `min-width:0`/ellipsis + chip `white-space:nowrap` tidak menyusut di `.panel-h` yang juga tidak menyusut.
6. **U19:** aturan lama `.tc em{display:none}` di `@media (max-width:900px)` (selektor `#tcTot` di aturan yang sama sudah mati — tidak ada elemen itu di markup saat ini).

## 3. Perbaikan (kode studio saja — 2 file)

### Keputusan desain yang diambil (didokumentasikan)

- **U14 — chip dipindah ke KIRI ATAS, bukan ke bawah frame / disembunyikan.** Dua chip kini berkelompok di kiri atas (`justify-content:flex-start`). Alternatif yang ditolak: (i) ke bawah frame — celah di bawah stage hanya 14px di lebar 901–1180px (`fitStage` padPx=14), lebih kecil dari tinggi chip ~18px, jadi chip akan menumpuk tepi bawah frame; (ii) sembunyikan saat watermark terlihat — butuh JS yang mengukur isi iframe tiap frame, rapuh. Sudut kiri atas kosong di semua template (judul terpusat di `top:20%`, `#wm` di kanan atas) — dibuktikan visual t=0 untuk Trio + Adu Kode. Info resolusi tetap di tempat yang sama (atas frame).
- **U15 — naikkan `--faint` global + `--dim` terang.** `--faint` gelap `#5d626b`→`#83888f` (5,37:1 statusbar, ≥4,9:1 di panel/input/bg); terang `#9ba0a9`→`#64686f` (5,09:1 statusbar, ≥4,9:1 di panel/putih). `--dim` terang `#6b707a`→`#5d626b` supaya hierarki dim > faint tetap benar — sekaligus memperbaiki `--dim` sendiri yang hanya 4,36:1 di `panel-3` (kini 5,38:1). `--dim` gelap tidak diubah (`#8b909a`, 5,98:1).
- **U16 — per kelompok kontrol** (semua hanya `pointer:coarse`; desktop mouse tidak berubah):
  - *Ukuran visual → 44px:* transport (`.tbtn`, `.play`), topbar (`.tb-icon`, `.menubar button` + `min-width:44px`), timeline tools (`.tool`), `.ph-icon`, `.btn`/`.btn.small`, `.tab`, `.mi`, `.vzoom`, `.search input`, `.field input`, `.row`, `.cmd-i`, `.seg button`, `.choice`, `.tour-skip` (+`min-width:44px`), `.mine-open`, `.edit-cap`, `.sel-actions .btn`. Blok coarse dasar dinaikkan dari 34–42px ke 44px dan gate `≤1180px` dicabut (panel-h/mine-h/dlg-h ikut ditinggikan supaya tombol 44px muat di >1180px). Aturan `.tour .btn.small{height:25px}` **dihapus** (akar W3) — tombol tur kini mengikuti `.btn.small` (24px mouse / 44px sentuh). Blok coarse tambahan ditaruh di **akhir file** supaya menang atas aturan dasar yang didefinisikan belakangan (`.sel-actions .btn`).
  - *Area ketuk tak terlihat:* hanya `.trk-mini` — visual tetap 16px/26px karena kepala track audio hanya 32–36px (tombol 44px visual tidak muat tanpa menggelembungkan timeline dan merusak mode ringkas viewport pendek). `::after` 44×44px (`inset:-9px`) + jarak antar-mini dilebarkan (4px→18px) dan padding kanan head ditambah (5px→14px) supaya zona dua mini bersebelahan tidak saling menelan (tanpa ini, ketuk tepi kanan mini kiri mendarat di mini kanan — zona salah tombol 5px).
  - *Di luar hitungan:* klip timeline (konten, ukuran ikut zoom) + slider range (thumb, bukan tombol).
- **U17 — ellipsis + tooltip lengkap.** Teks caption dibungkus `<span class="cap-txt">` dengan `flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis`. Title shot kini `Shot N · waktu · cams` (mis. `Shot 4 · 0:09 · 0 · 1.55 · 5.4`) — info kamera yang hilang dari `<small>` yang terpotong kini ada di tooltip.
- **U18 — kecilkan, jangan bungkus dua baris.** Di `≤600px`: judul viewer boleh menyusut (ellipsis, `min-width:0`), chip resolusi memendek jadi `1080×1920` (bagian `· 60 fps` disembunyikan via `<span class="chip-fps">`; info fps tetap ada di statusbar saat ≥601px), chip objek dibatasi 150px + ellipsis, gap header 6px→4px. Membungkus header jadi dua baris ditolak (memakan tinggi stage). W2 (fokus-geser-stage) **tidak disentuh** — sudah DITURUNKAN audit.
- **U19 — tampilkan "/" yang kecil.** Di `≤900px`: `.tc em{display:inline;margin:0 2px}` (bukan 4px desktop). "/"-nya sendiri adalah pemisah — bukan sekadar jarak. Di 390px tidak ada perubahan apa pun (`.t-center` tetap `display:none` di `≤600px`, jadi "/" ini tidak pernah muncul di sana dan layout transport HP tidak tersentuh). Selektor mati `#tcTot` dihapus.

### File yang diubah

- **`app/globals.css`** — `:root` `--faint` gelap + komentar (U15, :8–10); `:root[data-theme="light"]` `--dim`/`--faint` (U15, :25–29); `.stage-hud` `justify-content:flex-start` + komentar (U14, :151); `.clip.cap .clip-txt .cap-txt` (U17, :278); `.tc em` di `@media (max-width:900px)` (U19, ~:522); aturan header viewer di `@media (max-width:600px)` (U18, :561–566); blok `@media (pointer:coarse)` dinaikkan ke 44px + `.panel-h`/`.mine-h`/`.dlg-h`/`.menubar button` (U16, :603–630); hapus `.tour .btn.small{height:25px}` (U16, ~:438); `.trk-mini{position:relative}` (U16, :231); blok coarse G9 di akhir file — `.sel-actions .btn`, `.seg button`, `.choice`, `.tour-skip`, `.mine-open`, `.edit-cap`, `.trk-head` padding, `.trk-mini + .trk-mini` margin, `.trk-mini::after`, `.tb-actions .btn.primary` width 44px di `≤900px` (U16, :805–832).
- **`components/Studio.tsx`** — chip header viewer `<span className="chip-fps">` (U18, :2805); title shot `+ cams` (U17, :3019); teks caption dibungkus `<span className="cap-txt">` (U17, :3056).

**Tidak disentuh:** 12 template asli di `public/templates/` (mtime tetap **2026-11-17 08:19** semua); `lib/studio.ts`, `scripts/`; file audit (`verification/audit-500-2026-11-18.md`, mtime 2026-11-19 05:02); file bukti G1–G8.

## 4. Verifikasi — SESUDAH perbaikan

### 4.1 U14 — overlap 0 di semua lebar (normal + fokus)

| Lebar | Normal res/wm | Fokus res/wm | res/judul | comp/wm |
|---|---|---|---|---|
| 768-land / 1024-540 / 1180 / 1366 / 1440 / 1920 | **0** | **0** | 0 | 0 |

Screenshot: `after-u14-1440.png`, `after-u14-1440-focus.png`, `after-u14-1920-focus.png`, `after-u14-stage-template-trio-t0.png` (chip kiri atas, `@hanzvibes` utuh di kanan atas, judul "Claude vs Codex vs Gemini" bersih), `after-u14-stage-template-code-t0.png`.

### 4.2 U15 — kontras lolos AA kedua tema

| | `.st-left` | `.st-mid` | `.st-right` |
|---|---|---|---|
| Gelap | **5,98:1** | **5,37:1** (was 3,13) | **5,37:1** (was 3,13) |
| Terang | **5,57:1** (was 4,52) | **5,09:1** (was 2,39) | **5,09:1** (was 2,39) |

Spot-check `--faint` di latar lain: `.meta` 4,73:1 (gelap) / 5,60:1 (terang) — lolos. Screenshot: `after-u15-dark.png`, `after-u15-light.png` (statusbar terbaca jelas di tema terang; tampilan sekunder tetap sekunder).

### 4.3 U16 — target sentuh (mode sentuh/coarse = metrik utama)

| Lebar | Coarse SEBELUM | Coarse SESUDAH | Fine SESUDAH (tidak berubah, by-design) |
|---|---|---|---|
| 834 portrait | 1/27 | **0/27** | 24/28 |
| 390 portrait | 1/22 | **0/23** | 20/24 |
| 1440 | 51/73 | **5/54 — kelimanya `.trk-mini`** | 43/55 |

- **`.trk-mini` probe** (`elementFromPoint` grid ±24px dari tengah, 1440 coarse): hit area **44×44px** untuk 4 dari 5 mini; "Kunci track caps" 44×42 (2px pendek — granularitas probe). Rect visual tetap 26×26 (by-design, §3).
- **Tombol tur** (coarse): 390 → Lewati **44×44** (was 25px), Kembali 74,8×44, Lanjut 64,5×44; 1440 → Lewati 48,2×44, Kembali 62,8×44, Lanjut 52,5×44. Screenshot: `after-u16-tour-390-coarse.png`, `after-u16-tour-1440-coarse.png`.
- Klip timeline <44px: 9 di 1440 (konten, bukan tombol — didokumentasikan, bukan dihitung).

### 4.4 U17 — ellipsis + tooltip

| Lebar | Caption ellipsis aktif | Shot `<small>` terpotong | Title shot 4 |
|---|---|---|---|
| 1440 / 1366 / 1920 | **8/8** (was 8/8 terpotong tanpa jaminan "…") | 2/10 / 0/10 / 4/10 — **dengan "…"** (by-design; `<small>` memang sudah ber-ellipsis) | `Shot 4 · 0:09 · 0 · 1.55 · 5.4` (was `Shot 4 · 0:09`) |

Screenshot: `after-u17-timeline-1440.png` — caption tampil "Kodeku …", "Rapi do…", "Tes bany…", "Arsitektu…"; shot "Shot 4 / 0 · 1.…" dan "Shot 9 / 0 · 1.7…".

### 4.5 U18 — header viewer muat di 390px

| Template | `.viewer` scrollW / clientW | Fokus right | Garis bantu right | Layar penuh right |
|---|---|---|---|---|
| Trio | **380 / 380** (was 475/380) | **322** (was 419,9) | **350** (was 449,9) | **378** (was 479,9) |
| Trio, tab Objek (obj-chip tampil) | **380 / 380** | 322 | 350 | 378 |
| Adu Kode | 380 / 380 | 322 | 350 | 378 |

Chip tampil `1080×1920` (bagian `· 60 fps` tersembunyi di ≤600px — `textContent` mentah tetap memuatnya, yang disembunyikan hanya rendernya). Judul tampil `Comp 1 · Claude vs Codex vs…` (ellipsis). Screenshot: `after-u18-template-trio.png`.

### 4.6 U19 — pemisah timecode kembali

| Lebar | `.tc em` display | Gap b→span | Timecode |
|---|---|---|---|
| 768 / 834 / 1180 portrait | `inline` (was `none`) | **10,7px** (was 0) | `00:00:00:00 / 00:00:30:00` |
| 390 portrait | `inline` (tapi `.t-center` tetap tersembunyi) | — | `.nc-time` tetap `0:00 / 0:30`; transport tidak berubah |

Screenshot: `after-u19-768-portrait.png`, `after-u19-834-portrait.png`, `after-u19-1180-portrait.png`, `after-u19-390-portrait.png`.

### 4.7 Build + sync-check — HIJAU

- `npx tsc --noEmit`: bersih (exit 0, 2× — sebelum dan sesudah tweak lanjutan U16).
- `npm run build`: hijau (exit 0, 2×).
- `node scripts/sync-check.mjs`: **SEMUA HIJAU — 12/12 template byte-identik lib == mjs**; vendor three.js 12/12 rewrite 13/13 + export tetap CDN. (Tidak menyentuh `lib/`/CLI; dijalankan sebagai jaring pengaman.)
- 0 `pageerror` / console error di semua run verifikasi (`verify-after.json`, `regression-after.json`, `repro-u14-before.json`).

## 5. Regresi — G1–G8 tidak rusak + fokus + tur

Bukti: `~/workspace/g9-u14u19/regression-after.json`.

- **Fresh load 12/12**: semua `ready=true`, **`0 error validasi bawaan`** (`.valid-err` = 0), stage 9:16 (rasio 0,564) di semua template.
- **Alur edit → Terapkan → Simpan → reload** (Bom + Versus): ketik judul → Terapkan → toast "Semua edit diterapkan" → dialog Simpan terbuka → **Esc menutup dialog** (G8) → Simpan video → 1 entri `ss.mine.v1` → reload → judul + entri bertahan. 0 error.
- **Mode fokus viewer**: 226×401 (0,564) → fokus 408×726 (0,562), timeline tersembunyi → **Esc keluar**, kembali 226×401 (0,564).
- **Tur:** kunjungan pertama → kartu "Langkah 1 dari 5" muncul → **Esc mengakhiri tur** (`ss.tour=1`).

## 6. Yang TIDAK berhasil / sisa yang didokumentasikan (dengan bukti)

1. **`.trk-mini` rect visual tetap 26px** (bukan 44px) — disengaja (§3): kepala track audio hanya 32–36px, tombol 44px visual tidak muat tanpa menggelembungkan timeline. Yang ≥44px adalah **area ketuk tak terlihat** (`::after`, probe `elementFromPoint`: 44×44 untuk 4/5 mini, 44×42 untuk "Kunci track caps"; di baris audio viewport terpendek area vertikal efektif ~40px karena terpotong tepi bawah kolom head). Hitungan rect 1440-coarse menyisakan 5 `.trk-mini` — itu batasan yang diketahui (a), bukan regresi.
2. **Shot `<small>` tetap terpotong dengan ellipsis** di 2/10 (1440) dan 4/10 (1920) shot — by-design (klip 81–86px tidak muat "0 · 1.55 · 5.4" penuh); info lengkap kini ada di tooltip (`title`), itu perbaikan yang diminta audit.
3. **Hitungan `fine` (mouse desktop) tidak berubah** (834: 24/28, 390: 20/24, 1440: 43/55) — disengaja: perbaikan hanya untuk `pointer:coarse`, supaya tampilan desktop tidak membengkak. Angka audit 33/49 di 834 diukur mode fine headless; realita tablet (coarse) sebelum perbaikan adalah 1/27, bukan 33/49.
4. **Klaim audit "chip menumpuk judul di 1024 fokus" tidak terreproduksi lewat rect** (0px² di semua lebar) — yang tertutup di sana adalah watermark (418px²); keduanya hilang sesudah perbaikan.
5. **Klip timeline + slider range bukan target 44px** — dikeluarkan dari hitungan tombol (§0.3) dan didokumentasikan, bukan disembunyikan.
6. **Verifikasi tablet nyata / Web Speech tidak dilakukan** — butuh perangkat Rehan; semua bukti headless (port 3319, dimatikan sesudah verifikasi).

## 7. File yang diubah + bukti

**Diubah (2 file, kode studio saja):**
- `app/globals.css` — U14 (:151), U15 (:8–10, :25–29), U16 (:231, ~:438, :603–630, :805–832), U17 (:278), U18 (:561–566), U19 (~:522).
- `components/Studio.tsx` — U17 (:3019, :3056), U18 (:2805).

**Bukti baru (`verification/`, 33 screenshot + laporan ini):**
- Laporan ini: `fix-audit500-g9-u14u19.md`
- Sebelum: `fix-audit500-g9-u14u19-before-u14-1440.png`, `before-u14-*-focus.png` (6 lebar), `before-u15-dark.png`, `before-u15-light.png`, `before-u16-transport-834-coarse.png`, `before-u17-timeline-1440.png`, `before-u18-template-trio.png`, `before-u18-template-code.png`, `before-u19-768-portrait.png`, `before-u19-834-portrait.png`, `before-u19-1180-portrait.png`, `before-u19-390-portrait.png`
- Sesudah: `fix-audit500-g9-u14u19-after-u14-1440.png`, `after-u14-1440-focus.png`, `after-u14-1920-focus.png`, `after-u14-stage-template-trio-t0.png`, `after-u14-stage-template-code-t0.png`, `after-u15-dark.png`, `after-u15-light.png`, `after-u16-tour-390-coarse.png`, `after-u16-tour-1440-coarse.png`, `after-u17-timeline-1440.png`, `after-u18-template-trio.png`, `after-u18-template-code.png`, `after-u19-768-portrait.png`, `after-u19-834-portrait.png`, `after-u19-1180-portrait.png`, `after-u19-390-portrait.png`

**Skrip kerja (di luar repo, persisten):** `~/workspace/g9-u14u19/h.mjs` (harness), `repro-before.mjs` (`repro-before.json`), `repro-u14-v2.mjs` (`repro-u14-before.json`), `shots-before2.mjs`, `verify-after.mjs` (`verify-after.json`), `recheck-u16.mjs`, `regression-after.mjs` (`regression-after.json`).
