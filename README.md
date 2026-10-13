# PocketPal 🥚

A little pixel pet that lives in a pink handheld, just like the 90s Tamagotchi and Digimon toys.

**[▶ Play PocketPal](https://0mrcrazy0.github.io/pocketpal/)**

This is **version 2.4.74**. It's free, has no ads or accounts, and works offline. On a phone, open the link and choose **Add to Home Screen** to install it like an app.

## How to play

1. **Pick an egg** and wait for it to hatch.
2. **Look after your pal.** Feed it, play with it, clean up its poop, give it medicine when it's sick and turn the lights off at bedtime.
3. **Answer its calls.** When a **!** flashes, your pal needs something. Ignoring it for too long is a *care mistake*.
4. **Watch it grow:** egg, then baby, child, teen and adult (about 4 days). Good care gives the best adult form.
5. **Battle and collect.** Adults fight in the arena, learn skills, battle friends and have eggs of their own.

There are 6 animals (croc, lion, eagle, elephant, bear and wolf), each with 3 main adult forms: **Scrappy**, **Solid** and **Champion**. A Solid pal can also grow into a **Mighty**, **Swift** or **Sturdy** form, depending on the training games it played most as a teen. **Status, page 2** shows which way it's heading. Each animal also has one **secret form** that only appears for something special, like a perfect childhood, a long training streak or a Myth Cup win. The Paldex shows a dark silhouette and a hint until you find it.

## Buttons

| Button | What it does | Keyboard |
|---|---|---|
| **A** | Move to the next icon or option | `A` or the arrow keys |
| **B** | Choose | `S`, `Enter` or `Space` |
| **C** | Back or cancel | `D` or `Esc` |

You can also just tap things on the screen. **MENU** opens the main menu, and **♪** turns sound on or off.

## The icons

- 📊 **Status:** your pal's hearts, plus the main menu
- 🍖 **Feed:** a meal fills hunger, a snack makes it happy (don't give too many snacks)
- 🏋 **Train:** mini-games that build discipline and happiness
- 🧹 **Clean:** cleans up poop
- ➕ **Medicine:** cures sickness
- 💡 **Lights:** turn them off when your pal goes to sleep
- ⚔ **Battle:** the arena, friend battles and the Friends Cup
- 📢 **Discipline:** scold a tantrum, or praise good behaviour

## The status strip

Two short rows under the clock show how your pal is doing: hunger and happiness hearts, an energy bolt with 4 pips, discipline (a flag and bar) and weight (**WT LO / OK / HI**), then only what applies right now: sick, poop, a flashing **!**, asleep or tired. **MENU ▸ Screen icons** explains every one.

## Tips for raising a Champion

- Answer calls quickly, within about 30 minutes.
- Clean poop and treat sickness soon.
- Turn the lights off at bedtime.
- Scold tantrums (calls for no reason) and praise good behaviour.
- A tired pal yawns and shakes its head. Let it nap, or give it a meal.
- Check **Status, page 2** to see which adult form your pal is heading for.

Your pal keeps living while the game is closed, but don't worry: a night's sleep or a day at work won't hurt it.

## Extras

- **Moody sky:** the weather on the screen follows your pal's mood. Sunshine means a happy pal; rain and storms mean it needs you.
- **Good morning:** your pal yawns and stretches when it wakes up, then shows a little report card on how the night went.
- **Daily goals:** 3 small goals a day for coins, plus streak bonuses, lucky days, surprise visitors and a rare golden egg.
- **Pal Store:** spend coins on treats, boosts, shell colours and more Pal Box slots. Basic care is always free.
- **Shell colours and Paldex:** repaint your handheld, earn special shells, and fill the Paldex with every form.
- **Hard mode:** for experts only. Pals can't be revived, but they earn more coins.
- **Care alerts:** tap the 🔔 bell to get a ping when your pal needs you, even with the game closed. **Settings ▸ Care alerts** shows the next alert and lets you switch each kind (bedtime, hunger, medicine, clean-up, calls, wake-up) on or off.
- **Live battles:** **Battle ▸ Live battle** opens a room with a 4-letter code. Your friend joins with the code and you both pick moves turn by turn. Battle codes still work offline.

## New in 2.4.0

- **Trips (MENU ▸ Trips):** take your pal (a child or older) to the **beach**, the **forest** or **town**. A trip uses energy, and then your pal rests for 2 hours (up to 3 trips a day). You might find things to keep, meet a wild pal for your Paldex or earn a few coins.
- **Things (MENU ▸ Things):** **hats** your pal wears, plus **toys** and **garden decorations** shown on the home screen. Buy some in the Pal Store, find others on trips, and collect seasonal ones.
- **Family (MENU ▸ Family):** once an adult has been grown up for 5 days, it can **retire**. It rests in the Album, and an **heir egg** of the next generation takes its place, carrying ONE family trait you choose: a strong gene, a skill it knows from birth, or the Family Ribbon hat. You never have to retire a pal; an Elder (after 20 days) just gets a gentle note. The family line shows every generation.
- **Memory book:** every pal keeps a diary of its big moments (hatching, growing up, wins, trips, gifts and more). It stays readable in the Album after the pal retires, and the family memory book walks back through the generations.
- **Gifts and visits (MENU ▸ Gifts & visits):** set up a mailbox, then share your battle code. Friends can send you a treat (free, 3 a day) or a Berry Cake or Deluxe Feast from their own Bag. Visits work offline: your pal and a friend's pal play together in the garden.
- **Friends Cup (Battle ▸ Friends Cup):** your newest 3 friend pals, from weakest to strongest. Beat them in a row to win the cup (+20 coins once a day).
- **Seasonal events:** Halloween (Oct 20 – Nov 1), Christmas (Dec 10 – 26) and Easter (Palm Sunday to Easter Monday) decorate the home screen and bring a free hat plus two event items. Events follow your device's date.

## Keep your pal safe

Your game is saved in your browser. Before switching phones or clearing your browser data, make a backup:

- **Settings ▸ Backup** saves a file or a save code.
- **Settings ▸ Cloud save** keeps an encrypted copy online. Write down the recovery code it shows, because you'll need it to get your pal back on another device.

## Privacy

There are no ads, tracking or accounts. Your pal stays on your device unless you use care alerts, cloud save, live battles or gifts. Care alerts send only the alert times, cloud saves are scrambled so nobody else can read them, live battles send your pal's battle code to the room, and a gift carries only the gift, your pal's name and its animal.

---

Made with ❤️. MIT licence (see `LICENSE`).

## For developers: tests
You need Node 18 or newer. From the source folder:

```
npm install        # installs Playwright (the only dev dependency)
npm test           # about 360 unit tests, no browser needed, any timezone
npm run test:e2e   # downloads Chromium for Playwright if needed, then runs the browser suites
```

If no Chromium can be launched, each browser suite prints `SKIPPED` with the reason and how to fix it, and exits 0. Set `PP_REQUIRE_BROWSER=1` to make that a failure instead. The update and reinstall suites also need an older build: set `PP_OLD=/path/to/old/pocketpal`.
