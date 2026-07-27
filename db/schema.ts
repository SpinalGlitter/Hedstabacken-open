import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const familyMembers = sqliteTable(
  "family_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    role: text("role", { enum: ["admin", "player"] }).notNull().default("player"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("family_members_email_idx").on(table.email)],
);

export const seasons = sqliteTable("seasons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  competitionCode: text("competition_code").notNull().default("PL"),
  startYear: integer("start_year").notNull(),
  label: text("label").notNull(),
  currentMatchday: integer("current_matchday"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const fixtures = sqliteTable(
  "fixtures",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    footballDataId: integer("football_data_id").notNull(),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    matchday: integer("matchday").notNull(),
    utcDate: text("utc_date").notNull(),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    status: text("status", {
      enum: ["SCHEDULED", "LIVE", "IN_PLAY", "PAUSED", "FINISHED", "POSTPONED", "SUSPENDED", "CANCELLED"],
    }).notNull(),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    winner: text("winner", { enum: ["HOME_TEAM", "DRAW", "AWAY_TEAM"] }),
    lastSyncedAt: text("last_synced_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("fixtures_football_data_id_idx").on(table.footballDataId),
    index("fixtures_matchday_idx").on(table.seasonId, table.matchday),
  ],
);

export const predictions = sqliteTable(
  "predictions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    fixtureId: integer("fixture_id")
      .notNull()
      .references(() => fixtures.id, { onDelete: "cascade" }),
    pick: text("pick", { enum: ["1", "X", "2"] }).notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("predictions_member_fixture_idx").on(table.memberId, table.fixtureId)],
);

export const fixtureCorrections = sqliteTable("fixture_corrections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fixtureId: integer("fixture_id")
    .notNull()
    .references(() => fixtures.id, { onDelete: "cascade" }),
  adminMemberId: integer("admin_member_id")
    .notNull()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
