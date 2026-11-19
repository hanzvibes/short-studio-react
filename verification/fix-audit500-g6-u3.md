# Perbaikan G6 — U3: Bom hitung mundur tidak pernah menampilkan 00:01

- **Tanggal:** 2026-11-19 (WIB)
- **Acuan:** `verification/audit-500-2026-11-18.md` — U3 (O1, temuan Bom #O1)
- **Status: SELESAI — U3 hilang.** Reproduksi di main saat ini membuktikan temuan MASIH ADA (bukan "sudah hilang"); sesudah perbaikan, preview menampilkan 00:01 di t≈23,2–23,39, timer mulai berdetak di t=2,8, edit `beat.alarm` dihormati preview + unduhan, dan unduhan tanpa edit konsisten dengan preview (RM sama di semua t yang disapu).
- **Tidak ada push / branch / merge** (koordinator yang push sesudah verifikasi). Catatan: folder lokal ini **tidak punya `.git`** (bukan checkout git), jadi verifikasi "main `a461f8c6`" tidak bisa dikonfirmasi dari sini — yang diverifikasi adalah isi kode di disk saat kerja dimulai.

## 1. Reproduksi — SEBELUM perbaikan: BUG, persis seperti audit O1

Server prod port 3316 (`npm run build` + `npm start -- --port 3316`), Playwright + `chrome-headless-shell`, viewport 1440×900, template Bom (`template-bomb.html`), profil browser baru. RM/cdS dibaca lewat `w.eval(...)` di iframe (deklarasi `const` tidak menempel di `window`).

| Probe (fresh load, tanpa edit) | SEBELUM | Seharusnya (rumus asli) |
|---|---|---|
| `T_ALARM` / `T_DEFUSE` / `CD0` | **2** / 23,4 / 30 | 2,8 / 23,4 / 30 |
| `RM(2.8)` / `cdS(2.8)` | **29 / "00:29"** (sudah berdetak di t=2,8) | 30 / "00:30" |
| `RM(20)` / `cdS(20)` | 6 / "00:06" | 6 / "00:06" |
| `RM(23.2)` / `cdS(23.2)` | 2 / "00:02" | 1 / "00:01" |
| `RM(23.39)` / `cdS(23.39)` | **2 / "00:02"** | 1 / "00:01" |
| `cdS(23.4)` | "AMAN" | "AMAN" |

- srcdoc preview berisi `const T_ALARM=2;` + rumus injeksi `t<T_ALARM?CD0:…(CD0-1)/(T_DEFUSE-T_ALARM)`, tanpa `1.4216`.
- Screenshot stage t=23,39: timer **00:02** (`fix-audit500-g6-u3-before-t2339.png`; t=23,3 sama: `before-t233.png`).
- Unduhan `.html` tanpa edit props (Simpan → Unduh .html): rumus **ASLI** `t<2.8?30:…(t-2.8)*1.4216`, tanpa `T_ALARM` — preview dan unduhan tidak konsisten, persis bonus audit.
- 0 `pageerror` / console error. Bukti angka: `~/workspace/g6-u3/repro-before.json`, `~/workspace/g6-u3/rm-math.mjs`.

### Bukti matematis — perbaikan yang diminta saja TIDAK cukup

Rumus asli di disk memang benar: `30-floor((t-2.8)*1.4216)` mencapai 1 di t≈23,2 (`RM(23.39)=1`). Tapi rumus injeksi studio memakai faktor `(CD0-1)/(T_DEFUSE-T_ALARM)`:

| Rumus | Faktor | `RM(23.39)` | `RM(23.2)` |
|---|---|---|---|
| Asli (disk) | 1,4216 | 1 | 1 |
| Injeksi, `T_ALARM=2` (sebelum) | 29/21,4 = 1,3551 | 2 | 2 |
| Injeksi, `T_ALARM=2,8` **saja** | 29/20,6 = 1,4078 | **2** | **2** |
| Injeksi, `T_ALARM=2,8` + penyebut `-.2` (perbaikan) | 29/20,4 = 1,4216 | 1 | 2* |

`*` Lihat §7 butir 1: di t=23,2 persis, perbaikan memberi 2 vs asli 1 (selisih crossover 0,45 mdtk, artefak float — di semua t lain dan di t=23,3/23,39 sama).

Jadi **hanya mengganti default T_ALARM ke 2,8 tidak memperbaiki apa pun**: dengan penyebut `(T_DEFUSE-T_ALARM)`, RM baru mencapai 1 tepat di `T_DEFUSE`, saat `cdS` sudah `'AMAN'` — 00:01 tetap mustahil secara matematis. Perbaikan harus juga mengubah penyebut rumus (lihat §3).

## 2. Dari mana nilai 2,8 dibaca

Nilai 2,8 **bukan** hardcode buta — dibaca dari literal `template-bomb.html` sendiri:

- Baris 144 (rumus asli): `const RM=t=>t<2.8?30:…`
- Baris 143 (komentar): "hitung mundur bom: 00:30 mulai berjalan saat alarm (2.8 s), tersisa 00:01 sampai bom jinak (23.4 s)"
- Baris 256 (timeline): "2.8 alarm + hitung mundur 00:30"
- Situs `beat.alarm` per-file Bom: `ss(t,2.8,3.2)`, `t>=2.8&&t<18.6`, `t<2.8?'SIAP'`, dst. (semua memakai 2,8; Bug Hunter memakai 2)

Nilai yang sama sudah tertulis sebagai `default: 2.8` di `also` milik `bomb.seconds` — yang kalah hanya karena urutan penerapan (lihat §3).

## 3. Akar — dua cacat, bukan satu

1. **Default `T_ALARM` yang salah menang.** `mount()` menerapkan SEMUA prop bawaan lewat `setProps` (urutan `PROP_DEFS`). `bomb.seconds` (lebih dulu) memastikan `T_ALARM=2.8` via `also` (`ensureConstDefault`, hanya sisip bila belum ada); `beat.alarm` (kemudian) memakai `ensureConst` yang **menulis ulang** konstanta yang sudah ada dengan default bersamanya, **2** (milik Bug Hunter). Hasil: `const T_ALARM=2;` — timer mulai di t=2,0, `RM(2.8)=29`.
2. **Penyebut rumus injeksi salah.** `(CD0-1)/(T_DEFUSE-T_ALARM)` membuat hitung mundur mencapai 1 tepat di `T_DEFUSE`. Rumus asli memakai faktor `1.4216 = 29/20,4`, dengan `20,4 = (23,4−2,8)−0,2` — hitung mundur selesai **0,2 dtk sebelum** bom jinak, lalu menahan 00:01. Angka 0,2 itu bukan tebakan: itu setengah lebar jendela transisi jinak `T_DEFUSE±0,2` yang sudah dikodekan di situs `beat.defuse` (`(1-ss(t,23.2,23.6))` → `(1-ss(t,T_DEFUSE-.2,T_DEFUSE+.2))`) — 00:01 tampil tepat selama paruh pertama transisi jinak.

## 4. Perbaikan (kode studio saja — 2 file, cermin identik)

### `lib/studio.ts` + `scripts/apply-edit.mjs` (keduanya diubah sama persis)

**a) `beat.alarm` — default per-file Bom 2,8** (mekanisme `defaultByFile` yang sudah ada, preseden G1):

- `lib/studio.ts:3598–3604` / `apply-edit.mjs:3265–3271`: `"defaultByFile": { "template-bomb.html": 2.8 }` sesudah `"default": 2`. Default bersama 2 tetap milik Bug Hunter; `readProp` kini mengembalikan 2,8 untuk Bom, dan slider "Waktu alarm" di Bom berdefault **2,8**. Edit pengguna tetap menang (nilai edit ditulis lewat `ensureConst`, bukan default).
- `bomb.seconds` tidak diubah di bagian ini — `also`-nya sudah 2,8 dan kini selaras.

**b) `bomb.seconds` — penyebut rumus `-.2`** (supaya injeksi mereproduksi rumus asli untuk nilai berapa pun):

- `lib/studio.ts:2768–2774` / `apply-edit.mjs:2435–2441`: `(CD0-1)/(T_DEFUSE-T_ALARM)` → `(CD0-1)/(T_DEFUSE-T_ALARM-.2)`, lengkap dengan komentar derivasi di kedua file. Untuk nilai bawaan: 29/20,4 = 1,42157… ≈ 1,4216 (faktor asli). Rumus ini menggeneralisasi dengan benar: untuk `CD0`/`T_ALARM`/`T_DEFUSE` hasil edit apa pun, 00:01 selalu tercapai di `T_DEFUSE−0,2` (terbukti di §5.3–5.4).

Tidak disentuh: `components/Studio.tsx` (aliran mount/unduh sudah benar — unduhan memakai `entry.props` = **seluruh** `draftProps`, bukan hanya yang berubah, jadi konsisten dengan preview), 12 template asli, file audit, file bukti G1–G5.

## 5. Verifikasi — SESUDAH perbaikan

### 5.1 Fresh load Bom — U3 hilang

| Probe (fresh load, tanpa edit) | SESUDAH | Harapan |
|---|---|---|
| `T_ALARM` / `T_DEFUSE` / `CD0` | **2,8** / 23,4 / 30 | 2,8 / 23,4 / 30 |
| `RM(2.8)` / `cdS(2.8)` | **30 / "00:30"** (baru mulai, belum berdetak) | 30 / "00:30" |
| `RM(20)` / `cdS(20)` | 6 / "00:06" | 6 / "00:06" |
| `RM(23.39)` / `cdS(23.39)` | **1 / "00:01"** | 1 / "00:01" |
| `cdS(23.4)` | "AMAN" | "AMAN" |

- Screenshot stage t=23,3 dan t=23,39: timer **00:01** (`fix-audit500-g6-u3-after-t233.png`, `after-t2339.png`).
- Slider "Waktu alarm" di Bom berdefault **2,8** (terbaca dari DOM).
- 0 `pageerror` / console error. Bukti: `~/workspace/g6-u3/verify-after.json`.

### 5.2 Unduhan tanpa edit — konsisten dengan preview (nilai RM)

Unduhan `.html` tanpa edit props tetap memakai rumus **asli** (`1.4216`, tanpa `T_ALARM`) — itu benar per desain (tidak ada prop yang diubah, `applyEdits` tidak menyuntik apa pun). Yang dituntut U3 adalah konsistensi **nilai**: sapuan t=0…23,4 langkah 0,05 dtk membandingkan `RM(t)` rumus asli vs rumus injeksi bawaan → **0 ketidakcocokan**. Preview dan unduhan menampilkan angka yang sama di semua t yang disapu.

### 5.3 Edit alarm dihormati — preview + unduhan sama

Edit `beat.alarm` 2,8 → **3,5** (slider Objek → Jalan cerita → Terapkan):

| | Preview | Unduhan `.html` |
|---|---|---|
| `T_ALARM` | 3,5 | `const T_ALARM=3.5;` |
| `CD0` / `T_DEFUSE` | 30 / 23,4 | 30 / 23,4 |
| Rumus RM | injeksi `-.2` | injeksi `-.2` yang sama |
| `RM(2.8)` / `RM(3.5)` | 30 / 30 (timer belum mulai) | 30 / 30 |
| `RM(20)` / `RM(23.39)` | 6 / 1 | 6 / 1 |
| `cdS(23.39)` | "00:01" | "00:01" |

- `ss.mine.v1` menyimpan `"beat.alarm": 3.5` (seluruh `draftProps` ikut tersimpan); file unduhan `g6-u3-dl-alarm35.html`, tanpa `1.4216`.
- Screenshot t=23,39 sesudah edit alarm: timer **00:01** (`fix-audit500-g6-u3-after-alarm35-t2339.png`).
- Catatan harness: run pertama bagian ini gagal karena tombol dialog saat entri sudah aktif berbunyi "Perbarui video", bukan "Simpan video" — klik konfirmasi tidak jalan dan unduhan yang terbaca masih file lama. Itu cacat skrip verifikasi saya, bukan aplikasi; sesudah skrip diperbaiki (cocokkan kedua label), unduhan alarm35 terverifikasi seperti tabel di atas. Bukti: `~/workspace/g6-u3/verify-alarm-dl.json`.

### 5.4 Varian (seperti audit4c2)

| Varian | Hasil sesudah |
|---|---|
| `bomb.seconds` = 10 | `RM(5)=10`, `RM(23.39)=1`, `cdS(23.39)="00:01"`, `cdS(23.5)="AMAN"` |
| `beat.defuse` = 20 | `RM(19.9)=1`, `cdS(19.9)="00:01"`, `RM(19.99)=1`, `cdS(20.1)="AMAN"` |

### 5.5 Build + sync-check — HIJAU

- `npx tsc --noEmit`: bersih.
- `npm run build`: hijau (`✓ Compiled successfully`, 4/4 static pages).
- `node scripts/sync-check.mjs`: **SEMUA HIJAU — 12/12 template byte-identik lib == mjs** (modul + CLI + alias array); vendor three.js 12/12 rewrite 13/13 + export tetap CDN.
- Cek injeksi level node (`setProps` semua default Bom via `apply-edit.mjs`): `T_ALARM=2.8` tunggal (tidak ganda), situs alarm `2.8` habis terganti, `beat.alarm` Bug Hunter tetap default **2**.

### 5.6 Regresi — G1–G5 tidak rusak

- **Fresh load 12/12**: semua `ready=true`, bridge `true`, **`0 error validasi bawaan`** (`.valid-err` = 0 di semua template).
- **Alur edit → Terapkan → Simpan → reload**:
  - Bom: judul "G6 U3 FLOW BOMB" → toast `"Semua edit diterapkan"`, `ss.edits.v1` berisi judul, simpan → 1 entri, reload → judul + entri bertahan.
  - Versus (`template.html`): judul "G6 U3 FLOW VERSUS" → `ss.edits.v1` berisi judul, simpan → 1 entri, reload → judul + entri bertahan.
- Bukti: `~/workspace/g6-u3/regression-after.json`.

## 6. Yang TIDAK berhasil / batasan (dengan bukti)

1. **Batas t=23,2 persis: injeksi memberi RM=2, asli memberi 1.** Crossover 00:01 rumus asli di t=23,19955, injeksi di t=23,20000 — selisih **0,45 mdtk**, murni pembulatan float (`1.4216` asli adalah pembulatan 4 desimal dari 29/20,4; `29/20,4×20,4` di float = 28,999999999999996 < 29). Di semua t lain yang disapu (langkah 0,05 dtk, 0 ketidakcocokan) dan di t=23,3/23,39 keduanya 00:01; pada frame nyata (langkah 1/60 dtk) perbedaan 0,45 mdtk tidak terlihat. Bukan kegagalan perbaikan — dicatat apa adanya.
2. **CLI `export.mjs`/`apply-edit.mjs` dengan spec satu prop saja (`beat.alarm` tanpa `bomb.seconds`) tetap meninggalkan baris RM asli** (`1.4216`, T_ALARM tidak dipakai rumus). Itu semantik spec eksplisit CLI yang sudah ada (hanya prop yang disebut yang diterapkan), bukan regresi — dan jalur unduhan studio tidak kena karena selalu meneruskan seluruh `draftProps` (terbukti §5.3). Memperbaikinya butuh `anchorByFile` Bom untuk `beat.alarm` (+ `also` CD0/T_DEFUSE) — perubahan struktur anchor yang lebih besar dari cakupan U3; tidak dipaksakan.
3. **Toast Versus di alur regresi terbaca `null`.** Artefak timing harness (toast 2 dtk, dibaca sesudah 2,5 dtk — jebakan yang sama dicatat G5); alur terbukti lewat `ss.edits.v1` + entri tersimpan + reload bertahan.
4. **Satu console error `Failed to load resource: net::ERR_CONNECTION_RESET` di 11/12 template pada run regresi.** Sumber teridentifikasi: stylesheet Google Fonts (`fonts.googleapis.com/css2?family=Plus+Jakarta+Sans…`) yang di-reset egress proxy sandbox — konteks regresi saya tidak memasang stub font (harness utama memasangnya). Dengan stub: **0 error**. Bukan dari perubahan ini (mengenai semua template termasuk yang tak disentuh); di tablet/online normal font itu termuat.
5. **Verifikasi tablet / Web Speech tidak dilakukan** — butuh perangkat Rehan; semua bukti headless 1440×900, server port 3316 (dimatikan sesudah verifikasi).

## 7. File yang diubah + bukti

**Diubah (2 file, kode studio saja, cermin identik):**
- `lib/studio.ts` — rumus `bomb.seconds` (`:2768–2774`, penyebut `-.2` + komentar derivasi); `beat.alarm` `defaultByFile` Bom 2,8 (`:3598–3604`).
- `scripts/apply-edit.mjs` — sama persis: rumus (`:2435–2441`); `defaultByFile` (`:3265–3271`).

**Tidak disentuh:** 12 template asli di `public/templates/` (mtime tetap **2026-11-17 08:19** semua); file audit (`verification/audit-500-2026-11-18.md`, mtime 2026-11-19 05:02); file bukti G1–G5 (mtime terbaru tetap 2026-11-19 09:08, sebelum kerja G6); `components/Studio.tsx`, `app/`, CSS.

**Bukti baru (`verification/`, 5 screenshot + laporan ini):**
- Laporan ini: `fix-audit500-g6-u3.md`
- Sebelum: `fix-audit500-g6-u3-before-t233.png`, `fix-audit500-g6-u3-before-t2339.png` (timer 00:02)
- Sesudah: `fix-audit500-g6-u3-after-t233.png`, `fix-audit500-g6-u3-after-t2339.png` (timer 00:01), `fix-audit500-g6-u3-after-alarm35-t2339.png` (00:01 sesudah edit alarm 3,5)

**Skrip kerja (di luar repo, persisten):** `~/workspace/g6-u3/h.mjs` (harness), `rm-math.mjs` (bukti matematis node), `inject-node.mjs` (cek injeksi level node), `repro-before.mjs` (`repro-before.json`), `verify-after.mjs` (`verify-after.json`), `verify-alarm-dl.mjs` (`verify-alarm-dl.json`), `regression.mjs` (`regression-after.json`), file unduhan `download-noedit-after.html` + `download-alarm35.html`.
