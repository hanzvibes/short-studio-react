# Laporan Verifikasi Ulang Independen #2 — Props-All Short Studio React

**Tanggal:** 2026-11-17 (~17:42–18:25 WIB) · **Verifikator independen** (bukan implementor, bukan fixer)
**Proyek:** `~/workspace/short-studio-react` · repo `hanzvibes/short-studio-react`
**Catatan repo:** tidak ada `.git` di direktori kerja lokal, jadi commit `main 79af1088` yang
diklaim tidak bisa dicek lewat git — semua verifikasi dilakukan terhadap file di disk + build + runtime.
**Peran:** hanya mengukur dari nol. Tidak ada kode produk yang diubah (`components/`, `lib/`,
`scripts/apply-edit.mjs`, `SKILL.md`, `README.md`, `app/` — mtime semua file produk tetap
sebelum verifikasi; hanya `verification/` dan `/tmp` yang ditulis). Tidak ada push/deploy.
Server uji (`npm start` :3000, `http.server` :8898/:8899) sudah dimatikan sesudah pengujian.

## Verdict: LAYAK PUSH ✅

Bug blocking putaran pertama (6/12 template mati total karena TDZ konstanta injeksi)
**terbukti sudah diperbaiki** dengan pengukuran independen dari nol: sweep 12/12 render tanpa
`ReferenceError`, 0 console/page error; CLI edit beat/keyboard render langsung tanpa TDZ
dengan LEN benar; idempotensi terbukti di CLI maupun di studio (satu deklarasi, termasuk
relokasi deklarasi gaya lama); slider array kini pratinjau langsung sebelum Terapkan.
Tidak ditemukan bug baru yang blocking. Satu hutang skrip tes (`scripts/verify-edits.mjs`
usang di lebih dari sekadar nama tab) dicatat di §6 — skrip tes itu bukan produk, dan semua
perilaku produk yang dicakupnya sudah saya buktikan lewat skrip independen saya sendiri,
jadi hutang itu **tidak menghalangi verdict**.

---

## 1. Sweep load 12/12 (tugas poin 1) — PASS ✅

Skrip saya sendiri `verification/verify2-sweep.mjs` (konteks browser baru per template,
chrome-headless-shell + vendor three.js lokal `/tmp/ss-vendor/`, server `npm start` :3000
yang saya restart dari build segar saya sendiri). Hasil `verify2-sweep.json`:

| Template | Hasil | Waktu | Console/page error |
|---|---|---|---|
| Versus | OK (Preview siap + bridge `__st`) | 1.455 mdtk | 0 |
| Trio | OK | 1.424 mdtk | 0 |
| Adu Kode | OK | 1.684 mdtk | 0 |
| **Kuota** | **OK** | 1.409 mdtk | 0 |
| **Rival** | **OK** | 1.621 mdtk | 0 |
| **Perang** | **OK** | 1.427 mdtk | 0 |
| Mengetik | OK | 1.446 mdtk | 0 |
| **Deploy** | **OK** | 2.189 mdtk | 0 |
| **Pemburu Bug** | **OK** | 1.461 mdtk | 0 |
| **Bom** | **OK** | 1.172 mdtk | 0 |
| Rapat | OK | 1.266 mdtk | 0 |
| Tidur | OK | 1.399 mdtk | 0 |

**12/12 OK, 0 error.** Keenam template yang dulu gagal (Kuota, Rival, Perang, Deploy,
Pemburu Bug, Bom) kini semuanya mencapai "Preview siap" dengan bridge `__st.ok()`.
Deklarasi injeksi di srcdoc hasil mount berada di atas blok skrip (bukan sebelum
`frame()`): `KB_X` baris 84 (Kuota) / 81 (Rival), `T_WAR` baris 76 (Perang),
`T_DONE` baris 84 (Mengetik) / 85 (Deploy), `T_SQUASH` baris 85 (Pemburu Bug),
`T_DEFUSE` baris 85 (Bom), `T_SLEEP` baris 71 (Tidur). Screenshot: `verify2-perang.png`,
`verify2-kuota.png`.

---

## 2. CLI: edit beat + render langsung + idempotensi (tugas poin 2) — PASS ✅

Perintah saya sendiri (`verify2-cli.mjs` + langkah shell; file di `/tmp/v2-out/`,
server statis :8898 = template asli, :8899 = hasil edit):

| Uji | Hasil |
|---|---|
| Perang `beat.war` 13.5 | `const T_WAR=13.5;` di **baris 75**; pemakaian di baris 232/234/325 (semua sesudah deklarasi); tepat **1** deklarasi |
| Terapkan 2× dari asli ke out yang sama | tetap **1** deklarasi |
| Terapkan ulang ke file hasil edit (disalin sebagai `template-perang.html`) `beat.war` 14 | exit 0, tepat **1** deklarasi, kini `const T_WAR=14;` di baris 74 |
| Terapkan ulang `claude.x` −1.2 ke file hasil edit Perang | exit 0, tetap **1** deklarasi `T_WAR` |
| Kuota `tank.curve` baris 3 → `[5,30]` | file memuat `[5,30]` |
| Deploy `beat.done` 18 | `const T_DONE=18;` di baris 84, tepat **1** deklarasi |
| **Relokasi deklarasi gaya lama** (simulasi file hasil fix lama: `const T_WAR=13.5;` dipindah ke baris 274, tepat sebelum `function frame(t){` di 275) lalu terapkan `beat.war` 14 | deklarasi **pindah ke baris 74** (atas skrip), tetap **1**; render LEN=34, 0 error |

Render langsung (`verify2-render.mjs`, 8/8 OK, 0 page/console error):

| File | LEN | Error |
|---|---|---|
| Asli Perang (kontrol) | 34 | 0 |
| Perang beat.war=13.5 | 34 | 0 |
| Perang beat.war=14 (re-apply) | 34 | 0 |
| Perang beat 13.5 + claude.x | 34 | 0 |
| Kuota tank30 | 34 | 0 |
| Asli Kuota (kontrol) | 34 | 0 |
| Deploy beat.done=18 | 29 | 0 |
| Asli Deploy (kontrol) | 29 | 0 |

Catatan: percobaan pertama saya `beat.done: 25` untuk Deploy **ditolak validasi**
("25 di atas batas 21" — saya salah baca rentang; rentang benar 12..18). Validasi
rentang bekerja. Screenshot: `verify2-cli-perang.png`.

**Observasi (bukan bug, sudah ada sebelumnya):** terapkan ulang ke file hasil edit
yang namanya **bukan** salah satu dari 12 nama template (mis. `perang-beat135.html`)
gagal dengan `"beat.war" tidak tersedia … Tidak ada di video ini` untuk **semua**
prop — karena `parseProps()` mencocokkan `def.files` dengan basename file.
Gagalnya keras (exit 1, tanpa output), bukan file rusak. Alur yang didukung
(nama file = nama template) terbukti idempoten seperti di atas.

---

## 3. Slider array: pratinjau langsung (tugas poin 3) — PASS ✅

Skrip saya `verification/verify2-slider.mjs` (geser lewat event input/change asli,
baca srcdoc + diff piksel screenshot iframe `#pv` 196×347 dengan decoder PNG saya
sendiri, ambang beda kanal > 10):

| Uji | Srcdoc SEBELUM Terapkan | Preview berubah SEBELUM Terapkan | Sesudah Terapkan |
|---|---|---|---|
| Adu Kode skor Performa 88 → 50 | memuat `[96,94,50]` ✅ | **678 px (1,00%)** | tetap `[96,94,50]`, 0 error |
| Kuota kurva tangki baris 3: 92 → 30 | memuat `[5,30]` ✅ | **2.161 px (3,18%)** | tetap `[5,30]`, 0 error |

Nilai tampil slider berubah ke 50 / 30 dan status kembali "Preview siap".
Screenshot: `verify2-skor-before/after.png`, `verify2-tank-before/after.png`.
(Klaim fixer "skor 88→50 sudah di srcdoc SEBELUM Terapkan" terkonfirmasi; diff piksel
A memang kecil karena angka papan kecil di thumbnail iframe — bukti utamanya srcdoc
+ nilai tampil, dan diff B yang 3,18% memperkuat bahwa preview benar-benar me-render
ulang.)

---

## 4. Build, sinkron, regresi singkat (tugas poin 4) — PASS ✅

| Perintah / uji | Hasil |
|---|---|
| `npm run build` | ✅ HIJAU, exit 0. Route `/` **47,4 kB**, First Load **150 kB** |
| `node scripts/sync-check.mjs` | ✅ **12/12** byte-identik lib == mjs; `PROP_DEFS lib=107 mjs=107`; 2 spec contoh exit 0 |
| `--list-props` per template (hitung baris `^  <id> = `) | ✅ Versus 20, Trio 24, Adu Kode 24, **Kuota 28**, Rival 25, Perang 29, Mengetik 14, Deploy 19, Pemburu Bug 15, Bom 17, Rapat 17, Tidur 19 — **total 251** |
| Caption → Terapkan → terlihat | ✅ `caps()[0]="VERIF2 CAPTION"`; bilah `.now-cap` menampilkan teks baru pada waktunya (`"VERIF2 CAPTION 0:03 / 0:30"`) |
| Simpan sebagai video baru → reload → bertahan | ✅ `ss.mine.v1` = 1 entri sesudah simpan, tetap 1 sesudah reload (diuji untuk Adu Kode dan Perang) |
| 0 console error di template sehat | ✅ 0 di sweep 12/12 dan semua alur di atas |
| 12 template asli `public/templates/` | ✅ mtime tetap **2026-11-17 08:19** semua (dicek awal & akhir) |
| Nilai default tidak berubah (sampel) | ✅ `beat.war` 12.8 = literal `s2(12.8,13.4)` di perang asli; `beat.fix` 12.3 = literal di deploy asli; `board.claude.final [96,94,88]` = `CL1=[96,94,88]` di code asli; `tank.curve` asli memuat `[5,92]`; `keyboard.x` 0; slider Perang menampilkan "Waktu perang mulai 12.80 detik" |

**Idempotensi studio** (`verify2-regress2.mjs`, bagian C — alur penuh):
Perang `beat.war` 12.8 → 13.5 → Terapkan: deklarasi `T_WAR` = **1** sebelum dan
sesudah Terapkan, srcdoc memuat `const T_WAR=13.5;`, Preview siap → Simpan sebagai
video baru → reload (1 entri) → buka entri mine → deklarasi **1**, Preview siap,
**0 error** → geser beat lagi ke 14 → Terapkan → deklarasi tetap **1**, srcdoc
memuat `const T_WAR=14;`, Preview siap, total 0 error. Screenshot:
`verify2-perang-mine.png`, `verify2-caption-after.png`, `verify2-mine-after-reload.png`.

Koreksi hitungan saya sendiri: grep naif `" = "` memberi total 252 karena nilai
multi-baris `screen.editor` di Bom mengandung `" = "` di baris lanjutannya
(`jumlahKopi = …`). Hitungan prop yang benar (baris `^  <id> = `) = **251**,
persis klaim fixer.

---

## 5. Temuan baru / observasi (tidak ada yang blocking)

| # | Temuan | Bukti | Blocking? |
|---|---|---|---|
| O1 | **Navigasi hash-only tidak ganti template** — hash hanya dibaca sekali saat mount (`Studio.tsx:1061` di `useEffect [restored]`); tidak ada listener `hashchange`. `goto` dari `#template-code` ke `#template-perang` pada halaman yang sudah termuat tetap menampilkan Adu Kode (daftar objek Papan skor 5, slider "Waktu seri" dsb.). | `verify2-probe2.mjs`; grep `hashchange` = 0 hasil di `Studio.tsx` | **Tidak.** Sudah ada sebelumnya, di luar cakupan fix TDZ; alur normal (drawer/palet → `openTemplate()`) tidak kena. Ini sempat membuat skrip regresi saya sendiri gagal — artefak uji saya, bukan bug produk. |
| O2 | CLI menolak edit file hasil edit bila basename-nya bukan nama template asli (lihat §2). | exit 1 `"tidak tersedia"` untuk semua prop pada `perang-beat135.html`; lolos bila disalin sebagai `template-perang.html` | **Tidak.** Sudah ada sebelumnya; gagal keras tanpa output rusak. |
| O3 | `--list-props` menampilkan rentang global untuk prop dengan `rangeByFile` (mis. `beat.fix` tampil "19..24" padahal rentang Deploy 10..14; default 12.3 benar). | `lib/studio.ts:3001-3011` vs output list-props | **Tidak.** Hanya tampilan daftar; slider memakai `rangeByFile`. Sudah ada sebelumnya. |
| O4 | Sesudah Terapkan, teks "Preview siap" bisa muncul ~2 dtk sebelum `__st.caps()` bisa dibaca (remount iframe). Skrip uji yang membaca di +1,5 dtk akan mendapat `null` palsu. | `verify2-probe5.mjs`: `caps()[0]` null di +1,5 dtk, `"EDIT UI KUOTA"` di +3,5 dtk | **Tidak.** Pengguna tidak terdampak (preview termuat normal); hanya skrip uji yang harus polling, bukan sleep tetap. Sejalan dengan remount ~4,5 dtk yang diukur verifikasi pertama. |

Tidak ditemukan bug produk baru. Semua kegagalan selama pengujian saya adalah
artefak skrip uji saya sendiri dan sudah dibuktikan ulang sebagai PASS (selektor
`.prop-row` yang salah → aria-label; goto hash-only → reload; baca caps() +1,5 dtk
→ polling).

---

## 6. Catatan fixer: `scripts/verify-edits.mjs` usang — HUTANG, bukan blocker

Saya menjalankan ulang skrip itu apa adanya dengan server yang benar
(`:8898` → `public/templates`, `:8899` → `/tmp/edited`, `:3000` jalan):
**13/16 lolos, exit 1.**

- **Bagian A: 12/12 OK** — semua template, termasuk yang dulu gagal: `caps[0]="EDIT BUKTI"`,
  `vo-follows=true` (kuota), `claude.x-in-file=true` (code & kuota). Bagian A hanya
  butuh server statis yang benar; tidak ada yang usang di kodenya.
- **Bagian B: 1/4** — caption `#template-code` OK (`caps()[0]="EDIT UI KODE"`),
  lalu gagal di:
  1. `button[role="tab"]:has-text("Props")` timeout 30 dtk (2×, code + kuota) —
     tab kini bernama **"Objek"**;
  2. `UI #template-kuota: caps()[0]=null` — **terbukti artefak waktu baca** (probe5:
     null di +1,5 dtk, `"EDIT UI KUOTA"` di +3,5 dtk; probe4 dengan `#apply-cap` +
     polling lolos), bukan bug produk.

**Keputusan (sesuai instruksi tugas): saya TIDAK memperbaiki skrip ini**, karena
perbaikannya **lebih dari** ganti nama tab + server yang benar:

1. Tab `"Props"` → `"Objek"` (2 tempat + komentar header).
2. Langkah props Bagian B memakai `.prop-row input[type="number"]` — selektor itu
   sudah tidak ada: kontrol kini `.prop-ctl` berisi `input[type="range"]` dengan
   `aria-label` (mis. `claude.x` → "Geser kiri-kanan"), dan asersi srcdoc-nya
   (`/X=\[-1\.2,/`) perlu dicek ulang terhadap pemetaan anchor per template.
   Ini pengerjaan ulang langkah uji, bukan rename.
3. Iterasi UI code → kuota memakai goto hash-only tanpa reload, sehingga iterasi
   kuota sebenarnya berjalan di atas template code (lihat O1) — perlu fresh page /
   reload antar iterasi.
4. Pembacaan `caps()` memakai sleep tetap 1500 mdtk — perlu polling (lihat O4).
5. Skrip tidak menjalankan sendiri server :8898/:8899 yang dibutuhkannya (celah
   dokumentasi/penggunaan, bukan bug logika).

**Pernyataan eksplisit:** hutang ini **tidak menghalangi verdict LAYAK PUSH** —
produknya sendiri sudah benar, dan setiap perilaku yang dicakup Bagian B sudah
saya buktikan lewat skrip independen saya (§3, §4, probe4/probe5): caption Kuota
di studio berfungsi, slider objek berfungsi, simpan + reload berfungsi.

---

## 7. Artefak verifikasi ini

- Laporan ini: `verification/props-all-verify2-2026-11-17.md`
- Skrip saya (independen, di `verification/`): `verify2-sweep.mjs` +
  `verify2-sweep.json` (12/12), `verify2-cli.mjs` (skrip awalnya mati di langkah
  idempotensi karena CLI menolak file bernama non-template — bukti O2; langkahnya
  diulang manual di shell), `verify2-render.mjs` (8/8), `verify2-slider.mjs`
  (skor + tangki, dengan decoder PNG RGB/RGBA sendiri), `verify2-regress.mjs`
  (caption + simpan OK; bagian C gagal karena 2 artefak uji saya),
  `verify2-regress2.mjs` (A2 + C lengkap, lolos), `verify2-probe.mjs`,
  `verify2-probe2.mjs` (bukti O1), `verify2-probe3/4/5.mjs` (bukti O4).
- Screenshot `verify2-*.png`: 11 file (perang, kuota, skor sebelum/sesudah,
  tangki sebelum/sesudah, caption, mine sesudah reload, perang-mine, probe objek,
  caption-nowcap).
- Log pendukung: `/tmp/v2-build.log` (build), `/tmp/v2-verify-edits2.log`
  (verify-edits 13/16), `/tmp/v2-regress2b.log` (regresi-2 lolos).
- File hasil CLI di `/tmp/v2-out/` (`perang-beat135.html`, `perang-beat14.html`,
  `perang-beat135-cx.html`, `kuota-tank30.html`, `deploy-done18.html`,
  `perang-oldstyle14.html`); file hasil edit verify-edits di `/tmp/edited/`.
- Catatan: `verify-edits.mjs` yang saya jalankan ikut menulis ulang screenshot
  `verification/edit-template-*.png` (artefak skrip itu sendiri, bukan produk).

## 8. Batasan pengujian

- Headless di VM (chrome-headless-shell + SwiftShader, vendor three.js lokal):
  render software, remount lebih lambat dari perangkat nyata; sentuhan jari asli,
  keyboard virtual, dan performa di tablet fisik tidak bisa diuji dari sini.
- Commit `main 79af1088` tidak bisa diverifikasi (tidak ada `.git` lokal);
  verifikasi hanya terhadap isi file di disk.
- Ekspor MP4 end-to-end (ffmpeg) tidak diuji; VO/narasi suara (Web Speech) tidak
  diuji headless.
- Diff piksel dihitung pada screenshot iframe `#pv` 196×347 (ukuran stage default
  di viewport 1366×768), bukan stage layar penuh — cukup sebagai bukti perubahan
  visual, bersama bukti srcdoc.
