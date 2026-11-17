# Fix FAIL-1 — "Terapkan semua edit" tetap aktif sesudah apply (apply-stuck)

Tanggal: 2026-11-17 · Project: short-studio-react · Fixer: subagent (follow-up verifikasi landscape)
File yang diubah: **hanya `components/Studio.tsx`** (12 template di `public/templates/` tidak disentuh, perilaku lain tidak diubah). **Tidak di-push** — push oleh koordinator.

## Ringkasan

FAIL-1 dari `verification/landscape-verify-2026-11-17.md` sudah diperbaiki dan terverifikasi headless:
sesudah menerapkan edit caption / shot / props, tombol **"Terapkan semua edit" kembali disabled**
dan status kembali **"Tidak ada perubahan — ubah teks, caption, shot, atau props untuk mengaktifkan Terapkan."**
Edit tetap diterapkan (bridge `__st` + preview), klik ulang idempotent, dan edit tersimpan di
`ss.edits.v1` selamat melewati ganti template bolak-balik. Regresi 390px portrait hijau penuh.

## Akar masalah (terverifikasi sendiri dari kode)

`capsChanged` / `shotsChanged` / `propsChanged` (`Studio.tsx:646-656`, sebelum edit) membandingkan
draft vs `orig*` — baseline template asli yang hanya diisi sekali saat `load()` (`:505-508`) dan
**tidak pernah diperbarui `applyAll`** (`:743-752` hanya `saveCurrentFullEdit()` + `mount(true)`).
Jadi draft ≠ orig selamanya sesudah edit pertama → `anyDirty` tetap true → tombol tetap aktif.
Tab Teks bersih karena `dirty` membandingkan `fields` vs `applied`, dan `mount()` memperbarui
`applied` — pola yang sama inilah yang sekarang dipakai untuk caption/shot/props/VO.

## Penyimpangan dari instruksi literal — dan kenapa wajib

Tugas menyebut "perbarui `orig*` ke nilai draft yang baru diterapkan". Itu **tidak** saya lakukan
secara literal, karena penelusuran kode membuktikan perbaikan literal tersebut menimbulkan
**data loss** (padahal bug ini justru tanpa data loss):

1. `saveCurrentFullEdit()` (`:572-588`) membangun entri `ss.edits.v1` dari selisih draft vs `orig*`.
   Bila `orig*` = draft sesudah apply, pemanggilan berikutnya menghasilkan `fe = {}` → entri
   **dihapus** dari `ss.edits.v1`. Pemanggil berikutnya itu `openTemplate()` (`:581`) — jadi
   edit caption yang sudah diterapkan akan **hilang saat ganti template** (dan saat reload
   berikutnya preview kembali ke caption asli).
2. `buildSpec()` (`:837-846`, ekspor .html) dan `confirmSaveMine()` (`:867-870`, Video Buatan Saya)
   memakai `capsChanged`/`shotsChanged`/`propsChanged` vs `orig*` — bila `orig*` diperbarui,
   video yang disimpan/diekspor **kehilangan edit yang sudah diterapkan**.
3. Tombol "Kembalikan" (`resetCaps`/`resetShots`/`resetProps`) mengembalikan draft ke `orig*` —
   meng-update `orig*` menghapus kemampuan revert ke template asli dalam satu sesi.

Sebagai gantinya saya memakai **opsi kedua yang ditulis verifier sendiri** di laporan FAIL-1:
"bandingkan draft dengan nilai yang sudah diterapkan — satu tempat, berlaku untuk ketiga tab".
`orig*` tetap baseline template asli (persistensi, reset, ekspor, Video Buatan Saya tidak berubah);
tombol/status memakai baseline baru `applied*`. Hasil observable-nya identik dengan yang diminta
tugas (tombol disabled + "Tidak ada perubahan"), tanpa efek samping di atas.

## Perubahan — `components/Studio.tsx`

| Lokasi | Perubahan |
|---|---|
| `:136-150` | State baru `appliedCaps` / `appliedShots` / `appliedVO` / `appliedProps` ("terakhir diterapkan") + komentar kenapa `orig*` tidak diubah |
| `:538-544` | `load()`: baseline `applied*` = draft awal (edit tersimpan / Video Buatan Saya sudah diterapkan ke preview saat load, jadi tidak ada yang pending saat buka template) |
| `:684-698` | Memo baru `capsPending` / `shotsPending` / `propsPending` / `voPending` = draft vs `applied*` |
| `:748-755` | `voFollowNote` dan `anyDirty` memakai `*Pending` (tombol + palet + semua tab ikut) |
| `:765-775` | `changeGroups`: memakai `*Pending`; hitungan teks dibandingkan ke `applied` (bukan `def`) supaya teks yang sudah diterapkan tidak tampil sebagai "siap diterapkan" saat kelompok lain masih pending |
| `:786-801` | `applyAll()`: sesudah `saveCurrentFullEdit()`, snapshot draft → `applied*` (nilai dari `stateRef.current`, di-deep-copy; `saveCurrentFullEdit` tetap jalan dulu vs `orig*`) |
| `:969-975` | `openMine()` (template asal sedang terbuka, override langsung tanpa `load()`): baseline `applied*` ikut disinkronkan, kalau tidak tombol akan tampak aktif padahal entri mine sudah diterapkan |

Tidak diubah: `capsChanged`/`shotsChanged`/`propsChanged` (vs `orig*`) tetap dipakai persistensi,
ekspor, Video Buatan Saya, dan tombol "Kembalikan". `mount()` tidak diubah.

## Hasil tes — sebelum vs sesudah

Sebelum (verifier, `landscape-verify-2026-11-17.md` FAIL-1, diukur 3×):

| Skenario | Sesudah edit | 1,5 dtk sesudah Terapkan |
|---|---|---|
| Trio, tab Caption, cap 1 diubah | enabled, "Siap diterapkan: caption." | **masih enabled, "Siap diterapkan: caption."** |
| Adu Kode, tab Shot, Shot 1 mulai 0→0,5 | enabled, "Siap diterapkan: shot." | **masih enabled, "Siap diterapkan: shot."** |
| Adu Kode, tab Teks, Judul diubah (kontrol) | enabled, "Siap diterapkan: 1 teks." | disabled, "Tidak ada perubahan…" ✅ |

Sesudah (run saya, headless 1366×768, `node /tmp/apply-stuck-verify.mjs`, server `npm start --port 3000`):

| Skenario | Sebelum Terapkan | Sesudah Terapkan (1,5 dtk) | Edit diterapkan? |
|---|---|---|---|
| Trio, tab Caption, cap 1 → "VERIFIKASI NYX 123 — trio bersatu" | enabled, "Siap diterapkan: caption." | **disabled, "Tidak ada perubahan…"** ✅ | `__st.caps()[0][2]` = teks baru ✅ |
| Adu Kode, tab Shot, Shot 1 mulai 0→0,5 | enabled, "Siap diterapkan: shot." | **disabled, "Tidak ada perubahan…"** ✅ | `__st.shots()[0][0]` = 0.5 ✅ |
| Trio, tab Props, "Claude · posisi X" −2,6→−1,6 | enabled, "Siap diterapkan: props." | **disabled, "Tidak ada perubahan…"** ✅ | tersimpan di `ss.edits.v1` (lihat bawah) ✅ |
| Klik ulang tombol (paksa via JS, tombol disabled) | — | tetap disabled, "Tidak ada perubahan…", bridge caps tidak berubah | idempotent ✅ |

Build: `npm run build` hijau (Next.js 15.5.29, compiled successfully, type-check lolos).
Console error selama semua skenario: **0**.

## Bukti anti-regresi persistensi (alasan utama menolak fix literal `orig*`)

Isi `ss.edits.v1` dibaca langsung dari localStorage pada tiap tahap (hasil lengkap di
`verification/apply-stuck-result.json`):

| Tahap | `ss.edits.v1` |
|---|---|
| Sesudah apply caption Trio | `template-trio.html: {caps}` ✅ |
| Sesudah apply shot Adu Kode | `+ template-code.html: {shots}` ✅ |
| Sesudah apply props Trio + ganti template | `template-trio.html: {caps, props}`, `template-code.html: {shots}` ✅ |
| Sesudah round-trip Trio → Adu Kode → Trio | sama, tidak ada yang hilang ✅ (`props.claude.x = -1.6`, `shots[0][0] = 0.5`) |

Round-trip: `__st.caps()[0][2]` tetap "VERIFIKASI NYX 123 — trio bersatu" sesudah kembali ke Trio.
Dengan fix literal `orig*`, entri `template-trio.html` akan terhapus pada `openTemplate()` saat
ganti template (terbukti dari penelusuran `saveCurrentFullEdit` di atas).

## Regresi cepat 390px portrait

Skrip lama `/tmp/landscape-regress390.mjs`, hasil: **semua hijau** — drawer default tertutup →
terbuka → tertutup, keempat tab (Teks/Shot/Caption/Props) aktif + pane terlihat, `overflowX: false`
(`scrollW: 390`), 0 console error. Status saat load: "Tidak ada perubahan…" (juga benar untuk
template tanpa edit tersimpan). Screenshot: `verification/landscape-390-regression.png`
(ditulis ulang oleh skrip tersebut).

## Screenshot bukti

| File | Isi |
|---|---|
| `verification/apply-stuck-after-caption.png` | Trio, tab Caption: cap 1 "VERIFI…", klip timeline "✓ VERIFIKAS…", tombol Terapkan abu-abu (disabled), status "Tidak ada perubahan…" |
| `verification/apply-stuck-after-shot.png` | Adu Kode sesudah apply shot |
| `verification/apply-stuck-after-props.png` | Trio sesudah apply props |
| `verification/apply-stuck-after.png` | Keadaan akhir sesudah round-trip (caption edit masih tampil) |
| `verification/apply-stuck-result.json` | Output JSON lengkap run verifikasi (semua status + bridge + isi `ss.edits.v1`) |

## Catatan untuk koordinator

- **Tidak di-push** (sesuai instruksi). Workdir `~/workspace/short-studio-react` tidak punya
  `.git` (hanya `.gitignore`) — push/diff harap dilakukan dari checkout git koordinator.
- Server lama `next-server` (PID 12893, sejak 14:01 WIB, build sebelum fix) masih memegang port
  3000 saat saya mulai — `npm start` baru gagal `EADDRINUSE` dan halaman lama melempar chunk 400.
  Saya matikan server lama itu lalu start ulang dari build baru sebelum verifikasi.
- Artefak probe: `page.addInitScript(... localStorage.removeItem("ss.edits.v1"))` di skrip saya
  sempat menghapus `ss.edits.v1` setiap `mount()` (init script ikut jalan di iframe `#pv`
  yang same-origin) — sudah dihapus dari skrip; run pertama yang menunjukkan `edits = {}` adalah
  artefak probe, bukan bug aplikasi. Run kedua (skrip final) membuktikan persistensi benar.
- Belum diuji headless (hanya ditelaah dari kode): tombol "Kembalikan" sesudah apply tetap aktif
  (draft ≠ `orig*`) dan mengembalikan draft ke asli template; apply berikutnya menerapkan
  revert tersebut. Layak dicek satu klik saat review manual.
- Skrip verifikasi: `/tmp/apply-stuck-verify.mjs` (Playwright + chrome-headless-shell, mirror CDN
  `/tmp/cdn-mirror`, pola sama dengan `/tmp/probe-apply.mjs` milik verifier).
