# Perbaikan G4 — U4: Simpan-ulang video tersimpan selalu membuat duplikat

- **Tanggal:** 2026-11-19 (WIB)
- **Acuan:** `verification/audit-500-2026-11-18.md` — U4, L1/M1, A9
- **Status: SELESAI — simpan-ulang memperbarui entri yang sama di desktop 1440 dan HP 390; simpan dari template asli tetap membuat entri baru; hapus tetap berfungsi.**
- **Tidak ada push / branch / merge** (koordinator yang push sesudah verifikasi).
- **Metode:** server prod port 3314 (`npm run build` + `npm start -- --port 3314`), Playwright + `chrome-headless-shell`, localStorage kosong per skenario. Skrip: `~/workspace/g4-u4/repro.mjs`, `~/workspace/g4-u4/regression.mjs`, `~/workspace/g4-u4/debug-resave.mjs` (di luar repo, persisten — bukan /tmp).

## 1. Reproduksi — SEBELUM perbaikan: BUG di desktop dan HP

Alur (template Adu Kode, `template-code.html`): edit judul → Terapkan → Simpan → buka entri dari Video Buatan Saya → ubah judul → Terapkan → Simpan lagi. Hasil sebelum perbaikan — **bukan "sudah hilang"**:

| Langkah | Desktop 1440 | HP 390 (drawer "+ Simpan") |
|---|---|---|
| A. Simpan dari template asli "U4 REV-A" | 1 entri, id `mine-mwnamwxi7z1i`, badge 1 | 1 entri, id `mine-mwnaozmswoqq`, badge 1 |
| B. Buka entri → judul "U4 REV-A V2" → Terapkan → Simpan | **2 entri** (id baru `mine-mwnan8wsndze` + lama), badge **1→2**, toast "disimpan" | **2 entri** (id baru `mine-mwnapewoo99j` + lama), badge **1→2** |
| C. Simpan-ulang ke-2 ("U4 REV-A V3") | **3 entri** | **3 entri** |
| D. Reload | 3 entri bertahan; buka entri pertama → judul V3 | sama |
| E. Rename label di dialog ("U4 RENAMED LABEL") | **4 entri** | **4 entri** |
| F. Simpan tanpa edit dari entri tersimpan | **5 entri** | **5 entri** |
| G. Pindah template (Versus) → simpan | 6 entri (entri baru, benar — tapi tidak membedakan karena semua simpan selalu baru) | 6 entri, `activeOn=false` sesudah pindah |
| H. Hapus semua | `ss.mine.v1=[]`, badge 0 — hapus OK | sama |

Dialog sebelum perbaikan selalu berjudul "Simpan sebagai video baru" + tombol "Simpan video", tanpa petunjuk apa pun bahwa entri yang sedang dibuka akan diduplikasi. 0 `pageerror` di kedua run. Bukti: `fix-audit500-g4-u4-before-{desktop,mobile}-{a,b,d,e}-*.png` (8 screenshot) + `~/workspace/g4-u4/repro-before-{desktop,mobile}.json`.

## 2. Keputusan UX (didokumentasikan — sesuai tugas)

1. **Buka entri tersimpan → edit → Simpan = PERBARUI entri itu.** Id tetap, isi (teks/caption/shot/VO/props) ikut yang terbaru, posisi di daftar tetap, `createdAt` tetap, `updatedAt` dicatat. Toast: `"…" diperbarui di Video Buatan Saya` (bukan "disimpan").
2. **Buka TEMPLATE asli → Simpan = tetap buat entri baru.** Penanda "sedang membuka entri tersimpan" adalah `activeMineId` — sudah ada di kode (diset `openMine`, dilepas saat pindah template biasa) dan dipakai sebagai kondisi.
3. **Rename label di dialog = perbarui entri yang sama dengan label baru, bukan duplikat.** Dialog mode perbarui menampilkan nama entri lama dan catatan "tidak membuat duplikat".
4. **Label TIDAK ikut judul yang sedang diedit.** Kolom nama di dialog mode perbarui diisi **nama entri lama**, bukan judul draft. Alasan: kalau diisi judul draft, simpan-ulang tanpa niat rename akan diam-diam mengganti nama entri (terbukti di run verifikasi pertama: label "U4 RENAMED LABEL" tertimpa jadi "U4 RENAMED ISI" pada simpan tanpa edit — lihat §4.1). Rename hanya terjadi bila pengguna mengubah kolom nama secara sadar. Dialog menjelaskan: "Nama tetap "…" kecuali diubah di kolom di atas."
5. **Simpan TANPA edit dari entri tersimpan = tetap perbarui, tidak membuat duplikat.** Hanya `updatedAt` yang berubah; tidak ada tombol yang dinonaktifkan (tidak ada "tanpa perubahan" yang perlu dicegah — update kosong itu aman dan konsisten).
6. **Hapus tidak diubah.** Tidak ada perubahan pada `deleteMine` maupun tombol Hapus.
7. **Daftar menampilkan tanggal terakhir diperbarui** (`updatedAt ?? createdAt`) + "(diperbarui)" bila pernah diperbarui — supaya entri yang diperbarui bisa dibedakan dari tanggalnya.

## 3. Perbaikan (kode studio saja — 1 file)

`components/Studio.tsx` (tidak ada perubahan di `lib/studio.ts` / `scripts/*` / template):

- **`MyVideo`** (:68): tambah field opsional `updatedAt?: number`.
- **`confirmSaveMine`** (:1704): bila `activeMineId` cocok dengan entri di `mine`, bangun entri dengan **id dan `createdAt` lama** + `updatedAt: Date.now()`, dan `setMine` me-`map` entri itu di tempat (posisi tetap); bila tidak cocok, jalur lama (id baru, masuk paling atas). Isi dibangun ulang penuh dari draft saat ini, jadi field edit yang sudah tidak berubah lagi (mis. caption yang dikembalikan) ikut terhapus dari entri — sama seperti perilaku entri baru. Toast kondisional "diperbarui"/"disimpan". Dependensi callback ditambah `activeMineId, mine`.
- **`activeMineEntry`** (baru, sesudah `hasNonTextEdits`): `mine.find(m => m.id === activeMineId) ?? null` — satu sumber kebenaran untuk mode dialog/tombol.
- **Dialog simpan** (:3331): judul "Perbarui video ini" vs "Simpan sebagai video baru"; catatan mode perbarui menyebut nama entri lama + "tidak membuat duplikat" + aturan nama; tombol utama "Perbarui video" vs "Simpan video".
- **Tombol pembuka dialog**: drawer `:2616` ("Perbarui" vs "+ Simpan", title kondisional) dan inspector `:2996` ("Perbarui video ini" vs "Simpan sebagai video baru", title kondisional). Keduanya mengisi kolom nama dengan **label entri lama** bila mode perbarui, judul draft bila entri baru (keputusan §2.4).
- **Daftar Video Buatan Saya** (:2626): tanggal memakai `updatedAt ?? createdAt` + "(diperbarui)".

## 4. Verifikasi — SESUDAH perbaikan

### 4.1 Repro (desktop 1440 + HP 390) — semua skenario hijau

Server sama, build baru. Satu id yang sama di semua langkah B–F:

| Langkah | Desktop 1440 | HP 390 |
|---|---|---|
| A. Simpan dari template "U4 REV-A" | 1 entri `mine-mwnax9zvtype`, badge 1, toast "disimpan" | 1 entri `mine-mwnayzw8bbnr`, badge 1 |
| B. Buka entri → judul V2 → Terapkan → Simpan | **1 entri, id sama**, label tetap "U4 REV-A", title "U4 REV-A V2", badge 1, dialog "Perbarui video ini", toast "diperbarui" | **1 entri, id sama**, sama |
| C. Simpan-ulang ke-2 (V3) | **1 entri, id sama**, title V3 | **1 entri, id sama**, title V3 |
| D. Reload → buka entri | 1 entri bertahan, judul V3 | sama |
| E. Rename di dialog ("U4 RENAMED LABEL", isi "U4 RENAMED ISI") | **1 entri, id sama**, label baru + isi baru | **1 entri, id sama**, sama |
| F. Simpan tanpa edit | **1 entri**, label tetap "U4 RENAMED LABEL" (tidak tertimpa judul — bukti keputusan §2.4 bekerja) | **1 entri**, sama |
| G. Pindah template (Versus) → simpan "U4 DARI TEMPLATE" | `activeOn=false`, **entri BARU** (2 entri total, id baru `mine-mwnaynh4dclm`), toast "disimpan" | **entri BARU** (2 entri, id baru `mine-mwnb0e71vv6o`) |
| H. Hapus semua | `ss.mine.v1=[]`, badge 0 | sama |

0 `pageerror` di kedua viewport. Bukti: `fix-audit500-g4-u4-after-{desktop,mobile}-{a,b,d,e}-*.png` (8 screenshot) + `~/workspace/g4-u4/repro-after-all.json`.

**Catatan run verifikasi pertama (sebelum §2.4 diterapkan):** langkah F menimpa label "U4 RENAMED LABEL" menjadi "U4 RENAMED ISI" karena kolom nama diisi judul draft — bug UX yang ditemukan oleh skrip sendiri, lalu diperbaiki dengan prefill nama entri lama (§2.4) dan diverifikasi ulang penuh (angka di tabel di atas adalah run sesudah prefill diperbaiki).

### 4.2 Build + sync-check — HIJAU

- `npx tsc --noEmit`: bersih.
- `npm run build`: hijau (`✓ Compiled successfully`).
- `node scripts/sync-check.mjs`: **SEMUA HIJAU — 12/12 template byte-identik lib == mjs**; vendor three.js 12/12 rewrite 13/13 + export tetap CDN. (Tidak ada perubahan di `lib/`/CLI; sync-check dijalankan sebagai bukti G1/G2 tidak rusak.)

### 4.3 Regresi

- **Fresh load 12/12**: semua `bridge=true`, **0 error validasi bawaan** (`.valid-err` = 0), status `Preview siap` — G1 tidak rusak. Durasi 26–36 dtk.
- **Alur edit → Terapkan → Simpan → reload** di 2 template (Adu Kode, Trio): judul masuk iframe sesudah Terapkan; simpan → 1 entri; buka entri → ubah judul → dialog "Perbarui video ini" / tombol "Perbarui video" → simpan-ulang → **id sama, title V2, tetap 1 entri**; sesudah reload judul V2 + entri bertahan. Bukti: `fix-audit500-g4-u4-after-flow-{template-code,template-trio}.png`.
- 0 `pageerror` / console error di semua run sesudah perbaikan.

**Catatan harness (bukan bug aplikasi):** run regresi pertama gagal di langkah simpan-ulang karena tombol simpan inspector `disabled` selama preview remount sesudah Terapkan (`disabled={!ready}`, perilaku lama) — klik saat disabled adalah no-op. Skrip diperbaiki agar menunggu tombol aktif (`~/workspace/g4-u4/debug-resave.mjs` membuktikan penyebabnya); run ulang hijau. Tidak ada perubahan kode aplikasi untuk ini.

### 4.4 Screenshot bukti visual

`fix-audit500-g4-u4-after-desktop-b-resave.png` memperlihatkan keadaan sesudah simpan-ulang: badge Video Buatan Saya = **1**, satu entri "U4 REV-A" aktif dengan sub-label "dari code · 19 Nov **(diperbarui)**", tombol inspector "Perbarui video ini", tombol drawer "Perbarui", dan judul preview "U4 REV-A V2".

## 5. Yang TIDAK berhasil / batasan

- **Tidak ada bagian yang gagal diperbaiki.** Semua skenario A–H hijau di kedua viewport.
- **Verifikasi tablet / Web Speech tidak dilakukan** — butuh perangkat Rehan; semua bukti headless 1440×900 dan 390×844.
- **Hint tab Objek** ("…lalu Simpan sebagai video baru", `:3273`) masih memakai frasa lama dan tidak kondisional — teks panduan umum, sengaja tidak diubah (di luar cakupan U4; mengubahnya butuh mengangkat teks ke luar JSX statis).
- **Skenario lintas-tab browser tidak diuji** (dua tab membuka entri yang sama lalu sama-sama simpan) — `activeMineId` per tab; tab yang simpan belakangan menimpa (last-write-wins). Perilaku yang sama dengan entri baru sebelumnya; tidak ada data yang hilang selain isi lama entri itu.

## 6. File yang diubah + bukti

**Diubah (1 file, kode studio saja):**
- `components/Studio.tsx` — `MyVideo.updatedAt` (:68); `confirmSaveMine` (:1704–1751, komentar keputusan UX); `activeMineEntry` (baru); tombol drawer `:2616`; tanggal daftar `:2626`; tombol inspector `:2996–2999`; dialog simpan `:3332–3348`.

**Tidak disentuh:** 12 template asli di `public/templates/` (mtime tetap **2026-11-17 08:19** semua); file audit (`verification/audit-500-*.md`, `verification/audit500-*`); file bukti G1–G3 (`verification/fix-audit500-g1-u1-*`, `fix-audit500-g2-u6-*`, `fix-audit500-g3-u2-*`); `lib/studio.ts`, `scripts/*`.

**Bukti baru (`verification/`, 18 screenshot + laporan ini):**
- Laporan ini: `fix-audit500-g4-u4.md`
- Sebelum: `fix-audit500-g4-u4-before-{desktop,mobile}-{a-save1,b-resave,d-reload,e-rename}.png` (8)
- Sesudah: `fix-audit500-g4-u4-after-{desktop,mobile}-{a-save1,b-resave,d-reload,e-rename}.png` (8) + `fix-audit500-g4-u4-after-flow-{template-code,template-trio}.png` (2)

**Skrip kerja (di luar repo, persisten):** `~/workspace/g4-u4/repro.mjs`, `~/workspace/g4-u4/regression.mjs`, `~/workspace/g4-u4/debug-resave.mjs`, hasil JSON `repro-before-desktop.json`, `repro-before-mobile.json`, `repro-after-desktop.json`, `repro-after-all.json`, `regression-after.json`. Server tes port 3314 dimatikan sesudah verifikasi.
