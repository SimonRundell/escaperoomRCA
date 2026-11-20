# Fault Tree Escape Room

An AI-powered multiplayer classroom game for 16–19-year-old students studying **Event Tree Analysis (ETA)** as part of T-Level Digital: Software Development.

Each game generates a unique IT incident scenario via Google Gemini. Students race to unlock hidden nodes on a live ETA diagram by answering multiple-choice questions. The teacher controls the session from a protected dashboard and can watch student progress in real time.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Configuration Reference](#configuration-reference)
- [Running the App](#running-the-app)
- [Routes](#routes)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Gameplay Flow](#gameplay-flow)
- [Scoring & Penalties](#scoring--penalties)
- [Production Build](#production-build)
- [License](#license)

---

## Features

- **Gemini-generated scenarios** — every game is a fresh IT incident chain with branches, outcomes and hidden nodes
- **Interactive ETA diagram** — SVG-based visual; hidden nodes show `???` until unlocked
- **Multiple-choice questions** — per hidden node, with hints available at a time penalty
- **Live leaderboard** — ranked by escape time (base time + accumulated penalties)
- **Teacher control panel** — generate game, share join code, start / pause / resume / end, monitor all students
- **Session persistence** — players can refresh the page and rejoin seamlessly via `localStorage`
- **Teacher authentication** — PHP session-based login; `/teacher` routes are protected

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Axios |
| Backend | PHP (PDO, cURL, sessions) |
| Database | MySQL 5.7+ (InnoDB, UTF8MB4) |
| AI | Google Gemini API (`gemini-2.5-flash`) |
| Dev server | Vite proxy → PHP on `http://localhost` |
| Styling | Single CSS file — Trebuchet MS / Courier New, CSS custom properties |
| Licence | CC BY-NC-SA 4.0 |

---

## Project Structure

```
escaperoomrca/
├── .config.json            # Runtime config (DB, Gemini key, game rules) — not committed
├── .config.example.json    # Template for the above
├── index.html
├── vite.config.js          # Reads baseUrl from .config.json; proxies /api → PHP
├── eslint.config.js
├── package.json
│
├── api/                    # PHP REST API (served by Laragon / XAMPP / php -S)
│   ├── cors.php            # CORS headers + Content-Type, included by every endpoint
│   ├── db.php              # PDO connection, reads .config.json
│   ├── auth.php            # Teacher login / logout / check / first-time setup
│   ├── game.php            # Game lifecycle: create (Gemini), state, teacher_state, update_status
│   ├── player.php          # Player join + list
│   └── progress.php        # Answer submission, hints, leaderboard
│
├── db/
│   └── schema.sql          # CREATE TABLE statements for all four tables
│
└── src/
    ├── main.jsx
    ├── App.jsx             # React Router root — all routes defined here
    ├── index.css           # Single stylesheet
    ├── api/
    │   └── gameApi.js      # Axios wrappers for every PHP endpoint
    ├── components/
    │   ├── ETADiagram.jsx  # SVG ETA tree, hidden nodes, click-to-answer
    │   ├── Leaderboard.jsx # Live ranked table
    │   ├── NodeQuestion.jsx# MCQ modal with hint button
    │   ├── PlayerList.jsx  # Teacher view: name + per-node progress dots
    │   ├── Timer.jsx       # Running clock from game started_at
    │   └── ProtectedTeacher.jsx  # HOC: session check → redirect to /teacher/login
    └── pages/
        ├── JoinGame.jsx        # Student landing: enter code + name
        ├── StudentGame.jsx     # Main student view: diagram, question, timer, board
        ├── EscapeSuccess.jsx   # Victory screen + leaderboard
        ├── TeacherDashboard.jsx# Teacher control panel (protected)
        ├── TeacherLogin.jsx    # Username / password form
        └── TeacherSetup.jsx    # One-time first-account creation
```

---

## Prerequisites

| Requirement | Minimum version | Notes |
|---|---|---|
| Node.js | 18 | `npm` included |
| MySQL | 5.7 | Local or remote |
| PHP | 7.4 | PDO MySQL + cURL extensions |
| PHP web server | — | Laragon (recommended), XAMPP, or `php -S` |
| Google Gemini API key | — | Free tier at [aistudio.google.com](https://aistudio.google.com/apikey) |

---

## Installation & Setup

### 1. Install npm dependencies

```bash
npm install
```

### 2. Create the database

```bash
mysql -u root -p < db/schema.sql
```

This creates the `escaperoomrca` database and all four tables.

### 3. Configure the app

Copy the example config and fill in your values:

```bash
copy .config.example.json .config.json
```

Edit `.config.json` — see [Configuration Reference](#configuration-reference) below.

### 4. Point your PHP server at the project root

**Laragon (recommended on Windows):**

- Add the project folder to Laragon's `www` root, or configure a virtual host pointing to `d:\escaperoomrca`.
- Ensure `api.baseUrl` in `.config.json` matches the address Laragon uses (default `http://localhost`).

**Manual (any platform):**

```bash
php -S localhost:80 -t .
```

The Vite proxy routes `/api/*` requests to this server.

### 5. Create the first teacher account

Start the Vite dev server (see below), then visit:

```
http://localhost:5173/teacher/setup
```

Set a username (≥ 3 characters) and password (≥ 8 characters). The setup endpoint is permanently blocked by the API once any teacher exists.

---

## Configuration Reference

`.config.json` is read by both `db.php` (PHP) and `vite.config.js` (Node). It must exist before starting either server.

```jsonc
{
  "api": {
    "baseUrl": "http://localhost"      // Target for the Vite /api proxy
  },
  "db": {
    "host": "localhost",
    "name": "escaperoomrca",
    "user": "your_db_user",
    "password": "your_db_password"
  },
  "gemini": {
    "apiKey": "your_gemini_api_key",
    "model": "gemini-2.5-flash"        // Any generateContent-compatible model
  },
  "game": {
    "hintPenaltySeconds": 30,          // Added to player total per hint
    "wrongAnswerPenaltySeconds": 10,   // Added to player total per wrong answer
    "maxHintsPerNode": 2               // Maximum hints a player can request per node
  }
}
```

> **Security:** `.config.json` contains secrets. Add it to `.gitignore` and never commit it.

---

## Running the App

```bash
npm run dev
```

| Address | Purpose |
|---|---|
| `http://localhost:5173/join` | Student entry point |
| `http://localhost:5173/teacher/login` | Teacher login |
| `http://localhost:5173/teacher/setup` | First-run account creation |

The Vite dev server proxies every `/api/*` request to `http://localhost` (configurable via `api.baseUrl`).

---

## Routes

| Route | Component | Access |
|---|---|---|
| `/` | — | Redirects to `/join` |
| `/join` | `JoinGame` | Public |
| `/join/:code` | `JoinGame` | Public — pre-fills game code |
| `/game/:code` | `StudentGame` | Public — requires prior join |
| `/escaped/:code` | `EscapeSuccess` | Public |
| `/teacher/login` | `TeacherLogin` | Public |
| `/teacher/setup` | `TeacherSetup` | Public (one-time) |
| `/teacher` | `TeacherDashboard` | **Protected** — valid teacher session required |
| `/teacher/:code` | `TeacherDashboard` | **Protected** |

`ProtectedTeacher` checks `GET /api/auth.php?action=check` on every mount. If no valid PHP session is found, the user is redirected to `/teacher/login`.

---

## API Reference

All endpoints live under `/api/` and return `application/json`.

### `auth.php` — Teacher Authentication

| Action | Method | Body / Params | Response |
|---|---|---|---|
| `?action=login` | POST | `{ username, password }` | `{ loggedIn, username }` |
| `?action=logout` | POST | — | `{ loggedIn: false }` |
| `?action=check` | GET | — | `{ loggedIn, username }` |
| `?action=setup` | POST | `{ username, password }` | `{ created, username }` — fails if any teacher already exists |

Sessions use PHP server-side storage. `axios.defaults.withCredentials = true` ensures the session cookie is sent on every request.

### `game.php` — Game Lifecycle

| Action | Method | Body / Params | Response |
|---|---|---|---|
| `?action=create` | POST | — | `{ success, code, scenario }` |
| `?action=state&code=XXXX` | GET | — | Game state — **correct answers stripped** for students |
| `?action=teacher_state&code=XXXX` | GET | — | Full state including correct answers and explanations |
| `?action=update_status` | POST | `{ code, status }` | `{ success, status }` |

Valid status values: `active`, `paused`, `ended`.

The `create` action calls the Gemini API server-side and generates a scenario with 3 branches, 4 outcomes, 3 hidden MCQ nodes, and per-node hints derived from answer explanations.

### `player.php` — Players

| Action | Method | Body / Params | Response |
|---|---|---|---|
| `?action=join` | POST | `{ code, name }` | `{ success, playerId, name, gameCode, rejoin }` |
| `?action=list&code=XXXX` | GET | — | `{ players: [...] }` |

If a player with the same name already exists in the game, `join` returns the existing record with `rejoin: true` — supporting page-refresh recovery.

### `progress.php` — Gameplay

| Action | Method | Body / Params | Response |
|---|---|---|---|
| `?action=answer` | POST | `{ playerId, nodeId, optionIndex }` | `{ correct, explanation, penalty }` |
| `?action=hint` | POST | `{ playerId, nodeId }` | `{ hint, penalty, hintsUsed, hintsLeft }` |
| `?action=leaderboard&code=XXXX` | GET | — | `{ leaderboard: [...] }` |

---

## Database Schema

```
games           id, code (CHAR 6, unique), status, scenario_json, created_at, started_at, ended_at
players         id, game_id (FK→games), name, joined_at, escaped_at, total_penalty_seconds
teachers        id, username (unique), password_hash (bcrypt), created_at
node_progress   id, player_id (FK→players), node_id, attempts, hints_used, revealed_at
```

All tables use InnoDB with `ON DELETE CASCADE` foreign keys. Full DDL in [db/schema.sql](db/schema.sql).

---

## Gameplay Flow

```
Teacher                                 Students
───────                                 ────────
/teacher/login ──────────────────────►  /join
     │                                       │
     ▼                                       │
Generate game  ─── share code ──────────────►│
(Gemini call)                                ▼
     │                                  /join/:code (name entry)
     ▼                                       │
Start game ──────────────────────────────────►
     │                                  /game/:code
     │                                  (polling every 3 s)
     │                                       │
     │                                  Click hidden node
     │                                       │
     │                                  Answer MCQ
     │                                  (wrong → +10 s penalty)
     │                                  (hint  → +30 s penalty)
     │                                       │
     │                                  All nodes unlocked?
     │                                       ▼
     │                                  /escaped/:code
     ▼
End game ◄──────── teacher sees live progress
```

---

## Scoring & Penalties

**Escape time** = `(escaped_at − started_at)` + `total_penalty_seconds`

| Event | Penalty (configurable in `.config.json`) |
|---|---|
| Wrong answer | +10 seconds |
| Hint request | +30 seconds |

Leaderboard order: escaped players ranked by escape time ascending; still-playing students ranked by nodes revealed descending.

---

## Production Build

```bash
npm run build
```

Output is in `dist/`. Deploy the static files to any web host and ensure the PHP `api/` folder is reachable at a path that matches `api.baseUrl` in `.config.json`. Update `api.baseUrl` accordingly if the PHP server moves.

---

## License

Copyright © 2026 Simon Rundell, CodeMonkey Design, Dept of Cybersecurity and Digital Technologies, Exeter College.

Released under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/) licence.

You are free to share and adapt this material for non-commercial purposes, provided you give appropriate credit, indicate any changes made, and distribute your contributions under the same licence.

