# Chess Online

Play chess with a friend in the browser. Sign up, create a game, share the
6-digit PIN, and your friend enters it to join.

Built with **Next.js 16** (App Router), **Neon Postgres**, **Neon Auth**,
**Drizzle ORM**, **chess.js** and **react-chessboard**. It's designed to run on
**Vercel**.

## Features

- Sign up / sign in with Neon Auth: email + password or Google. Includes
  password reset and account settings, where players can change their display name.
- Create a game: pick a time control (untimed, bullet, blitz, rapid, classical)
  and play as white, black, or random. You get a unique **6-digit PIN**, plus a
  copyable invite link that pre-fills the PIN.
- Join a game by entering the PIN.
- Full rules enforced on the server: legal moves, promotion, castling, en passant,
  checkmate, stalemate, threefold repetition, the 50-move rule, and insufficient
  material.
- Chess clocks with increment, enforced on the server. Clocks start after each
  side's first move. If a player runs out of time while the opponent can't
  possibly mate, the game is a draw.
- Resign, offer/accept/decline draws, and abort a game before both sides have
  moved.
- Claim the win if your opponent leaves: after 2 minutes with no connection from
  them, you can claim victory.
- In-game chat between the two players.
- Rematch with colors swapped. Both players are taken to the new game
  automatically.
- Game history on the dashboard, with move-by-move replay (click moves or
  use the ← / → keys).
- Click-to-move and drag-and-drop, with legal-move hints, last-move and
  check highlighting. Works on mobile.
- Anyone signed in who has a game link can watch as a spectator, read-only.

## How the real-time part works

Vercel functions can't hold WebSocket connections, and Neon has no push or
realtime feature. So each browser **polls** a small endpoint
(`GET /api/games/:id?v=<version>`).

- Every change to a game (move, offer, chat message…) bumps a `version` column.
  If nothing changed, the endpoint returns a tiny "unchanged" response.
- Polling adapts to what's going on: about every **1s** while you wait for your
  opponent's move, 2.5s on your own turn, and 15s when the tab is in the
  background. When you return to the tab it refreshes immediately.
- Clocks are computed on the server from timestamps, so polling delay never
  costs anyone time on the clock. The browser just counts down locally between
  polls.
- Moves use optimistic concurrency (`UPDATE … WHERE version = $n`), so two
  requests racing each other can't corrupt a game.

Rough cost: a 10-minute game is roughly 500 to 1,500 requests in total, which is
comfortably within Vercel's and Neon's free tiers for casual use. If you outgrow
polling, the polling hook in `components/game/game-client.tsx` is the only
place to change: you could swap in Pusher or Ably to get instant updates.

## Setup

### 1. Create the Neon project and enable Neon Auth

1. Create a project at [console.neon.tech](https://console.neon.tech).
2. Open **Auth** in the sidebar and enable Neon Auth. Copy the **Auth URL**.
   That's your `NEON_AUTH_BASE_URL`.
3. Under **Connect**, copy the **pooled** connection string. That's your
   `DATABASE_URL`.
4. Optional, under Auth settings:
   - Turn email verification on or off. The sign-up UI handles both.
   - Google sign-in should work out of the box with Neon's shared development
     credentials. For production, add your own Google OAuth client credentials
     in the Neon console.
   - Once you know your Vercel domain, add it to the trusted domains / redirect
     URLs list.

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `DATABASE_URL`, `NEON_AUTH_BASE_URL`, and a random
`NEON_AUTH_COOKIE_SECRET` of at least 32 characters (`openssl rand -base64 32`).

### 3. Create the tables

```bash
npm ci
npm run db:migrate
```

This applies the SQL in `drizzle/` to your Neon database. You can also paste
`drizzle/0000_init.sql` into the Neon SQL editor.

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000. To test a game against yourself, use a second
browser or a private window signed in as another account.

## Deploying to Vercel

1. Push this repo to GitHub and **Import** it in Vercel. The framework is
   detected as Next.js automatically.
2. Add the three environment variables (`DATABASE_URL`, `NEON_AUTH_BASE_URL`,
   `NEON_AUTH_COOKIE_SECRET`) for Production, and for Preview if you use
   previews.
   - Or use Vercel's Neon integration, which sets `DATABASE_URL` for you.
     You still need the two auth variables.
3. Deploy.
4. In **Project Settings → Functions**, set the function region to the same
   region as your Neon database (for example, `us-east-1` / Washington D.C.).
   This makes every poll and move noticeably faster.
5. Add your production domain to Neon Auth's trusted domains (see step 1.4).

When you change `lib/db/schema.ts` later, run `npm run db:generate` to create a
new migration, then run `npm run db:migrate` against production.

## Project layout

```
app/
  page.tsx                  landing page
  dashboard/page.tsx        create/join a game, ongoing games, history
  game/[id]/page.tsx        the game screen
  auth/[path]/page.tsx      Neon Auth sign-in / sign-up / reset password UI
  account/[path]/page.tsx   account settings
  api/auth/[...path]        Neon Auth proxy route
  api/games/...             create, join, poll, move, action, chat
components/
  dashboard/                new-game form, PIN join form, game list
  game/                     board + clocks + moves + chat (game-client.tsx)
lib/
  auth/                     Neon Auth server/client setup, getCurrentUser()
  db/                       Drizzle schema + Neon client
  game/rules.ts             pure chess/clock/offer logic (unit tested)
  game/service.ts           database operations
  game/view.ts              shape of the data sent to the browser
proxy.ts                    redirects signed-out users away from app pages
drizzle/                    SQL migrations
```

## Scripts

| Command               | What it does                                 |
| --------------------- | -------------------------------------------- |
| `npm run dev`         | Start the dev server                         |
| `npm run build`       | Production build                             |
| `npm test`            | Unit tests for rules, clocks and offers      |
| `npm run lint`        | ESLint                                       |
| `npm run typecheck`   | TypeScript                                   |
| `npm run db:generate` | Create a migration from `lib/db/schema.ts`   |
| `npm run db:migrate`  | Apply migrations to `DATABASE_URL`           |

> **Note on installing packages:** npm 10 hits an internal error
> ("Cannot read properties of null (reading 'edgesOut')") when it resolves the
> Neon Auth UI's dependency tree from scratch. Installing from the committed
> lockfile (`npm ci` / `npm install`) works fine, and so does Vercel. To
> **add** a new package, use `npx npm@11 install <pkg>`, then run `npm install`
> once so the lockfile stays readable by npm 10.
