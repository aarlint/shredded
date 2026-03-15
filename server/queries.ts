/**
 * Direct SQL queries wrapping the existing shredded.db logic.
 * Uses bun:sqlite directly (via the underlying sqlite instance) for complex queries
 * that are difficult to express cleanly in Drizzle, matching the original prepared statements.
 */
import { sqlite } from './db'

const AVATAR_COLORS = [
  'linear-gradient(135deg, #4a9e6e, #d4a94e)',
  'linear-gradient(135deg, #3a7d57, #5cb85c)',
  'linear-gradient(135deg, #6b7b5e, #8a9a6e)',
  'linear-gradient(135deg, #d4a94e, #a07840)',
  'linear-gradient(135deg, #5c7a5c, #3a5a3a)',
  'linear-gradient(135deg, #8b7355, #c9a96e)',
  'linear-gradient(135deg, #4a6b4a, #6b9b6b)',
  'linear-gradient(135deg, #7a8a6a, #4a6040)',
  'linear-gradient(135deg, #5a7a5c, #8aaa7a)',
  'linear-gradient(135deg, #6a7a5a, #9aaa7a)',
]

export const ACHIEVEMENTS = [
  { key: 'first_lift', label: 'First Step', desc: 'Log your first lift', icon: '🎬', check: (_p: PRs) => true },
  { key: 'bench_135', label: 'Plate Club (Bench)', desc: 'Bench 135 lbs', icon: '🏋️', check: (p: PRs) => p.bench >= 135 },
  { key: 'bench_225', label: 'Two Plate Bench', desc: 'Bench 225 lbs', icon: '🔥', check: (p: PRs) => p.bench >= 225 },
  { key: 'bench_315', label: 'Three Plate Bench', desc: 'Bench 315 lbs', icon: '💎', check: (p: PRs) => p.bench >= 315 },
  { key: 'bench_405', label: 'Four Plate Bench', desc: 'Bench 405 lbs', icon: '👑', check: (p: PRs) => p.bench >= 405 },
  { key: 'squat_135', label: 'Plate Club (Squat)', desc: 'Squat 135 lbs', icon: '🦵', check: (p: PRs) => p.squat >= 135 },
  { key: 'squat_225', label: 'Two Plate Squat', desc: 'Squat 225 lbs', icon: '🦵', check: (p: PRs) => p.squat >= 225 },
  { key: 'squat_315', label: 'Three Plate Squat', desc: 'Squat 315 lbs', icon: '🔥', check: (p: PRs) => p.squat >= 315 },
  { key: 'squat_405', label: 'Four Plate Squat', desc: 'Squat 405 lbs', icon: '👑', check: (p: PRs) => p.squat >= 405 },
  { key: 'squat_500', label: 'Five Hundo Squat', desc: 'Squat 500 lbs', icon: '🏆', check: (p: PRs) => p.squat >= 500 },
  { key: 'deadlift_135', label: 'Plate Club (Dead)', desc: 'Deadlift 135 lbs', icon: '💀', check: (p: PRs) => p.deadlift >= 135 },
  { key: 'deadlift_225', label: 'Two Plate Deadlift', desc: 'Deadlift 225 lbs', icon: '💀', check: (p: PRs) => p.deadlift >= 225 },
  { key: 'deadlift_315', label: 'Three Plate Deadlift', desc: 'Deadlift 315 lbs', icon: '🔥', check: (p: PRs) => p.deadlift >= 315 },
  { key: 'deadlift_405', label: 'Four Plate Deadlift', desc: 'Deadlift 405 lbs', icon: '⚡', check: (p: PRs) => p.deadlift >= 405 },
  { key: 'deadlift_500', label: 'Five Hundred Pull', desc: 'Deadlift 500 lbs', icon: '🏆', check: (p: PRs) => p.deadlift >= 500 },
  { key: 'total_500', label: 'Half Way There', desc: '500 lb total', icon: '🎯', check: (p: PRs) => (p.squat + p.bench + p.deadlift) >= 500 },
  { key: 'total_750', label: 'Three Quarters', desc: '750 lb total', icon: '📈', check: (p: PRs) => (p.squat + p.bench + p.deadlift) >= 750 },
  { key: 'total_1000', label: '1000 LB CLUB', desc: '1000 lb total!', icon: '🏆', check: (p: PRs) => (p.squat + p.bench + p.deadlift) >= 1000 },
  { key: 'total_1200', label: 'Elite', desc: '1200 lb total', icon: '💎', check: (p: PRs) => (p.squat + p.bench + p.deadlift) >= 1200 },
  { key: 'total_1500', label: 'Freak', desc: '1500 lb total', icon: '🦍', check: (p: PRs) => (p.squat + p.bench + p.deadlift) >= 1500 },
  { key: 'first_run', label: 'First Mile', desc: 'Log your first run', icon: '🏃', check: (_p: PRs) => false },
  { key: 'offroad', label: 'Offroad', desc: 'Log your first trail run', icon: '🌲', check: (_p: PRs) => false },
  { key: 'first_5k', label: '5K Finisher', desc: 'Complete a 5K', icon: '🏃', check: (_p: PRs) => false },
  { key: 'first_10k', label: '10K Finisher', desc: 'Complete a 10K', icon: '🏃', check: (_p: PRs) => false },
  { key: 'first_half', label: 'Half Marathon', desc: 'Complete a half marathon', icon: '🏅', check: (_p: PRs) => false },
  { key: 'first_marathon', label: 'Marathoner', desc: 'Complete a marathon', icon: '🏆', check: (_p: PRs) => false },
  { key: 'miles_100', label: 'Century Runner', desc: 'Run 100 total miles', icon: '💯', check: (_p: PRs) => false },
  { key: 'miles_500', label: 'Road Warrior', desc: 'Run 500 total miles', icon: '🛣️', check: (_p: PRs) => false },
]

type PRs = { squat: number; bench: number; deadlift: number }

// Initialize tables (CREATE TABLE IF NOT EXISTS)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    total_goal INTEGER NOT NULL DEFAULT 1000,
    squat_goal INTEGER,
    bench_goal INTEGER,
    deadlift_goal INTEGER,
    bio TEXT,
    avatar_color TEXT DEFAULT '',
    avatar_url TEXT,
    leaderboard_mode TEXT DEFAULT 'lift',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS lifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    lift_type TEXT NOT NULL CHECK(lift_type IN ('squat', 'bench', 'deadlift')),
    weight INTEGER NOT NULL,
    reps INTEGER NOT NULL DEFAULT 1,
    date TEXT NOT NULL,
    is_pr INTEGER NOT NULL DEFAULT 0,
    is_sus INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    media_filename TEXT,
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
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS lift_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lift_id INTEGER NOT NULL REFERENCES lifts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    vote_type INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(lift_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS lift_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lift_id INTEGER NOT NULL REFERENCES lifts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    emoji TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(lift_id, user_id, emoji)
  );
  CREATE INDEX IF NOT EXISTS idx_lift_reactions_lift ON lift_reactions(lift_id);
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
`)

// Assign random avatar colors to users that don't have one
{
  const usersWithoutColor = sqlite.prepare("SELECT id FROM users WHERE avatar_color = '' OR avatar_color IS NULL").all() as { id: number }[]
  const setColor = sqlite.prepare('UPDATE users SET avatar_color = ? WHERE id = ?')
  for (const u of usersWithoutColor) {
    setColor.run(AVATAR_COLORS[u.id % AVATAR_COLORS.length], u.id)
  }
}

// Prepared statements
const stmts = {
  insertUser: sqlite.prepare('INSERT OR IGNORE INTO users (email, display_name) VALUES (?, ?)'),
  getUserByEmail: sqlite.prepare('SELECT * FROM users WHERE email = ?'),
  getUserById: sqlite.prepare('SELECT * FROM users WHERE id = ?'),
  updateUser: sqlite.prepare("UPDATE users SET display_name = ?, total_goal = ?, squat_goal = ?, bench_goal = ?, deadlift_goal = ?, updated_at = datetime('now') WHERE id = ?"),
  insertLift: sqlite.prepare('INSERT INTO lifts (user_id, lift_type, weight, reps, date, is_pr, notes, media_filename) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  getLiftById: sqlite.prepare('SELECT * FROM lifts WHERE id = ?'),
  deleteLift: sqlite.prepare('DELETE FROM lifts WHERE id = ? AND user_id = ?'),
  getMaxWeight: sqlite.prepare('SELECT MAX(CASE WHEN reps > 1 THEN ROUND(weight * (1.0 + reps / 30.0)) ELSE weight END) as best FROM lifts WHERE user_id = ? AND lift_type = ?'),
  getPRs: sqlite.prepare(`
    SELECT lift_type, MAX(CASE WHEN reps > 1 THEN ROUND(weight * (1.0 + reps / 30.0)) ELSE weight END) as weight
    FROM lifts WHERE user_id = ?
    GROUP BY lift_type
  `),
  getLifts: sqlite.prepare(`
    SELECT l.*, u.display_name, u.avatar_color, u.avatar_url,
      CASE WHEN l.reps > 1 THEN ROUND(l.weight * (1.0 + l.reps / 30.0)) ELSE l.weight END as e1rm,
      (SELECT COUNT(*) FROM lift_votes v WHERE v.lift_id = l.id AND v.vote_type = -1) as vote_count,
      (SELECT COUNT(*) FROM lift_votes v WHERE v.lift_id = l.id AND v.vote_type = 1) as hype_count
    FROM lifts l JOIN users u ON l.user_id = u.id
    WHERE l.user_id = ? ORDER BY l.date DESC, l.created_at DESC LIMIT ? OFFSET ?
  `),
  getLiftsByType: sqlite.prepare(`
    SELECT l.*, u.display_name, u.avatar_color, u.avatar_url,
      CASE WHEN l.reps > 1 THEN ROUND(l.weight * (1.0 + l.reps / 30.0)) ELSE l.weight END as e1rm,
      (SELECT COUNT(*) FROM lift_votes v WHERE v.lift_id = l.id AND v.vote_type = -1) as vote_count,
      (SELECT COUNT(*) FROM lift_votes v WHERE v.lift_id = l.id AND v.vote_type = 1) as hype_count
    FROM lifts l JOIN users u ON l.user_id = u.id
    WHERE l.user_id = ? AND l.lift_type = ? ORDER BY l.date DESC, l.created_at DESC LIMIT ? OFFSET ?
  `),
  getActivity: sqlite.prepare(`
    SELECT l.*, u.display_name, u.email, u.avatar_color, u.avatar_url,
      CASE WHEN l.reps > 1 THEN ROUND(l.weight * (1.0 + l.reps / 30.0)) ELSE l.weight END as e1rm,
      (SELECT COUNT(*) FROM lift_votes v WHERE v.lift_id = l.id AND v.vote_type = -1) as vote_count,
      (SELECT COUNT(*) FROM lift_votes v WHERE v.lift_id = l.id AND v.vote_type = 1) as hype_count
    FROM lifts l JOIN users u ON l.user_id = u.id
    ORDER BY l.created_at DESC LIMIT ? OFFSET ?
  `),
  insertBodyweight: sqlite.prepare('INSERT INTO bodyweights (user_id, weight, date) VALUES (?, ?, ?)'),
  getBodyweight: sqlite.prepare('SELECT * FROM bodyweights WHERE user_id = ? ORDER BY date DESC LIMIT ? OFFSET ?'),
  deleteBodyweight: sqlite.prepare('DELETE FROM bodyweights WHERE id = ? AND user_id = ?'),
  getBodyweightById: sqlite.prepare('SELECT * FROM bodyweights WHERE id = ?'),
  getLatestBodyweight: sqlite.prepare('SELECT weight FROM bodyweights WHERE user_id = ? ORDER BY date DESC LIMIT 1'),
  insertAchievement: sqlite.prepare('INSERT OR IGNORE INTO achievements (user_id, achievement_key) VALUES (?, ?)'),
  getAchievements: sqlite.prepare('SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC'),
  countAchievements: sqlite.prepare('SELECT COUNT(*) as count FROM achievements WHERE user_id = ?'),
  updateLiftMedia: sqlite.prepare('UPDATE lifts SET media_filename = ? WHERE id = ? AND user_id = ?'),
  removeLiftMedia: sqlite.prepare('UPDATE lifts SET media_filename = NULL WHERE id = ? AND user_id = ?'),
  updateUserAvatar: sqlite.prepare("UPDATE users SET avatar_url = ?, updated_at = datetime('now') WHERE id = ?"),
  removeUserAvatar: sqlite.prepare("UPDATE users SET avatar_url = NULL, updated_at = datetime('now') WHERE id = ?"),
  upsertVote: sqlite.prepare('INSERT INTO lift_votes (lift_id, user_id, vote_type) VALUES (?, ?, ?) ON CONFLICT(lift_id, user_id) DO UPDATE SET vote_type = excluded.vote_type'),
  removeVote: sqlite.prepare('DELETE FROM lift_votes WHERE lift_id = ? AND user_id = ?'),
  getVoteCounts: sqlite.prepare(`SELECT
    COALESCE(SUM(CASE WHEN vote_type = -1 THEN 1 ELSE 0 END), 0) as down_count,
    COALESCE(SUM(CASE WHEN vote_type = 1 THEN 1 ELSE 0 END), 0) as hype_count
    FROM lift_votes WHERE lift_id = ?`),
  getUserVote: sqlite.prepare('SELECT vote_type FROM lift_votes WHERE lift_id = ? AND user_id = ?'),
  recalcPR: sqlite.prepare('UPDATE lifts SET is_pr = 0 WHERE user_id = ? AND lift_type = ?'),
  markNewPR: sqlite.prepare(`
    UPDATE lifts SET is_pr = 1
    WHERE id = (
      SELECT id FROM lifts WHERE user_id = ? AND lift_type = ?
      ORDER BY (CASE WHEN reps > 1 THEN ROUND(weight * (1.0 + reps / 30.0)) ELSE weight END) DESC, date ASC LIMIT 1
    )
  `),
  getAllUsers: sqlite.prepare('SELECT id, display_name, avatar_color, avatar_url FROM users ORDER BY display_name'),
  insertChat: sqlite.prepare('INSERT INTO chat_messages (user_id, message) VALUES (?, ?)'),
  getRecentChat: sqlite.prepare(`
    SELECT c.id, c.message, c.created_at, c.user_id, u.display_name, u.avatar_color, u.avatar_url
    FROM chat_messages c JOIN users u ON c.user_id = u.id
    WHERE c.created_at > datetime('now', '-24 hours')
    ORDER BY c.created_at ASC
    LIMIT 200
  `),
  purgeOldChat: sqlite.prepare("DELETE FROM chat_messages WHERE created_at <= datetime('now', '-24 hours')"),
  insertReaction: sqlite.prepare('INSERT OR IGNORE INTO lift_reactions (lift_id, user_id, emoji) VALUES (?, ?, ?)'),
  removeReaction: sqlite.prepare('DELETE FROM lift_reactions WHERE lift_id = ? AND user_id = ? AND emoji = ?'),
  getReactionCounts: sqlite.prepare('SELECT emoji, COUNT(*) as count FROM lift_reactions WHERE lift_id = ? GROUP BY emoji'),
  getUserReactions: sqlite.prepare('SELECT emoji FROM lift_reactions WHERE lift_id = ? AND user_id = ?'),
  getSparklineData: sqlite.prepare(`
    SELECT lift_type, weight, date FROM (
      SELECT lift_type, weight, date, ROW_NUMBER() OVER (PARTITION BY lift_type ORDER BY date DESC, created_at DESC) as rn
      FROM lifts WHERE user_id = ?
    ) WHERE rn <= 10 ORDER BY lift_type, date ASC
  `),
  getHeatmapData: sqlite.prepare(`
    SELECT date, COUNT(*) as count FROM lifts
    WHERE user_id = ? AND date >= date('now', '-90 days')
    GROUP BY date ORDER BY date ASC
  `),
  getStreakDatesAll: sqlite.prepare(`
    SELECT DISTINCT date FROM (
      SELECT date FROM lifts WHERE user_id = ?
      UNION
      SELECT date FROM runs WHERE user_id = ?
    ) ORDER BY date DESC LIMIT 365
  `),
  getTotalLifts: sqlite.prepare('SELECT COUNT(*) as count FROM lifts WHERE user_id = ?'),
  getTotalWeight: sqlite.prepare('SELECT COALESCE(SUM(weight), 0) as total FROM lifts WHERE user_id = ?'),
  getWeekLifts: sqlite.prepare("SELECT COUNT(*) as count FROM lifts WHERE user_id = ? AND date >= date('now', '-7 days')"),
  getMonthlyLiftCounts: sqlite.prepare(`
    SELECT strftime('%Y-%m', date) as month, COUNT(*) as count FROM lifts
    WHERE user_id = ? GROUP BY month ORDER BY count DESC LIMIT 1
  `),
  updateBio: sqlite.prepare("UPDATE users SET bio = ?, updated_at = datetime('now') WHERE id = ?"),
  getWeekSquats: sqlite.prepare("SELECT COUNT(*) as count FROM lifts WHERE user_id = ? AND lift_type = 'squat' AND date >= date('now', '-7 days')"),
  getWeekBench: sqlite.prepare("SELECT COUNT(*) as count FROM lifts WHERE user_id = ? AND lift_type = 'bench' AND date >= date('now', '-7 days')"),
  getWeekDeadlifts: sqlite.prepare("SELECT COUNT(*) as count FROM lifts WHERE user_id = ? AND lift_type = 'deadlift' AND date >= date('now', '-7 days')"),
  getWeekDays: sqlite.prepare("SELECT COUNT(DISTINCT date) as count FROM lifts WHERE user_id = ? AND date >= date('now', '-7 days')"),
  getWeekPRs: sqlite.prepare("SELECT COUNT(*) as count FROM lifts WHERE user_id = ? AND is_pr = 1 AND date >= date('now', '-7 days')"),
  insertNotification: sqlite.prepare('INSERT INTO notifications (user_id, type, title, body, ref_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?)'),
  getNotifications: sqlite.prepare('SELECT n.*, u.display_name as from_display_name, u.avatar_color as from_avatar_color, u.avatar_url as from_avatar_url FROM notifications n LEFT JOIN users u ON n.from_user_id = u.id WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT ? OFFSET ?'),
  getUnreadCount: sqlite.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'),
  markRead: sqlite.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?'),
  markAllRead: sqlite.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0'),
  insertChallenge: sqlite.prepare('INSERT INTO challenges (challenger_id, opponent_id, type, metric, target, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  getChallengeById: sqlite.prepare('SELECT * FROM challenges WHERE id = ?'),
  getUserChallenges: sqlite.prepare(`
    SELECT c.*,
      u1.display_name as challenger_name, u1.avatar_color as challenger_avatar_color, u1.avatar_url as challenger_avatar_url,
      u2.display_name as opponent_name, u2.avatar_color as opponent_avatar_color, u2.avatar_url as opponent_avatar_url
    FROM challenges c
    JOIN users u1 ON c.challenger_id = u1.id
    JOIN users u2 ON c.opponent_id = u2.id
    WHERE (c.challenger_id = ? OR c.opponent_id = ?) AND c.status != 'declined'
    ORDER BY c.created_at DESC LIMIT ? OFFSET ?
  `),
  updateChallengeStatus: sqlite.prepare('UPDATE challenges SET status = ? WHERE id = ?'),
  setChallengeWinner: sqlite.prepare('UPDATE challenges SET status = ?, winner_id = ? WHERE id = ?'),
  getChallengeLifts: sqlite.prepare(`
    SELECT user_id, COUNT(*) as lift_count, COALESCE(SUM(weight), 0) as total_weight,
      COALESCE(MAX(weight), 0) as max_weight
    FROM lifts
    WHERE user_id IN (?, ?) AND date >= ? AND date <= ?
    AND (? = 'any' OR lift_type = ?)
    GROUP BY user_id
  `),
  insertRun: sqlite.prepare('INSERT INTO runs (user_id, activity_type, distance_miles, duration_seconds, date, notes) VALUES (?, ?, ?, ?, ?, ?)'),
  getRuns: sqlite.prepare(`
    SELECT r.*, u.display_name, u.avatar_color, u.avatar_url
    FROM runs r JOIN users u ON r.user_id = u.id
    WHERE r.user_id = ? ORDER BY r.date DESC, r.created_at DESC LIMIT ? OFFSET ?
  `),
  getRunById: sqlite.prepare('SELECT * FROM runs WHERE id = ?'),
  deleteRunStmt: sqlite.prepare('DELETE FROM runs WHERE id = ? AND user_id = ?'),
  getRunStats: sqlite.prepare(`
    SELECT
      COALESCE(SUM(distance_miles), 0) as total_miles,
      COUNT(*) as total_runs,
      MIN(CASE WHEN distance_miles > 0 THEN CAST(duration_seconds AS REAL) / distance_miles END) as best_pace_seconds_per_mile,
      COALESCE(SUM(CASE WHEN date >= date('now', '-7 days') THEN distance_miles ELSE 0 END), 0) as weekly_miles,
      COALESCE(SUM(duration_seconds), 0) as total_duration_seconds
    FROM runs WHERE user_id = ?
  `),
  getRunActivity: sqlite.prepare(`
    SELECT r.*, u.display_name, u.email, u.avatar_color, u.avatar_url
    FROM runs r JOIN users u ON r.user_id = u.id
    ORDER BY r.created_at DESC LIMIT ? OFFSET ?
  `),
  getRunsByType: sqlite.prepare('SELECT COUNT(*) as count FROM runs WHERE user_id = ? AND activity_type = ?'),
  getTotalRunMiles: sqlite.prepare('SELECT COALESCE(SUM(distance_miles), 0) as total FROM runs WHERE user_id = ?'),
  getUnifiedActivity: sqlite.prepare(`
    SELECT * FROM (
      SELECT l.id, 'lift' as type, l.user_id, l.lift_type, l.weight, l.reps, l.date, l.notes, l.is_pr, l.is_sus, l.media_filename, l.created_at,
        CASE WHEN l.reps > 1 THEN ROUND(l.weight * (1.0 + l.reps / 30.0)) ELSE l.weight END as e1rm,
        NULL as activity_type, NULL as distance_miles, NULL as duration_seconds,
        u.display_name, u.email, u.avatar_color, u.avatar_url,
        (SELECT COUNT(*) FROM lift_votes v WHERE v.lift_id = l.id AND v.vote_type = -1) as vote_count,
        (SELECT COUNT(*) FROM lift_votes v WHERE v.lift_id = l.id AND v.vote_type = 1) as hype_count
      FROM lifts l JOIN users u ON l.user_id = u.id
      UNION ALL
      SELECT r.id, 'run' as type, r.user_id, NULL as lift_type, NULL as weight, NULL as reps, r.date, r.notes, NULL as is_pr, NULL as is_sus, NULL as media_filename, r.created_at,
        NULL as e1rm,
        r.activity_type, r.distance_miles, r.duration_seconds,
        u.display_name, u.email, u.avatar_color, u.avatar_url,
        NULL as vote_count, NULL as hype_count
      FROM runs r JOIN users u ON r.user_id = u.id
    ) ORDER BY created_at DESC LIMIT ? OFFSET ?
  `),
  getActivityHeatmap: sqlite.prepare(`
    SELECT date, SUM(count) as count FROM (
      SELECT date, COUNT(*) as count FROM lifts
      WHERE user_id = ? AND date >= date('now', '-90 days')
      GROUP BY date
      UNION ALL
      SELECT date, COUNT(*) as count FROM runs
      WHERE user_id = ? AND date >= date('now', '-90 days')
      GROUP BY date
    ) GROUP BY date ORDER BY date ASC
  `),
  getRunTimeline: sqlite.prepare(`
    SELECT r.id, r.activity_type, r.distance_miles, r.duration_seconds, r.date, r.created_at
    FROM runs r WHERE r.user_id = ?
    ORDER BY r.date DESC, r.created_at DESC
  `),
  getWeekRuns: sqlite.prepare("SELECT COUNT(*) as count FROM runs WHERE user_id = ? AND date >= date('now', '-7 days')"),
  getWeekMiles: sqlite.prepare("SELECT COALESCE(SUM(distance_miles), 0) as total FROM runs WHERE user_id = ? AND date >= date('now', '-7 days')"),
  getPRTimeline: sqlite.prepare(`
    SELECT l.id, l.lift_type, l.weight, l.reps, l.date, l.created_at,
      CASE WHEN l.reps > 1 THEN ROUND(l.weight * (1.0 + l.reps / 30.0)) ELSE l.weight END as e1rm
    FROM lifts l WHERE l.user_id = ? AND l.is_pr = 1
    ORDER BY l.date DESC, l.created_at DESC
  `),
  getAchievementTimeline: sqlite.prepare(`
    SELECT achievement_key, unlocked_at FROM achievements
    WHERE user_id = ? ORDER BY unlocked_at DESC
  `),
}

const leaderboardQuery = sqlite.prepare(`
  SELECT
    u.id, u.email, u.display_name, u.total_goal, u.avatar_color, u.avatar_url, u.bio,
    COALESCE(MAX(CASE WHEN l.lift_type = 'squat' THEN (CASE WHEN l.reps > 1 THEN ROUND(l.weight * (1.0 + l.reps / 30.0)) ELSE l.weight END) END), 0) as squat,
    COALESCE(MAX(CASE WHEN l.lift_type = 'bench' THEN (CASE WHEN l.reps > 1 THEN ROUND(l.weight * (1.0 + l.reps / 30.0)) ELSE l.weight END) END), 0) as bench,
    COALESCE(MAX(CASE WHEN l.lift_type = 'deadlift' THEN (CASE WHEN l.reps > 1 THEN ROUND(l.weight * (1.0 + l.reps / 30.0)) ELSE l.weight END) END), 0) as deadlift,
    (SELECT COUNT(*) FROM achievements a WHERE a.user_id = u.id) as achievement_count,
    COUNT(l.id) as total_lifts,
    COALESCE(SUM(l.weight), 0) as total_weight_lifted,
    (SELECT bw.weight FROM bodyweights bw WHERE bw.user_id = u.id ORDER BY bw.date DESC LIMIT 1) as bodyweight,
    (SELECT COUNT(*) FROM runs r WHERE r.user_id = u.id) as total_runs,
    (SELECT COALESCE(SUM(r.distance_miles), 0) FROM runs r WHERE r.user_id = u.id) as total_run_miles
  FROM users u
  LEFT JOIN lifts l ON l.user_id = u.id
  GROUP BY u.id
  ORDER BY (COALESCE(MAX(CASE WHEN l.lift_type = 'squat' THEN (CASE WHEN l.reps > 1 THEN ROUND(l.weight * (1.0 + l.reps / 30.0)) ELSE l.weight END) END), 0)
          + COALESCE(MAX(CASE WHEN l.lift_type = 'bench' THEN (CASE WHEN l.reps > 1 THEN ROUND(l.weight * (1.0 + l.reps / 30.0)) ELSE l.weight END) END), 0)
          + COALESCE(MAX(CASE WHEN l.lift_type = 'deadlift' THEN (CASE WHEN l.reps > 1 THEN ROUND(l.weight * (1.0 + l.reps / 30.0)) ELSE l.weight END) END), 0)) DESC
`)

const runLeaderboardQuery = sqlite.prepare(`
  SELECT
    u.id, u.display_name, u.avatar_color, u.avatar_url, u.bio,
    COUNT(r.id) as total_runs,
    COALESCE(SUM(r.distance_miles), 0) as total_miles,
    COALESCE(SUM(r.duration_seconds), 0) as total_duration_seconds,
    MIN(CASE WHEN r.distance_miles > 0 THEN CAST(r.duration_seconds AS REAL) / r.distance_miles END) as best_pace,
    MAX(r.distance_miles) as longest_run,
    COALESCE(SUM(CASE WHEN r.date >= date('now', '-7 days') THEN r.distance_miles ELSE 0 END), 0) as weekly_miles
  FROM users u
  LEFT JOIN runs r ON r.user_id = u.id
  GROUP BY u.id
  HAVING total_runs > 0
  ORDER BY total_miles DESC
`)

export const queries = {
  ACHIEVEMENTS,

  ensureUser(email: string) {
    const displayName = email.split('@')[0]
    stmts.insertUser.run(email, displayName)
    const user = stmts.getUserByEmail.get(email) as any
    if (!user.avatar_color) {
      const color = AVATAR_COLORS[user.id % AVATAR_COLORS.length]
      sqlite.prepare('UPDATE users SET avatar_color = ? WHERE id = ?').run(color, user.id)
      user.avatar_color = color
    }
    return user
  },

  getUser(id: number) {
    return stmts.getUserById.get(id)
  },

  getLiftById(id: number) {
    return stmts.getLiftById.get(id) as any
  },

  updateUser(id: number, { display_name, total_goal, squat_goal, bench_goal, deadlift_goal }: any) {
    stmts.updateUser.run(display_name, total_goal, squat_goal || null, bench_goal || null, deadlift_goal || null, id)
    return stmts.getUserById.get(id)
  },

  logLift(userId: number, liftType: string, weight: number, date: string, notes: string | null, mediaFilename: string | null, reps = 1) {
    const e1rm = reps > 1 ? Math.round(weight * (1 + reps / 30)) : weight
    const currentBest = stmts.getMaxWeight.get(userId, liftType) as any
    const isPR = !currentBest.best || e1rm > currentBest.best

    let isSus = false
    if (currentBest.best && e1rm > currentBest.best * 1.2) isSus = true

    const result = stmts.insertLift.run(userId, liftType, weight, reps, date, isPR ? 1 : 0, notes || null, mediaFilename || null) as any

    if (isSus) {
      sqlite.prepare('UPDATE lifts SET is_sus = 1 WHERE id = ?').run(result.lastInsertRowid)
    }

    const newAchievements = this.checkAchievements(userId)
    return { liftId: result.lastInsertRowid, isPR, isSus, newAchievements, e1rm, reps }
  },

  getLifts(userId: number, type: string | null, limit = 50, offset = 0) {
    if (type) return stmts.getLiftsByType.all(userId, type, limit, offset)
    return stmts.getLifts.all(userId, limit, offset)
  },

  deleteLift(liftId: number, userId: number) {
    const lift = stmts.getLiftById.get(liftId) as any
    if (!lift || lift.user_id !== userId) return false
    stmts.deleteLift.run(liftId, userId)
    if (lift.is_pr) {
      stmts.recalcPR.run(userId, lift.lift_type)
      stmts.markNewPR.run(userId, lift.lift_type)
    }
    return true
  },

  getPRs(userId: number): PRs {
    const rows = stmts.getPRs.all(userId) as any[]
    const prs: PRs = { squat: 0, bench: 0, deadlift: 0 }
    for (const row of rows) prs[row.lift_type as keyof PRs] = row.weight
    return prs
  },

  computeDOTS(bodyweightLbs: number | null, totalLbs: number) {
    if (!bodyweightLbs || !totalLbs) return 0
    const bwKg = bodyweightLbs * 0.453592
    const totalKg = totalLbs * 0.453592
    const a = -307.75076, b = 24.0900756, c = -0.1918759221, d = 0.0007391293, e = -0.000001093
    const denom = a + b * bwKg + c * Math.pow(bwKg, 2) + d * Math.pow(bwKg, 3) + e * Math.pow(bwKg, 4)
    if (denom <= 0) return 0
    return Math.round((500 / denom) * totalKg * 10) / 10
  },

  getLeaderboard() {
    const rows = leaderboardQuery.all() as any[]
    return rows.map(r => {
      const total = r.squat + r.bench + r.deadlift
      return { ...r, total, progress: Math.min(100, Math.round((total / r.total_goal) * 100)), dots: this.computeDOTS(r.bodyweight, total) }
    })
  },

  getRunLeaderboard() {
    return runLeaderboardQuery.all()
  },

  setLeaderboardMode(userId: number, mode: string) {
    sqlite.prepare('UPDATE users SET leaderboard_mode = ? WHERE id = ?').run(mode, userId)
  },

  getUnifiedActivity(limit = 20, offset = 0) {
    return stmts.getUnifiedActivity.all(limit, offset)
  },

  getActivityHeatmap(userId: number) {
    return stmts.getActivityHeatmap.all(userId, userId)
  },

  logBodyweight(userId: number, weight: number, date: string) {
    const result = stmts.insertBodyweight.run(userId, weight, date) as any
    return { id: result.lastInsertRowid }
  },

  getBodyweight(userId: number, limit = 30, offset = 0) {
    return stmts.getBodyweight.all(userId, limit, offset)
  },

  deleteBodyweight(id: number, userId: number) {
    const entry = stmts.getBodyweightById.get(id) as any
    if (!entry || entry.user_id !== userId) return false
    stmts.deleteBodyweight.run(id, userId)
    return true
  },

  getLatestBodyweight(userId: number): number | null {
    const row = stmts.getLatestBodyweight.get(userId) as any
    return row ? row.weight : null
  },

  getAchievements(userId: number) {
    return stmts.getAchievements.all(userId)
  },

  getAllAchievementDefs() {
    return ACHIEVEMENTS.map(a => ({ key: a.key, label: a.label, desc: a.desc, icon: a.icon }))
  },

  checkAchievements(userId: number) {
    const prs = this.getPRs(userId)
    const newlyUnlocked: any[] = []
    for (const a of ACHIEVEMENTS) {
      if (a.check(prs)) {
        const result = stmts.insertAchievement.run(userId, a.key) as any
        if (result.changes > 0) newlyUnlocked.push({ key: a.key, label: a.label, desc: a.desc, icon: a.icon })
      }
    }
    return newlyUnlocked
  },

  checkRunAchievements(userId: number) {
    const newlyUnlocked: any[] = []
    const totalMiles = (stmts.getTotalRunMiles.get(userId) as any).total
    const totalRuns = (sqlite.prepare('SELECT COUNT(*) as count FROM runs WHERE user_id = ?').get(userId) as any).count

    const checks = [
      { key: 'first_run', condition: totalRuns >= 1 },
      { key: 'offroad', condition: (stmts.getRunsByType.get(userId, 'trail_run') as any).count > 0 },
      { key: 'first_5k', condition: (stmts.getRunsByType.get(userId, '5k') as any).count > 0 },
      { key: 'first_10k', condition: (stmts.getRunsByType.get(userId, '10k') as any).count > 0 },
      { key: 'first_half', condition: (stmts.getRunsByType.get(userId, 'half_marathon') as any).count > 0 },
      { key: 'first_marathon', condition: (stmts.getRunsByType.get(userId, 'marathon') as any).count > 0 },
      { key: 'miles_100', condition: totalMiles >= 100 },
      { key: 'miles_500', condition: totalMiles >= 500 },
    ]

    for (const { key, condition } of checks) {
      if (condition) {
        const result = stmts.insertAchievement.run(userId, key) as any
        if (result.changes > 0) {
          const def = ACHIEVEMENTS.find(a => a.key === key)
          if (def) newlyUnlocked.push({ key: def.key, label: def.label, desc: def.desc, icon: def.icon })
        }
      }
    }
    return newlyUnlocked
  },

  updateLiftMedia(liftId: number, userId: number, mediaFilename: string) {
    const lift = stmts.getLiftById.get(liftId) as any
    if (!lift || lift.user_id !== userId) return null
    const oldMedia = lift.media_filename
    stmts.updateLiftMedia.run(mediaFilename, liftId, userId)
    return oldMedia
  },

  removeLiftMedia(liftId: number, userId: number) {
    const lift = stmts.getLiftById.get(liftId) as any
    if (!lift || lift.user_id !== userId) return null
    const oldMedia = lift.media_filename
    stmts.removeLiftMedia.run(liftId, userId)
    return oldMedia
  },

  voteLift(liftId: number, userId: number, voteType: number) {
    const lift = stmts.getLiftById.get(liftId) as any
    if (!lift) return null
    if (lift.user_id === userId) return { error: 'self' }
    const existing = stmts.getUserVote.get(liftId, userId) as any
    if (existing && existing.vote_type === voteType) {
      stmts.removeVote.run(liftId, userId)
    } else {
      stmts.upsertVote.run(liftId, userId, voteType)
    }
    const counts = stmts.getVoteCounts.get(liftId) as any
    const newVote = stmts.getUserVote.get(liftId, userId) as any
    return { user_vote: newVote ? newVote.vote_type : 0, vote_count: counts.down_count, hype_count: counts.hype_count }
  },

  getUserVote(liftId: number, userId: number) {
    const row = stmts.getUserVote.get(liftId, userId) as any
    return row ? row.vote_type : 0
  },

  getAllUsers() {
    return stmts.getAllUsers.all()
  },

  updateUserAvatar(userId: number, filename: string) {
    const user = stmts.getUserById.get(userId) as any
    if (!user) return null
    const oldAvatar = user.avatar_url
    stmts.updateUserAvatar.run(filename, userId)
    return oldAvatar
  },

  removeUserAvatar(userId: number) {
    const user = stmts.getUserById.get(userId) as any
    if (!user) return null
    const oldAvatar = user.avatar_url
    stmts.removeUserAvatar.run(userId)
    return oldAvatar
  },

  sendChat(userId: number, message: string) {
    const result = stmts.insertChat.run(userId, message) as any
    return result.lastInsertRowid
  },

  getRecentChat() {
    stmts.purgeOldChat.run()
    return stmts.getRecentChat.all()
  },

  parseMentions(message: string) {
    const users = stmts.getAllUsers.all() as any[]
    const mentioned: number[] = []
    for (const u of users) {
      if (message.includes('@' + u.display_name)) mentioned.push(u.id)
    }
    return mentioned
  },

  reactToLift(liftId: number, userId: number, emoji: string) {
    const existing = stmts.getUserReactions.all(liftId, userId) as any[]
    const hasIt = existing.some(r => r.emoji === emoji)
    if (hasIt) {
      stmts.removeReaction.run(liftId, userId, emoji)
    } else {
      stmts.insertReaction.run(liftId, userId, emoji)
    }
    return this.getLiftReactions(liftId)
  },

  getLiftReactions(liftId: number) {
    const rows = stmts.getReactionCounts.all(liftId) as any[]
    const result: Record<string, number> = {}
    for (const r of rows) result[r.emoji] = r.count
    return result
  },

  getUserLiftReactions(liftId: number, userId: number) {
    return (stmts.getUserReactions.all(liftId, userId) as any[]).map(r => r.emoji)
  },

  getSparkline(userId: number) {
    const rows = stmts.getSparklineData.all(userId) as any[]
    const result: Record<string, number[]> = { squat: [], bench: [], deadlift: [] }
    for (const r of rows) {
      if (result[r.lift_type]) result[r.lift_type].push(r.weight)
    }
    return result
  },

  getHeatmap(userId: number) {
    return stmts.getHeatmapData.all(userId)
  },

  getStreak(userId: number) {
    const rows = stmts.getStreakDatesAll.all(userId, userId) as any[]
    if (rows.length === 0) return 0
    let streak = 0
    const todayStr = new Date().toISOString().split('T')[0]
    const d = new Date(todayStr + 'T00:00:00')
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(d)
      checkDate.setDate(checkDate.getDate() - i)
      const dateStr = checkDate.toISOString().split('T')[0]
      if (rows.some((r: any) => r.date === dateStr)) {
        streak++
      } else {
        if (i === 0) continue
        break
      }
    }
    return streak
  },

  getUserStats(userId: number) {
    const totalLifts = (stmts.getTotalLifts.get(userId) as any).count
    const totalWeight = (stmts.getTotalWeight.get(userId) as any).total
    const weekLifts = (stmts.getWeekLifts.get(userId) as any).count
    const weekSquats = (stmts.getWeekSquats.get(userId) as any).count
    const weekBench = (stmts.getWeekBench.get(userId) as any).count
    const weekDeadlifts = (stmts.getWeekDeadlifts.get(userId) as any).count
    const weekDays = (stmts.getWeekDays.get(userId) as any).count
    const weekPRs = (stmts.getWeekPRs.get(userId) as any).count
    const bestMonth = stmts.getMonthlyLiftCounts.get(userId) as any
    const streak = this.getStreak(userId)
    const achievements = (stmts.countAchievements.get(userId) as any).count

    const runCount = (sqlite.prepare('SELECT COUNT(*) as count FROM runs WHERE user_id = ?').get(userId) as any).count
    const totalMiles = (stmts.getTotalRunMiles.get(userId) as any).total
    const weekRuns = (stmts.getWeekRuns.get(userId) as any).count
    const weekMiles = (stmts.getWeekMiles.get(userId) as any).total

    const xp = (totalLifts * 10) + Math.floor(totalWeight / 100) + (achievements * 50) + (streak * 5)
      + (runCount * 15) + Math.floor(totalMiles * 20)
    let level, tier
    if (xp >= 2000) { level = 6; tier = 'Mythic' }
    else if (xp >= 1000) { level = 5; tier = 'Diamond' }
    else if (xp >= 600) { level = 4; tier = 'Titanium' }
    else if (xp >= 300) { level = 3; tier = 'Steel' }
    else if (xp >= 100) { level = 2; tier = 'Iron' }
    else { level = 1; tier = 'Recruit' }

    return {
      totalLifts, totalWeight, weekLifts, weekSquats, weekBench, weekDeadlifts, weekDays, weekPRs,
      streak, achievements,
      totalRuns: runCount, totalMiles, weekRuns, weekMiles,
      bestMonth: bestMonth ? { month: bestMonth.month, count: bestMonth.count } : null,
      xp, level, tier,
    }
  },

  updateBio(userId: number, bio: string | null) {
    stmts.updateBio.run(bio, userId)
    return stmts.getUserById.get(userId)
  },

  createNotification(userId: number, type: string, title: string, body: string | null, refId: number | null, fromUserId: number | null) {
    const result = stmts.insertNotification.run(userId, type, title, body || null, refId || null, fromUserId || null) as any
    return result.lastInsertRowid
  },

  getNotifications(userId: number, limit = 30, offset = 0) {
    return stmts.getNotifications.all(userId, limit, offset)
  },

  getUnreadCount(userId: number) {
    return (stmts.getUnreadCount.get(userId) as any).count
  },

  markNotificationRead(notifId: number, userId: number) {
    return (stmts.markRead.run(notifId, userId) as any).changes > 0
  },

  markAllNotificationsRead(userId: number) {
    return (stmts.markAllRead.run(userId) as any).changes
  },

  createChallenge(challengerId: number, opponentId: number, type: string, metric: string, target: number | null, startDate: string, endDate: string) {
    const result = stmts.insertChallenge.run(challengerId, opponentId, type, metric, target || null, startDate, endDate) as any
    return result.lastInsertRowid
  },

  getChallenge(id: number) {
    return stmts.getChallengeById.get(id) as any
  },

  getUserChallenges(userId: number, limit = 20, offset = 0) {
    return stmts.getUserChallenges.all(userId, userId, limit, offset)
  },

  respondToChallenge(challengeId: number, userId: number, accept: boolean) {
    const challenge = stmts.getChallengeById.get(challengeId) as any
    if (!challenge || challenge.opponent_id !== userId || challenge.status !== 'pending') return null
    const newStatus = accept ? 'active' : 'declined'
    stmts.updateChallengeStatus.run(newStatus, challengeId)
    return stmts.getChallengeById.get(challengeId) as any
  },

  getChallengeScores(challengeId: number) {
    const c = stmts.getChallengeById.get(challengeId) as any
    if (!c) return null
    const metric = c.metric || 'any'
    const rows = stmts.getChallengeLifts.all(c.challenger_id, c.opponent_id, c.start_date, c.end_date, metric, metric) as any[]
    const scores: Record<number, any> = {}
    scores[c.challenger_id] = { lift_count: 0, total_weight: 0, max_weight: 0 }
    scores[c.opponent_id] = { lift_count: 0, total_weight: 0, max_weight: 0 }
    for (const r of rows) scores[r.user_id] = { lift_count: r.lift_count, total_weight: r.total_weight, max_weight: r.max_weight }
    return scores
  },

  getPRTimeline(userId: number) {
    return stmts.getPRTimeline.all(userId)
  },

  getAchievementTimeline(userId: number) {
    const rows = stmts.getAchievementTimeline.all(userId) as any[]
    return rows.map(r => {
      const def = ACHIEVEMENTS.find(a => a.key === r.achievement_key)
      return { ...r, label: def ? def.label : r.achievement_key, icon: def ? def.icon : '🏅', desc: def ? def.desc : '' }
    })
  },

  logRun(userId: number, activityType: string, distanceMiles: number, durationSeconds: number, date: string, notes: string | null) {
    const result = stmts.insertRun.run(userId, activityType, distanceMiles, durationSeconds, date, notes || null) as any
    const newAchievements = this.checkRunAchievements(userId)
    return { runId: result.lastInsertRowid, newAchievements }
  },

  getRuns(userId: number, limit = 50, offset = 0) {
    return stmts.getRuns.all(userId, limit, offset)
  },

  deleteRun(runId: number, userId: number) {
    const run = stmts.getRunById.get(runId) as any
    if (!run || run.user_id !== userId) return false
    stmts.deleteRunStmt.run(runId, userId)
    return true
  },

  getRunStats(userId: number) {
    return stmts.getRunStats.get(userId)
  },

  getRunTimeline(userId: number) {
    return stmts.getRunTimeline.all(userId)
  },

  getLastLift(userId: number, liftType: string) {
    return sqlite.prepare('SELECT weight, reps, CASE WHEN reps > 1 THEN ROUND(weight * (1.0 + reps / 30.0)) ELSE weight END as e1rm FROM lifts WHERE user_id = ? AND lift_type = ? ORDER BY date DESC, created_at DESC LIMIT 1').get(userId, liftType) || null
  },
}
