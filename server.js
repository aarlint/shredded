const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// ── WebSocket ──
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(event, data) {
  const msg = JSON.stringify({ event, data });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'data', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer config
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
app.use('/api', (req, res, next) => {
  const email = req.headers['cf-access-authenticated-user-email'] || process.env.DEV_USER_EMAIL;
  if (!email) return res.status(401).json({ error: 'Unauthorized' });
  req.user = db.ensureUser(email);
  next();
});

// --- User routes ---

app.get('/api/me', (req, res) => {
  const prs = db.getPRs(req.user.id);
  const bw = db.getLatestBodyweight(req.user.id);
  res.json({ ...req.user, prs, bodyweight: bw });
});

app.patch('/api/me', (req, res) => {
  const { display_name, total_goal, squat_goal, bench_goal, deadlift_goal, bio } = req.body;
  if (bio !== undefined) {
    const trimmed = typeof bio === 'string' ? bio.slice(0, 160) : '';
    db.updateBio(req.user.id, trimmed || null);
  }
  const updated = db.updateUser(req.user.id, {
    display_name: display_name || req.user.display_name,
    total_goal: total_goal ?? req.user.total_goal,
    squat_goal: squat_goal ?? req.user.squat_goal,
    bench_goal: bench_goal ?? req.user.bench_goal,
    deadlift_goal: deadlift_goal ?? req.user.deadlift_goal,
  });
  res.json(updated);
});

// Profile photo upload
app.post('/api/me/avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const oldAvatar = db.updateUserAvatar(req.user.id, req.file.filename);
  if (oldAvatar) {
    fs.unlink(path.join(UPLOADS_DIR, oldAvatar), () => {});
  }
  const updated = db.ensureUser(req.user.email);
  res.json(updated);
});

app.delete('/api/me/avatar', (req, res) => {
  const oldAvatar = db.removeUserAvatar(req.user.id);
  if (oldAvatar) {
    fs.unlink(path.join(UPLOADS_DIR, oldAvatar), () => {});
  }
  const updated = db.ensureUser(req.user.email);
  res.json(updated);
});

// --- Leaderboard ---

app.get('/api/leaderboard', (req, res) => {
  res.json(db.getLeaderboard());
});

// --- Lift routes ---

app.post('/api/lifts', upload.single('media'), (req, res) => {
  const { lift_type, date, notes } = req.body;
  const weight = parseInt(req.body.weight);
  const reps = parseInt(req.body.reps) || 1;
  if (!lift_type || !weight || !date) {
    return res.status(400).json({ error: 'lift_type, weight, and date are required' });
  }
  if (!['squat', 'bench', 'deadlift'].includes(lift_type)) {
    return res.status(400).json({ error: 'lift_type must be squat, bench, or deadlift' });
  }
  if (isNaN(weight) || weight <= 0) {
    return res.status(400).json({ error: 'weight must be a positive number' });
  }
  if (reps < 1 || reps > 20) {
    return res.status(400).json({ error: 'reps must be between 1 and 20' });
  }

  const mediaFilename = req.file ? req.file.filename : null;
  const result = db.logLift(req.user.id, lift_type, weight, date, notes, mediaFilename, reps);
  broadcast('new_lift', { user_id: req.user.id, display_name: req.user.display_name, lift_type, weight, reps, e1rm: result.e1rm, is_pr: result.isPR, is_sus: result.isSus });
  if (result.newAchievements && result.newAchievements.length > 0) {
    broadcast('achievement', { user_id: req.user.id, display_name: req.user.display_name, achievements: result.newAchievements });
    // Create notifications for achievements
    result.newAchievements.forEach(a => {
      db.createNotification(req.user.id, 'achievement', 'Achievement Unlocked!', `${a.label}: ${a.desc}`, null, null);
    });
  }
  res.json(result);
});

app.get('/api/lifts', (req, res) => {
  const userId = req.query.user_id ? parseInt(req.query.user_id) : req.user.id;
  const type = req.query.type || null;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const lifts = db.getLifts(userId, type, limit, offset);
  const result = lifts.map(l => ({
    ...l,
    user_vote: db.getUserVote(l.id, req.user.id),
    reactions: db.getLiftReactions(l.id),
    user_reactions: db.getUserLiftReactions(l.id, req.user.id),
  }));
  res.json(result);
});

app.delete('/api/lifts/:id', (req, res) => {
  // Get lift info before deleting to clean up media
  const liftId = parseInt(req.params.id);
  const oldMedia = db.removeLiftMedia(liftId, req.user.id);
  if (oldMedia) {
    const filePath = path.join(UPLOADS_DIR, oldMedia);
    fs.unlink(filePath, () => {}); // fire-and-forget
  }
  const deleted = db.deleteLift(liftId, req.user.id);
  if (!deleted) return res.status(404).json({ error: 'Lift not found or not yours' });
  broadcast('delete_lift', { lift_id: liftId, user_id: req.user.id });
  res.json({ ok: true });
});

// Upload media to an existing lift
app.post('/api/lifts/:id/media', upload.single('media'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const liftId = parseInt(req.params.id);
  const oldMedia = db.updateLiftMedia(liftId, req.user.id, req.file.filename);
  if (oldMedia === null) {
    // Lift not found or not theirs — delete the uploaded file
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: 'Lift not found or not yours' });
  }
  // Clean up old media if it existed
  if (oldMedia) {
    fs.unlink(path.join(UPLOADS_DIR, oldMedia), () => {});
  }
  res.json({ ok: true, media_filename: req.file.filename });
});

// Remove media from a lift
app.delete('/api/lifts/:id/media', (req, res) => {
  const liftId = parseInt(req.params.id);
  const oldMedia = db.removeLiftMedia(liftId, req.user.id);
  if (oldMedia === null) return res.status(404).json({ error: 'Lift not found or not yours' });
  if (oldMedia) {
    fs.unlink(path.join(UPLOADS_DIR, oldMedia), () => {});
  }
  res.json({ ok: true });
});

// Vote on a lift (type: 1 = hype/thumbs up, -1 = downvote)
app.post('/api/lifts/:id/vote', (req, res) => {
  const liftId = parseInt(req.params.id);
  const voteType = req.body.vote_type === 1 ? 1 : -1;
  const result = db.voteLift(liftId, req.user.id, voteType);
  if (!result) return res.status(404).json({ error: 'Lift not found' });
  if (result.error === 'self') return res.status(400).json({ error: "Can't vote on your own lift" });
  broadcast('vote', { lift_id: liftId, vote_count: result.vote_count, hype_count: result.hype_count });
  res.json(result);
});

app.get('/api/lifts/prs/:userId?', (req, res) => {
  const userId = req.params.userId ? parseInt(req.params.userId) : req.user.id;
  res.json(db.getPRs(userId));
});

// --- Activity feed ---

app.get('/api/activity', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  const activity = db.getActivity(limit, offset);
  const result = activity.map(a => ({
    ...a,
    user_vote: db.getUserVote(a.id, req.user.id),
    reactions: db.getLiftReactions(a.id),
    user_reactions: db.getUserLiftReactions(a.id, req.user.id),
  }));
  res.json(result);
});

// --- Body weight ---

app.post('/api/bodyweight', (req, res) => {
  const { weight, date } = req.body;
  if (!weight || !date) return res.status(400).json({ error: 'weight and date are required' });
  if (typeof weight !== 'number' || weight <= 0) {
    return res.status(400).json({ error: 'weight must be a positive number' });
  }
  res.json(db.logBodyweight(req.user.id, weight, date));
});

app.get('/api/bodyweight', (req, res) => {
  const userId = req.query.user_id ? parseInt(req.query.user_id) : req.user.id;
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const offset = parseInt(req.query.offset) || 0;
  res.json(db.getBodyweight(userId, limit, offset));
});

app.delete('/api/bodyweight/:id', (req, res) => {
  const deleted = db.deleteBodyweight(parseInt(req.params.id), req.user.id);
  if (!deleted) return res.status(404).json({ error: 'Entry not found or not yours' });
  res.json({ ok: true });
});

// --- Achievements ---

app.get('/api/achievements/defs', (req, res) => {
  res.json(db.getAllAchievementDefs());
});

app.get('/api/achievements/:userId?', (req, res) => {
  const userId = req.params.userId ? parseInt(req.params.userId) : req.user.id;
  res.json(db.getAchievements(userId));
});

// --- Users list (for @mention autocomplete) ---

app.get('/api/users', (req, res) => {
  res.json(db.getAllUsers());
});

// --- Chat ---

app.get('/api/chat', (req, res) => {
  res.json(db.getRecentChat());
});

app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  const trimmed = message.trim().slice(0, 500);
  const id = db.sendChat(req.user.id, trimmed);
  const msg = { id, user_id: req.user.id, display_name: req.user.display_name, message: trimmed, created_at: new Date().toISOString().replace('Z', '').split('.')[0] };
  broadcast('chat', msg);

  // Parse @mentions and broadcast targeted notifications
  const mentionedIds = db.parseMentions(trimmed);
  if (mentionedIds.length > 0) {
    broadcast('mention', { from_user_id: req.user.id, from_display_name: req.user.display_name, mentioned_user_ids: mentionedIds, message: trimmed });
    // Create persistent notifications for mentioned users
    mentionedIds.forEach(uid => {
      db.createNotification(uid, 'mention', `${req.user.display_name} mentioned you`, trimmed.length > 80 ? trimmed.slice(0, 80) + '...' : trimmed, null, req.user.id);
    });
  }

  res.json(msg);
});

// Serve uploaded media files
app.use('/api/uploads', express.static(UPLOADS_DIR));

// --- Stats ---
app.get('/api/stats', (req, res) => {
  res.json(db.getUserStats(req.user.id));
});

// --- Sparkline ---
app.get('/api/lifts/sparkline/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  res.json(db.getSparkline(userId));
});

// --- Heatmap ---
app.get('/api/lifts/heatmap/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  res.json(db.getHeatmap(userId));
});

// --- Emoji Reactions ---
app.post('/api/lifts/:id/react', (req, res) => {
  const liftId = parseInt(req.params.id);
  const { emoji } = req.body;
  const allowed = ['🍆', '🧱', '💦', '🔥'];
  if (!emoji || !allowed.includes(emoji)) {
    return res.status(400).json({ error: 'Invalid emoji' });
  }
  const reactions = db.reactToLift(liftId, req.user.id, emoji);
  broadcast('reaction', { lift_id: liftId, reactions });
  // Notify lift owner about reaction (if not self)
  const liftRow = db.getLiftById(liftId);
  if (liftRow && liftRow.user_id !== req.user.id) {
    db.createNotification(liftRow.user_id, 'reaction', `${req.user.display_name} reacted ${emoji}`, `on your ${liftRow.lift_type} — ${liftRow.weight} lbs`, liftId, req.user.id);
  }
  res.json({ reactions, user_reactions: db.getUserLiftReactions(liftId, req.user.id) });
});

// --- Notifications ---
app.get('/api/notifications', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const offset = parseInt(req.query.offset) || 0;
  const notifications = db.getNotifications(req.user.id, limit, offset);
  const unread = db.getUnreadCount(req.user.id);
  res.json({ notifications, unread });
});

app.get('/api/notifications/unread', (req, res) => {
  res.json({ count: db.getUnreadCount(req.user.id) });
});

app.post('/api/notifications/read/:id', (req, res) => {
  db.markNotificationRead(parseInt(req.params.id), req.user.id);
  res.json({ ok: true });
});

app.post('/api/notifications/read-all', (req, res) => {
  db.markAllNotificationsRead(req.user.id);
  res.json({ ok: true });
});

// --- Challenges ---
app.get('/api/challenges', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const offset = parseInt(req.query.offset) || 0;
  const challenges = db.getUserChallenges(req.user.id, limit, offset);
  // Add scores for active challenges
  const result = challenges.map(c => {
    if (c.status === 'active' || c.status === 'completed') {
      c.scores = db.getChallengeScores(c.id);
    }
    return c;
  });
  res.json(result);
});

app.post('/api/challenges', (req, res) => {
  const { opponent_id, type, metric, target, duration_days } = req.body;
  if (!opponent_id || !type) {
    return res.status(400).json({ error: 'opponent_id and type are required' });
  }
  if (!['most_weight', 'most_lifts', 'highest_single'].includes(type)) {
    return res.status(400).json({ error: 'Invalid challenge type' });
  }
  if (opponent_id === req.user.id) {
    return res.status(400).json({ error: "Can't challenge yourself" });
  }
  const days = Math.min(Math.max(parseInt(duration_days) || 7, 1), 30);
  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
  const id = db.createChallenge(req.user.id, opponent_id, type, metric || 'any', target || null, startDate, endDate);
  // Notify opponent
  db.createNotification(opponent_id, 'challenge', 'New Challenge!', `${req.user.display_name} challenged you!`, id, req.user.id);
  broadcast('challenge', { challenge_id: id, challenger_id: req.user.id, challenger_name: req.user.display_name, opponent_id, type });
  res.json({ id, status: 'pending' });
});

app.post('/api/challenges/:id/respond', (req, res) => {
  const challengeId = parseInt(req.params.id);
  const { accept } = req.body;
  const result = db.respondToChallenge(challengeId, req.user.id, accept);
  if (!result) return res.status(404).json({ error: 'Challenge not found or not yours' });
  if (accept) {
    // Notify challenger
    db.createNotification(result.challenger_id, 'challenge', 'Challenge Accepted!', `${req.user.display_name} accepted your challenge!`, challengeId, req.user.id);
    broadcast('challenge_accepted', { challenge_id: challengeId });
  }
  res.json(result);
});

app.get('/api/challenges/:id/scores', (req, res) => {
  const scores = db.getChallengeScores(parseInt(req.params.id));
  if (!scores) return res.status(404).json({ error: 'Challenge not found' });
  res.json(scores);
});

// --- PR Timeline ---
app.get('/api/timeline/:userId?', (req, res) => {
  const userId = req.params.userId ? parseInt(req.params.userId) : req.user.id;
  const prs = db.getPRTimeline(userId);
  const achievements = db.getAchievementTimeline(userId);
  res.json({ prs, achievements });
});

// --- Last lift (for smart suggestions) ---
app.get('/api/lifts/last/:type', (req, res) => {
  const type = req.params.type;
  if (!['squat', 'bench', 'deadlift'].includes(type)) {
    return res.status(400).json({ error: 'Invalid lift type' });
  }
  const last = db.getLastLift(req.user.id, type);
  const prs = db.getPRs(req.user.id);
  res.json({ last, pr: prs[type] || 0 });
});

// --- DOTS ---
app.get('/api/dots', (req, res) => {
  const bw = db.getLatestBodyweight(req.user.id);
  const prs = db.getPRs(req.user.id);
  const total = (prs.squat || 0) + (prs.bench || 0) + (prs.deadlift || 0);
  const dots = db.computeDOTS(bw, total);
  res.json({ dots, bodyweight: bw, total });
});

// Serve manifest and SW from public
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => console.log(`1000LB CLUB running on :${PORT}`));
