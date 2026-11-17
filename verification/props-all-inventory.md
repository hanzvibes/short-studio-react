# Inventarisasi Semua Props — Short Studio React

**Dokumen spesifikasi untuk implementor. Bukan kode. Dibaca dari kode template asli (bukan asumsi).**
**Tanggal:** 2026-11-17 · **Repo:** `hanzvibes/short-studio-react` · **Sumber:** 12 file `public/templates/*.html` + `lib/studio.ts` (29 prop defs) + `scripts/apply-edit.mjs` + `SKILL.md` + `README.md`.
**Nilai awal lama diverifikasi deterministik** dengan `node scripts/apply-edit.mjs --list-props <file>` untuk ke-12 template (2026-11-17).
**Template di disk tidak diubah selama penelitian ini.**

## Ringkasan

- **Dulu:** 29 pengaturan (id) di `PROP_DEFS`; banyak yang tampil nonaktif dengan alasan teknis.
- **Sekarang (dokumen ini): 78 id pengaturan BARU + 2 id lama yang diperluas ke semua template + 1 id lama yang perilakunya diperluas** (`claude.color` kini juga mengatur garis tepi balon kata di template satu maskot).
- **Total slot pengaturan di 12 template: 254** (dulu 101; baru 153). Per template: Versus 20, Trio 24, Adu Kode 24, Kuota 31, Rival 25, Perang 29, Mengetik 14, Deploy 19, Pemburu Bug 15, Bom 17, Rapat 17, Tidur 19.
- **Pengecualian: 0.** Setiap hal yang dulu ada di daftar "tidak bisa diedit" kini punya cara edit yang ditunjukkan baris kodenya di §2. Tidak ada satu pun yang terbukti mustahil. Lihat §4.
- **Prinsip yang dipakai di semua solusi:** jangan menulis ulang rumus animasi — sisipkan SATU angka bernama (konstanta) di depan fungsi yang memakainya, lalu tulis ulang hanya angka itu. Angka bernama itu dibaca/ditulis dengan cara yang sama seperti pengaturan lama (tulis ulang angka di dalam string HTML). Semua sisipan masuk ke *string HTML hasil edit* (tampilan pratinjau / file keluaran CLI), bukan ke file template di disk.

## Cara baca dokumen ini

- **§1** — 7 cara tulis baru (J1–J7) yang harus ditambahkan implementor ke `lib/studio.ts` + `scripts/apply-edit.mjs` (keduanya harus tetap sama persis isinya, seperti sekarang). Tanpa ini, pengaturan baru tidak bisa disimpan.
- **§2** — per kategori yang dulu diblokir: masalah lama → temuan kode (file, nomor baris, kutipan) → cara edit → rentang + nilai awal → efek yang terlihat → aturan jaga (validasi/kopling).
- **§3** — matriks per template: 12 tabel. Kolom **Nama awam** dan **Yang berubah** ditulis tanpa bahasa teknis (tanpa nama kode, tanpa istilah dalam). Kolom **Pengaturan** memuat id teknis untuk implementor; kolom **Rentang & awal** memuat angka yang harus dipakai UI/CLI.
- **§4** — daftar pengecualian (0) + hal-hal yang memang tidak ada objeknya (bukan pengecualian).
- **§5** — urutan kerja + cara uji yang disarankan untuk implementor.
- Nomor baris mengacu pada file template per 2026-11-17; bila baris bergeser karena edit lain, **kutipan kode adalah patokan** (cari kutipannya, bukan nomornya).

## §1 — Cara tulis baru yang harus ditambahkan implementor (J1–J7)

Semua pengaturan lama memakai jangkar `array` / `call` / `hex` / `mkmon` / `whole` / `assign` (lihat `lib/studio.ts`). Pengaturan baru butuh 7 cara tulis tambahan. Semuanya bekerja pada **string HTML**, sama seperti yang lama.

| Kode | Nama cara tulis | Cara kerja | Dipakai untuk |
|---|---|---|---|
| J1 | `inject-const` | Sisipkan baris `const NAMA=nilai;` tepat **sebelum** baris penanda yang dikutip (biasanya `function frame(t){` atau baris definisi fungsi terkait). Bila baris itu sudah ada (edit kedua dst.), tulis ulang saja angkanya — seperti `assign`. `readProp` mengembalikan nilai awal bila baris belum ada. | Semua angka bernama baru: posisi dasar, goyangan, miring mata, wajah, benteng, tangki, papan skor, keyboard, beat. |
| J2 | `inject-line` | Sisipkan SATU baris pernyataan tepat **sesudah** baris penanda yang dikutip (mis. sesudah baris pembuatan grup). Baris itu berisi angka yang selanjutnya ditulis dengan jangkar `call`. | Ukuran maskot (`cm.scale.setScalar(...)` / `mas.scale.setScalar(...)`), ukuran bos, ukuran benteng. |
| J3 | `wrap-arg` | Tulis ulang SATU argumen di SATU situs panggilan yang dikutip: `ARGUMEN_ASLI` → `NAMA>=0?NAMA:ARGUMEN_ASLI`. Konstanta `NAMA` dibuat dengan J1. Nilai `-1` berarti "ikut cerita seperti biasa". | Wajah Codex (`drawFace`). |
| J4 | `add-term` | Tambahkan SATU suku ke sebuah rumus yang dikutip: `...rumus...` → `...rumus...+NAMA` (atau `NAMA+...rumus...`). Konstanta `NAMA` dibuat dengan J1. | Posisi dasar maskot tunggal, miring mata, kedalaman maskot. |
| J5 | `multi-site` | Satu nilai ditulis di **N situs yang terdaftar** (tabel situs per pengaturan di §2). Situs turunan ditulis sebagai `T+offset` (bukan angka mentah) supaya lebar jendela waktu tidak berubah saat T digeser. Semua situs harus cocok persis, kalau tidak edit ditolak (jangan tulis setengah). | Semua pengaturan waktu cerita (beat), keyboard (2 situs), warna cairan tangki (bukan — itu 3 `hex`). |
| J6 | `css-hex` | Tulis ulang kode warna `#rrggbb` di dalam SATU aturan CSS yang dikutip persis (termasuk nama aturannya), bukan di sembarang tempat di file. | Garis tepi balon kata di template satu maskot. |
| J7 | `block` | Ganti SATU blok kode utuh di antara baris awal dan baris akhir yang dikutip persis. Isi blok baru harus lolos `node --check` seperti blok lama. | Isi layar editor di template Bom (4 fase dalam satu blok). |

**Aturan validasi umum (berlaku untuk semua pengaturan baru, ditambahkan ke `validateProps` / `crossCheckFinal`):**

1. Jarak antar maskot tetap berlaku: selisih posisi kiri-kanan > 0,1 dan sebaiknya ≥ 2,5 (anggaran geser ke tengah saat debat/senang/mengetik, supaya lengan tidak saling menembus). Aturan lama, tidak berubah.
2. Bingkai kamera: |posisi| + 0,6 ≤ setengah lebar tampak pada shot pertama (aturan lama, tidak berubah).
3. Pengaturan posisi dasar + goyangan dijaga bersama: |posisi dasar| + goyangan ≤ 1,2 pada template satu maskot (supaya tangan tetap di atas keyboard dan maskot tetap di dalam bingkai).
4. Pengaturan waktu cerita: 0 < T < durasi video; urutan antar momen dalam satu template harus terjaga (daftar urutan ada di tiap tabel beat §2). Bila satu momen digeser, teks dan kamera di sekitar momen itu **wajib** digeser dalam spec yang sama — sama seperti aturan `meeting.end` yang sudah ada. CLI menolak bila urutan dilanggar; UI menampilkan peringatan merah.
5. Skor papan: tiap angka 0–100, bilangan bulat; jumlah angka awal + goyangan ≤ 100.
6. Semua edit baru harus lolos `node --check` pada semua blok `<script>` hasil edit dan jumlah kemunculan `@hanzvibes` tidak boleh berkurang (aturan lama, tidak berubah).

---

## §2 — Kategori yang dulu diblokir, dan cara mengeditnya

### A. Posisi kiri-kanan maskot tunggal (6 template satu maskot)

**Dulu (alasan di `SKILL.md` / `README.md`):** posisi dihitung di `frame()` dari goyangan/putaran, bukan angka yang bisa ditulis ulang.

**Temuan kode.** Di ke-6 template, `frame()` menghitung SATU baris `x` lalu memakainya di `mas.position.set(x,0,.6)` dan di `keyFx(t,x,sw)` (tuts yang menyala mengikuti maskot):

| Template | `function frame(t){` | Baris `x` | Kutipan |
|---|---|---|---|
| Mengetik | 204 | 209 | `const x=t<19?sy*.45:Math.sin((t-19)*1.4)*.2*sm(cl((t-19)/.5,0,1));` |
| Deploy | 207 | 211 | `const x=sy*.45+Math.sin((t-19)*1.4)*.2*s2(23,23.5);` |
| Pemburu Bug | 259 | 269 | `const x=sy*.45+Math.sin((t-27)*1.4)*.2*s2(27.6,28);` |
| Bom | 265 | 275 | `const x=sy*.45;` |
| Rapat | 270 | 288 | `const x=sy*.4,shk=Math.max(mute,tw);` |
| Tidur | 235 | 239 | `const x=t>=14&&t<22?Math.sin((t-14)*Math.PI/2)*.6:0;` |

(`sy` = goyangan saat mengetik; nilainya naik-turun antara −1 dan 1.)

**Cara edit (J1 + J4).** Sisipkan `const MX0=0;` tepat sebelum `function frame(t){`, lalu tulis ulang baris `x` menjadi `const x=MX0+(...rumus lama...);` (Rapat: `const x=MX0+sy*.4,...`; Tidur: `const x=MX0+(t>=14&&t<22?Math.sin((t-14)*Math.PI/2)*.6:0);`). Aman karena `x` hanya dibaca oleh posisi maskot, tuts keyboard, dan balon kata — ketiganya ikut bergeser bersama, jadi tangan, tuts yang menyala, dan balon tetap cocok satu sama lain. Teks di layar tidak berubah (teks datang dari hitungan ketikan, bukan dari `x`).

**Pengaturan baru:** `claude.x` (id lama, diperluas ke 6 template ini) — geser −2..2, langkah 0,05, awal 0. Rentang efektif yang aman −1..1 (di luar itu tangan keluar dari keyboard — lihat aturan validasi umum no. 3; UI boleh membiarkan sampai ±2 dengan peringatan kuning di atas ±1). Efek: maskot bergeser ke kiri/kanan di atas panggung; semua yang menempel padanya (tangan, balon kata) ikut.

**Goyangan (bonus dari baris yang sama).** Angka `.45` (Mengetik/Deploy/Pemburu Bug/Bom), `.4` (Rapat), `.6` (Tidur) di baris `x` adalah besar goyangan kiri-kanan saat mengetik/bekerja. **Pengaturan baru** `claude.sway` (J1: `const SWAY=...;` + tulis ulang angka itu menjadi `SWAY`) — geser 0..0,9, langkah 0,05, awal 0,45 / 0,45 / 0,45 / 0,45 / 0,4 / 0,6. 0 = maskot diam tegak; 0,9 = bergoyang lebar. Aman: hanya mengubah lebar gerakan, bukan waktunya.

### B. Ukuran maskot oranye / maskot tunggal (skala Claude)

**Dulu:** skala 1 tersirat, tidak ada angka literalnya (kecuali Perang lewat angka ukuran yang sudah ada).

**Temuan kode.** Grup maskot dibuat tanpa pengaturan ukuran: `const cm=new THREE.Group();S.add(cm);` (Versus:140, Trio:152, Adu Kode:353, Kuota:201, Rival:168) dan `const mas=new THREE.Group();S.add(mas);` (Mengetik:168, Deploy:171, Pemburu Bug:223, Bom:228, Rapat:225, Tidur:166). Di `frame()`, tidak ada baris apa pun yang menulis ukuran grup ini (hanya Perang yang menulis ukuran tiap frame dari `gs`, itu sebabnya Perang sudah bisa). Jadi ukuran yang ditulis sekali di awal akan bertahan sepanjang video.

**Cara edit (J2).** Sisipkan SATU baris tepat sesudah baris pembuatan grup: `cm.scale.setScalar(1);` (template 2–3 maskot) atau `mas.scale.setScalar(1);` (template satu maskot). Selanjutnya angka `1` itu ditulis dengan jangkar `call` yang sudah ada. Aman: baris ini tidak dibaca/diubah oleh animasi lain; yang berubah hanya besar maskot itu (bagian-bagiannya ikut membesar karena menempel di grup).

**Pengaturan:** `claude.scale` (id lama, diperluas ke 11 template lain; Perang sudah punya) — geser 0,5..1,3, langkah 0,05, awal 1 (Perang tetap 1 / Codex 0,85). Efek: maskot oranye membesar/mengecil; kepala, mata, lengan, dan kaki ikut. Validasi: bila maskot dibesarkan di atas 1,15, jaga jarak dengan maskot sebelah (aturan jarak §1 no. 1).

### C. Kedalaman maskot (posisi depan–belakang / Z)

**Dulu:** hanya posisi kiri-kanan yang berupa angka; kedalaman dihitung (`-.1*wr` dsb.) atau nol.

**Temuan kode.** Baris posisi di `frame()`:

| Template | Baris | Kutipan |
|---|---|---|
| Versus | 204 | `G[i].position.set(X[i]+DR[i]*g+Math.sin(t*18)*.1*fe*(i?.8:1),hp[i],0);` |
| Trio | 226 | `G[i].position.set(X[i]+DR[i]*.35*ar,h,0);` |
| Adu Kode | 419 | `G[i].position.set(X[i]+DR[i]*g+Math.sin(t*18)*.1*fe*(i?.8:1),hp[i],-.1*wr);` |
| Kuota | 275 | `G[i].position.set(X[i]+DR[i]*g+kx*.45+Math.sin(t*18)*.1*fe*(i?.8:1),hp[i],0);` |
| Rival | 232 | sama seperti Kuota (angka `0` di ujung) |
| Perang | 287 | `G[i].position.set(gx[i]+DR[i]*(.15*war*(1-ko)+.2*ar+.1*(exR+exL)-.04*wm),hp[i],.7);` |
| Mengetik | 210 | `mas.position.set(x,0,.6);` (Deploy:212, Pemburu Bug:270, Bom:276, Rapat:290 — Rapat: `mas.position.set(x+.22*sipReach,0,.6);`) |
| Tidur | 245 | `mas.position.z=.55+.25*sm(cl((t-13.5)/.5,0,1))-.25*sm(cl((t-27)/1,0,1));` |

**Cara edit.**
- Template 2–3 maskot (J1 + J4): sisipkan `const MZ=[0,0];` (Trio `[0,0,0]`) sebelum `function frame(t){`; tulis ulang angka kedalaman menjadi `MZ[i]` (Versus/Trio/Kuota/Rival), `MZ[i]-.1*wr` (Adu Kode — goyangan maju-mundur saat mengetik tetap jalan), `.7+MZ[i]` (Perang).
- Template satu maskot kecuali Tidur: angka `.6` di `mas.position.set(x,0,.6)` SUDAH berupa angka literal — tulis ulang langsung dengan jangkar `call` yang sudah ada (tidak perlu sisipan).
- Tidur (J1 + J4): sisipkan `const MZ0=0;` sebelum `function frame(t){` (235); tulis ulang `.55` di baris 245 menjadi `(.55+MZ0)`.

**Pengaturan baru:** `claude.z`, `codex.z` (6 template 2–3 maskot), `gemini.z` (Trio) — geser −1..1, langkah 0,05, awal 0 (angka ini adalah *tambahan* dari kedalaman asli: 0 di Versus/Trio/Kuota/Rival, −0,1×goyangan di Adu Kode, 0,7 di Perang). Template satu maskot: `claude.z` — geser 0..1,2, langkah 0,05, awal 0,6; Tidur: geser −0,4..0,4, langkah 0,05, awal 0 (tambahan dari 0,55). Efek: maskot maju ke arah penonton atau mundur ke arah layar; lengan dan balon kata ikut karena menempel pada maskot. Validasi: |tambahan| ≤ 1 supaya maskot tidak menembus layar di belakangnya atau menutupi kamera.

### D. Ekspresi wajah (mata + wajah layar Codex)

**Dulu:** ekspresi mengikuti suasana cerita (marah/senang/syok/lelah) yang terikat pada momen; tidak ada angka ekspresi.

**Temuan kode.** Ada DUA wajah yang berbeda:
1. **Wajah layar Codex** — satu fungsi yang sama persis di 6 template 2–3 maskot, `function drawFace(m,bl){...}` (Versus:158, Trio:170, Adu Kode:371, Kuota:219, Rival:186, Perang:167). Isinya menggambar 4 wajah berdasarkan angka `m`: `0` biasa (`>` + garis), `1` marah (dua garis miring), `2` senang (dua busur `^ ^`), `3` lelah (dua garis datar). Fungsi ini murni: hanya menggambar ulang gambar wajah bila `m` berubah; tidak ada animasi lain yang membaca `m`.
2. **Mata maskot oranye** (dan mata Gemini) — dua kotak mata yang dimiringkan tiap frame, satu baris per template: Versus:207 `eL.rotation.z=-.4*ar+.5*jy;eR.rotation.z=.4*ar-.5*jy;`, Trio:230 (juga `geL`/`geR`), Adu Kode:423 `eL.rotation.z=(-.4*ar+.5*jy)*(1-sh);...`, Kuota:278, Rival:235, Perang:291 (pola sama, `ang` sebagai ganti `ar`); template satu maskot: Mengetik:211 `eL.rotation.z=.5*hF;eR.rotation.z=-.5*hF;`, Deploy:213, Pemburu Bug:271, Bom:277, Rapat:292, Tidur:246 `eL.rotation.z=.5*hpy;eR.rotation.z=-.5*hpy;`. (Di sini `ar`/`ang` = marah, `jy` = senang, `hF`/`hpy` = senang.)

**Cara edit.**
- Wajah Codex (J1 + J3): sisipkan `const FACE_OVR=-1;` sebelum `function frame(t){`; tulis ulang argumen pertama di SATU baris panggilan menjadi `FACE_OVR>=0?FACE_OVR:<rumus lama>`. Baris panggilan: Versus:211 `drawFace(jy>.5?2:tr>.5?3:(s2(6,6.5)*(1-s2(16,16.5))>.5)?1:0,bl>.5?1:0);`, Trio:235 `drawFace(jy>.5?2:tr>.5?3:ar>.5?1:0,bl>.5?1:0);`, Adu Kode:428 `drawFace(jy>.5?2:(sh>.3||ar>.45)?1:0,bl>.5?1:0);`, Kuota:289 `drawFace(jy>.5?2:(ang>.5)?1:0,bl>.5?1:0);`, Rival:241 (sama), Perang:299 `drawFace(jy>.5?2:ko>.5?3:ang>.5?1:0,bl>.5?1:0);`. Aman: `drawFace` hanya menggambar ulang gambar wajah; kedipan (`bl`) tetap jalan karena argumen keduanya tidak disentuh.
- Miring mata (J1 + J4): sisipkan `const EYE_TILT=0;` sebelum `function frame(t){`; tambahkan `+EYE_TILT` di ujung rumus putaran mata kiri dan `−EYE_TILT` di ujung rumus mata kanan, di baris yang dikutip di atas (Trio: pecah penugasan berantai `eL.rotation.z=geL.rotation.z=...` menjadi dua baris agar tambahan bisa ditulis di tiap sisi). Aman: mata hanya berputar di tempatnya; tidak ada yang membaca putaran mata selain gambar mata itu sendiri.

**Pengaturan baru:** `face.codex` (6 template 2–3 maskot) — pilihan: −1 ikut cerita (awal), 0 biasa, 1 marah, 2 senang, 3 lelah. `eyes.tilt` (12 template) — geser −0,5..0,5, langkah 0,05, awal 0; positif = mata terangkat seperti senang, negatif = mata miring seperti marah. Efek: wajah Codex di layarnya berubah seketika dan bertahan sepanjang video (bila dipilih bukan "ikut cerita"); mata maskot oranye (dan Gemini) miring mengikuti geseran. Catatan jujur: wajah Codex yang diubah adalah wajah di layar birunya; mata maskot oranye diatur lewat `eyes.tilt` — keduanya sengaja dipisah karena memang dua gambar yang berbeda di kode.

### E. Bos di template Tidur

**Dulu:** bos diparkir jauh di luar bingkai (`x=30`), bukan maskot utama.

**Temuan kode.** `template-sleep.html:177`: `const boss=new THREE.Group();boss.position.set(30,0,0);S.add(boss);` — angka `30` adalah angka literal biasa. Ruangan bos (lantai, dinding, poster, jendela, jam, rak, tanaman, lampu — baris 178–189) membentang di x 24–36, jadi bos berdiri di tengah ruangannya sendiri. Dua shot kamera memang menyorot bos: shot t=9 dan t=25, keduanya `[30,1.9,3.1],[30,1.75,0]` (baris 225–227). Di `frame()`, hanya putaran (`boss.rotation.y`, baris 255) dan naik-turun halus (`boss.position.y`, baris 256) yang ditulis — posisi kiri-kanan dan ukuran bos TIDAK PERNAH ditulis ulang tiap frame.

**Cara edit.**
- Posisi: tulis ulang angka `30` di baris 177 dengan jangkar `call` yang sudah ada (tidak perlu sisipan). **Pengaturan baru** `boss.x` — geser 28..32, langkah 0,1, awal 30. Efek: bos bergeser di dalam ruangannya. Aturan jaga: bila digeser lebih dari ±1 dari 30, geser juga kedua shot bos (t=9 dan t=25, angka kamera dan arah pandang) dengan jumlah yang sama dalam spec yang sama, supaya bos tetap di tengah sorotan.
- Ukuran: (J2) sisipkan `boss.scale.setScalar(1);` tepat sesudah baris 177, lalu tulis ulang angkanya dengan jangkar `call`. **Pengaturan baru** `boss.scale` — geser 0,7..1,3, langkah 0,05, awal 1. Aman: ukuran grup membesar dari lantai ke atas (titik nol grup ada di kaki bos); `frame()` tidak pernah menulis ukuran bos. Efek: bos tampak lebih besar/kecil di shot sorotannya.

### F. Benteng perang + katapel + tombol + tagihan (template Perang)

**Dulu:** benteng tersebar di banyak panggilan `box()`, tidak ada satu angka "benteng".

**Temuan kode.** Benteng dibuat oleh SATU fungsi pembuat (`template-perang.html:120–122`):
```js
const mkFort=(sx,txt,col)=>{const g=new THREE.Group();g.position.set(sx*3.7,0,-1.6);S.add(g);box(1.3,1.1,.9,CB,[0,.55,0],g);...
const fA=mkFort(-1,'CLAUDE.md','#d97757'),fB=mkFort(1,'AGENTS.md','#3c64e1');
```
Semua kotak benteng (dinding, atap, menara, pintu, tiang, bendera) menempel pada grup `g` — jadi SATU angka posisi di `g.position.set` memindahkan seluruh benteng sekaligus. Angka `3.7` = jarak benteng dari tengah; `-1.6` = kedalaman benteng. Di `frame()`, benteng hanya digoyang sedikit saat kena tembakan (`fA.g.rotation.z=fsh(0)*.04;` baris 318) — posisi dan ukuran tidak pernah ditulis ulang. Katapel dibuat fungsi yang sama polanya (baris 125): `const mkCat=sx=>{const g=new THREE.Group();g.position.set(sx*2.4,0,-1.75);...}`.

**Cara edit (J1 + J2).** Sisipkan `const FORT_X=3.7,FORT_Z=-1.6,FORT_S=1,CAT_X=2.4;` tepat sebelum baris 119 (`// benteng kardus + bendera ...`); tulis ulang `sx*3.7` → `sx*FORT_X`, `,-1.6)` → `,FORT_Z)` di baris 120, `sx*2.4` → `sx*CAT_X` di baris 125; sisipkan `g.scale.setScalar(FORT_S);` sesudah `S.add(g);` di baris 120. Tulisan dan warna bendera sudah berupa teks/angka di baris 123 — tulis ulang langsung (`'CLAUDE.md'`, `'#d97757'`, dst.).

**Pengaturan baru (Perang):**

| Pengaturan | Rentang & awal | Efek yang terlihat |
|---|---|---|
| `fort.distance` | geser 3,5..4,5, langkah 0,1, awal 3,7 | Kedua benteng menjauh/mendekat dari tengah secara simetris |
| `fort.depth` | geser −2,2..−0,8, langkah 0,05, awal −1,6 | Kedua benteng maju/mundur (mendekati jenderal / menempel dinding) |
| `fort.size` | geser 0,7..1,3, langkah 0,05, awal 1 | Kedua benteng membesar/mengecil beserta benderanya |
| `fort.claude.text` | teks, maks. 12 huruf, awal `CLAUDE.md` | Tulisan di bendera kiri |
| `fort.codex.text` | teks, maks. 12 huruf, awal `AGENTS.md` | Tulisan di bendera kanan |
| `fort.claude.color` | pemilih warna, awal `#d97757` | Warna bendera kiri |
| `fort.codex.color` | pemilih warna, awal `#3c64e1` | Warna bendera kanan |
| `catapult.distance` | geser 1,8..2,8, langkah 0,1, awal 2,4 | Kedua katapel menjauh/mendekat dari tengah secara simetris |

Aturan jaga: jarak benteng − jarak katapel ≥ 1,3 (awal 3,7−2,4 = 1,3) supaya katapel tidak menembus benteng; di atas 4,2 benteng keluar dari bingkai pada shot lebar (tetap boleh, tapi tidak terlihat). Koin yang ditembakkan mengikuti katapel karena titik awalnya dihitung dari posisi katapel (baris 317) — tidak perlu diubah.

**Tombol biru + tagihan (satu baris yang sama, Perang).** Warna tombol yang berputar saat perang: baris 272 `const BCOL=[[.6,.6,.6],[.85,.47,.34],[.24,.39,.88],[.7,.3,.8]]` — **pengaturan baru** `war.button` (daftar 4 warna, tiap warna 3 angka 0..1) — tombol berganti warna mengikuti daftar baru. Tagihan di papan: baris 322 `bill=Math.round(425*Math.pow(s2(3.4,22),1.2))*10000` — **pengaturan baru** `war.bill` (geser 0..1000, langkah 5, awal 425; nilai × Rp10.000, jadi 425 = Rp4.250.000) dan `war.bill.speed` (geser 0,5..2, langkah 0,1, awal 1,2; makin besar makin cepat tagihan naik). Keduanya satu situs, tulis ulang angka literalnya.

### G. Skor papan di luar Adu Kode (Versus, Trio, Rival, Kuota, Perang)

**Dulu:** skor dihitung (goyangan / selubung / sisa kuota / jumlah pasukan), bukan angka literal.

**Temuan kode.** Di tiap template, skor dihitung dari 2–3 angka pangkal yang berupa angka literal di SATU baris. Mengganti angka pangkalnya = mengganti skornya, tanpa menyentuh rumus:

| Template | Baris | Kutipan (angka pangkal dicetak tebal di bawah) |
|---|---|---|
| Versus | 212–213 | `ra=**55**+**38***Math.sin(t*1.1),rb=**55**+**38***Math.sin(t*1.1+2.6),q=s2(18,19);` lalu `va=Math.round((ra+(**90**-ra)*q)*w),vb=Math.round((rb+(**90**-rb)*q)*w);` |
| Trio | 234 | `v=[0,2.1,4.2].map(o=>Math.round((**55**+**38***Math.sin(t*1.1+o)+(**90**-**55**-**38***Math.sin(t*1.1+o))*q)*w));` |
| Rival | 251 | `LV=**90***s2(2.8,14.5)*(1-s2(16.5,19.5))+**85***s2(29.2,31.2),va=Math.round(cl(LV*(1+**.05***Math.sin(t*3)),0,100)),vb=Math.round(cl(LV*(1+**.05***Math.sin(t*3+2)),0,100));` |
| Kuota | 297 | `drawBoard(Math.round(rm),Math.round(spd***2.9**),Math.round(spd***2.2**),lab);` (`rm` = sisa kuota dari kurva tangki yang sudah bisa diedit; `spd` = 100 − sisa) |
| Perang | 322 | `nA=SP[0].filter(x=>t>=x).length,nB=SP[1].filter(x=>t>=x).length,bill=...` (jumlah pasukan dari `war.spawns` yang sudah bisa diedit; tagihan lihat §F) |

**Cara edit (J1).** Sisipkan konstanta sebelum `function frame(t){` lalu tulis ulang angka pangkalnya:
- Versus/Trio: `const SC_BASE=55,SC_SWING=38,SC_FINAL=90;` — ganti `55`→`SC_BASE`, `38`→`SC_SWING`, `90`→`SC_FINAL` di baris yang dikutip.
- Rival: `const RV_TOP=90,RV_BACK=85,RV_WOB=.05;` — ganti `90`→`RV_TOP`, `85`→`RV_BACK`, `.05`→`RV_WOB` (dua kali) di baris 251.
- Kuota: `const BD_READ=2.9,BD_WRITE=2.2;` — ganti `2.9`→`BD_READ`, `2.2`→`BD_WRITE` di baris 297.

**Pengaturan baru:**

| Pengaturan | File | Rentang & awal | Efek yang terlihat |
|---|---|---|---|
| `board.base` | Versus, Trio | geser 0..90, langkah 1, awal 55 | Angka papan di awal debat (sebelum naik-turun) |
| `board.swing` | Versus, Trio | geser 0..45, langkah 1, awal 38 | Seberapa jauh angka papan naik-turun selama debat |
| `board.final` | Versus, Trio | geser 0..100, langkah 1, awal 90 | Angka akhir saat papan menunjukkan seri |
| `board.top` | Rival | geser 0..100, langkah 1, awal 90 | Angka dendam tertinggi di papan |
| `board.back` | Rival | geser 0..100, langkah 1, awal 85 | Angka dendam saat mereka musuhan lagi di akhir |
| `board.swing` | Rival | geser 0..0,2, langkah 0,01, awal 0,05 | Seberapa jauh angka papan bergoyang (Rival: goyangan kecil) |
| `board.read` | Kuota | geser 0..5, langkah 0,1, awal 2,9 | Angka "file dibaca" di papan kuota, mengikuti sisa kuota |
| `board.write` | Kuota | geser 0..5, langkah 0,1, awal 2,2 | Angka "kata dijawab" di papan kuota, mengikuti sisa kuota |

Validasi: angka awal + goyangan ≤ 100 (Versus/Trio); papan Kuota: angka papan pertama adalah sisa kuota itu sendiri (diatur lewat kurva tangki yang sudah ada), kedua pengali di atas hanya mengubah dua angka sampingnya. Kopling: `board.final` Versus/Trio bekerja saat momen seri tiba (lihat pengaturan waktu `beat.tie` / `beat.tired` di §M); angka Rival `board.back` bekerja saat momen kambuh (`beat.relapse`).

### H. Warna cairan tangki kuota (template Kuota)

**Dulu:** warna cairan ditimpa tiap frame dari sisa kuota (kuning → merah → hijau), jadi mengubah warna awal di baris pembuatan tidak terlihat.

**Temuan kode.** `template-kuota.html:174`: `const cAm=new THREE.Color(0xffc857),cRe=new THREE.Color(0xff3b3b),cGr=new THREE.Color(0x3ddc84),cTk=new THREE.Color();` — tiga warna ujung (kuning, merah, hijau) berupa kode warna literal. Tiap frame (baris 298) cairan dicampur dari ketiganya: `cTk.copy(cAm).lerp(cRe,lo).lerp(cGr,rf);tkLiq.material.color.copy(cTk);` — `lo` = seberapa hampir habis, `rf` = kilau saat isi ulang. Warna di baris pembuatan (baris 170, `0xffc857`) memang ditimpa tiap frame, jadi JANGAN disentuh — yang benar adalah ketiga warna ujung di baris 174.

**Cara edit.** Tulis ulang ketiga kode warna di baris 174 dengan jangkar `hex` yang sudah ada (awalan `cAm=new THREE.Color(0x`, `cRe=new THREE.Color(0x`, `cGr=new THREE.Color(0x`).

**Pengaturan baru:** `tank.color.full` (pemilih warna, awal `#ffc857`) — warna cairan saat tangki penuh; `tank.color.low` (awal `#ff3b3b`) — warna cairan saat kuota hampir habis; `tank.color.reset` (awal `#3ddc84`) — warna kilau saat kuota diisi ulang. Efek: cairan tangki berubah warna mengikuti pilihan baru di tiap fase (penuh / hampir habis / isi ulang). Aman: hanya warna ujung yang diganti; kapan berubahnya tetap diatur oleh sisa kuota.

**Posisi tangki (bonus, satu baris yang sama).** `template-kuota.html:168`: `tkG.position.set(0,0,-1.25);` — seluruh tangki (kaca + cairan + lampu + label) adalah satu grup. **Pengaturan baru** `tank.x` (geser −2..2, langkah 0,05, awal 0) dan `tank.z` (geser −2..−0,5, langkah 0,05, awal −1,25), jangkar `call` yang sudah ada. Efek: tangki bergeser kiri-kanan / maju-mundur di antara kedua maskot. Jaga: |x| ≤ 1,5 supaya tidak menabrak monitor.

### I. Keyboard yang diperebutkan (Rival; Kuota ikut sebagian)

**Dulu:** posisi dasar keyboard ditimpa tiap frame oleh goyangan tarik-menarik (`kx`), jadi mengubah posisi awal tidak berpengaruh.

**Temuan kode.** `template-rival.html:155` (pembuatan): `const kb=new THREE.Group();kb.position.set(0,.12,.8);S.add(kb);` — lalu tiap frame (baris 229 dan 243):
```js
const ...kx=.3*Math.sin(t*5.5)*kw;
kb.position.set(kx,.12+.05*kw*Math.abs(Math.sin(t*5.5)),.8);
```
(`kw` = seberapa kuat mereka tarik-menarik; `0` bila tidak tarik-menarik.) Baris 243 MENIMPA baris 155 tiap frame — itu sebabnya mengubah baris 155 saja tidak terlihat. Template Kuota punya baris yang sama persis (pembuatan baris 176, frame baris 280, `kx` di baris 272), hanya saja di Kuota `kw` selalu `0` (`const cs=0,...,kw=0` baris 272) sehingga keyboardnya tidak pernah bergoyang.

**Cara edit (J1 + J5).** Sisipkan `const KB_X=0,KB_SWAY=.3,KB_Y=.12,KB_Z=.8;` sebelum `function frame(t){` (Rival:225, Kuota:268); tulis ulang:
- baris `kx`: `kx=KB_X+KB_SWAY*Math.sin(t*5.5)*kw` (Rival:229, Kuota:272);
- KEDUA baris `kb.position.set(...)` (Rival:155 dan 243; Kuota:176 dan 280): `kb.position.set(kx,KB_Y+.05*kw*Math.abs(Math.sin(t*5.5)),KB_Z)` untuk baris frame, `kb.position.set(KB_X,KB_Y,KB_Z)` untuk baris pembuatan.

**Pengaturan baru:**

| Pengaturan | File | Rentang & awal | Efek yang terlihat |
|---|---|---|---|
| `keyboard.x` | Rival, Kuota | geser −1..1, langkah 0,05, awal 0 | Keyboard bergeser kiri-kanan (posisi diamnya) |
| `keyboard.sway` | Rival saja | geser 0..0,6, langkah 0,05, awal 0,3 | Seberapa jauh keyboard terombang-ambing saat diperebutkan (0 = diam) |
| `keyboard.y` | Rival, Kuota | geser 0..0,5, langkah 0,05, awal 0,12 | Keyboard naik/turun dari meja |
| `keyboard.z` | Rival, Kuota | geser 0..1,5, langkah 0,05, awal 0,8 | Keyboard maju/mundur (mendekati maskot / menjauhi maskot) |

Catatan Kuota: `keyboard.sway` tidak ada di Kuota karena di sana keyboard memang tidak pernah bergoyang (`kw` selalu 0) — menggesernya tidak akan terlihat apa-apa, jadi tidak ditawarkan. Aman: keempat angka hanya menggeser keyboard; tangan kedua maskot mengejar tuts yang sedang ditekan lewat hitungan tangan yang terpisah, jadi tangan tetap menempel di tuts.

### J. Hitung mundur bom (template Bom)

**Dulu:** hitung mundur adalah rumus murni (`RM(t)`), bukan angka literal.

**Temuan kode.** `template-bomb.html:144`:
```js
const RM=t=>t<2.8?30:Math.max(1,30-Math.floor((t-2.8)*1.4216)),cdS=t=>t>=23.4?'AMAN':'00:'+String(RM(t)).padStart(2,'0');
```
Angka di dalamnya: `30` = detik awal (muncul dua kali), `2.8` = detik alarm mulai, `1.4216` = kecepatan berkurang (30 detik dibagi ±20,6 detik sampai jinak), `23.4` = detik bom jinak. Jam di dinding dan layar memakai `cdS(t)` yang sama, jadi mengubah rumus ini mengubah ketiga tampilan sekaligus (bom, jam dinding, judul layar).

**Cara edit (J1).** Sisipkan `const CD0=30,T_ALARM=2.8,T_DEFUSE=23.4;` tepat sebelum baris 143 (`// hitung mundur bom: ...`); tulis ulang baris 144 menjadi:
```js
const RM=t=>t<T_ALARM?CD0:Math.max(1,CD0-Math.floor((t-T_ALARM)*(CD0-1)/(T_DEFUSE-T_ALARM))),cdS=t=>t>=T_DEFUSE?'AMAN':'00:'+String(RM(t)).padStart(2,'0');
```
Kecepatan kini DITURUNKAN dari ketiga angka itu (bukan angka mentah lagi): hitung mundur selalu sampai di 00:01 tepat saat bom jinak, berapa pun detik awalnya. Perilaku berubah 0,2 detik dari aslinya (dulu sampai 00:01 sekitar detik 23,2; kini tepat 23,4) — itu perbaikan, bukan kerusakan, dan harus dicatat di PR implementor.

**Pengaturan baru:** `bomb.seconds` — ketik angka 10..60, langkah 1, awal 30. Efek: bom mulai dari angka baru (mis. 00:45) dan berkurang sampai 00:01 tepat saat bom jinak. `T_ALARM` dan `T_DEFUSE` BUKAN pengaturan terpisah — keduanya adalah pengaturan waktu cerita `beat.alarm` dan `beat.defuse` (§M), yang menulis ulang situs-situsnya sendiri; rumus di atas membacanya. Validasi: detik awal ≥ 2; alarm < jinak.

### K. Isi layar / monitor (teks kode, perintah, obrolan)

**Dulu:** isi layar inline di kode gambar layar, edit lewat caption/`typing.lines` saja.

**Temuan kode.** Isi layar yang berupa daftar teks utuh (bisa ditulis ulang utuh, seperti `typing.lines` yang sudah ada):

| Template | Baris | Kutipan |
|---|---|---|
| Mengetik | 132 | `const CODE=['export const Intro = () => {','  const f = useCurrentFrame();', ... (14 baris)];` |
| Deploy | 133 | `const L1=['$ git add .','$ git commit -m "fitur baru, aman"','$ git push origin main'],L2=['$ sed -i s/retrun/return/ *.ts','$ git commit -am fix','$ git push'],ERR=['FAIL  auth.test.ts','  ✕ login mengembalikan token','ReferenceError: retrun is not defined'];` |
| Deploy | 134 | `const RUN1=[[6.4,7.4],[7.4,8.9]],RUN2=[[14.8,15.6],[15.6,17],[17,18.3]];` (tahapan pipeline di layar) |
| Adu Kode | 318–319 | `const CODEL=['export function login(user) {','  const token = sign(user.id)', ... (5 baris)];` dan `const FIXL='  if (!user) return null';` |
| Bom | 181–184 | `const L=t<2.8?[FN,[39,'  const jumlahKopi = 2;','n'], ...]` (4 fase: sebelum alarm / konflik / sesudah hapus tanda / beres — satu blok) |
| Rapat | 147 | `const CHAT=[[2.6,'Budi','Oke, kita mulai ya.',ORG], ... (12 baris [detik, nama, pesan, warna])];` |
| Tidur | 107 | `const PROMPT='buatin video Animasi buat @hanzvibes',...` |
| Tidur | 120 | `const rec=sent?['Video animasi buat hanzvibes']:[];rec.push('Ide konten Reels','Fix bug PWA','Caption Instagram','Naskah video promo');` |

**Cara edit.** Semua daftar di atas ditulis ulang utuh dengan jangkar `whole` yang sudah ada (kecuali Bom dan Tidur-dua):
- `screen.code` (Mengetik: `CODE`, 14 baris; Adu Kode: `CODEL`, 5 baris) — daftar teks; tiap baris maks. 200 huruf; jumlah baris bebas, layar menggulir mengikuti.
- `screen.fix` (Adu Kode: `FIXL`) — teks satu baris; baris kode pengganti yang muncul saat momen perbaikan.
- `screen.cmd1` / `screen.cmd2` / `screen.error` (Deploy: `L1` / `L2` / `ERR`) — daftar teks; tiap baris maks. 200 huruf.
- `screen.pipeline` (Deploy: `RUN1` + `RUN2` sekaligus, satu pengaturan dua situs) — daftar pasangan [mulai, selesai] per tahapan; harus terurut, di dalam durasi video; `RUN1` = sebelum gagal, `RUN2` = sesudah perbaikan. Kopling: batas `RUN1` (8,9) mengikuti `beat.panic`, batas `RUN2` (14,8–18,3) mengikuti `beat.fix`/`beat.done` — geser bersama (lihat §M).
- `screen.editor` (Bom: blok `L`, J7) — ganti blok baris 181–184 utuh; harus tetap 4 fase dengan batas yang sama (`t<2.8`, `t<13`, `t<18.6`, sisanya); batas pertama mengikuti `beat.alarm` — bila alarm digeser, tulis batas pertama itu dengan angka baru di dalam blok. Tiap baris editor = `[nomor baris, teks, tanda]`; teks maks. 200 huruf.
- `screen.chat` (Rapat: `CHAT`) — daftar `[detik, nama, pesan, warna]`; detik terurut 0..durasi; nama maks. 12 huruf; pesan maks. 80 huruf; warna salah satu dari yang sudah ada di template (nama warna, bukan kode). Baris terakhir (`28.4, 'Budi', 'Lanjut besok 07.00 ya 🙂'`) adalah momen kejutan — waktunya mengikuti `beat.twist`.
- `screen.prompt` (Tidur: `PROMPT`) — teks satu baris, maks. 80 huruf; yang diketik maskot di layar.
- `screen.recent` (Tidur: isi `rec.push(...)`) — daftar 1..6 teks pendek (maks. 30 huruf tiap baris); daftar obrolan lama di sisi layar.

Aman: semua ini hanya teks yang digambar di layar; tidak ada yang membaca teksnya selain gambar layar itu sendiri (pengecualian: `PROMPT.length` dipakai untuk menghitung berapa huruf sudah diketik — panjang baru tetap dihitung otomatis, jadi tidak ada yang rusak).

### L. Garis tepi balon kata di template satu maskot

**Dulu:** `claude.color` mengubah bahan maskot saja; garis tepi balon kata di template satu maskot tertulis mati `#d97757` di gaya tampilan dan tidak mengikuti.

**Temuan kode.** Di ke-6 template satu maskot, baris 28–29 (gaya tampilan):
```css
#cap{...border:max(1px,calc(var(--u)*.2)) solid #d97757;...}
#cap::after{...border:max(1px,calc(var(--u)*.2)) solid #d97757;...}
```
(Kode `#d97757` muncul di banyak tempat lain di file — judul kecil, tombol, poster, jendela — tapi HANYA dua baris di atas yang merupakan garis tepi balon kata. Yang lain sengaja tidak disentuh.)

**Cara edit (J6).** Perilaku `claude.color` diperluas di 6 template satu maskot: selain menulis ulang bahan maskot (`OR=M(0x...)`, seperti sekarang), ia JUGA menulis ulang `#d97757` di kedua aturan `#cap` dan `#cap::after` di atas. Di template 2–3 maskot tidak ada yang berubah (di sana warna balon sudah mengikuti `CC[i]` yang disinkronkan otomatis, seperti sekarang).

**Pengaturan:** `claude.color` (id lama, perilaku diperluas) — pemilih warna, awal `#d97757`. Efek: maskot oranye DAN garis tepi balon katanya berubah warna bersamaan.

### M. Waktu cerita (beat) — semua template

**Dulu:** mengubah satu angka waktu saja merusak sinkron cerita (papan + layar + teks + kamera membaca momen yang sama).

**Temuan kode + cara edit (J1 + J5 + `assign` untuk yang sudah berupa konstanta).** Ada dua bentuk di kode:
1. **Sudah berupa konstanta bernama** — Adu Kode baris 405: `const T_BOARD=3.2,T_REF=9.8,T_BUG=15.6,T_FIX=21,T_TIE=22.8;` — tulis ulang angkanya dengan jangkar `assign` yang sudah ada. Rapat `MEET_END=24.2` (baris 144) sudah bisa (id lama `meeting.end`).
2. **Tertulis langsung di banyak tempat** — semua template lain. Caranya: sisipkan SATU konstanta bernama sebelum `function frame(t){` (atau sebelum fungsi yang memakainya — lihat tabel), lalu tulis ulang SETIAP situs yang terdaftar menjadi `T` atau `T+offset` (offset = selisih dari momen utama, supaya lebar jendela tidak berubah). Tabel situs lengkap ada di bawah ini per template. **Situs yang tidak terdaftar (mis. teks caption dan shot kamera) harus digeser manual dalam spec yang sama** — itu aturan pakai, bukan kekurangan mekanisme (sama seperti `meeting.end` yang sudah ada: "caps/shots di sekitar nilai lama tetap harus digeser di spec yang sama").

**Aturan jaga (semua beat):** 0 < T < durasi video; urutan momen dalam satu template harus terjaga (lihat kolom "Urutan"); bila dua pengaturan beat berbagi satu batas (mis. akhir satu momen = awal momen lain), tabel menuliskannya sebagai rujukan silang (`BEAT_X`) — implementor harus menulis rujukan itu, bukan angka mentah.

#### M1. Adu Kode (5 momen, semua konstanta — paling mudah)

| Pengaturan | Awal | Rentang | Urutan | Situs (sudah konstanta, tidak ada situs tambahan kecuali yang dicatat) |
|---|---|---|---|---|
| `beat.board` | 3,2 | 1..6 | 1 | `T_BOARD`, baris 405. Papan skor masuk. |
| `beat.refactor` | 9,8 | 7..12 | 2 | `T_REF`, baris 405. Mulai mengetik ulang. |
| `beat.bug` | 15,6 | 13..18 | 3 | `T_BUG`, baris 405, DITAMBAH dua angka mentah di baris 414 yang ternyata offset dari momen ini: `s2(T_BUG,16.6)` → `s2(T_BUG,T_BUG+1)` dan `s2(15.2,15.6)` → `s2(T_BUG-.4,T_BUG)`. Keduanya ikut digeser. Momen error bareng. |
| `beat.fix` | 21 | 19..24 | 4 | `T_FIX`, baris 405. Perbaikan hijau. |
| `beat.tie` | 22,8 | 21..27 | 5 | `T_TIE`, baris 405. Seri + gabung. |

#### M2. Rapat (1 momen baru; rapat selesai sudah ada)

| Pengaturan | Awal | Rentang | Situs |
|---|---|---|---|
| `beat.twist` | 28,4 | 26..31 | Sisipkan `const T_TWIST=28.4;` sebelum `function frame(t){` (270). Situs: baris 186 `ss(t,28.2,28.6)` → `ss(t,T_TWIST-.2,T_TWIST+.2)` (kartu kalender muncul); baris 279 `joy=...*(1-s2(28,28.4))` → `(1-s2(T_TWIST-.4,T_TWIST))`; baris 280 `tw=s2(28.4,28.8)` → `s2(T_TWIST,T_TWIST+.4)`; baris 313 `drawNote(t>=28.4?'besok':'lima')` → `t>=T_TWIST?...`. Kopling: baris obrolan terakhir di `screen.chat` (waktu 28,4) + caption 26,8–28,7 / 28,9–31 digeser bersama. |

#### M3. Bom (2 momen)

| Pengaturan | Awal | Rentang | Situs (semua jadi `T` / `T+offset`; `T_ALARM`/`T_DEFUSE` adalah konstanta dari §J — satu konstanta dipakai bersama) |
|---|---|---|---|
| `beat.alarm` | 2,8 | 1..5 | Baris 153 `ss(t,2.8,3.2)` → `ss(t,T,T+.4)`, `t>=2.8&&t<18.6` → `t>=T&&t<18.6`; 157 `t>=2.8?RED` → `t>=T?RED`; 163 `if(t>=2.8)` → `if(t>=T)`; 176 `t<2.8?'SIAP'` → `t<T?'SIAP'`; 181 `const L=t<2.8?...` → `t<T?...` (di dalam `screen.editor`, ikut digeser bila blok itu diedit); 190 `if(t>=2.8&&t<13)` → `if(t>=T&&t<13)`; 192 `t<2.8?...` → `t<T?...`; 198 `t>=2.8?...(t-2.8)/.7` → `t>=T?...(t-T)/.7`; 269 `s2(2.8,3.2)` → `s2(T,T+.4)`; 270 `s2(2.8,3.2)` (dua kali) → sama; 273 `(t>2.8&&t<3.37)?...(t-2.8)/.57` → `(t>T&&t<T+.57)?...(t-T)/.57`; 283 `1-s2(2.8,3.1)` → `1-s2(T,T+.3)`; 284 `s2(2.8,3.1)` (dua kali) → `s2(T,T+.3)`; 299 `t<2.8?1:0` → `t<T?1:0`. (Baris 144 rumus hitung mundur membaca konstanta yang sama — lihat §J. Komentar baris 143/256 dan shot t=2,8 tidak perlu diubah; shot digeser lewat editor shot.) |
| `beat.defuse` | 23,4 | 20..27 | Baris 153 `(1-ss(t,23.2,23.6))` → `(1-ss(t,T-.2,T+.2))`; 157 `t>=23.4?GRN` → `t>=T?GRN`; 170 `if(t>=23.4)` → `if(t>=T)`; 192 `t<23.4?...` → `t<T?...`, `t<21.9?...` → `t<T-1.5?...`; 198 `t>=23.4?...(t-23.4)/.4` → `t>=T?...(t-T)/.4`; 241 `23.4+Math.pow(u,1.5)*2.6` → `T+Math.pow(u,1.5)*2.6` (percikan mulai); 245 `(ts-23.4)*5` → `(ts-T)*5`; 268 `(1-s2(22.6,23.4))` → `(1-s2(T-.8,T))`; 270 `(1-s2(23.2,23.6))` → `(1-s2(T-.2,T+.2))`, `s2(23.4,23.9)` → `s2(T,T+.5)`; 271 `s2(23.4,23.8)` → `s2(T,T+.4)`, `s2(23.4,23.9)` → `s2(T,T+.5)`, `s2(23.6,27)` → `s2(T+.2,T+3.6)`; 274 `(t-23.4)*5` → `(t-T)*5`; 279 `s2(23.4,23.8)` → `s2(T,T+.4)`; 282 `t>=23.4&&t<27.6` → `t>=T&&t<T+4.2`; 283 `s2(23.9,24.2)` → `s2(T+.5,T+.8)`, `1-s2(23.9,24.4)` → `1-s2(T+.5,T+1)`; 285 `s2(23.4,23.9)` → `s2(T,T+.5)`; 286 `t>=23.4?GRN` → `t>=T?GRN`; 290 `s2(23.4,23.9)` → `s2(T,T+.5)`; 294 `t>=23.4?...(t-23.4)/.5` → `t>=T?...(t-T)/.5`. (Baris 144 `cdS` membaca konstanta yang sama — lihat §J.) |

#### M4. Pemburu Bug (2 momen)

| Pengaturan | Awal | Rentang | Situs |
|---|---|---|---|
| `beat.alarm` | 2 | 1..4 | Sisipkan `const T_ALARM=2;` sebelum `function frame(t){` (259). Situs: baris 146 `ss(t,2,3)` → `ss(t,T,T+1)`; 156 `ss(t,2,2.4)` → `ss(t,T,T+.4)`; 165 `if(t<2)` → `if(t<T)`; 189 `ss(t,2.4,3)` → `ss(t,T+.4,T+1)`; 200 `t>=2?...(t-2)/.7` → `t>=T?...(t-T)/.7`; 264 `s2(2,2.4)` (dua kali) → `s2(T,T+.4)`; 265 `1-s2(1.8,2.2)` → `1-s2(T-.2,T+.2)`; 267 `(t>2&&t<2.57)?...(t-2)/.57` → `(t>T&&t<T+.57)?...(t-T)/.57`; 291 `t<2.2?1:0` → `t<T+.2?1:0`. |
| `beat.squash` | 23,4 | 20..27 | Sisipkan `const T_SQUASH=23.4;` sebelum `function frame(t){` (259). Situs: baris 146 `(1-ss(t,23.4,24.8))` → `(1-ss(t,T,T+1.4))`; 147 `Math.min(t,23.4)` → `Math.min(t,T)`; 156 `(1-ss(t,23.4,23.9))` → `(1-ss(t,T,T+.5))`; 175 `if(t>=23.4)` → `if(t>=T)`; 182 `t>=23.4?'PULIH'` → `t>=T?'PULIH'`; 189 `(1-ss(t,23.8,24.6))` → `(1-ss(t,T+.4,T+1.2))`, `ss(t,23.4,23.7)` → `ss(t,T,T+.3)`; 191 `(1-ss(t,23.4,23.7))` → `(1-ss(t,T,T+.3))`; 192 `Math.min(t,23.4)` → `Math.min(t,T)`; 197 `if(t>=23.4&&t<24.4)` + `(t-23.4)/1` → `if(t>=T&&t<T+1)` + `(t-T)/1`; 200 `t>=23.4?...(t-23.4)/.4` → `t>=T?...(t-T)/.4`; 235 `23.4+Math.pow(u,1.5)*2.6` → `T+Math.pow(u,1.5)*2.6`; 239 `(ts-23.4)*5` → `(ts-T)*5`; 262 `(1-s2(22.6,23.4))` → `(1-s2(T-.8,T))`; 264 `(1-s2(23.4,23.9))` → `(1-s2(T,T+.5))`; 265 `s2(23.4,23.8)` → `s2(T,T+.4)`, `s2(23.4,23.9)` → `s2(T,T+.5)`, `s2(23.6,27)` → `s2(T+.2,T+3.6)`; 268 `(t-23.4)*5` → `(t-T)*5`; 273 `s2(23.4,23.8)` → `s2(T,T+.4)`; 277 `t>=23.4&&t<27.6` → `t>=T&&t<T+4.2`; 278 `Math.min(t,23.4)/23.4*227` → `Math.min(t,T)/T*227` (jam dinding: 120 menit → 347 menit selama 0..T); 282 `s2(23.4,23.9)` → `s2(T,T+.5)`; 286 `t>=23.4?...(t-23.4)/.5` → `t>=T?...(t-T)/.5`. |

#### M5. Tidur (4 momen)

| Pengaturan | Awal | Rentang | Situs (sisipkan keempat konstanta sebelum `function frame(t){` baris 235) |
|---|---|---|---|
| `beat.wake` | 12 | 10..14 | Baris 140 `t<12` → `t<T_WAKE` (huruf "z" mengambang); 238 `s=1-s2(12,12.6)` → `1-s2(T_WAKE,T_WAKE+.6)`, `st=s2(12,12.2)*(1-s2(13.8,14))` → `s2(T_WAKE,T_WAKE+.2)*(1-s2(T_WAKE+1.8,T_WAKE+2))`, `wbF=...*(1-s2(11.6,12))` → `*(1-s2(T_WAKE-.4,T_WAKE))`; 240 hop `(t>=12&&t<14?...(t-12)...s2(12.8,13.4)...s2(13.6,14))` → `(t>=T_WAKE&&t<T_WAKE+2?...(t-T_WAKE)...s2(T_WAKE+.8,T_WAKE+1.4)...s2(T_WAKE+1.6,T_WAKE+2))`; 251 `pop(12,13.6)` → `pop(T_WAKE,T_WAKE+1.6)` (tanda seru). Kopling: caption 9–12 / 12–14 + shot t=12. |
| `beat.work` | 14 | 12..16 | Baris 238 `wk=s2(14,14.5)` → `s2(T_WORK,T_WORK+.5)` (ujungnya milik `beat.work.end`); 239 `t>=14&&t<22?...(t-14)...` → `t>=T_WORK&&t<T_WORK_END?...(t-T_WORK)...`; 240 `Math.sin((t-14)*7)` → `(t-T_WORK)`; 241 `t<14?0:t<22?(t-14)/8*100:100` → `t<T_WORK?0:t<T_WORK_END?(t-T_WORK)/(T_WORK_END-T_WORK)*100:100` (angka 8 diganti selisih kedua momen); 244 `Math.sin((t-14)*Math.PI/2)` → `(t-T_WORK)`; 245 `sm(cl((t-13.5)/.5,0,1))` → `sm(cl((t-(T_WORK-.5))/.5,0,1))`. Urutan: `beat.wake` < `beat.work` < `beat.work.end`. |
| `beat.work.end` | 22 | 18..26 | Baris 238 `wk=...*(1-s2(21.5,22))` → `*(1-s2(T_END-.5,T_END))`, `hpy=s2(22,22.5)*(1-s2(24.7,25.2))` → `s2(T_END,T_END+.5)*(1-s2(T_END+2.7,T_END+3.2))`; 240 `(t>=22&&t<25?...(t-22)...s2(24.2,25))` → `(t>=T_END&&t<T_END+3?...(t-T_END)...s2(T_END+2.2,T_END+3))`; 256 `parts.visible=t>=22&&t<26.2` → `t>=T_END&&t<T_END+4.2`. Kopling: shot t=22 + caption 25–28. |
| `beat.sleep` | 28 | 26..31 | Baris 238 `s=...+s2(28,29.5)` → `+s2(T_SLEEP,T_SLEEP+1.5)`, `hpF=...*(1-s2(27.6,28))` → `*(1-s2(T_SLEEP-.4,T_SLEEP))`; 245 `-.25*sm(cl((t-27)/1,0,1))` → `-.25*sm(cl((t-(T_SLEEP-1))/1,0,1))`. Kopling: caption 25–28 + shot t=28. |

#### M6. Versus (4 momen)

| Pengaturan | Awal | Rentang | Situs (sisipkan konstanta sebelum `function frame(t){` baris 197) |
|---|---|---|---|
| `beat.debate` | 9 | 6..12 | Baris 200 `ar=s2(9,10.2)` → `s2(T,T+1.2)`, `fe=s2(10.5,11)` → `s2(T+1.5,T+2)`. (Ujung debat milik `beat.tired`.) |
| `beat.tired` | 16,5 | 14..19 | Baris 200 `ar=...*(1-s2(16.5,18))` → `*(1-s2(T,T+1.5))`, `tr=s2(16.5,17.5)` → `s2(T,T+1)`, `fe=...*(1-s2(16,16.5))` → `*(1-s2(T-.5,T))`. (Ujung lelah milik `beat.joy`.) |
| `beat.tie` | 19 | 17..21 | Baris 212 `q=s2(18,19)` → `s2(T-1,T)`, `drawBoard(va,vb,t>=19?1:0)` → `t>=T?1:0`. |
| `beat.joy` | 21 | 19..24 | Baris 200 `tr=...*(1-s2(20.5,21.5))` → `*(1-s2(T-.5,T+.5))`, `jy=s2(21,22)` → `s2(T,T+1)`; 205 putaran `6.2832*s2(21.6,23.2)` → `s2(T+.6,T+2.2)`; 215 percikan `(t>=21&&t<25.8)` → `(t>=T&&t<T+4.8)`. |

#### M7. Trio (3 momen)

| Pengaturan | Awal | Rentang | Situs (sisipkan konstanta sebelum `function frame(t){` baris 219) |
|---|---|---|---|
| `beat.debate` | 12 | 9..15 | Baris 222 `ar=s2(12,13)` → `s2(T,T+1)`. (Ujung debat milik `beat.tired`.) |
| `beat.tired` | 20,5 | 18..23 | Baris 222 `ar=...*(1-s2(20,21))` → `*(1-s2(T-.5,T+.5))`, `tr=s2(20.5,21.5)*(1-s2(23,24))` → `s2(T,T+1)*(1-s2(T+2.5,T+3.5))`; 234 `q=s2(20.5,22.5)` → `s2(T,T+2)`, seri `t>=22.6?1:0` → `t>=T+2.1?1:0`. |
| `beat.joy` | 26 | 24..29 | Baris 222 `jy=s2(26,27)` → `s2(T,T+1)`; 226 putaran `6.2832*s2(26.6,28.2)` → `s2(T+.6,T+2.2)`; 239 percikan `(t>=26.3&&t<30.3)` → `(t>=T+.3&&t<T+4.3)`. |

#### M8. Kuota (4 momen — semuanya terikat kurva tangki)

| Pengaturan | Awal | Rentang | Situs (sisipkan konstanta sebelum `function frame(t){` baris 268) |
|---|---|---|---|
| `beat.empty` | 15,2 | 13..18 | Baris 272 `al=s2(15.2,15.6)` → `s2(T,T+.4)`; 299 mode layar `t<15.2?0` → `t<T?0`; 307 guncangan `t>=15.2?...(t-15.2)/.5` → `t>=T?...(t-T)/.5`. Kopling WAJIB: baris kurva tangki `[15.1,6],[15.3,3]` digeser lewat `tank.curve` ke `[T-.1,6],[T+.1,3]` — kalau tidak, alarm berbunyi padahal tangki belum habis (atau sebaliknya). |
| `beat.frugal` | 20,8 | 18..23 | Baris 272 `ty=s2(20.8,21.3)` → `s2(T,T+.5)`; 296 label `t>=20.8&&t<27` → `t>=T&&t<BEAT_RESET` (ujungnya momen reset, bukan angka); 299 `t<20.6?1` → `t<T-.2?1`, `prg=...s2(20.8,24.4)` → `s2(T,T+3.6)`; kopling kurva tangki `[20.8,3],[24.4,2]` → `[T,3],[T+3.6,2]`. |
| `beat.reset` | 27 | 25..29 | Baris 272 `jy=...*(1-s2(27,27.6))` → `*(1-s2(T,T+.6))`; 296 `t>=27&&t<29` → `t>=T&&t<T+2`; 298 `rf=pop(27,28.8)` → `pop(T,T+1.8)`; 299 `t<27.7?3` → `t<T+.7?3`; kopling kurva tangki `[27,2],[27.9,100]` → `[T,2],[T+.9,100]`. |
| `beat.relapse` | 31 | 29..33 | Baris 272 `al=...+s2(31,31.4)` → `+s2(T,T+.4)`; 299 `t<31?0:1` → `t<T?0:1`; 307 `t>=31?...` → `t>=T?...`; kopling kurva tangki `[31.1,0]` → `[T+.1,0]`. |

#### M9. Rival (4 momen)

| Pengaturan | Awal | Rentang | Situs (sisipkan konstanta sebelum `function frame(t){` baris 225) |
|---|---|---|---|
| `beat.alert` | 15,2 | 13..18 | Baris 228 `al=s2(15.2,15.6)` → `s2(T,T+.4)`; 250 mode layar `t<15.2?0` → `t<T?0`; guncangan kamera (baris setelah 254) `t>=15.2?...(t-15.2)/.5` → `t>=T?...(t-T)/.5`; 251 papan `LV=...*(1-s2(16.5,19.5))` → `*(1-s2(T+1.3,T+4.3))`. |
| `beat.teamwork` | 20,8 | 18..23 | Baris 228 `ty=s2(20.8,21.3)` → `s2(T,T+.5)`; 250 `t<20.6?1` → `t<T-.2?1`, `prg=...s2(20.8,24.4)` → `s2(T,T+3.6)`; 249 label `t>=20.8&&t<29` → `t>=T&&t<BEAT_RELAPSE`. |
| `beat.joy` | 24,6 | 22..27 | Baris 228 `jy=s2(24.6,25.1)` → `s2(T,T+.5)`; 250 `t<25?2` → `t<T+.4?2`; 254 percikan `(t>=24.6&&t<28.6)` → `(t>=T&&t<T+4)`. |
| `beat.relapse` | 29,2 | 27..32 | Baris 228 `cs=...s2(29.2,29.9)` → `s2(T,T+.7)`, `ar=...+s2(27.8,28.3)` → `+s2(T-1.4,T-.9)`; 250 `t<29.4?3` → `t<T+.2?3`; 251 `LV=...+85*s2(29.2,31.2)` → `+85*s2(T,T+2)`. |

#### M10. Perang (5 momen — semua di dalam `FA(t)` + `frame()`)

| Pengaturan | Awal | Rentang | Situs |
|---|---|---|---|
| `beat.war` | 12,8 | 10..15 | Baris 230 (di `FA`, baris 229–230) `war:s2(12.8,13.4)` → `s2(T,T+.6)`, `mar:s2(12.6,14.6)` → `s2(T-.2,T+1.8)`; 232 `mr=s2(12.6+.1*i,14.4+.1*i)` → `s2(T-.2+.1*i,T+1.6+.1*i)`; 323 label `t>=12.8&&t<20.8` → `t>=T&&t<BEAT_TRUCE`. (Ujung perang milik `beat.truce`.) |
| `beat.truce` | 20,8 | 18..23 | Baris 230 `war=...*(1-s2(20.4,21))` → `*(1-s2(T-.4,T+.2))`, `ko:s2(19.4,20)*(1-s2(21.6,22.4))` → `s2(T-1.4,T-.8)*(1-s2(T+.8,T+1.6))`, `fl:pop(20.8,23.4)` → `pop(T,T+2.6)`, `pz:s2(22.4,23.6)` → `s2(T+1.6,T+2.8)`; 232 `pz=s2(22.4,23.6)` → `s2(T+1.6,T+2.8)`; 323 `t>=20.8&&t<25` → `t>=T&&t<T+4.2`. |
| `beat.intern` | 23,6 | 21..26 | Baris 230 `jy=...*(1-s2(24.2,24.8))` → `*(1-s2(T+.6,T+1.2))`; 308 `iv=s2(23.6,24.1)` → `s2(T,T+.5)`, `iw=s2(23.8,24.8)` → `s2(T+.2,T+1.2)`, `pa=s2(24.8,25.2)` → `s2(T+1.2,T+1.6)`, `ex=s2(26.2,27.2)` → `s2(T+2.6,T+3.6)`; 323 `t>=25?'TOMBOL: BIRU ✓'` → `t>=T+1.4?...`. |
| `beat.punch` | 14,9 | 14..16 | Baris 227 `FT0=14.9` (dalam `const P=1.2,FT0=14.9,...`) — tulis ulang angkanya. Dipakai otomatis oleh tabel pukulan (baris 243) dan ayunan lengan (baris 281). Pukulan pertama. |
| `beat.punch.gap` | 1,2 | 0,8..1,6 | Baris 227 `P=1.2` (dalam baris yang sama) — tulis ulang angkanya. Jarak antar pukulan di tabel dampak (baris 243). Catatan: ayunan lengan memakai putaran 0,9 yang tetap — mengubah jarak ini menggeser kilau benturan, bukan ayunan lengan. |

#### M11. Mengetik (2 momen) & Deploy (4 momen)

| Pengaturan | File | Awal | Rentang | Situs |
|---|---|---|---|---|
| `beat.typing` | Mengetik | 3 | 1..5 | Sisipkan `const T_TYPE=3;` sebelum `function frame(t){` (204). Situs: baris 114 `stroke`: `(t-3.3)*5` → `(t-(T_TYPE+.3))*5`; 137 penghitung ketikan `Math.max(0,t-3.3)*10` → `(t-(T_TYPE+.3))`; 206 `sm(cl((t-3)/.5,0,1))` → `(t-T_TYPE)`, `Math.sin((t-3)*1.1)` → `(t-T_TYPE)`, `p=t<3?0:t<15?(t-3)/12*100:100` → `t<T_TYPE?0:t<BEAT_DONE?(t-T_TYPE)/(BEAT_DONE-T_TYPE)*100:100`; 208 `t<3` → `t<T_TYPE`, `(t-2.4)` → `(t-(T_TYPE-.6))`; 210 `sm(cl((t-2.6)/1,0,1))` → `(t-(T_TYPE-.4))`; 211 `1-sm(cl((t-2.6)/.6,0,1))` → `(t-(T_TYPE-.4))`. |
| `beat.done` | Mengetik | 15 | 12..18 | Situs: baris 206 `sw=...*(1-sm(cl((t-14.5)/.5,0,1)))` → `*(1-sm(cl((t-(T_DONE-.5))/.5,0,1)))`, `cel=t>=15&&t<19` → `t>=T_DONE&&t<T_DONE+4`, `happy=...t>=15` → `t>=T_DONE`, `p=...t<15?...:100` → `t<T_DONE?...:100` (penyebut 12 jadi `BEAT_DONE−BEAT_TYPING`, lihat atas); 208 `else if(t<15)` → `t<T_DONE`, `(t-15)*5` → `(t-T_DONE)*5`, `(t-17.8)` → `(t-(T_DONE+2.8))`, `(t-19)` → `(t-(T_DONE+4))`; 210 `sm(cl((t-14.4)/1.2,0,1))` → `(t-(T_DONE-.6))`, `sm(cl((t-16)/1.6,0,1))` → `(t-(T_DONE+1))`; 211 `sm(cl((t-14.6)/.6,0,1))` → `(t-(T_DONE-.4))`; 215 `t>=15&&t<19.2` → `t>=T_DONE&&t<T_DONE+4.2`. |
| `beat.typing` | Deploy | 3 | 1..5 | Situs: baris 114 `stroke`: cabang pertama `(t<10?3.3:12.3)` → `(t<10?T_TYPE+.3:BEAT_FIX)` (cabang kedua milik `beat.fix`); 209 `sw=s2(3,3.5)` → `s2(T_TYPE,T_TYPE+.5)`, `fm=s2(2.6,3.6)` → `s2(T_TYPE-.4,T_TYPE+.6)`, `sy=Math.sin((t-3)*1.1)` → `(t-T_TYPE)`, `hF=1-s2(2.6,3.2)` → `1-s2(T_TYPE-.4,T_TYPE+.2)`; 210 hop `s2(2.4,3)` → `s2(T_TYPE-.6,T_TYPE)`. |
| `beat.panic` | Deploy | 9 | 7..11 | Situs: baris 209 `pa=s2(9,9.5)*(1-s2(11.8,12.4))` → `s2(T,T+.5)*(1-s2(T+2.8,T+3.4))`, `fm=...*(1-s2(8.6,9.4))` → `*(1-s2(T-.4,T+.4))`; kopling: tahapan pipeline `RUN1` (akhir 8,9 = T−0,1) digeser lewat `screen.pipeline`. |
| `beat.fix` | Deploy | 12,3 | 10..14 | Situs: baris 114 `stroke`: cabang kedua `12.3` → `T_FIX`; 209 `sw=...+s2(12.2,12.6)` → `+s2(T_FIX-.1,T_FIX+.3)`, `fm=...+s2(11.6,12.4)` → `+s2(T_FIX-.7,T_FIX+.1)`; kopling: `RUN2` (14,8 = T+2,5 dst.) digeser lewat `screen.pipeline`. |
| `beat.done` | Deploy | 18,4 | 16..21 | Situs: baris 183 percikan `18.4+Math.pow(u,1.5)*2.6` → `T_DONE+Math.pow(u,1.5)*2.6`; 187 `(ts-18.4)*5` → `(ts-T_DONE)*5`; 209 `cel=s2(18.4,18.8)*(1-s2(22.4,23))` → `s2(T_DONE,T_DONE+.4)*(1-s2(T_DONE+4,T_DONE+4.6))`, `hF=...+s2(18.4,19)` → `+s2(T_DONE,T_DONE+.6)`, `fm=...*(1-s2(17.4,18.2))` → `*(1-s2(T_DONE-1,T_DONE-.2))`; 210 `(t-18.4)*5` → `(t-T_DONE)*5`, `(1-s2(21,22.4))` → `(1-s2(T_DONE+2.6,T_DONE+4))`; 212 putaran `s2(18.8,20.4)` → `s2(T_DONE+.4,T_DONE+2)`; 215 `s2(18.4,18.8)*(1-s2(22.4,23))` → sama seperti `cel`; 218 `t>=18.4&&t<22.6` → `t>=T_DONE&&t<T_DONE+4.2`; kopling: `RUN2` (akhir 18,3 = T−0,1) lewat `screen.pipeline`. |

### N. Deretan mug di template Rapat

**Dulu:** `mug.x` nonaktif di Rapat ("tidak punya mug di set-nya") — padahal ada TIGA mug yang muncul satu per satu.

**Temuan kode.** `template-meeting.html:192–193`:
```js
function mkMug(x,z){const g=new THREE.Group();g.position.set(x,0,z);...}
const mugs=[mkMug(1.1,.4),mkMug(1.58,.4),mkMug(2.06,.4)];mugs.forEach(m=>{m.scale.setScalar(.001);m.visible=false});
```
Tiga angka `1.1 / 1.58 / 2.06` = satu deret dengan jarak 0,48. (Mug keempat yang dipegang tangan adalah `heldMug` terpisah, baris 197 — tidak disentuh.)

**Cara edit (J1).** Sisipkan `const MUG_X=1.1,MUG_GAP=.48;` sebelum baris 193; tulis ulang baris 193 menjadi `const mugs=[mkMug(MUG_X,.4),mkMug(MUG_X+MUG_GAP,.4),mkMug(MUG_X+2*MUG_GAP,.4)];`.

**Pengaturan baru:** `mug.row` — geser 0,5..2, langkah 0,05, awal 1,1 (posisi mug pertama); `mug.gap` — geser 0,3..0,7, langkah 0,05, awal 0,48 (jarak antar mug). Efek: deretan tiga mug bergeser / merenggang di atas meja. Jaga: mug pertama + 2×jarak ≤ 2,6 supaya tidak jatuh dari meja.

---

## §3 — Matriks per template

Aturan kolom: **Pengaturan** = id teknis untuk implementor. **Nama awam** dan **Yang berubah** = bahasa sehari-hari, tanpa istilah dalam. **Kontrol**: Geser = slider; Warna = pemilih warna; Ketik = teks/angka; Daftar = daftar yang bisa diedit barisnya; Pilihan = pilih salah satu. **Rentang & awal** = angka yang harus dipakai UI/CLI (desimal memakai koma seperti di dokumen ini).

### 1. Versus — `template.html` · durasi 28 detik · 8 pengaturan lama + 12 baru = **20**

| Pengaturan | Nama awam | Kontrol | Rentang & awal | Yang berubah |
|---|---|---|---|---|
| `claude.x` | Maskot oranye — kiri-kanan | Geser | −3..3, langkah 0,05, awal −1,7 | Maskot oranye bergeser ke kiri atau ke kanan di atas panggung. |
| `codex.x` | Maskot biru — kiri-kanan | Geser | −3..3, langkah 0,05, awal 1,7 | Maskot biru bergeser ke kiri atau ke kanan di atas panggung. |
| `codex.scale` | Maskot biru — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 0,85 | Maskot biru membesar atau mengecil. |
| `claude.scale` | Maskot oranye — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 1 | Maskot oranye membesar atau mengecil. |
| `claude.z` | Maskot oranye — maju-mundur | Geser | −1..1, langkah 0,05, awal 0 | Maskot oranye maju ke arah penonton atau mundur ke arah layar. |
| `codex.z` | Maskot biru — maju-mundur | Geser | −1..1, langkah 0,05, awal 0 | Maskot biru maju ke arah penonton atau mundur ke arah layar. |
| `eyes.tilt` | Mata — kemiringan | Geser | −0,5..0,5, langkah 0,05, awal 0 | Mata kedua maskot miring seperti marah (ke bawah) atau seperti senang (ke atas). |
| `face.codex` | Wajah di layar biru | Pilihan | −1 ikut cerita (awal), 0 biasa, 1 marah, 2 senang, 3 lelah | Wajah yang tampil di layar biru berubah dan bertahan sepanjang video. |
| `claude.color` | Maskot oranye — warna | Warna | awal `#d97757` | Warna maskot oranye, layar kecilnya, dan papan namanya berubah. |
| `codex.color` | Maskot biru — warna | Warna | awal `#7b8cff` | Warna maskot biru, layar kecilnya, dan papan namanya berubah. |
| `board.y` | Papan skor — tinggi | Geser | 2,5..6,5, langkah 0,1, awal 4,5 | Papan skor naik atau turun di dinding. |
| `board.base` | Papan — angka awal | Geser | 0..90, langkah 1, awal 55 | Angka papan di awal debat berubah. |
| `board.swing` | Papan — naik-turun angka | Geser | 0..45, langkah 1, awal 38 | Angka papan naik-turun lebih lebar atau lebih tenang selama debat. |
| `board.final` | Papan — angka akhir | Geser | 0..100, langkah 1, awal 90 | Angka akhir papan saat hasil seri ditunjukkan berubah. |
| `monitor.claude.x` | Layar oranye — kiri-kanan | Geser | −3..3, langkah 0,05, awal −1,5 | Layar kecil di belakang maskot oranye bergeser ke kiri atau ke kanan. |
| `monitor.codex.x` | Layar biru — kiri-kanan | Geser | −3..3, langkah 0,05, awal 1,5 | Layar kecil di belakang maskot biru bergeser ke kiri atau ke kanan. |
| `beat.debate` | Cerita — waktu mulai debat | Geser | 6..12 detik, langkah 0,1, awal 9 | Debat panas dimulai lebih awal atau lebih lambat. |
| `beat.tired` | Cerita — waktu mulai lelah | Geser | 14..19 detik, langkah 0,1, awal 16,5 | Kedua maskot mulai lelah lebih awal atau lebih lambat. |
| `beat.tie` | Cerita — waktu seri | Geser | 17..21 detik, langkah 0,1, awal 19 | Papan menunjukkan hasil seri lebih awal atau lebih lambat. |
| `beat.joy` | Cerita — waktu senang | Geser | 19..24 detik, langkah 0,1, awal 21 | Kedua maskot bersorak dan berputar lebih awal atau lebih lambat. |

### 2. Trio — `template-trio.html` · durasi 32 detik · 12 lama + 12 baru = **24**

| Pengaturan | Nama awam | Kontrol | Rentang & awal | Yang berubah |
|---|---|---|---|---|
| `claude.x` | Maskot oranye — kiri-kanan | Geser | −3..3, langkah 0,05, awal −2,6 | Maskot oranye bergeser ke kiri atau ke kanan di atas panggung. |
| `codex.x` | Maskot biru — kiri-kanan | Geser | −3..3, langkah 0,05, awal 0 | Maskot biru bergeser ke kiri atau ke kanan di atas panggung. |
| `gemini.x` | Maskot ungu — kiri-kanan | Geser | −3..3, langkah 0,05, awal 2,6 | Maskot ungu bergeser ke kiri atau ke kanan di atas panggung. |
| `codex.scale` | Maskot biru — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 0,85 | Maskot biru membesar atau mengecil. |
| `gemini.scale` | Maskot ungu — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 0,85 | Maskot ungu membesar atau mengecil. |
| `claude.scale` | Maskot oranye — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 1 | Maskot oranye membesar atau mengecil. |
| `claude.z` | Maskot oranye — maju-mundur | Geser | −1..1, langkah 0,05, awal 0 | Maskot oranye maju ke arah penonton atau mundur ke arah layar. |
| `codex.z` | Maskot biru — maju-mundur | Geser | −1..1, langkah 0,05, awal 0 | Maskot biru maju ke arah penonton atau mundur ke arah layar. |
| `gemini.z` | Maskot ungu — maju-mundur | Geser | −1..1, langkah 0,05, awal 0 | Maskot ungu maju ke arah penonton atau mundur ke arah layar. |
| `eyes.tilt` | Mata — kemiringan | Geser | −0,5..0,5, langkah 0,05, awal 0 | Mata ketiga maskot miring seperti marah atau seperti senang. |
| `face.codex` | Wajah di layar biru | Pilihan | −1 ikut cerita (awal), 0 biasa, 1 marah, 2 senang, 3 lelah | Wajah yang tampil di layar biru berubah dan bertahan sepanjang video. |
| `claude.color` | Maskot oranye — warna | Warna | awal `#d97757` | Warna maskot oranye, layar kecilnya, dan papan namanya berubah. |
| `codex.color` | Maskot biru — warna | Warna | awal `#7b8cff` | Warna maskot biru, layar kecilnya, dan papan namanya berubah. |
| `gemini.color` | Maskot ungu — warna | Warna | awal `#b794f6` | Warna maskot ungu, layar kecilnya, dan papan namanya berubah. |
| `board.y` | Papan skor — tinggi | Geser | 2,5..6,5, langkah 0,1, awal 4,7 | Papan skor naik atau turun di dinding. |
| `board.base` | Papan — angka awal | Geser | 0..90, langkah 1, awal 55 | Angka papan di awal debat berubah. |
| `board.swing` | Papan — naik-turun angka | Geser | 0..45, langkah 1, awal 38 | Angka papan naik-turun lebih lebar atau lebih tenang selama debat. |
| `board.final` | Papan — angka akhir | Geser | 0..100, langkah 1, awal 90 | Angka akhir papan saat hasil seri ditunjukkan berubah. |
| `monitor.claude.x` | Layar oranye — kiri-kanan | Geser | −3..3, langkah 0,05, awal −2,6 | Layar kecil di belakang maskot oranye bergeser ke kiri atau ke kanan. |
| `monitor.codex.x` | Layar biru — kiri-kanan | Geser | −3..3, langkah 0,05, awal 0 | Layar kecil di belakang maskot biru bergeser ke kiri atau ke kanan. |
| `monitor.gemini.x` | Layar ungu — kiri-kanan | Geser | −3..3, langkah 0,05, awal 2,6 | Layar kecil di belakang maskot ungu bergeser ke kiri atau ke kanan. |
| `beat.debate` | Cerita — waktu mulai debat | Geser | 9..15 detik, langkah 0,1, awal 12 | Debat panas dimulai lebih awal atau lebih lambat. |
| `beat.tired` | Cerita — waktu mulai lelah | Geser | 18..23 detik, langkah 0,1, awal 20,5 | Ketiga maskot mulai lelah lebih awal atau lebih lambat. |
| `beat.joy` | Cerita — waktu senang | Geser | 24..29 detik, langkah 0,1, awal 26 | Ketiga maskot bersorak dan berputar lebih awal atau lebih lambat. |

### 3. Adu Kode — `template-code.html` · durasi 30 detik · 12 lama + 12 baru = **24**

| Pengaturan | Nama awam | Kontrol | Rentang & awal | Yang berubah |
|---|---|---|---|---|
| `claude.x` | Maskot oranye — kiri-kanan | Geser | −3..3, langkah 0,05, awal −1,7 | Maskot oranye bergeser ke kiri atau ke kanan di atas panggung. |
| `codex.x` | Maskot biru — kiri-kanan | Geser | −3..3, langkah 0,05, awal 1,7 | Maskot biru bergeser ke kiri atau ke kanan di atas panggung. |
| `codex.scale` | Maskot biru — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 0,85 | Maskot biru membesar atau mengecil. |
| `claude.scale` | Maskot oranye — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 1 | Maskot oranye membesar atau mengecil. |
| `claude.z` | Maskot oranye — maju-mundur | Geser | −1..1, langkah 0,05, awal 0 | Maskot oranye maju ke arah penonton atau mundur ke arah layar. |
| `codex.z` | Maskot biru — maju-mundur | Geser | −1..1, langkah 0,05, awal 0 | Maskot biru maju ke arah penonton atau mundur ke arah layar. |
| `eyes.tilt` | Mata — kemiringan | Geser | −0,5..0,5, langkah 0,05, awal 0 | Mata kedua maskot miring seperti marah atau seperti senang. |
| `face.codex` | Wajah di layar biru | Pilihan | −1 ikut cerita (awal), 0 biasa, 1 marah, 2 senang, 3 lelah | Wajah yang tampil di layar biru berubah dan bertahan sepanjang video. |
| `claude.color` | Maskot oranye — warna | Warna | awal `#d97757` | Warna maskot oranye, layar kecilnya, dan papan namanya berubah. |
| `codex.color` | Maskot biru — warna | Warna | awal `#7b8cff` | Warna maskot biru, layar kecilnya, dan papan namanya berubah. |
| `board.y` | Papan skor — tinggi | Geser | 2,5..6,5, langkah 0,1, awal 4,3 | Papan skor naik atau turun di dinding. |
| `board.claude.start` | Papan — angka awal oranye | Daftar | 3 angka 0..100, awal [92, 68, 61] | Tiga angka awal maskot oranye di papan berubah. |
| `board.claude.final` | Papan — angka akhir oranye | Daftar | 3 angka 0..100, awal [96, 94, 88] | Tiga angka akhir maskot oranye di papan berubah. |
| `board.codex.start` | Papan — angka awal biru | Daftar | 3 angka 0..100, awal [58, 99, 86] | Tiga angka awal maskot biru di papan berubah. |
| `board.codex.final` | Papan — angka akhir biru | Daftar | 3 angka 0..100, awal [93, 96, 95] | Tiga angka akhir maskot biru di papan berubah. |
| `monitor.claude.x` | Layar oranye — kiri-kanan | Geser | −3..3, langkah 0,05, awal −1,5 | Layar kecil di belakang maskot oranye bergeser ke kiri atau ke kanan. |
| `monitor.codex.x` | Layar biru — kiri-kanan | Geser | −3..3, langkah 0,05, awal 1,5 | Layar kecil di belakang maskot biru bergeser ke kiri atau ke kanan. |
| `screen.code` | Layar — isi kode | Daftar | Teks, tiap baris maks. 200 huruf, awal 5 baris | Kode yang tampil di layar besar berubah. |
| `screen.fix` | Layar — baris perbaikan | Ketik | Teks satu baris, awal `  if (!user) return null` | Baris kode pengganti yang muncul saat momen perbaikan berubah. |
| `beat.board` | Cerita — waktu papan masuk | Geser | 1..6 detik, langkah 0,1, awal 3,2 | Papan skor masuk lebih awal atau lebih lambat. |
| `beat.refactor` | Cerita — waktu mengetik ulang | Geser | 7..12 detik, langkah 0,1, awal 9,8 | Maskot oranye mulai menulis ulang kodenya lebih awal atau lebih lambat. |
| `beat.bug` | Cerita — waktu galat muncul | Geser | 13..18 detik, langkah 0,1, awal 15,6 | Galat merah muncul di kedua layar lebih awal atau lebih lambat. |
| `beat.fix` | Cerita — waktu perbaikan | Geser | 19..24 detik, langkah 0,1, awal 21 | Perbaikan hijau muncul lebih awal atau lebih lambat. |
| `beat.tie` | Cerita — waktu seri akhir | Geser | 21..27 detik, langkah 0,1, awal 22,8 | Hasil seri dan tos kedua maskot terjadi lebih awal atau lebih lambat. |

### 4. Kuota — `template-kuota.html` · durasi 34 detik · 9 lama + 22 baru = **31**

| Pengaturan | Nama awam | Kontrol | Rentang & awal | Yang berubah |
|---|---|---|---|---|
| `claude.x` | Maskot oranye — kiri-kanan | Geser | −3..3, langkah 0,05, awal −1,7 | Maskot oranye bergeser ke kiri atau ke kanan di atas panggung. |
| `codex.x` | Maskot biru — kiri-kanan | Geser | −3..3, langkah 0,05, awal 1,7 | Maskot biru bergeser ke kiri atau ke kanan di atas panggung. |
| `codex.scale` | Maskot biru — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 0,85 | Maskot biru membesar atau mengecil. |
| `claude.scale` | Maskot oranye — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 1 | Maskot oranye membesar atau mengecil. |
| `claude.z` | Maskot oranye — maju-mundur | Geser | −1..1, langkah 0,05, awal 0 | Maskot oranye maju ke arah penonton atau mundur ke arah layar. |
| `codex.z` | Maskot biru — maju-mundur | Geser | −1..1, langkah 0,05, awal 0 | Maskot biru maju ke arah penonton atau mundur ke arah layar. |
| `eyes.tilt` | Mata — kemiringan | Geser | −0,5..0,5, langkah 0,05, awal 0 | Mata kedua maskot miring seperti marah atau seperti senang. |
| `face.codex` | Wajah di layar biru | Pilihan | −1 ikut cerita (awal), 0 biasa, 1 marah, 2 senang, 3 lelah | Wajah yang tampil di layar biru berubah dan bertahan sepanjang video. |
| `claude.color` | Maskot oranye — warna | Warna | awal `#d97757` | Warna maskot oranye, layar kecilnya, dan papan namanya berubah. |
| `codex.color` | Maskot biru — warna | Warna | awal `#7b8cff` | Warna maskot biru, layar kecilnya, dan papan namanya berubah. |
| `board.y` | Papan skor — tinggi | Geser | 2,5..6,5, langkah 0,1, awal 4,5 | Papan skor naik atau turun di dinding. |
| `board.base` | Papan — angka awal | Geser | 0..90, langkah 1, awal 55 | Angka papan di awal berubah. |
| `board.swing` | Papan — naik-turun angka | Geser | 0..45, langkah 1, awal 38 | Angka papan naik-turun lebih lebar atau lebih tenang. |
| `board.final` | Papan — angka akhir | Geser | 0..100, langkah 1, awal 90 | Angka akhir papan berubah. |
| `board.read` | Papan — angka file dibaca | Geser | 0..5, langkah 0,1, awal 2,9 | Angka "file dibaca" di papan berubah mengikuti sisa kuota. |
| `board.write` | Papan — angka kata dijawab | Geser | 0..5, langkah 0,1, awal 2,2 | Angka "kata dijawab" di papan berubah mengikuti sisa kuota. |
| `monitor.claude.x` | Layar oranye — kiri-kanan | Geser | −3..3, langkah 0,05, awal −1,5 | Layar kecil di belakang maskot oranye bergeser ke kiri atau ke kanan. |
| `monitor.codex.x` | Layar biru — kiri-kanan | Geser | −3..3, langkah 0,05, awal 1,5 | Layar kecil di belakang maskot biru bergeser ke kiri atau ke kanan. |
| `tank.curve` | Tangki — isi dari waktu ke waktu | Daftar | Daftar pasangan [detik, persen], awal 18 baris di baris 127 | Tangki terisi atau berkurang mengikuti daftar baru sepanjang video. |
| `tank.color.full` | Cairan tangki — warna saat penuh | Warna | awal `#ffc857` | Cairan tangki berwarna baru saat kuota masih penuh. |
| `tank.color.low` | Cairan tangki — warna saat hampir habis | Warna | awal `#ff3b3b` | Cairan tangki berwarna baru saat kuota hampir habis. |
| `tank.color.reset` | Cairan tangki — warna saat isi ulang | Warna | awal `#3ddc84` | Kilau cairan saat kuota diisi ulang berwarna baru. |
| `tank.x` | Tangki — kiri-kanan | Geser | −2..2, langkah 0,05, awal 0 | Tangki bergeser ke kiri atau ke kanan di antara kedua maskot. |
| `tank.z` | Tangki — maju-mundur | Geser | −2..−0,5, langkah 0,05, awal −1,25 | Tangki maju ke arah penonton atau mundur ke arah dinding. |
| `keyboard.x` | Keyboard — kiri-kanan | Geser | −1..1, langkah 0,05, awal 0 | Keyboard bergeser ke kiri atau ke kanan di atas meja. |
| `keyboard.y` | Keyboard — naik-turun | Geser | 0..0,5, langkah 0,05, awal 0,12 | Keyboard naik atau turun dari meja. |
| `keyboard.z` | Keyboard — maju-mundur | Geser | 0..1,5, langkah 0,05, awal 0,8 | Keyboard maju ke arah maskot atau mundur menjauhinya. |
| `beat.empty` | Cerita — waktu kuota habis | Geser | 13..18 detik, langkah 0,1, awal 15,2 | Alarm kuota habis berbunyi lebih awal atau lebih lambat. |
| `beat.frugal` | Cerita — waktu mulai hemat | Geser | 18..23 detik, langkah 0,1, awal 20,8 | Kedua maskot mulai berhemat lebih awal atau lebih lambat. |
| `beat.reset` | Cerita — waktu isi ulang | Geser | 25..29 detik, langkah 0,1, awal 27 | Kuota diisi ulang dan papan menyala hijau lebih awal atau lebih lambat. |
| `beat.relapse` | Cerita — waktu kuota habis lagi | Geser | 29..33 detik, langkah 0,1, awal 31 | Kuota habis untuk kedua kalinya lebih awal atau lebih lambat. |

### 5. Rival — `template-rival.html` · durasi 34 detik · 9 lama + 16 baru = **25**

| Pengaturan | Nama awam | Kontrol | Rentang & awal | Yang berubah |
|---|---|---|---|---|
| `claude.x` | Maskot oranye — kiri-kanan | Geser | −3..3, langkah 0,05, awal −1,7 | Maskot oranye bergeser ke kiri atau ke kanan di atas panggung. |
| `codex.x` | Maskot biru — kiri-kanan | Geser | −3..3, langkah 0,05, awal 1,7 | Maskot biru bergeser ke kiri atau ke kanan di atas panggung. |
| `codex.scale` | Maskot biru — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 0,85 | Maskot biru membesar atau mengecil. |
| `claude.scale` | Maskot oranye — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 1 | Maskot oranye membesar atau mengecil. |
| `claude.z` | Maskot oranye — maju-mundur | Geser | −1..1, langkah 0,05, awal 0 | Maskot oranye maju ke arah penonton atau mundur ke arah layar. |
| `codex.z` | Maskot biru — maju-mundur | Geser | −1..1, langkah 0,05, awal 0 | Maskot biru maju ke arah penonton atau mundur ke arah layar. |
| `eyes.tilt` | Mata — kemiringan | Geser | −0,5..0,5, langkah 0,05, awal 0 | Mata kedua maskot miring seperti marah atau seperti senang. |
| `face.codex` | Wajah di layar biru | Pilihan | −1 ikut cerita (awal), 0 biasa, 1 marah, 2 senang, 3 lelah | Wajah yang tampil di layar biru berubah dan bertahan sepanjang video. |
| `claude.color` | Maskot oranye — warna | Warna | awal `#d97757` | Warna maskot oranye, layar kecilnya, dan papan namanya berubah. |
| `codex.color` | Maskot biru — warna | Warna | awal `#7b8cff` | Warna maskot biru, layar kecilnya, dan papan namanya berubah. |
| `board.y` | Papan skor — tinggi | Geser | 2,5..6,5, langkah 0,1, awal 4,5 | Papan skor naik atau turun di dinding. |
| `board.top` | Papan — angka tertinggi | Geser | 0..100, langkah 1, awal 90 | Angka dendam tertinggi di papan berubah. |
| `board.back` | Papan — angka saat musuhan lagi | Geser | 0..100, langkah 1, awal 85 | Angka dendam saat mereka musuhan lagi di akhir berubah. |
| `board.swing` | Papan — naik-turun angka | Geser | 0..0,2, langkah 0,01, awal 0,05 | Angka papan bergoyang lebih lebar atau lebih tenang. |
| `monitor.claude.x` | Layar oranye — kiri-kanan | Geser | −3..3, langkah 0,05, awal −1,5 | Layar kecil di belakang maskot oranye bergeser ke kiri atau ke kanan. |
| `monitor.codex.x` | Layar biru — kiri-kanan | Geser | −3..3, langkah 0,05, awal 1,5 | Layar kecil di belakang maskot biru bergeser ke kiri atau ke kanan. |
| `rival.notes` | Catatan tempel — isi | Daftar | Daftar teks, awal mengikuti template-rival.html | Tulisan di catatan tempel di dinding berubah. |
| `keyboard.x` | Keyboard — kiri-kanan | Geser | −1..1, langkah 0,05, awal 0 | Keyboard bergeser ke kiri atau ke kanan di atas meja. |
| `keyboard.sway` | Keyboard — goyangan saat diperebutkan | Geser | 0..0,6, langkah 0,05, awal 0,3 | Keyboard terombang-ambing lebih jauh atau diam saat diperebutkan. |
| `keyboard.y` | Keyboard — naik-turun | Geser | 0..0,5, langkah 0,05, awal 0,12 | Keyboard naik atau turun dari meja. |
| `keyboard.z` | Keyboard — maju-mundur | Geser | 0..1,5, langkah 0,05, awal 0,8 | Keyboard maju ke arah maskot atau mundur menjauhinya. |
| `beat.alert` | Cerita — waktu waspada | Geser | 13..18 detik, langkah 0,1, awal 15,2 | Kedua maskot mulai waspada lebih awal atau lebih lambat. |
| `beat.teamwork` | Cerita — waktu kerja sama | Geser | 18..23 detik, langkah 0,1, awal 20,8 | Kedua maskot mulai bekerja sama lebih awal atau lebih lambat. |
| `beat.joy` | Cerita — waktu senang | Geser | 22..27 detik, langkah 0,1, awal 24,6 | Kedua maskot bersorak lebih awal atau lebih lambat. |
| `beat.relapse` | Cerita — waktu kambuh | Geser | 27..32 detik, langkah 0,1, awal 29,2 | Kedua maskot musuhan lagi lebih awal atau lebih lambat. |

### 6. Perang — `template-perang.html` · durasi 34 detik · 9 lama + 20 baru = **29**

| Pengaturan | Nama awam | Kontrol | Rentang & awal | Yang berubah |
|---|---|---|---|---|
| `claude.x` | Maskot oranye — kiri-kanan | Geser | −3..3, langkah 0,05, awal −2,95 | Maskot oranye bergeser ke kiri atau ke kanan di atas panggung. |
| `codex.x` | Maskot biru — kiri-kanan | Geser | −3..3, langkah 0,05, awal 2,95 | Maskot biru bergeser ke kiri atau ke kanan di atas panggung. |
| `claude.scale` | Maskot oranye — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 1 | Maskot oranye membesar atau mengecil. |
| `codex.scale` | Maskot biru — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 0,85 | Maskot biru membesar atau mengecil. |
| `claude.z` | Maskot oranye — maju-mundur | Geser | −1..1, langkah 0,05, awal 0 | Maskot oranye maju ke arah penonton atau mundur ke arah benteng. |
| `codex.z` | Maskot biru — maju-mundur | Geser | −1..1, langkah 0,05, awal 0 | Maskot biru maju ke arah penonton atau mundur ke arah benteng. |
| `eyes.tilt` | Mata — kemiringan | Geser | −0,5..0,5, langkah 0,05, awal 0 | Mata kedua maskot miring seperti marah atau seperti senang. |
| `face.codex` | Wajah di layar biru | Pilihan | −1 ikut cerita (awal), 0 biasa, 1 marah, 2 senang, 3 lelah | Wajah yang tampil di layar biru berubah dan bertahan sepanjang video. |
| `claude.color` | Maskot oranye — warna | Warna | awal `#d97757` | Warna maskot oranye, layar kecilnya, dan papan namanya berubah. |
| `codex.color` | Maskot biru — warna | Warna | awal `#7b8cff` | Warna maskot biru, layar kecilnya, dan papan namanya berubah. |
| `board.y` | Papan skor — tinggi | Geser | 2,5..6,5, langkah 0,1, awal 6 | Papan skor naik atau turun di dinding. |
| `war.spawns` | Pasukan kecil — waktu muncul | Daftar | Daftar waktu (detik), awal mengikuti template-perang.html baris 187 | Pasukan kecil muncul lebih awal atau lebih lambat. |
| `war.catapults` | Katapel — waktu tembakan | Daftar | Daftar waktu (detik), awal mengikuti template-perang.html | Koin ditembakkan lebih awal atau lebih lambat. |
| `fort.distance` | Benteng — jarak dari tengah | Geser | 3,5..4,5, langkah 0,1, awal 3,7 | Kedua benteng menjauh atau mendekat dari tengah secara simetris. |
| `fort.depth` | Benteng — maju-mundur | Geser | −2,2..−0,8, langkah 0,05, awal −1,6 | Kedua benteng maju ke arah penonton atau mundur ke arah dinding. |
| `fort.size` | Benteng — besar-kecil | Geser | 0,7..1,3, langkah 0,05, awal 1 | Kedua benteng membesar atau mengecil beserta benderanya. |
| `fort.claude.text` | Bendera kiri — tulisan | Ketik | Teks maks. 12 huruf, awal `CLAUDE.md` | Tulisan di bendera kiri berubah. |
| `fort.codex.text` | Bendera kanan — tulisan | Ketik | Teks maks. 12 huruf, awal `AGENTS.md` | Tulisan di bendera kanan berubah. |
| `fort.claude.color` | Bendera kiri — warna | Warna | awal `#d97757` | Warna bendera kiri berubah. |
| `fort.codex.color` | Bendera kanan — warna | Warna | awal `#3c64e1` | Warna bendera kanan berubah. |
| `catapult.distance` | Katapel — jarak dari tengah | Geser | 1,8..2,8, langkah 0,1, awal 2,4 | Kedua katapel menjauh atau mendekat dari tengah secara simetris. |
| `war.button` | Tombol biru — warna putaran | Daftar | 4 warna (tiap warna 3 angka 0..1), awal lihat baris 272 | Tombol yang berputar saat perang berganti warna mengikuti daftar baru. |
| `war.bill` | Tagihan — jumlah awal | Geser | 0..1000, langkah 5, awal 425 | Tagihan di papan berubah (425 = Rp4.250.000). |
| `war.bill.speed` | Tagihan — kecepatan naik | Geser | 0,5..2, langkah 0,1, awal 1,2 | Tagihan naik lebih cepat atau lebih lambat selama perang. |
| `beat.war` | Cerita — waktu perang mulai | Geser | 10..15 detik, langkah 0,1, awal 12,8 | Perang dimulai lebih awal atau lebih lambat. |
| `beat.truce` | Cerita — waktu gencatan | Geser | 18..23 detik, langkah 0,1, awal 20,8 | Perang berhenti dan bendera putih berkibar lebih awal atau lebih lambat. |
| `beat.intern` | Cerita — waktu magang masuk | Geser | 21..26 detik, langkah 0,1, awal 23,6 | Magang masuk dan menekan tombol lebih awal atau lebih lambat. |
| `beat.punch` | Cerita — waktu pukulan pertama | Geser | 14..16 detik, langkah 0,1, awal 14,9 | Pukulan pertama mendarat lebih awal atau lebih lambat. |
| `beat.punch.gap` | Cerita — jarak antar pukulan | Geser | 0,8..1,6 detik, langkah 0,1, awal 1,2 | Pukulan-pukulan berikutnya datang lebih rapat atau lebih renggang. |

### 7. Mengetik — `template-typing.html` · durasi 26 detik · 6 lama + 8 baru = **14**

| Pengaturan | Nama awam | Kontrol | Rentang & awal | Yang berubah |
|---|---|---|---|---|
| `claude.x` | Maskot — kiri-kanan | Geser | −2..2, langkah 0,05, awal 0 | Maskot bergeser ke kiri atau ke kanan di atas panggung. |
| `claude.sway` | Maskot — goyangan | Geser | 0..0,9, langkah 0,05, awal 0,45 | Maskot bergoyang kiri-kanan lebih lebar atau berdiri diam. |
| `claude.scale` | Maskot — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 1 | Maskot membesar atau mengecil. |
| `claude.z` | Maskot — maju-mundur | Geser | 0..1,2, langkah 0,05, awal 0,6 | Maskot maju ke arah penonton atau mundur ke arah layar. |
| `eyes.tilt` | Mata — kemiringan | Geser | −0,5..0,5, langkah 0,05, awal 0 | Mata maskot miring seperti marah atau seperti senang. |
| `claude.color` | Maskot — warna | Warna | awal `#d97757` | Warna maskot dan garis tepi balon katanya berubah. |
| `screen.x` | Layar — kiri-kanan | Geser | −2..2, langkah 0,05, awal 0 | Layar bergeser ke kiri atau ke kanan. |
| `screen.y` | Layar — tinggi | Geser | 1..3, langkah 0,05, awal 1,75 | Layar naik atau turun. |
| `mug.x` | Cangkir — kiri-kanan | Geser | −3..3, langkah 0,05, awal 2,3 | Cangkir bergeser ke kiri atau ke kanan di atas meja. |
| `window.x` | Jendela — kiri-kanan | Geser | −4..0, langkah 0,05, awal −3,6 | Jendela bergeser ke kiri atau ke kanan di dinding. |
| `lamp.x` | Lampu — kiri-kanan | Geser | −5..5, langkah 0,05, awal −3 | Lampu bergeser ke kiri atau ke kanan. |
| `screen.code` | Layar — isi kode | Daftar | Teks, tiap baris maks. 200 huruf, awal 14 baris | Kode yang diketik maskot di layar berubah. |
| `beat.typing` | Cerita — waktu mulai mengetik | Geser | 1..5 detik, langkah 0,1, awal 3 | Maskot mulai mengetik lebih awal atau lebih lambat. |
| `beat.done` | Cerita — waktu selesai | Geser | 12..18 detik, langkah 0,1, awal 15 | Kode selesai dan maskot bersorak lebih awal atau lebih lambat. |

### 8. Deploy — `template-deploy.html` · durasi 29 detik · 6 lama + 13 baru = **19**

| Pengaturan | Nama awam | Kontrol | Rentang & awal | Yang berubah |
|---|---|---|---|---|
| `claude.x` | Maskot — kiri-kanan | Geser | −2..2, langkah 0,05, awal 0 | Maskot bergeser ke kiri atau ke kanan di atas panggung. |
| `claude.sway` | Maskot — goyangan | Geser | 0..0,9, langkah 0,05, awal 0,45 | Maskot bergoyang kiri-kanan lebih lebar atau berdiri diam. |
| `claude.scale` | Maskot — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 1 | Maskot membesar atau mengecil. |
| `claude.z` | Maskot — maju-mundur | Geser | 0..1,2, langkah 0,05, awal 0,6 | Maskot maju ke arah penonton atau mundur ke arah layar. |
| `eyes.tilt` | Mata — kemiringan | Geser | −0,5..0,5, langkah 0,05, awal 0 | Mata maskot miring seperti marah atau seperti senang. |
| `claude.color` | Maskot — warna | Warna | awal `#d97757` | Warna maskot dan garis tepi balon katanya berubah. |
| `screen.x` | Layar — kiri-kanan | Geser | −2..2, langkah 0,05, awal 0 | Layar bergeser ke kiri atau ke kanan. |
| `screen.y` | Layar — tinggi | Geser | 1..3, langkah 0,05, awal 1,75 | Layar naik atau turun. |
| `mug.x` | Cangkir — kiri-kanan | Geser | −3..3, langkah 0,05, awal 2,3 | Cangkir bergeser ke kiri atau ke kanan di atas meja. |
| `window.x` | Jendela — kiri-kanan | Geser | −4..0, langkah 0,05, awal −3,6 | Jendela bergeser ke kiri atau ke kanan di dinding. |
| `lamp.x` | Lampu — kiri-kanan | Geser | −5..5, langkah 0,05, awal −3 | Lampu bergeser ke kiri atau ke kanan. |
| `screen.cmd1` | Layar — perintah pertama | Daftar | Teks, tiap baris maks. 200 huruf, awal 3 baris | Perintah pertama yang diketik maskot berubah. |
| `screen.cmd2` | Layar — perintah perbaikan | Daftar | Teks, tiap baris maks. 200 huruf, awal 3 baris | Perintah perbaikan yang diketik sesudah gagal berubah. |
| `screen.error` | Layar — pesan galat | Daftar | Teks, tiap baris maks. 200 huruf, awal 3 baris | Pesan galat merah di layar berubah. |
| `screen.pipeline` | Layar — tahapan jalan | Daftar | Daftar pasangan [mulai, selesai] (detik), awal RUN1 [[6,4, 7,4],[7,4, 8,9]] dan RUN2 [[14,8, 15,6],[15,6, 17],[17, 18,3]] | Tahapan jalan di layar maju atau mundur mengikuti daftar baru. |
| `beat.typing` | Cerita — waktu mulai mengetik | Geser | 1..5 detik, langkah 0,1, awal 3 | Maskot mulai mengetik lebih awal atau lebih lambat. |
| `beat.panic` | Cerita — waktu panik | Geser | 7..11 detik, langkah 0,1, awal 9 | Maskot panik saat galat muncul lebih awal atau lebih lambat. |
| `beat.fix` | Cerita — waktu perbaikan | Geser | 10..14 detik, langkah 0,1, awal 12,3 | Maskot mengetik perbaikan lebih awal atau lebih lambat. |
| `beat.done` | Cerita — waktu selesai | Geser | 16..21 detik, langkah 0,1, awal 18,4 | Layar berubah hijau dan maskot bersorak lebih awal atau lebih lambat. |

### 9. Pemburu Bug — `template-bughunter.html` · durasi 33 detik · 8 lama + 7 baru = **15**

| Pengaturan | Nama awam | Kontrol | Rentang & awal | Yang berubah |
|---|---|---|---|---|
| `claude.x` | Maskot — kiri-kanan | Geser | −2..2, langkah 0,05, awal 0 | Maskot bergeser ke kiri atau ke kanan di atas panggung. |
| `claude.sway` | Maskot — goyangan | Geser | 0..0,9, langkah 0,05, awal 0,45 | Maskot bergoyang kiri-kanan lebih lebar atau berdiri diam. |
| `claude.scale` | Maskot — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 1 | Maskot membesar atau mengecil. |
| `claude.z` | Maskot — maju-mundur | Geser | 0..1,2, langkah 0,05, awal 0,6 | Maskot maju ke arah penonton atau mundur ke arah layar. |
| `eyes.tilt` | Mata — kemiringan | Geser | −0,5..0,5, langkah 0,05, awal 0 | Mata maskot miring seperti marah atau seperti senang. |
| `claude.color` | Maskot — warna | Warna | awal `#d97757` | Warna maskot dan garis tepi balon katanya berubah. |
| `screen.x` | Layar — kiri-kanan | Geser | −2..2, langkah 0,05, awal 0 | Layar bergeser ke kiri atau ke kanan. |
| `screen.y` | Layar — tinggi | Geser | 1..3, langkah 0,05, awal 1,75 | Layar naik atau turun. |
| `mug.x` | Cangkir — kiri-kanan | Geser | −3..3, langkah 0,05, awal 2,3 | Cangkir bergeser ke kiri atau ke kanan di atas meja. |
| `window.x` | Jendela — kiri-kanan | Geser | −4..0, langkah 0,05, awal −2,4 | Jendela bergeser ke kiri atau ke kanan di dinding. |
| `lamp.x` | Lampu — kiri-kanan | Geser | −5..5, langkah 0,05, awal −3 | Lampu bergeser ke kiri atau ke kanan. |
| `typing.windows` | Ketikan — jendela waktu | Daftar | Daftar [mulai, selesai] (detik), awal mengikuti template | Maskot mengetik pada waktu-waktu baru. |
| `typing.lines` | Ketikan — baris yang diketik | Daftar | Daftar baris teks, awal mengikuti template | Baris yang diketik maskot di layar berubah. |
| `beat.alarm` | Cerita — waktu alarm | Geser | 1..4 detik, langkah 0,1, awal 2 | Alarm berbunyi dan layar memerah lebih awal atau lebih lambat. |
| `beat.squash` | Cerita — waktu bug dihancurkan | Geser | 20..27 detik, langkah 0,1, awal 23,4 | Bug dihancurkan dan layar pulih lebih awal atau lebih lambat. |

### 10. Bom — `template-bomb.html` · durasi 33 detik · 8 lama + 9 baru = **17**

| Pengaturan | Nama awam | Kontrol | Rentang & awal | Yang berubah |
|---|---|---|---|---|
| `claude.x` | Maskot — kiri-kanan | Geser | −2..2, langkah 0,05, awal 0 | Maskot bergeser ke kiri atau ke kanan di atas panggung. |
| `claude.sway` | Maskot — goyangan | Geser | 0..0,9, langkah 0,05, awal 0,45 | Maskot bergoyang kiri-kanan lebih lebar atau berdiri diam. |
| `claude.scale` | Maskot — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 1 | Maskot membesar atau mengecil. |
| `claude.z` | Maskot — maju-mundur | Geser | 0..1,2, langkah 0,05, awal 0,6 | Maskot maju ke arah penonton atau mundur ke arah layar. |
| `eyes.tilt` | Mata — kemiringan | Geser | −0,5..0,5, langkah 0,05, awal 0 | Mata maskot miring seperti marah atau seperti senang. |
| `claude.color` | Maskot — warna | Warna | awal `#d97757` | Warna maskot dan garis tepi balon katanya berubah. |
| `screen.x` | Layar — kiri-kanan | Geser | −2..2, langkah 0,05, awal 0 | Layar bergeser ke kiri atau ke kanan. |
| `screen.y` | Layar — tinggi | Geser | 1..3, langkah 0,05, awal 1,75 | Layar naik atau turun. |
| `mug.x` | Cangkir — kiri-kanan | Geser | −3..3, langkah 0,05, awal −2,05 | Cangkir bergeser ke kiri atau ke kanan di atas meja. |
| `window.x` | Jendela — kiri-kanan | Geser | −4..0, langkah 0,05, awal −2,4 | Jendela bergeser ke kiri atau ke kanan di dinding. |
| `lamp.x` | Lampu — kiri-kanan | Geser | −5..5, langkah 0,05, awal −3 | Lampu bergeser ke kiri atau ke kanan. |
| `typing.windows` | Ketikan — jendela waktu | Daftar | Daftar [mulai, selesai] (detik), awal mengikuti template | Maskot mengetik pada waktu-waktu baru. |
| `typing.lines` | Ketikan — baris yang diketik | Daftar | Daftar baris teks, awal mengikuti template | Baris yang diketik maskot di layar berubah. |
| `bomb.seconds` | Bom — detik awal | Ketik angka | 10..60, langkah 1, awal 30 | Bom mulai menghitung mundur dari angka baru dan tetap sampai 00:01 saat dijinakkan. |
| `screen.editor` | Layar editor — isi tiap fase | Daftar | 4 fase (sebelum alarm / konflik / sesudah hapus tanda / beres), tiap baris maks. 200 huruf | Isi editor di layar berubah pada tiap fasenya. |
| `beat.alarm` | Cerita — waktu alarm | Geser | 1..5 detik, langkah 0,1, awal 2,8 | Alarm berbunyi dan hitung mundur mulai lebih awal atau lebih lambat. |
| `beat.defuse` | Cerita — waktu bom jinak | Geser | 20..27 detik, langkah 0,1, awal 23,4 | Bom dijinakkan dan layar berubah hijau lebih awal atau lebih lambat. |

### 11. Rapat — `template-meeting.html` · durasi 33 detik · 8 lama + 9 baru = **17**

| Pengaturan | Nama awam | Kontrol | Rentang & awal | Yang berubah |
|---|---|---|---|---|
| `claude.x` | Maskot — kiri-kanan | Geser | −2..2, langkah 0,05, awal 0 | Maskot bergeser ke kiri atau ke kanan di atas panggung. |
| `claude.sway` | Maskot — goyangan | Geser | 0..0,9, langkah 0,05, awal 0,4 | Maskot bergoyang kiri-kanan lebih lebar atau berdiri diam. |
| `claude.scale` | Maskot — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 1 | Maskot membesar atau mengecil. |
| `claude.z` | Maskot — maju-mundur | Geser | 0..1,2, langkah 0,05, awal 0,6 | Maskot maju ke arah penonton atau mundur ke arah layar. |
| `eyes.tilt` | Mata — kemiringan | Geser | −0,5..0,5, langkah 0,05, awal 0 | Mata maskot miring seperti marah atau seperti senang. |
| `claude.color` | Maskot — warna | Warna | awal `#d97757` | Warna maskot dan garis tepi balon katanya berubah. |
| `screen.x` | Layar — kiri-kanan | Geser | −2..2, langkah 0,05, awal 0 | Layar bergeser ke kiri atau ke kanan. |
| `screen.y` | Layar — tinggi | Geser | 1..3, langkah 0,05, awal 1,75 | Layar naik atau turun. |
| `window.x` | Jendela — kiri-kanan | Geser | −4..0, langkah 0,05, awal −2,8 | Jendela bergeser ke kiri atau ke kanan di dinding. |
| `lamp.x` | Lampu — kiri-kanan | Geser | −5..5, langkah 0,05, awal −3 | Lampu bergeser ke kiri atau ke kanan. |
| `typing.windows` | Ketikan — jendela waktu | Daftar | Daftar [mulai, selesai] (detik), awal mengikuti template | Maskot mengetik pada waktu-waktu baru. |
| `typing.lines` | Ketikan — baris yang diketik | Daftar | Daftar baris teks, awal mengikuti template | Baris yang diketik maskot di layar berubah. |
| `meeting.end` | Rapat — waktu selesai | Geser | 10..32 detik, langkah 0,1, awal 24,2 | Rapat selesai dan maskot pulang lebih awal atau lebih lambat. |
| `screen.chat` | Layar — isi obrolan | Daftar | Daftar [detik, nama, pesan, warna], 12 baris, awal mengikuti template | Obrolan di layar berubah (waktu, nama, pesan, warna). |
| `mug.row` | Deretan cangkir — posisi awal | Geser | 0,5..2, langkah 0,05, awal 1,1 | Deretan tiga cangkir bergeser ke kiri atau ke kanan di atas meja. |
| `mug.gap` | Deretan cangkir — jarak antar cangkir | Geser | 0,3..0,7, langkah 0,05, awal 0,48 | Jarak antar cangkir merenggang atau merapat. |
| `beat.twist` | Cerita — waktu kejutan | Geser | 26..31 detik, langkah 0,1, awal 28,4 | Kejutan "lanjut besok" muncul lebih awal atau lebih lambat. |

### 12. Tidur — `template-sleep.html` · durasi 36 detik · 6 lama + 13 baru = **19**

| Pengaturan | Nama awam | Kontrol | Rentang & awal | Yang berubah |
|---|---|---|---|---|
| `claude.x` | Maskot — kiri-kanan | Geser | −2..2, langkah 0,05, awal 0 | Maskot bergeser ke kiri atau ke kanan di atas panggung. |
| `claude.sway` | Maskot — goyangan | Geser | 0..0,9, langkah 0,05, awal 0,6 | Maskot bergoyang kiri-kanan lebih lebar atau berdiri diam saat bekerja. |
| `claude.scale` | Maskot — besar-kecil | Geser | 0,5..1,3, langkah 0,05, awal 1 | Maskot membesar atau mengecil. |
| `claude.z` | Maskot — maju-mundur | Geser | −0,4..0,4, langkah 0,05, awal 0 | Maskot maju ke arah penonton atau mundur ke arah tempat tidur. |
| `eyes.tilt` | Mata — kemiringan | Geser | −0,5..0,5, langkah 0,05, awal 0 | Mata maskot miring seperti marah atau seperti senang. |
| `claude.color` | Maskot — warna | Warna | awal `#d97757` | Warna maskot dan garis tepi balon katanya berubah. |
| `screen.x` | Layar — kiri-kanan | Geser | −2..2, langkah 0,05, awal 0 | Layar bergeser ke kiri atau ke kanan. |
| `screen.y` | Layar — tinggi | Geser | 1..3, langkah 0,05, awal 1,75 | Layar naik atau turun. |
| `mug.x` | Cangkir — kiri-kanan | Geser | −3..3, langkah 0,05, awal 2,3 | Cangkir bergeser ke kiri atau ke kanan di atas meja. |
| `window.x` | Jendela — kiri-kanan | Geser | −4..0, langkah 0,05, awal −3,6 | Jendela bergeser ke kiri atau ke kanan di dinding. |
| `lamp.x` | Lampu — kiri-kanan | Geser | −5..5, langkah 0,05, awal −3 | Lampu bergeser ke kiri atau ke kanan. |
| `boss.x` | Bos — kiri-kanan | Geser | 28..32, langkah 0,1, awal 30 | Bos bergeser ke kiri atau ke kanan di dalam ruangannya. |
| `boss.scale` | Bos — besar-kecil | Geser | 0,7..1,3, langkah 0,05, awal 1 | Bos membesar atau mengecil. |
| `screen.prompt` | Layar — perintah yang diketik | Ketik | Teks maks. 80 huruf, awal `buatin video Animasi buat @hanzvibes` | Perintah yang diketik maskot di layar berubah. |
| `screen.recent` | Layar — daftar obrolan lama | Daftar | 1..6 teks pendek (maks. 30 huruf), awal 4 baris | Daftar obrolan lama di sisi layar berubah. |
| `beat.wake` | Cerita — waktu bangun | Geser | 10..14 detik, langkah 0,1, awal 12 | Maskot bangun dari tidur lebih awal atau lebih lambat. |
| `beat.work` | Cerita — waktu mulai kerja | Geser | 12..16 detik, langkah 0,1, awal 14 | Maskot mulai bekerja lebih awal atau lebih lambat. |
| `beat.work.end` | Cerita — waktu selesai kerja | Geser | 18..26 detik, langkah 0,1, awal 22 | Maskot selesai bekerja dan bersorak lebih awal atau lebih lambat. |
| `beat.sleep` | Cerita — waktu tidur lagi | Geser | 26..31 detik, langkah 0,1, awal 28 | Maskot kembali tidur lebih awal atau lebih lambat. |

**Rekap matriks:** Versus 20, Trio 24, Adu Kode 24, Kuota 31, Rival 25, Perang 29, Mengetik 14, Deploy 19, Pemburu Bug 15, Bom 17, Rapat 17, Tidur 19 → **total 254 slot pengaturan (101 lama + 153 baru)**. Id baru unik: 78. Id lama yang diperluas: `claude.x` (ke 6 template satu maskot), `claude.scale` (ke 11 template lain), `claude.color` (garis tepi balon kata di 6 template satu maskot).

---

## §4 — Daftar pengecualian: 0

Tidak ada satu pun pengaturan yang terbukti mustahil diedit dengan aman. Semua yang dulu ada di daftar "tidak bisa diedit" kini punya cara edit di §2 dengan kutipan baris kodenya.

**Yang bukan pengecualian (supaya tidak salah baca saat implementasi):**

1. **Menggeser waktu cerita tidak menggeser teks dan kamera secara otomatis.** Teks di bawah video dan sudut kamera di sekitar momen yang digeser harus digeser dalam spec yang sama (aturan pakai, sama seperti `meeting.end` yang sudah ada). Ini bukan karena tidak bisa — karena teks/kamera adalah data terpisah, bukan turunan rumus momen.
2. **Wajah Codex hanya mengubah wajah di layar biru; mata maskot oranye diatur lewat kemiringan mata.** Keduanya memang dua gambar yang berbeda di kode, jadi sengaja dipisah. Gemini tidak punya layar wajah (matanya garis tipis) — wajahnya ikut kemiringan mata.
3. **Template Perang tidak punya layar kecil (monitor) dan template satu maskot tidak punya Codex/Gemini.** Itu karena objeknya memang tidak ada di template itu, bukan karena pengaturannya diblokir.
4. **Di Kuota, goyangan keyboard tidak ditawarkan** karena di template itu keyboard memang tidak pernah bergoyang (faktor tarik-menariknya selalu 0) — menggesernya tidak akan terlihat apa-apa.
5. **Kedalaman katapel tidak ditawarkan sebagai pengaturan terpisah** karena koin berangkat dari kedalaman katapel itu — mengubahnya saja tanpa mengubah tembakan akan membuat koin melayang dari tempat yang salah; tembakan katapel sudah bisa diedit lewat `war.catapults`.

---

## §5 — Urutan kerja + cara uji untuk implementor

**Urutan kerja yang disarankan (dari yang paling gampang ke yang paling rumit):**

1. **Perluasan id lama** — `claude.x` + `claude.sway` di 6 template satu maskot (§2A), `claude.scale` di 11 template (§2B), `claude.color` + garis tepi balon (§2L). Semua memakai cara tulis yang sudah ada + J1/J2/J4/J6.
2. **Angka bernama sederhana** — kedalaman (§2C), miring mata + wajah Codex (§2D), bos (§2E), benteng/katapel/tombol/tagihan (§2F), skor papan (§2G), warna + posisi tangki (§2H), keyboard (§2I), hitung mundur (§2J), isi layar (§2K), mug rapat (§2N).
3. **Waktu cerita** — mulai dari Adu Kode (sudah konstanta, §M1), lalu Mengetik/Deploy (2–4 momen), lalu yang lain. Terakhir: Kuota (kopling kurva tangki) dan Perang (5 momen, 2 konstanta dalam satu baris).
4. **Sinkronisasi** — `PROP_DEFS` di `lib/studio.ts` dan `scripts/apply-edit.mjs` harus tetap sama persis isinya; jalankan `scripts/sync-check.mjs` sesudah tiap batch. Perbarui matriks "tidak bisa diedit" di `SKILL.md` dan `README.md` (hapus daftarnya; ganti dengan rujukan ke dokumen ini).

**Cara uji (per pengaturan baru, sebelum merge):**

1. Terapkan satu pengaturan lewat CLI (`node scripts/apply-edit.mjs --edit <file> --spec '{"id": nilai}'`) dan pastikan `--list-props` membaca kembali nilai yang sama (round-trip).
2. Terapkan dua kali berturut-turut dengan nilai berbeda dan pastikan hasil akhir hanya berisi nilai terakhir (tidak ada sisipan ganda J1/J2).
3. Terapkan pada salinan template yang BELUM pernah diedit dan pada salinan yang SUDAH diedit (kasus konstanta belum ada vs sudah ada).
4. `node --check` semua blok `<script>` hasil edit; jumlah kemunculan `@hanzvibes` tidak berkurang.
5. Buka hasil edit di studio (preview): gerakkan waktu ke sebelum/sesudah momen yang diubah dan pastikan animasi lain di sekitarnya tidak rusak (tangan tetap di atas keyboard, balon kata tetap menempel, papan tetap terbaca, kamera tetap membingkai).
6. Uji validasi: nilai di luar rentang ditolak; urutan momen yang dilanggar ditolak CLI; teks bendera > 12 huruf ditolak.

**Dua catatan kecil yang harus masuk ke PR implementor (bukan bug, tapi perubahan perilaku yang disengaja):**

- Hitung mundur Bom: dulu sampai 00:01 sekitar detik 23,2; dengan rumus baru, sampai 00:01 tepat di detik bom jinak (23,4). Selisih 0,2 detik, perbaikan — dicatat di §J.
- Papan Rival `board.swing` memakai skala 0..0,2 (bukan 0..45 seperti Versus/Trio) karena di Rival goyangannya memang kecil; id sama, skala berbeda per template — dicatat di matriks.
