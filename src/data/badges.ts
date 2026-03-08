import type { Badge, LearnProgress } from '../types/learn';

export const badges: Badge[] = [
  {
    id: 'first-query',
    title: 'First Query',
    description: 'Complete your first example and run your first Flink SQL query.',
    icon: 'zap',
    condition: (progress: LearnProgress) => progress.completedExamples.length >= 1,
  },
  {
    id: 'track-starter',
    title: 'Track Starter',
    description: 'Complete an entire learning track from start to finish.',
    icon: 'flag',
    condition: (progress: LearnProgress) => progress.completedTracks.length >= 1,
  },
  {
    id: 'window-master',
    title: 'Window Master',
    description: 'Complete the Windowing & Time track and master all window types.',
    icon: 'clock',
    condition: (progress: LearnProgress) =>
      progress.completedTracks.includes('windowing-time'),
  },
  {
    id: 'join-guru',
    title: 'Join Guru',
    description: 'Complete the Joins & Enrichment track and master every join type.',
    icon: 'git-merge',
    condition: (progress: LearnProgress) =>
      progress.completedTracks.includes('joins-enrichment'),
  },
  {
    id: 'state-keeper',
    title: 'State Keeper',
    description:
      'Complete the Stateful Processing track and conquer advanced state patterns.',
    icon: 'layers',
    condition: (progress: LearnProgress) =>
      progress.completedTracks.includes('stateful-processing'),
  },
  {
    id: 'view-builder',
    title: 'View Builder',
    description:
      'Complete the Views & Architecture track and build production-ready streaming views.',
    icon: 'layout',
    condition: (progress: LearnProgress) =>
      progress.completedTracks.includes('views-architecture'),
  },
  {
    id: 'challenge-accepted',
    title: 'Challenge Accepted',
    description: 'Complete 10 challenges and prove your Flink SQL skills.',
    icon: 'award',
    condition: (progress: LearnProgress) =>
      progress.completedChallenges.length >= 10,
  },
  {
    id: 'completionist',
    title: 'Completionist',
    description: 'Complete all 46 examples across every learning track.',
    icon: 'star',
    condition: (progress: LearnProgress) =>
      progress.completedExamples.length >= 46,
  },
  {
    id: 'speed-runner',
    title: 'Speed Runner',
    description: 'Complete 3 or more examples in a single session.',
    icon: 'fast-forward',
    condition: (progress: LearnProgress) =>
      progress.completedExamples.length >= 3,
  },
  {
    id: 'kafka-native',
    title: 'Kafka Native',
    description: 'Complete the Kafka Fundamentals track and understand the streaming backbone.',
    icon: 'database',
    condition: (progress: LearnProgress) =>
      progress.completedTracks.includes('kafka-fundamentals'),
  },
];
