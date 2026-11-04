# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Padel players in all of Denmark (eight regions: Nordjylland, Vestjylland, Østjylland, Sydjylland, Fyn, Sjælland, Hovedstaden, Bornholm). Mostly amateurs who want a match this week with players at their own level and lack a fixed group. Most use the site on a phone, often as an installed PWA. The owner and the users write and read Danish.

## Product Purpose

PadelMakker lets a player find partners at their level, create or join a match (2v2, Americano/Mexicano, Liga), find a free court and track an ELO rating from confirmed results. Success means a player goes from "I want to play" to a match in the calendar with four players.

## Positioning

The site combines three things in one free account: level-matched players near you, open matches you can join directly, and free court times from 150+ centres across four booking systems (Halbooking, MATCHi, Bookli, Playtomic). The ELO rating changes only after every player on the court has confirmed the result.

## Operating Context

- New users sign up at `/opret` and verify their phone by SMS and then their e-mail.
- Logged-in users work in the dashboard tabs: Hjem, Kampe, Makkere, Baner, Rangliste, Beskeder, Profil.
- Push notifications require the app on the iPhone home screen.

## Capabilities and Constraints

- React + Vite + Tailwind, Supabase backend, deployed on Vercel. Danish UI only.
- A CSP limits scripts, fonts (self or fonts.gstatic.com) and styles (self or fonts.googleapis.com).
- `npm run lint` fails on its fifth warning. `check:ui-hex` forbids hex colours in JSX/TSX; colours live in `src/styles/variables.css`.
- The app supports light and dark mode (`data-theme` on `<html>`).
- Public, anonymous data: `public_platform_stats` (players, open matches, matches in the last 30 days), `get_growth_campaign_public` (Første 200) and `public_upcoming_americano_events` (no participant names). There is no public list of 2v2 matches.

## Brand Commitments

- Keep the name PadelMakker and the existing logo (`public/logo-brand.png`, `public/logo-brand-dark.png`).
- The owner approved the Claude Design prototype "PadelMakker Prototype v4" (warm club-house look, clay accent, Anton headlines, bottom navigation with a central "Spil" button) as the redesign target. It ships in steps.

## Evidence on Hand

- Hero photo: `public/hero-bg.*` (avif, webp, jpg, mobile variants).
- Live counts from the public RPCs above.
- No testimonials, no partner logos and no extra photography exist. Never invent numbers, names, or "live" activity. Show a count only when it is real, and fall back to fixed facts when it is small.

## Product Principles

1. Get a player to a booked match in as few taps as possible.
2. Show only real data on public pages. Sample data in illustrations is labelled as an example.
3. Plain Danish. Controls name their action.
4. Phone first. Every tap target is at least 44 px.

## Accessibility & Inclusion

Text contrast at least 4.5:1 (large text 3:1) in both light and dark mode, checked by `tests/unit/kontrastOgTrykflader.test.mjs`. Respect `prefers-reduced-motion`.
