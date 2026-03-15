import { sqliteTable, integer, text, real, index, unique } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').unique().notNull(),
  display_name: text('display_name').notNull(),
  total_goal: integer('total_goal').notNull().default(1000),
  squat_goal: integer('squat_goal'),
  bench_goal: integer('bench_goal'),
  deadlift_goal: integer('deadlift_goal'),
  bio: text('bio'),
  avatar_color: text('avatar_color').default(''),
  avatar_url: text('avatar_url'),
  leaderboard_mode: text('leaderboard_mode').default('lift'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const lifts = sqliteTable('lifts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id),
  lift_type: text('lift_type').notNull(),
  weight: integer('weight').notNull(),
  reps: integer('reps').notNull().default(1),
  date: text('date').notNull(),
  is_pr: integer('is_pr').notNull().default(0),
  is_sus: integer('is_sus').notNull().default(0),
  notes: text('notes'),
  media_filename: text('media_filename'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_lifts_user').on(t.user_id),
  index('idx_lifts_user_type').on(t.user_id, t.lift_type),
  index('idx_lifts_date').on(t.date),
])

export const bodyweights = sqliteTable('bodyweights', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id),
  weight: real('weight').notNull(),
  date: text('date').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_bw_user').on(t.user_id),
])

export const achievements = sqliteTable('achievements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id),
  achievement_key: text('achievement_key').notNull(),
  unlocked_at: text('unlocked_at').notNull().default(sql`(datetime('now'))`),
})

export const chat_messages = sqliteTable('chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id),
  message: text('message').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const lift_votes = sqliteTable('lift_votes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  lift_id: integer('lift_id').notNull().references(() => lifts.id, { onDelete: 'cascade' }),
  user_id: integer('user_id').notNull().references(() => users.id),
  vote_type: integer('vote_type').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  unique().on(t.lift_id, t.user_id),
])

export const lift_reactions = sqliteTable('lift_reactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  lift_id: integer('lift_id').notNull().references(() => lifts.id, { onDelete: 'cascade' }),
  user_id: integer('user_id').notNull().references(() => users.id),
  emoji: text('emoji').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  unique().on(t.lift_id, t.user_id, t.emoji),
  index('idx_lift_reactions_lift').on(t.lift_id),
])

export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  ref_id: integer('ref_id'),
  from_user_id: integer('from_user_id').references(() => users.id),
  read: integer('read').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_notif_user').on(t.user_id, t.read),
])

export const challenges = sqliteTable('challenges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  challenger_id: integer('challenger_id').notNull().references(() => users.id),
  opponent_id: integer('opponent_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  metric: text('metric').notNull(),
  target: integer('target'),
  start_date: text('start_date').notNull(),
  end_date: text('end_date').notNull(),
  status: text('status').notNull().default('pending'),
  winner_id: integer('winner_id').references(() => users.id),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_challenges_users').on(t.challenger_id, t.opponent_id),
])

export const runs = sqliteTable('runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id),
  activity_type: text('activity_type').notNull(),
  distance_miles: real('distance_miles').notNull(),
  duration_seconds: integer('duration_seconds').notNull(),
  date: text('date').notNull(),
  notes: text('notes'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_runs_user').on(t.user_id),
  index('idx_runs_date').on(t.date),
])

export type User = typeof users.$inferSelect
export type Lift = typeof lifts.$inferSelect
export type Run = typeof runs.$inferSelect
export type Achievement = typeof achievements.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type Challenge = typeof challenges.$inferSelect
export type ChatMessage = typeof chat_messages.$inferSelect
