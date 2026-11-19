# Perbaikan Audit-500 G10 — U9/U10: Sinkronisasi Narasi/VO

Repo: `hanzvibes/short-studio-react` · main `79d63d44` (G1–G9 sudah merge).
Tanggal: 2026-11-19. Server tes: `npm start -- --port 3320` (headless
`chrome-headless-shell` + Playwright; harness di `/tmp/g10/`, bukan bagian repo).
File audit (`verification/audit-500-*.md`, `verification/audit500-*`) dan bukti
G1–G9 TIDAK disentuh. 12 template asli `public/templates/` TIDAK disentuh
(mtime tetap 2026-11-17 08:19, diverifikasi sesudah perbaikan). Tidak ada push /
branch / merge (koordinator yang push).

## 1. Keputusan desain — ikuti-per-baris (per-line follow)

Tugas memberi dua opsi: (a) VO literal tidak lagi mengikuti teks caption, atau
(b) VO mengikuti caption hanya bila pengguna belum pernah mengedit Narasi
manual. Survei semua 12 template sebelum memilih (parser literal per file):

| Template | VO | VO vs caption |
|---|---|---|
| Versus, Adu Kode, Deploy, Trio | turunan (`VO=caps.map(c=>c[2])`) | mengikuti otomatis (ekspresi) |
| Bom, Bug Hunter, Kuota, Rapat, Perang, Rival, Tidur, Typing | literal | **DIFF di semua 8** — tidak ada satu pun yang VO-nya sama persis dengan caption |

Setiap VO literal adalah tulisan tangan yang disengaja: ejaan fonetik untuk TTS
("Merj konflik!", "Hah? Server eror lima ratus?!", "Git bleim", "Klod",
"Auth ts, baris empat puluh dua", angka dieja "lima menit"/"tiga puluh detik")
dan perbedaan kecil lain ("Misi hari ini. Jinakkan bom rilis." vs
"Misi hari ini: jinakkan bom rilis."). Jadi opsi (b) apa adanya tetap
menghancurkan ejaan fonetik pada edit teks caption PERTAMA (yang dikeluhkan
O2/B4), sementara opsi (a) mematikan sinkronisasi yang audit nilai benar di
Tidur/Rapat.

**Keputusan: (b) yang diperhalus per baris.** Baris VO literal `i` mengikuti
teks caption baru **hanya bila teks VO baris itu saat ini masih sama dengan
teks caption lama**. Begitu baris itu menyimpang — karena ejaan fonetik
penulis template, atau karena pengguna mengedit Narasi manual — baris itu
menjadi independen dan tidak pernah lagi ditimpa edit caption. Konsekuensinya:

- Baris fonetik terlindungi sejak awal di semua 8 template literal (B4/O2
  teratasi sungguhan, bukan sekadar diperingatkan).
- Baris yang memang masih sama (mis. Perang #1, Tidur #3, Rapat #2) tetap
  mengikuti caption seperti sebelumnya — sinkronisasi Tidur/Rapat yang
  dinilai benar tetap hidup, dan field Narasi disinkronkan ke VO baru itu.
- Perubahan **hanya waktu/pembicara tidak pernah menyentuh VO** (perbandingan
  hanya pada teks `c[2]`).
- Edit Narasi manual (`voTouched`) tetap membekukan SEMUA follow — jalan
  keluar yang sudah ada dipertahankan, dan pesannya di UI tetap sama
  ("Suara diedit manual — tidak lagi mengikuti teks caption.").
- Aturan ini ditulis SEKALI sebagai `deriveVOFromCaps()` dan dipakai di
  ketiga jalur (preview `mount()`, `Terapkan`, ekspor/CLI `applyEdits`),
  supaya ketiganya selalu memberi VO yang sama.

Peringatan dihitung per edit, bukan per jenis template: "Suara akan mengikuti
teks caption baru saat diterapkan." tampil **hanya bila ada baris yang
benar-benar akan mengikuti**; bila teks berubah tapi tidak ada baris yang
mengikuti, tampil penjelasan jujur "Suara di video ini ditulis terpisah dari
caption — teks caption tidak mengubah suara. Ubah suara di seksi Narasi."
(hint netral, bukan warning kuning); bila hanya waktu yang berubah, tidak ada
catatan sama sekali. Template turunan tetap menampilkan "Suara di video ini
mengikuti caption otomatis." — sekarang juga hanya bila ada TEKS yang berubah.

## 2. Reproduksi SEBELUM perbaikan (main `79d63d44`, build + server 3320)

Semua klaim U9/U10 terreproduksi. `VO[]` dibaca dari `srcdoc` iframe preview;
field Narasi dibaca dari `input[aria-label="Narasi N"]`.

### U9 — waktu saja (Bom)
- Ubah **hanya** mulai caption 2: `3 → 3,5` → Terapkan.
- Peringatan "Suara akan mengikuti teks caption baru saat diterapkan." **tampil**
  padahal teks tidak baru.
- `VO[0]` berubah `"Misi hari ini. Jinakkan bom rilis."` →
  `"Misi hari ini: jinakkan bom rilis."` (seluruh VO ditulis ulang dari teks
  caption — `VO[1]` kebetulan tetap karena teks caption 2 tidak diubah).
- Akar: `mount()` memakai `capsChanged` (seluruh objek caption, termasuk
  waktu) lalu `writeVO(draftCaps.map(c => c[2]))`.

### U9 — teks caption (Bom, Bug Hunter, Perang)
- Bom, teks caption 2 → `"AUDIT CAP DUA"`: `VO[1]` `"Merj konflik! Tinggal
  tiga puluh detik!"` → `"AUDIT CAP DUA"`; `VO[0]` ikut berubah (tulis ulang
  utuh). Field Narasi tetap menampilkan VO lama.
- Bug Hunter, teks caption 2 → `"AUDIT BUG DUA"`: `VO[1]`
  `"Hah? Server eror lima ratus?!"` → `"AUDIT BUG DUA"`; `VO[0]`
  `"Jam dua pagi. Zzz."` → `"Jam dua pagi. Zzz…"`. Ejaan fonetik hancur.
- Perang, teks caption 1 → `"AUDIT PERANG SATU"`: **`VO[0]` di srcdoc
  BERUBAH** menjadi `"AUDIT PERANG SATU"` — klaim P2 "Narasi tidak berubah"
  ternyata hanya benar untuk **field** Narasi (basi, lihat U10); VO videonya
  mengikuti. Jadi peringatan itu benar untuk srcdoc Perang, dan yang rusak
  di Perang adalah tampilan field, bukan peringatannya. (Nuansa ini dicatat
  karena laporan audit merangkum P2 sebagai "peringatan salah".)

### U10 — Narasi basi (Tidur, Rapat)
- Tidur, teks caption 1 → `"AUDIT VO STALE"` → Terapkan: srcdoc VO =
  `["AUDIT VO STALE", "BANGUN! Dari tadi gak kerja!", "Nah, gitu dong!"]`
  (seluruh VO ditulis ulang — `VO[1]` ikut berubah padahal caption 2 tidak
  disentuh), tapi field Narasi tetap
  `["Deadline satu jam lagi.", "Bangun! Dari tadi nggak kerja!", "Nah, gitu dong!"]`.
- Tidur, lalu edit Narasi #2 → `"AUDIT NARASI DUA"` → Terapkan: srcdoc VO =
  `["Deadline satu jam lagi.", "AUDIT NARASI DUA", "Nah, gitu dong!"]` —
  **`VO[0]` diam-diam kembali ke teks lama** sementara caption #1 tetap
  `"AUDIT VO STALE"`. Paruh kedua S2 **terkonfirmasi** bila yang diedit adalah
  baris Narasi yang BERBEDA dari baris caption yang diubah. (A7 hanya menguji
  edit Narasi #1 — baris yang sama — sehingga tidak melihat timpa-balik ini;
  keduanya konsisten: edit baris yang sama tidak menimpa balik, edit baris
  lain menimpa balik baris yang tidak disentuh.)
- Rapat, teks caption 1 → `"Cuma rapat LIMA menit kok AUDIT."` → Terapkan:
  srcdoc `VO[0]` berubah; field Narasi tetap `"Cuma rapat lima menit kok."`.
  Lalu edit Narasi #1 → `"Narasi EDIT manual."` → Terapkan: bertahan
  (`VO[0]` = teks manual) — sesuai A7.

## 3. Perubahan kode

### `lib/studio.ts`
- `deriveVOFromCaps(vo, oldCaps, newCaps)` — baru, baris 557. Satu-satunya
  tempat aturan per-baris ditulis (komentar U9/U10 lengkap di sana).
- `applyEdits()` — cabang VO (baris ~4930): literal memakai
  `deriveVOFromCaps` dari `html` ASLI (bukan `h` yang sudah berisi caps baru
  — lihat §5, bug yang sempat lolos); tulis VO hanya bila ada baris yang
  berubah; `voFollowedCaps` true hanya bila VO benar-benar berubah.
  Turunan: flag hanya bila ada TEKS yang berubah.
- Komentar header spec (baris 189–194) + komentar `ApplyResult.voFollowedCaps`
  diperbarui ke aturan baru.

### `scripts/apply-edit.mjs` (cermin lib — wajib sama, dicek sync-check)
- `deriveVOFromCaps()` — baru, baris 326.
- `applyEdits()` — cabang VO yang sama (baris ~4470).
- Komentar header (baris 20–27), daftar fungsi sinkron (baris 41), dan pesan
  peringatan CLI (baris ~4845, menyebut baris fonetik tidak berubah).

### `components/Studio.tsx`
- Impor `deriveVOFromCaps` (baris 10).
- `stateRef` (baris 820): tambah `origVO`, `appliedCaps`, `appliedVO` —
  `mount()`/`applyAll()` butuh baseline "terakhir diterapkan" yang segar di
  tick yang sama.
- `mount()` (baris ~1140): ganti `capsChanged → writeVO(caps.map teks)`
  dengan VO efektif per baris (`voTouched` → draftVO utuh; bila bukan,
  `deriveVOFromCaps(draftVO, appliedCaps, draftCaps)`); tulis hanya bila
  berbeda dari VO asli template.
- `load()` (baris ~1315): VO awal diturunkan dari caption tersimpan
  (`mineOverride?.vo ?? fe?.vo ?? deriveVOFromCaps(pv, pc, draftCapsInit)`)
  supaya field Narasi tidak basi sesudah reload (S2/N2) — VO manual tetap
  menang.
- `applyAll()` (baris ~1715): sesudah simpan berhasil, hitung VO efektif
  dan **sinkronkan `draftVO` + `appliedVO`** (plus `stateRef`) sebelum
  `mount()` — inilah perbaikan U10: field Narasi menampilkan VO baru
  sesudah Terapkan, dan edit Narasi berikutnya berangkat dari VO baru itu.
- `voFollowNote` (baris 1626–1656): `capTextPending` (hanya teks `c[2]`),
  `voWillFollow` (ada baris yang benar-benar akan mengikuti), teks
  peringatan per keadaan + `voFollowWarn` untuk kelas CSS
  (render baris 3409).
- `resetCaps()` (baris ~1755): `stateRef.appliedCaps/appliedVO` ikut
  kembali ke asli (draftVO sudah direset sebelumnya).
- `openMine()` jalur template-sama (baris ~1995): entri tanpa VO manual
  menurunkan VO dari captionnya (sama seperti `load()`).

### `SKILL.md` (baris 110–115), `README.md` (baris 204–208)
- Dua baris dok yang menyatakan aturan lama ("VO literal diperbarui mengikuti
  teks caps baru") diperbarui ke aturan per-baris + peringatan yang benar.
  (Bukan file audit/bukti — dok perilaku yang harus tetap jujur.)

## 4. Verifikasi SESUDAH perbaikan

`npm run build` hijau (setelah 2x type error diperbaiki saat build pertama —
lihat §5). `node scripts/sync-check.mjs` hijau: **12/12 template byte-identik
lib == mjs** (modul + CLI + alias array) + vendor 13/13 + export tetap CDN.
Semua uji headless di bawah memakai build final + server 3320 yang di-restart.

### Waktu saja (Bom) — U9 inti
| | Sebelum | Sesudah |
|---|---|---|
| Peringatan saat ubah mulai 3→3,5 | "Suara akan mengikuti…" (salah) | **tidak ada catatan Suara sama sekali** |
| `VO[]` srcdoc sesudah Terapkan | `VO[0]` berubah jadi teks caption | **utuh 10/10** (`"Merj konflik!…"`, `"Misi hari ini. Jinakkan bom rilis."` dst.) |
| Caption 2 | mulai 3,5 diterapkan | mulai 3,5 diterapkan, teks tetap |
| Sesudah reload | — | VO utuh, waktu 3,5 bertahan |

### Teks caption, baris fonetik (Bom / Bug Hunter / Tidur #1 / Rapat #1)
| Kasus | Peringatan | `VO[]` sesudah Terapkan |
|---|---|---|
| Bom cap 2 → "AUDIT CAP DUA" | hint "Suara di video ini ditulis terpisah dari caption — teks caption tidak mengubah suara. Ubah suara di seksi Narasi." | utuh 10/10; `VO[1]` tetap `"Merj konflik! Tinggal tiga puluh detik!"` |
| Bug Hunter cap 2 → "AUDIT BUG DUA" | hint "terpisah" yang sama | utuh 10/10; `VO[1]` tetap `"Hah? Server eror lima ratus?!"` |
| Tidur cap 1 → "AUDIT VO STALE" | hint "terpisah" | utuh 3/3; field Narasi == VO |
| Rapat cap 1 → "Cuma rapat LIMA menit kok AUDIT." | hint "terpisah" | utuh 10/10; field Narasi == VO |

### Teks caption, baris yang masih sama (ikuti + sinkron field) — U10
| Kasus | Peringatan | `VO[]` sesudah Terapkan | Field Narasi |
|---|---|---|---|
| Perang cap 1 → "AUDIT PERANG SATU" | "Suara akan mengikuti teks caption baru saat diterapkan." (warn) | `VO[0]` = "AUDIT PERANG SATU"; `VO[7]` tetap "Konflik di mana-mana." (lindung — beda elipsis) | == VO (sinkron) |
| Tidur cap 3 → "AUDIT TIDUR TIGA" | "Suara akan mengikuti…" (warn) | `VO[2]` = "AUDIT TIDUR TIGA"; `VO[0..1]` tetap | == VO (sinkron) |
| Rapat cap 2 → "AUDIT RAPAT DUA" | "Suara akan mengikuti…" (warn) | `VO[1]` = "AUDIT RAPAT DUA" | == VO (sinkron) |

### Edit Narasi manual + skenario S2 (Tidur)
- Tidur: cap 3 ikut (`VO[2]` = "AUDIT TIDUR TIGA"), lalu edit Narasi #2 →
  "AUDIT NARASI DUA" → Terapkan: VO =
  `["Deadline satu jam lagi.", "AUDIT NARASI DUA", "AUDIT TIDUR TIGA"]` —
  **`VO[2]` yang mengikuti caption TIDAK kembali ke teks lama** (timpa-balik
  S2 hilang karena field sudah sinkron). Sesudah reload: VO dan field Narasi
  tetap sama persis.
- Rapat: Narasi #1 manual → "Narasi EDIT manual." → Terapkan: `VO[0]`
  manual, `VO[1]` tetap "AUDIT RAPAT DUA" (edit manual satu baris tidak
  menimpa baris lain); edit caption 2 lagi sesudah manual → VO **beku**
  (hanya pesan "Suara diedit manual…" yang tampil, tanpa peringatan ikut).
- Bom: Narasi #2 manual → "Merj konflik! MANUAL." → Terapkan, lalu edit
  teks caption 2 → Terapkan: `VO[1]` tetap manual — VO beku.

### Template turunan (Versus, `VO=caps.map`)
- Ubah teks caption 1 → hint "Suara di video ini mengikuti caption otomatis."
  (voFollowNote; hint statis seksi tetap ada), `caps[0]` di bridge =
  `[3, 6, "AUDIT VERSUS SATU", 0]`.
- Ubah **hanya waktu** caption 1 → voFollowNote **hilang** (hanya hint statis
  seksi yang tersisa) — benar, karena ekspresi `caps.map` hanya membaca teks.

### Konsistensi ekspor (VO export .html == preview)
CLI `apply-edit.mjs --edit` (jalur yang sama dengan `export.mjs`, dibuktikan
identik oleh sync-check), 5 kasus — VO keluaran == VO preview untuk draf yang
sama: Bom teks+waktu → VO utuh; Bom waktu saja (cap 10, 27,4→28) → VO utuh;
Tidur cap 3 → `VO[2]` = "AUDIT TIDUR TIGA" + pesan CLI
"diterapkan: caps, vo · VO mengikuti teks caption"; Tidur cap 1 → VO utuh;
Perang cap 1 + cap 8 → `VO[0]` = "AUDIT PERANG SATU",
`VO[7]` tetap "Konflik di mana-mana.". (Satu kasus awal — Bom waktu cap 2
3→3,5 — ditolak CLI dengan error kata/detik 3,16 > 2,5; itu validasi keras CLI
yang sudah ada, bukan terkait VO; kasus diganti ke cap 10.)

### Regresi
- Fresh load **12/12**: "Preview siap", **0 `.valid-err`** di semua template
  (G1 tidak rusak). 0 `pageerror`. Satu-satunya noise: request font Google
  gagal (`ERR_CONNECTION_RESET`, artefak egress sandbox — font tidak
  memblokir preview; di 11 template tercatat sebagai reqfail + console, di
  Tidur tidak muncul).
- Alur edit → Terapkan → Simpan → reload → buka entri (Tidur, cap 3):
  toast `"G10 SIMPAN" disimpan di Video Buatan Saya`; sesudah reload +
  buka entri: caption 3 = "AUDIT SIMPAN TIGA", VO =
  `["Deadline satu jam lagi.", "Bangun! Dari tadi nggak kerja!", "AUDIT SIMPAN TIGA"]`,
  field Narasi sama persis.
- Kembalikan sesudah VO mengikuti (Tidur cap 3): VO + field kembali ke asli
  (`"Nah, gitu dong!"`).
- Draf belum diterapkan + ganti template + kembali (Tidur cap 3): draf
  bertahan, VO diturunkan (`VO[2]` = "AUDIT DRAF TIGA"), field Narasi sama.

## 5. Yang sempat salah saat pengerjaan (diperbaiki, bukan disembunyikan)

1. **Bug `applyEdits` (lib + CLI) — "lama" dibaca dari `h` yang sudah
   berubah.** Draf pertama `applyEdits` memanggil `parseCaps(h)` /
   `parseVO(h)` di cabang VO, padahal `setCaps` sudah menulis caps baru ke
   `h` — akibatnya `deriveVOFromCaps` membandingkan VO lama dengan caption
   BARU dan tidak ada baris yang pernah mengikuti (Tidur cap 3 dan Perang
   cap 1 gagal ikut di ekspor, sementara preview studio — yang memakai
   `appliedCaps` — benar). Ketahuan oleh uji konsistensi ekspor (§4), BUKAN
   oleh sync-check: spec sync-check selalu menyertakan `vo` eksplisit untuk
   template literal sehingga cabang ini tidak pernah tereksekusi, dan untuk
   turunan sync-check tidak menegaskan `voFollowedCaps`. Perbaikan: baca
   "lama" dari parameter `html` asli (lib baris ~4944, mjs ~4476) + komentar
   penjelas. Uji ekspor diulang hijau. **Catatan untuk koordinator:**
   sync-check tidak meng-cover cabang follow tanpa `vo` eksplisit — layak
   ditambah satu kasus (spec caps tanpa vo) di lain waktu.
2. **2x type error saat build pertama** (`next` bertipe `string[] | null`
   di `mount()` — tambah guard `next &&`; `spec.caps` possibly undefined di
   dalam closure `.some()` di lib — tangkap ke `const newCaps` dulu).
   Keduanya diperbaiki; `tsc --noEmit` + `npm run build` hijau sesudahnya.
3. **Rebuild di tengah run regresi pertama** membuat satu pemuatan halaman
   gagal ("Memuat…" — chunk `.next` berubah saat server lama menyajikan;
   pola yang sama dengan catatan audit A-reverify). Bukan bug produk: run
   regresi diulang penuh sesudah server di-restart dengan build final, semua
   hijau. Selama pengerjaan, server HANYA di-restart via PID port 3320
   sendiri (tidak pernah `pkill` pola lebar).

## 6. Yang TIDAK berhasil / tidak diubah

- **Penempatan peringatan tidak diubah.** Peringatan tetap berada di dalam
  seksi Narasi (details) di tab Caption — pengguna harus membuka seksi itu
  untuk membacanya. Isinya sekarang benar di semua keadaan; memindahkan ke
  dekat baris caption adalah pekerjaan UX terpisah (di luar U9/U10).
- **Catatan ganda di template turunan.** Saat teks caption berubah di
  template turunan, ada dua hint yang hampir sama: hint statis seksi
  ("…Edit caption untuk mengubah narasi.") dan voFollowNote ("Suara di video
  ini mengikuti caption otomatis."). Keduanya benar; redundansinya dibiarkan
  karena menghilangkan salah satunya menyentuh teks di luar U9/U10.
- **Tidak ada bagian yang dihentikan.** Semua bagian U9/U10 selesai
  diverifikasi.

## 7. Screenshot (verification/)
Sebelum: `fix-audit500-g10-u9u10-before-bom-teks-warning.png`,
`before-bom-teks-applied.png`, `before-bom-waktu-applied.png`,
`before-bughunter-teks-applied.png`, `before-perang-teks-warning.png`,
`before-perang-teks-applied.png`, `before-rapat-cap-applied.png`,
`before-rapat-narasi1-applied.png`, `before-tidur-cap-applied.png`,
`before-tidur-narasi2-applied.png`.
Sesudah: `fix-audit500-g10-u9u10-after-bom-teks-warning.png`,
`after-bom-teks-applied.png`, `after-bom-waktu-applied.png`,
`after-bughunter-teks-applied.png`, `after-perang-teks-applied.png`,
`after-rapat-cap1-applied.png`, `after-rapat-cap2-applied.png`,
`after-rapat-manual-beku.png`, `after-tidur-cap1-applied.png`,
`after-tidur-cap3-applied.png`, `after-tidur-reload.png`,
`after-simpan.png`, `after-simpan-buka.png`.
Data mentah JSON: `/tmp/g10/repro-before.json`, `/tmp/g10/repro-before2.json`,
`/tmp/g10/verify-after.json`, `/tmp/g10/regression2-after.json`;
harness: `/tmp/g10/h.mjs`, `/tmp/g10/repro.mjs`, `/tmp/g10/repro2.mjs`,
`/tmp/g10/verify-after.mjs`, `/tmp/g10/regression2.mjs`,
`/tmp/g10/export-check.mjs`.
