/**
 * @learn-center
 * Type definitions for the Education Center / Learning Platform.
 * Separate file per design review — not dumped into index.ts.
 */

import type { DataFlowDef, SkillLevel } from './index';

export type LearnTab = 'tracks' | 'examples';

export interface LearningTrack {
  id: string;
  title: string;
  description: string;
  icon: string;
  skillLevel: SkillLevel;
  prerequisites?: string[];
  lessons: TrackLesson[];
  estimatedMinutes?: number;
  recommendedRoles?: string[];
}

export interface TrackLesson {
  id: string;
  type: 'example' | 'concept';
  exampleId?: string;
  title: string;
  description: string;
  conceptContent?: ConceptContent;
}

export interface ConceptContent {
  sections: ConceptSection[];
  animation?: ConceptAnimationType;
}

export interface ConceptSection {
  heading: string;
  body: string;
  diagram?: DataFlowDef;
}

export type ConceptAnimationType =
  | 'tumble-window' | 'hop-window' | 'session-window' | 'cumulate-window'
  | 'watermark' | 'join-match' | 'state-accumulate'
  | 'kafka-basics' | 'flink-basics' | 'startup-modes'
  | 'consumer-groups' | 'changelog-modes'
  | 'streams-vs-tables' | 'confluent-architecture' | 'schema-governance';

export interface Challenge {
  id: string;
  exampleId: string;
  prompt: string;
  hint?: string;
  expectedBehavior: string;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: (progress: LearnProgress) => boolean;
}

export interface LearnProgress {
  completedExamples: string[];
  completedLessons: string[];
  completedTracks: string[];
  completedChallenges: string[];
  activeRole?: string;
  lastVisitedTrackId?: string;
  badges: string[];
  startedAt: string;
  lastActivityAt: string;
}
