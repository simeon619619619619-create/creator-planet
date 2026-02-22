// =============================================================================
// Student Plus Feature - Barrel Exports
// =============================================================================

// Types
export * from './studentPlusTypes';

// Service
export { studentPlusService, default as studentPlusServiceDefault } from './studentPlusService';

// Hooks
export { useStudentSubscription } from './hooks/useStudentSubscription';
export { useLoyaltyPoints } from './hooks/useLoyaltyPoints';
export { useRewards } from './hooks/useRewards';
export { useMilestones } from './hooks/useMilestones';

// Components
export { StudentPlusPage } from './components/StudentPlusPage';
export { LoyaltyDashboard } from './components/LoyaltyDashboard';
export { RewardsPage } from './components/RewardsPage';
export { MilestoneProgress } from './components/MilestoneProgress';
export { PointsHistory } from './components/PointsHistory';
export { RewardCard } from './components/RewardCard';
export { RedemptionCard } from './components/RedemptionCard';
export { SubscriptionStatus } from './components/SubscriptionStatus';
