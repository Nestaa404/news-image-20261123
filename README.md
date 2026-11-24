# The World in One Day — Monday 23 November 2026

[![make.fun · news-image-20261123](https://make.fun/badge/news-image-20261123.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![rank](https://make.fun/badge/news-image-20261123/Nestaa404/news-image-20261123/rank.svg)](https://make.fun/bounty/news-image-20261123/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![reward](https://make.fun/badge/news-image-20261123/Nestaa404/news-image-20261123/reward.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)

Entry for the make.fun bounty
[news-image-20261123](https://make.fun/c/news-image-20261123) — "Sum up
23 November's world news in one image".

## What the image shows

A one-page newspaper, "THE WORLD IN ONE DAY — MONDAY 23 NOVEMBER 2026",
summing up the verified news of Monday 23 November 2026:

- **Three lead stories**, each with a drawn illustration: Ukraine's sea
  drones sinking the Russian corvette Merkury off Benghazi, Libya;
  Nvidia restoring Jensen Huang as CEO with shares soaring ~33%; and
  COP31 in Antalya ending with no deal.
- **A UTC timeline** of the day and a strip of the day's big numbers
  (258 House seats, +33% Nvidia, −3.3% Kospi, 24 dead in Cikande,
  $1.62bn India aid to Nepal, 429 flights axed in Belgium).
- **Ten more stories** across regions and beats — NATO's emergency
  session, the EU's 22nd sanctions package, tankers hit in the Strait
  of Hormuz, the Cikande factory fire, the US House, Nepal, Gaza,
  Belgium's national strike, and FIFA's Women's World Cup hosts.
- **A world map** marking where the stories happened, **19 more stories**
  in the ALSO list, and a **DATE CHECK** footer proving the day:
  events confirmed on Monday itself, with Sunday events labelled
  honestly as Sunday (COP31 ended Sunday — Monday brought reaction
  only; the Alcaraz final and the Manchester evacuation were Sunday).
- Every story carries a source badge: OFFICIAL, CONFIRMED or REPORTED,
  with the outlet that reported it.

## How it is built

`main.ts` (Node 22, standard library only) draws the whole page from
scratch: a hand-defined 5×7 bitmap font, a small raster canvas, and a
hand-written PNG encoder on top of Node's zlib. No network, no clock,
no randomness — two runs write byte-identical output.

Run it with:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

It writes one image, `out/entry.png` (1024×1024, under 1 MiB).
