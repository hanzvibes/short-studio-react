# Perbaikan G1 — U1 (BLOCKER): Trio/Deploy/Rival tidak bisa diedit saat baru dibuka

- **Tanggal:** 2026-11-19 (WIB)
- **Acuan:** `verification/audit-500-2026-11-18.md` — T1 (Trio), D1 (Deploy), R1 (Rival)
- **Status: SELESAI — U1 hilang.** Reproduksi di main `c9d93a74` membuktikan temuan MASIH ADA
  (bukan "sudah hilang"); sesudah perbaikan, fresh load 0 error di 12/12 template.
- **Tidak ada push / branch / merge** (koordinator yang push sesudah verifikasi).

## 1. Temuan (reproduksi — SEBELUM perbaikan)

Fresh load `#template-trio`, `#template-deploy`, `#template-rival` di server prod
port 3311 (`npm run build` + `npm start -- --port 3311`), Playwright +
`chrome-headless-shell`, viewport 1440×900, localStorage kosong:

| Template | Error validasi bawaan | Status Terapkan | Slider beat (input ter-clamp vs label) |
|---|---|---|---|
| Trio | 2 — `beat.tired: 16.5 di bawah batas 18.`, `beat.joy: 21 di bawah batas 24.` | `Ada 2 error validasi — perbaiki dulu, Terapkan ditahan.` — Terapkan disabled di SEMUA tab | lelah: input `18` vs label `16.50 detik`; senang: input `24` vs label `21.00 detik` |
| Deploy | 1 — `beat.done: 15 di bawah batas 16.` | `Ada 1 error validasi — perbaiki dulu, Terapkan ditahan.` — Terapkan disabled di SEMUA tab | selesai: input `16` vs label `15.00 detik` |
| Rival | 1 — `beat.joy: 21 di bawah batas 22.` | `Ada 1 error validasi — perbaiki dulu, Terapkan ditahan.` — Terapkan disabled di SEMUA tab | senang: input `22` vs label `21.00 detik` |

Di tab Objek tiap pesan muncul 2× (ringkasan + per baris — itu temuan T8/R6 terpisah,
bukan bagian U1): Trio 4 node `.valid-err`, Deploy/Rival 2 node. 0 `pageerror` /
console error di ketiganya. Bukti:
`fix-audit500-g1-u1-before-trio-objek.png`, `fix-audit500-g1-u1-before-deploy-objek.png`,
`fix-audit500-g1-u1-before-rival-objek.png` (+ `-fresh.png` tiap template) dan
`fix-audit500-g1-u1-before-summary.json`.

## 2. Akar

`parseProps()` → `readProp()` membaca nilai prop dari HTML template. Untuk anchor
`const-sites`, konstanta (`T_TIRED` / `T_JOY` / `T_DONE`) BELUM ADA di template asli
(grep: 0 kemunculan di kelima file) — jadi `readProp` mengembalikan `anchor.default`
TUNGGAL yang dipakai bersama semua template. Nilai itu benar untuk template
pemiliknya, tapi salah untuk tiga template ini:

| Prop | `default` bersama (pemilik) | Rentang per-file | Nilai ASLI template (dibaca dari file, read-only) |
|---|---|---|---|
| `beat.tired` | 16.5 (Versus: `tr=s2(16.5,17.5)`) | Trio 18–23 | **20.5** — Trio `tr=s2(20.5,21.5)` (konsisten: `q=s2(20.5,22.5)`, `t>=22.6` = +2.1) |
| `beat.joy` | 21 (Versus: `jy=s2(21,22)`) | Trio 24–29; Rival 22–27 | **26** — Trio `jy=s2(26,27)` (`6.2832*s2(26.6,28.2)`, `t>=26.3` = +0.3); **24.6** — Rival `jy=s2(24.6,25.1)` (`t<25` = +0.4, `t>=24.6`) |
| `beat.done` | 15 (Typing: `cel=t>=15&&t<19`) | Deploy 16–21 | **18.4** — Deploy `cel=s2(18.4,18.8)` (konsisten: `PD.push(18.4+…)`, `ts<21.4` = +3, `t>=18.4&&t<22.6`) |

`validateProps()` lalu menolak draft bawaan itu, dan `allErrors > 0` mengunci
Terapkan di semua tab (`components/Studio.tsx:2840,2902,3002,3094,3184`).
Slider menampilkan nilai ter-clamp karena `<input type="range" value={16.5}
min={18}>` dijepit browser ke 18, sementara label `<b>` memakai nilai draft
asli 16.50 — gejala yang sama, akar yang sama.

Baseline pra-perbaikan (CLI, `readProp` + `validateProps` semua template):
**hanya 4 error itu di 12 template** — tidak ada error bawaan lain.

## 3. Perbaikan (kode studio saja — template asli TIDAK disentuh)

Pilihan: **nilai default per-file = nilai asli template** (bukan melebarkan rentang —
melebarkan rentang akan membuat Terapkan tanpa-edit menyuntik `T_TIRED=16.5` ke Trio
dan mengubah cerita aslinya dari 20.5 ke 16.5).

Mekanisme baru, cermin di kedua file: field opsional `defaultByFile` pada anchor
`const-sites` + helper `anchorDefault(a, file)` yang dipakai `readProp` saat
konstanta belum ada di template. Tanpa override, perilaku identik dengan sebelumnya.

### `lib/studio.ts`
- Baris 629 — tipe anchor `const-sites`: tambah
  `defaultByFile?: Record<string, number | number[]>`.
- Baris 4085–4093 — helper baru `anchorDefault(a, file)` (+ KDoc).
- Baris 4385 — `readProp`, cabang `const-sites`: `const dv = anchorDefault(a, file);`
  lalu `dv` dipakai sebagai pengganti `a.default` (skalar + array-index).
- Baris 2895 — `beat.tired`: `"defaultByFile": { "template-trio.html": 20.5 }`.
- Baris 2977 — `beat.joy`:
  `"defaultByFile": { "template-trio.html": 26, "template-rival.html": 24.6 }`.
- Baris 3510 — `beat.done`: `"defaultByFile": { "template-deploy.html": 18.4 }`.

### `scripts/apply-edit.mjs` (cermin — wajib sinkron dengan lib)
- Baris 3908–3914 — helper `anchorDefault` (JS, sama).
- Baris 3963 — `readProp`, cabang `const-sites`: sama seperti lib.
- Baris 2562 / 2644 / 3177 — tiga `defaultByFile` yang sama persis seperti lib.

**Tidak diubah:** rentang validasi (`rangeByFile`), `setProp`/`ensureConst`
(jalur tulis memakai nilai baru, bukan default), `components/Studio.tsx`,
`scripts/export.mjs`, dan 12 template asli. `default` bersama tetap 16.5 / 21 / 15
untuk Versus/Typing.

## 4. Verifikasi sesudah perbaikan

### 4.1 Build + sync-check — HIJAU
- `npm run build`: hijau (`Compiled successfully`, 4/4 static pages).
- `node scripts/sync-check.mjs`: **SEMUA HIJAU — 12/12 template byte-identik
  lib == mjs** (modul + CLI + alias array), contoh spec exit 0, vendor three.js
  12/12 rewrite 13/13 + export tetap CDN.

### 4.2 Baseline lib + CLI — 0 error di 12/12 template
- CLI (`readProp` + `validateProps`): 12/12 `errors=0` (sebelumnya Trio 2,
  Deploy 1, Rival 1; sisanya sudah 0).
- Lib terkompilasi (`readProp` + `validateProps` + `crossCheckProps`):
  12/12 `errors=0`. Nilai yang dibaca lib: trio tired **20.5**, trio joy **26**,
  deploy done **18.4**, rival joy **24.6**. Urutan beat tetap terjaga
  (trio 9 < 20.5 < 26; deploy 3 < 9 < 12.3 < 18.4; rival 15.2 < 20.8 < 24.6 < 31).

### 4.3 Headless 12/12 fresh load — 0 error validasi bawaan
Server prod port 3311 (build baru), Playwright + chrome-headless-shell,
1440×900, localStorage kosong per template:

| Template | objekErrs | Status | Page errors |
|---|---|---|---|
| template (Versus), code, kuota, trio, perang, typing, deploy, bughunter, bomb, meeting, sleep, rival | 0 semua | `Tidak ada perubahan — ubah teks, caption, shot, atau pengaturan objek untuk mengaktifkan Terapkan.` (Terapkan disabled karena belum ada perubahan — by-design, BUKAN karena error) | 0 semua |

Slider beat sesudah perbaikan — input == label (clamp hilang):
Trio lelah `20.5` / `20.50 detik`, senang `26` / `26.00 detik`;
Deploy selesai `18.4` / `18.40 detik`; Rival senang `24.6` / `24.60 detik`.
Template lain tidak berubah (mis. Typing `beat.done` tetap `15` / `15.00 detik`;
Versus `beat.tired` 16.5 / `beat.joy` 21 tetap valid di rentangnya).
Bukti: `fix-audit500-g1-u1-after-*-fresh.png` + `fix-audit500-g1-u1-after-*-objek.png`
(24 file, 12 template) dan `fix-audit500-g1-u1-after-summary.json`.

### 4.4 Alur edit → Terapkan → Simpan → reload (Trio) — BERFUNGSI
(`fix-audit500-g1-u1-after-flow.json`, `fix-audit500-g1-u1-after-trio-{applied,saved,reload-objek}.png`)
- Fresh: 0 error, Terapkan disabled (belum ada perubahan).
- Ketik judul `AUDIT G1 U1 TRIO` → Terapkan AKTIF, `Siap diterapkan: 1 teks.`
  (sebelum perbaikan, langkah ini mustahil: Terapkan terkunci oleh 2 error beat).
- Terapkan → judul di iframe `AUDIT G1 U1 TRIO…`, `ss.edits.v1` tersimpan.
- Simpan sebagai video baru → `ss.mine.v1` = 1 entri, `AUDIT G1 U1 TRIO`.
- Reload → judul tetap `AUDIT G1 U1 TRIO…`, entri Video Buatan Saya tetap ada,
  0 error, beat tetap lelah 20.5 / senang 26 (input == label).
- 0 `pageerror` / console error selama alur.

### 4.5 CLI `apply-edit.mjs` — perilaku lain tidak berubah
- Trio spec `{"beat.tired": 21, "beat.joy": 27}` → exit 0,
  output `const T_TIRED=21;` + `const T_JOY=27;`.
- Versus spec `{"beat.tired": 16.5, "beat.joy": 21}` (default bersama) → exit 0,
  output `const T_TIRED=16.5;` + `const T_JOY=21;` — Versus tidak berubah.
- Trio spec `{"beat.tired": 16.5}` (nilai lama, di luar rentang trio) → **exit 1**,
  `apply-edit: error: beat.tired: 16.5 di bawah batas 18.`, tanpa file output —
  validasi rentang tetap berlaku.

### 4.6 Template asli utuh
`stat` sesudah semua kerja: 12/12 `public/templates/*.html` mtime tetap
**2026-11-17 08:19:01** (tidak satu byte pun berubah). File audit
(`verification/audit-500-*.md`, `verification/audit500-*`) tidak disentuh.
Tidak ada push / branch / merge (repo lokal di VM ini bahkan bukan checkout git).

## 5. Yang TIDAK berhasil / sisa (dengan bukti)

1. **`beat.debate` Trio — default 9 vs nilai asli 12, SENGAJA TIDAK diubah.**
   Dalam rentang (9–15) jadi tidak memblokir dan bukan bagian U1 — tapi akar yang
   sama: bila pengguna menyimpan edit apa pun di Trio, `draftProps` penuh
   (termasuk `beat.debate: 9`) ditulis ke preview, dan `T_DEBATE=9` menggantikan
   debat asli 12 (`ar=s2(12,13)`). Bukti CLI: `applyEdits` dengan `props` =
   `parseProps` Trio menghasilkan `const T_DEBATE=9;`.
   Rekomendasi: perbaikan satu baris yang sama (`defaultByFile` Trio 12) di grup
   berikut — perlu keputusan koordinator karena mengubah nilai yang ditulis saat
   simpan di Trio (ke arah nilai asli, tapi tetap perubahan perilaku).
   Audit sistematis semua default beat vs rentang: HANYA 4 nilai U1 yang di luar
   rentang; `beat.debate` Trio adalah satu-satunya default beat lain yang
   terbukti ≠ nilai asli template (dicek dari situs anchornya).
2. **Slider ter-clamp UMUM (zona mati / nilai ditolak tetap tampil, V4) tidak
   diubah.** Instance fresh-load U1 hilang karena default kini dalam rentang
   (input == label, §4.3). Perilaku umum saat pengguna menggeser ke nilai yang
   ditolak validasi gabungan tetap seperti sebelumnya (by-design, temuan audit
   terpisah) — bukan bagian G1.
3. **Warning bawaan pra-ada tetap ada (bukan error, tidak memblokir):**
   Perang 2 warning (`claude.x` / `codex.x` "sudah dekat tepi layar");
   Bug Hunter 3 warning via `crossCheckProps` lib (jendela ketik "mepet",
   keluarga B9). Tidak disentuh.
4. **Verifikasi tablet / Web Speech tidak dilakukan** — butuh perangkat Rehan;
   semua bukti di atas headless 1440×900.

## 6. File yang diubah

| File | Perubahan |
|---|---|
| `lib/studio.ts` | tipe `const-sites` + `defaultByFile` (:629); helper `anchorDefault` (:4085–4093); `readProp` pakai `anchorDefault` (:4385); 3× `defaultByFile` (:2895, :2977, :3510) |
| `scripts/apply-edit.mjs` | helper `anchorDefault` (:3908–3914); `readProp` pakai `anchorDefault` (:3963); 3× `defaultByFile` (:2562, :2644, :3177) |

## 7. Bukti (di `verification/`)

- Laporan ini: `fix-audit500-g1-u1.md`
- Sebelum: `fix-audit500-g1-u1-before-{trio,deploy,rival}-{fresh,objek}.png` (6),
  `fix-audit500-g1-u1-before-summary.json`
- Sesudah: `fix-audit500-g1-u1-after-*-{fresh,objek}.png` (24, 12 template),
  `fix-audit500-g1-u1-after-summary.json`,
  `fix-audit500-g1-u1-after-trio-{applied,saved,reload-objek}.png` (3),
  `fix-audit500-g1-u1-after-flow.json`
- Skrip verifikasi sementara (repro 12 template + alur + baseline) sudah dihapus
  dari `scripts/` supaya tree bersih; salinan ada di `/tmp/g1-repro.mjs`,
  `/tmp/g1-flow.mjs`. Server port 3311 dimatikan sesudah verifikasi.
