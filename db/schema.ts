import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const familyMembers = sqliteTable(
  "family_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    displayName: text("display_name").notNull(),
    loginName: text("login_name").notNull(),
    email: text("email").notNull(),
    pinCode: text("pin_code").notNull(),
    phoneNumber: text("phone_number"),
    smsOptIn: integer("sms_opt_in", { mode: "boolean" }).notNull().default(false),
    role: text("role", { enum: ["admin", "player"] }).notNull().default("player"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("family_members_email_idx").on(table.email),
    uniqueIndex("family_members_login_name_idx").on(table.loginName),
  ],
);

export const memberSessions = sqliteTable(
  "member_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("member_sessions_token_hash_idx").on(table.tokenHash),
    index("member_sessions_member_idx").on(table.memberId),
  ],
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

export const roundNotifications = sqliteTable(
  "round_notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    matchday: integer("matchday").notNull(),
    message: text("message").notNull(),
    status: text("status", { enum: ["pending", "processing", "sent"] })
      .notNull()
      .default("pending"),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("round_notifications_season_matchday_idx").on(table.seasonId, table.matchday),
  ],
);

export const smsDeliveries = sqliteTable(
  "sms_deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    notificationId: integer("notification_id")
      .notNull()
      .references(() => roundNotifications.id, { onDelete: "cascade" }),
    memberId: integer("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    phoneNumber: text("phone_number").notNull(),
    status: text("status", { enum: ["pending", "sent", "failed"] })
      .notNull()
      .default("pending"),
    providerMessageId: text("provider_message_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("sms_deliveries_notification_member_idx").on(table.notificationId, table.memberId),
    index("sms_deliveries_notification_idx").on(table.notificationId),
  ],
);

export const customSmsMessages = sqliteTable(
  "custom_sms_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requestKey: text("request_key").notNull(),
    adminMemberId: integer("admin_member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    status: text("status", { enum: ["pending", "processing", "sent", "partial"] })
      .notNull()
      .default("pending"),
    recipientCount: integer("recipient_count").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("custom_sms_messages_request_key_idx").on(table.requestKey),
    index("custom_sms_messages_admin_idx").on(table.adminMemberId, table.createdAt),
  ],
);

export const customSmsDeliveries = sqliteTable(
  "custom_sms_deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    messageId: integer("message_id")
      .notNull()
      .references(() => customSmsMessages.id, { onDelete: "cascade" }),
    memberId: integer("member_id")
      .notNull()
      .references(() => familyMembers.id, { onDelete: "cascade" }),
    phoneNumber: text("phone_number").notNull(),
    status: text("status", { enum: ["pending", "sent", "failed"] })
      .notNull()
      .default("pending"),
    providerMessageId: text("provider_message_id"),
    parts: integer("parts"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("custom_sms_deliveries_message_member_idx").on(table.messageId, table.memberId),
    index("custom_sms_deliveries_message_idx").on(table.messageId),
  ],
);
