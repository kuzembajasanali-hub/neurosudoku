# NeuroSudoku

NeuroSudoku is a modern web platform for playing Sudoku with a product-first angle: it combines a unique puzzle generator, Daily Challenge, AI Coach explanations, Sudoku Academy, local profile progress, city leaderboard simulation, statistics, notes, hints, dark mode, and a visible Pro upgrade path.

## Who it is for

The product is designed for people who want a quick daily brain workout, players who like speed competition, and beginners who want to understand Sudoku logic instead of only seeing whether an answer is right or wrong.

## Why it is valuable

Most Sudoku websites stop at a playable grid. NeuroSudoku adds retention and business potential:

- Daily Challenge gives users a reason to return every day.
- AI Coach explains row, column, and 3x3 block reasoning for a selected cell.
- Sudoku Academy turns hints into lessons for beginners and kids.
- City leaderboard creates a social layer, for example players from Almaty or Astana.
- Profile, XP, streaks, best time, mistakes, notes, hints, and theme are saved in LocalStorage.
- Pro upgrade and skin packs show a clear monetization direction for a future Stripe integration.

## Features

- Responsive 9x9 Sudoku board for desktop and mobile.
- Unique seeded puzzle generation with multiple modes: Morning Focus, Speed Arena, Pro Logic, Kids Mode.
- Rule validation, conflict highlighting, completion detection, mistakes, timer, and hint budget.
- Notes mode for candidate numbers inside cells.
- Daily Challenge generated from the current date so every user gets the same daily puzzle.
- AI Coach that explains candidates and why a number fits a selected cell.
- Multi-screen SPA structure: Play, Daily, Learn, Leaderboard, Profile, Pro.
- Sudoku Academy lesson cards for solving strategies.
- Local profile with player name and city.
- Leaderboard prototype by city.
- Dark and light themes.
- Pro upgrade prototype with premium skin positioning.

## Tech stack

- HTML
- CSS
- JavaScript
- Node.js backend API
- JSON database for the prototype
- LocalStorage fallback

No build step is required. The frontend can be served by any static server. The backend is a dependency-free Node.js API.

## Run locally

One-command full app:

```bash
node server.js
```

Then open:

```text
http://localhost:5174
```

Backend health check:

```text
http://localhost:5174/api/health
```

The backend stores prototype data in `db.json`.

Static frontend-only mode also works:

```bash
python -m http.server 5173
```

In that mode the app uses `http://127.0.0.1:5174` for the API if `server.js` is running.

## Deployment

Recommended simple deployment: Render Web Service.

1. Upload this project to GitHub.
2. Create a new Render Web Service from the repository.
3. Use these settings:
   - Build command: leave empty or use `npm install`
   - Start command: `npm start`
   - Environment: Node
4. Render will provide a public working project URL.

The same URL serves both the frontend and backend API.

## Future production path

- Replace the local JSON database with Supabase Auth and Postgres.
- Store daily results, streaks, and leaderboards in Supabase tables.
- Connect AI Coach to an LLM API for deeper strategy explanations.
- Add Stripe Checkout for Pro skins and advanced analytics.
- Add multiplayer speed rooms and school/kids learning tracks.

## Suggested database schema

- `profiles`: user id, name, city, pro status, XP, streak.
- `puzzles`: date, mode, seed, puzzle, solution.
- `attempts`: user id, puzzle id, time, mistakes, hints, score.
- `leaderboards`: materialized view grouped by city and daily puzzle.
- `subscriptions`: user id, Stripe customer id, plan, status.
