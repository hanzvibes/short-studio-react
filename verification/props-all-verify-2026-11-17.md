# Laporan Verifikasi Independen — Props-All Short Studio React

**Tanggal:** 2026-11-17 (16:27–~17:35 WIB) · **Verifikator independen** (bukan implementor)
**Proyek:** `~/workspace/short-studio-react` · repo `hanzvibes/short-studio-react`
**Catatan repo:** tidak ada `.git` di direktori kerja lokal, jadi commit `main 79af1088` yang diklaim
tidak bisa dicek lewat git — semua verifikasi dilakukan terhadap file di disk + build + runtime.
**Peran:** hanya mengukur. Tidak ada kode produk yang diubah (`components/`, `lib/`, `scripts/apply-edit.mjs`,
`SKILL.md`, `README.md`, `app/` — mtime semua file produk tetap sebelum verifikasi; hanya `verification/`
dan `/tmp` yang ditulis). Tidak ada push/deploy.

## Verdict: TIDAK LAYAK PUSH ❌ (blocking)

**Satu bug blocking:** 6 dari 12 template **tidak bisa dibuka sama sekali** di studio — preview gagal
total dengan `ReferenceError` (TDZ) dari konstanta beat/keyboard baru. Ini regresi yang diperkenalkan
pekerjaan props-all itu sendiri (bukan template asli — template asli render normal). Template #01
"Perang Sub Agent" (yang pertama di drawer) termasuk yang rusak.

Satu temuan non-blocking: slider array (skor, kurva tangki, dsb.) **tidak punya pratinjau langsung**
padahal teks bantuan menjanjikannya — editnya tetap jalan lewat Terapkan.

Semua klaim lain (build, sinkronisasi, jumlah prop, tab Objek, ketuk preview, nol-teks-teknis,
regresi alur lama) **terbukti benar** dengan pengukuran independen — tapi tidak menebus bug blocking di atas.

---

## 1. Bug BLOCKING — 6/12 template mati total saat dibuka (TDZ)

### Gejala (diukur, bukan dikutip)

Sweep fresh-load ke-12 template di studio (konteks browser baru per template, timeout 45 dtk,
`verification/verify-template-sweep.mjs`, hasil `props-all-template-sweep.json`):

| Template | Hasil | Error halaman |
|---|---|---|
| Versus | OK (1.434 mdtk) | — |
| Trio | OK (1.705 mdtk) | — |
| Adu Kode | OK (1.698 mdtk) | — |
| **Kuota** | **FAIL (45.418 mdtk)** | `ReferenceError: Cannot access 'KB_X' before initialization` + `LEN is not defined` |
| **Rival** | **FAIL (45.255 mdtk)** | `Cannot access 'KB_X' before initialization` + `LEN is not defined` |
| **Perang** | **FAIL (45.422 mdtk)** | `Cannot access 'T_WAR' before initialization` + `vMute is not defined` |
| Mengetik | OK (1.312 mdtk) | — |
| **Deploy** | **FAIL (45.328 mdtk)** | `Cannot access 'T_DONE' before initialization` + `LEN is not defined` |
| **Pemburu Bug** | **FAIL (45.384 mdtk)** | `Cannot access 'T_SQUASH' before initialization` + `LEN is not defined` |
| **Bom** | **FAIL (45.749 mdtk)** | `Cannot access 'T_DEFUSE' before initialization` + `LEN is not defined` |
| Rapat | OK (2.215 mdtk) | — |
| Tidur | OK (1.272 mdtk) | — |

"Preview siap" tidak pernah muncul; bridge `__st` tidak terbentuk; status studio "Preview error".

### Akar masalah (dibuktikan dari srcdoc + kode)

1. Saat load template, studio mengisi `draftProps` dengan **semua** prop tersedia beserta nilai
   aslinya (`components/Studio.tsx:959`: `const dp = mineOverride?.props ?? fe?.props ?? origP`),
   lalu `mount()` selalu memanggil `writeProps(out, file, draftProps)` (`Studio.tsx:806-809`).
   Jadi injeksi konstanta baru berjalan di **setiap** load, bahkan tanpa edit pengguna.
2. Untuk perang, `writeProps` menulis ulang literal waktu menjadi referensi `T_WAR`/`T_TRUCE`/
   `T_INTERN` (multi-site J5) dan menyisipkan deklarasi `const T_WAR=12.8;` tepat sebelum
   `function frame(t){` (J1). Buktinya di srcdoc hasil mount (disimpan `/tmp/perang-srcdoc.html`):
   - pemakaian di baris 234 (`FA`: `war:s2(T_WAR,T_WAR+.6)...`) dan 236 (`mlay`: `mr=s2(T_WAR-.2...`),
   - deklarasi baru di baris 280 (`const T_WAR=12.8;`).
3. Kode top-level template **sebelum** baris 280 sudah memanggil `mlay(...)` saat inisialisasi
   partikel (`SP.forEach(... mlay(sd,i,ts+.8) ...)`), sehingga `T_WAR` dibaca sebelum
   deklarasinya dieksekusi → TDZ `ReferenceError` → seluruh `<script>` template mati sebelum
   mendeklarasikan `LEN`/`vMute` (error kedua adalah gejala turunan).
4. Pola yang sama untuk `KB_X` (keyboard.x, Kuota/Rival) dan `T_DONE`/`T_SQUASH`/`T_DEFUSE`
   (beat Deploy/Pemburu Bug/Bom).

### Bukti template asli tidak bersalah + CLI ikut rusak

- Template asli `template-perang.html` **tidak mengandung** `T_WAR` sama sekali (grep: 0 hasil)
  dan render langsung tanpa error (`renderAt(15)` OK, 0 pageerror) — bukti A6d.
- Template asli kuota juga render langsung tanpa error — bukti A7f.
- File hasil **CLI** dengan edit beat ikut rusak: `apply-edit --edit {"props":{"beat.war":13.5}}`
  menghasilkan `perang-beat.html` dengan pemakaian `T_WAR` di baris 230/232 tapi deklarasi
  `const T_WAR=13.5;` di baris 273 — render langsung melempar TDZ yang sama (bukti A6g).
  Artinya **file ekspor/ekspor `.html` yang mengandung edit beat/keyboard juga rusak**, bukan
  cuma preview studio.
- Gerbang validasi `node --check` pada blok `<script>` hasil edit **tidak bisa menangkap ini**
  (TDZ adalah error runtime, bukan sintaks).

### Dampak

- 6 template tidak bisa dibuka, diedit, di-preview, disimpan, atau diekspor dari studio.
  "Perang Sub Agent" adalah template #01 di drawer.
- Perbaikan yang dibutuhkan (catatan, bukan dikerjakan verifikator): deklarasi konstanta injeksi
  harus dipindah ke **sebelum pemakaian top-level pertama** (mis. ke atas `<script>`, bukan
  sebelum `frame()`), atau situs pemakaian top-level dikecualikan — plus uji beban ke-12 template
  di `verify-objek.mjs` (saat ini hanya menguji Mengetik + Versus, keduanya termasuk yang sehat).

## 2. Temuan non-blocking — slider array TIDAK punya pratinjau langsung

Klaim "semua angka jadi slider dengan pratinjau langsung (debounce ~250 mdtk)" **tidak berlaku**
untuk kontrol array. Bukti kode: `applyArrayValue` (`Studio.tsx:1325`) hanya `setDraftProps`,
tidak memanggil `scheduleLive` (berbeda dengan `setPropValue` untuk number/color, `Studio.tsx:1272`).
Bukti runtime (template-code, skor papan):

- Geser "Performa" 88 → 50: nilai tampil berubah ke 50, tapi srcdoc **tidak berubah** dan
  preview **0 px berubah** (A2h/A2i).
- Sesudah klik **Terapkan**: srcdoc mengandung `CL1=[96,94,50]` dan preview berubah
  **3.818 px (5,61%)** di t=25 (A2j/A2k). Editnya bekerja — hanya pratinjaunya yang tidak langsung.
- Berlaku juga untuk kurva tangki (diuji via Terapkan di bagian A7 — lihat §4; di studio Kuota
  tidak bisa dibuka karena Bug #1, jadi pembuktian kurva lewat file CLI + render langsung).

Dampak: sedang. Teks bantuan di tab Objek ("Geser slider untuk melihat perubahan langsung di
preview") menjadi janji yang salah untuk slider skor/kurva/jendela/pasukan/baris. Tidak blocking
karena alur Terapkan tetap benar dan tidak ada data yang hilang — tapi harus diperbaiki atau
teksnya diubah, karena pengguna akan mengira slidernya rusak.

## 3. Observasi (bukan bug)

- **Latensi pratinjau langsung (number slider):** debounce 250 mdtk memang ada di kode
  (`scheduleLive`, `Studio.tsx:1262`), tapi ujung-ke-ujung isi-slider → srcdoc berubah terukur
  **1.506 mdtk** (claude.x) dan **1.384 mdtk** (boss.scale) di VM ini. Sisanya biaya remount +
  render SwiftShader, bukan debounce. Remount sesudah Terapkan terukur **~4,5 dtk** (probe-nowcap2).
  Di perangkat nyata kemungkinan jauh lebih cepat — angka ini karakteristik VM headless.
- **Dialog Ekspor MP4** bersih dari 12 token teknis yang dilarang, tapi isinya memang instruksi
  developer (`spec.json`, `node scripts/export.mjs`, Playwright/Chromium/ffmpeg) — by design
  untuk jalur ekspor CLI, di luar daftar token yang diminta.
- **Skrip implementor `verify-objek.mjs` 13/13 TERULANG** di tangan saya (SEMUA HIJAU 13, 0 console
  error) — tapi cakupannya hanya Mengetik + Versus (keduanya sehat), dan cek A4-nya hanya
  membandingkan **ukuran file PNG** (sebelum 10150B vs sesudah 10150B — sama persis!) sehingga
  bukan bukti perubahan visual. Bukti visual yang sah adalah diff piksel saya di §4.

---

## 4. Hasil per poin tugas (angka saya ukur sendiri)

### Poin 1 — Build & sinkron

| Perintah | Hasil |
|---|---|
| `npm run build` | ✅ HIJAU. `Compiled successfully`, route `/` **47,2 kB**, First Load **150 kB** |
| `node scripts/sync-check.mjs` | ✅ **12/12** template byte-identik lib == mjs; `PROP_DEFS lib=107 mjs=107` |
| `node scripts/apply-edit.mjs --list-props <t>` per template (hitung baris `id = nilai`) | ✅ Versus 20, Trio 24, Adu Kode 24, **Kuota 28**, Rival 25, Perang 29, Mengetik 14, Deploy 19, Pemburu Bug 15, Bom 17, Rapat 17, Tidur 19 — **total 251**, persis sama dengan klaim |
| `grep -c '"id": "' lib/studio.ts` / `scripts/apply-edit.mjs` | ✅ 107 / 107 |
| Spec lama `scripts/examples/spec-code-pr-kecil.json` | ✅ exit 0 → `code-edited.html`, berisi judul "PR Kecil, Drama Besar" |
| Spec lama `scripts/examples/spec-kuota-hemat.json` | ✅ exit 0 → `kuota-edited.html`, berisi judul "Hemat Kuota, Tetap Rame" |
| Spec tidak valid (`claude.x: 99`) | ✅ exit 1, **tidak ada** file output |
| Koreksi Kuota 28 (bukan 31) | ✅ Benar: `template-kuota.html` tidak punya `board.base/swing/final` (hanya `board.position.set`); prop papannya `board.y/read/write` |
| 12 template asli `public/templates/` | ✅ mtime tetap **2026-11-17 08:19** semua (dicek awal & akhir) |

### Poin 2 — Props yang dulu diblokir (bukti per kategori)

Semua diff piksel dihitung dengan decoder PNG murni (`node:zlib`, ambang beda kanal > 10)
atas screenshot stage sebelum vs sesudah — bukan perbandingan ukuran file.

| Kategori | Template · prop · edit | Nilai terbukti | Preview berubah (piksel) | Screenshot |
|---|---|---|---|---|
| X maskot tunggal | Mengetik · `claude.x` 0 → 0,7 | srcdoc `MX0=0.7`; tampil `0.70` | **14.279 px (20,99%)** t=5 | `props-all-typing-x-before/after.png` |
| Skor papan non-code | Adu Kode · `board.claude.final` Performa 88 → 50 | srcdoc `CL1=[96,94,50]` sesudah Terapkan | **3.818 px (5,61%)** t=25 | `props-all-code-skor2-before/after.png` |
| Konstanta beat | Tidur · `beat.sleep` 28 → 26 | srcdoc `const T_SLEEP=26;` | **10.291 px (15,13%)** t=27 | `props-all-sleep-beat-before/after.png` |
| Ekspresi wajah | Adu Kode · `face.codex` −1 → 2 "Senang" | srcdoc `FACE_OVR=2`; tombol `aria-pressed=true` | **1.696 px (2,49%)** t=10 | `props-all-code-face-before/after.png` |
| Boss tidur | Tidur · `boss.scale` 1 → 1,3 | srcdoc `boss.scale.setScalar(1.3)`; tampil `1.30 ×` | **3.831 px (5,63%)** t=13 | `props-all-sleep-boss-before/after.png` |
| Benteng perang | Perang · `fort.size` 1 → 1,3 (via CLI + render langsung, karena studio tidak bisa buka Perang) | `const FORT_S=1.3;` + `g.scale.setScalar(FORT_S)` | **75.359 px (14,54%)** t=15 | `props-all-direct2-perang-orig-t15.png` vs `props-all-direct2-perang-fort13-t15.png` |
| Tangki kuota | Kuota · `tank.curve` baris 3: 92 → 30 (via CLI + render langsung) | `RK=[...,[5,30],...]` | **156.309 px (30,15%)** t=6 | `props-all-direct2-kuota-orig-t6.png` vs `props-all-direct2-kuota-tank30-t6.png` |

Tambahan: reset per kontrol ↺ bekerja (claude.x kembali `0.00`, `MX0=0.7` hilang dari srcdoc — A1f/A1g).

### Poin 3 — Slider + alur baru

| Uji | Hasil |
|---|---|
| Header "Sedang mengedit: …" (1366 & 390) | ✅ tampil; berganti Maskot oranye → Cangkir → dst. (A1a, C1a/C1b) |
| Slider geser → preview berubah + nilai tampil (1366) | ✅ claude.x −0,70/0,70; boss.scale 1,30 × (A1, A5, C2) |
| Slider 390px portrait | ✅ nilai `-0.70`; preview **19.955 px (24,84%)** berubah (C2a–C2c) |
| Ketuk objek di preview 1366 (Versus) | ✅ kiri → Maskot oranye; kanan → Maskot biru; atas-tengah → Papan skor (B1–B3) |
| Ketuk objek 390px | ✅ bekerja **bila stage terlihat penuh** (probe P1: kanan → Maskot biru sesudah `scrollIntoView`). Kegagalan awal C3b adalah artefak uji saya: stage sempat di luar viewport (y=−243) karena klik tab menggeser tampilan, sehingga koordinat ketuk jatuh di luar layar (`elementFromPoint` kosong). Bukan bug produk. |
| NOL string teknis (12 token: `claude.x, gs[0], lookAt, caps, VO, LEN, T_BOARD, envelope, sinus, literal, srcdoc, props`) | ✅ **11/11 sapuan bersih**: 1366 tab Objek/Teks/Shot/Caption + dialog Ekspor/Pintasan + palet Ctrl+K; 390 tab Teks/Shot/Caption/Objek + dialog Simpan |
| Tema gelap/terang | ✅ via keyboard `D` di 390 (tombol `#themeBtn` memang `display:none` by design ≤900px, `globals.css:533`); toggle `dark → light` terukur (P2) |

### Poin 4 — Regresi

| Uji | Hasil |
|---|---|
| Edit caption → Terapkan → terlihat di preview | ✅ srcdoc berisi teks baru; render berubah **2.899 px (3,61%)** t=4; bilah `.now-cap` menampilkan teks baru sesudah remount selesai (retest probe-nowcap2; kegagalan awal D1b-1 adalah artefak waktu baca saya — remount butuh ~4,5 dtk, saya membaca di ~1,8 dtk) |
| Edit shot (Shot 2 mulai 3,1 → 3,3) | ✅ srcdoc `shots=[[0,...],[3.3,...],...]` (D2) |
| Simpan sebagai video baru → reload → entri bertahan | ✅ dua jalur: drawer → `+ Simpan` dan tab Teks → `Simpan sebagai video baru`; `ss.mine.v1` = 1 entri; sesudah reload entri tampil di galeri (D3a-1/b-1/c-1, D3a-2/b-2) |
| Drawer buka/tutup 390px | ✅ `body.drawer-open` ↔ `drawer-closed` (C4a/C4b) |
| Mode fokus viewer landscape 1366×768 | ✅ stage 195×347 → 334×594; Esc kembali ke 347 (B5/B6) |
| 0 console error (template sehat) | ✅ 0 di bagian 2/3/4 dan di `verify-objek.mjs`. Error hanya muncul di 6 template rusak (Bug #1) |
| Template asli tidak berubah | ✅ mtime 08:19 semua (lihat Poin 1) |

### Poin 5 — Laporan & artefak

- Laporan ini: `verification/props-all-verify-2026-11-17.md`
- Skrip uji saya (independen, di `verification/`): `verify-props-all.mjs` (bagian 1, crash di A6 karena
  Bug #1 — log `/tmp/verify-props-all.log`: 15 OK / 4 FAIL, 2 di antaranya bug uji saya),
  `verify-props-all-2.mjs` (33 OK / 3 FAIL — 2 artefak screenshot canvas saya, 1 artefak ketuk C3b;
  log `/tmp/verify-props-all-2.log`), `verify-props-all-3.mjs` (7/10 — 3 artefak uji saya),
  `verify-props-all-4.mjs` (7/8 — 1 artefak waktu baca saya),
  `verify-template-sweep.mjs` + `props-all-template-sweep.json` (6/12),
  `probe-perang.mjs`, `probe-perang-srcdoc.mjs`, `probe-390-tap.mjs` + `props-all-probe-390.json` (4/4),
  `probe-nowcap.mjs`, `probe-nowcap2.mjs`.
- Hasil JSON: `props-all-verify-headless-3.json`, `props-all-verify-headless-4.json`,
  `props-all-probe-390.json`, `props-all-template-sweep.json`. (Bagian 1–2 tidak menulis JSON karena
  skripnya crash sebelum akhir — hasilnya ada di log `/tmp/verify-props-all*.log`.)
- Screenshot `props-all-*.png`: 27 file (sebelum/sesudah per kategori, fokus, drawer, tema, caption,
  mine-after-reload, direct-render perang/kuota). Daftar lengkap di akhir laporan.
- Skrip implementor `scripts/verify-objek.mjs` saya jalankan ulang: **13/13 HIJAU** (0 console error),
  dengan catatan kelemahan A4 di §3.
- Server uji (`npm start` :3000, `python3 -m http.server` :8321) sudah dimatikan sesudah pengujian.

---

## 5. Daftar bug / ketidaksesuaian (ringkas)

| # | Temuan | Bukti | Blocking? |
|---|---|---|---|
| 1 | 6/12 template gagal total saat dibuka (TDZ konstanta injeksi beat/keyboard) + file CLI hasil edit beat/keyboard ikut rusak | Sweep 6 FAIL; srcdoc perang baris 234/236 pakai `T_WAR` sebelum deklarasi baris 280; `perang-beat.html` baris 230/232 vs 273; render langsung asli OK vs edit TDZ | **YA — blocking** |
| 2 | Slider array (skor/kurva/dll.) tanpa pratinjau langsung, bertentangan dengan teks bantuan | `applyArrayValue` tanpa `scheduleLive`; A2h/A2i 0 px sebelum Terapkan, A2j/A2k berubah sesudah Terapkan | Tidak (alur Terapkan benar) |

Tidak ada bug lain yang ditemukan. Semua kegagalan lain dalam log saya adalah artefak skrip uji saya
sendiri dan sudah dibuktikan ulang sebagai PASS (C3b → P1; C5 → P2; D0/D3a → D3 jalur 1+2;
D1b → D1b-2 + probe-nowcap2; A6f/A7h → P3/P4; A2b/A3a → A2f/A3d).

## 6. Batasan pengujian

- Headless di VM (chrome-headless-shell + SwiftShader, vendor three.js lokal): render software,
  latensi remount lebih lambat dari perangkat nyata; sentuhan jari asli, keyboard virtual, dan
  performa di tablet fisik tidak bisa diuji dari sini.
- Template yang rusak (6) tidak bisa diuji alur Objek-nya di studio sama sekali — pembuktian
  benteng/tangki dilakukan lewat file CLI + render langsung, bukan lewat UI studio.
- Commit `main 79af1088` tidak bisa diverifikasi (tidak ada `.git` lokal); verifikasi hanya
  terhadap isi file di disk.
- Ekspor MP4 end-to-end (ffmpeg) tidak diuji; hanya dialog + perintahnya yang dibaca.
- VO/narasi suara (Web Speech) tidak diuji headless.
