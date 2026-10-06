# ⚡ VIPERA RUN — Personal Running Tracker & Companion

A mature, mobile-first personal running tracker and intelligent training companion built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma ORM**, **PostgreSQL**, and **IndexedDB**.

Designed specifically for real athletes who run holding their phone in hand. Not an AI-looking dashboard, and not a clone of Strava or Nike Run Club—Vipera Run focuses on personal mastery, deterministic interval workouts, live ghost pacing, route memory, and deep athletic diagnostic analytics.

---

## 🏃 Key Features

### 1. Offline-First Real-Time GPS Recording
- **Zero Data Loss Guarantee**: Every incoming GPS point is filtered client-side and immediately streamed to IndexedDB (`idb`).
- **Idempotent Background Synchronization**: When cellular connection drops or resumes, runs are queued in `sync_queue` with client UUIDs and synced safely without duplicating.
- **Unfinished Run Recovery**: If the mobile browser refreshes or the operating system restarts the app, an instant crash recovery banner prompts you to resume your activity seamlessly.
- **Accidental Touch Screen Lock**: Tap to lock during outdoor runs so hand sweat or arm swing won't accidentally pause or stop your recording.
- **Screen Wake Lock API**: Automatically prevents the phone screen from sleeping while actively tracking.

### 2. High-Precision GPS Quality Filtering
- Rejects degraded fixes (`accuracy > 30m`).
- Rejects impossible teleportation jumps and unrealistic speeds (`> 11.5 m/s`).
- Filters stationary GPS coordinate jitter using deadband analysis.
- Douglas-Peucker route simplification for clean map polyline rendering.

### 3. Flexible Interval Training Engine
- **Deterministic Client-Side State Machine**: `WARMUP`, `RUN`, `RECOVERY`, `WALK`, `REST`, `COOLDOWN`, `FREE_RUN`.
- **Target Flexibility**: Intervals based on exact distance (meters) or duration (seconds/minutes), with repeat groups (e.g., $6 \times [400\text{m Run} + 200\text{m Recovery}]$).
- **Web Speech & Web Audio Feedback**: Spoken voice cues ("*Run. Four hundred meters.*", "*Recovery.*", "*Workout complete!*") and countdown frequency beeps.
- **Automatic Interval Lap Splits**: Logs actual distance, time, and average pace per rep into an interval results table.
- **Preset Library**: 400m track repeats, 800m repeats, 1K threshold, 30/30 Fartlek, 2min/1min, 5min tempo blocks.

### 4. Ghost Runner (Ghost Pace)
- Compete live against your best self:
  - Personal Best 5K
  - Previous Run
  - Historical Route Average
- As you run, your position is compared in real-time against your ghost's progression:
  - *"Ahead by 70m"* or *"Behind by 80m"*.

### 5. Moving-Window Personal Records (PR) Detection
- Computes best-effort segments across **1K, 3K, 5K, 10K, longest distance, and fastest average pace**.
- Uses an exact two-pointer sliding window on GPS points with boundary interpolation. If you run 8 km, your fastest 5 km segment anywhere in that run is discovered and compared against your all-time PRs.

### 6. Geographic Route Memory
- Clustered bounding-box, centroid, and endpoint proximity matching.
- Automatically recognizes when you run a familiar loop and benchmarks your performance:
  - *"This Route: 7 runs. Best 28:42. You were 1:23 faster than your average on this route!"*

### 7. Post-Run Journal & Athletic Diagnostics
- **Quick 5-Second Post-Run Log**: Feeling rating (😫 / 😐 / 🙂 / 🔥 / 🏆), Energy (1-5), Leg condition (1-5), and personal notes.
- **Pacing Analysis**: Detects negative splits, positive splits, pace dropoff points, and pacing consistency score (0-100%).
- **"Why Was This Run Bad?"**: Contextual diagnostic that correlates fatigue with early surge pacing, elevated climbing demands, recent training load spikes, and low logged energy.

### 8. Athletic Running Fingerprint & Training Load
- **5-Trait Profile (0-100)**: Endurance, Speed Velocity, Weekly Consistency, Pacing Discipline, Hill Ability.
- **Training Load**: Tracks weekly mileage, acute percentage change (+29%), and issues training spike alerts if weekly volume increases > 30%.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16 (App Router, Turbopack)** |
| Language | **TypeScript 5 (Strict)** |
| Styling | **Tailwind CSS v4** (Sporty Dark Aesthetic Tokens) |
| Database & ORM | **PostgreSQL** + **Prisma ORM 6** |
| Client Storage | **IndexedDB (`idb`)** for local offline persistence |
| Live Maps | **Leaflet** with CartoDB & OpenStreetMap Voyager tiles |
| Analytics Charts | **Recharts** |
| Audio & Haptics | **Web Speech API**, **Web Audio API (`AudioContext`)**, **Vibration API** |
| Screen Lock | **Screen Wake Lock API** |
| Testing | **Node.js Native Test Runner (`node:test`) + `tsx`** |

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ (tested on Node.js 22)
- npm 9+
- PostgreSQL database (Neon, Supabase, or local Docker/Postgres)

### 2. Environment Setup
Copy the example environment configuration:

```bash
cp .env.example .env
```

Edit `.env` to configure your database and authentication secret:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vipera_run?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/vipera_run?schema=public"
AUTH_SECRET="your-secure-session-secret-key-at-least-32-chars-long"

# Map tiles (default works free out-of-the-box without API keys)
NEXT_PUBLIC_MAP_TILE_URL="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
```

### 3. Database Initialization & Seeding
Generate the Prisma Client and seed realistic athletic data:

```bash
# Generate Prisma Client
npx prisma generate

# Apply migrations to PostgreSQL (when database is online)
npx prisma db push

# Seed realistic runs, GPS points, workouts, and PRs
npm run seed
```

> **Note on Offline / Local Dev**: If you run without a live PostgreSQL instance, the app automatically falls back to local seed data and full IndexedDB recording so you can test every screen, GPS tracking, and interval workouts without database friction!

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser (or on your phone connected to local Wi-Fi).

---

## 🧪 Running Tests

The test suite validates:
- Haversine distance, speed calculations, and deadband elevation filtering
- GPS anomaly detection and Douglas-Peucker polyline simplification
- Interval training engine flattening, repeat loops, and step transitions
- Moving-window best-effort Personal Records algorithm
- Ghost runner progression and ahead/behind delta calculations
- Linear interpolation of kilometer splits
- Pacing diagnostics and athletic fingerprint scoring

Run the test suite:

```bash
npm test
```

---

## 📱 PWA & Mobile Installation

Vipera Run is fully configured as an installable Progressive Web App (PWA):
1. Open the app in Chrome or Safari on your mobile device.
2. Tap **"Add to Home Screen"** or **"Install App"**.
3. Launches in full-screen standalone mode without browser URL bars, complete with mobile viewport protection and touch-friendly tap targets.

### Browser & GPS Limitations Note
- Web browsers have platform limitations when the phone screen is completely locked in your pocket. Vipera Run uses the **Screen Wake Lock API** to keep the screen active while running and provides an in-app **Screen Lock Button** to prevent accidental touches while jogging with your phone.

---

## 📦 Deployment to Vercel

1. Push your repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. Set the environment variables in Vercel Project Settings:
   - `DATABASE_URL` (e.g. Neon or Supabase PostgreSQL connection string with `?sslmode=require`)
   - `DIRECT_URL` (direct connection string for migrations)
   - `AUTH_SECRET` (random 32+ character string)
4. Deploy!
