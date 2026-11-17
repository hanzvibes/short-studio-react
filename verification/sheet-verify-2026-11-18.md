# Verifikasi Independen — Bottom Sheet Inspector ("Alur HP Satu Layar")

**Project:** Short Studio React (`~/workspace/short-studio-react`) · main yang diklaim `7b36e5b9`
**Tanggal verifikasi:** 2026-11-18 · **Sifat:** INDEPENDEN, read-only terhadap kode produk
**Desain acuan:** `verification/sheet-design-2026-11-18.md`
**Metode:** skrip Playwright/CDP ditulis dari nol oleh worker verifikasi ini
(`sheet-verify-a.mjs`, `sheet-verify-b.mjs`, `sheet-verify-b1b.mjs`,
`sheet-verify-b4b.mjs`, `sheet-verify-b4c.mjs`, `sheet-verify-b4d.mjs`,
`sheet-verify-c.mjs`, `sheet-verify-c2.mjs`, `sheet-verify-final.mjs`,
`sheet-verify-a2.mjs`, `sheet-verify-b0.mjs`) — BUKAN skrip implementer
(`sheet-smoke.mjs` tidak dipakai; laporan implementer tidak dikutip).
Server `next start` lokal di :3000; three.js CDN di-route ke vendor lokal
(`/tmp/ss-vendor`, diunduh ulang sesudah restart VM menghapus `/tmp`).
Semua angka di bawah adalah hasil ukur ulang saya sendiri.

> **Catatan lingkungan:** proyek lokal ini TIDAK punya `.git`, jadi commit
> `7b36e5b9` tidak bisa diverifikasi lokal — yang diuji adalah isi file kerja
> saat ini. Runtime sempat restart di tengah jalan (skrip B terpotong sesudah
> B4; dijalankan ulang penuh sesudah server + vendor dipulihkan).
> Transisi CSS `.28s` berjalan **~1,0–1,3 dtk wall-clock di headless**
> (kompositor SwiftShader kelaparan karena iframe three.js render terus) —
> semua pengukuran sesudah drag/Esc memakai jeda 1,5–1,6 dtk; ini artefak
> headless, bukan cacat produk. Di perangkat nyata transisi mestinya .28 dtk.

## Verdict

# **TIDAK LAYAK PUSH**

Satu temuan blocking (F1): **tur langkah 3 (Inspector) sorotannya salah di
mode sheet** — sorotan menunjuk strip 26px di dasar layar, bukan inspector,
dan tidak pernah membaik sendiri. Semua hal lain yang diuji HIJAU
(lihat §1–§6). Perbaikan yang dibutuhkan kecil (ukur ulang sorotan sesudah
sheet selesai terbuka), dan verifikasi ulangnya satu probe — tapi selama F1
belum diperbaiki, alur tur pertama kali di HP (target utama fitur ini) tampil
rusak.

---

## 1. Build

| Perintah | Hasil |
|---|---|
| `npm run build` (dijalankan sendiri) | **HIJAU** — Compiled successfully 2.7s, typecheck + lint lolos |
| Route `/` | **49.3 kB**, First Load JS **152 kB** |

## 2. Geometri sheet — 390 / 768 / 834 portrait (touch, coarse)

Stage diukur via `getBoundingClientRect()` + `% kelihatan` = irisan stage
dengan viewport dikurangi bagian yang tertutup sheet. Semua lebar:
`sheetMode` aktif, inspector `position:fixed`, statusbar 28px tetap kelihatan,
`docScrollW` = lebar viewport (tanpa overflow-x), 0 console error / 0 pageerror.

| Lebar | Snap | Sheet (y atas) | Stage | Stage kelihatan | Timeline |
|---|---|---|---|---|---|
| **390×844** | Peek | y=668 (148px) | 197×350 | **100%** | strip 72px, terlipat |
| | Half | y=427,8 (388px = 46dvh) | 197×350 | **92,3%** | strip 72px |
| | Full | y=48 | 197×350 | 0% (by design) | strip 72px |
| | Closed | y=816 (translateY 100%) | 197×350 | 100% | kembali 264px |
| **768×1024** | Peek | y=848 (148px) | 255×454 | **100%** | strip 72px |
| | Half | y=525 (471px = 46dvh) | 255×454 | **92,5%** | strip 72px |
| | Full | snap `sheet-full` tercapai | 255×454 | — (terukur mid-transisi, lihat catatan) | strip 72px |
| **834×1112** | Peek | y=936 (148px) | 284×505 | **100%** | strip 72px |
| | Half | y=604 (480px = cap) | 284×505 | **98,8%** | strip 72px |
| | Full | *tidak tercapai via drag saya* | — | — | — |

Catatan:
- **Full 834 belum terbukti via drag**: drag mouse −600px dari Peek memberi
  visible 748px — ambang snap Full adalah 758px (tengah 480↔1036) — jadi
  mendarat di Half. Ini kekurangan jarak drag skrip saya, bukan bug produk;
  snap Full terbukti di 390/768 dan CSS-nya identik (`translateY(0)`).
  `escSeqFromFull` 834 (`peek,closed,closed`) adalah konsekuensi yang sama.
- **Full 768**: kelas `sheet-full` tercapai; posisi visual terukur y=238
  karena transisi headless masih berjalan saat sampel +700 mdtk. Probe
  lanjutan (A2, 390px) membuktikan sheet SELALU settle ke posisi snap
  (Full → y=48 persis) dalam ~1,3 dtk — inline `transform` kosong,
  `computed transform` bergerak menuju snap. Bukan macet.
- Transport selalu kelihatan di Peek/Half (390: y=484,5; 768: y=588,9;
  834: y=640). Judul header Peek: `Edit teks — Adu Kode`; tab Objek:
  `Sedang mengedit: Maskot oranye`. Toast lipatan muncul sekali:
  *"Timeline dilipat — ketuk ▴ Timeline untuk memilih klip"* ✓.

### Interaksi (ketiga lebar)

| Aksi | Hasil |
|---|---|
| Ketuk judul header | Peek ↔ Half ✓ (dan Full → Half) |
| Drag mouse gagang ke atas (lambat) | Peek → Half ✓; Peek → Full ✓ (390/768) |
| Fling sentuhan ke bawah (CDP touch, cepat) | Half → Peek ✓ (settle ~1,3 dtk headless) |
| Chevron `⌄` | Turun satu snap per ketukan sampai Closed ✓ |
| FAB `✎ Edit` saat Closed | Kelihatan di atas statusbar (390: x=291,7 y=744 82×56), ketuk → Peek ✓ |
| Esc | Full → Half → Peek → Closed berurutan ✓; Esc saat Closed tidak membuka apa-apa ✓ |
| Scrub ruler di strip | `gT()` 0 → **18,2** (klik 60% ruler) ✓ ketiga lebar |
| Tombol `▴/▾ Timeline` | Buka → timeline **264px** + label `▾ Timeline`; tutup → **72px** + strip ✓ |
| Klik klip Shot 1 (timeline terbuka) | Tab → Shot, judul sheet `Shot 1 terpilih`, seek t≈0,01 ✓ |

## 3. Alur edit lengkap DI DALAM sheet (390px)

Semua di dalam sheet; workspace **tidak perlu di-scroll**:
`scrollHeight 770` vs `clientHeight 768`, `scrollTop 0`.

### (a) Objek → slider → Terapkan (header)

- Slider pertama tab Objek: **`Geser kiri-kanan`** (Claude x), min −3 / max 3.
  Drag mouse nyata pada thumb yang sudah di-scroll ke layar
  (`elementFromPoint` = slider itu sendiri): **−1,7 → −0,55** ✓.
  Snap sheet TIDAK ikut bergerak saat slider digeser (R3) ✓.
- Terapkan header aktif sesudah drag (`disabled: false`) ✓.
- **Bukti preview berubah (waktu sama, video pause di t=6):**
  baseline pause 2 dtk = **0% diff** (frame deterministik) →
  live preview sesudah drag = **10,48% piksel berubah** (29.128/277.992 px) →
  sesudah Terapkan = **10,48% (identik)** → live-vs-apply **0%**.
  Jadi: pratinjau langsung jalan, Terapkan mengunci nilai yang sama.
- `ss.edits.v1` sesudah Terapkan berisi **`"claude.x": -0.55`** ✓.
- ⚠️ Efek samping (F2): drag slider me-reset waktu video ke **t=0**
  (`gT()` 6 → 0) — lihat §7, pra-ada, bukan regresi sheet.

### (b) Caption → Terapkan

- Caption pertama `Kodeku rapi. Satu fungsi, satu tugas.` diubah jadi
  **`VERIFIKASI SHEET 123`** → Terapkan → bridge `__st.caps()[0]` berubah
  persis ke nilai baru ✓ (`changed: true`).

### (c) Simpan sebagai video baru dari sheet

- Tombol `Simpan sebagai video baru` (pane Teks) → dialog terbuka, input nama
  terisi `Claude vs Codex` → simpan `Verifikasi Sheet` → toast
  *"Verifikasi Sheet" disimpan di Video Buatan Saya* ✓.
- Sesudah simpan: sheet **Closed** + drawer terbuka (sesuai desain) ✓.
- **Reload → entri bertahan**: `Verifikasi Sheet dari code · 17 Nov`
  di Video Buatan Saya ✓.
- **0 console error / 0 pageerror di semua langkah** (edit, caption, simpan,
  reload).

## 4. Keyboard virtual — yang terbukti vs yang tidak

Simulasi headless: override getter `visualViewport.height` → 520px +
dispatch `resize` (satu-satunya cara menggerakkan `visualViewport` di headless).

| Perilaku | Hasil |
|---|---|
| Keyboard "terbuka" (vvH 520) | Snap Peek → **Half** ✓, kelas `kb-open` ✓, `--vv-h: 520px` ✓ |
| Clamp tinggi sheet | Tinggi sheet **444px = 520 − 76** ✓ |
| Field fokus di-scroll ke tengah `.panes` | Field Judul y=589, dalam panes 560–871 ✓ |
| Keyboard "tertutup" (getter dipulihkan) | Snap kembali ke **Peek** ✓, `kb-open` hilang ✓ |

**JUJUR — yang TIDAK bisa dibuktikan headless:** keyboard fisik
(tinggi ±260–310px iOS vs Android/Gboard yang bervariasi, suggestion bar),
timing animasi keyboard vs `visualViewport.resize`, apakah Half cukup untuk
field + tombol Terapkan di layar nyata, safe-area/notch iPhone
(`env(safe-area-inset-bottom)` = 0 di headless). Semua itu **hanya bisa
di tablet**. Logika kodenya terbukti benar; perilaku perangkatnya belum.

## 5. Regresi

### Desktop 1440×900 — PERSIS
`sheetMode: false`, inspector **static 320px**, stage **226×401** (persis
§4.4.1), timeline **264px**, drawer docked (252px), `docScrollW` 1440,
0 error. Handle/FAB sheet tidak tampil. ✓

### Landscape 1366×768 — hampir persis (lihat F3)
Stage normal **195×347** (baseline Nov-17: 187×333 — selisih 14px, F3);
**fokus 334×594 PERSIS**; Esc keluar fokus ✓; timeline **186px** ✓;
`sheetMode: false`, inspector static. 0 error.

### Drawer 390px
Load tertutup (drawer x=−286) ✓. `#menu` → drawer terbuka (x=4) **dan
sheet tertutup** ✓. Klik scrim → kelas `drawer-closed` (visual settle
lambat headless, ~1 dtk) ✓. Tutup drawer **tidak** membuka sheet kembali ✓.

### Focus-view dari dalam sheet (390px)
Tombol fokus → sheet **Closed**, stage **364×647**, timeline/transport/
now-cap hilang ✓. Esc keluar fokus → sheet **TETAP tertutup** (tidak
membuka lagi) ✓, stage kembali 197×350, timeline 264 ✓.

### Rotasi 390 portrait → landscape → portrait
- → 844×390: `sheetMode` **OFF**, inspector kembali ke grid
  (`position:relative`, y=574 h=330), timeline **264**, transport penuh,
  stage 62×110 (baris viewer 250px — sesuai rumus `max(250,52dvh)`),
  `docScrollW` 844 ✓.
- → 390×844: `sheet-mode sheet-peek` kembali, stage 197×350, strip 72 ✓.

## 6. Tema terang, tur, sapuan string teknis

- **Tema terang di mode sheet:** sheet bg `rgb(247,247,248)`, judul
  `rgb(63,67,75)`, **kontras 9,27**; gagang `rgb(155,160,169)`; tab Objek
  (`Sedang mengedit: Maskot oranye`) terbaca penuh. ✓
  Bukti: `sheet-390-light-verify.png`.
- **Tur (390px, profil fresh):** muncul 7,5 dtk sesudah DOMContentLoaded
  (headless lambat; timer 750 mdtk dari mount — bukan cacat).
  Langkah 0 Project bin: sorotan menutupi drawer ✓ (sheet tertutup karena
  drawer dibuka — sesuai desain). Langkah 1 Viewer: sorotan menutupi viewer ✓.
  **Langkah 2 Timeline: ✓** — lipatan dibuka dulu (timeline 264px),
  sorotan y=540 h=276 menutupi timeline. **Langkah 3 Inspector: ✗ F1.**
  Langkah 4 Perintah cepat: sorotan {304,4,78,48} ✓. Esc menutup tur ✓.
  0 error.
- **Sapuan string teknis** (`claude.x`, `gs[0]`, `lookAt`, `caps`, `VO`,
  `LEN`, `T_BOARD`, `envelope`, `sinus`, `literal`, `srcdoc`, `props`):
  **0 hit** di keempat tab inspector maupun seluruh halaman (teks kelihatan). ✓

## 7. Temuan

### F1 — Tur langkah 3 (Inspector): sorotan tidak menunjuk inspector [BLOCKING]
- **Lebar:** 390px portrait (mode sheet). Langkah 2 di lebar yang sama BENAR.
- **Reproduksi:** profil fresh (tanpa `ss.tour`) → tur auto-start → ketuk
  `Lanjut` 3× → `Langkah 4 dari 5 — Inspector`.
- **Bukti:** sheet terbuka ke Half dengan benar (inspector y=428 h=768),
  tapi `.tour-spot` = **{x:4, y:810, w:378, h:26}** — strip 26px di dasar
  layar, di atas statusbar; inspector ikut teredup, kartu tur menutupi konten
  sheet. Disampel tiap 250 mdtk selama **4 detik: tidak pernah membaik**,
  padahal sheet sudah settle di Half sejak ~400 mdtk.
  Bukti: `sheet-390-tour2-step3-verify.png`, `sheet-verify-b4c.json`.
- **Akar (dari kode):** `tourPlace(3)` memanggil `setSheetSnap("half")`
  lalu LANGSUNG mengukur `.inspector` saat masih tertutup (y=816 → spot
  y=810 h=26). Re-measure 320/1000 mdtk (efek tur) terbukti tidak memperbaiki
  sorotan di headless meskipun sheet sudah settle — mekanismenya tidak jalan
  sebagaimana dirancang (§4.1.8: "ukur ulang sesudah transisi .28s").
- **Pembanding yang menentukan:** masuk ulang ke langkah 3
  (`Kembali` → `Lanjut`, sheet sudah Half) → sorotan **BENAR**
  (y=422 h=414). Jadi cacatnya spesifik "ukur-sebelum-sheet-terbuka".
- **Caveat perangkat:** di tablet transisi .28 dtk, re-measure 320 mdtk
  *mungkin* memperbaiki — tapi bukti headless menunjukkan re-measure tidak
  bekerja bahkan sesudah sheet settle, jadi kemungkinan besar cacat juga di
  perangkat. **Wajib cek ulang di tablet** sesudah perbaikan
  (mis. ukur sesudah `transitionend` sheet / tunda pengukuran sampai snap
  settle).

### F2 — Drag slider me-reset waktu video ke t=0 [NON-BLOCKING — pra-ada]
- **Bukti:** sheet mode: `gT()` 6 → 0 sesudah drag slider; **desktop 1440
  juga 6 → −0,08** (probe `sheet-verify-final.json`). Penyebab:
  `scheduleLive` → `mount(true)` me-regenerate srcdoc (pratinjau langsung
  dari pekerjaan Props, bukan dari sheet). Di mode sheet dampaknya lebih
  terasa karena pengguna sedang menonton momen tertentu sambil mengedit.
  Follow-up di luar PR sheet (preservasi waktu di `mount`/live preview).

### F3 — Stage 1366×768 = 195×347 vs baseline Nov-17 187×333 [NON-BLOCKING — observasi]
- Selisih 14px tinggi; fokus **334×594 PERSIS**, desktop 1440 PERSIS,
  portrait PERSIS. Tidak dapat diatribusikan ke sheet (`sheetMode: false`
  di 1366; CSS sheet scoped ke portrait ≤900px; `fitStage` tak disentuh).
  Diuji tab Teks/Objek + template Code/Trio — semuanya 195×347.
  Kemungkinan drift dari pekerjaan antara 17 Nov → main kini. Tanpa dampak
  fungsional.

### F4 — Judul header sheet terpotong di 390px [NON-BLOCKING — kosmetik]
- `Sedang mengedit: Maskot o…` (ellipsis 1 baris; Terapkan + chevron makan
  lebar). By-design (ellipsis). Bukti: `sheet-390-edit-flow-verify.png`.

### F5 — Timecode transport 768px bertumpuk [NON-BLOCKING — pra-ada]
- `00:00:00:0000:00:30:00` di transport 768px. **Sudah ada sebelum sheet**:
  terlihat identik di `mobile-768-home.png` (17 Nov). Di luar scope PR ini.

### Bukan temuan
- Transisi sheet ~1–1,3 dtk di headless (vs .28s CSS) — artefak SwiftShader,
  bukan cacat produk (probe A2: sheet selalu settle ke snap).
- Full 834 tidak tercapai via drag saya (jarak kurang ~10px dari ambang
  snap) — keterbatasan skrip, bukan produk.
- Keyboard fisik + safe-area notch — tidak teruji (hanya tablet);
  logika `visualViewport`-nya terbukti benar (§4).

## 8. Bukti (file `-verify`, tidak menimpa bukti implementer)

Skrip + JSON:
`sheet-verify-a.mjs` / `sheet-verify-a.json` · `sheet-verify-a2.mjs` /
`sheet-verify-a2.json` (settle) · `sheet-verify-b.mjs` / `sheet-verify-b.json`
(edit/keyboard/terang/tur/sweep) · `sheet-verify-b0.mjs` (probe slider) ·
`sheet-verify-b1b.mjs` / `sheet-verify-b1b.json` + `sheet-verify-kb.json`
(bukti edit deterministik + restore snap keyboard) ·
`sheet-verify-b4b.mjs` / `sheet-verify-b4b.json` (tur) ·
`sheet-verify-b4c.mjs` / `sheet-verify-b4c.json` (spot langkah 3, 4 dtk) ·
`sheet-verify-b4d.mjs` / `sheet-verify-b4d.json` (masuk ulang langkah 3) ·
`sheet-verify-c.mjs` / `sheet-verify-c.json` (regresi) ·
`sheet-verify-c2.mjs` (probe stage 1366) ·
`sheet-verify-final.mjs` / `sheet-verify-final.json` (toast + reset waktu desktop).

Screenshot kunci:
`sheet-390-peek-verify.png` · `sheet-390-half-verify.png` ·
`sheet-390-full-verify.png` · `sheet-390-closed-verify.png` ·
`sheet-390-drag-verify.png` · `sheet-390-tlopen-verify.png` ·
`sheet-768-peek-verify.png` · `sheet-768-half-verify.png` ·
`sheet-768-full-verify.png` · `sheet-834-peek-verify.png` ·
`sheet-834-half-verify.png` · `sheet-390-edit-flow-verify.png` ·
`sheet-390-edit-live-verify.png` · `sheet-390-edit-applied-verify.png` ·
`sheet-390-save-dialog-verify.png` · `sheet-390-mine-after-reload-verify.png` ·
`sheet-390-keyboard-verify.png` · `sheet-390-light-verify.png` ·
`sheet-390-tour-step2-verify.png` · `sheet-390-tour-step3-verify.png` ·
`sheet-390-tour2-step0-verify.png` … `sheet-390-tour2-step4-verify.png` ·
`sheet-390-tour2-step3-late-verify.png` ·
`sheet-390-tour2-step3-second-verify.png` ·
`sheet-390-drawer-verify.png` · `sheet-390-focus-from-sheet-verify.png` ·
`sheet-390-rotated-landscape-verify.png` ·
`sheet-390-rotated-back-verify.png` ·
`sheet-1440-desktop-verify.png` · `sheet-1366-landscape-verify.png` ·
`sheet-1366-focus-verify.png` · `sheet-390-settle-half-verify.png`.

**0 console error / 0 pageerror di semua run. Server `next start` masih
jalan di :3000.**
