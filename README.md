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
- Ratings (Glicko-2, like Lichess): everyone starts at 1500, and every game
  counts: PIN games, challenges, quick matches and games against the
  computer. When a game finishes, both players' ratings update
  in the same database transaction as the result, and the game screen shows
  "+12 / −9". Ratings show with a "?" while they're still settling (rating
  deviation above 110, roughly the first 10 games), and uncertainty grows
  again if you stop playing for a while. Rated games against the computer
  count too: each bot has a fixed rating (Randy 250 up to Stockfish 3200) and
  only your rating changes. Aborted games never count. There's one overall
  rating, not one per time control.
- Achievements and win streaks on profiles: milestones (first win, first
  rated game, first friend, 10 / 50 / 100 games), streaks (3 / 5 / 10 wins
  in a row, plus current and best win streak) and one badge per computer
  level beaten. They're worked out from game history (`lib/achievements.ts`),
  so games from before this feature count too.
- Leaderboard at `/leaderboard`: the top 10, everyone or just you and your
  friends, each with a small chart of their last 30 rated games.
  Players appear after 5 rated games. Your rating, rank and a link to it are
  on the Play page. Profiles show rating, peak, rank and a rating-history
  graph, and friends' ratings show in the Friends panel.
- Quick match (the first tab on the Play page): pick a time control and hit
  "Find a game" to be paired with someone online near your rating. Quick
  match colors are fair-random. The search starts at
  ±200 rating points and widens by 10 points a second. If nobody turns up
  within 30 seconds, you're offered the computer opponent nearest your
  rating, and the search keeps going until you choose. Pairing happens in a
  single database statement that locks both players' entries, so nobody can
  be matched twice (`lib/game/quickmatch.ts`).
- Create a game: pick a time control (untimed, bullet, blitz, rapid, classical)
  and play as white, black, or random. You get a unique **6-digit PIN**, plus a
  copyable invite link that pre-fills the PIN.
- "Random" color is fair random: a coin flip that leans towards the color
  you've had less of in your last 10 games, and never gives you the same color
  three games in a row. For friend challenges, both players' recent colors
  count. This applies to PIN games, challenges and games against the computer.
- Daily games: pick 1, 3 or 7 days per move when creating a PIN game or
  challenging a friend. The clock resets to the full allowance after every
  move and runs from the first move, and missing the deadline loses. Clocks
  show days and hours, ongoing daily games show the time left on the Play
  page, and the header shows "N daily moves waiting". A deadline that passes
  while nobody is looking is settled the next time the Play page loads.
  Daily challenges stay open for 3 days, and there's no "opponent left"
  claim in daily games. They're not offered for quick match or the computer.
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
- Recent games on the dashboard, and a full game history page (`/games`)
  grouped by day, with filters for result, speed and opponent. Every game has
  move-by-move replay (click moves or use the ← / → keys).
- Navigation: Play, Puzzles and Leaderboard in the header (a tab bar along the
  bottom on phones), one notification bell for challenges, daily moves and
  friend requests, and an account menu with your profile, history, settings
  and sign out. Shared UI building blocks live in `components/ui`, and icons
  come from `lucide-react`.
- Game review: "Review" on any finished game runs Stockfish over
  every position in your browser at full strength (about half a minute for a
  40-move game), modelled on Chess.com's Game Review and Lichess's analysis:
  - a one-line summary of how the game went, then accuracy, a count of each
    move label, and accuracy split into opening, middlegame and endgame for
    both players
  - every move labelled Brilliant (!!), Great (!), Best (★), Excellent,
    Good, Book (📖), Inaccuracy (?!), Mistake (?), Miss (✗) or Blunder (??),
    using Chess.com's published win-chance thresholds. Brilliant means a
    good piece sacrifice, Great the only good move, and Miss failing to
    punish your opponent's mistake.
  - the opening's name (from the CC0 Lichess `chess-openings` dataset in
    `public/openings.json`, rebuilt with `scripts/build-openings.mjs`)
  - a coach note for each move ("This allows mate in 2.", "This loses the
    queen.", "Bxf7+ would have won a piece.") with the better move, and the
    engine's best line, which you can step through on the board
  - "Key moments" to jump between the turning points
  - "Retry your mistakes": play your mistakes again and try to find a
    better move, with the solution shown as an arrow if you get stuck
  - an evaluation bar, a best-move arrow, label badges on the board, and an
    evaluation graph you can hover and click

  Accuracy uses Lichess's formula (`lib/review/analysis.ts`); the coach text
  is in `lib/review/explain.ts`. The analysis is saved in the browser, so
  opening the review again is instant.
- Daily puzzle (🧩 in the header, and a card on the dashboard): one puzzle a
  day, the same for everyone, changing at midnight UTC. Puzzles get harder
  through the week, from Easy on Monday to Expert on Sunday.
  - Play your moves and the opponent replies; any checkmate counts on the
    final move. There's a 💡 Hint (highlights the piece to move) and "Show
    solution".
  - ⭐ for solving it first try, ✓ for solving it after mistakes or hints, ✗
    if you showed the solution. Results are final; "Try it again" afterwards
    is just practice.
  - A daily streak (days in a row solved on the day), how many players have
    solved it, the puzzle's themes, and a link to the game it came from.
  - The last 30 days' puzzles to catch up on (these don't count towards the
    streak), puzzle stats on profiles, and five puzzle achievements.
  - Puzzles come from the CC0 Lichess puzzle database: 200 per weekday
    (about four years before they repeat), favouring puzzles Lichess picked
    as its own daily puzzle, then the most popular. They're in
    `lib/puzzles/puzzles.json`, rebuilt with
    `zstd -dc lichess_db_puzzle.csv.zst | node scripts/build-puzzles.mjs`.
- Click-to-move and drag-and-drop, with legal-move hints, last-move and
  check highlighting. Works on mobile.
- Move sounds (move, capture, check, game start and end), made in the
  browser with the Web Audio API so there are no audio files. You hear your
  opponent's moves even while looking back at an earlier position. The 🔊
  button mutes them, and the setting is remembered per browser.
- Flip the board with the ⇅ Flip button or the F key.
- Anyone signed in who has a game link can watch as a spectator, read-only.
  Friends who are playing someone else show a 👁 Watch button in the Friends
  panel, which opens their live game.
- Vercel Web Analytics (`<Analytics />` in `app/layout.tsx`): page views show
  up under the project's Analytics tab on Vercel. It only records on Vercel
  deployments.

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
  api/quickmatch            quick match check-in (POST) and cancel (DELETE)
  leaderboard/page.tsx      ratings leaderboard (everyone / friends)
components/
  dashboard/                start-game card (friend / computer), PIN join form, game list
  game/                     board + clocks + moves + chat (game-client.tsx)
lib/
  bots/                     computer opponents: roster, simple bots, Stockfish worker
  ratings/                  Glicko-2 maths (unit tested), applying ratings, leaderboard queries
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
