# Desain Bottom Sheet Inspector — Alur HP Satu Layar

**Project:** Short Studio React (`~/workspace/short-studio-react`) · main `7b36e5b9`
**Tanggal:** 2026-11-18 · **Sifat:** laporan AUDIT + DESAIN, read-only (tidak ada file lain yang diubah)
**Sumber yang dibaca:** `components/Studio.tsx` (3003 baris), `app/globals.css` (709 baris),
`lib/studio.ts` (relevan: `OBJECTS`/`PROP_DEFS`/validasi — tidak ada layout di sana),
laporan verifikasi `verification/mobile-verify-2026-11-17.md`,
`verification/landscape-verify-2026-11-17.md`, `verification/mobile-audit-2026-11-17.md`.
**Keputusan Rehan:** di HP/tablet portrait, inspector menjadi **lembaran geser dari bawah
(bottom sheet)** supaya video tetap kelihatan saat mengedit, tanpa scroll halaman bolak-balik.

> **Keputusan timeline (ringkas):** timeline **dilipat menjadi strip seek 72px**
> (header 44px + ruler 28px) di atas sheet, dengan tombol lipat/buka di header-nya.
> Strip tetap bisa scrub/seek + playhead; klik klip shot/caption butuh satu ketukan
> untuk membuka timeline penuh. Alasan lengkap + risiko di §3.

---

## 1. Peta layout saat ini

### 1.1 Struktur DOM (Studio.tsx:2054 dst.)

```
div.app[.drawer-closed][.focus-view]            ← Studio.tsx:2054
├─ header.topbar (48px)                          ← :2055, tombol ☰ #menu, brand, doc, palet, Ekspor
├─ main.workspace#workspace                      ← :2113
│  ├─ aside.panel.media#drawer (Project bin)     ← :2114 — 12 template + Video Buatan Saya
│  ├─ div.scrim (klik → tutup drawer)            ← :2206
│  ├─ section.panel.viewer                       ← :2209
│  │  ├─ div.panel-h (judul comp + chip "Sedang mengedit: X" saat tab Objek + tombol fokus/guides/fullscreen)
│  │  ├─ div.viewer-body > div.viewer-canvas > div.stage#stage > iframe#pv + .stage-hud + .guides + .tap + .state
│  │  ├─ div.now-cap (caption berjalan + timecode)
│  │  └─ div.transport (⏮ −5s −1f ▶/⏸ +1f +5s ⏭ · timecode · loop · mute · zoom viewer)
│  ├─ section.panel.timeline#timelinePanel       ← :2291, style={{height: tlHeight}} (default 264)
│  │  ├─ div.tl-resize (drag ubah tinggi, nonaktif ≤900px)
│  │  ├─ div.panel-h.tl-head (judul + chip timecode + .tl-tools: pilih/snap/zoom/Fit)
│  │  └─ div.tl-body: div.tl-heads (ruler-spacer + V1/T1/A1) + div.tl-scroll > div.tl-content
│  │     (ruler + track shots 60px + track caps 46px + track audio 36px + playhead)
│  └─ aside.panel.inspector                      ← :2479
│     ├─ div.tabs (Teks / Shot n / Caption n / Objek n)   ← :2480–2498
│     ├─ div.panes (scroll internal)             ← :2499
│     │  ├─ pane Teks: field Judul/Subjudul/End card + .insp-stick (Terapkan semua edit #apply,
│     │  │   Kembalikan #reset, Simpan sebagai video baru, apply-state) + prop-list
│     │  ├─ pane Shot: sel-card + daftar .edit-shot + .insp-stick (#apply-shot / #reset-shot)
│     │  ├─ pane Caption: sel-card + daftar .edit-cap + narasi + .insp-stick (#apply-cap / #reset-cap)
│     │  └─ pane Objek: .obj-now ("Sedang mengedit: <nama>") + .obj-pick (grid objek)
│     │     + kontrol slider/warna/teks per prop + .insp-stick (#apply-objek / #reset-objek)
│     └─ div.meta (durasi · shot · caption)
├─ footer.statusbar (28px)
├─ dialog Ekspor / Simpan / Pintasan / Palet (render kondisional)
├─ div.tour (spot + kartu) + div.toast
```

### 1.2 CSS kerangka (`app/globals.css`)

| Aturan | Baris | Isi |
|---|---|---|
| `:root` vars | 5–27 | `--topbar-h:48px; --status-h:28px; --media-w:252px; --insp-w:320px; --tl-h:264px; --h-ruler:28px; --h-shots:60px; --h-caps:46px; --h-audio:36px; --ease:cubic-bezier(.22,.68,.24,1)` |
| `body` | 30 | `overflow:hidden` — halaman TIDAK pernah scroll di desktop |
| `.app` | 45 | `height:100dvh; grid-template-rows: 48px 1fr 28px` |
| `.workspace` | 94 | desktop: `grid-template-columns: 252px 1fr 320px; grid-template-rows: 1fr var(--tl-h); gap:5px; padding:5px` |
| `.media` | 108 | `grid-area:1/1/3/2; z-index:20` (docked, 2 baris) |
| `.viewer` | 133 | `grid-area:1/2/2/3`; `.stage` 137 (9:16, `container-type:inline-size`) |
| `.now-cap` / `.transport` | 177 / 182 | tinggi 24px / 42px (56px di `pointer:coarse`, baris 565–582) |
| `.timeline` | 200 | `grid-area:2/2/3/3`; `.tl-resize` 201 (`z-index:12`) |
| `.inspector` | 291 | `grid-area:1/3/3/4`; `.tabs` 292; `.panes` 298 (`overflow:auto`) |
| `.insp-stick` | 329 | `position:sticky; bottom:0; z-index:3` — Terapkan/Kembalikan/Simpan menempel di bawah `.panes` |
| `dialog` | 381, 619–625 | `z-index:80` (di atas drawer 70, di bawah tour 100) |
| `.tour` / `.toast` | 417 / 433 | `z-index:100` / `z-index:120` |
| `.app.focus-view` | 443–446 | `--tl-h:0`; `.timeline`, `.transport`, `.now-cap` `display:none`; workspace `1fr auto auto` |
| `.scrim` | 449, 454–477 | `display:none` default; hanya `display:block` di `≤1180px` |
| `@media (min-width:1181px)` | 450–453 | `body.drawer-closed` → kolom media `0`, `.media{display:none}` |
| `@media (max-width:1180px)` | 454–477 | `--tl-h:206px`; workspace 2 kolom (`1fr 300px`); `.media` jadi drawer fixed (`left:5px; top:48+5; bottom:28+5; width:278px; z-index:70; translateX(-100%-12px)` saat tutup); `.scrim` aktif (`z-index:65`); `.menubar` hilang |
| `@media (min-width:901px) and (max-height:800px)` | 478–481 | `--tl-h:186px`, track dipadatkan (ruler 26 / shot 52 / cap 40 / audio 32) |
| `@media (min-width:901px) and (max-height:640px)` | 482–484 | `--tl-h:170px` |
| `@media (max-width:900px)` | 485–523 | **pita portrait/tablet — titik sentuh utama desain ini** (lihat §1.3) |
| `@media (max-width:600px)` | 524–551 | `.panes{max-height:none}`; zoom timeline disembunyikan; `.tl-body` 112px; `.t-center` hilang |
| `@media (max-width:400px)` | 552–558 | `.tl-body` 100px; brand hilang |
| `@media (max-width:900px) and (max-height:500px)` | 559–563 | HP landscape: baris viewer `max(250px,52dvh)` |
| `@media (pointer:coarse)` | 565–600 | target sentuh 44px (`.tb-icon/.tbtn/.tool/.tab/.btn/.play` 44px; `.panel-h` 44px di `≤1180px`) |
| `@supports (-webkit-touch-callout:none)` | 601 | input/textarea 16px di iOS (mencegah auto-zoom keyboard) |
| `prefers-reduced-motion` | 603 | semua transisi/animasi `0.001ms` |

### 1.3 Yang berlaku di portrait (pita `≤900px`, globals.css:485–523)

- `.workspace`: **satu kolom**, `grid-template-rows: max(340px,58dvh) auto auto`,
  `overflow-y:auto` — ini satu-satunya mode di mana halaman bisa di-scroll
  (di desktop `body{overflow:hidden}` dan workspace tidak scroll).
- Urutan vertikal: viewer (baris 1) → timeline (baris 2, `max-height:none`, tinggi
  mengikuti inline `tlHeight` = 264px default) → inspector (baris 3, `min-height:330px`).
- `.inspector .panes{max-height:400px}` (di `≤600px` menjadi `none`, baris 548).
- `.tl-resize{display:none}` — tinggi timeline tidak bisa di-drag di sini.
- `.stage-hud{display:none}`; `.now-cap` 22px; `.transport` 40px (56px bila `pointer:coarse`).
- `.tl-body{grid-template-columns:140px 1fr}` (112px di `≤600px`, 100px di `≤400px`).

### 1.4 Geometri terukur (viewport portrait, dari laporan verifikasi)

Angka stage 390/768 **terukur** (`mobile-verify-2026-11-17.md`,
`landscape-verify-2026-11-17.md`); angka 834 **dihitung** dari rumus `fitStage`
dan tervalidasi karena rumus yang sama mereproduksi 390/768 dalam selisih 1–2px.

| Ukuran | 390×844 | 768×1024 | 834×1112 |
|---|---|---|---|
| Baris viewer (`max(340,58dvh)`) | 489,5px | 593,9px | 645px |
| Stage (9:16, terukur/dihitung) | **197×350** | **255×454** | **≈285×507** (hitung) |
| Timeline (panel, `tlHeight` 264) | y 546–810 | y 650–914 | y 701–965 |
| Baris tab inspector | y 815–870 (tinggi 47) | y 919–974 | y 970–1025 |
| Inspector | min 330px, `.panes` max 400px (≤600px: tanpa batas) | sama | sama |
| Halaman scroll? | **Ya** — konten ≈1090px vs ruang workspace 768px → scroll ≈320px | **Ya** — ≈1196 vs 948 → scroll ≈250px | **Ya** — ≈1240 vs 1036 → scroll ≈200px |
| Drawer saat load | tertutup (`body.drawer-closed`, off-canvas x −286) | tertutup | tertutup |
| Topbar / statusbar | 48px / 28px (status tengah disembunyikan ≤600px) | 48px / 28px | 48px / 28px |

**Konsekuensi hari ini (masalah yang diminta Rehan):** untuk mengedit, pengguna harus
scroll ke bawah ±200–320px sampai inspector kelihatan — dan saat itu stage sudah
keluar dari viewport sepenuhnya. Tidak ada cara melihat video sambil mengedit.
Sebaliknya saat menonton (scroll atas), tombol Terapkan tidak terjangkau.

### 1.5 Cara kerja yang relevan

- **`fitStage`** (Studio.tsx:713–728): mengukur `.viewer-canvas`, `padPx = 8` bila
  `innerHeight ≤ 640` atau `innerWidth ≤ 900`; `h = min(availH, availW·16/9)`,
  dikali `vZoom`; menulis `stage.style.width/height` inline. Dijalankan ulang pada
  `resize` (:749–752) dan saat `drawerOpen / ready / focusView` berubah (:727–730).
  **Implikasi:** sheet yang mengubah tinggi `.viewer-canvas` (karena menutupi
  workspace) HARUS memanggil `fitStage()` sesudah snap selesai — kalau tidak,
  stage tetap berukuran lama dan bisa meluber/terpotong.
- **Drawer** (Studio.tsx:738–746 + CSS 450–477): state `drawerOpen` (default `true`,
  tapi tersimpan `ss.drawer` hanya bila lebar >1180px) disinkronkan ke
  `body.drawer-open / drawer-closed`. Di `≤1180px` drawer adalah panel fixed
  off-canvas + `.scrim` (`z-index:65`, klik → tutup). Di `≥1181px` drawer docked
  (kolom grid) dan tidak ada scrim. Memilih template di `≤1180px` otomatis menutup
  drawer (:2143: `if (window.innerWidth <= 1180) setDrawerOpen(false)`).
- **Mode fokus viewer** (Studio.tsx:571, :2217; CSS 443–446): `focusView` (session-only,
  tidak disimpan) menyembunyikan timeline + transport + now-cap; keluar via tombol
  yang sama atau **Esc** (:1993–1996: Esc keluar dari fokus dulu, baru menutup drawer).
  Stage 1366×768: 187×333 normal → **334×594 fokus** (terukur).
- **State editor** (Studio.tsx:485–584, 690–700, 1133–1255):
  - Tab: `tab: "teks" | "shot" | "cap" | "objek"` (:556); `sel: {kind:"shot"|"cap", i} | null`.
  - Draft vs asli: `fields/def/applied` (teks), `draftCaps/origCaps/appliedCaps`,
    `draftShots/origShots/appliedShots`, `draftVO/origVO`, `draftProps/origProps/appliedProps`,
    `selObj` (objek aktif, default objek pertama template — :1186–1187 `activeObjKey`).
  - `anyDirty` (:1195–1197) = teks ATAU caption ATAU shot ATAU props ATAU VO berubah
    dari baseline *terakhir diterapkan* (bukan dari asli).
  - `applyAll()` (:1228–1252): satu tombol untuk SEMUA tab; disabled bila
    `!ready || !anyDirty || allErrors.length > 0`; `applyStateText` (:1218–1223)
    menjelaskan status ("Tidak ada perubahan…" / "Ada N error…" / "Siap diterapkan: …").
    Ada **4 tombol Terapkan** di DOM (satu per pane: `#apply`, `#apply-shot`,
    `#apply-cap`, `#apply-objek`, baris 2535/2635/2727/2817) — semuanya memanggil
    `applyAll` yang sama; begitu pula 4 tombol Kembalikan (`resetText/resetShots/
    resetCaps/resetProps`). `Ctrl/⌘+Enter` juga memanggil `applyAll` (kecuali saat
    mengetik di field, kecuali Enter polos di input Teks yang juga apply — :2515–2527).
  - "Sedang mengedit: `<nama objek>`" tampil di **dua** tempat: chip di panel-h viewer
    (:2211–2216, hanya saat `tab === "objek"`) dan `.obj-now` di pane Objek (:2737–2749).
  - Klik klip timeline → `selectClip` (:1581–1590) otomatis **pindah tab**
    (shot → tab Shot, cap → tab Caption) + seek ke awal klip.
  - Ketuk objek di preview (tab Objek saja, :756–771): bridge iframe mengirim
    `__stClick {x,y}` → `pickObjAt` (zona per template, :135–177) → `setSelObj`.
  - **Tidak ada** penanganan keyboard virtual hari ini: tidak ada `visualViewport`,
    tidak ada `scrollIntoView` untuk field inspector (satu-satunya `scrollIntoView`
    di file adalah untuk daftar Video Buatan Saya, :1423). Satu-satunya pelindung
    adalah font input 16px di iOS (globals.css:601) supaya keyboard tidak men-zoom halaman.
- **Tour** (Studio.tsx:1825–1875; CSS 417–432): 5 langkah, target
  `#drawer` → `.viewer` → `.timeline` → `.inspector` → `.tb-actions`;
  `tourPlace` mengukur `getBoundingClientRect()` target dan menaruh kartu 330×170
  di sekitarnya; langkah 0 membuka drawer dulu bila tertutup (lalu menutupnya lagi
  saat lanjut). Kartu tour `z-index:100`, di atas semua panel.
- **`lib/studio.ts`**: murni logika data — `TEMPLATES`, `OBJECTS`, `PROP_DEFS`
  (251 slot / 107 id unik), `parse*/set*/validate*`, `applyEdits`. **Tidak ada
  layout/state UI di sini; tidak perlu diubah** untuk fitur ini.
- **Z-index hari ini:** `.inspector` 2 (≤900px) · `.tl-resize` 12 · `.media` 20 ·
  `.topbar` 40 · `.scrim` 65 · `.media` (drawer fixed) 70 · `dialog` 80 ·
  `.menu-pop` 90 · `.tour` 100 · `.toast` 120.

---

## 2. Desain bottom sheet (spesifikasi implementasi)

### 2.1 Kapan sheet aktif

- **Hanya portrait `≤900px`**: kondisi `window.innerWidth <= 900 && window.innerHeight > window.innerWidth`
  (JS, `matchMedia("(max-width: 900px) and (orientation: portrait)")` + listener).
  Di luar itu (desktop, tablet landscape, HP landscape 844×390) layout **tetap seperti hari ini**.
- Di dalam mode itu, `.inspector` **tidak lagi** menempati baris ke-3 grid — ia menjadi
  sheet fixed (lihat §2.2). Baris ke-3 grid mengecil ke 0 karena kosong.
- Default saat masuk mode sheet (load portrait / rotasi ke portrait): snap **peek**.
  Session-only seperti `focusView` — **jangan** disimpan ke localStorage
  (pengguna yang membuka di desktop tidak boleh mendapati sheet saat kembali ke HP).

### 2.2 Geometri & snap

Sheet: `position:fixed; left:0; right:0; bottom:calc(var(--status-h) + env(safe-area-inset-bottom, 0px))`
— statusbar 28px **tetap kelihatan** di semua snap (status "Preview siap" + jam tidak tertutup);
`border-radius:16px 16px 0 0` di tepi atas; `background:var(--panel)` + `border-top:1px solid var(--line-2)`
+ bayangan atas `0 -8px 24px rgba(0,0,0,.35)`; `z-index:75` (lihat §2.5).
`env(safe-area-inset-bottom)` wajib — tanpa itu gagang/tombol di iPhone ber-notch
tenggelam di home indicator.

| Snap | Tinggi sheet | Isi yang kelihatan | Kapan dipakai |
|---|---|---|---|
| **Peek** (default) | **148px** | gagang 20px + header 56px + tab 44px + 28px cuplikan konten (field pertama) | Menonton sambil siap mengedit; **stage utuh 100%** di semua lebar (§2.6) |
| **Half** | `min(46dvh, 480px)` | header + tab + ±268px area scroll (390px) | Mengedit sambil tetap melihat video |
| **Full** | `calc(100dvh - 76px)` (di bawah topbar, di atas statusbar) | header + tab + area scroll penuh | Mengedit serius (daftar caption/shot panjang, textarea) |
| **Closed** | 0 (sheet `translateY(100%)`, tidak di-render secara visual) | — | Menonton saja; dibuka lagi lewat FAB (§2.4) |

Rincian 148px peek: gagang 20 + header 56 + tab 44 (tinggi tab coarse, globals.css:583–600)
+ 28 cuplikan = 148. Half 390×844 = 388px (46dvh), 768×1024 = 471px, 834×1112 = 480px (cap).
Full 390×844 = 768px, 768×1024 = 948px, 834×1112 = 1036px.

**Cara menganimasikan (wajib):** render sheet **selalu setinggi Full** dan gerakkan dengan
`transform: translateY(fullH − snapH)` — bukan menganimasikan `height`. Ini membuat drag
1:1 mengikuti jari tanpa reflow, dan `.panes` tidak perlu diukur ulang tiap frame.
Saat drag: `transition:none`, `transform` mengikuti pointer; saat lepas: kembalikan
`transition: transform .28s var(--ease)` lalu snap ke posisi terdekat
(ambil snap dari posisi lepas + kecepatan: fling ke atas/bawah ≥0,5 px/ms lompat satu snap).
`prefers-reduced-motion` sudah mematikan transisi global (globals.css:603) — jangan timpa.

### 2.3 Gagang tarik & header (selalu kelihatan)

- **Gagang:** area sentuh `height:20px` selebar sheet; indikator visual `width:36px; height:4px;
  border-radius:2px; background:var(--faint)` di tengah; `touch-action:none` (drag dimulai di sini).
  Wajib `cursor:grab` di pointer halus (tidak berpengaruh di sentuh).
- **Header** (`height:56px`, `display:flex`, `align-items:center`, `gap:8px`, `padding:0 8px 0 12px`,
  `touch-action:none` — drag dari header juga sah, seperti gagang):
  - Tombol **putar/jeda mini** (44×44, ikon ▶/⏸ yang sama dengan transport) — supaya video
    tetap bisa diputar saat sheet Full menutupi transport. Memanggil `toggle()` yang sudah ada.
  - **Judul konteks** (flex 1, ellipsis 1 baris) — per tab:
    - Objek → `Sedang mengedit: <nama objek>` (sama persis dengan `.obj-now`, Studio.tsx:2742)
      + ikon objek; bila belum ada objek: `Pilih objek untuk diedit`.
    - Teks → `Edit teks — <label template>`; Shot → `Shot <N> terpilih` (atau `Edit shot`
      bila belum ada seleksi); Caption → `Caption #<N>` (atau `Edit caption`).
    - Titik dirty: tampilkan dot biru (8px, `var(--accent)`) di samping judul bila `anyDirty`.
  - Tombol **Terapkan** (`.btn.primary`, tinggi 44px, label `Terapkan` saja — bukan
    "Terapkan semua edit" karena lebar): **cerminan** dari tombol Terapkan di `.insp-stick`,
    bukan pengganti. Disabled state **identik**: `!ready || !anyDirty || allErrors.length > 0`,
    `onClick={applyAll}`, `title="Terapkan semua edit (Ctrl+Enter)"`. Alasan cerminan:
    keempat `#apply*` yang sudah ada dipakai verifikasi/test dan harus tetap hidup;
    header hanya jalan pintas yang selalu kelihatan.
  - Tombol **tutup/ciutkan** (chevron bawah `⌄`, 44×44, `aria-label="Ciutkan sheet"`):
    Full → Half → Peek → Closed (satu langkah per ketukan).
- **Yang TIDAK masuk header:** Kembalikan (tetap di `.insp-stick` tiap pane — reset
  tidak boleh satu ketukan dari jangkauan jempol tanpa konteks), "Simpan sebagai video
  baru" (tetap di pane Teks), `.meta` (**disembunyikan dalam mode sheet** — isinya
  duplikat prop-list Teks + chip timecode timeline).
- Di bawah header: `.tabs` seperti biasa (44px di coarse), lalu `.panes` sebagai
  satu-satunya area scroll (`overscroll-behavior:contain; touch-action:pan-y` —
  supaya scroll konten tidak menarik sheet, dan sebaliknya).
- `.insp-stick` **tetap** seperti hari ini (sticky bottom di dalam `.panes`) —
  Terapkan/Kembalikan/Simpan di ujung konten tetap ada; header hanya duplikat Terapkan.

### 2.4 Cara buka / tutup

| Aksi | Hasil | Catatan implementasi |
|---|---|---|
| Drag gagang/header ke atas/bawah | Snap ke peek/half/full/closed terdekat (posisi + kecepatan) | `pointerdown` → `setPointerCapture`, `pointermove` → update `transform`, `pointerup` → snap; `touch-action:none` hanya di gagang+header, **jangan** di `.panes` |
| Ketuk header (bukan tombolnya) | Peek ↔ Half | Toggle; Full → Half |
| Swipe ke bawah cepat (fling) dari header/gagang | Turun satu snap; dari Peek → Closed | Ambang kecepatan ±0,5 px/ms |
| Tombol chevron `⌄` | Turun satu snap per ketukan | Sampai Closed |
| **Esc** (keyboard/tablet) | Full → Half → Peek → Closed, berurutan | Sisipkan **sebelum** cabang `focusView`/drawer di handler Esc (Studio.tsx:1993–1996). Urutan tutup: dialog/palet > tour > **sheet** > focus-view > drawer |
| Tombol **Edit (FAB)** saat Closed | Buka ke Peek | FAB: tombol pil `✎ Edit` 56px tinggi, `position:fixed; right:16px; bottom:calc(28px + 16px + safe-area)`, `z-index:75`, `box-shadow` panel; hanya tampil bila `sheetMode && snap==="closed"`. Tanpa FAB, inspector tidak bisa dibuka lagi (tab-nya ikut tertutup) |
| Klik klip di timeline | Buka sheet ke **Half** + pindah tab (perilaku `selectClip` yang sudah ada, :1581–1590) | Bila sheet Closed dan pengguna mengetuk klip shot/cap, sheet harus terbuka — kalau tidak, pane yang dipilih tidak kelihatan |
| Ketuk objek di preview (tab Objek) | Buka sheet ke **Half** bila Closed; bila sudah terbuka, snap tidak berubah | Hanya ubah `selObj` seperti hari ini (:756–771) + buka bila Closed |
| Buka drawer (☰) | **Tutup sheet** (snap → Closed, draft tetap di state — tidak hilang) | Dua overlay setinggi penuh tidak boleh berebut layar; menutup drawer **tidak** membuka sheet kembali |
| Masuk focus-view | **Tutup sheet** (saling eksklusif, seperti drawer vs focus-view hari ini) | Tombol fokus di panel-h viewer tetap satu-satunya jalan masuk; keluar focus-view **tidak** membuka sheet kembali |
| Rotasi ke landscape / lebar >900px | Keluar dari mode sheet: inspector kembali ke baris grid (posisi semula) | Listener `matchMedia` — pastikan `transform`/kelas sheet dibersihkan total, lalu `fitStage()` |

### 2.5 Z-index vs drawer / scrim / dialog

Tumpukan yang diusulkan (hanya sheet yang baru; sisanya tidak berubah):

```
.inspector (in-flow, ≤900px)      z 2     (tetap — sheet menimpanya hanya dalam mode sheet)
.tl-resize                        z 12    (tetap)
.media docked                     z 20    (tetap)
.topbar                           z 40    (tetap)
.scrim                            z 65    (tetap)
.media drawer fixed               z 70    (tetap)
.sheet (inspector mode sheet)      z 75    ★ BARU — di atas drawer, di bawah dialog
.sheet FAB                         z 75    ★ BARU (sama dengan sheet)
dialog                            z 80    (tetap)
.menu-pop                         z 90    (tetap)
.tour                             z 100   (tetap)
.toast                            z 120   (tetap)
```

- **Sheet TIDAK pakai scrim** di snap mana pun: area di atas sheet (viewer + strip
  timeline) harus tetap bisa diketuk/diseret — scrim justru akan mematikan
  "video tetap kelihatan + tetap bisa di-seek" yang menjadi tujuan fitur ini.
  Di Full, yang tertutup hanya workspace; topbar tetap di atas sheet dan bisa dipakai.
- Drawer vs sheet tidak pernah tampil bersamaan (§2.4: buka drawer menutup sheet),
  jadi angka 75 vs 70 hanya pengaman bila ada balapan state.
- Dialog Ekspor/Simpan (z 80) tetap di atas sheet — benar, karena "Simpan sebagai
  video baru" dipicu dari dalam sheet dan dialognya harus tampil di atasnya.
- Tour (z 100) tetap di atas sheet. Tapi `tourPlace` (Studio.tsx:1827–1875) harus
  diperluas: langkah 3 (`.inspector`) — bila sheet Closed, buka dulu ke Half
  (pola yang sama dengan langkah 0 yang membuka drawer), ukur ulang sesudah transisi
  `.28s`; langkah 2 (`.timeline`) — ukur strip 72px bila timeline terlipat, atau
  buka lipatan dulu (lihat §3). Tanpa ini sorotan tour menunjuk area kosong.

### 2.6 Bukti angka: video tetap kelihatan

Rumus ruang vertikal portrait = `topbar 48 + baris viewer + strip timeline 72 + sheet + statusbar 28`
harus ≤ tinggi viewport agar stage utuh tanpa scroll.

| Lebar | Peek (148) | Half | Full |
|---|---|---|---|
| 390×844 | 48+489,5+72+148+28 = **785,5 ≤ 844 ✓** (sisa 58px) | sheet top y≈428 → stage 105–455 kelihatan **≈323/350 = 92%** | stage tertutup penuh (by design) |
| 768×1024 | 48+593,9+72+148+28 = **889,9 ≤ 1024 ✓** | stage kelihatan **≈92%** | tertutup (by design) |
| 834×1112 | 48+645+72+148+28 = **941 ≤ 1112 ✓** | stage kelihatan **≈98%** | tertutup (by design) |

Di Peek, stage **100% kelihatan di ketiga lebar** — target Rehan tercapai pada snap default.
Di Half, ≥92% stage kelihatan (bagian bawah frame yang tertutup hanya ujung bawah video).
Di Full, video memang tidak kelihatan — itu trade-off yang disengaja untuk daftar edit
panjang; tombol putar/jeda mini di header (§2.3) menjaga audio/preview tetap jalan
tanpa harus mengecilkan sheet.

### 2.7 Keyboard virtual — kolom teks tidak boleh ketutup

**Masalah hari ini:** tidak ada penanganan sama sekali (§1.5). Di iOS, keyboard menutupi
viewport tanpa mengubah `window.innerHeight` (layout viewport tetap) — mendengarkan
`window.resize` saja **tidak cukup**. Di Android Chrome, keyboard mengecilkan
`visualViewport` dan (tergantung `interactive-widget`) kadang juga layout viewport.

**Mekanisme yang diusulkan (wajib, tiga lapis):**

1. **Sumber kebenaran = `window.visualViewport`** (didukung iOS 13+, Android Chrome):
   ```text
   effect: dengarkan visualViewport "resize" + "scroll".
   kbH = window.innerHeight - visualViewport.height - visualViewport.offsetTop
   keyboardTerbuka = kbH > 120
   simpan ke state: vvH = visualViewport.height (untuk CSS var --vv-h)
   ```
   Bila `visualViewport` tidak ada (fallback browser lama): pakai `window.resize` +
   `window.innerHeight < tinggi awal − 120` sebagai pendekatan.
2. **Sheet naik + mengecil mengikuti keyboard:**
   - Saat keyboard terbuka dan snap Peek → **naik otomatis ke Half** (Peek 148px
     terlalu pendek untuk field + keyboard).
   - Tinggi sheet efektif = `min(snapH, var(--vv-h) − 76px)` — 76px = topbar 48 + statusbar 28 —
     supaya puncak sheet tidak pernah masuk ke balik keyboard.
   - Saat keyboard tertutup → **kembalikan snap sebelumnya** (simpan di ref `prevSnapRef`
     sebelum naik; jangan paksa ke Peek bila pengguna tadinya di Full).
   - `bottom` sheet tetap `calc(28px + safe-area)` — keyboard menempel di bawah
     statusbar secara visual; sheet tidak perlu bergeser ke atas keyboard, cukup
     dipendekkan (karena `bottom` sheet berada di bawah area `visualViewport`).
3. **Field yang difokuskan di-scroll ke tengah area kelihatan:**
   - `focusin` di dalam sheet (capture): bila target `input/textarea/select` dan
     keyboard terbuka → `target.scrollIntoView({ block: "center", behavior: "smooth" })`
     **di dalam `.panes`** (scroll container sheet, bukan `document` — scroll dokumen
     tidak ada artinya karena `body{overflow:hidden}`).
   - Ulangi sekali sesudah 350ms (keyboard iOS naik dengan animasi; posisi akhir
     baru stabil sesudahnya) — atau dengarkan `visualViewport.resize` kedua dan
     scroll lagi bila field masih di bawah `visualViewport.height`.
   - Perhatian: `scrollIntoView` di dalam `.panes` harus memperhitungkan `.insp-stick`
     (sticky bottom ±90px) — pakai `block:"center"` agar field tidak berakhir tepat
     di balik bar Terapkan.
4. **Pelindung yang sudah ada — jangan dihapus:** font input 16px di iOS
   (globals.css:601) mencegah auto-zoom saat fokus; bila font dikecilkan di bawah 16px,
   iOS akan men-zoom dan seluruh hitungan `visualViewport` di atas bergeser.
   **Yang tidak boleh dilakukan:** menaikkan sheet dengan `position:fixed; bottom:<kbH>`
   (membuat sheet melayang di atas keyboard dan menutupi statusbar) atau memindahkan
   fokus secara paksa (merusak alur ketik).

**Urutan implementasi keyboard yang benar:** (1) pasang listener `visualViewport`,
(2) clamp tinggi sheet, (3) `scrollIntoView` field — ketiganya harus dites bersama,
karena tanpa (2), (3) saja akan meng-scroll field ke posisi yang tetap ketutup keyboard.

### 2.8 Perilaku lain yang harus dijaga di dalam sheet

- **Live preview saat geser slider** (tab Objek) tetap jalan seperti hari ini
  (slider menulis `draftProps` + preview di-mount ulang saat Terapkan — dan
  pratinjau langsung selagi digeser, debounce ~250ms, dari pekerjaan Props).
  Sheet tidak boleh me-mount ulang `.panes` saat snap berubah (state draft hilang
  bila komponen di-unmount) — snap hanya mengubah `transform`, **jangan** me-render
  ulang kondisional (`{snap !== "closed" && ...}`) yang meng-unmount inspector.
- **Closed ≠ unmount:** saat Closed, sheet disembunyikan dengan `transform` +
  `visibility:hidden` (sesudah transisi) / `aria-hidden`, bukan dilepas dari DOM.
  Alasan: draft edit, posisi scroll `.panes`, dan fokus harus lestari saat dibuka lagi.
- **`.panes` scroll position** dipertahankan per tab (sudah begitu hari ini karena
  satu container); snap Full → Peek tidak boleh me-reset `scrollTop`.
- **Swipe vs scroll:** drag sheet hanya dari gagang/header. `.panes` tetap `touch-action:pan-y`.
  Slider `input[type=range]` di dalam sheet: `touch-action:pan-x` implisit dari browser —
  pastikan handler drag sheet tidak ikut menangkap `pointerdown` yang berasal dari
  dalam `.panes` (cek `e.target.closest(".sheet-handle, .sheet-head")`).

---

## 3. Keputusan penempatan TIMELINE di portrait

### 3.1 Opsi yang dipilih: **timeline dilipat menjadi strip seek 72px di atas sheet**

- **Bentuk strip:** panel timeline tetap di tempatnya (baris ke-2 grid, di atas sheet),
  tapi dengan kelas `tl-collapsed`:
  - Tinggi panel = **72px** = `.panel-h` 44px (coarse) + ruler 28px.
  - Yang disembunyikan: `.trk-head` (kepala track V1/T1/A1) dan `.track` (shots/caps/audio)
    — `display:none` via CSS di bawah kelas tersebut.
  - Yang **tetap**: `.panel-h.tl-head` (judul "Timeline" + chip timecode + tombol Fit +
    tombol lipat/buka `▴/▾`) dan **ruler + playhead** (di dalam `.tl-content`,
    yang tetap di-render — hanya track yang hilang).
  - `tlHeight` (state, Studio.tsx:584) disimpan dulu (`prevTlHeightRef`) lalu di-set 264 → 72
    saat melipat; dikembalikan saat membuka. `fitTimeline()`/`setTimelineZoom` tidak
    disentuh — zoom state (`tlPps`, `tlRange`) lestari selama terlipat.
- **Kapan terlipat/terbuka:**
  - Sheet dibuka (peek/half/full) → timeline **otomatis terlipat** (default).
  - Sheet ditutup → timeline **kembali penuh 264px** (nilai sebelumnya).
  - Pengguna bisa membuka manual kapan saja lewat tombol `▴ Timeline` di header strip
    (atau ketuk header strip) — dan melipat lagi lewat `▾`. Pilihan manual ini
    diingat selama sheet terbuka (tidak di-override oleh snap peek↔half↔full).
  - Masuk focus-view → timeline hilang total seperti hari ini (tidak ada konflik:
    sheet sudah tertutup saat masuk focus-view, §2.4).
- **Yang tetap berfungsi saat terlipat (tanpa membuka):**
  - **Seek/scrub:** ruler `pointerdown` → `seekFromEvent` (:1685–1693) tidak berubah —
    ruler tetap selebar `.tl-content`, playhead tetap kelihatan.
  - **Play/pause + frame ±1f/±5s:** transport tidak berubah (tetap di bawah viewer).
  - **Timecode:** chip `fmtTC(time, len)` di header timeline + `.now-cap` tetap jalan.
  - **Fit:** tombol Fit di header strip tetap ada (memanggil `fitTimeline()` yang sama).
  - **Snap:** state `snap` tidak berubah; scrub tetap snap ke batas klip.
- **Yang butuh satu ketukan membuka dulu:**
  - Klik klip shot/caption (memilih klip → pindah tab Shot/Caption). Sebagai kompensasi,
    **ketukan pada klip tidak mungkin saat terlipat, jadi:** bila sheet terbuka dan
    pengguna mengetuk area ruler, itu seek (bukan buka). Untuk memilih klip, ketuk
    tombol `▴ Timeline` dulu — lalu klip bisa diketik seperti biasa dan `selectClip`
    tetap memindahkan tab.
  - Zoom slider timeline, tombol hide/lock track, dan label durasi klip (semua di
    `.tl-tools`/`.trk-head` yang tersembunyi di strip — zoom di 390px memang sudah
    disembunyikan oleh CSS `≤600px`, jadi tidak ada regresi di HP; di 768/834 zoom
    slider hilang sementara sampai dibuka).

### 3.2 Kenapa opsi ini (bukan dua alternatif)

| Opsi | Kelebihan | Kekurangan fatal |
|---|---|---|
| **A. Strip lipat 72px (DIPILIH)** | Semua kode timeline tetap di tempatnya (tidak ada pindah DOM, tidak ada duplikasi ruler); seek tetap jalan; hemat 192px vertikal tepat saat dibutuhkan; `tlHeight` + drag-resize sudah ada sehingga implementasi kecil | Klip tidak bisa diklik tanpa membuka dulu (risiko §3.3) |
| B. Timeline pindah ke dalam sheet (jadi tab/seksi) | Klip selalu sejajar dengan editor | Ruler drag vs scroll sheet berebut gesture; `.tl-content` diukur dari `tlScrollRef.clientWidth` — pindah container mengubah lebar dan memaksa `fitTimeline` ulang; seek sambil edit jadi mustahil karena sheet menutupi viewer; risiko regresi besar pada `applyTimelineWidth`/`ResizeObserver` (:1605–1640) |
| C. Timeline mengambang (mini-strip fixed di atas sheet) | Mirip A secara visual | Duplikasi: ruler kedua = dua sumber kebenaran untuk playhead/seek; z-index baru di atas sheet; tidak ada wadah DOM yang sudah ada — semua harus dibangun dari nol |

Alasan penentu: **A adalah satu-satunya opsi yang tidak memindahkan DOM timeline
dan tidak menduplikasi logika seek** — dan tujuan Rehan ("video tetap kelihatan saat
mengedit") tercapai justru karena 192px yang dihemat (264 → 72) itulah yang membuat
perhitungan Peek di §2.6 muat (tanpa pelipatan, Peek di 390px butuh 48+489,5+264+148+28
= 977,5 > 844 — stage pasti terpotong).

### 3.3 Risiko opsi strip (dan mitigasinya)

1. **Klip tidak bisa diklik saat terlipat → pengguna bingung "kok klip hilang".**
   Mitigasi: tombol header strip berlabel jelas `▴ Timeline` (bukan ikon saja);
   toast sekali saat pertama kali sheet dibuka: "Timeline dilipat — ketuk ▴ Timeline
   untuk memilih klip"; tour langkah 2 harus membuka lipatan dulu sebelum mengukur
   (lihat §2.5). Verifikasi: ketuk strip → klip Shot 1–10 + caption tampil penuh
   seperti hari ini (label "Shot 1"–"Shot 10", singkatan Cl/Cx/Br di klip <30px).
2. **Ruler di strip sempit → presisi seek turun.** Ruler tetap selebar layar penuh
   (390/768/834px) — hanya tingginya 28px. Target sentuh vertikal 28px < 44px ideal,
   tapi ini area scrub (geser), bukan tombol — dapat diterima; `ph-grip` 11px tetap
   di atas ruler. Bila verifikasi menunjukkan sulit, tambahkan `padding` sentuh
   8px di atas/bawah ruler tanpa mengubah visual.
3. **Pengguna membuka timeline penuh → stage terdorong.** Saat timeline dibuka penuh
   (264px) sementara sheet Half terbuka, total konten melebihi viewport — workspace
   `overflow-y:auto` (masih aktif di `≤900px`) akan scroll dan stage terpotong
   sebagian. Ini **sudah** perilaku hari ini (scroll), bukan regresi — tapi
   implementasi harus memastikan `.workspace` tetap bisa di-scroll saat sheet
   terbuka (sheet `position:fixed` tidak boleh mematikan scroll workspace).
4. **Balapan `tlHeight`:** `tlHeight` juga dipakai drag-resize desktop (yang
   nonaktif ≤900px) dan `rowCap` dari `--tl-h`. Saat melipat, jangan tulis 72 ke
   tempat yang dibaca drag-resize sebagai "tinggi pilihan pengguna" — simpan
   nilai lama di ref terpisah dan kembalikan utuh.
5. **Tour langkah 2 menunjuk strip, bukan klip.** Copy tour ("Klik klip untuk
   memilih…") tidak cocok dengan strip. Solusi: `tourPlace` langkah 2 membuka
   lipatan dulu (seperti langkah 0 membuka drawer), lalu mengukur `.timeline`
   penuh. Bila tidak sempat, ubah copy langkah 2 menjadi "Timeline — ketuk ▴
   untuk membuka, seret ruler untuk scrub".

---

## 4. Titik sentuh implementasi

### 4.1 `components/Studio.tsx` (satu-satunya file logika yang berubah)

**State baru (di dekat state lain, :485–584):**

| State | Tipe / nilai awal | Kegunaan |
|---|---|---|
| `sheetSnap` | `"peek" \| "half" \| "full" \| "closed"` — awal `"peek"` (hanya dipakai bila `sheetMode`) | Snap aktif |
| `sheetMode` | `boolean` — dari `matchMedia("(max-width: 900px) and (orientation: portrait)")` + listener `change` | Gate seluruh perilaku sheet; keluar mode → bersihkan kelas + `fitStage()` |
| `vvH` | `number \| null` | Tinggi `visualViewport` terakhir (untuk clamp keyboard, §2.7) |
| `sheetKbOpen` | `boolean` | Keyboard sedang terbuka (dari `visualViewport`) |
| Refs: `sheetRef`, `dragRef {startY, startTranslate, pointerId} `, `prevSnapRef`, `prevTlHeightRef`, `sheetOpenedTimelineRef` (untuk tour) | — | Drag, restore snap sesudah keyboard, restore tinggi timeline, tour |

**Efek & handler baru:**

1. Efek `matchMedia` sheetMode (pasang/lepas listener; saat keluar mode: hapus
   kelas `sheet-open` di `.app`, kembalikan `tlHeight`, `fitStage()`).
2. Efek `visualViewport` resize/scroll (§2.7) + fallback `window.resize`.
3. Handler `focusin` (capture) di dalam sheet → `scrollIntoView({block:"center"})`
   bila keyboard terbuka.
4. Handler drag di gagang + header (pointer capture; hanya bila
   `e.target.closest(".sheet-handle, .sheet-head")`; jangan pasang di `.panes`).
5. `toggleSheetSnap()`, `openSheet(snap)`, `closeSheet()` — dipakai FAB, Esc, drawer,
   focus-view, `selectClip`, ketuk objek.
6. **Ubah `selectClip`** (:1581–1590): sesudah `setTab`, bila `sheetMode && sheetSnap==="closed"`
   → `openSheet("half")`. Jangan ubah seek/selection-nya.
7. **Ubah handler Esc** (:1993–1996): sisipkan cabang sheet **sebelum** `focusView`:
   `if (sheetMode && sheetSnap !== "closed") { stepDownSnap(); return; }`.
   Urutan akhir: dialog/palet (sudah ada, return dini) > tour > **sheet** > focus-view > drawer.
8. **Ubah `tourPlace`/efek tour** (:1827–1875): langkah 2 → buka lipatan timeline dulu
   bila terlipat; langkah 3 → buka sheet ke Half dulu bila Closed (pola sama dengan
   langkah 0 membuka drawer); ukur ulang sesudah transisi 320ms (timeout sudah ada).
9. **Render:** di dalam `<aside className="panel inspector">` tambahkan sebagai anak
   pertama (sebelum `.tabs`): `<div className="sheet-handle">` + `<div className="sheet-head">`
   (tombol putar/jeda mini + judul konteks + dot dirty + Terapkan + chevron).
   Tambahkan FAB `<button className="sheet-fab">✎ Edit</button>` di luar `.app`? —
   **di dalam** `.app`, sesudah `</main>`, supaya tidak menabrak `dialog`/`tour`.
   Kelas `.app` ditambah `sheet-open` + `sheet-<snap>` (untuk CSS).
   **Jangan** mengubah: keempat `#apply*`/`#reset*`, `.insp-stick`, `.obj-now`,
   `.obj-pick`, `applyAll`/`reset*`, `fitStage`, `selectClip` (selain tambahan buka-sheet),
   `load`/`mount`, `TOUR_STEPS` (kecuali bila copy langkah 2 diubah — lihat §3.3.5).

**Interaksi silang yang wajib diimplementasikan (checklist):**

- [ ] Buka drawer (☰ / `T`) → `closeSheet()`; tutup drawer tidak membuka sheet.
- [ ] Masuk focus-view → `closeSheet()`; keluar focus-view tidak membuka sheet.
- [ ] Sheet dibuka → lipat timeline (simpan `tlHeight` ke `prevTlHeightRef`, set 72,
      tambah kelas `tl-collapsed`); sheet ditutup → kembalikan `tlHeight` + hapus kelas.
- [ ] Tombol `▴/▾ Timeline` manual → toggle lipatan tanpa mengubah snap sheet.
- [ ] Rotasi portrait → landscape (atau resize >900px) → keluar `sheetMode` total.
- [ ] `fitStage()` dipanggil sesudah: snap selesai (transitionend / timeout 300ms),
      sheet dibuka/ditutup, timeline dilipat/dibuka, keyboard buka/tutup, rotasi.
      Tanpa ini stage salah ukuran (lihat §1.5).

### 4.2 `app/globals.css` (satu-satunya file gaya yang berubah)

- **Blok baru** di dalam `@media (max-width:900px) and (orientation:portrait)` —
  atau, lebih aman, kelas `.app.sheet-mode` + media query yang sama, supaya aturan
  sheet tidak bocor ke landscape 844×390:
  - `.app.sheet-mode .inspector` → `position:fixed; left:0; right:0;
    bottom:calc(var(--status-h) + env(safe-area-inset-bottom,0px)); height:calc(100dvh - 76px);
    transform:translateY(calc(100% - var(--sheet-visible,148px))); z-index:75;
    border-radius:16px 16px 0 0; box-shadow:0 -8px 24px rgba(0,0,0,.35);`
    dengan `--sheet-visible` di-set per snap dari JS (148px / half / full) atau
    via kelas `.sheet-peek/.sheet-half/.sheet-full/.sheet-closed`.
  - `.sheet-handle`, `.sheet-head` (56px, tombol 44px), `.sheet-fab`.
  - `.app.sheet-mode .inspector .meta{display:none}`.
  - `.app.sheet-mode .timeline.tl-collapsed` → tinggi 72px; `.trk-head, .track{display:none}`;
    `.tl-body` hanya ruler; `.tl-tools` yang tidak relevan disembunyikan kecuali Fit + tombol lipat.
  - `.app.sheet-mode .workspace` — pastikan `overflow-y:auto` tetap hidup saat sheet
    terbuka (jangan set `overflow:hidden`).
- **Jangan ubah:** variabel `:root`, pita `≥901px` (termasuk `--tl-h:186/170` landscape),
  `.app.focus-view`, drawer/scrim (450–477), `pointer:coarse` 44px, font 16px iOS (601),
  `prefers-reduced-motion` (603), z-index dialog/tour/toast.
- **Jangan** menulis ulang `.inspector` di luar media query portrait — desktop 1440px
  (`grid-area:1/3/3/4`, 320px) harus byte-identik perilakunya.

### 4.3 `lib/studio.ts` — **tidak ada perubahan**

Tidak ada layout/state UI di sini. `OBJECTS`/`PROP_DEFS`/validasi dipakai sheet
apa adanya (judul "Sedang mengedit" memakai `activeObj` yang sudah dihitung di
Studio.tsx:1186–1187).

### 4.4 Yang TIDAK boleh berubah (daftar kunci — regresi bila tersentuh)

1. Desktop 1440px: 3 kolom (252/1fr/320), drawer docked, stage 226×401, timeline 264px.
2. Landscape 1366×768: stage 187×333 (fokus 334×594), `--tl-h:186px`, mode fokus viewer.
3. Mode fokus viewer: sembunyikan timeline/transport/now-cap, keluar via Esc/tombol.
4. Drawer + scrim: perilaku buka/tutup, `body.drawer-open/closed`, simpan `ss.drawer`.
5. Tour 5 langkah (kecuali penyesuaian pengukuran langkah 2/3 di §4.1.8).
6. Tema gelap/terang (variabel `:root[data-theme]`), toast, palet perintah, dialog.
7. Semantik editor: `applyAll` satu tombol semua tab, `anyDirty` vs baseline
   terakhir diterapkan, `orig*` vs `applied*`, tombol Kembalikan per tab,
   `localStorage` `ss.edits.v1` / `ss.mine.v1` / `ss.theme` / `ss.drawer` / `ss.vzoom`.
8. ID yang dipakai test/verifikasi: `#apply`, `#apply-shot`, `#apply-cap`,
   `#apply-objek`, `#reset*`, `#timelinePanel`, `#drawer`, `#stage`, `#pv`,
   `#tlFit`, `#tlZoom*`, `.tabs`, `.insp-stick`.
9. `fitStage` (rumus + pad 8px) dan `tlHeight` default 264.

---

## 5. Risiko & hal yang harus diverifikasi

### 5.1 Risiko implementasi (bisa dites di VM/headless)

| # | Risiko | Mitigasi / uji |
|---|---|---|
| R1 | Sheet `position:fixed` keluar dari grid → baris ke-3 grid tidak kolaps (ruang kosong di bawah timeline) | Uji: di portrait, ukur tinggi `.workspace` — harus = viewer + timeline saja; tidak ada gap 330px di bawah timeline |
| R2 | `transform` sheet vs `fitStage`: stage tidak mengecil saat sheet naik (stage meluber ke balik sheet) | Uji: `fitStage()` sesudah tiap snap (transitionend); ukur `stage` di peek/half/full di 390/768/834 |
| R3 | Drag sheet vs scroll `.panes` vs geser slider berebut pointer | Uji: geser slider Objek tidak menggerakkan sheet; scroll daftar caption tidak menggerakkan sheet; drag gagang tidak men-scroll konten |
| R4 | `.insp-stick` (sticky bottom) + sheet Full: bar Terapkan menutupi field terakhir | Uji: scroll `.panes` sampai bawah di tiap tab — field terakhir harus bisa di-scroll ke atas `.insp-stick` |
| R5 | Timeline strip: `seekFromEvent` memakai `tlContentRef.getBoundingClientRect()` — lebar konten berubah saat track disembunyikan | Uji: scrub ruler di strip → `time` berubah + playhead mengikuti; bandingkan dengan strip terbuka |
| R6 | `tlHeight` 72 menimpa nilai drag pengguna / `rowCap` | Uji: buka-tutup sheet 3× → `tlHeight` kembali ke nilai semula (264); di desktop (lebar >900) drag-resize tetap bekerja |
| R7 | Esc: urutan tutup salah (sheet menutup drawer, atau focus-view menutup sheet duluan) | Uji keyboard: Full → Half → Peek → Closed → (Esc lagi) → drawer tertutup; lalu focus-view → Esc keluar fokus tanpa membuka sheet |
| R8 | Tour langkah 2/3 menunjuk area kosong (strip/sheet tertutup) | Uji: jalankan tour penuh di 390px — semua kartu + sorotan menunjuk target yang kelihatan |
| R9 | FAB "Edit" menutupi konten / tidak muncul saat Closed | Uji: tutup sheet → FAB kelihatan di atas statusbar; ketuk → Peek; FAB hilang saat sheet terbuka |
| R10 | Rotasi portrait → landscape saat sheet Half → inspector nyangkut fixed | Uji: rotasi 390×844 → 844×390 → inspector kembali ke baris grid, `fitStage` benar, transport kelihatan penuh (temuan lama #6) |
| R11 | Keyboard: `visualViewport` tidak fire di headless → mekanisme tidak teruji di VM | Uji logika dengan emulasi `visualViewport` (set manual) + verifikasi tablet (§5.2) |
| R12 | Dialog "Simpan sebagai video baru" dibuka dari sheet Full → input nama ketutup keyboard | Uji: buka dialog dari sheet, fokus input nama → keyboard naik → input tetap kelihatan (dialog z 80 di atas sheet; `scrollIntoView` dialog terpisah dari sheet) |

### 5.2 Yang HANYA bisa dites di tablet fisik (tidak bisa dibuktikan dari VM)

- **Keyboard beneran:** tinggi keyboard iOS Safari vs Android Chrome berbeda
  (±260–310px iOS, bervariasi di Android + Gboard/suggestion bar); apakah Half cukup
  untuk field Judul/Subjudul + tombol Terapkan, atau harus Full; apakah `visualViewport`
  fire tepat waktu di iPad Safari (ada jeda animasi keyboard ~300ms).
- **Gesture asli:** drag gagang dengan jempol (kecepatan fling, ambang snap terasa
  benar atau terlalu sensitif); scroll `.panes` dengan jari tidak menarik sheet;
  slider Objek digeser jari (jempol menutupi nilai — apakah nilai slider tetap terbaca).
- **Safe-area & notch:** sheet di iPhone ber-Dynamic Island / iPad ber-home indicator —
  `env(safe-area-inset-bottom)` benar-benar terisi atau 0 (di headless selalu 0).
- **Stage 9:16 di layar nyata:** apakah 92% stage di Half terasa cukup, atau justru
  ujung bawah video (tempat teks penting) yang tertutup; apakah Peek 148px menutupi
  caption berjalan (`.now-cap` ada di viewer, bukan di sheet — verifikasi visual).
- **Performa:** animasi `transform` sheet di atas iframe WebGL (three.js) — apakah
  frame drop / flicker saat drag di tablet kelas menengah; SwiftShader di VM tidak
  mewakili GPU nyata.
- **Rotasi saat mengetik:** keyboard terbuka + rotasi ke landscape → apakah fokus
  dan draft selamat, apakah sheet keluar mode dengan bersih.
- **Tour di layar sentuh:** kartu tour 330px di 390px + sheet Half — apakah kartu
  menutupi gagang sheet sehingga langkah 3 tidak bisa dilanjutkan dengan sentuhan.

### 5.3 Checklist verifikasi (untuk worker verifikasi)

- [ ] 390/768/834 portrait, tiap snap (peek/half/full/closed): stage kelihatan
      100% / ≥92% / tertutup / penuh; ukur `getBoundingClientRect()` stage + sheet.
- [ ] `elementFromPoint` di tengah tiap tab inspector mengembalikan tombol tab itu
      (regresi temuan BLOCKER lama — tab harus bisa diketuk di semua snap).
- [ ] Alur edit penuh per snap: Teks → Terapkan (preview berubah) → Kembalikan;
      Caption invalid → Terapkan disabled + pesan kelihatan; Shot/Caption/Objek sama.
- [ ] Timeline strip: scrub ruler, playhead, Fit, buka/tutup lipatan, klik klip
      sesudah dibuka (tab pindah + seek).
- [ ] Drawer + focus-view + Esc + rotasi (R7, R10).
- [ ] Dialog Ekspor/Simpan dari dalam sheet (z-index + fokus input).
- [ ] 0 console error; `docScrollW` = lebar viewport (tanpa overflow-x); regresi
      desktop 1440 + landscape 1366×768 + focus-view (angka §4.4.1–2 tidak berubah).
- [ ] Tema terang: sheet/handle/header/tombol terbaca (variabel tema dipakai, bukan
      warna hardcode).

---

## 6. Ringkasan keputusan untuk implementasi

1. **Sheet hanya portrait ≤900px**, snap Peek 148px / Half `min(46dvh,480px)` /
   Full `100dvh−76px` / Closed + FAB "Edit"; gerakkan pakai `transform`, bukan `height`.
2. **Header selalu kelihatan:** putar/jeda mini + judul konteks ("Sedang mengedit: X"
   di tab Objek) + dot dirty + Terapkan (cerminan `applyAll`) + chevron.
3. **Timeline = strip lipat 72px** (header + ruler) di atas sheet; seek/playhead/Fit
   tetap jalan; klik klip butuh buka lipatan satu ketukan.
4. **Keyboard = `visualViewport`** (naikkan Peek→Half, clamp tinggi ke `--vv-h−76px`,
   `scrollIntoView` field ke tengah, kembalikan snap semula saat keyboard tutup).
5. **Z-index sheet 75** (drawer 70 < sheet < dialog 80 < tour 100 < toast 120);
   tanpa scrim; drawer/focus-view saling eksklusif dengan sheet; Esc menutup sheet dulu.
6. **Yang tidak berubah:** desktop 1440, landscape 1366×768 + focus-view, drawer/scrim,
   tour (kecuali pengukuran langkah 2/3), tema, `applyAll`/Kembalikan, semua ID test,
   `lib/studio.ts`.

*— Laporan audit + desain, 2026-11-18. Tidak ada kode implementasi ditulis di sini;
file ini satu-satunya file yang dibuat/ditulis oleh worker ini.*
