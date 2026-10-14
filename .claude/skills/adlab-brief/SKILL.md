---
name: adlab-brief
description: Turn a product description into an adlab brief and a dated research note (stages 1-2). Use when starting a new product, market or offer in adlab.
---

# Brief and research

## 1. Brief

Ask only for what you can't infer. Required: product, landing URL, audience, offer, markets (ISO
codes), conversion event (`purchase|lead|install|signup|add_to_cart`), and the **weekly cap in
cents** (always confirm the cap with the user; never guess money).

```bash
npm run adlab -- brief create --input '{"product":"…","productUrl":"https://…","audience":"…","offer":"…","markets":["US"],"conversionEvent":"purchase","weeklyCapCents":40000}'
```

Read `knowledge/context.md` first for brand voice, claims we can and can't make, and past context.

## 2. Research

Look at the platform ad library for the category and record what you found **with sources**.
Run length is the signal: ads running 30+ days are probably working; note hook, format and offer.

```bash
npm run adlab -- research add --file research.json
# {"briefId":"brf_…","summary":"…","sources":["https://…"],"referenceAds":[{"url":"…","advertiser":"…","runDays":74,"notes":"hook: …"}]}
```

Also read `knowledge/learnings/` and `npm run adlab -- learning list` — prior learnings should shape the angles.
Don't invent reference ads or run lengths. If you can't browse, say so and record only what the user gives you.
