/**
 * @learn-center
 * Independent Zustand store for Education Center progress tracking.
 * Separate from workspaceStore per design review decision.
 * Uses its own persist middleware with 'flafka-learn-progress' localStorage key.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LearnTab, LearnProgress } from '../types/learn';
import { badges } from '../data/badges';
import { learningTracks } from '../data/learningTracks';

interface LearnState {
  // Navigation
  learnTab: LearnTab;
  selectedTrackId: string | null;
  selectedConceptId: string | null;
  /** Lesson ID within the active track — set when navigating to an example from a track */
  currentLessonId: string | null;

  // Progress
  progress: LearnProgress;

  // Actions
  setLearnTab: (tab: LearnTab) => void;
  navigateToTrackDetail: (trackId: string | null) => void;
  navigateToConceptLesson: (conceptId: string | null) => void;
  setCurrentLesson: (lessonId: string | null) => void;
  markExampleComplete: (id: string) => void;
  markLessonComplete: (id: string) => void;
  markChallengeComplete: (id: string) => void;
  checkAndAwardBadges: () => string[];
  setActiveRole: (roleId: string) => void;
  resetProgress: () => void;
  isTrackComplete: (trackId: string) => boolean;
  isLessonComplete: (lessonId: string) => boolean;
  isExampleComplete: (exampleId: string) => boolean;
  getTrackProgress: (trackId: string) => { completed: number; total: number; percent: number };
}

const EMPTY_PROGRESS: LearnProgress = {
  completedExamples: [],
  completedLessons: [],
  completedTracks: [],
  completedChallenges: [],
  activeRole: undefined,
  lastVisitedTrackId: undefined,
  badges: [],
  startedAt: new Date().toISOString(),
  lastActivityAt: new Date().toISOString(),
};

export const useLearnStore = create<LearnState>()(
  persist(
    (set, get) => ({
      learnTab: 'examples',
      selectedTrackId: null,
      selectedConceptId: null,
      currentLessonId: null,
      progress: { ...EMPTY_PROGRESS },

      setLearnTab: (tab) => set({ learnTab: tab }),

      navigateToTrackDetail: (trackId) => {
        set({ selectedTrackId: trackId, selectedConceptId: null, ...(trackId ? { learnTab: 'tracks' as LearnTab } : {}) });
        if (trackId) {
          set((state) => ({
            progress: {
              ...state.progress,
              lastVisitedTrackId: trackId,
              lastActivityAt: new Date().toISOString(),
            },
          }));
        }
      },

      navigateToConceptLesson: (conceptId) => set({ selectedConceptId: conceptId }),
      setCurrentLesson: (lessonId) => set({ currentLessonId: lessonId }),

      markExampleComplete: (id) => {
        set((state) => {
          if (state.progress.completedExamples.includes(id)) return state;
          const updatedProgress = {
            ...state.progress,
            completedExamples: [...state.progress.completedExamples, id],
            lastActivityAt: new Date().toISOString(),
          };
          return { progress: updatedProgress };
        });
        // Also mark any track lesson that references this example
        for (const track of learningTracks) {
          for (const lesson of track.lessons) {
            if (lesson.type === 'example' && lesson.exampleId === id) {
              get().markLessonComplete(lesson.id);
            }
          }
        }
        get().checkAndAwardBadges();
      },

      markLessonComplete: (id) => {
        set((state) => {
          if (state.progress.completedLessons.includes(id)) return state;
          const updatedProgress = {
            ...state.progress,
            completedLessons: [...state.progress.completedLessons, id],
            lastActivityAt: new Date().toISOString(),
          };
          return { progress: updatedProgress };
        });
        // Check if track is now complete
        const { progress } = get();
        for (const track of learningTracks) {
          const allLessonsComplete = track.lessons.every(
            (lesson) => progress.completedLessons.includes(lesson.id)
          );
          if (allLessonsComplete && !progress.completedTracks.includes(track.id)) {
            set((state) => ({
              progress: {
                ...state.progress,
                completedTracks: [...state.progress.completedTracks, track.id],
              },
            }));
          }
        }
        get().checkAndAwardBadges();
      },

      markChallengeComplete: (id) => {
        set((state) => {
          if (state.progress.completedChallenges.includes(id)) return state;
          return {
            progress: {
              ...state.progress,
              completedChallenges: [...state.progress.completedChallenges, id],
              lastActivityAt: new Date().toISOString(),
            },
          };
        });
        get().checkAndAwardBadges();
      },

      checkAndAwardBadges: () => {
        const { progress } = get();
        const newBadges: string[] = [];
        for (const badge of badges) {
          if (!progress.badges.includes(badge.id) && badge.condition(progress)) {
            newBadges.push(badge.id);
          }
        }
        if (newBadges.length > 0) {
          set((state) => ({
            progress: {
              ...state.progress,
              badges: [...state.progress.badges, ...newBadges],
            },
          }));
        }
        return newBadges;
      },

      setActiveRole: (roleId) => {
        set((state) => ({
          progress: { ...state.progress, activeRole: roleId },
        }));
      },

      resetProgress: () => {
        set({
          progress: {
            ...EMPTY_PROGRESS,
            startedAt: new Date().toISOString(),
            lastActivityAt: new Date().toISOString(),
          },
          selectedTrackId: null,
          selectedConceptId: null,
        });
      },

      isTrackComplete: (trackId) => {
        return get().progress.completedTracks.includes(trackId);
      },

      isLessonComplete: (lessonId) => {
        return get().progress.completedLessons.includes(lessonId);
      },

      isExampleComplete: (exampleId) => {
        return get().progress.completedExamples.includes(exampleId);
      },

      getTrackProgress: (trackId) => {
        const track = learningTracks.find((t) => t.id === trackId);
        if (!track) return { completed: 0, total: 0, percent: 0 };
        const { progress } = get();
        const total = track.lessons.length;
        const completed = track.lessons.filter(
          (lesson) => progress.completedLessons.includes(lesson.id)
        ).length;
        return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
      },
    }),
    {
      name: 'flafka-learn-progress',
      partialize: (state) => ({
        progress: state.progress,
        learnTab: state.learnTab,
        selectedTrackId: state.selectedTrackId,
      }),
    },
  ),
);
