---
name: threejs-cinematic-short
description: Build a cinematic 3D animated short (story-driven mascots, smooth camera, speech bubbles, realistic keyboard typing, voice over) as one self-contained three.js HTML page in 9:16 for TikTok/Reels. Use for "video animasi", 3D animation, mascot stories (coding, deploy, bug hunt, rapat, misi mustahil), Claude vs Codex vs Gemini debates, "adu kode", "musuhan", "rebutan kuota token", or recreating a reference video in three.js, even if the user only says "bikinin video animasi". Also use to revise a page made with this skill.
---

# Cinematic 3D short in three.js (9:16)

Produces ONE `.html` file: a timed, looping 3D short film rendered live with three.js. Never write from scratch. Copy a template, then swap characters, props, captions and palette.

Templates in `assets/`:
- `template.html`: **two-character versus** story (Claude vs Codex arguing which AI model is best). Has two mascots, two monitors with live UI, a benchmark scoreboard, a clash/celebration particle system and per-character speech bubbles. Use it for debates, fights, comparisons, duets, any two-character story.
- `template-perang.html`: **two-character war comedy "Perang Sub Agent"** (Claude vs Codex, 34 s, all-new props). Two generals in caps spawn mini sub agents (pencil spears vs keycap shields) from portals, then fight over one `Button.tsx` on a pedestal (task: change a button to blue) with cardboard forts (`CLAUDE.md` / `AGENTS.md` flags), token-coin catapults (`EV` rows: side, start, flight, target), a war-map table, a wall board (`drawBoard(a,b,bill,lab)`: agent counts + TAGIHAN climbing to Rp 4.250.000), merge-conflict sign, white-flag truce, then the twist: an uninvited intern sub agent paints the button blue in one stroke and a wall receipt printer prints the bill. Factors: `war`, `mar` (march), `fi` (fight), `ko`, `pz` (peace formation), `jy`, `sh`, `ar`. Spawn times are `SP`; shift story beats together with `EV`, `caps` and `shots`. **v3.14 motion engine:** all story logic is pure functions between `/*MP0*/` and `/*MP1*/` (`FA(t)` factors, `mlay` layout, `mpose(sd,i,t)` full mini pose, `HIT` punch table), testable in node without three.js. Real punch cycle (`PW` wind-up, `PE` strike, `RC` recoil; period `P`, start `FT0`; Claude and Codex alternate, jabs alternate arms, torso twist, squash and stretch, knock-back, fall backwards at KO). Layout rule: pairs face each other at `x=±.38` on their own `z` row, home and peace rows keep the same z order so paths never cross and nothing overlaps the button podium, forts, portals or generals. Particles are event emitters (`em`): impact star sparks + flash + foot dust per `HIT`, gold sparks where coins land, portal swirl at each spawn, blue paint drops on the button, confetti at the truce. Camera is a non-uniform Catmull-Rom spline through `shots` (`camAt`), arrival = shot start + .9 s, shake only from low-frequency trauma. Use it for any "too many agents, tiny task" gag; swap the task, forts' file names, bill lines and twist.
- `template-deploy.html`: **single-character story "Deploy Jumat Sore"** (mascot pushes code on a Friday afternoon, the CI pipeline turns red, it panics with sweat drops and "!" marks, fixes a one-letter typo, pipeline turns green, confetti, end line "Jangan deploy hari Jumat"). Based on the typing template (real key presses, bubble tracking, glide camera) with two typing windows, a panic phase facing the camera, a terminal + CI pipeline screen (`stg(i,t)` stage states) and the shared voice-over module. Use it for any "something fails, then gets fixed" mascot story (swap the screen, captions, typo).
- `template-rival.html`: **two-character feud "Musuhan Satu Meja"** (Claude vs Codex as office rivals sharing one desk, 34 s). Not a "who is best" debate: it is a cold war with props. Back-to-back at the start (`cs` cold-shoulder factor turns both outward, arms folded), passive-aggressive code-review barbs, **sticky notes that fly from the sender's hand onto the rival's monitor** (`NT[]` list + `mkNote`, pure-function arcs, notes tear off when they make peace), a **single shared keyboard** they tug of war over (`kw` factor, `kb` group with 40 pressable `InstancedMesh` keys, collision sparks), a "SKOR DENDAM" (anger level) wall board that drops to 0 for "DAMAI SEMENTARA", then a **common enemy**: `PROD DOWN` (siren beacon with a sweeping red `SpotLight`, both monitors flip to red alert via mode `m`), they type on the shared keyboard together (`ty`: both arms reach, keys light orange/blue), high-five (`jy`), **and relapse** ("Btw, yang cepat tadi aku." → cold shoulder again, final pair of sticky notes crosses mid-air, end card "Kamu tim siapa?"). Monitor screens are mode-driven: `monL.draw(t,progress,m)` with `m` 0 review PR / 1 prod down / 2 joint fix / 3 success. Use it for any rivalry, frenemy, "forced to cooperate" story between two mascots; swap names, notes, barbs and the common-enemy event.
- `template-kuota.html`: **two-character comedy "Rebutan Kuota"** (Claude vs Codex share one token quota, 34 s). Claude answers in 3.000 words, Codex reads 312 files to change one word; a glass **token tank** (`tkLiq`, level = `REM(t)` keyframes `RK`) and a wall board "KUOTA TOKEN BERSAMA" (`drawBoard(rem,ca,cb,lab)`) drain together. Sticky-note blame, argument, then `429 KUOTA HABIS` (siren, red monitors), **frugal mode** (one sentence, one file, typing together, high-five), then the quota resets (tank flashes green, refills) and they relapse and drain it again. **Keyboard is driven by the hands**: `HD` (4 hands, each with a column zone and phase), `typeFx(t,act)` returns each hand's world target, the pressed key is the one under that hand and dips exactly at the stroke peak (`p`), arms stretch to it, and typed screen text = stroke count `STK` (1 char per stroke, no gaps). **Live action chips** under each mascot (`#aC`/`#aD`, `actOf(i,t)`: "membaca file · 83/312", "mengetik jawaban · 13/27", "⚠ kuota habis (429)", small chip under each mascot, shown only during that mascot's close-up (`FO` envelope: fades in on arrival, 1.2 s slow fade-out when the camera leaves), anchored to the stable base position, counters sampled at 6 Hz with tabular numerals, so nothing jumps) and Codex arms are ellipsoids (`armD`) always joined shoulder-to-hand. Monitors read `REM(t)` for their gauge; `md` 0 stream/read, 1 429, 2 frugal, 3 done. Same engine as `template-rival.html`; shift beats (`7.6`, `9.7`, `15.2`, `20.8`, `24.6`, `27`, `31`) together with `RK`. Use it for any "shared limited resource" gag; swap the prompt `PR1/PR2`, `CHAT`, `FILES` and caption lines.
- `template-bughunter.html`: **single-character thriller-comedy "Bug Hunter 02.00"** (33 s). Mascot sleeps with floating Z's, a siren beacon sweeps red light across the wall when the prod server breaks at 02:00, it wakes with a jolt and panics, hunts the bug with `grep`, a reticle locks onto a crawling bug on a monitoring dashboard, `git blame` reveals the author is *itself* three months ago (panic number two, "aku sendiri?!"), it fixes and pushes, the bug is squashed with a white flash + camera kick, the error graph drops to 0, the window flips from night to sunrise while the wall clock reads 05:47, confetti, end line "Jangan tulis “nanti aja” lagi". Same engine as `template-deploy.html` plus: several typing windows (`WIN` + `TL`, keys and terminal text stay in sync), a dashboard canvas (`err(t)` pure function drives counter, graph, pill, mood light), animated canvas bug (`bug()`), night/dawn window (`mkWin`) with `dw` factor driving ambient, sun light and window opacity, wall clock (`drawClock`), rotating siren `SpotLight`. Use it for any "midnight incident, hunt, twist, fix" story; swap the commands in `TL`, the log lines, captions and the twist.
- `template-bomb.html`: **single-character comedy-thriller "Misi Mustahil: Merge Conflict"** (33 s). A secret-agent mascot in **sunglasses** (`shd` group, flies off at the alarm, drops back on after the win, falls off again at the twist) stands cool in a laser-lit room. A merge conflict arms a **dynamite bomb with a digital timer** (`bdc` canvas, mirrored on the wall clock and in the monitor title bar, `RM(t)`/`cdS(t)` pure functions: 00:30 → 00:01 → AMAN) and a rotating siren. Real terminal + editor on one monitor: `git merge` conflict, `git diff --name-only`, a `sed` that removes the markers, a **duplicate-variable build error** (panic number two), `sed -i "39d"`, commit, push with 3 s left, white flash + camera kick, confetti, then the **twist**: reviewer Budi answers "LGTM" with **47 nitpick comments** (counter climbs, mascot panics again), end line "Selalu git pull sebelum beraksi". Same engine as `template-bughunter.html` (`WIN`/`TL` typing windows, `drawScr`, key presses, bubble tracking) plus laser fence (`LZ`, `lzM.opacity`), dynamite props and the shades animation. Use it for any "countdown, tension, clever fix, funny letdown" mascot story; swap the commands in `TL`, the editor rows `L` in `drawScr`, captions, the countdown length (`RM`) and the twist.
- `template-meeting.html`: **single-character comedy "Rapat 5 Menit"** (33 s). Mascot joins a video call that is supposed to last five minutes; the monitor shows a four-tile meeting UI with a live timer that climbs from `00:00:00` to `03:47:12`, chat messages, an agenda that keeps growing, and a "KAMU MUTE" gag where it turns back to camera in shock. The room time-lapses from 16:00 to 19:47 via a wall clock and a day → sunset → night window, while one coffee mug appears per story beat and the mascot gets bored, then sleepy (floating Z's). At 24.2 the meeting ends with confetti and a spin; the twist at 28.4 is a calendar notification "Meeting lanjutan, besok 07.00" (and the sticky note on the monitor changes too). Same engine as `template-typing.html` (keyboard with real key presses, chat composer synced to `WIN`/`TL`, bubble tracking, glide camera) plus `drawScr` meeting UI, `drawClock`, `drawNote`, and three window layers (`winS`, `winN`). Use it for any "meeting that never ends / office time-lapse / mute comedy" story.
- `template-trio.html`: **three-character versus** (Claude vs Codex vs Gemini debating, 32 s). Claude left, Codex centre, Gemini right (star-shaped body `ExtrudeGeometry`, violet `#b794f6`), three monitors, a three-bar benchmark board that ends in a tie, three bubbles (`bC`,`bD`,`bG`). It is the **most up to date base**: pure-function poses blended with factors (`sp` speaking, `ar` arguing, `tr` tired, `jy` joy), camera glide, bubbles with no CSS transition, thin grain, stabilised shadows. Use it for any 3-way debate and port its `frame(t)` pattern into the other templates when smoothness is asked.
- `template-code.html`: **two-character debate "Adu Kode"** (Claude vs Codex arguing whose code is better, 30 s). Not the general-model versus of `template.html`: the stake is code quality, so the wall carries a **three-criteria code-review board** (`drawBoard(A,B,mode)`: KEBERSIHAN / TES LULUS / PERFORMA, one column per model, a status line that goes MENILAI KODE… → EDGE CASE GAGAL → SERI 92 · PR #42 DIGABUNG). Claude's screen is an editor (`src/auth.ts`, real code, tab bar, green test bar), Codex's is a terminal (`npm test`, 50 lulus, `git diff --stat`); both switch phase together with the board because `drawBoard`/`monL`/`monR` read the same state string `A.join()+','+md`. Story beats are five constants: `T_BOARD` 3.2 (scores in), `T_REF` 9.8 (refactor/arms typing), `T_BUG` 15.6 (both fail the same `user = null` edge case: red line highlight, red `TypeError` banner, `EDGE CASE GAGAL` board, red `alarm` light, sweat drops and `!` marks), `T_FIX` 21 (green line, 55 tes lulus), `T_TIE` 22.8 (SERI, PR merged, confetti, spin). Use it for any code-quality debate, pair-programming roast or repo-review story; swap the snippets in `CODEL`/`FIXL`, the terminal rows `L` in `monR`, the criteria labels and the bar values `CL0/CL1/CX0/CX1`.
- `template-sleep.html`: **single-character** story (mascot asleep on a keyboard, a boss wakes it, progress bar). Use it for one-hero stories or when you need the boss/office set.
- `template-typing.html`: **single-character at work** story, the most polished base (Claude × Remotion: mascot greets, turns to the monitor, types code on a keyboard with real key presses, turns back for confetti). Has a Remotion-Studio-style screen (typed TSX, animated preview, timeline), a speech bubble that tracks the mascot's head, glide camera (no hard cuts), key-press system and a credit watermark and Indonesian voice over (Web Speech). **Prefer it for any one-mascot story** (coding, editing, designing, writing); swap the screen UI, captions and credit. `template.html` and `template-sleep.html` do not have its smooth-camera, bubble-tracking and keyboard code: port those blocks if the user asks for them there.

## Pick the base fast

| Characters | Template | Notes |
|---|---|---|
| 1 | `template-typing.html` | smooth camera, key presses, bubble tracking, VO (story: Claude × Remotion) |
| 1 | `template-deploy.html` | same engine, story: failing deploy, panic, fix, success |
| 2 | `template-kuota.html` | token-quota gag: tank + board drain, 429, frugal mode, reset, relapse |
| 2 | `template-rival.html` | feud story with props: sticky-note sabotage, one shared keyboard, common enemy, peace, relapse (use for "musuhan", rivalry, frenemies) |
| 1 | `template-bughunter.html` | same engine, story: 02:00 outage, bug hunt, git blame twist, sunrise (most dramatic single-mascot base) |
| 2 | `template.html` | factor-based motion + camera glide (same pattern as trio) |
| 2 | `template-code.html` | code-quality duel: three-criteria review board, editor + terminal screens, shared edge-case bug, SERI + PR merged (use for "adu kode", "code review") |
| 1 | `template-bomb.html` | same engine, story: secret agent defuses a merge-conflict bomb (countdown, lasers, sunglasses gag, 47-comment review twist); funniest single-mascot base |
| 1 | `template-meeting.html` | office comedy: video call, mute gag, time-lapse clock, coffee mugs, sleepy mascot, meeting-again twist |
| 3 | `template-trio.html` | newest motion code: factors `sp/ar/tr/jy`, camera glide, no-flicker rules |
| 1 + boss/office | `template-sleep.html` | office set; factor-based motion, glide camera (hard cuts only to the boss close-up) |

Tools in `scripts/`: `lint_short.py` (run before delivering), `check_props.mjs` (validates the 100-prop kit: layer counts, clipping at 600 timeline samples, collisions, L0 bokeh separation, density cap), `export_mp4.py` (60 fps MP4 on a machine with network + playwright + ffmpeg). Studio in `studio/`: `node studio/server.mjs` → `http://localhost:5199/studio/`.

## Workflow

1. **Study references first.** Video reference: `ffmpeg -i ref.mp4 -vf "fps=0.6,scale=400:-1,tile=4x4" -frames:v 2 sheet_%d.png`, view the sheets, write down shots (with seconds), characters, props, on-screen text, camera distance, mood. Image reference of a mascot: view it, measure proportions in pixels (head width, body width, legs, screen size and position), note the expressions it shows, and copy them. No reference: write an 8 to 12 shot list yourself (24 to 36 s).
2. **Name the topic props before building.** Ask: "what objects tell a viewer the topic in one glance with the sound off?" A story about AI models needs monitors with real chat/terminal UI, a benchmark board, keyboards, code. A bare stage with two mascots does not read as the topic and the user will call it out. Every shot needs at least one topic prop in frame.
3. **Copy the template** to the outputs folder. Edit by slicing between markers with a short python script, not by retyping the file:
   - versus template: scene block runs from `// scene:` to `// post-processing`; timeline block runs from `// timeline` to `function loop(now){`. Monitors are `mkMon(x,drawFn,color)`; mascots are plain groups (`cm`, `dm`) moved in `frame(t)`.
   - sleep template: scene block runs from `// lights` to `// post-processing`; timeline from `// timeline` to `function loop(now){`.
   - typing template: same scene markers; `drawScr` (screen UI) sits just before `// mug + lamp`; keyboard + `keyFx` right after the `keys` InstancedMesh; timeline = `const shots=[` through `const LEN=...,caps=[...]`, then `function frame(t){`. Boss/office set was removed from it.
   - rival template: scene blocks as in `template.html`; story beats are hard-coded times, so shift them together (search `15.2` prod down, `20.8` joint work, `24.6` high-five, `29.2` relapse). Factors: `cs` cold shoulder, `ar` arguing, `kw` keyboard war, `al` alert, `ty` typing together, `jy` joy, `fe` fury. Sticky notes are rows in `NT` (`f` sender, `to` target on the monitor, `a`/`b` flight window, `o` tear-off time). Keep every shoulder gap above about .1 units: `g=(.5*ar+.8*jy+.25*kw)*(1-cs)` is the inward shift, so raise it carefully.
   - bughunter template: scene blocks as in the typing template; typing windows are `const WIN=[[start,end],...]` with their text in `TL` (27 letters/s, so window length is about `chars/27 + .3` s); keep `WIN` windows disjoint. Screen = `drawScr(t)` (terminal left, dashboard right); story beats are hard-coded times in `drawScr`, `err`, `frame` and `caps`, so shift them together (search for `23.4`, the bug-squash moment, and `2`, the alarm).
   - bomb template: same markers as bughunter. Typing windows `WIN` (5.6, 11.4, 17.4) with text in `TL`; editor rows are the `L` arrays in `drawScr` (phases switch at 2.8 conflict, 13 markers removed, 18.6 fixed); countdown is `RM(t)` (starts 2.8, ends at 23.4, the defuse moment shared with confetti, flash and camera kick). Story beats are hard-coded times (`2.8` alarm, `13.6` panic two, `23.4` defuse, `27.4` review twist), so shift them together. The window shows night only (no dawn).
   - meeting template: same keyboard/bubble/camera engine as typing. Typing windows `WIN` (9, 21.6) with chat text in `TL`; `drawScr(t)` draws the four video tiles, timer (`meetSec`), chat log `CHAT`, agenda and the end/notification overlays; `MEET_END=24.2` is shared by the timer stop, confetti, spin and screen end card. Story beats are hard-coded (`6.9` mute turn, `10.2/13.6/16.8` coffee mugs, `28.4` calendar twist), so shift them together. Wall clock `drawClock` runs 16:00 → 19:47 and window layers `winS`/`winN` crossfade to sunset/night.
   - code template: same markers as `template.html` (scene → post-processing, timeline → `function loop`). The story is driven by five constants (`T_BOARD` 3.2, `T_REF` 9.8, `T_BUG` 15.6, `T_FIX` 21, `T_TIE` 22.8); shift them together with `caps`, `shots`, the particle windows (the `PS` rows and `parts.visible`) and both screen phases. `drawBoard(A,B,mode)` takes three values per side (0-100) and a mode (0 menilai / 1 gagal / 2 seri); the monitors receive the same mode as part of a state string (`A.join()+','+md`), so a new screen phase means editing `monL`/`monR` together with the board. Scores come from `CL0/CL1/CX0/CX1` in `frame(t)`.
   - Small follow-up edits: use the Artifact tool `edit` action (old_str/new_str) or a python replace with `assert text.count(old)==1`.
4. **Edit order:** palette and lights, characters, set dressing and topic props, screen/UI canvases, timeline (`shots`, `caps`, phases in `frame(t)`), overlays (title, bubbles, end card), post-processing.
5. **Verify what you can.** Run `python3 scripts/lint_short.py /mnt/user-data/outputs/page.html`: it checks the mandatory credit, hosted-page constraints, syntax, flicker traps and caption speed. Fix every error; read every warning. The container cannot load three.js (jsDelivr is not allowed), so the page cannot be rendered there: say plainly it was not run and list what needs a visual check (framing, clipping, text size on a phone).
6. **Deliver.** Publish as a hosted page when the Artifact tool exists; to revise, publish again with the existing `url` so the same link updates. Otherwise present the `.html`.
7. **Video file requested?** The page cannot export MP4 inside the container. Give the user `scripts/export_mp4.py` (run on their machine; not tested here, say so) or tell them to screen-record, or render frames with headless Chromium: the template exposes `window.renderAt(t)`; screenshot each frame at 60 fps (t = i/60), then `ffmpeg -framerate 60 -i f_%04d.png -c:v libx264 -pix_fmt yuv420p out.mp4`.

## Architecture (keep it)

- **Everything is a pure function of time**: `frame(t)` sets every pose, light, screen, bubble and camera for second `t`. No hidden state, so loops and `renderAt` work.
- **Shots**: `shots=[[t0,[camPos],[lookAt]],...]`. Camera lerps toward the current shot; on a cut (`t - t0 < .05`) it snaps. Add subtle handheld shake and a slow push-in per shot.
- **Characters** are groups of primitives with pose phases as `if (t>=a && t<b)` blocks. Poses blend with `sm(cl(...))` easing.
- **Screens/UI/posters/scoreboards** are `CanvasTexture`s. Redraw only when a cache key changes (quantize time, e.g. `Math.floor(t*8)`).
- **Overlays** are DOM elements inside `#stage`, sized 9:16 with `--u` = stage width / 100 so text scales.
- **Post stack** (jsDelivr three@0.128.0): RenderPass (MSAA target), BokehPass (focus follows camera-to-target distance), UnrealBloomPass, AfterimagePass (motion blur), FXAA, custom grade ShaderPass (chromatic aberration, color grade, vignette, grain, fade).
- **Particles**: `THREE.Points`, additive soft-dot + brand-shaped sprite, positions computed analytically from `t`.

## Scaling to N characters (what the trio template does)

- Keep parallel arrays: `X` (positions), `DR` (lean/face direction toward the centre: +1, 0, -1), `ph` (phase offsets so idle sway never syncs), `G` (groups), `sp` (speaking envelope per speaker), one `.bub` per speaker (`B[i]`).
- Spacing: monitors 2.4 wide need centres at least 2.6 apart (no coplanar overlap). Visible width is about `0.975*d`, so three characters need d of about 7.6 for wide shots and about 5.2 for a single-speaker close-up.
- Shared phase factors drive every pose: `ar` arguing, `tr` tired, `jy` joy; per-speaker `sp[i]` adds hop and the raised arm. Never write per-character `if` blocks.
- Lights: one spot per character in its accent; raise its intensity with `sp[i]` so the speaker is lit.
- Gemini mascot: four-point sparkle body (`ExtrudeGeometry` of a concave star, control points near `(.22,.22)`), violet `#b794f6`, two dark slit eyes, sphere arms/legs. Keep it distinct from Codex blue.

## Characters

- **Brand mascots keep the real silhouette.** Claude: wide orange body, two tall black eye slits, small side arm nubs, four short legs in a row. Codex (from the OpenAI reference): soft cloud head, big rounded dark-navy screen showing a light-cyan `>` and `_` with a wide gap, tiny rounded body with `>-` on the chest, small round arms, two short legs. Never invent a generic cube when a reference or brand is known.
- **Soft 3D mascot recipe (Codex template):** cloud head = flat-fronted rounded-rect `ExtrudeGeometry` core (bevelled) plus a ring of 10 overlapping spheres at slightly varied radii; screen = thinner rounded-rect extrude (inset, slightly proud of the core) with a `MeshBasicMaterial` canvas plane in front; torso and limbs = scaled spheres; satin material (`roughness .45`). No black outline unless the reference is pixel art.
- **Face as canvas with named states** (`drawFace(mode,blink)`): normal prompt, angry (slanted bars), happy (`^ ^` arcs), tired (flat bars). Cache by key. Match expression states to story beats.
- **Second character gets its own accent** (Claude orange `#d97757`, Codex blue `#3c64e1` body / `#5b7cfa` UI / `#7b8cff` glow). Carry each accent into its monitor, light, LED, particles and speech bubble.
- **Spacing between two characters:** compute from arm/head half-widths (nubs stick out past the body). Gap must stay above about 0.1 units during shoves, or limbs clip. Scale the taller character down (about 0.85) so heads are comparable.
- **Stand on surfaces:** feet at floor top; no teleporting between phases; reaction marks (`!`) about 0.3 above the head.

## Topic props and screens (this is what makes it read)

- Monitors need real-looking UI: window chrome, title (for example "Claude · Sonnet 5.5"), user bubble, streaming code lines, progress/score bars tied to the story state, a blinking cursor for terminals. Type the user's prompt text exactly.
- **Screen grading** (do all of these, flat screens look cheap): dim the screen material (`color.setScalar(.88)`); bake a radial vignette into the canvas after drawing; add a glass plane with a diagonal reflection and faint scanlines in front; add a soft additive radial halo plane behind each monitor in the character's accent; add a small LED strip below; add a dim colored `PointLight` in front of each monitor.
- A scoreboard canvas on the wall (title, one bar per contender, tie label) gives the debate a visible stake. Drive both monitors and the board from the same score variables.
- Never leave a background empty: wall, baseboard, neon strips, crates, posters, shelves. DOF blurs it anyway.

## Speech bubbles (per character)

- One DOM `.bub` per speaker, not one shared caption. Each frame project the head's world position with `v.set(x,y,0).project(C)` (call `C.updateMatrixWorld()` first), convert to stage pixels, place the bubble above the head, clamp it inside the stage, and point the tail at the head (`--tx`, also clamped).
- Style: solid dark fill (`rgba(20,20,19,.94)`), cream text, **thin 1 px border** in the speaker's accent (`max(1px,calc(var(--u)*.2))`), small rounded tail made with a rotated square with two borders. Thin lines are a user preference.
- Update text only when it changes (`dataset.k`); read `offsetWidth/Height` only for visible bubbles. A line can belong to Claude, Codex, or both (two bubbles).

## Typography

- Use one clean sans for everything: **Plus Jakarta Sans** via `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap` (allowed host), fallback `"Segoe UI",system-ui,sans-serif`. Title/end card 800, bubbles 700. Avoid serif unless the user wants it.
- Canvas text uses the same stack. Web fonts load late, so after `document.fonts.ready` reset the canvas cache keys (for example `lastB=''`); monitors redraw on their own because their key includes quantized time.
- Sans is wider than serif: title about 9u, end card about 7u, bubbles about 4.4u. Check the longest string fits 100u.

## Hard-won rules (each one was a real bug)

- **Smooth edges**: `renderer.antialias` does nothing with an EffectComposer. Use `WebGLMultisampleRenderTarget`, `comp.setPixelRatio(R.getPixelRatio())` before `comp.setSize`, and an FXAA pass (set `resolution` uniform to `1/(w*pr),1/(h*pr)`) before the final grade pass.
- **60 fps**: all motion time-based. Scale AfterimagePass damp with `Math.pow(damp, dt*30)`. Cap pixel ratio 1.5 on mobile, grain quantized to 24 fps and faint (about 0.025).
- **Particles belong to the event**: spawn on the characters' bodies or the contact point at the beat, emit while the pose lasts, keep them close, brand-shaped sprite. Hide Points during the Bokeh depth pass.
- **Portrait FOV**: fix horizontal FOV (about 52 deg) and derive vertical (`fitFov`). Visible width at distance d is `2*d*tan(26deg)` (about 0.975*d): two characters plus arms need d of about 4.6 or more; a single close-up about 3.8.
- **Frame the whole subject** in every shot; clipped characters read as broken. For close-ups on one speaker, the other may leave frame only if they are silent.
- **Lighting restraint**: key about 1.0, ambient about 0.35 to 0.4, exposure below 1 in the grade shader, bloom about 0.15 with threshold 0.9. One warm and one cool spot (character accents) plus a weak white rim beats many bright lights.
- **Loops**: timeline must loop cleanly; reset camera to shot 0 values on restart.
- **UI screens** show state matching the story (scores 0 before the debate starts, tie when the board says tie).
- **Anchors for DOM overlays** include the hop offset so bubbles follow jumps; leave a gap above reaction marks of the *other* character only.

## Dialogue writing (make debates funny, not flat)

- **Arc for 3+ speakers:** claim (each states a brag) → counter (each answers the previous speaker's line, not just its own brag) → escalation (short, sharper lines, shorter windows) → exhaustion ("Aduh… capek debat sama kalian…") → twist (the board shows a tie) → resolution that invites the viewer (collaborate, then end card asks who wins).
- **Each speaker has a voice:** Claude = calm and a little smug about clean code; Codex = blunt, terminal-first, action words ("langsung eksekusi"); Gemini = brags about scale (1M token context) and demands recounts. Keep it playful, never insulting a real product or person.
- **Answer the previous line:** "Rapi doang?" after "Kodeku rapi", "Sejuta token, tapi tesnya lulus berapa?" style callbacks beat three unrelated boasts.
- **Length:** at most 2.5 words per second of caption window (3.2 s window = 8 words, 2.4 s = 6 words). One idea per line, punchy ending word. Narrator VO opens with the question and closes with the question for the viewer.
- Lines belong to one speaker each (one bubble at a time); do not show the same text in three bubbles.

## No flicker, no glitch (checklist for "mulus tanpa glitch")

- Nothing toggles on a frame boundary: marks, sweat drops, bubbles, spins and hops all use scale/opacity envelopes (`pop(a,b)=s2(a,a+.3)*(1-s2(b-.3,b))`) that reach 0 before the phase ends; `visible` flips only when the envelope is below .02.
- No CSS transitions on anything that tracks a 3D position (bubbles, marks).
- No two coplanar meshes (monitors spaced so their frames never overlap: x gap at least 0.2).
- Spot-light shadows: `mapSize 1024`, `bias -.0004`, `normalBias .02`. Grain about .012 quantised to 24 fps. AfterimagePass damp constant (about .38 to .48), never switched per shot.
- Monitor canvases redraw at `floor(t*30)`; board/face canvases only when their key changes.

## Smooth motion (the user asked for "mulus", so do all of these)

- **No hard cuts, no per-frame lerp.** `shots` are keyframes; the camera glides from the previous shot's target to the current one with `sm(cl((t-t0)/1.4,0,1))` (position and look-at). Pure function of `t`, so loops and `renderAt` stay exact. A per-frame `lerp(.07)` is frame-rate dependent and a snap-on-cut looks jumpy.
- **No per-shot push-in that resets** (it pops at every shot change). Use one global drift: `C.position.z -= Math.sin(t*.35)*.08`.
- **Focus** = `bokeh.uniforms.focus.value = C.position.distanceTo(camL)` (no smoothing needed once the camera is smooth). Afterimage damp: constant about `.38 + .12*work`, never switched by shot.
- **Blend poses with factors, not `if` blocks.** Use `sw` (working 0..1 via `sm`), `hF` (happy 0..1) for eyes, arms, legs, lean. Hops get an envelope that reaches 0 before the phase ends (`*(1-sm(cl((t-a)/d,0,1)))`). Spins end on a multiple of 2π.
- Screen canvas redraws at 30 fps (`floor(t*30)` in the cache key) so the UI animation is not choppy; add event counters (keystrokes) to the key.

## Mascot facing a monitor (orientation)

- Monitors face the camera, so a mascot facing its monitor shows its **back** to the viewer. Layout back to front: camera, mascot (z about +.6), keyboard (z about -.3), monitor (z -1.2). Mirror the arm math (forward is -z world, `rotation.y = π`; the mascot's local left arm is world +x).
- Keep the face visible at story beats: greet the camera first (rotation 0), turn to the monitor with `π*sm(...)`, turn back with another `π*sm(...)` for the payoff, and add a full `2π*sm(...)` spin for celebration. Sum of smoothsteps = continuous, no pop. Add `sway*.25` while working.
- If the user wants the face to stay visible while working, move the mascot to the side in 3/4 view instead, and say the screen then reads at an angle.

## Realistic keyboard typing

- Keys are one `InstancedMesh`; update **every key each frame**: `setMatrixAt` (y down about .045, `rotation.x = pr*.09`) and `setColorAt` (lerp cream to warm orange `0xff9a5c` by press), set `instanceMatrix.needsUpdate` and `instanceColor.needsUpdate`. Neighbour keys dip 25%. A weak orange `PointLight` over the board flashes with the sum of presses.
- `stroke(t,arm,sw)` is a pure function: arms alternate at 5 strokes/s each (10 keys/s); press profile `sin(f/.6*π)` for `f<.6`, else 0; pressed column = column under that arm's world x; row hops between rows 1..3 and the arm's reach interpolates between rows over the first half of the stroke (no jumps).
- Arms are boxes elongated with `scale.z` and centred at `(zt+.25)/2` so the tip lands on the pressed row; blend from side nubs (`sw=0`) to reaching (`sw=1`). Arm y = hover (key top + .08) minus `.1*press`. Body leans forward `.14*sw`. Legs only tremble (`.12*sw`), no marching.
- **Sync the screen to the keys:** typed characters = `floor(strokes)*2.7`, and the screen cache key includes the stroke count. Never type text on a separate smooth timer.

## Speech bubble that follows the mascot

The typing template implements this in `frame(t)` (DOM `#cap`, one speaker). For two speakers use one `.bub` each.
- Anchor: `bv.set(mas.x, 1.15 + hop*.35, mas.z).project(C)` after `C.updateMatrixWorld()`; convert to stage px; `left = clamp(px - bw/2, 2u, SW-bw-2u)`, `top = clamp(py - bh - 3.5u, ...)`; tail x via CSS var `--tx` = clamp(px-left); `transform-origin` at the tail so the pop scales from it.
- Appearance is a pure function of time: `o = sm(cl((t-q0)/.25))*sm(cl((q1-t)/.25))` drives opacity, a 2u rise and scale `.88 + .12*o`. `transition:none` (a CSS transition on transform makes the bubble lag the head). Only touch `textContent` when `dataset.k` changes; read `offsetWidth/Height` only while visible.
- Move the title up (`top:12%`) so it never collides with a bubble above a mascot at screen centre.

## Voice over (Web Speech, no network)

**All templates share one voice-over module** (start overlay `#go`, mute button `#snd` in `#gui`, `VO[]` parallel to `caps[]`, `caps[i][3]` = speaker index into the `VP[[pitch,rate],...]` table, `NARR=[[t,text,seconds],...]` for narrator lines spoken as speaker 3). Edit only the data lines (`VO`, `NARR`, `VP`) when making a new short; never fork the module.

The typing template narrates each caption with `speechSynthesis`, synced to the timeline. Keep this pattern for every short unless the user says silent.
- `VO[]` is parallel to `caps[]` (same index). Write VO as natural spoken Indonesian, short enough to finish inside its caption window (about 2.5 words per second at `rate 1.08`; a 2.6 s window fits about 6 words). Spell names for the voice, not the eye: "Klod" for Claude, "Hanz Vibes" for @hanzvibes; keep the on-screen caption spelled normally.
- `vo(T)` runs in `loop()` after `frame(T)`: when the active caption index changes, `speechSynthesis.cancel()` then speak `VO[k]` (`lang id-ID`, pick a voice whose lang starts with `id`, `pitch 1.15` for an excited tone). Reset `vLast=-1` on restart, resume and unmute; `cancel()` on pause and mute.
- Browsers block audio without a tap: show a start overlay (`#go`, button "Putar dengan suara") that sets `vOn=true`, `T=0`, hides itself. Keep the video looping silently behind it. The mute control is `#snd` inside the gallery-style control bar (`#gui`, see "Gallery-style player UI").
- Voice quality depends on the device. Say so: no Indonesian voice installed means the default voice is used. Web Speech audio cannot be exported into MP4; for a file with narration tell the user to screen-record with internal audio on, or give them `VO[]` plus the `caps` start times so they can generate audio in a TTS tool and lay it over the video.
- Not run here: the container cannot play audio, so never claim the voice was heard. List "VO timing and pronunciation" in what needs a device check.

## Gallery-style player UI (all templates)

The player chrome looks like a phone gallery app (Google Photos / Samsung Gallery), not a web page with buttons. It is UI only: timeline, voice over and `renderAt` are untouched. Never put back a fixed `#bar` with text buttons.

- **Start screen `#go`**: dimmed first frame, big round glass play button `#gob` (SVG, no text), small line `#gos` (voice status), duration badge `#gdur` bottom-left like a video thumbnail. `#gob` click keeps the old handler (`vOn=true`, `T=0`, hide `#go`).
- **Controls `#gui`** (z-index 6, inside `#stage`, sized with `--u`): top bar `#gtop` (back arrow `#gbk` returns to the start screen, file-style title from `document.title`, date line), centre round play/pause `#gcc`, bottom bar `#gbot` with current time, seek track `#gtr` (tap or drag, pointer events), total time, then a row: volume `#snd` (speaker / speaker-off icon), rewind and forward 5 s (`#grw`, `#gff`), replay `#pl`.
- **Behaviour**: tapping the video toggles the controls (`window.gTap`), they auto-hide after 3 s while playing and stay visible while paused. The canvas click handler only calls `gTap`; pausing is done by `#gcc`.
- **Module**: one extra `<script>` at the end of `<body>` (reads `T`, `LEN`, `paused`, `vMute`, `vLast`, `syn` from the main script). Edit only title, colours and sizes; never fork the logic.
- `#wm` has `z-index:7` so the `@hanzvibes` watermark stays above the scrims.

## Studio (self-host, all templates)

`studio/` is a zero-build studio for the whole pack: template picker, live 9:16 preview, scrub, shot/caption jump, text overrides and an optional MP4 exporter.

- Run it with `node studio/server.mjs` (zero-dependency static server, root = skill folder) and open `http://localhost:5199/studio/`. Registry: `studio/templates.json`.
- **Do not add code to the templates for this.** The studio loads a template's HTML, applies text overrides on the markup (`#title`'s `<small>`, the `#end` line, `<title>`), and injects a small bridge before `</body>`, then sets it as the iframe `srcdoc`. The file on disk stays untouched, so lint/publishing rules still apply.
- The bridge works because template scripts are classic scripts: after them, `T`, `paused`, `LEN`, `caps`, `shots`, `renderAt` are reachable in the same global lexical scope. The injected script exposes `window.__st` with `gT()`, `seek(t)`, `play()`, `pause()`, `len()`, `caps()`, `shots()`, `mute(b)`, and hides the template's own `#go`/`#gui` player chrome so the studio's transport is the only one on screen.
- UI: white/blue theme, collapsible left **drawer** with the template list (overlay + scrim below 1180px), a transport pill (`play`, ±5s, scrub, loop) and a right inspector with **Teks / Shot / Caption** tabs. Shortcuts: Space play/pause, ←/→ ±1s, Shift+←/→ ±5s, Esc closes the drawer.
- Scrubbing must always go through `renderAt(t)`; never composite a scrub from live playback state.
- `studio/export.mjs` renders frames with Playwright and encodes with ffmpeg on your own machine. It cannot run in a Workers/Sites environment and never includes Web Speech audio; mux an offline TTS track if narration is needed.
- Replacing a template wholesale (new scene, new `LEN`) needs a new entry in `studio/templates.json`; text overrides are optional per entry (`title`, `sub`, `end`).

## Credits (mandatory)

**ALWAYS credit `@hanzvibes` in every short made with this skill, whether or not the user mentions it.** Two places, no exceptions: a small watermark top-right for the whole video (`#wm`, about 3.2u, 75% opacity, text `@hanzvibes`) and a `by @hanzvibes` line on the end card (`#end small`, bold, accent colour, about 4u). All templates already contain both; never delete them when swapping characters, captions or palette. Copy the handle exactly (`@hanzvibes`, lower case). If the user gives an extra handle, add it next to this one; it never replaces it.

## Revising a published page

Use the Artifact tool `edit` action with the page `url` and a list of `old_str/new_str` pairs (all or nothing, each `old_str` unique and copied exactly). After edits, extract the main `<script>` from the file in `/mnt/user-data/outputs` and run `node --check`. Prefer several small edits over one huge one. Edits that only change CSS or text need no syntax check.

## Publishing constraints (hosted page)

Single file. Scripts only from cdnjs.cloudflare.com, cdn.jsdelivr.net/npm/, cdn.tailwindcss.com, code.jquery.com, each pinned (three r128 / 0.128.0); stylesheets only from fonts.googleapis.com (fonts from fonts.gstatic.com). No remote images, no `localStorage` dependence, no download links, no calls to api.anthropic.com. Include `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. Use curly quotes in visible text.

## Quality checklist before delivering

- [ ] Topic is readable with sound off (relevant props and screens in every shot)
- [ ] 9:16 stage letterboxed on desktop, readable text on a phone
- [ ] Full-body framing everywhere; no limb clipping in the closest shot
- [ ] Mascots match the brand or reference silhouette and colors
- [ ] One palette; each speaker's accent consistent across bubble, light, screen and particles
- [ ] Bubbles stay inside the stage and point at the right head
- [ ] One clean font everywhere; canvas text redrawn after fonts load
- [ ] Bloom thin, key light not blown out, DOF focus follows the subject
- [ ] Timeline loops; no pops at phase boundaries (hop, spin, eyes, arms all blended)
- [ ] Camera glides between shots (no hard cuts, no per-shot push-in reset)
- [ ] Keys visibly depress and glow under the arms; screen text grows on the same beat
- [ ] Speech bubble sits above the mascot's head every frame and stays inside the stage
- [ ] Voice over lines fit their caption windows, names spelled phonetically, start overlay and mute button work
- [ ] `@hanzvibes` present twice: watermark top-right + `by @hanzvibes` on the end card (always, even if not requested)
- [ ] On-screen text (prompts, handles, captions) typed exactly as the user wrote it
- [ ] `node --check` passed on the script; reply says it was not rendered
- [ ] Reply is short: what was built, assumptions, what was not verified, one offer for the next tweak

## Changelog

- v3.14: `template-perang.html` revised: realistic punches (wind-up, strike, recoil, hit reaction, KO), softer mascot motion (squash/stretch, head and arm lag, leg gait, hop arc out of portals), collision-free layout (verified by a node simulation), event-relevant particles, Catmull-Rom camera with no stop-and-go and no high-frequency jitter. Still not rendered in three.js here; smoke-tested `frame()` over 1020 frames with stubbed three.

- v3.13: new 12th template `template-perang.html` ("Perang Sub Agent": mini sub agent armies, cardboard forts, coin catapults, blue button, intern twist, receipt printer). Built on the rival engine; only early frames were render-checked.

- v3.12: new 11th template `template-kuota.html` ("Rebutan Kuota": shared token tank and board, 3.000-word answer vs 312-file read, 429 siren, frugal mode, quota reset and relapse).
- v3.11: studio UI rebuilt — light theme sampled from `claudeku-studio.vercel.app` (`--bg #f9f9fa`, white cards + `#ebebeb` borders, terracotta `#d97757` primary, indigo `#3c64e1` secondary, 16px radius, Plus Jakarta Sans), collapsible left template drawer (overlay under 1180px), transport pill, Teks/Shot/Caption inspector tabs, and micro-interactions (drawer slide + scrim, staggered list entrance, hover/press states, focus rings, shimmer skeleton, toast, progress-filled scrubber). Logic split into `studio/studio.js`. Fixed three bugs found by running it: `const B` shadowing that made `frame()` throw, preview stage collapsing to a 50×89 px thumbnail, and the iframe auto-playing while the studio slider sat at 0:00.
- v3.10: `template-code.html` now carries a **100-prop kit** in five depth layers (L0 foreground bokeh 8, L1 desk 12, L2 mid-back 40, L3 wall 28, L4 far 6, plus 6 animated details) merged into 5 vertex-coloured meshes + 6 detail draws (≈11 extra draw calls), with a quality tier for small screens and `propsAnim(t)` for steam/LED/fan/leaves/clock hands. New `scripts/check_props.mjs` verifies 100 unique props, no mid-frame slices across 600 samples, no collisions with characters/monitors/board, L0 always ≥1.1 units from focus while the camera holds, and ≤20% frame density (currently 18.8%). Also new **`studio/`**: self-hosted preview studio (`node studio/server.mjs`), bridge via injected `postMessage`, template registry, and an optional Playwright+ffmpeg exporter.
- v3.9: new 10th template `template-code.html` ("Adu Kode": Claude vs Codex debating whose code is best — three-criteria code-review board, editor vs terminal with live test counts, a shared `user` null edge case that turns both red, a one-line fix, then SERI + PR #42 merged).
- v3.8: new 9th template `template-meeting.html` ("Rapat 5 Menit": video call that never ends, mute gag, 16:00 → 19:47 wall clock, day → sunset → night window, coffee mugs, sleepy pose, meeting-again calendar twist).
- v3.7: gallery-style player on all 8 templates (round play button, top bar, seekbar with times, volume icon, ±5 s, replay, auto-hiding controls). Old `#bar` text buttons removed.
- v3.6: new `template-bomb.html` ("Misi Mustahil: Merge Conflict": sunglasses agent, dynamite bomb with live countdown, laser fence, duplicate-variable panic, push at 00:01, 47-comment review twist).
- v3.5: new `template-rival.html` ("Musuhan Satu Meja": Claude vs Codex office feud, sticky-note sabotage, shared keyboard tug of war, prod-down siren, temporary peace, relapse). Fixed a hop pop in the factor code (constant hop frequency, no `jy>.5?10:9` switch) in the new template.
- v3.4: new `template-bughunter.html` (story "Bug Hunter 02.00": siren, bug hunt, git blame twist, night to sunrise window, wall clock, squash flash + camera kick).
- v3.3: new `template-deploy.html` (story "Deploy Jumat Sore").
- v3.2: all four templates unified: one voice-over module and start overlay, same loop/handlers/renderAt tail, smooth blink envelope, same camera shake, no camera state resets; lint warns when `#go`/`#snd` are missing.
- v3.1: `template.html` and `template-sleep.html` ported to the factor/glide pattern (no per-frame lerp, no popping marks, blended arms/eyes/mouth); lint refined.
- v3: mandatory `@hanzvibes` credit in all templates, `template-trio.html`, dialogue and no-flicker guidance, N-character recipe, `scripts/lint_short.py`, `scripts/export_mp4.py`.
