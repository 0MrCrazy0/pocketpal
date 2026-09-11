# PocketPal

A browser-based virtual pet inspired by classic **Tamagotchi**.

Raise your pet from egg to adult, manage hunger and happiness, turn the lights out at bedtime, discipline false calls, and pass genes to the next generation through friendship codes.

**Play live:** [https://0mrcrazy0.github.io/pocketpal/](https://0mrcrazy0.github.io/pocketpal/)

---

## Features

- Full life cycle: **Egg → Baby → Child → Teen → Adult → Elder**
- Care-based evolution (good care = better forms)
- Real-time growth pace (classic hardware-style)
- Sleep schedule with lights-out care mistakes
- True pause (Hold **B**) — freezes aging and needs
- Discipline system with false calls
- Hunger, happiness, poop, sickness
- Friendship codes + breeding / next generation
- Pixel-art sprites with life-like eye movement and animations
- Works offline as a PWA (installable)

---

## Controls

| Button | Action |
|--------|--------|
| **A** | Previous menu icon / Left in play game |
| **B** | Confirm / Right in play game |
| **Hold B** (~1.2s) | Pause / Resume (clock-style freeze) |
| **C** | Cancel / Back |
| **P** (keyboard) | Pause toggle |

Menu icons (select with A, confirm with B):

| Icon | Function |
|------|----------|
| 📊 | Status |
| 🍖 | Feed (meal / snack) |
| 🎮 | Play mini-game |
| 🧹 | Clean poop |
| 💊 | Medicine |
| 💡 | Lights on/off |
| 📡 | Connect (friends & breeding) |
| 📢 | Discipline |

---

## How to play (classic style)

1. Start a new life and wait for the egg to hatch.
2. Feed when hungry, play when bored, clean when dirty.
3. At bedtime the pet gets sleepy — turn **lights OFF**.
4. Discipline only when the pet calls but does **not** need food, play, or cleaning (false call).
5. Pause with Hold B if you need to step away.
6. Share your 6-letter code with a friend; only valid codes work.
7. When adult, breed with a friend to pass care quality to the next generation.

**CARE MISS** — neglect (hunger, happiness, lights, dirty).  
**DISCIPLINE MISS** — disciplined at the wrong time.  
Lower misses → better evolutions.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Full game (UI + logic) |
| `manifest.json` | PWA manifest |
| `service-worker.js` | Offline cache |
| `icon-192.png` / `icon-512.png` | App icons |
| `icon.svg` | Icon source |

---

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Service worker and PWA install work best over `localhost` or HTTPS (GitHub Pages is fine).

---

## Deploy (GitHub Pages)

1. Push this repo to GitHub.
2. Settings → Pages → Source: **Deploy from a branch** → `main` / root.
3. Site will be at: `https://<user>.github.io/<repo>/`

---

## Version

**v2.13**

- Popup overlays the full device (above icons & buttons)
- Menu icons under the pet screen
- Checksum-validated friend codes
- CARE MISS / DISCIPLINE MISS labels
- Full animation pack (hatch, yawn, wake, poop, call, refuse, dance, etc.)
- Real-time default growth speed

---

## Credits

Inspired by the original Tamagotchi (Bandai).  
Built as a single-page web game for fun and nostalgia.

---

## License

MIT — free to play, fork, and improve.
