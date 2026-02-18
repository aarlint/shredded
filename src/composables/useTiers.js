export const TIER_THRESHOLDS = [
  { min: 2000, tier: 'Mythic', icon: 'Crown', cls: 'tier-mythic' },
  { min: 1000, tier: 'Diamond', icon: 'Gem', cls: 'tier-diamond' },
  { min: 600, tier: 'Titanium', icon: 'Zap', cls: 'tier-titanium' },
  { min: 300, tier: 'Steel', icon: 'Wrench', cls: 'tier-steel' },
  { min: 100, tier: 'Iron', icon: 'Mountain', cls: 'tier-iron' },
  { min: 0, tier: 'Recruit', icon: 'Tag', cls: 'tier-recruit' },
]

export function computeXP(u) {
  const totalLifts = u.total_lifts || 0
  const totalWeight = u.total_weight_lifted || 0
  const achievements = u.achievement_count || 0
  return totalLifts * 10 + Math.floor(totalWeight / 100) + achievements * 50
}

export function getTier(xp) {
  for (const t of TIER_THRESHOLDS) {
    if (xp >= t.min) return t
  }
  return TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1]
}

export function xpToNextTier(xp) {
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp < TIER_THRESHOLDS[i].min) {
      const prev =
        i < TIER_THRESHOLDS.length - 1 ? TIER_THRESHOLDS[i + 1].min : 0
      return {
        next: TIER_THRESHOLDS[i].min,
        prev,
        pct: Math.min(
          100,
          Math.round(
            ((xp - prev) / (TIER_THRESHOLDS[i].min - prev)) * 100
          )
        ),
      }
    }
  }
  return { next: null, prev: 2000, pct: 100 }
}

export const WEEKLY_CHALLENGES = [
  {
    desc: 'Log 3 squat sessions this week',
    check: (s) => ({
      current: Math.min(3, s.weekSquats || 0),
      target: 3,
    }),
  },
  {
    desc: 'Log 5 lifts this week',
    check: (s) => ({
      current: Math.min(5, s.weekLifts || 0),
      target: 5,
    }),
  },
  {
    desc: 'Hit a new personal record',
    check: (s) => ({ current: s.weekPRs ? 1 : 0, target: 1 }),
  },
  {
    desc: 'Log 3 bench sessions this week',
    check: (s) => ({
      current: Math.min(3, s.weekBench || 0),
      target: 3,
    }),
  },
  {
    desc: 'Log at least 1 lift every day (3 days)',
    check: (s) => ({
      current: Math.min(3, s.weekDays || 0),
      target: 3,
    }),
  },
  {
    desc: 'Log 3 deadlift sessions this week',
    check: (s) => ({
      current: Math.min(3, s.weekDeadlifts || 0),
      target: 3,
    }),
  },
  {
    desc: 'Log 4 lifts this week',
    check: (s) => ({
      current: Math.min(4, s.weekLifts || 0),
      target: 4,
    }),
  },
]

export function getWeeklyChallenge() {
  const weekNum = Math.floor((Date.now() / 1000 / 60 / 60 / 24 + 3) / 7)
  return WEEKLY_CHALLENGES[weekNum % WEEKLY_CHALLENGES.length]
}
