import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const usage = sqliteTable("usage", {
  key: text("key").primaryKey(),
  used: integer("used").notNull().default(0),
});
export const walletLinks = sqliteTable("wallet_links", {
  userId: text("user_id").primaryKey(),
  address: text("address").notNull(),
  expires: integer("expires").notNull(),
});
export const challenges = sqliteTable("challenges", {
  userId: text("user_id").primaryKey(),
  address: text("address").notNull(),
  message: text("message").notNull(),
  expires: integer("expires").notNull(),
});
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  wallet: text("wallet").notNull(),
  title: text("title").notNull(),
  mode: text("mode").notNull(),
  messages: text("messages").notNull(),
  updated: integer("updated").notNull(),
}, table => [index("conversations_wallet").on(table.wallet), index("conversations_owner_wallet").on(table.owner, table.wallet)]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  used: integer("used").notNull(),
  expires: integer("expires").notNull(),
}, table => [index("rate_limits_expires").on(table.expires)]);
export const requestLeases = sqliteTable("request_leases", {
  key: text("key").primaryKey(),
  token: text("token").notNull(),
  expires: integer("expires").notNull(),
}, table => [index("request_leases_expires").on(table.expires)]);
