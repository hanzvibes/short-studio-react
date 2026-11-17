# Perbaikan F1 — Tur langkah 3 (Inspector) sorotan salah di mode sheet

**Tanggal:** 2026-11-18 · **Project:** Short Studio React (`~/workspace/short-studio-react`)
**Temuan asal:** `verification/sheet-verify-2026-11-18.md` §7 F1 (verdict TIDAK LAYAK PUSH)
**Yang diubah:** HANYA `components/Studio.tsx` (efek tur, baris ~2113–2207).
`app/globals.css`, `lib/studio.ts`, `scripts/*`, 12 template asli, dan perilaku
lain (sheet, drawer, focus-view, editor, tema) TIDAK disentuh. Tur tidak
dinonaktifkan; desain sheet tidak diubah.

## Akar (terbukti dengan instrumentasi, bukan tebakan)

`tourPlace(3)` memanggil `setSheetSnap("half")` lalu LANGSUNG mengukur
`.inspector` saat sheet masih tertutup → sorotan `{y:810, h:26}`. Re-measure
320/1000ms (efek tur) terbukti TIDAK pernah memperbaiki, dan instrumentasi
sementara (`console.log` di `tourPlace` + efek tur, sudah dihapus lagi)
menunjukkan kenapa:

- Timer 320ms DAN 1000ms **keduanya fire dan keduanya mengukur
  `top=816 bottom=1584`** — posisi tertutup — padahal state `sheetSnap`
  sudah `"half"` dan probe independen (CDP `evaluate`) di saat yang sama
  sudah membaca inspector `y=428` (settle).
- Artinya: di headless, `getBoundingClientRect()` di dalam callback
  `setTimeout` masih membaca nilai basi main thread (compositor SwiftShader
  kelaparan, belum memproduksi frame untuk transisi sheet), sementara
  pembacaan lewat CDP `evaluate` sudah melihat nilai compositor yang baru.
  Timeout dengan durasi berapa pun tidak bisa diandalkan — masalahnya bukan
  "terlalu cepat", melainkan sinyalnya (timer main thread) tidak sinkron
  dengan compositor.
- Efek samping yang ikut terjelaskan: spot `{y:46, h:772}` di sampel awal
  probe verifikator (b4c) adalah `.tour-spot` yang sedang bertransisi CSS
  (`.28s` pada `left/top/width/height`) — render tertinggal dari state,
  bukan nilai state. Nilai state yang final memang strip `{y:810, h:26}`.

## Perbaikan (mekanisme)

Di efek tur (`components/Studio.tsx`, baris ~2113–2207): bila langkah yang
masuk adalah langkah 3 DAN sheet sedang tertutup (`tourStep === 3 &&
sheetMode && sheetSnap === "closed"`), pasang **settle waiter pada elemen
sheet (`.inspector` via `sheetRef`)** — tiga lapis, semuanya membersihkan
diri di cleanup efek:

1. **Utama — `transitionend` (`propertyName === "transform"`,
   `target === sheet`)**: sinyal dari compositor bahwa transisi sheet
   benar-benar selesai, berapa pun molornya di headless. Listener tetap
   dipasang sampai efek dibersihkan, jadi koreksi akhir selalu datang dari
   akhir transisi yang sebenarnya.
2. **Pengaman — polling rect stabil via `requestAnimationFrame`**:
   ukur ulang bila `getBoundingClientRect()` sheet sama (≤1px) di dua
   sampel rAF berjarak ≥150ms. rAF dipakai (bukan timer) supaya bacaan
   rect sinkron dengan frame compositor. Polling ini sempat terkecoh
   "stabil" di posisi tertutup (terbukti di run fix1: poll fire dengan
   `top=816`) — karena itu lapis 1 tetap dipasang dan lapis 3 di bawah
   selalu jalan.
3. **Batas keras — 2,5 dtk**: ukur ulang SELALU (tanpa terkecuali,
   sekalipun polling sudah fire), sebagai jaring terakhir bila
   `transitionend` tidak pernah fire. Pengukuran ulang idempotent.

Yang TIDAK berubah: pengukuran langsung tetap dilakukan (sorotan selalu ada
sejak awal, seperti langkah 0 saat drawer bergeser), timer 320/1000ms dan
`transitionend` drawer dipertahankan apa adanya, dan **masuk ulang ke
langkah 3 tidak memicu waiter** — sheet sudah Half, pengukuran langsung
sudah benar (kasus yang sudah benar tetap benar).

## Bukti (headless, server `next start` :3000, chrome-headless-shell + Playwright)

Skrip: `verification/sheet-tour3-fix-probe.mjs`
(`node verification/sheet-tour3-fix-probe.mjs <tag> [click|keys]`).
Profil fresh (tanpa `ss.tour`), viewport 390×844 portrait, template `#template-code`.

### Baseline (sebelum perbaikan — direproduksi dulu)

| Skenario | `.tour-spot` akhir | `.inspector` |
|---|---|---|
| Lanjut 3×, pertama kali | `{x:4, y:810, w:378, h:26}` — strip, SALAH (6 dtk tidak pernah membaik) | `y=428, h=768` (Half, settle) |
| Masuk ulang (Kembali → Lanjut) | `{x:4, y:422, w:378, h:414}` — benar | `y=428` |

Bukti: `verification/sheet-tour3-baseline.json` (+ `baseline2`, `debug1`).

### Sesudah perbaikan

| Skenario | `.tour-spot` akhir | `.inspector` | State benar sejak |
|---|---|---|---|
| Lanjut 3× (klik tombol), pertama kali | **`{x:4, y:422, w:378, h:414}` ✓** | `y=428, h=768` | ~667ms sesudah masuk langkah 3 |
| ArrowRight 3× (cara verifikator b4c), pertama kali | **`{x:4, y:422, w:378, h:414}` ✓** | `y=428, h=768` | ~1,4 dtk sesudah masuk langkah 3 (compositor lebih lambat di run ini) |
| Masuk ulang (Kembali → Lanjut), kedua varian | **`{x:4, y:422, w:378, h:414}` ✓** | `y=428` | langsung |

Nilai `{y:422, h:414}` = nilai yang sama persis dengan pembanding
"masuk ulang" verifikator (yang sudah benar) — sorotan kini menutupi bagian
kelihatan inspector (sheet Half, `y=428`, dijepit viewport: `422 = 428−6`,
`414 = 836−422`). **0 console error / 0 pageerror di semua run.**

Bukti: `verification/sheet-tour3-fix-390.png` (screenshot pertama kali,
klik), `verification/sheet-tour3-fix-reentry-390.png`,
`verification/sheet-tour3-fix.json`, `verification/sheet-tour3-fix-keys-390.png`,
`verification/sheet-tour3-fix-keys.json`.

### Regresi singkat (skrip `verification/tour-all-steps-check.mjs`)

Seluruh 5 langkah tur, tiap langkah ditunggu 2,5 dtk lalu dibandingkan
sorotan vs target:

- **390px:** langkah 0 drawer ✓, 1 viewer ✓, 2 timeline ✓,
  3 inspector `{y:422, h:414}` = nilai harapan ✓ (kriteria "menutupi"
  penuh tidak berlaku karena inspector 768px menjulur ke bawah viewport —
  sorotan dijepit viewport, sesuai desain `tourPlace`),
  4 perintah cepat ✓. 0 pageerror.
- **1440px (desktop, `sheetMode` off):** semua 5 langkah menutupi target ✓.
  0 pageerror.

### Build

`npm run build` **HIJAU** — `✓ Compiled successfully`, typecheck + lint
lolos, route `/` 49.5 kB / First Load JS 152 kB (sama seperti sebelum fix).

## Yang belum diuji

- **Tablet/perangkat nyata** — wajib cek ulang di tablet seperti diminta
  F1 (transisi .28 dtk di perangkat; headless membuktikan mekanisme
  settle-nya benar, tapi timing visual di perangkat tetap perlu dilihat).
- Keyboard fisik + safe-area/notch iPhone (di luar scope F1).
- Perilaku tur bila pengguna men-drag sheet di tengah langkah 3 (di luar
  scope; tidak berubah dari sebelumnya).
