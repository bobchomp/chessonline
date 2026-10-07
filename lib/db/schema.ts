import { sql } from "drizzle-orm";
import {
  bigserial,
  primaryKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export type GameStatus = "waiting" | "active" | "finished" | "aborted";
export type Color = "white" | "black";
export type GameResult = "1-0" | "0-1" | "1/2-1/2";
export type Termination =
  | "checkmate"
  | "resignation"
  | "timeout"
  | "stalemate"
  | "threefold_repetition"
  | "fifty_move_rule"
  | "insufficient_material"
  | "agreement"
  | "timeout_vs_insufficient_material"
  | "abandonment";

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 6-digit join code. Only meaningful (and unique) while the game is waiting. */
    pin: varchar("pin", { length: 6 }),
    status: text("status").$type<GameStatus>().notNull().default("waiting"),

    createdBy: text("created_by").notNull(),
    whiteId: text("white_id"),
    whiteName: text("white_name"),
    blackId: text("black_id"),
    blackName: text("black_name"),

    /** Current position. */
    fen: text("fen").notNull(),
    /** Every move played so far, in SAN. */
    moves: jsonb("moves").$type<string[]>().notNull().default(sql`'[]'::jsonb`),

    /** Null means an untimed game. */
    initialMs: integer("initial_ms"),
    incrementMs: integer("increment_ms").notNull().default(0),
    /** Time left for each side as of `lastMoveAt`. */
    whiteMs: integer("white_ms"),
    blackMs: integer("black_ms"),
    lastMoveAt: timestamp("last_move_at", { withTimezone: true }),

    drawOfferBy: text("draw_offer_by").$type<Color>(),
    rematchOfferBy: text("rematch_offer_by").$type<Color>(),
    rematchGameId: uuid("rematch_game_id"),

    result: text("result").$type<GameResult>(),
    termination: text("termination").$type<Termination>(),

    whiteSeenAt: timestamp("white_seen_at", { withTimezone: true }),
    blackSeenAt: timestamp("black_seen_at", { withTimezone: true }),

    /** Bumped on every change the clients need to see (moves, offers, chat...). */
    version: integer("version").notNull().default(1),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("games_waiting_pin_idx").on(t.pin).where(sql`${t.status} = 'waiting'`),
    index("games_white_idx").on(t.whiteId, t.updatedAt),
    index("games_black_idx").on(t.blackId, t.updatedAt),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    userName: text("user_name").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_messages_game_idx").on(t.gameId, t.id)],
);

/** App-level user data. The account itself lives in Neon Auth; this holds our extras. */
export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id").primaryKey(),
    /** Shown everywhere in the app. Unique regardless of case. */
    username: varchar("username", { length: 20 }).notNull(),
    usernameChangedAt: timestamp("username_changed_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last background check-in from any page; drives the "online" dot. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("profiles_username_lower_idx").on(sql`lower(${t.username})`)],
);

export type FriendshipStatus = "pending" | "accepted";

/** One row per pair of users, stored with userLow < userHigh so each pair is unique. */
export const friendships = pgTable(
  "friendships",
  {
    userLow: text("user_low").notNull(),
    userHigh: text("user_high").notNull(),
    requestedBy: text("requested_by").notNull(),
    status: text("status").$type<FriendshipStatus>().notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userLow, t.userHigh] }), index("friendships_high_idx").on(t.userHigh)],
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: text("blocker_id").notNull(),
    blockedId: text("blocked_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] }), index("blocks_blocked_idx").on(t.blockedId)],
);

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
