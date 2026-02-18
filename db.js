const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'shredded.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    total_goal INTEGER NOT NULL DEFAULT 1000,
    squat_goal INTEGER,
    bench_goal INTEGER,
    deadlift_goal INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    lift_type TEXT NOT NULL CHECK(lift_type IN ('squat', 'bench', 'deadlift')),
    weight INTEGER NOT NULL,
    date TEXT NOT NULL,
    is_pr INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_lifts_user ON lifts(user_id);
  CREATE INDEX IF NOT EXISTS idx_lifts_user_type ON lifts(user_id, lift_type);
  CREATE INDEX IF NOT EXISTS idx_lifts_date ON lifts(date DESC);

  CREATE TABLE IF NOT EXISTS bodyweights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    weight REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_bw_user ON bodyweights(user_id);

  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    achievement_key TEXT NOT NULL,
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, achievement_key)
  );
  CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);

  CREATE TABLE IF NOT EXISTS lift_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lift_id INTEGER NOT NULL REFERENCES lifts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    vote_type INTEGER NOT NULL DEFAULT -1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(lift_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_lift_votes_lift ON lift_votes(lift_id);
`);

// Migration: add media_filename column to lifts (idempotent)
try { db.exec('ALTER TABLE lifts ADD COLUMN media_filename TEXT'); } catch (e) { /* column already exists */ }

// Migration: add is_sus column to lifts (idempotent)
try { db.exec('ALTER TABLE lifts ADD COLUMN is_sus INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* column already exists */ }

// Migration: add vote_type column to lift_votes (idempotent)
try { db.exec('ALTER TABLE lift_votes ADD COLUMN vote_type INTEGER NOT NULL DEFAULT -1'); } catch (e) { /* column already exists */ }

// Migration: add avatar_color and avatar_url columns to users (idempotent)
try { db.exec("ALTER TABLE users ADD COLUMN avatar_color TEXT NOT NULL DEFAULT ''"); } catch (e) { /* column already exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT'); } catch (e) { /* column already exists */ }

// Migration: add bio column to users (idempotent)
try { db.exec('ALTER TABLE users ADD COLUMN bio TEXT'); } catch (e) { /* column already exists */ }

// Migration: add reps column to lifts (default 1)
try { db.exec('ALTER TABLE lifts ADD COLUMN reps INTEGER NOT NULL DEFAULT 1'); } catch (e) { /* column already exists */ }

// Migration: create lift_reactions table
db.exec(`
  CREATE TABLE IF NOT EXISTS lift_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lift_id INTEGER NOT NULL REFERENCES lifts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    emoji TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(lift_id, user_id, emoji)
  );
  CREATE INDEX IF NOT EXISTS idx_lift_reactions_lift ON lift_reactions(lift_id);
`);

// Migration: create notifications table
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    ref_id INTEGER,
    from_user_id INTEGER REFERENCES users(id),
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
`);

// Migration: create challenges table
db.exec(`
  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenger_id INTEGER NOT NULL REFERENCES users(id),
    opponent_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    metric TEXT NOT NULL,
    target INTEGER,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    winner_id INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_challenges_users ON challenges(challenger_id, opponent_id);
`);

// Migration: create runs table
db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    activity_type TEXT NOT NULL CHECK(activity_type IN ('run', '5k', '10k', 'half_marathon', 'marathon')),
    distance_miles REAL NOT NULL,
    duration_seconds INTEGER NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id);
  CREATE INDEX IF NOT EXISTS idx_runs_date ON runs(date DESC);
`);

// Assign random avatar colors to users that don't have one
const AVATAR_COLORS = [
  'linear-gradient(135deg, #4a9e6e, #d4a94e)',
  'linear-gradient(135deg, #3a7d57, #5cb85c)',
  'linear-gradient(135deg, #6b7b5e, #8a9a6e)',
  'linear-gradient(135deg, #d4a94e, #a07840)',
  'linear-gradient(135deg, #5c7a5c, #3a5a3a)',
  'linear-gradient(135deg, #8b7355, #c9a96e)',
  'linear-gradient(135deg, #4a6b4a, #6b9b6b)',
  'linear-gradient(135deg, #7a8a6a, #4a6040)',
  'linear-gradient(135deg, #5a7a5a, #8aaa7a)',
  'linear-gradient(135deg, #6a7a5a, #9aaa7a)',
];
{
  const usersWithoutColor = db.prepare("SELECT id FROM users WHERE avatar_color = '' OR avatar_color IS NULL").all();
  const setColor = db.prepare("UPDATE users SET avatar_color = ? WHERE id = ?");
  for (const u of usersWithoutColor) {
    setColor.run(AVATAR_COLORS[u.id % AVATAR_COLORS.length], u.id);
  }
}

// Achievement definitions
const ACHIEVEMENTS = [
  { key: 'first_lift', label: 'First Step', desc: 'Log your first lift', icon: '🎬', check: () => true },
  { key: 'bench_135', label: 'Plate Club (Bench)', desc: 'Bench 135 lbs', icon: '🏋️', check: (p) => p.bench >= 135 },
  { key: 'bench_225', label: 'Two Plate Bench', desc: 'Bench 225 lbs', icon: '🔥', check: (p) => p.bench >= 225 },
  { key: 'bench_315', label: 'Three Plate Bench', desc: 'Bench 315 lbs', icon: '💎', check: (p) => p.bench >= 315 },
  { key: 'bench_405', label: 'Four Plate Bench', desc: 'Bench 405 lbs', icon: '👑', check: (p) => p.bench >= 405 },
  { key: 'squat_135', label: 'Plate Club (Squat)', desc: 'Squat 135 lbs', icon: '🦵', check: (p) => p.squat >= 135 },
  { key: 'squat_225', label: 'Two Plate Squat', desc: 'Squat 225 lbs', icon: '🦵', check: (p) => p.squat >= 225 },
  { key: 'squat_315', label: 'Three Plate Squat', desc: 'Squat 315 lbs', icon: '🔥', check: (p) => p.squat >= 315 },
  { key: 'squat_405', label: 'Four Plate Squat', desc: 'Squat 405 lbs', icon: '👑', check: (p) => p.squat >= 405 },
  { key: 'squat_500', label: 'Five Hundo Squat', desc: 'Squat 500 lbs', icon: '🏆', check: (p) => p.squat >= 500 },
  { key: 'deadlift_135', label: 'Plate Club (Dead)', desc: 'Deadlift 135 lbs', icon: '💀', check: (p) => p.deadlift >= 135 },
  { key: 'deadlift_225', label: 'Two Plate Deadlift', desc: 'Deadlift 225 lbs', icon: '💀', check: (p) => p.deadlift >= 225 },
  { key: 'deadlift_315', label: 'Three Plate Deadlift', desc: 'Deadlift 315 lbs', icon: '🔥', check: (p) => p.deadlift >= 315 },
  { key: 'deadlift_405', label: 'Four Plate Deadlift', desc: 'Deadlift 405 lbs', icon: '⚡', check: (p) => p.deadlift >= 405 },
  { key: 'deadlift_500', label: 'Five Hundred Pull', desc: 'Deadlift 500 lbs', icon: '🏆', check: (p) => p.deadlift >= 500 },
  { key: 'total_500', label: 'Half Way There', desc: '500 lb total', icon: '🎯', check: (p) => (p.squat + p.bench + p.deadlift) >= 500 },
  { key: 'total_750', label: 'Three Quarters', desc: '750 lb total', icon: '📈', check: (p) => (p.squat + p.bench + p.deadlift) >= 750 },
  { key: 'total_1000', label: '1000 LB CLUB', desc: '1000 lb total!', icon: '🏆', check: (p) => (p.squat + p.bench + p.deadlift) >= 1000 },
  { key: 'total_1200', label: 'Elite', desc: '1200 lb total', icon: '💎', check: (p) => (p.squat + p.bench + p.deadlift) >= 1200 },
  { key: 'total_1500', label: 'Freak', desc: '1500 lb total', icon: '🦍', check: (p) => (p.squat + p.bench + p.deadlift) >= 1500 },
  // Running achievements (checked via checkRunAchievements, check fn unused here)
  { key: 'first_run', label: 'First Mile', desc: 'Log your first run', icon: '🏃', check: () => false },
  { key: 'first_5k', label: '5K Finisher', desc: 'Complete a 5K', icon: '🏃', check: () => false },
  { key: 'first_10k', label: '10K Finisher', desc: 'Complete a 10K', icon: '🏃', check: () => false },
  { key: 'first_half', label: 'Half Marathon', desc: 'Complete a half marathon', icon: '🏅', check: () => false },
  { key: 'first_marathon', label: 'Marathoner', desc: 'Complete a marathon', icon: '🏆', check: () => false },
  { key: 'miles_100', label: 'Century Runner', desc: 'Run 100 total miles', icon: '💯', check: () => false },
  { key: 'miles_500', label: 'Road Warrior', desc: 'Run 500 total miles', icon: '🛣️', check: () => false },
];

// Prepared statements
const stmts = {
  insertUser: db.prepare('INSERT OR IGNORE INTO users (email, display_name) VALUES (?, ?)'),
  getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  updateUser: db.prepare('UPDATE users SET display_name = ?, total_goal = ?, squat_goal = ?, bench_goal = ?, deadlift_goal = ?, updated_at = datetime(\'now\') WHERE id = ?'),
  insertLift: db.prepare('INSERT INTO lifts (user_id, lift_type, weight, reps, date, is_pr, notes, media_filename) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  getLiftById: db.prepare('SELECT * FROM lifts WHERE id = ?'),
  deleteLift: db.prepare('DELETE FROM lifts WHERE id = ? AND user_id = ?'),
  getMaxWeight: db.prepare('SELECT MAX(weight) as best FROM lifts WHERE user_id = ? AND lift_type = ?'),
  getPRs: db.prepare(`
    SELECT lift_type, MAX(weight) as weight
    FROM lifts WHERE user_id = ?
    GROUP BY lift_type
  `),
  getLifts: db.prepare(`
    SELECT l.*, u.display_name, u.avatar_color, u.avatar_url,
      ROUND(l.weight * (1.0 + l.reps / 30.0)) as e1rm,
      (SELECT COUNT(*) FROM lift_votes v WHERE v.lift_id = l.id AND v.vote_type = -1) as vote_count,
      (SELECT COUNT(*) FROM lift_votes v WHERE v.lift_id = l.id AND v.vote_type = 1) as hype_count
    FROM lifts l JOIN users u ON l.user_id = u.id
    WHERE l.user_id = ? ORDER BY l.date DESC, l.created_at DESC LIMIT ? OFFSET ?
  `),
  getLiftsByType: db.prepare(`
    SELECT l.*, u.display_name, u.avatar_color, u.avatar_url,
      ROUND(l.weight * (1.0 + l.reps / 30.0)) as e1rm,
      (SELECT COUNT(*) FROM lift_votes v WHERE v.lift_id = l.id AND v.vote_type = -1) as vote_count,
      (SELECT COUNT(*) FROM lift_votes v WHERE v.lift_id = l.id AND v.vote_type = 1) as hype_count
    FROM lifts l JOIN users u ON l.user_id = u.id
    WHERE l.user_id = ? AND l.lift_type = ? ORDER BY l.date DESC, l.created_at DESC LIMIT ? OFFSET ?
  `),
  getActivity: db.prepare(`
    SELECT l.*, u.display_name, u.email, u.avatar_color, u.avatar_url,
      ROUND(l.weight * (1.0 + l.reps / 30.0)) as e1rm,
      (SELECT COUNT(*) FROM lift_votes v WHERE v.lift_id = l.id AND v.vote_type = -1) as vote_count,
      (SELECT COUNT(*) FROM lift_votes v WHERE v.lift_id = l.id AND v.vote_type = 1) as hype_count
    FROM lifts l JOIN users u ON l.user_id = u.id
    ORDER BY l.created_at DESC LIMIT ? OFFSET ?
  `),
  insertBodyweight: db.prepare('INSERT INTO bodyweights (user_id, weight, date) VALUES (?, ?, ?)'),
  getBodyweight: db.prepare('SELECT * FROM bodyweights WHERE user_id = ? ORDER BY date DESC LIMIT ? OFFSET ?'),
  deleteBodyweight: db.prepare('DELETE FROM bodyweights WHERE id = ? AND user_id = ?'),
  getBodyweightById: db.prepare('SELECT * FROM bodyweights WHERE id = ?'),
  getLatestBodyweight: db.prepare('SELECT weight FROM bodyweights WHERE user_id = ? ORDER BY date DESC LIMIT 1'),
  insertAchievement: db.prepare('INSERT OR IGNORE INTO achievements (user_id, achievement_key) VALUES (?, ?)'),
  getAchievements: db.prepare('SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC'),
  countAchievements: db.prepare('SELECT COUNT(*) as count FROM achievements WHERE user_id = ?'),
  updateLiftMedia: db.prepare('UPDATE lifts SET media_filename = ? WHERE id = ? AND user_id = ?'),
  removeLiftMedia: db.prepare('UPDATE lifts SET media_filename = NULL WHERE id = ? AND user_id = ?'),
  updateUserAvatar: db.prepare('UPDATE users SET avatar_url = ?, updated_at = datetime(\'now\') WHERE id = ?'),
  removeUserAvatar: db.prepare('UPDATE users SET avatar_url = NULL, updated_at = datetime(\'now\') WHERE id = ?'),
  upsertVote: db.prepare('INSERT INTO lift_votes (lift_id, user_id, vote_type) VALUES (?, ?, ?) ON CONFLICT(lift_id, user_id) DO UPDATE SET vote_type = excluded.vote_type'),
  removeVote: db.prepare('DELETE FROM lift_votes WHERE lift_id = ? AND user_id = ?'),
  getVoteCounts: db.prepare(`SELECT
    COALESCE(SUM(CASE WHEN vote_type = -1 THEN 1 ELSE 0 END), 0) as down_count,
    COALESCE(SUM(CASE WHEN vote_type = 1 THEN 1 ELSE 0 END), 0) as hype_count
    FROM lift_votes WHERE lift_id = ?`),
  getUserVote: db.prepare('SELECT vote_type FROM lift_votes WHERE lift_id = ? AND user_id = ?'),
  recalcPR: db.prepare(`
    UPDATE lifts SET is_pr = 0 WHERE user_id = ? AND lift_type = ?
  `),
  markNewPR: db.prepare(`
    UPDATE lifts SET is_pr = 1
    WHERE id = (
      SELECT id FROM lifts WHERE user_id = ? AND lift_type = ?
      ORDER BY weight DESC, date ASC LIMIT 1
    )
  `),
  getAllUsers: db.prepare('SELECT id, display_name, avatar_color, avatar_url FROM users ORDER BY display_name'),
  insertChat: db.prepare('INSERT INTO chat_messages (user_id, message) VALUES (?, ?)'),
  getRecentChat: db.prepare(`
    SELECT c.id, c.message, c.created_at, c.user_id, u.display_name, u.avatar_color, u.avatar_url
    FROM chat_messages c JOIN users u ON c.user_id = u.id
    WHERE c.created_at > datetime('now', '-24 hours')
    ORDER BY c.created_at ASC
    LIMIT 200
  `),
  purgeOldChat: db.prepare("DELETE FROM chat_messages WHERE created_at <= datetime('now', '-24 hours')"),
  // Reactions
  insertReaction: db.prepare('INSERT OR IGNORE INTO lift_reactions (lift_id, user_id, emoji) VALUES (?, ?, ?)'),
  removeReaction: db.prepare('DELETE FROM lift_reactions WHERE lift_id = ? AND user_id = ? AND emoji = ?'),
  getReactionCounts: db.prepare('SELECT emoji, COUNT(*) as count FROM lift_reactions WHERE lift_id = ? GROUP BY emoji'),
  getUserReactions: db.prepare('SELECT emoji FROM lift_reactions WHERE lift_id = ? AND user_id = ?'),
  // Sparkline: last 10 lifts per type
  getSparklineData: db.prepare(`
    SELECT lift_type, weight, date FROM (
      SELECT lift_type, weight, date, ROW_NUMBER() OVER (PARTITION BY lift_type ORDER BY date DESC, created_at DESC) as rn
      FROM lifts WHERE user_id = ?
    ) WHERE rn <= 10 ORDER BY lift_type, date ASC
  `),
  // Heatmap: lift count by date for last 90 days
  getHeatmapData: db.prepare(`
    SELECT date, COUNT(*) as count FROM lifts
    WHERE user_id = ? AND date >= date('now', '-90 days')
    GROUP BY date ORDER BY date ASC
  `),
  // Streak: consecutive days with lifts ending at today
  getStreakDates: db.prepare(`
    SELECT DISTINCT date FROM lifts WHERE user_id = ? ORDER BY date DESC LIMIT 365
  `),
  // User stats
  getTotalLifts: db.prepare('SELECT COUNT(*) as count FROM lifts WHERE user_id = ?'),
  getTotalWeight: db.prepare('SELECT COALESCE(SUM(weight), 0) as total FROM lifts WHERE user_id = ?'),
  getWeekLifts: db.prepare("SELECT COUNT(*) as count FROM lifts WHERE user_id = ? AND date >= date('now', '-7 days')"),
  getMonthlyLiftCounts: db.prepare(`
    SELECT strftime('%Y-%m', date) as month, COUNT(*) as count FROM lifts
    WHERE user_id = ? GROUP BY month ORDER BY count DESC LIMIT 1
  `),
  // Bio
  updateBio: db.prepare('UPDATE users SET bio = ?, updated_at = datetime(\'now\') WHERE id = ?'),
  // Per-type weekly stats
  getWeekSquats: db.prepare("SELECT COUNT(*) as count FROM lifts WHERE user_id = ? AND lift_type = 'squat' AND date >= date('now', '-7 days')"),
  getWeekBench: db.prepare("SELECT COUNT(*) as count FROM lifts WHERE user_id = ? AND lift_type = 'bench' AND date >= date('now', '-7 days')"),
  getWeekDeadlifts: db.prepare("SELECT COUNT(*) as count FROM lifts WHERE user_id = ? AND lift_type = 'deadlift' AND date >= date('now', '-7 days')"),
  getWeekDays: db.prepare("SELECT COUNT(DISTINCT date) as count FROM lifts WHERE user_id = ? AND date >= date('now', '-7 days')"),
  getWeekPRs: db.prepare("SELECT COUNT(*) as count FROM lifts WHERE user_id = ? AND is_pr = 1 AND date >= date('now', '-7 days')"),
  // Notifications
  insertNotification: db.prepare('INSERT INTO notifications (user_id, type, title, body, ref_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?)'),
  getNotifications: db.prepare('SELECT n.*, u.display_name as from_display_name, u.avatar_color as from_avatar_color, u.avatar_url as from_avatar_url FROM notifications n LEFT JOIN users u ON n.from_user_id = u.id WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT ? OFFSET ?'),
  getUnreadCount: db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'),
  markRead: db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?'),
  markAllRead: db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0'),
  // Challenges
  insertChallenge: db.prepare('INSERT INTO challenges (challenger_id, opponent_id, type, metric, target, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  getChallengeById: db.prepare('SELECT * FROM challenges WHERE id = ?'),
  getUserChallenges: db.prepare(`
    SELECT c.*,
      u1.display_name as challenger_name, u1.avatar_color as challenger_avatar_color, u1.avatar_url as challenger_avatar_url,
      u2.display_name as opponent_name, u2.avatar_color as opponent_avatar_color, u2.avatar_url as opponent_avatar_url
    FROM challenges c
    JOIN users u1 ON c.challenger_id = u1.id
    JOIN users u2 ON c.opponent_id = u2.id
    WHERE (c.challenger_id = ? OR c.opponent_id = ?) AND c.status != 'declined'
    ORDER BY c.created_at DESC LIMIT ? OFFSET ?
  `),
  updateChallengeStatus: db.prepare('UPDATE challenges SET status = ? WHERE id = ?'),
  setChallengeWinner: db.prepare('UPDATE challenges SET status = ?, winner_id = ? WHERE id = ?'),
  // Challenge score helpers
  getChallengeLifts: db.prepare(`
    SELECT user_id, COUNT(*) as lift_count, COALESCE(SUM(weight), 0) as total_weight,
      COALESCE(MAX(weight), 0) as max_weight
    FROM lifts
    WHERE user_id IN (?, ?) AND date >= ? AND date <= ?
    AND (? = 'any' OR lift_type = ?)
    GROUP BY user_id
  `),
  // Runs
  insertRun: db.prepare('INSERT INTO runs (user_id, activity_type, distance_miles, duration_seconds, date, notes) VALUES (?, ?, ?, ?, ?, ?)'),
  getRuns: db.prepare(`
    SELECT r.*, u.display_name, u.avatar_color, u.avatar_url
    FROM runs r JOIN users u ON r.user_id = u.id
    WHERE r.user_id = ? ORDER BY r.date DESC, r.created_at DESC LIMIT ? OFFSET ?
  `),
  getRunById: db.prepare('SELECT * FROM runs WHERE id = ?'),
  deleteRunStmt: db.prepare('DELETE FROM runs WHERE id = ? AND user_id = ?'),
  getRunStats: db.prepare(`
    SELECT
      COALESCE(SUM(distance_miles), 0) as total_miles,
      COUNT(*) as total_runs,
      MIN(CASE WHEN distance_miles > 0 THEN CAST(duration_seconds AS REAL) / distance_miles END) as best_pace_seconds_per_mile,
      COALESCE(SUM(CASE WHEN date >= date('now', '-7 days') THEN distance_miles ELSE 0 END), 0) as weekly_miles,
      COALESCE(SUM(duration_seconds), 0) as total_duration_seconds
    FROM runs WHERE user_id = ?
  `),
  getRunActivity: db.prepare(`
    SELECT r.*, u.display_name, u.email, u.avatar_color, u.avatar_url
    FROM runs r JOIN users u ON r.user_id = u.id
    ORDER BY r.created_at DESC LIMIT ? OFFSET ?
  `),
  getRunsByType: db.prepare(`
    SELECT COUNT(*) as count FROM runs WHERE user_id = ? AND activity_type = ?
  `),
  getTotalRunMiles: db.prepare('SELECT COALESCE(SUM(distance_miles), 0) as total FROM runs WHERE user_id = ?'),
  // PR timeline
  getPRTimeline: db.prepare(`
    SELECT l.id, l.lift_type, l.weight, l.reps, l.date, l.created_at,
      ROUND(l.weight * (1.0 + l.reps / 30.0)) as e1rm
    FROM lifts l WHERE l.user_id = ? AND l.is_pr = 1
    ORDER BY l.date DESC, l.created_at DESC
  `),
  getAchievementTimeline: db.prepare(`
    SELECT achievement_key, unlocked_at FROM achievements
    WHERE user_id = ? ORDER BY unlocked_at DESC
  `),
};

const leaderboardQuery = db.prepare(`
  SELECT
    u.id, u.email, u.display_name, u.total_goal, u.avatar_color, u.avatar_url, u.bio,
    COALESCE(MAX(CASE WHEN l.lift_type = 'squat' THEN l.weight END), 0) as squat,
    COALESCE(MAX(CASE WHEN l.lift_type = 'bench' THEN l.weight END), 0) as bench,
    COALESCE(MAX(CASE WHEN l.lift_type = 'deadlift' THEN l.weight END), 0) as deadlift,
    (SELECT COUNT(*) FROM achievements a WHERE a.user_id = u.id) as achievement_count,
    COUNT(l.id) as total_lifts,
    COALESCE(SUM(l.weight), 0) as total_weight_lifted,
    (SELECT bw.weight FROM bodyweights bw WHERE bw.user_id = u.id ORDER BY bw.date DESC LIMIT 1) as bodyweight
  FROM users u
  LEFT JOIN lifts l ON l.user_id = u.id
  GROUP BY u.id
  ORDER BY (COALESCE(MAX(CASE WHEN l.lift_type = 'squat' THEN l.weight END), 0)
          + COALESCE(MAX(CASE WHEN l.lift_type = 'bench' THEN l.weight END), 0)
          + COALESCE(MAX(CASE WHEN l.lift_type = 'deadlift' THEN l.weight END), 0)) DESC
`);

module.exports = {
  ACHIEVEMENTS,

  ensureUser(email) {
    const displayName = email.split('@')[0];
    stmts.insertUser.run(email, displayName);
    const user = stmts.getUserByEmail.get(email);
    // Assign color if missing
    if (!user.avatar_color) {
      const color = AVATAR_COLORS[user.id % AVATAR_COLORS.length];
      db.prepare("UPDATE users SET avatar_color = ? WHERE id = ?").run(color, user.id);
      user.avatar_color = color;
    }
    return user;
  },

  getUser(id) {
    return stmts.getUserById.get(id);
  },

  getLiftById(id) {
    return stmts.getLiftById.get(id);
  },

  updateUser(id, { display_name, total_goal, squat_goal, bench_goal, deadlift_goal }) {
    stmts.updateUser.run(display_name, total_goal, squat_goal || null, bench_goal || null, deadlift_goal || null, id);
    return stmts.getUserById.get(id);
  },

  logLift(userId, liftType, weight, date, notes, mediaFilename, reps = 1) {
    const currentBest = stmts.getMaxWeight.get(userId, liftType);
    const isPR = !currentBest.best || weight > currentBest.best;

    // Flag as sus if weight is way above their current best (>20% jump)
    let isSus = false;
    if (currentBest.best && weight > currentBest.best * 1.2) {
      isSus = true;
    }

    const result = stmts.insertLift.run(userId, liftType, weight, reps, date, isPR ? 1 : 0, notes || null, mediaFilename || null);

    if (isSus) {
      db.prepare('UPDATE lifts SET is_sus = 1 WHERE id = ?').run(result.lastInsertRowid);
    }

    const e1rm = Math.round(weight * (1 + reps / 30));
    const newAchievements = this.checkAchievements(userId);

    return { liftId: result.lastInsertRowid, isPR, isSus, newAchievements, e1rm, reps };
  },

  getLifts(userId, type, limit = 50, offset = 0) {
    if (type) {
      return stmts.getLiftsByType.all(userId, type, limit, offset);
    }
    return stmts.getLifts.all(userId, limit, offset);
  },

  deleteLift(liftId, userId) {
    const lift = stmts.getLiftById.get(liftId);
    if (!lift || lift.user_id !== userId) return false;

    stmts.deleteLift.run(liftId, userId);

    if (lift.is_pr) {
      stmts.recalcPR.run(userId, lift.lift_type);
      stmts.markNewPR.run(userId, lift.lift_type);
    }

    return true;
  },

  getPRs(userId) {
    const rows = stmts.getPRs.all(userId);
    const prs = { squat: 0, bench: 0, deadlift: 0 };
    for (const row of rows) {
      prs[row.lift_type] = row.weight;
    }
    return prs;
  },

  getLeaderboard() {
    const rows = leaderboardQuery.all();
    return rows.map(r => {
      const total = r.squat + r.bench + r.deadlift;
      return {
        ...r,
        total,
        progress: Math.min(100, Math.round((total / r.total_goal) * 100)),
        dots: this.computeDOTS(r.bodyweight, total),
      };
    });
  },

  getActivity(limit = 20, offset = 0) {
    return stmts.getActivity.all(limit, offset);
  },

  logBodyweight(userId, weight, date) {
    const result = stmts.insertBodyweight.run(userId, weight, date);
    return { id: result.lastInsertRowid };
  },

  getBodyweight(userId, limit = 30, offset = 0) {
    return stmts.getBodyweight.all(userId, limit, offset);
  },

  deleteBodyweight(id, userId) {
    const entry = stmts.getBodyweightById.get(id);
    if (!entry || entry.user_id !== userId) return false;
    stmts.deleteBodyweight.run(id, userId);
    return true;
  },

  getLatestBodyweight(userId) {
    const row = stmts.getLatestBodyweight.get(userId);
    return row ? row.weight : null;
  },

  getAchievements(userId) {
    return stmts.getAchievements.all(userId);
  },

  checkAchievements(userId) {
    const prs = this.getPRs(userId);
    const newlyUnlocked = [];

    for (const a of ACHIEVEMENTS) {
      if (a.check(prs)) {
        const result = stmts.insertAchievement.run(userId, a.key);
        if (result.changes > 0) {
          newlyUnlocked.push({ key: a.key, label: a.label, desc: a.desc, icon: a.icon });
        }
      }
    }

    return newlyUnlocked;
  },

  getAllAchievementDefs() {
    return ACHIEVEMENTS.map(a => ({ key: a.key, label: a.label, desc: a.desc, icon: a.icon }));
  },

  updateLiftMedia(liftId, userId, mediaFilename) {
    const lift = stmts.getLiftById.get(liftId);
    if (!lift || lift.user_id !== userId) return null;
    const oldMedia = lift.media_filename;
    stmts.updateLiftMedia.run(mediaFilename, liftId, userId);
    return oldMedia;
  },

  removeLiftMedia(liftId, userId) {
    const lift = stmts.getLiftById.get(liftId);
    if (!lift || lift.user_id !== userId) return null;
    const oldMedia = lift.media_filename;
    stmts.removeLiftMedia.run(liftId, userId);
    return oldMedia;
  },

  voteLift(liftId, userId, voteType) {
    const lift = stmts.getLiftById.get(liftId);
    if (!lift) return null;
    // Can't downvote your own lift (but can hype it... nah, no self-hype either)
    if (lift.user_id === userId) return { error: 'self' };
    const existing = stmts.getUserVote.get(liftId, userId);
    if (existing && existing.vote_type === voteType) {
      // Toggle off — same vote type clicked again
      stmts.removeVote.run(liftId, userId);
    } else {
      // Insert or switch vote type
      stmts.upsertVote.run(liftId, userId, voteType);
    }
    const counts = stmts.getVoteCounts.get(liftId);
    const newVote = stmts.getUserVote.get(liftId, userId);
    return { user_vote: newVote ? newVote.vote_type : 0, vote_count: counts.down_count, hype_count: counts.hype_count };
  },

  getUserVote(liftId, userId) {
    const row = stmts.getUserVote.get(liftId, userId);
    return row ? row.vote_type : 0;
  },

  getAllUsers() {
    return stmts.getAllUsers.all();
  },

  updateUserAvatar(userId, filename) {
    const user = stmts.getUserById.get(userId);
    if (!user) return null;
    const oldAvatar = user.avatar_url;
    stmts.updateUserAvatar.run(filename, userId);
    return oldAvatar;
  },

  removeUserAvatar(userId) {
    const user = stmts.getUserById.get(userId);
    if (!user) return null;
    const oldAvatar = user.avatar_url;
    stmts.removeUserAvatar.run(userId);
    return oldAvatar;
  },

  sendChat(userId, message) {
    const result = stmts.insertChat.run(userId, message);
    return result.lastInsertRowid;
  },

  getRecentChat() {
    stmts.purgeOldChat.run();
    return stmts.getRecentChat.all();
  },

  parseMentions(message) {
    const users = stmts.getAllUsers.all();
    const mentioned = [];
    for (const u of users) {
      if (message.includes('@' + u.display_name)) {
        mentioned.push(u.id);
      }
    }
    return mentioned;
  },

  reactToLift(liftId, userId, emoji) {
    // Toggle: if reaction exists, remove it; otherwise add it
    const existing = stmts.getUserReactions.all(liftId, userId);
    const hasIt = existing.some(r => r.emoji === emoji);
    if (hasIt) {
      stmts.removeReaction.run(liftId, userId, emoji);
    } else {
      stmts.insertReaction.run(liftId, userId, emoji);
    }
    return this.getLiftReactions(liftId);
  },

  getLiftReactions(liftId) {
    const rows = stmts.getReactionCounts.all(liftId);
    const result = {};
    for (const r of rows) result[r.emoji] = r.count;
    return result;
  },

  getUserLiftReactions(liftId, userId) {
    return stmts.getUserReactions.all(liftId, userId).map(r => r.emoji);
  },

  getSparkline(userId) {
    const rows = stmts.getSparklineData.all(userId);
    const result = { squat: [], bench: [], deadlift: [] };
    for (const r of rows) {
      if (result[r.lift_type]) result[r.lift_type].push(r.weight);
    }
    return result;
  },

  getHeatmap(userId) {
    return stmts.getHeatmapData.all(userId);
  },

  getStreak(userId) {
    const rows = stmts.getStreakDates.all(userId);
    if (rows.length === 0) return 0;
    let streak = 0;
    const todayStr = new Date().toISOString().split('T')[0];
    const d = new Date(todayStr + 'T00:00:00');
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(d);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      if (rows.some(r => r.date === dateStr)) {
        streak++;
      } else {
        // Allow skipping today if no lifts yet (streak from yesterday)
        if (i === 0) continue;
        break;
      }
    }
    return streak;
  },

  getUserStats(userId) {
    const totalLifts = stmts.getTotalLifts.get(userId).count;
    const totalWeight = stmts.getTotalWeight.get(userId).total;
    const weekLifts = stmts.getWeekLifts.get(userId).count;
    const weekSquats = stmts.getWeekSquats.get(userId).count;
    const weekBench = stmts.getWeekBench.get(userId).count;
    const weekDeadlifts = stmts.getWeekDeadlifts.get(userId).count;
    const weekDays = stmts.getWeekDays.get(userId).count;
    const weekPRs = stmts.getWeekPRs.get(userId).count;
    const bestMonth = stmts.getMonthlyLiftCounts.get(userId);
    const streak = this.getStreak(userId);
    const achievements = stmts.countAchievements.get(userId).count;

    // XP calculation
    const xp = (totalLifts * 10) + Math.floor(totalWeight / 100) + (achievements * 50) + (streak * 5);
    let level, tier;
    if (xp >= 2000) { level = 6; tier = 'Mythic'; }
    else if (xp >= 1000) { level = 5; tier = 'Diamond'; }
    else if (xp >= 600) { level = 4; tier = 'Titanium'; }
    else if (xp >= 300) { level = 3; tier = 'Steel'; }
    else if (xp >= 100) { level = 2; tier = 'Iron'; }
    else { level = 1; tier = 'Recruit'; }

    return {
      totalLifts, totalWeight, weekLifts, weekSquats, weekBench, weekDeadlifts, weekDays, weekPRs,
      streak, achievements,
      bestMonth: bestMonth ? { month: bestMonth.month, count: bestMonth.count } : null,
      xp, level, tier,
    };
  },

  updateBio(userId, bio) {
    stmts.updateBio.run(bio, userId);
    return stmts.getUserById.get(userId);
  },

  // Notifications
  createNotification(userId, type, title, body, refId, fromUserId) {
    const result = stmts.insertNotification.run(userId, type, title, body || null, refId || null, fromUserId || null);
    return result.lastInsertRowid;
  },

  getNotifications(userId, limit = 30, offset = 0) {
    return stmts.getNotifications.all(userId, limit, offset);
  },

  getUnreadCount(userId) {
    return stmts.getUnreadCount.get(userId).count;
  },

  markNotificationRead(notifId, userId) {
    return stmts.markRead.run(notifId, userId).changes > 0;
  },

  markAllNotificationsRead(userId) {
    return stmts.markAllRead.run(userId).changes;
  },

  // Challenges
  createChallenge(challengerId, opponentId, type, metric, target, startDate, endDate) {
    const result = stmts.insertChallenge.run(challengerId, opponentId, type, metric, target || null, startDate, endDate);
    return result.lastInsertRowid;
  },

  getChallenge(id) {
    return stmts.getChallengeById.get(id);
  },

  getUserChallenges(userId, limit = 20, offset = 0) {
    return stmts.getUserChallenges.all(userId, userId, limit, offset);
  },

  respondToChallenge(challengeId, userId, accept) {
    const challenge = stmts.getChallengeById.get(challengeId);
    if (!challenge || challenge.opponent_id !== userId || challenge.status !== 'pending') return null;
    const newStatus = accept ? 'active' : 'declined';
    stmts.updateChallengeStatus.run(newStatus, challengeId);
    return stmts.getChallengeById.get(challengeId);
  },

  getChallengeScores(challengeId) {
    const c = stmts.getChallengeById.get(challengeId);
    if (!c) return null;
    const metric = c.metric || 'any';
    const rows = stmts.getChallengeLifts.all(c.challenger_id, c.opponent_id, c.start_date, c.end_date, metric, metric);
    const scores = {};
    scores[c.challenger_id] = { lift_count: 0, total_weight: 0, max_weight: 0 };
    scores[c.opponent_id] = { lift_count: 0, total_weight: 0, max_weight: 0 };
    for (const r of rows) {
      scores[r.user_id] = { lift_count: r.lift_count, total_weight: r.total_weight, max_weight: r.max_weight };
    }
    return scores;
  },

  completeChallenge(challengeId) {
    const c = stmts.getChallengeById.get(challengeId);
    if (!c || c.status !== 'active') return null;
    const scores = this.getChallengeScores(challengeId);
    const cScore = scores[c.challenger_id];
    const oScore = scores[c.opponent_id];
    let winnerId = null;
    if (c.type === 'most_weight') {
      winnerId = cScore.total_weight >= oScore.total_weight ? c.challenger_id : c.opponent_id;
    } else if (c.type === 'most_lifts') {
      winnerId = cScore.lift_count >= oScore.lift_count ? c.challenger_id : c.opponent_id;
    } else if (c.type === 'highest_single') {
      winnerId = cScore.max_weight >= oScore.max_weight ? c.challenger_id : c.opponent_id;
    }
    stmts.setChallengeWinner.run('completed', winnerId, challengeId);
    return stmts.getChallengeById.get(challengeId);
  },

  // PR Timeline
  getPRTimeline(userId) {
    return stmts.getPRTimeline.all(userId);
  },

  getAchievementTimeline(userId) {
    const rows = stmts.getAchievementTimeline.all(userId);
    return rows.map(r => {
      const def = ACHIEVEMENTS.find(a => a.key === r.achievement_key);
      return { ...r, label: def ? def.label : r.achievement_key, icon: def ? def.icon : '🏅', desc: def ? def.desc : '' };
    });
  },

  // --- Runs ---

  logRun(userId, activityType, distanceMiles, durationSeconds, date, notes) {
    const result = stmts.insertRun.run(userId, activityType, distanceMiles, durationSeconds, date, notes || null);
    const newAchievements = this.checkRunAchievements(userId);
    return { runId: result.lastInsertRowid, newAchievements };
  },

  getRuns(userId, limit = 50, offset = 0) {
    return stmts.getRuns.all(userId, limit, offset);
  },

  deleteRun(runId, userId) {
    const run = stmts.getRunById.get(runId);
    if (!run || run.user_id !== userId) return false;
    stmts.deleteRunStmt.run(runId, userId);
    return true;
  },

  getRunStats(userId) {
    return stmts.getRunStats.get(userId);
  },

  getRunActivity(limit = 20, offset = 0) {
    return stmts.getRunActivity.all(limit, offset);
  },

  checkRunAchievements(userId) {
    const newlyUnlocked = [];
    const totalMiles = stmts.getTotalRunMiles.get(userId).total;
    const totalRuns = db.prepare('SELECT COUNT(*) as count FROM runs WHERE user_id = ?').get(userId).count;

    const checks = [
      { key: 'first_run', condition: totalRuns >= 1 },
      { key: 'first_5k', condition: stmts.getRunsByType.get(userId, '5k').count > 0 },
      { key: 'first_10k', condition: stmts.getRunsByType.get(userId, '10k').count > 0 },
      { key: 'first_half', condition: stmts.getRunsByType.get(userId, 'half_marathon').count > 0 },
      { key: 'first_marathon', condition: stmts.getRunsByType.get(userId, 'marathon').count > 0 },
      { key: 'miles_100', condition: totalMiles >= 100 },
      { key: 'miles_500', condition: totalMiles >= 500 },
    ];

    for (const { key, condition } of checks) {
      if (condition) {
        const result = stmts.insertAchievement.run(userId, key);
        if (result.changes > 0) {
          const def = ACHIEVEMENTS.find(a => a.key === key);
          if (def) newlyUnlocked.push({ key: def.key, label: def.label, desc: def.desc, icon: def.icon });
        }
      }
    }

    return newlyUnlocked;
  },

  // DOTS score calculation
  computeDOTS(bodyweightLbs, totalLbs, gender = 'male') {
    if (!bodyweightLbs || !totalLbs) return 0;
    const bwKg = bodyweightLbs * 0.453592;
    const totalKg = totalLbs * 0.453592;
    // Male DOTS coefficients
    const a = -307.75076;
    const b = 24.0900756;
    const c = -0.1918759221;
    const d = 0.0007391293;
    const e = -0.000001093;
    const denom = a + b * bwKg + c * Math.pow(bwKg, 2) + d * Math.pow(bwKg, 3) + e * Math.pow(bwKg, 4);
    if (denom <= 0) return 0;
    return Math.round((500 / denom) * totalKg * 10) / 10;
  },

  // Get last lift for a type (for smart suggestions)
  getLastLift(userId, liftType) {
    return db.prepare('SELECT weight, reps FROM lifts WHERE user_id = ? AND lift_type = ? ORDER BY date DESC, created_at DESC LIMIT 1').get(userId, liftType) || null;
  },
};
