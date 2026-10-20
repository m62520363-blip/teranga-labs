export const LEADERBOARD_REWARDS = {
  regional: { 1: 10, 2: 7, 3: 4 },
  country: { 1: 10, 2: 7, 3: 4 },
} as const

export const LEADERBOARD_REWARD_ENABLED = true

export const LEADERBOARD_CONFIG = {
  rewards: LEADERBOARD_REWARDS,
  enabled: LEADERBOARD_REWARD_ENABLED,
  minProjectsToAppear: 2,
} as const

export type LeaderboardRewardTier = keyof typeof LEADERBOARD_REWARDS.regional
