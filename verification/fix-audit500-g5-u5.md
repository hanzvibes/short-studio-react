# Perbaikan G5 — U5: localStorage penuh → toast sukses palsu, data hilang diam-diam

- **Tanggal:** 2026-11-19 (WIB)
- **Acuan:** `verification/audit-500-2026-11-18.md` — U5 (H2 + A10)
- **Status: SELESAI — U5 hilang.** Reproduksi di main saat ini membuktikan temuan MASIH ADA (bukan "sudah hilang"); sesudah perbaikan, saat LS penuh tidak ada lagi toast sukses palsu, tidak ada entri palsu di daftar, dan Terapkan/Simpan bisa dicoba lagi sesudah penyimpanan dikosongkan.
- **Tidak ada push / branch / merge** (koordinator yang push sesudah verifikasi).

## 1. Reproduksi — SEBELUM perbaikan: BUG, persis seperti audit H2/A10

Server prod port 3315 (`npm run build` + `npm start -- --port 3315`), Playwright + `chrome-headless-shell`, viewport 1440×900, template Adu Kode (`template-code.html`). Pengisian halus sesuai catatan metode audit (pengisian kasar 256KB saja menyesatkan):

| Langkah | Hasil SEBELUM perbaikan |
|---|---|
| Isi LS | 19×256KB + 253×1KB + 1×100B = **5.239.808 B** kunci `__g5fill*`; probe `setItem` 100B **gagal `QuotaExceededError`**, probe 10B masih lolos (headroom <100B) |
| Edit subjudul → Terapkan | Toast **`"Semua edit diterapkan"` (PALSU)**, `ss.edits.v1` tetap **`{}`** |
| Simpan video baru ("G5 U5 VIDEO PENUH") | Toast **`"G5 U5 VIDEO PENUH" disimpan di Video Buatan Saya` (PALSU)**, `ss.mine.v1` tetap **`null`**, tapi daftar UI menampilkan **1 item palsu** (badge 1) |
| Reload (LS tetap penuh) | **0 item** Video Buatan Saya, `ss.mine.v1=null`, `ss.edits.v1={}`, sub kembali ke bawaan "kode siapa yang paling bagus?" |
| Bersihkan kunci buatan | 273 kunci dihapus, probe 100B lolos lagi |

0 `pageerror` / console error. Bukti: `fix-audit500-g5-u5-before-{apply-full,save-full,reload-full}.png` + `~/workspace/g5-u5/repro-before.json`.

## 2. Akar

Dua tempat menelan kegagalan `setItem` diam-diam:

1. **`ss.edits.v1` — tulis asinkron lewat efek.** `saveCurrentFullEdit()` hanya memperbarui state React `fullEdits`; tulis ke LS terjadi belakangan di efek `useEffect [fullEdits, restored]` dengan `try { setItem } catch { /* private mode */ }`. `applyAll()` memanggil `saveCurrentFullEdit()` lalu langsung toast `"Semua edit diterapkan"` tanpa pernah tahu tulisnya gagal.
2. **`ss.mine.v1` — tulis di dalam updater `setMine`.** `confirmSaveMine()` / `deleteMine()` menulis LS di dalam updater `setMine(prev => { …; try { setItem } catch {} … })`, SEMENTARA state UI sudah diperbarui — jadi entri muncul di daftar (badge 1) padahal tidak tersimpan.

## 3. Perbaikan (kode studio saja — 2 file)

### `components/Studio.tsx`

- **Helper `writeLS(key, value): boolean`** (:97–105) — satu-satunya jalur tulis kritis; kembalikan `false` bila `setItem` melempar (kuota penuh, mode privat, …).
- **Pesan error awam** (:111–115), tanpa istilah teknis ("kuota", "localStorage", "QuotaExceededError"); tiap pesan menyebut APA yang belum tersimpan + APA yang harus dilakukan:
  - Terapkan: `"Penyimpanan penuh, edit belum tersimpan — hapus sebagian video tersimpan dulu"`
  - Kembalikan: `"Penyimpanan penuh, kembalian belum tersimpan — hapus sebagian video tersimpan dulu"`
  - Ganti template (draf): `"Penyimpanan penuh, draf belum tersimpan — hapus sebagian video tersimpan dulu"`
  - Simpan video: `"Penyimpanan penuh, video belum tersimpan — hapus sebagian video tersimpan dulu"`
  - Hapus video: `"Penyimpanan penuh, video belum terhapus — hapus sebagian video tersimpan dulu"`
- **Toast error merah** — state `toastErr` (:602), `toast(msg, isErr=false)` (:~800, timer hapus-otomatis 2 dtk yang sama), render `:3535` (`toast on err` bila error). Posisi + durasi sama seperti toast lain (tengah bawah, `pointer-events:none`, tidak menutupi kontrol — terukur: toast y=852, tombol Terapkan y=332).
- **`saveCurrentFullEdit(): boolean`** (:~1320) — menghitung `next` dari cermin sinkron `fullEditsRef` (:793–794), **menulis LS secara sinkron** + mengembalikan hasil; efek persist (:1419) tetap ada sebagai jaring pengaman dan menulis ulang nilai yang sama, SENGAJA diam bila gagal (pemanggil sudah memberi toast; toast ganda hanya menakut-nakuti dua kali).
- **`applyAll()`** (:~1575): bila tulis gagal → pratinjau tetap diperbarui (`mount`), toast error (BUKAN "Semua edit diterapkan"), dan baseline `applied` dikembalikan ke nilai lama sesudah `mount()` — karena `mount()` sendiri memanggil `setApplied(fields)` (:1093), tanpa pengembalian ini Terapkan akan tampak nonaktif + status "Tidak ada perubahan" dan pengguna tidak bisa mencoba lagi. Sesudah perbaikan: status tetap **"Siap diterapkan: 1 teks."**, Terapkan tetap aktif (terbukti di §4.2 + screenshot `after-apply-status.png`).
- **Keempat reset** (`resetText` :1655, `resetCaps` :1672, `resetShots` :1683, `resetProps` :1699): toast sukses hanya bila tulis berhasil, bila gagal toast `ERR_RESET`.
- **`openTemplate()`** (:1356): draf template lama yang gagal di-persist saat pindah template → toast `ERR_DRAFT`.
- **`confirmSaveMine()`** (:1817): tulis LS DULU; bila gagal → toast error, **dialog tetap terbuka**, state `mine` TIDAK diubah (tidak ada entri palsu, badge tetap 0). Bila berhasil → perilaku lama (tutup dialog + toast sukses).
- **`deleteMine()`** (:1887): tulis dulu, baru ubah state; bila gagal → toast error, entri tetap tampil.

### `app/globals.css`

- `.toast.err{background:#b3261e;color:#fff}` (:437) — merah di kedua tema (terang/gelap).

### Keputusan cakupan — kunci non-kritis (didokumentasikan)

Kunci ini SENGAJA tetap diam-diam bila tulisnya gagal (try/catch lama dipertahankan), karena yang hilang hanya preferensi tampilan dan toast error yang menakutkan di tiap ganti tema lebih buruk daripada preferensi yang tidak bertahan; tulis-tulis ini juga kecil dan menggantikan nilai lama dengan ukuran sama, jadi biasanya tetap lolos walau penyimpanan hampir penuh:

| Kunci | Baris | Alasan |
|---|---|---|
| `ss.theme` | :900 | preferensi tema saja |
| `ss.drawer` | :936 | preferensi drawer saja |
| `ss.last` | :1362 | template terakhir dibuka saja (gagal → buka template pertama) |
| `ss.vzoom` | :2782 | preferensi zoom viewer saja |
| `ss.tour` | :2383 | penanda tur sudah dilihat saja |

Sesudah perbaikan, satu-satunya `localStorage.setItem` langsung yang tersisa adalah `writeLS` sendiri + 5 kunci non-kritis di atas. `lib/studio.ts` / `scripts/*` tidak disentuh (tidak ada tulis LS di sana) — `sync-check` tetap hijau sebagai bukti.

## 4. Verifikasi — SESUDAH perbaikan

### 4.1 LS penuh → tidak ada lagi klaim palsu (`repro.mjs after`)

Pengisian sama (19×256KB + 253×1KB + 1×100B, probe 100B gagal):

| Jalur | Toast yang tampil | Isi LS | Daftar UI |
|---|---|---|---|
| Terapkan (edit sub) | ✅ `"Penyimpanan penuh, edit belum tersimpan — hapus sebagian video tersimpan dulu"` (`toast on err`, terlihat) | `ss.edits.v1 = {}` (jujur: tidak diklaim tersimpan) | status **"Siap diterapkan: 1 teks."**, Terapkan tetap aktif |
| Simpan video baru | ✅ `"Penyimpanan penuh, video belum tersimpan — hapus sebagian video tersimpan dulu"` (`toast on err`) | `ss.mine.v1 = null` | **0 item, badge 0** — tidak ada entri palsu; dialog simpan **tetap terbuka** |
| Ganti template, draf kotor | ✅ `"Penyimpanan penuh, draf belum tersimpan — hapus sebagian video tersimpan dulu"` (`toast on err`) | `ss.edits.v1 = {}` | — |
| Reload (LS tetap penuh) | — | `ss.mine.v1=null`, `ss.edits.v1={}`, sub bawaan | 0 item |
| Bersihkan kunci buatan | 273 kunci dihapus, probe 100B lolos lagi | — | — |

0 `pageerror`. Bukti: `fix-audit500-g5-u5-after-{apply-full,save-full,switch-full,reload-full}.png` + `~/workspace/g5-u5/repro-after.json`.

### 4.2 Coba-lagi sesudah mengosongkan penyimpanan (`probe.mjs`)

- Terapkan gagal → kosongkan kunci buatan → klik Terapkan lagi (tanpa edit ulang) → **sukses**: toast `"Semua edit diterapkan"`, `ss.edits.v1` berisi `{"template-code.html":{"text":{"title":"Claude vs Codex","sub":"G5 U5 RETRY SUB",…}}}`.
- Simpan gagal (dialog tetap terbuka) → kosongkan → klik "Simpan video" lagi dari dialog yang sama → **sukses**: toast `"G5 U5 RETRY VIDEO" disimpan di Video Buatan Saya`, dialog tertutup, `ss.mine.v1` = 1 entri, daftar 1 item.
- Kembalikan saat LS penuh → tulis reset (menghapus entri = tulis yang MENGECIL) **berhasil** seperti yang diharapkan: toast `"Teks dikembalikan ke asli"`, `ss.edits.v1={}` — perilaku reset G3 utuh walau LS penuh. Cabang toast error reset bersifat defensif (tulis yang mengecil praktis tidak pernah gagal karena kuota); cabang itu tidak berhasil dipicu headless dan dicatat apa adanya.
- 0 `pageerror`. Bukti: `~/workspace/g5-u5/probe-after.json`, `fix-audit500-g5-u5-after-save-retry.png`.

### 4.3 Toast error: durasi + posisi (`toast-timing.mjs`)

- Sampling di dalam halaman (interval + `performance.now()`): toast error terlihat kelas `toast on err` dari ~448 mdtk sampai ~2351 mdtk sesudah klik (≈2 dtk, sama seperti toast lain), lalu hilang otomatis. Geometri: toast y=852, tombol Terapkan y=332 — tidak menutupi kontrol.
- Catatan harness: pembacaan toast lewat `page.evaluate` terpisah di VM lambat ini bisa menunjukkan toast sudah hilang padahal timer 2 dtk belum habis (round-trip evaluate ~1 dtk; itu yang terjadi pada run repro pertama sesudah perbaikan). Angka durasi di atas memakai sampler di dalam halaman, bukan label waktu luar.

### 4.4 Build + sync-check — HIJAU

- `npx tsc --noEmit`: bersih.
- `npm run build`: hijau (`✓ Compiled successfully`, 4/4 static pages).
- `node scripts/sync-check.mjs`: **SEMUA HIJAU — 12/12 template byte-identik lib == mjs**; vendor three.js 12/12 rewrite 13/13 + export tetap CDN. (Tidak ada perubahan di `lib/`/CLI; sync-check dijalankan sebagai bukti G1 tidak rusak.)

### 4.5 Regresi LS normal — HIJAU (G1–G4 tidak rusak)

- **Fresh load 12/12**: semua `ready=true`, **`0 error validasi bawaan`** (`.valid-err` = 0), bridge `true` — G1 tidak rusak.
- **Alur edit → Terapkan → Simpan → reload** (Adu Kode, LS normal): Terapkan → toast `"Semua edit diterapkan"` (kelas `toast on`, tanpa `err`), `ss.edits.v1` berisi judul; Simpan → toast tersimpan, 1 entri; reload → 1 entri bertahan, judul bertahan.
- **Simpan-ulang (G4)**: buka entri → ubah judul V2 → Terapkan → Simpan → dialog `"Perbarui video ini"`, toast `"…diperbarui di Video Buatan Saya"`, **tetap 1 entri, id sama**, judul V2 — G4 tidak rusak.
- **Hapus (LS normal)**: toast `"Video dihapus dari Video Buatan Saya"`, `ss.mine.v1=[]`.
- 0 `pageerror` / console error di semua run sesudah perbaikan. Bukti: `~/workspace/g5-u5/regression-after.json`, `fix-audit500-g5-u5-after-flow-normal.png`.
- Catatan harness (bukan bug aplikasi): run regresi pertama gagal di langkah simpan-ulang karena tombol simpan inspector `disabled` selama preview remount sesudah Terapkan (`disabled={!ready}`) — klik saat disabled adalah no-op (jebakan yang sama dicatat G4). Skrip diperbaiki agar menunggu tombol aktif; run ulang hijau. Tidak ada perubahan kode aplikasi untuk ini.

## 5. Yang TIDAK berhasil / batasan (dengan bukti)

1. **Cabang toast error reset (`ERR_RESET`) tidak berhasil dipicu headless.** Reset selalu menulis nilai yang lebih kecil (menghapus entri), jadi praktis tidak pernah gagal karena kuota — probe §4.2 membuktikan reset justru BERHASIL saat LS penuh. Cabang errornya ada dan benar secara kode (pola yang sama dengan Terapkan/Simpan yang terverifikasi), tapi belum ada bukti runtime bahwa toast itu tampil. Bukan kegagalan perbaikan, hanya cabang defensif yang belum terpicu.
2. **Cabang toast error hapus (`ERR_MINE_DELETE`) juga belum terpicu headless**, dengan alasan yang sama (hapus mengecilkan nilai). Sama: pola kode terverifikasi, bukti runtime belum ada.
3. **Toast error pada screenshot statis sering tidak tertangkap** karena capture headless SwiftShader lambat (melewati timer 2 dtk). Bukti toast adalah pembacaan DOM (teks + kelas `toast on err`) dan sampler di-dalam-halaman §4.3, bukan piksel toast di screenshot — screenshot membuktikan keadaan sesudahnya (status, tombol, daftar, dialog).
4. **Verifikasi tablet / Web Speech tidak dilakukan** — butuh perangkat Rehan; semua bukti headless 1440×900.
5. **Dua tab browser yang sama-sama menyimpan tidak diuji** — perilaku last-write-wins seperti sebelumnya; di luar cakupan U5.

## 6. File yang diubah + bukti

**Diubah (2 file, kode studio saja):**
- `components/Studio.tsx` — `writeLS` + pesan `ERR_*` (:97–115); `toastErr` (:602) + `toast(msg, isErr)` (:~800) + render `:3535`; `fullEditsRef` (:793–794); `saveCurrentFullEdit(): boolean` (:~1320–1342); `openTemplate` toast draf (:1356); efek persist pakai `writeLS` (:1419); `applyAll` jalur gagal + kembalikan baseline (:~1575–1582); 4 reset (:1655, :1672, :1683, :1699); `confirmSaveMine` tulis-dulu (:1817); `deleteMine` tulis-dulu (:1887).
- `app/globals.css` — `.toast.err` (:437).

**Tidak disentuh:** 12 template asli di `public/templates/` (mtime tetap **2026-11-17 08:19** semua); file audit (`verification/audit-500-*.md`, `verification/audit500-*`); file bukti G1–G4 (mtime terbaru tetap 2026-11-19 08:50, sebelum kerja G5); `lib/studio.ts`, `scripts/*`.

**Bukti baru (`verification/`, 10 screenshot + laporan ini):**
- Laporan ini: `fix-audit500-g5-u5.md`
- Sebelum: `fix-audit500-g5-u5-before-{apply-full,save-full,reload-full}.png` (3)
- Sesudah: `fix-audit500-g5-u5-after-{apply-full,save-full,switch-full,reload-full}.png` (4) + `fix-audit500-g5-u5-after-apply-status.png` (keadaan sesudah Terapkan gagal: Terapkan biru/aktif + "Siap diterapkan: 1 teks.") + `fix-audit500-g5-u5-after-save-retry.png` (entri tersimpan sesudah retry) + `fix-audit500-g5-u5-after-flow-normal.png` (alur normal)

**Skrip kerja (di luar repo, persisten):** `~/workspace/g5-u5/repro.mjs` (hasil `repro-before.json`, `repro-after.json`), `~/workspace/g5-u5/probe.mjs` (`probe-after.json`), `~/workspace/g5-u5/toast-timing.mjs` (`toast-timing.json`), `~/workspace/g5-u5/regression.mjs` (`regression-after.json`), `~/workspace/g5-u5/status-check.mjs`. Server tes port 3315 dimatikan sesudah verifikasi.
