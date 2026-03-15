import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { createBunWebSocket } from 'hono/bun'
import type { ServerWebSocket } from 'bun'
import { mkdirSync } from 'node:fs'
import { queries } from './queries'

// Ensure uploads dir exists
mkdirSync('./data/uploads', { recursive: true })

const PORT = parseInt(process.env.PORT || '3000')

type Variables = { user: any }

const app = new Hono<{ Variables: Variables }>()

// ── WebSocket setup ──
const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>()
const wsClients = new Set<any>()

export function broadcast(event: string, data: any) {
  const msg = JSON.stringify({ event, data })
  for (const ws of wsClients) {
    try { ws.send(msg) } catch {}
  }
}

app.get('/ws', upgradeWebSocket(() => ({
  onOpen(_evt, ws) { wsClients.add(ws.raw) },
  onClose(_evt, ws) { wsClients.delete(ws.raw) },
  onMessage() {},
})))

// ── Middleware ──
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/*', cors())
}

// Auth
app.use('/api/*', async (c, next) => {
  const email = c.req.header('cf-access-authenticated-user-email') || process.env.DEV_USER_EMAIL || 'local@dev'
  const user = queries.ensureUser(email)
  c.set('user', user)
  await next()
})

// ── Routes ──

// Me
app.get('/api/me', (c) => {
  const user = c.get('user')
  const prs = queries.getPRs(user.id)
  const bw = queries.getLatestBodyweight(user.id)
  return c.json({ ...user, prs, bodyweight: bw })
})

app.patch('/api/me', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { display_name, total_goal, squat_goal, bench_goal, deadlift_goal, bio } = body
  if (bio !== undefined) {
    const trimmed = typeof bio === 'string' ? bio.slice(0, 160) : ''
    queries.updateBio(user.id, trimmed || null)
  }
  const updated = queries.updateUser(user.id, {
    display_name: display_name || user.display_name,
    total_goal: total_goal ?? user.total_goal,
    squat_goal: squat_goal ?? user.squat_goal,
    bench_goal: bench_goal ?? user.bench_goal,
    deadlift_goal: deadlift_goal ?? user.deadlift_goal,
  })
  return c.json(updated)
})

// Avatar upload
app.post('/api/me/avatar', async (c) => {
  const user = c.get('user')
  const body = await c.req.parseBody()
  const file = body['avatar'] as File | undefined
  if (!file) return c.json({ error: 'No file uploaded' }, 400)
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    return c.json({ error: 'Only image and video files are allowed' }, 400)
  }
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop()!.toLowerCase() : '.bin'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
  await Bun.write(`./data/uploads/${filename}`, file)
  const oldAvatar = queries.updateUserAvatar(user.id, filename)
  if (oldAvatar) {
    try { await Bun.file(`./data/uploads/${oldAvatar}`).exists() && require('node:fs').unlinkSync(`./data/uploads/${oldAvatar}`) } catch {}
  }
  const updated = queries.ensureUser(user.email)
  return c.json(updated)
})

app.delete('/api/me/avatar', (c) => {
  const user = c.get('user')
  const oldAvatar = queries.removeUserAvatar(user.id)
  if (oldAvatar) {
    try { require('node:fs').unlinkSync(`./data/uploads/${oldAvatar}`) } catch {}
  }
  const updated = queries.ensureUser(user.email)
  return c.json(updated)
})

// Leaderboard
app.get('/api/leaderboard', (c) => c.json(queries.getLeaderboard()))
app.get('/api/leaderboard/runs', (c) => c.json(queries.getRunLeaderboard()))

app.patch('/api/me/leaderboard-mode', async (c) => {
  const user = c.get('user')
  const { mode } = await c.req.json()
  if (!mode || !['lift', 'run'].includes(mode)) return c.json({ error: 'mode must be "lift" or "run"' }, 400)
  queries.setLeaderboardMode(user.id, mode)
  return c.json({ ok: true, mode })
})

// Lifts — note: /prs, /last/:type, /sparkline/:userId, /heatmap/:userId must come before /:id
app.get('/api/lifts/prs/:userId?', (c) => {
  const user = c.get('user')
  const userId = c.req.param('userId') ? parseInt(c.req.param('userId')!) : user.id
  return c.json(queries.getPRs(userId))
})

app.get('/api/lifts/last/:type', (c) => {
  const user = c.get('user')
  const type = c.req.param('type')
  if (!['squat', 'bench', 'deadlift'].includes(type)) return c.json({ error: 'Invalid lift type' }, 400)
  const last = queries.getLastLift(user.id, type)
  const prs = queries.getPRs(user.id)
  return c.json({ last, pr: prs[type as keyof typeof prs] || 0 })
})

app.get('/api/lifts/sparkline/:userId', (c) => {
  const userId = parseInt(c.req.param('userId'))
  return c.json(queries.getSparkline(userId))
})

app.get('/api/lifts/heatmap/:userId', (c) => {
  const userId = parseInt(c.req.param('userId'))
  return c.json(queries.getHeatmap(userId))
})

app.post('/api/lifts', async (c) => {
  const user = c.get('user')
  let body: any
  const ct = c.req.header('content-type') || ''
  if (ct.includes('multipart/form-data')) {
    const formData = await c.req.parseBody()
    body = formData
  } else {
    body = await c.req.json()
  }

  const { lift_type, date, notes } = body
  const weight = parseInt(body.weight as string)
  const reps = parseInt(body.reps as string) || 1
  if (!lift_type || !weight || !date) return c.json({ error: 'lift_type, weight, and date are required' }, 400)
  if (!['squat', 'bench', 'deadlift'].includes(lift_type as string)) return c.json({ error: 'lift_type must be squat, bench, or deadlift' }, 400)
  if (isNaN(weight) || weight <= 0) return c.json({ error: 'weight must be a positive number' }, 400)
  if (reps < 1 || reps > 20) return c.json({ error: 'reps must be between 1 and 20' }, 400)

  let mediaFilename: string | null = null
  const file = body['media'] as File | undefined
  if (file && file instanceof File) {
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop()!.toLowerCase() : '.bin'
    mediaFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
    await Bun.write(`./data/uploads/${mediaFilename}`, file)
  }

  const result = queries.logLift(user.id, lift_type as string, weight, date as string, notes as string || null, mediaFilename, reps)
  broadcast('new_lift', { user_id: user.id, display_name: user.display_name, lift_type, weight, reps, e1rm: result.e1rm, is_pr: result.isPR, is_sus: result.isSus })
  if (result.newAchievements?.length > 0) {
    broadcast('achievement', { user_id: user.id, display_name: user.display_name, achievements: result.newAchievements })
    result.newAchievements.forEach((a: any) => {
      queries.createNotification(user.id, 'achievement', 'Achievement Unlocked!', `${a.label}: ${a.desc}`, null, null)
    })
  }
  return c.json(result)
})

app.get('/api/lifts', (c) => {
  const user = c.get('user')
  const userId = c.req.query('user_id') ? parseInt(c.req.query('user_id')!) : user.id
  const type = c.req.query('type') || null
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)
  const offset = parseInt(c.req.query('offset') || '0')
  const lifts = queries.getLifts(userId, type, limit, offset)
  const result = (lifts as any[]).map(l => ({
    ...l,
    user_vote: queries.getUserVote(l.id, user.id),
    reactions: queries.getLiftReactions(l.id),
    user_reactions: queries.getUserLiftReactions(l.id, user.id),
  }))
  return c.json(result)
})

app.delete('/api/lifts/:id/media', (c) => {
  const user = c.get('user')
  const liftId = parseInt(c.req.param('id'))
  const oldMedia = queries.removeLiftMedia(liftId, user.id)
  if (oldMedia === null) return c.json({ error: 'Lift not found or not yours' }, 404)
  if (oldMedia) {
    try { require('node:fs').unlinkSync(`./data/uploads/${oldMedia}`) } catch {}
  }
  return c.json({ ok: true })
})

app.post('/api/lifts/:id/media', async (c) => {
  const user = c.get('user')
  const liftId = parseInt(c.req.param('id'))
  const formData = await c.req.parseBody()
  const file = formData['media'] as File | undefined
  if (!file) return c.json({ error: 'No file uploaded' }, 400)
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop()!.toLowerCase() : '.bin'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
  await Bun.write(`./data/uploads/${filename}`, file)
  const oldMedia = queries.updateLiftMedia(liftId, user.id, filename)
  if (oldMedia === null) {
    try { require('node:fs').unlinkSync(`./data/uploads/${filename}`) } catch {}
    return c.json({ error: 'Lift not found or not yours' }, 404)
  }
  if (oldMedia) {
    try { require('node:fs').unlinkSync(`./data/uploads/${oldMedia}`) } catch {}
  }
  return c.json({ ok: true, media_filename: filename })
})

app.delete('/api/lifts/:id', (c) => {
  const user = c.get('user')
  const liftId = parseInt(c.req.param('id'))
  const oldMedia = queries.removeLiftMedia(liftId, user.id)
  if (oldMedia) {
    try { require('node:fs').unlinkSync(`./data/uploads/${oldMedia}`) } catch {}
  }
  const deleted = queries.deleteLift(liftId, user.id)
  if (!deleted) return c.json({ error: 'Lift not found or not yours' }, 404)
  broadcast('delete_lift', { lift_id: liftId, user_id: user.id })
  return c.json({ ok: true })
})

app.post('/api/lifts/:id/vote', async (c) => {
  const user = c.get('user')
  const liftId = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const voteType = body.vote_type === 1 ? 1 : -1
  const result = queries.voteLift(liftId, user.id, voteType)
  if (!result) return c.json({ error: 'Lift not found' }, 404)
  if ((result as any).error === 'self') return c.json({ error: "Can't vote on your own lift" }, 400)
  broadcast('vote', { lift_id: liftId, vote_count: (result as any).vote_count, hype_count: (result as any).hype_count })
  return c.json(result)
})

app.post('/api/lifts/:id/react', async (c) => {
  const user = c.get('user')
  const liftId = parseInt(c.req.param('id'))
  const { emoji } = await c.req.json()
  const allowed = ['🍆', '🧱', '💦', '🔥']
  if (!emoji || !allowed.includes(emoji)) return c.json({ error: 'Invalid emoji' }, 400)
  const reactions = queries.reactToLift(liftId, user.id, emoji)
  broadcast('reaction', { lift_id: liftId, reactions })
  const liftRow = queries.getLiftById(liftId)
  if (liftRow && liftRow.user_id !== user.id) {
    queries.createNotification(liftRow.user_id, 'reaction', `${user.display_name} reacted ${emoji}`, `on your ${liftRow.lift_type} — ${liftRow.weight} lbs`, liftId, user.id)
  }
  return c.json({ reactions, user_reactions: queries.getUserLiftReactions(liftId, user.id) })
})

// Activity feed
app.get('/api/activity', (c) => {
  const user = c.get('user')
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
  const offset = parseInt(c.req.query('offset') || '0')
  const activity = queries.getUnifiedActivity(limit, offset)
  const result = (activity as any[]).map(a => {
    if (a.type === 'lift') {
      return { ...a, user_vote: queries.getUserVote(a.id, user.id), reactions: queries.getLiftReactions(a.id), user_reactions: queries.getUserLiftReactions(a.id, user.id) }
    }
    return a
  })
  return c.json(result)
})

// Bodyweight
app.post('/api/bodyweight', async (c) => {
  const user = c.get('user')
  const { weight, date } = await c.req.json()
  if (!weight || !date) return c.json({ error: 'weight and date are required' }, 400)
  if (typeof weight !== 'number' || weight <= 0) return c.json({ error: 'weight must be a positive number' }, 400)
  return c.json(queries.logBodyweight(user.id, weight, date))
})

app.get('/api/bodyweight', (c) => {
  const user = c.get('user')
  const userId = c.req.query('user_id') ? parseInt(c.req.query('user_id')!) : user.id
  const limit = Math.min(parseInt(c.req.query('limit') || '30'), 100)
  const offset = parseInt(c.req.query('offset') || '0')
  return c.json(queries.getBodyweight(userId, limit, offset))
})

app.delete('/api/bodyweight/:id', (c) => {
  const user = c.get('user')
  const deleted = queries.deleteBodyweight(parseInt(c.req.param('id')), user.id)
  if (!deleted) return c.json({ error: 'Entry not found or not yours' }, 404)
  return c.json({ ok: true })
})

// Achievements
app.get('/api/achievements/defs', (c) => c.json(queries.getAllAchievementDefs()))
app.get('/api/achievements/:userId?', (c) => {
  const user = c.get('user')
  const userId = c.req.param('userId') ? parseInt(c.req.param('userId')!) : user.id
  return c.json(queries.getAchievements(userId))
})

// Users
app.get('/api/users', (c) => c.json(queries.getAllUsers()))

// Chat
app.get('/api/chat', (c) => c.json(queries.getRecentChat()))
app.post('/api/chat', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { message } = body
  if (!message || typeof message !== 'string' || !message.trim()) return c.json({ error: 'message is required' }, 400)
  const trimmed = message.trim().slice(0, 500)
  const id = queries.sendChat(user.id, trimmed)
  const msg = { id, user_id: user.id, display_name: user.display_name, message: trimmed, created_at: new Date().toISOString().replace('Z', '').split('.')[0] }
  broadcast('chat', msg)
  const mentionedIds = queries.parseMentions(trimmed)
  if (mentionedIds.length > 0) {
    broadcast('mention', { from_user_id: user.id, from_display_name: user.display_name, mentioned_user_ids: mentionedIds, message: trimmed })
    mentionedIds.forEach(uid => {
      queries.createNotification(uid, 'mention', `${user.display_name} mentioned you`, trimmed.length > 80 ? trimmed.slice(0, 80) + '...' : trimmed, null, user.id)
    })
  }
  return c.json(msg)
})

// Runs — /stats must come before /:id
app.get('/api/runs/stats', (c) => {
  const user = c.get('user')
  const userId = c.req.query('user_id') ? parseInt(c.req.query('user_id')!) : user.id
  return c.json(queries.getRunStats(userId))
})

app.post('/api/runs', async (c) => {
  const user = c.get('user')
  const { activity_type, distance_miles, duration_seconds, date, notes } = await c.req.json()
  if (!activity_type || !distance_miles || !duration_seconds || !date) return c.json({ error: 'activity_type, distance_miles, duration_seconds, and date are required' }, 400)
  if (!['run', '5k', '10k', 'half_marathon', 'marathon'].includes(activity_type)) return c.json({ error: 'Invalid activity type' }, 400)
  if (typeof distance_miles !== 'number' || distance_miles <= 0) return c.json({ error: 'distance_miles must be a positive number' }, 400)
  if (typeof duration_seconds !== 'number' || duration_seconds <= 0) return c.json({ error: 'duration_seconds must be a positive number' }, 400)
  const result = queries.logRun(user.id, activity_type, distance_miles, duration_seconds, date, notes)
  broadcast('new_run', { user_id: user.id, display_name: user.display_name, activity_type, distance_miles, duration_seconds })
  if (result.newAchievements?.length > 0) {
    broadcast('achievement', { user_id: user.id, display_name: user.display_name, achievements: result.newAchievements })
    result.newAchievements.forEach((a: any) => {
      queries.createNotification(user.id, 'achievement', 'Achievement Unlocked!', `${a.label}: ${a.desc}`, null, null)
    })
  }
  return c.json(result)
})

app.get('/api/runs', (c) => {
  const user = c.get('user')
  const userId = c.req.query('user_id') ? parseInt(c.req.query('user_id')!) : user.id
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)
  const offset = parseInt(c.req.query('offset') || '0')
  return c.json(queries.getRuns(userId, limit, offset))
})

app.delete('/api/runs/:id', (c) => {
  const user = c.get('user')
  const runId = parseInt(c.req.param('id'))
  const deleted = queries.deleteRun(runId, user.id)
  if (!deleted) return c.json({ error: 'Run not found or not yours' }, 404)
  broadcast('delete_run', { run_id: runId, user_id: user.id })
  return c.json({ ok: true })
})

// Stats / DOTS / Heatmap / Timeline
app.get('/api/stats', (c) => c.json(queries.getUserStats(c.get('user').id)))

app.get('/api/heatmap/:userId', (c) => {
  const userId = parseInt(c.req.param('userId'))
  return c.json(queries.getActivityHeatmap(userId))
})

app.get('/api/dots', (c) => {
  const user = c.get('user')
  const bw = queries.getLatestBodyweight(user.id)
  const prs = queries.getPRs(user.id)
  const total = (prs.squat || 0) + (prs.bench || 0) + (prs.deadlift || 0)
  const dots = queries.computeDOTS(bw, total)
  return c.json({ dots, bodyweight: bw, total })
})

app.get('/api/timeline/:userId?', (c) => {
  const user = c.get('user')
  const userId = c.req.param('userId') ? parseInt(c.req.param('userId')!) : user.id
  return c.json({ prs: queries.getPRTimeline(userId), achievements: queries.getAchievementTimeline(userId), runs: queries.getRunTimeline(userId) })
})

// Notifications
app.get('/api/notifications/unread', (c) => c.json({ count: queries.getUnreadCount(c.get('user').id) }))

app.get('/api/notifications', (c) => {
  const user = c.get('user')
  const limit = Math.min(parseInt(c.req.query('limit') || '30'), 100)
  const offset = parseInt(c.req.query('offset') || '0')
  const notifications = queries.getNotifications(user.id, limit, offset)
  const unread = queries.getUnreadCount(user.id)
  return c.json({ notifications, unread })
})

app.post('/api/notifications/read-all', (c) => {
  queries.markAllNotificationsRead(c.get('user').id)
  return c.json({ ok: true })
})

app.post('/api/notifications/read/:id', (c) => {
  queries.markNotificationRead(parseInt(c.req.param('id')), c.get('user').id)
  return c.json({ ok: true })
})

// Challenges
app.get('/api/challenges', (c) => {
  const user = c.get('user')
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50)
  const offset = parseInt(c.req.query('offset') || '0')
  const challenges = queries.getUserChallenges(user.id, limit, offset)
  const result = (challenges as any[]).map(ch => {
    if (ch.status === 'active' || ch.status === 'completed') ch.scores = queries.getChallengeScores(ch.id)
    return ch
  })
  return c.json(result)
})

app.post('/api/challenges', async (c) => {
  const user = c.get('user')
  const { opponent_id, type, metric, target, duration_days } = await c.req.json()
  if (!opponent_id || !type) return c.json({ error: 'opponent_id and type are required' }, 400)
  if (!['most_weight', 'most_lifts', 'highest_single'].includes(type)) return c.json({ error: 'Invalid challenge type' }, 400)
  if (opponent_id === user.id) return c.json({ error: "Can't challenge yourself" }, 400)
  const days = Math.min(Math.max(parseInt(duration_days) || 7, 1), 30)
  const startDate = new Date().toISOString().split('T')[0]
  const endDate = new Date(Date.now() + days * 86400000).toISOString().split('T')[0]
  const id = queries.createChallenge(user.id, opponent_id, type, metric || 'any', target || null, startDate, endDate)
  queries.createNotification(opponent_id, 'challenge', 'New Challenge!', `${user.display_name} challenged you!`, id, user.id)
  broadcast('challenge', { challenge_id: id, challenger_id: user.id, challenger_name: user.display_name, opponent_id, type })
  return c.json({ id, status: 'pending' })
})

app.post('/api/challenges/:id/respond', async (c) => {
  const user = c.get('user')
  const challengeId = parseInt(c.req.param('id'))
  const { accept } = await c.req.json()
  const result = queries.respondToChallenge(challengeId, user.id, accept)
  if (!result) return c.json({ error: 'Challenge not found or not yours' }, 404)
  if (accept) {
    queries.createNotification(result.challenger_id, 'challenge', 'Challenge Accepted!', `${user.display_name} accepted your challenge!`, challengeId, user.id)
    broadcast('challenge_accepted', { challenge_id: challengeId })
  }
  return c.json(result)
})

app.get('/api/challenges/:id/scores', (c) => {
  const scores = queries.getChallengeScores(parseInt(c.req.param('id')))
  if (!scores) return c.json({ error: 'Challenge not found' }, 404)
  return c.json(scores)
})

// Serve uploaded files
app.use('/api/uploads/*', serveStatic({ root: './data' }))

// Static frontend
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

export default {
  port: PORT,
  fetch: app.fetch,
  websocket,
}
