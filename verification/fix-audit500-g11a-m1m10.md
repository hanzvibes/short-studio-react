# Perbaikan Audit-500 — Kelompok G11a (polish MINOR M1–M10)

- **Repo:** `hanzvibes/short-studio-react` — main `119cad8c` (dinyatakan koordinator; tidak bisa
  diverifikasi lokal karena tidak ada `.git` di project dir).
- **Tanggal:** 2026-11-19. **Status: 10/10 item selesai** (M7 terbukti sudah hilang di G3,
  tanpa perubahan kode; M1–M6, M8–M10 diperbaiki dan terverifikasi headless).
- **Laporan audit (read-only, tidak disentuh):** `verification/audit-500-2026-11-18.md`.
- **Harness + data mentah (internal, di luar repo):** `~/workspace/g11a/`
  (`harness.mjs`, `repro.mjs`, `repro-before.json`, `repro-after.json`,
  `verify2.mjs/json`, `verify3.mjs/json`, `verify4.mjs/json`, `verify5.mjs/json`).
- **Screenshot:** `verification/fix-audit500-g11a-m1m10-before-*.png` (12) dan
  `verification/fix-audit500-g11a-m1m10-after-*.png` (12).

## Verifikasi umum

| Pemeriksaan | Hasil |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | hijau |
| `node scripts/sync-check.mjs` | **SEMUA HIJAU** — 12/12 template byte-identik lib == mjs (modul + CLI + alias array); vendor three.js 12/12 rewrite, 13/13 file |
| Headless repro sesudah (`node repro.mjs after`, server port 3321) | selesai, **0 page error** (`pageErrors=0`) |
| Baseline fresh load 12/12 sesudah | **0 error, 0 warning** di semua template (sebelum: 0 error, 0 warning — kecuali Bug Hunter 3 warning "mepet", kini 0; lihat M10) |
| Regresi edit→Terapkan→reload (verify5, 6 kasus) | **6/6 bertahan** sesudah reload (lihat § Regresi) |
| Template `public/templates/` | **tidak disentuh** — mtime tetap 2026-11-17 08:19 (12/12 file) |
| File audit + bukti G1–G10 | **tidak disentuh.** Catatan: mtime `audit-500-2026-11-18.md` adalah 2026-11-19 05:02 UTC (12:02 WIB) — sebelum penugasan G11a (18:23 WIB), bukan oleh kelompok ini |
| Push / branch / merge | **tidak dilakukan** (koordinator yang push) |

## M1 — Judul kosong diam-diam kembali ke judul asli

- **Keputusan:** perilaku preview TIDAK diubah (judul kosong tetap memakai judul asli saat
  diterapkan — itu sudah benar). Yang ditambah: **hint di bawah field** yang dikosongkan.
- **Sebelum (Versus):** kosongkan Judul → Terapkan nonaktif, status "Tidak ada perubahan…",
  tidak ada pesan "kosong" di mana pun di pane Teks (`adaPesanKosong: false`).
- **Sesudah:** hint muncul di bawah field: **"Dikosongkan — saat diterapkan dipakai teks asli."**
  (`adaPesanKosong: true`). Berlaku untuk field `title`/`sub`/`end` di semua 12 template
  (hint dirender bila `!fields[k].trim()`).
- **Bukti lanjutan:** isi "G11A JUDUL" → Terapkan → kosongkan → Terapkan: field tetap `""`,
  preview kembali ke judul asli (`"Claude vs Codexsiapa model terbaik?"`) — perilaku lama
  yang benar dipertahankan.
- **File:** `components/Studio.tsx:3610-3614` (hint di pane Teks).
- **Screenshot:** `…-after-m1-versus-judul-kosong.png` (hint terlihat di bawah field Judul;
  field kosong menampilkan placeholder judul asli, counter 0/60).

## M2 — Pesan error tampil dua kali

- **Keputusan:** hapus duplikat di ringkasan bawah pane; error tetap tampil SATU kali di
  baris kontrolnya. Di pane Objek, ringkasan hanya menampilkan error yang BELUM tampil di
  baris mana pun (error cek-silang seperti `typing jendela #…`, `meeting.end …`).
  Baris status "Ada N error validasi" adalah hitungan, bukan duplikat — dipertahankan.
- **Caption (Versus, mulai caption #1 = 10, selesai 6):** sebelum 4 node `.valid-err` untuk
  2 pesan (tiap pesan ×2) → **sesudah 2 node, tiap pesan 1×, duplikat []**.
- **Objek (Bug Hunter, segmen 1 baris ketik dikosongkan):** error
  `"typing.lines baris 1: tiap baris harus teks 1..200 huruf."` tampil **1 node, duplikat []**
  (verify2, selector benar — lihat catatan probe di bawah).
- **File:** `components/Studio.tsx` — hapus `{shotVal.errors.map…}` (~3714) dan
  `{capVal.errors.map…}` (~3805, warning ringkasan dipertahankan); `propSummaryErrors`
  memo (~1927) + dipakai di ringkasan Objek (~3904).

## M3 — Kontrol array/kode mentah + pesan error mesin JS

### Yang diganti total dengan editor terstruktur (5 kontrol)

| Kontrol | Template | Editor baru (`components/Studio.tsx`) | Isi |
|---|---|---|---|
| `typing.lines` | Bug Hunter, Bom, Rapat | `ObjTypingLines` (~577) | tiap baris = 1–4 potong teks; baris baru `"$ "`, potongan baru `" "` (keduanya lolos validator 1..200 huruf) |
| `screen.chat` | Rapat | `ObjChat` (~640) | per baris: detik (slider), nama ≤12, pesan ≤80, warna select (Oranye/Biru/Kuning/Hijau/Merah, nilai simpanan tetap `ORG/BLU/YEL/GRN/RED`) |
| `war.catapults` | Perang | `ObjCatapults` (~700) | per tembakan: pihak (Maskot oranye/biru), waktu, lama, tujuan kiri-kanan/tinggi/depan-belakang. Arti kolom dari `template-perang.html`: e[0]=pihak, e[1]=waktu, e[2]=lama, e[3..5]=tujuan koin |
| `war.button` | Perang | `ObjRgb` (~760) | tepat 4 pemilih warna (RGB 0..1 ↔ hex) |
| `screen.pipeline` | Deploy | `ObjPipeline` (~790) | dua grup "Sebelum gagal" / "Sesudah perbaikan", tiap tahap [mulai, selesai] |

Sesudah: kelima kontrol tidak lagi punya `textarea` JSON (`textarea: null` di semua probe);
header menampilkan jumlah baris/tembakan/warna. Nilai baru yang valid masuk draft lewat
`applyArrayValue`; yang tidak valid ditolak di sana + pesan tampil, draft tidak berubah.
**Regresi:** edit di kelima kontrol (kecuali pipeline/rgb diuji terpisah, lihat § Regresi)
diterapkan dan bertahan sesudah reload (katapel 14.3→5, chat "Pesan regresi G11A",
pipeline 6.4→6.5, typing `"$ echo regresi g11a"`, RGB `#999999`→`#00ff00`).

### Yang tetap mentah, dengan penjelasan + pesan awam (2 kontrol)

| Kontrol | Alasan |
|---|---|
| `rival.notes` (Rival, "Isi catatan tempel") | Bukan di daftar bernama M3; struktur objek terlalu besar untuk kelompok ini (tiap catatan: pengirim, posisi, waktu tampil/sobek, 1–2 baris tulisan). Hint awam sudah ada + ditambah penjelasan isi catatan. |
| `screen.editor` (Bom, "Isi layar editor") | Isi kode, bukan data — tidak ada editor terstruktur yang masuk akal. Hint diperpanjang: "…4 bagian: sebelum alarm, konflik, sesudah hapus tanda, beres. Ubah hanya teksnya — biarkan tanda kurung dan angka waktunya apa adanya." |

### Pesan error JSON diterjemahkan

- **Sebelum (Bom, `"bukan json [["`):** `"Tulisannya tidak bisa dibaca: Unexpected token 'b',
  "bukan json [[" is not valid JSON"` (teks mesin V8).
- **Sesudah (Rival notes, input rusak yang sama):**
  `"Tulisannya tidak bisa dibaca — periksa tanda kurung, koma, dan tanda kutipnya, lalu coba lagi."`
  — tanpa teks mesin; Terapkan tetap ditahan + status "Ada 1 error validasi".
- **File:** `components/Studio.tsx` ~2279 (`handleArrayPropChange`, `catch` tanpa `e`);
  `lib/studio.ts` — 5 nilai `control` baru (`tlines` :2851, `chat` :2109,
  `catapults` :2453, `rgb` :2625, `pipeline` :2074), `CHAT_COLORS` diekspor (:4292);
  `scripts/apply-edit.mjs` cermin yang sama (wajib — `sync-check` membandingkan
  `validateProps` lib vs mjs dan menuntut `applyEdits` byte-identik).

## M4 — Slider ditolak tetap menampilkan nilai yang ditolak

- **Keputusan:** rentang slider statis TIDAK dipersempit (batas efektif itu dinamis, mis.
  |x| ≤ 1.2 − sway; mempersempit ke ±0,75 akan merusak sway=0). Zona mati by-design
  dipertahankan (nilai di luar batas gabungan → pesan + preview tidak berubah).
  Sebagai gantinya, slider yang ditolak validasi gabungan **tidak mengubah draft**:
  slider tetap menampilkan nilai lama + pesan penolakan di barisnya.
  Penolakan hanya bila errornya BARU untuk kontrol itu — bila draft sudah tidak valid,
  geseran diizinkan supaya pengguna bisa memperbaiki (mis. papan skor yang sudah telanjur
  tidak valid bisa digeser turun).
- **Deploy claude.x → 2:** sebelum nilai tampil `2` + error → **sesudah nilai tetap `0`**,
  pesan `"Tidak bisa ke 2.00 — maskot terlalu jauh dari meja — geser mendekat atau
  kecilkan goyangannya. Nilai yang dipakai tetap 0.00."`, Terapkan nonaktif
  ("Tidak ada perubahan…").
- **Versus papan skor → 90:** sebelum nilai tampil `90` + error → **sesudah nilai tetap
  `55`**, pesan `"Tidak bisa ke 90 poin — angka awal ditambah naik-turun tidak boleh
  lebih dari 100. Nilai yang dipakai tetap 55 poin."`, 0 error.
- **Bug Hunter jendela ketik:** slider "Baris 1 mulai" kini dijepit ke kebutuhan ketik
  minimum (`huruf / 27 huruf per detik`): max **6.9 → 5.667**; digeser ke max → nilai
  `5.6`, **0 error, 0 warning** (sebelum: snap-back ke 5.4 + error basi
  "jendela hanya 0.1 dtk — teks akan terpotong").
- **File:** `components/Studio.tsx` — state `sliderRejected` (:889), logika penolakan di
  `setPropValue` (:2110–2139, pesan via `ObjSlider rejected` :3855), `typingMinDurs` memo
  (:1933) + jepitan di `ObjWindows` (:~420–458, `minDur`).

## M5 — Label membingungkan

- **Geser kiri-kanan diberi nama objek (13 def, lib + mjs):** Adu Kode "Layar kecil" kini
  `"Geser kiri-kanan — Monitor Claude"` / `"— Monitor Codex"` (sebelum: dua label identik);
  Tidur keenamnya bernama — Maskot oranye, Layar besar, Bos, Cangkir, Jendela, Lampu
  (sebelum: enam `"Geser kiri-kanan"`); plus Monitor Gemini, Tangki kuota, Keyboard.
  (`lib/studio.ts` :715, :878, :911, :1798, :1816, :1834, :1852, :1904, :1929, :1955, :2220,
  :2258, :2678.)
- **Pembicara per-template:** opsi Codex disembunyikan bila template tidak punya maskot
  biru; opsi 2 berlabel "Gemini" di Trio, "Bersama" di tempat lain. Terverifikasi dari file
  template: caption Bom/Bug Hunter/Tidur/Rapat semuanya pembicara 0; Codex hanya dipakai
  Adu Kode, Kuota, Perang, Rival, Trio, Versus; pembicara 2 hanya di Adu Kode, Perang,
  Rival, Trio, Versus. Hasil: Trio `0=Claude, 1=Codex, 2=Gemini`; Tidur/Bom/Rapat
  `0=Claude, 2=Bersama` (tanpa Codex); Versus tetap `0=Claude, 1=Codex, 2=Bersama`.
  Pengaman: opsi Codex tetap tampil bila ada edit tersimpan yang memakainya.
  Singkatan klip kecil ikut diperbaiki: `"Br"` → `"Ge"` di Trio.
  (`components/Studio.tsx` :1913–1926 `hasCodex`/`hasGemini`/`showCodexOpt`,
  select caption :3775, `spkAbbr` :3510.)
- **Hint warna Tidur:** `"Warna maskot oranye — garis tepi balon katanya ikut berubah."` →
  `"Warna maskot oranye — di sebagian video, garis tepi balon kata ikut berubah."`
  (karena `#cap` tanpa border di sebagian template). (`lib/studio.ts` :1464,
  `scripts/apply-edit.mjs` :1112.)
- **Label shot negatif (viewport 1920, Perang Shot 2 mulai=99):** header edit-shot kini
  `"Shot 2 · -93.6s"` (sebelum `"Shot 2-93.6s"` — tanda minus menempel); klip timeline
  kini `"Kam -2.1 · 2.2 · 5.6"` (sebelum `"Shot 2-2.1 · …"` — minus dikira pemisah).
  (Di `textContent` mentah terbaca `"Shot 2Kam -2.1"` / `"02Shot 2· -93.6s"` karena
  `<b>`/`<small>`/`<span>` bersebelahan tanpa spasi DOM; di screenshot terlihat
  `"Kam …"` sebagai baris kecil terpisah di bawah "Shot 2" dan `"· -93.6s"` di kanan
  header — pemisahnya terbaca.)
  (`components/Studio.tsx` :3693 header, :3487 klip.)
- **Screenshot:** `…-after-m5-shot-negatif-1920.png`.

## M6 — Ketuk-pilih tidak lengkap / salah

- **Trio — zona Codex/Gemini tertukar, diperbaiki:** tengah (0.5, 0.65) → **Maskot biru**
  (Codex, x=0), kanan (0.81, 0.65) → **Maskot ungu** (Gemini, x=+2.6), kiri → Maskot oranye.
  Sebelum: tengah→ungu, kanan→biru. (`components/Studio.tsx` ~148–153, `CLICK_ZONES` trio.)
- **Rapat (t=12):** ketuk cangkir (0.70, 0.69) → **Cangkir**; ketuk jendela (0.12, 0.20) →
  **Jendela**; tengah → Maskot oranye. Sebelum: cangkir→"Maskot oranye" (salah),
  jendela→"Layar besar" (salah). Zona baru (diperiksa berurutan, zona kecil didahulukan):
  jendela (0.04–0.22, 0.08–0.30), cangkir (0.62–0.78, 0.60–0.78).
- **Bom (t=6):** zona baru: jendela (sama seperti Rapat), jam hitung mundur bom
  (0.35–0.65, 0.10–0.22; bidang jam di `(0, 3.75, −2.22)` di `template-bomb.html`),
  cangkir (sama seperti Rapat). Terverifikasi terpisah (debug): ketuk cangkir → **Cangkir**,
  ketuk jendela → **Jendela**, ketuk jam (0.5, 0.15) → **Bom**. Tiga ketuk lain di probe
  5-titik (`kiri-bawah`, `kanan-tengah`, `kiri-tengah`) membaca "Bom" — itu **seleksi
  sebelumnya yang bertahan** (ketuk di area tanpa zona tidak mengubah pilihan, perilaku
  lama yang sudah benar), bukan pilihan salah.
- **Lampu tidak diberi zona (Rapat + Bom):** di kedua template lampu hanya `SpotLight`,
  tanpa mesh yang terlihat (`template-meeting.html:97`, `template-bomb.html:98`) — tidak
  bisa dipetakan andal; dicatat, bukan ditebak. "Tulisan yang diketik" tampil DI layar —
  ikut zona layar, tanpa zona sendiri.
- **File:** `components/Studio.tsx` ~186–207 (`CLICK_ZONES` Bom/Rapat).
- **Screenshot:** `…-after-m6-rapat-setelah-ketuk.png` (kartu "Sedang mengedit: Maskot oranye",
  label slider "Geser kiri-kanan — Maskot oranye"), `…-after-m6-trio-*.png`,
  `…-after-m6-bom-t6.png`.

## M7 — Status sesudah Kembalikan — SUDAH HILANG DI G3 (tanpa perubahan kode)

- **Hasil:** Caption, Shot, DAN Objek — ketiganya bersih sesudah Kembalikan. **Tidak ada
  perubahan kode untuk M7.**
- **Bukti (verify3 + verify4, dengan tunggu yang benar):**
  - Caption: edit → Kembalikan (tanpa Terapkan) → Terapkan nonaktif + "Tidak ada perubahan…";
    edit → Terapkan → Kembalikan → sama bersihnya. (`resetClicked: true` keduanya.)
  - Shot: sama, keduanya bersih.
  - Objek (Adu Kode, claude.x −1.9; nilai asli −1.7, rentang ±3): edit → Terapkan →
    Kembalikan → Terapkan nonaktif + "Tidak ada perubahan…", slider kembali ke −1.7
    (verify3 apply-reset). Edit → Kembalikan langsung → Terapkan nonaktif +
    "Tidak ada perubahan…" (verify4, `resetBecameEnabled: true`, `resetClicked: true`).
- **Catatan probe (penting, jangan ulangi kesalahan ini):** dua run awal tampak menunjukkan
  M7-Objek masih ada, tapi itu **artefak probe, bukan bug**:
  1. `waitReady` di harness menunggu teks "Preview siap" di body — teks itu TETAP ADA saat
     preview sedang remount (`mount()` tidak mereset teks status), jadi tunggu itu selesai
     seketika dan klik `.click()` mendarat di tombol yang sedang disabled (klik di tombol
     disabled = no-op; Terapkan/Kembalikan tidak jalan, draft tetap kotor).
  2. Tunggu yang benar: poll `.apply-state` sampai bukan "Menunggu preview siap…" — atau
     poll langsung `disabled` tombol yang mau diklik (verify4).
  3. Jebakan yang sama juga membuat pembacaan M7-Objek di repro-before ("Menunggu preview
     siap…" sesaat) — status itu memang sementara saat remount, bukan status akhir.

## M8 — Kontrol tanpa tombol restore per-kontrol

- **Keputusan:** tombol ↺ "Kembalikan ke nilai asli" ditambahkan ke **semua** kontrol warna +
  array — bukan hanya yang disebut audit — supaya tidak ada lagi kontrol yang hanya bisa
  dikembalikan lewat Kembalikan se-tab: `ObjColor`, `ObjJson`, 5 kontrol baru M3, PLUS
  `ObjScores`, `ObjCurve`, `ObjWindows`, `ObjSpawns`, `ObjLines` (yang sudah terstruktur
  tapi belum punya ↺). Tombol hanya muncul sesudah ada perubahan (`changed`), di header
  kontrol. `restoreProp` juga menjadi jalan keluar dari jalan buntu U21: saat isi array
  sedang tidak valid, Kembalikan se-tab nonaktif tepat saat dibutuhkan — ↺ per-kontrol
  memulihkan nilai asli yang selalu lolos validasi.
- **Terverifikasi (verify2, selector benar):**
  - Typing Warna: `#d97757` → ubah `#123456` → ↺ muncul → klik → kembali `#d97757`.
  - Rapat chat: `"Oke, kita mulai ya."` → ubah → ↺ muncul → klik → kembali ke pesan asli.
  - Bom typing: `"$ git diff --name-only --diff-filter=U"` → ubah `"diubah"` → ↺ muncul →
    klik → kembali ke segmen asli.
- **File:** `components/Studio.tsx` — `restoreProp` (:2257), ↺ di `ObjColor` (:~303),
  `ObjScores`/`ObjCurve`/`ObjWindows`/`ObjSpawns`/`ObjLines` (:~345–544),
  `ObjJson` (:~559), 5 kontrol baru M3 (tiap komponen menerima `orig` + `onRestore`),
  wiring pane Objek (:3858–3899).

## M9 — Peringatan durasi shot negatif

- **Keputusan:** durasi negatif kini **ERROR**, bukan warning "potongan sangat cepat".
  `validateShots`: bila shot non-terakhir berakhir sebelum shot berikutnya dimulai
  (`end − start < 0`) → error `"Shot #N: mulai sesudah Shot #N+1 — urutkan dulu."`
  Shot terakhir yang melewati durasi sudah tercakup error "mulai >= durasi" yang ada.
  Warning "potongan sangat cepat" hanya untuk 0 ≤ dur < 0,5 dtk.
- **Sebelum:** Perang Shot 2 mulai=99 → warning `"Shot #2: hanya -93.6 dtk — potongan sangat
  cepat."` (Bug Hunter/Bom serupa, −1.0/−1.8 dtk).
- **Sesudah:** Perang → error `"Shot #2: mulai sesudah Shot #3 — urutkan dulu."`
  (+ error "mulai 99s >= durasi 34s" yang sudah ada), **warnings []**. Bug Hunter Shot 3
  mulai=1.0 dan Bom Shot 3 mulai=1.0 → error yang sama, **warnings []**.
- **File:** `lib/studio.ts` :626, `scripts/apply-edit.mjs` :4343 (cermin).

## M10 — Nilai bawaan memicu peringatan tanpa edit

- **Keputusan:** ambang "mepet" dihitung dengan benar, bukan diturunkan jadi info: warning
  hanya bila jendela kurang dari kebutuhan ketik + **0,05 dtk** (sebelum: +0,3 dtk).
  Kebutuhan ketik = `huruf / 27 huruf per detik` (`TYPE_CPS`, `lib/studio.ts` :3913).
  Slack bawaan Bug Hunter (0,267 / 0,115 / 0,089 dtk) kini di atas ambang; jendela yang
  benar-benar mepet (<0,05 dtk slack) tetap memberi warning. Pesan kini menampilkan
  kebutuhan +0,05.
- **Sebelum (Bug Hunter, baru dibuka, tanpa edit):** 3 warning — `#1: 1,6 dtk — mepet untuk
  36 huruf (butuh ~1,6 dtk)`, `#2 … 32 huruf`, `#3 … 111 huruf`.
- **Sesudah (baru dibuka):** **0 warning, 0 error** — di pane "Tulisan yang diketik" maupun
  pane "Maskot oranye". Baseline fresh load 12/12 kini 0 warning di semua template.
- **File:** `lib/studio.ts` :4773–4779 (`crossCheckProps`), cermin di `scripts/apply-edit.mjs`.

## Regresi (verify5 — edit → Terapkan → reload, penyimpanan dipertahankan)

| Kasus | Sebelum | Sesudah reload | Tersimpan di `ss.edits.v1` |
|---|---|---|---|
| Perang katapel, Tembakan 1 waktu | 14.3 | **5** | `war.catapults[0][1] = 5` |
| Rapat chat, Baris 1 pesan | "Oke, kita mulai ya." | **"Pesan regresi G11A"** | `screen.chat[0][2]` sama |
| Deploy pipeline, Sebelum gagal tahap 1 mulai | 6.4 | **6.5** | — |
| Bug Hunter typing, Baris 1 potongan 1 | `$ grep -rn "500" …` | **`$ echo regresi g11a`** | — |
| Perang tombol, Warna 1 | `#999999` | **`#00ff00`** | — |
| Versus judul (alur inti teks) | "Claude vs Codex" | **"Judul Regresi G11A"** | — |

`pageErrors: 0` di semua run (repro after, verify2–5). Catatan: run pertama verify5
tampak gagal (nilai kembali ke asli sesudah reload) karena `freshLoad` harness
**menghapus localStorage** sebelum reload — artefak probe; diulang dengan reload yang
mempertahankan penyimpanan (`reloadKeep`), 6/6 lolos.

## Catatan probe lain (kejujuran data)

- **M2 Objek di `repro-after.json` tercatat 0 node** — bukan karena tidak ada error, tapi
  karena probe memakai aria-label salah (`"Baris 1 segmen 1"`; yang benar
  `"Baris 1 potongan 1"`), sehingga segmen tidak pernah dikosongkan. Angka yang benar
  adalah verify2: **1 node, duplikat []**.
- **M8 di `repro-after.json` tercatat null** — alasan yang sama (aria-label warna yang
  benar `"Warna"` bukan `"Warna — warna"`; pesan chat `"Baris 1 pesan"` bukan
  `"Pesan baris 1"`). Angka yang benar adalah verify2 (ketiganya ↺ muncul + kembali asli).
- **Restart layanan** di tengah verify3: perintah yang sama dijalankan ulang persis
  (server 3321 ikut mati dan dinyalakan lagi); hasil verify3 yang dilaporkan adalah dari
  run ulang yang selesai. Restart juga menghapus backup `/tmp/*.bak-g11a`, sehingga
  hitungan baris diff vs backup (lib 52 baris, mjs 44 baris, Studio.tsx 611 baris diff,
  dicatat sebelum restart) tidak bisa dihitung ulang — perubahan didokumentasikan lewat
  nomor baris akhir di atas, bukan lewat diff.

## File yang diubah

- `components/Studio.tsx` — CLICK_ZONES Trio/Bom/Rapat (~148–207); `ObjSlider` penolakan
  (~240–274); `ObjColor` ↺ (~282–315); `ObjScores`/`ObjCurve`/`ObjWindows`/`ObjSpawns`/
  `ObjLines` ↺ (~318–557); `ObjJson` ↺ + komentar (~553–575); 5 komponen baru M3
  `ObjTypingLines`/`ObjChat`/`ObjCatapults`/`ObjRgb`/`ObjPipeline` (~577–824);
  state `sliderRejected` (:889); memo `hasCodex`/`hasGemini`/`showCodexOpt`/
  `propSummaryErrors`/`typingMinDurs` (:1913–1940); penolakan slider di `setPropValue`
  (:2110–2139); `restoreProp` (:2257); pesan JSON awam (:~2279); pemisah klip/header shot
  (:3487, :3693); `spkAbbr` (:3510); hint M1 (:3610–3614); hapus ringkasan error shot/caption
  (:3714, :3805); select pembicara (:3775); wiring Objek (:3855–3899, ringkasan
  `propSummaryErrors` :3904).
- `lib/studio.ts` — M9 `validateShots` (:626); M10 ambang "mepet" (:4773–4779); 13 label
  "Geser kiri-kanan — …" (:715, :878, :911, :1798, :1816, :1834, :1852, :1904, :1929,
  :1955, :2220, :2258, :2678); hint `claude.color` (:1464); 5 `control` baru (:2074,
  :2109, :2453, :2625, :2851); hint `rival.notes` + `screen.editor`; `CHAT_COLORS`
  diekspor (:4292).
- `scripts/apply-edit.mjs` — cermin semua perubahan lib (M9 :4343, hint :1112, plains,
  controls, hints) — wajib untuk `sync-check`.

## Yang TIDAK berhasil / tidak dikerjakan

- **Tidak ada.** Semua M1–M10 selesai atau terbukti sudah hilang (M7). Satu-satunya yang
  sengaja tidak diberi zona adalah **lampu di Rapat/Bom** (M6 — hanya SpotLight tanpa
  mesh, tidak bisa dipetakan andal; dicatat di atas, bukan ditebak). `rival.notes` dan
  `screen.editor` sengaja tetap mentah (M3 — alasan di tabel).
