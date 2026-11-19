# Perbaikan G2 — U6 (keluarga F2): waktu video ke-reset ke 0 saat mengedit

- **Tanggal:** 2026-11-19 (WIB)
- **Acuan:** `verification/audit-500-2026-11-18.md` — U6 (F2/R1/R2/R3) + A12
- **Status: SELESAI — keempat varian hilang (t bertahan ≈15, settled).**
- **Tidak ada push / branch / merge** (koordinator yang push sesudah verifikasi).
- **Catatan lingkungan:** direktori lokal ini TIDAK punya `.git`, jadi hash main
  `85c66a64` dari penugasan tidak bisa diverifikasi lewat `git log` di sini;
  yang diverifikasi adalah kode yang sedang ada di
  `~/workspace/short-studio-react` (sudah berisi perbaikan G1 — `defaultByFile`
  beat Trio/Deploy/Rival ada di `lib/studio.ts`).

## 1. Reproduksi — SEBELUM perbaikan

Server prod port 3312 (`npm run build` + `npm start -- --port 3312`),
Playwright + `chrome-headless-shell`, viewport 1440×900, localStorage kosong,
template `#template-code` (Adu Kode). Set t=15 lewat `bridge.seek(15)`,
picu live reload dengan nudge slider Objek, lalu uji tiap varian.
Skrip: `/tmp/g2-u6/repro.mjs`, `/tmp/g2-u6/repro-iii-tight.mjs`.

| Varian | Sebelum (t) | Bukti |
|---|---|---|
| (i) drag slider saat preview loading (aliran event input 28× @600 mdtk) | **15 → −0,08 (≈0)**; bridge sempat hilang; slider −1,7→−0,3 | `fix-audit500-g2-u6-before-i-drag.png` |
| (ii) ArrowRight 5× pada slider "Besar-kecil" saat live reload | **15 → −0,09 (≈0)**; bridge hilang saat tekan; slider 1→1,3 | `fix-audit500-g2-u6-before-ii-keyboard.png` |
| (iii) klik Terapkan saat live reload | **15 → 0** (run ketat, klik 926 mdtk sesudah nudge saat bridge hilang; judul tetap tersimpan `G2-U6-JUDUL-KETAT`); Terapkan `disabled=false` saat reload | `fix-audit500-g2-u6-before-iii-terapkan-ketat.png` |
| (iv) klik Kembalikan Objek saat live reload | **15 → 0**; slider 1→1 (reset benar); Kembalikan `disabled=false` saat reload | `fix-audit500-g2-u6-before-iv-kembalikan.png` |

Dikonfirmasi juga akar dari laporan: **Terapkan/Kembalikan `disabled=false`
saat live reload** — `ready` tetap `true` selama live reload.

**Catatan varian (iii):** run longgar pertama (ganti tab Teks dulu, klik ~2 dtk
sesudah nudge) memberi t=15 — klik mendarat SESUDAH reload selesai, jadi
jendela race terlewat (`fix-audit500-g2-u6-before-iii-terapkan.png`).
Varian (iii) adalah race yang sensitif terhadap timing; run ketat (klik
#apply-objek segera setelah bridge hilang terdeteksi) mereproduksinya
(15 → 0). Sama seperti A12b di laporan ("tidak konklusif") vs worker race B1
("ter-reproduksi") — selisihnya hanya timing.

## 2. Akar — lebih dalam dari perkiraan awal laporan

Laporan menyebut `mount(true)` membaca `bridge.gT()` = 0 "bila bridge belum
siap". Penyelidikan membuktikan ada DUA wujud "belum siap":

1. **Bridge hilang total** (`__st` null) — `currentTime()` mengembalikan 0.
2. **Bridge BARU sudah ada tapi onload-nya belum jalan** — `__st` sudah
   terpasang, tapi `gT()` mengembalikan ≈0 (bahkan sedikit negatif,
   mis. −0,06) karena `T` template masih 0 dan frame pertama template bisa
   memberi `dt` negatif (`loop`: `dt=(now-last)/1000` tanpa penjaga bawah;
   `now` dari rAF bisa lebih awal dari `last` saat script baru dievaluasi).
   Probe trajektori (`/tmp/g2-u6/probe-ii.mjs`) menangkap ini langsung:
   bridge baru muncul dengan t=−0,062, lalu −0,048, sebelum akhirnya
   onload men-seek ke 15 dan stabil.

Karena itu perbaikan v1 (hanya "bila `st()` null pakai waktu terakhir") TIDAK
cukup: run verifikasi v1 masih gagal di (i) t=0 dan (ii) t=−0,072, sementara
(iii)/(iv) lolos. Penyebabnya: `mount` membaca `gT()=0` dari bridge baru
yang belum di-seek, dan sync loop sempat menulis 0 itu ke `lastTimeRef` di
jendela antara `setReady(false)` dan re-render React (state `ready` di
closure bisa basi satu tick). Perbaikan final memakai **`readyRef`** —
cermin sinkron dari `ready` — sebagai gerbang.

## 3. Perbaikan (kode studio saja)

### `components/Studio.tsx`

- **Baris 554–560** — `readyRef = useRef(false)` baru, cermin sinkron dari
  `ready`; diperbarui di SETIAP situs `setReady` (4 tempat).
- **Baris 735–739** — `lastTimeRef = useRef(0)` baru: waktu video terakhir
  yang tercatat dari bridge.
- **Baris 773–781** — `currentTime()`: bila bridge tidak ada / `gT()` throw /
  tidak finite → kembalikan `lastTimeRef.current`, BUKAN 0.
- **Baris 784–791** — `goTo()`: mencatat target seek ke `lastTimeRef`.
- **Baris 1043** — `mount()`: `t = keepTime ? (readyRef.current ? currentTime()
  : lastTimeRef.current) : resumeAt` — bridge baru yang belum di-seek tidak
  pernah dibaca.
- **Baris 1097–1098** — `mount()` set `readyRef=false; setReady(false)`
  tepat sebelum `pv.srcdoc = out` (live reload → tombol Terapkan/Kembalikan
  disabled selama reload).
- **Baris 1124, 1145, 1175** — `readyRef` diperbarui di onload-error (false),
  onload-sukses (true, sesudah `bridge.seek(t)`), dan `load()` (false).
- **Baris 1141** — onload: `lastTimeRef.current = t` sesudah seek.
- **Baris 1817–1827, 1852** — sync loop: baca `gT()` hanya bila
  `readyRef.current`; `lastTimeRef` diperbarui hanya dari nilai valid
  (`finite && >= 0`), termasuk cabang akhir video.

**Tidak diubah:** perilaku lain; `mount(false, 0)` (ganti template) tetap
mulai dari 0; Terapkan/Kembalikan tetap bekerja normal saat bridge siap
(dibuktikan di §4); alur inti edit→Terapkan→Simpan→reload utuh (§5).

### Micro-task (sisa G1, akar sama) — Trio `beat.debate`

- `lib/studio.ts:2863` dan `scripts/apply-edit.mjs:2530` (cermin identik):
  tambah `"defaultByFile": { "template-trio.html": 12 }` pada anchor
  `T_DEBATE` (nilai asli Trio dari `ar=s2(12,13)` di template; default
  bersama 9 benar untuk Versus `ar=s2(9,10.2)`).

## 4. Verifikasi — SESUDAH perbaikan (per varian)

Server sama, build baru (rebuild + restart). Skrip:
`/tmp/g2-u6/verify-after2.mjs` (iii/iv + cek disabled) dan
`/tmp/g2-u6/verify-after3.mjs` ((i)/(ii) dengan pembacaan **settled**).

**Mengapa "settled":** pembacaan 1200 mdtk sesudah bridge kembali BUKAN
settled — bridge baru sudah ada tapi onload-nya (seek 15) belum jalan,
jadi `gT()` masih ≈0 (artefak §2). Settled = tombol Terapkan-Objek aktif
lagi (`ready=true`) + identitas bridge stabil + `gT()` stabil pada 2 sample
berurutan. Tampilan waktu studio (`.nc-time`) sendiri tidak pernah
menampilkan 0 selama reload — tetap `0:15 / 0:30`.

| Varian | Sesudah (t settled) | Perilaku tombol saat reload | Bukti |
|---|---|---|---|
| (i) drag | **15 → 15** (settled 7,6 dtk; shown `0:15 / 0:30`; slider −0,3) | — | `fix-audit500-g2-u6-after-i-drag.png` |
| (ii) ArrowRight 5× | **15 → 15** (settled 5,5 dtk; shown `0:15 / 0:30`; slider 1→1,3) | — | `fix-audit500-g2-u6-after-ii-keyboard.png` |
| (iii) Terapkan | **15 → 15**; judul `G2-U6-JUDUL-SETELAH-FIX` tersimpan di `ss.edits.v1` | `disabled=true` saat reload; klik sesudah reload selesai menyimpan + t tetap 15 | `fix-audit500-g2-u6-after-iii-terapkan.png` |
| (iv) Kembalikan | **15 → 15**; slider 1→1 (reset benar) | `disabled=true` saat reload; klik-saat-disabled terbukti no-op (slider tetap 1,05); klik sesudah reload selesai me-reset + t tetap 15 | `fix-audit500-g2-u6-after-iv-kembalikan.png` |

0 `pageerror` / console error di semua run sesudah perbaikan.

**Yang tidak konklusif (dicatat jujur):** pada (iii), pembacaan
`disabled=true` diambil sebelum klik, tetapi klik pertama kemungkinan
mendarat sesudah reload selesai (jendela reload ~2–4 dtk; jeda ganti tab +
isi field ≈1 dtk sesudah deteksi bridge hilang yang sendiri telat ~1,2 dtk)
— buktinya klik itu menyimpan (`klikSaatDisabledMenyimpan: true`).
Yang menentukan tetap terbukti: t=15 + judul tersimpan + tombol disabled
selama reload. Pada (iv) klik-saat-disabled justru terbukti no-op,
jadi perilaku "tombol mati saat reload" terkonfirmasi langsung di sana.

## 5. Regresi

- `npm run build`: **hijau** (`Compiled successfully`, 4/4 static pages).
- `node scripts/sync-check.mjs`: **SEMUA HIJAU — 12/12 template byte-identik
  lib == mjs**; vendor three.js 12/12 rewrite 13/13 + export tetap CDN.
- **Fresh load 12/12** (localStorage kosong per template): semua `ok=true`,
  bridge ada, 0 error validasi bawaan (`.valid-err` = 0 di semua template) —
  G1 tidak rusak. (`/tmp/g2-u6/regression-after.json`)
- **Alur edit→Terapkan→Simpan→reload** di 2 template:
  - `template-code.html`: judul `G2 U6 FLOW CODE` masuk iframe sesudah
    Terapkan; Simpan → `ss.mine.v1` = 1 entri; sesudah reload tetap 1 entri
    dengan judul sama.
  - `template-trio.html`: sama dengan judul `G2 U6 FLOW TRIO`.
  - Bukti: `fix-audit500-g2-u6-after-flow-code.png`,
    `fix-audit500-g2-u6-after-flow-trio.png`.

## 6. Micro-task debate — sebelum/sesudah

| Cek | Sebelum | Sesudah |
|---|---|---|
| `node scripts/apply-edit.mjs --list-props template-trio.html` → `beat.debate` | 9 (default bersama) | **12** |
| CLI tiruan jalur Studio (`/tmp/g2-u6/verify-debate.mjs`: semua nilai `parseProps` → `applyEdits`) | `T_DEBATE=9` (salah) | **`T_DEBATE=12`** (site-trio) |
| Versus (`template.html`) — tidak boleh berubah | 9 | **9** (site-versus, tetap) |
| Slider "Waktu mulai debat" di UI Trio (tab Objek → objek Jalan cerita) | — (nilai baca 9) | **12, label `12.00 detik`, rentang 9–15**; lelah 20,5 / senang 26 tetap (`fix-audit500-g2-u6-after-debate-trio.png`) |
| `node scripts/sync-check.mjs` | hijau | **hijau** (lib == mjs tetap sinkron) |

## 7. Yang TIDAK berhasil / batasan

- **Tidak ada varian yang gagal diperbaiki.** Keempat varian hilang pada
  pembacaan settled.
- **Batasan yang diketahui (bukan defect baru):** selama live reload, frame
  preview sempat menampilkan template dari T≈0 sampai onload men-seek ke
  waktu tercatat — itu bawaan reload iframe (template harus me-render
  sesuatu selagi dimuat) dan tampilan waktu studio tidak pernah menunjukkan
  0. Nilai akhir (settled) yang menentukan, dan itu 15 di semua varian.
- **Artefak template (bukan bug studio):** bridge baru membaca `gT()` sedikit
  negatif (≈ −0,06) pada frame pertama karena `dt` negatif di `loop`
  template; tidak berpengaruh sesudah onload men-seek.

## 8. File yang diubah + bukti

**Diubah (3 file, kode studio saja):**
- `components/Studio.tsx` — `readyRef` + `lastTimeRef` + gerbang di
  `mount`/`currentTime`/`goTo`/sync loop + `ready=false` saat live reload.
- `lib/studio.ts:2863` — `defaultByFile` Trio 12 untuk `beat.debate`.
- `scripts/apply-edit.mjs:2530` — cermin identik.

**Tidak disentuh:** 12 template asli di `public/templates/` (mtime tetap
`2026-11-17 08:19` semua); file audit (`verification/audit-500-*.md`,
`verification/audit500-*`); file bukti G1 (`verification/fix-audit500-g1-u1-*`).

**Bukti baru (`verification/`):**
- `fix-audit500-g2-u6-before-{i-drag,ii-keyboard,iii-terapkan,iii-terapkan-ketat,iv-kembalikan}.png`
- `fix-audit500-g2-u6-after-{i-drag,ii-keyboard,iii-terapkan,iv-kembalikan,flow-code,flow-trio,debate-trio}.png`
- Laporan ini: `fix-audit500-g2-u6.md`

**Skrip kerja (di luar repo, `/tmp/g2-u6/`):** `repro.mjs`,
`repro-iii-tight.mjs`, `verify-after.mjs`, `verify-after2.mjs`,
`verify-after3.mjs`, `verify-debate.mjs`, `probe-ii.mjs`,
`probe-debate.mjs`, `regression.mjs` (+ JSON hasil `repro-before.json`,
`repro-iii-tight.json`, `repro-after.json`, `repro-after2.json`,
`repro-after3.json`, `regression-after.json`).
Server tes port 3312 dimatikan sesudah verifikasi (koordinator bisa
menyalakan ulang dengan `npm run build && npm start -- --port 3312`).
