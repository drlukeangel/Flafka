/**
 * @learn-center
 * TrackDetailPage — Renders a single learning track with its ordered lessons.
 * Shows progress, lesson list with status icons, and completion celebration.
 */

import { useState } from 'react';
import { FiArrowLeft, FiCheck, FiCircle, FiBookOpen, FiCode, FiAward } from 'react-icons/fi';
import { useLearnStore } from '../../store/learnStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { LearningTrack, TrackLesson } from '../../types/learn';
import { ConceptLessonView } from './ConceptLessonView';
import './TrackDetailPage.css';

interface TrackDetailPageProps {
  track: LearningTrack;
  onBack: () => void;
}

function LessonRow({ lesson, index, isComplete, onStart }: {
  lesson: TrackLesson;
  index: number;
  isComplete: boolean;
  onStart: () => void;
}) {
  const markLessonComplete = useLearnStore((s) => s.markLessonComplete);

  return (
    <div
      className={`lesson-row${isComplete ? ' lesson-row--complete' : ''}`}
      onClick={onStart}
      style={{ cursor: 'pointer' }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStart(); } }}
    >
      <span className="lesson-row__number">{index + 1}</span>
      <span className="lesson-row__icon">
        {isComplete ? (
          <FiCheck size={16} className="lesson-row__check" />
        ) : (
          <FiCircle size={16} className="lesson-row__circle" />
        )}
      </span>
      <div className="lesson-row__content">
        <span className="lesson-row__title">{lesson.title}</span>
        <span className="lesson-row__type">
          {lesson.type === 'concept' ? (
            <><FiBookOpen size={12} /> Concept</>
          ) : (
            <><FiCode size={12} /> Example</>
          )}
        </span>
        <p className="lesson-row__description">{lesson.description}</p>
      </div>
      <div className="lesson-row__actions">
        <button
          className="lesson-row__action-btn"
          onClick={onStart}
        >
          {lesson.type === 'concept' ? 'Learn' : 'Set Up'}
        </button>
        {!isComplete && (
          <button
            className="lesson-row__mark-btn"
            onClick={() => markLessonComplete(lesson.id)}
            title="Mark as complete"
          >
            <FiCheck size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function TrackDetailPage({ track, onBack }: TrackDetailPageProps) {
  const progress = useLearnStore((s) => s.progress);
  const getTrackProgress = useLearnStore((s) => s.getTrackProgress);
  const markLessonComplete = useLearnStore((s) => s.markLessonComplete);
  const navigateToExampleDetail = useWorkspaceStore((s) => s.navigateToExampleDetail);

  const [viewingConceptId, setViewingConceptId] = useState<string | null>(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);

  const { completed, total, percent } = getTrackProgress(track.id);
  const isTrackComplete = progress.completedTracks.includes(track.id);

  // Show celebration when track just completed
  const prevComplete = useState(isTrackComplete)[0];
  if (isTrackComplete && !prevComplete && !celebrationVisible) {
    setCelebrationVisible(true);
    setTimeout(() => setCelebrationVisible(false), 3000);
  }

  // If viewing a concept lesson
  if (viewingConceptId) {
    const lesson = track.lessons.find((l) => l.id === viewingConceptId);
    if (lesson?.conceptContent) {
      return (
        <ConceptLessonView
          lesson={lesson}
          onBack={() => setViewingConceptId(null)}
          onComplete={() => {
            markLessonComplete(lesson.id);
            setViewingConceptId(null);
          }}
        />
      );
    }
    // Concept without content yet — show placeholder
    if (lesson) {
      const lessonComplete = progress.completedLessons.includes(lesson.id);
      return (
        <div className="track-detail">
          <button className="track-detail__back" onClick={() => setViewingConceptId(null)}>
            <FiArrowLeft size={16} />
            <span>Back to {track.title}</span>
          </button>
          <div className="track-detail__hero">
            <div className="track-detail__hero-content">
              <h2 className="track-detail__title">{lesson.title}</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, lineHeight: 1.6, margin: '12px 0' }}>
                {lesson.description}
              </p>
              <p style={{ color: 'var(--color-text-tertiary)', fontSize: 13, fontStyle: 'italic' }}>
                Detailed content coming soon.
              </p>
              {!lessonComplete && (
                <button
                  className="lesson-row__action-btn"
                  style={{ marginTop: 16 }}
                  onClick={() => {
                    markLessonComplete(lesson.id);
                    setViewingConceptId(null);
                  }}
                >
                  Mark as Complete
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
  }

  const handleLessonStart = (lesson: TrackLesson) => {
    if (lesson.type === 'concept') {
      setViewingConceptId(lesson.id);
    } else if (lesson.exampleId) {
      // Navigate to example detail page
      navigateToExampleDetail(lesson.exampleId);
    }
  };

  return (
    <div className="track-detail">
      {/* Back button */}
      <button className="track-detail__back" onClick={onBack}>
        <FiArrowLeft size={16} />
        <span>Back to Tracks</span>
      </button>

      {/* Hero */}
      <div className="track-detail__hero">
        <span className="track-detail__icon">{track.icon}</span>
        <div className="track-detail__hero-content">
          <h2 className="track-detail__title">{track.title}</h2>
          <div className="track-detail__meta">
            <span className={`track-detail__level track-detail__level--${track.skillLevel.toLowerCase()}`}>
              {track.skillLevel}
            </span>
            <span>{track.lessons.length} lessons</span>
            {track.estimatedMinutes && <span>~{track.estimatedMinutes} min</span>}
          </div>
          <p className="track-detail__description">{track.description}</p>
        </div>
        <div className="track-detail__progress">
          <span className="track-detail__progress-text">{completed}/{total}</span>
          <div className="track-detail__progress-bar">
            <div
              className="track-detail__progress-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="track-detail__progress-percent">{percent}%</span>
        </div>
      </div>

      {/* Celebration */}
      {celebrationVisible && (
        <div className="track-detail__celebration">
          <FiAward size={24} />
          <span>Track Complete! You've mastered {track.title}.</span>
        </div>
      )}

      {/* Lesson List */}
      <div className="track-detail__lessons">
        <h3 className="track-detail__lessons-title">Lessons</h3>
        {track.lessons.map((lesson, index) => {
          const isComplete = progress.completedLessons.includes(lesson.id);
          return (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              index={index}
              isComplete={isComplete}
              onStart={() => handleLessonStart(lesson)}
            />
          );
        })}
      </div>
    </div>
  );
}
