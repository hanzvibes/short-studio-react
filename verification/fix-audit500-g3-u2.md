# Perbaikan G3 — U2: Kembalikan/Reset tidak bertahan sesudah reload

- **Tanggal:** 2026-11-19 (WIB)
- **Acuan:** `verification/audit-500-2026-11-18.md` — pola (a) (V1/C2/P1/Y1/R2/S1/B1 + A4) + Bom O12/M14
- **Status: SELESAI — reset bertahan sesudah reload di 24/24 tes (6 template × 4 tab) + spot-check 6/6 tab Teks di sisa template terkonfirmasi.**
- **Tidak ada push / branch / merge** (koordinator yang push sesudah verifikasi).
- **Metode:** server prod port 3313 (`npm run build` + `npm start -- --port 3313`), Playwright + `chrome-headless-shell`, viewport 1440×900, localStorage kosong per tes. Alur tiap tes: edit → Terapkan (diverifikasi tersimpan di `ss.edits.v1`) → Kembalikan → cek field + `ss.edits.v1` di sesi → reload → cek field + `ss.edits.v1` + screenshot. Skrip: `~/workspace/g3-u2/repro.mjs`, `~/workspace/g3-u2/regression.mjs` (di luar repo, persisten — bukan /tmp).

## 1. Reproduksi — SEBELUM perbaikan: 24/24 BUG

### 1.1 Teks / Caption / Shot — 18/18 BUG (run pertama)

Di semua 6 template yang diuji penuh, sesudah Kembalikan field kembali asli **di sesi itu**, tapi `ss.edits.v1` tetap berisi edit lama, dan sesudah reload nilai edit kembali:

| Template | Tab | Asli → edit | Sesudah Kembalikan (sesi) | Sesudah reload |
|---|---|---|---|---|
| Versus | teks | `Claude vs Codex` → `AUDIT RESET VERSUS` | field asli, `ss.edits.v1` masih berisi edit | field `AUDIT RESET VERSUS`, edit masih tersimpan |
| Versus | cap | `Aku paling jago nulis kode!` → `CAP RESET TEST` | field asli, `ss.edits.v1` masih berisi edit | field `CAP RESET TEST`, edit masih tersimpan |
| Versus | shot | Shot 2 mulai `3` → `3.5` | field `3`, `ss.edits.v1` masih berisi edit | field `3.5`, edit masih tersimpan |
| Adu Kode | teks | `Claude vs Codex` → `AUDIT RESET ADU_KODE` | field asli, edit masih tersimpan | `AUDIT RESET ADU_KODE` kembali |
| Adu Kode | cap | `Kodeku rapi. Satu fungsi, satu tugas.` → `CAP RESET TEST` | field asli, edit masih tersimpan | `CAP RESET TEST` kembali |
| Adu Kode | shot | Shot 2 mulai `3.1` → `3.6` | field `3.1`, edit masih tersimpan | field `3.6` kembali |
| Perang | teks | `Claude vs Codex` → `AUDIT RESET PERANG` | field asli, edit masih tersimpan | `AUDIT RESET PERANG` kembali |
| Perang | cap | `Tugas kecil. Aku spawn sub agent!` → `CAP RESET TEST` | field asli, edit masih tersimpan | `CAP RESET TEST` kembali |
| Perang | shot | Shot 2 mulai `2.8` → `3.3` | field `2.8`, edit masih tersimpan | field `3.3` kembali |
| Trio | teks | `Claude vs Codex vs Gemini` → `AUDIT RESET TRIO` | field asli, edit masih tersimpan | `AUDIT RESET TRIO` kembali |
| Trio | cap | `Santai. Kodeku rapi, bug pun minder!` → `CAP RESET TEST` | field asli, edit masih tersimpan | `CAP RESET TEST` kembali |
| Trio | shot | Shot 2 mulai `3` → `3.5` | field `3`, edit masih tersimpan | field `3.5` kembali |
| Kuota | teks | `Claude vs Codex` → `AUDIT RESET KUOTA` | field asli, edit masih tersimpan | `AUDIT RESET KUOTA` kembali |
| Kuota | cap | `Gampang! Kujelasin selengkap-lengkapnya.` → `CAP RESET TEST` | field asli, edit masih tersimpan | `CAP RESET TEST` kembali |
| Kuota | shot | Shot 2 mulai `2.8` → `3.3` | field `2.8`, edit masih tersimpan | field `3.3` kembali |
| Bom | teks | `Misi Mustahil` → `AUDIT RESET BOM` | field asli, edit masih tersimpan | `AUDIT RESET BOM` kembali |
| Bom | cap | `Misi hari ini: jinakkan bom rilis.` → `CAP RESET TEST` | field asli, edit masih tersimpan | `CAP RESET TEST` kembali |
| Bom | shot | Shot 2 mulai `2.8` → `3.3` | field `2.8`, edit masih tersimpan | field `3.3` kembali |

Contoh mentah (Versus/teks): sesudah reset `ss.edits.v1` =
`{"template.html":{"text":{"title":"AUDIT RESET VERSUS","sub":"siapa model terbaik?","end":"Menurut kamu, siapa\nyang menang?"}}}` — identik sebelum dan sesudah reload.

### 1.2 Objek — 6/6 BUG (run ulang dengan harness diperbaiki)

Run pertama memberi "OK" palsu di 6/6 tab Objek: klik Terapkan mendarat saat live reload slider (`scheduleLive`, debounce 250 mdtk) masih berjalan, tombol dalam keadaan disabled → klik no-op → edit props tidak pernah tersimpan (`editsAfterApply={}`), jadi tidak ada yang bisa gagal bertahan. Pelajaran harness: **klik Terapkan harus menunggu tombol benar-benar aktif + verifikasi simpanan** (`applySaved`). Sesudah harness diperbaiki (tunggu `disabled===false` stabil + cek `ss.edits.v1` berisi `"props"` + klik ulang bila belum tersimpan), hasilnya 6/6 BUG — `applySaved=true` di semua:

| Template | Slider pertama (claude.x) | Sesudah Kembalikan (sesi) | Sesudah reload |
|---|---|---|---|
| Versus | `-1.7` → `-1.9` | slider `-1.7`, `ss.edits.v1` masih `{"props":{"claude.x":-1.9, …}}` | slider `-1.9`, edit masih tersimpan |
| Adu Kode | `-1.7` → `-1.9` | slider `-1.7`, `ss.edits.v1` masih berisi props edit | slider `-1.9` kembali |
| Perang | `-2.95` → `-2.45` | slider `-2.95`, `ss.edits.v1` masih berisi props edit | slider `-2.45` kembali |
| Trio | `-2.6` → `-2.8` | slider `-2.6`, `ss.edits.v1` masih berisi props edit | slider `-2.8` kembali |
| Kuota | `-1.7` → `-1.9` | slider `-1.7`, `ss.edits.v1` masih berisi props edit | slider `-1.9` kembali |
| Bom | `0` → `-0.2` | slider `0`, `ss.edits.v1` masih berisi props edit | slider `-0.2` kembali |

**Total sebelum: 24/24 BUG, 0 page error.** Temuan sampingan run pertama (sebelum perbaikan, tab Caption/Shot): sesudah Kembalikan, tombol Terapkan tetap aktif + status "Siap diterapkan" (C4) — `applyDisabledAfterReset=false` di 12/12 tes cap/shot; di teks/objek sudah `true`.

### 1.3 Catatan kejujuran data

- File JSON run pertama (`repro-before.json`) hilang saat runtime restart VM (~08:0x WIB) menghapus /tmp — angka §1.1 di atas direkonstruksi dari 24 baris log run yang tersampaikan utuh, dan 24 screenshot `fix-audit500-g3-u2-before-*.png` selamat di `verification/`. Data Objek §1.2 berasal dari run ulang `repro-before-objek.json` (tersimpan di `~/workspace/g3-u2/`, selamat).
- Salinan `Studio.tsx` perbaikan pertama juga hilang dalam restart yang sama; perbaikan ditulis ulang persis sama (dicek: `diff` salinan cadangan vs file akhir kosong) dan diverifikasi ulang penuh sesudahnya.

## 2. Akar — lebih dalam dari perkiraan awal laporan

Laporan menyebut "reset tidak memanggil `saveCurrentFullEdit()`" — benar, tapi **pemanggilan langsung saja tidak cukup**. `saveCurrentFullEdit()` (`components/Studio.tsx:1274`) membaca `stateRef.current`, dan `stateRef.current` baru diperbarui saat React me-render ulang (baris 751–752: penugasan di badan render). `setDraftCaps`/`setDraftProps`/dsb. di dalam reset belum terlihat oleh `stateRef` pada tick yang sama — jadi `saveCurrentFullEdit()` yang dipanggil langsung sesudah `set*` akan menyimpan nilai **lama** (edit yang mau dihapus), bukan nilai reset. Bukti pola ini sudah ada di kode: `resetText` menunda `mount(true)` satu tick "agar fields baru kebaca", dan `applyAll` membaca draft dari `stateRef` dengan komentar "selalu segar".

## 3. Perbaikan (kode studio saja — 1 file)

`components/Studio.tsx` — keempat reset (`resetText` :1570, `resetCaps` :1587, `resetShots` :1604, `resetProps` :1615), **satu pola yang sama**:

1. Nilai reset ditulis dulu ke `stateRef.current` secara sinkron (`stateRef.current.fields = def`, `.draftCaps = caps`, `.draftShots = shots`, `.draftProps = dp`; untuk caption juga `.draftVO` + `.voTouched = false`).
2. Lalu `saveCurrentFullEdit()` — karena draft kini == asli, `fe` kosong dan entri template ini **dihapus** dari `fullEdits`, lalu efek persistensi menulis `ss.edits.v1` tanpa entri itu. Reset kini bertahan sesudah reload.
3. Baseline "diterapkan" (`applied` / `appliedCaps` / `appliedShots` / `appliedVO` / `appliedProps`) ikut disamakan ke nilai asli, supaya di sesi itu Terapkan kembali disabled + status "Tidak ada perubahan" — konsisten dengan perilaku `resetText` yang sudah begitu lewat `mount`. Efek samping yang disengaja dari baris yang sama polanya: C4 (§1.2) hilang, dan entri basi + dot "Diedit" Bom (O12/M14) ikut terhapus (lihat §4.4).

**Tidak diubah:** `saveCurrentFullEdit()` sendiri, `applyAll`, `openTemplate`, `load`, `mount`, `lib/studio.ts`, `scripts/*`, dan 12 template asli. Reset di Bom tidak diperlakukan khusus — polanya identik di semua template.

## 4. Verifikasi — SESUDAH perbaikan

### 4.1 Reset → reload: 24/24 OK + spot-check 6/6

Server sama, build baru. Di semua tes `applySaved=true`, sesudah Kembalikan `ss.edits.v1={}` dan field asli di sesi, sesudah reload field tetap asli dan `ss.edits.v1={}`. 0 `pageerror` / console error.

| Template | teks | cap | shot | objek |
|---|---|---|---|---|
| Versus | OK (`Claude vs Codex`) | OK (`Aku paling jago nulis kode!`) | OK (Shot 2 mulai `3`) | OK (slider `-1.7`) |
| Adu Kode | OK (`Claude vs Codex`) | OK (`Kodeku rapi. Satu fungsi, satu tugas.`) | OK (`3.1`) | OK (`-1.7`) |
| Perang | OK (`Claude vs Codex`) | OK (`Tugas kecil. Aku spawn sub agent!`) | OK (`2.8`) | OK (`-2.95`) |
| Trio | OK (`Claude vs Codex vs Gemini`) | OK (`Santai. Kodeku rapi, bug pun minder!`) | OK (`3`) | OK (`-2.6`) |
| Kuota | OK (`Claude vs Codex`) | OK (`Gampang! Kujelasin selengkap-lengkapnya.`) | OK (`2.8`) | OK (`-1.7`) |
| Bom | OK (`Misi Mustahil`) | OK (`Misi hari ini: jinakkan bom rilis.`) | OK (`2.8`) | OK (`0`) |

Spot-check tab Teks di 6 template terkonfirmasi lainnya (sesudah perbaikan): Deploy OK (`Deploy Jumat Sore`), Rival OK (`Claude vs Codex`), Typing OK (`Claude × Remotion`), Bug Hunter OK (`Bug Hunter 02.00`), Tidur OK (`Claudeku`), Rapat OK (`Rapat 5 Menit`) — **6/6 OK**. Jadi ke-9 template terkonfirmasi audit (Versus, Adu Kode, Perang, Deploy, Rival, Typing, Bug Hunter, Tidur, Rapat) semuanya ter-cover sesudah perbaikan: 3 penuh 4 tab + 6 spot-check Teks.

Perilaku sesi sesudah reset: `applyDisabledAfterReset=true` di **24/24** (sebelumnya `false` di 12/12 cap/shot — C4 hilang) dan `resetStillDisabledAfter=true` di 24/24.

### 4.2 Build + sync-check — HIJAU

- `npm run build`: **hijau** (`✓ Compiled successfully in 2.7s`); `npx tsc --noEmit` bersih.
- `node scripts/sync-check.mjs`: **SEMUA HIJAU — 12/12 template byte-identik lib == mjs**; vendor three.js 12/12 rewrite 13/13 + export tetap CDN. (Tidak ada perubahan di `lib/`/CLI; sync-check dijalankan sebagai bukti G1/G2 tidak rusak.)

### 4.3 Regresi

- **Fresh load 12/12** (localStorage kosong): semua `bridge=true`, **0 error validasi bawaan** (`.valid-err` = 0), status `Preview siap` — G1 tidak rusak. Durasi template 26–36 dtk.
- **Alur edit → Terapkan → Simpan → reload** di 2 template: Adu Kode judul `G3 U2 FLOW CODE` masuk iframe sesudah Terapkan; Simpan → `ss.mine.v1` = 1 entri; sesudah reload judul tetap + entri Video Buatan Saya tetap ada. Trio sama dengan `G3 U2 FLOW TRIO`.
- 0 `pageerror` / console error di semua run sesudah perbaikan.

### 4.4 Bom — pengecualian audit TIDAK terreproduksi; O12/M14 ikut selesai

- Audit menyatakan reset Bom BERTAHAN (pengecualian pola (a)). Dengan reload **langsung** (tanpa ganti template dulu), Bom terbukti BUG di 4/4 tab sebelum perbaikan (§1.1–1.2) dan OK di 4/4 sesudahnya (§4.1). Dugaan: worker audit berpindah template sebelum reload — `openTemplate` memanggil `saveCurrentFullEdit()`, sehingga reset tampak bertahan. Perilaku Bom kini identik dengan template lain; tidak ada perlakuan khusus.
- O12/M14 (entri basi + dot "Diedit" tetap menyala sesudah Kembalikan): **ikut selesai lewat baris yang sama polanya** — probe khusus Bom: dot `false` saat fresh → `true` sesudah Terapkan → **`false` sesudah Kembalikan**, `ss.edits.v1={}`, judul kembali `Misi Mustahil`. Tidak ada perubahan kode tambahan untuk M14.

## 5. Status Trio / Kuota

Keduanya berstatus "terbuka" di audit (reset+reload tidak diuji eksplisit workernya). **Kini terjawab: BUG sebelum, OK sesudah, di keempat tab** — Trio teks/cap/shot (§1.1) + objek (§1.2); Kuota sama. Tidak ada yang "sudah hilang" sebelum perbaikan; tidak ada template/tab yang ternyata sudah hilang.

## 6. Yang TIDAK berhasil / batasan

- **Tidak ada template/tab yang gagal diperbaiki.** 24/24 + spot-check 6/6 hijau.
- **Yang tidak diuji penuh:** 6 template terkonfirmasi terakhir (Deploy, Rival, Typing, Bug Hunter, Tidur, Rapat) hanya diuji tab Teks sesudah perbaikan, bukan keempat tab — jalur kode reset caption/shot/objek sama persis (satu pola, satu file) dan sudah terbukti di 6 template × 4 tab, tapi bukti per-tab untuk keenamnya belum ada. Bila koordinator mau bukti penuh, tinggal jalankan `node ~/workspace/g3-u2/repro.mjs after-spot "<slug…>" cap,shot,objek` (~10 menit).
- **Verifikasi tablet / Web Speech tidak dilakukan** — butuh perangkat Rehan; semua bukti headless 1440×900.
- **Draft yang belum diterapkan** (T6: ketik judul tanpa Terapkan lalu reload) tetap hilang — itu temuan terpisah, bukan U2, tidak disentuh.

## 7. File yang diubah + bukti

**Diubah (1 file, kode studio saja):**
- `components/Studio.tsx` — `resetText` (:1570–1585), `resetCaps` (:1587–1602), `resetShots` (:1604–1613), `resetProps` (:1615–1631): tulis nilai reset ke `stateRef` + `saveCurrentFullEdit()` + samakan baseline `applied*`. Komentar pola di atas `resetText`.

**Tidak disentuh:** 12 template asli di `public/templates/` (mtime tetap **2026-11-17 08:19:01** semua); file audit (`verification/audit-500-*.md`, `verification/audit500-*`); file bukti G1/G2 (`verification/fix-audit500-g1-u1-*`, `verification/fix-audit500-g2-u6-*`); `lib/studio.ts`, `scripts/*`.

**Bukti baru (`verification/`, 63 screenshot + laporan ini):**
- Laporan ini: `fix-audit500-g3-u2.md`
- Sebelum: `fix-audit500-g3-u2-before-<slug>-<tab>.png` (24, 6 template × 4 tab) + `fix-audit500-g3-u2-before-objek-<slug>-objek.png` (6, run ulang harness-perbaikan)
- Sesudah: `fix-audit500-g3-u2-after-<slug>-<tab>.png` (24) + `fix-audit500-g3-u2-after-spot-<slug>-teks.png` (6) + `fix-audit500-g3-u2-after-flow-{template-code,template-trio}.png` (2) + `fix-audit500-g3-u2-after-bom-dot.png` (1)

**Skrip kerja (di luar repo, persisten):** `~/workspace/g3-u2/repro.mjs`, `~/workspace/g3-u2/regression.mjs`, `~/workspace/g3-u2/Studio.tsx.fixed` (salinan file perbaikan), hasil JSON `repro-before-objek.json`, `repro-after.json`, `repro-after-spot.json`, `regression-after.json` + log `.log` masing-masing. Server tes port 3313 dimatikan sesudah verifikasi.
