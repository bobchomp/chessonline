# Chess Online

Play chess with a friend in the browser. Sign up, create a game, share the
6-digit PIN, and your friend enters it to join. Or play the computer at one of
eight levels.

Built with **Next.js 16** (App Router), **Neon Postgres**, **Neon Auth**,
**Drizzle ORM**, **chess.js** and **react-chessboard**. It's designed to run on
**Vercel**.

## Features

- Sign up / sign in with Neon Auth using email + password. Includes
  password reset and account settings.
- Usernames: every player picks a unique username (3–20 letters, numbers or
  underscores) right after signing up. Existing accounts without one get a
  popup that can't be skipped. Usernames can be changed in account settings
  once every 30 days, and they're shown everywhere, including past games.
- Friends: search players by username as you type, send friend requests (the
  other player has to accept), and manage incoming and sent requests on the
  Friends panel on the Play page. You can also add your opponent straight from the game screen.
  Friends show a green dot when online and "In a game" when playing, plus your
  head-to-head record. Pending requests show as a badge in the header.
- Blocking: blocked players can't send you requests, and you're hidden from
  each other's search and profile. Unblock any time from the Friends panel.
- Profiles at `/u/username`: record, head-to-head and recent games.
- Challenges: challenge a friend from the Friends panel or their profile instead
  of sharing a PIN. Pick a time control and color, and they get a popup on any
  page (even mid-game, with a warning that their current game keeps running).
  When they accept, you both go straight into the game. Unanswered challenges
  expire after 10 minutes, and you can cancel while waiting.
- Play the computer: eight opponents from "Randy" (moves at random) to full
  strength Stockfish. The three beginner bots are simple home-made engines.
  The five stronger ones are [Stockfish](https://stockfishchess.org) running
  as WebAssembly in a Web Worker, at 1400, 1800, 2200 and 2600 Elo plus
  unlimited. Pick any time control and color. The engine runs in the
  player's browser, so it costs nothing on the server. The server still
  checks that every computer move is legal and that it really is the
  computer's turn. The bot's clock runs while it thinks, about a second per
  move and less when it's short on time, but it never loses on time. There
  are no draw offers or chat against the computer, and "Play again" starts a
  new game with colors swapped. Computer games appear in your history but
  count toward a separate "against the computer" record on your profile, not
  your main record.
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
- Resign, offer/accept/decline draws (each player can offer one draw per
  game), and abort a game before both sides have
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
   - Once you know your Vercel domain, add it to the trusted domains / redirect
     URLs list.

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `DATABASE_URL`, `NEON_AUTH_BASE_URL`, and a random
`NEON_AUTH_COOKIE_SECRET` of at least 32 characters (`openssl rand -base64 32`).

### 3. Create the tables

You don't need to do anything for production: `npm run build` runs
`scripts/migrate.mjs` first, which applies any pending SQL migrations in
`drizzle/` to `DATABASE_URL`. Every Vercel deploy creates or updates the
tables automatically, and a failed migration fails the deploy.

For local development, install dependencies and apply the migrations to your
own database:

```bash
npm ci
npm run db:migrate
```

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
new migration and commit it. The next deploy applies it automatically.

## Project layout

```
app/
  page.tsx                  landing page
  dashboard/page.tsx        Play page: new game, join by PIN, friends, ongoing games, history
  game/[id]/page.tsx        the game screen
  auth/[path]/page.tsx      Neon Auth sign-in / sign-up / reset password UI
  account/[path]/page.tsx   account settings
  api/auth/[...path]        Neon Auth proxy route
  api/games/...             create, join, poll, move, action, chat, bot-move
  api/bots/games            start a game against the computer
components/
  dashboard/                new-game form, PIN join form, computer picker, game list
  game/                     board + clocks + moves + chat (game-client.tsx)
lib/
  bots/                     computer opponents: roster, simple bots, Stockfish worker
  auth/                     Neon Auth server/client setup, getCurrentUser()
  db/                       Drizzle schema + Neon client
  game/rules.ts             pure chess/clock/offer logic (unit tested)
  game/service.ts           database operations
  game/view.ts              shape of the data sent to the browser
public/engine/              Stockfish 19 (lite, single-threaded WebAssembly build)
proxy.ts                    redirects signed-out users away from app pages
drizzle/                    SQL migrations
```

## Scripts

| Command               | What it does                                 |
| --------------------- | -------------------------------------------- |
| `npm run dev`         | Start the dev server                         |
| `npm run build`       | Apply DB migrations, then production build   |
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

## Third-party engine

`public/engine/stockfish.js` and `stockfish.wasm` are the lite single-threaded
build from the [`stockfish`](https://www.npmjs.com/package/stockfish) npm
package (v19.0.0, by Chess.com, based on
[Stockfish](https://github.com/official-stockfish/Stockfish)). Stockfish is
free software under the GNU GPL v3. Its license is in
`public/engine/COPYING.txt` and its sources are linked from
`public/engine/README.txt`. The engine files are served unmodified and run as
a separate program in a Web Worker.
