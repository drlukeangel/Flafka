/**
 * @learn-center
 * TrackDetailPage — Renders a single learning track with its ordered lessons.
 * Shows progress, lesson list with status icons, and completion celebration.
 */

import { useState, useEffect, useRef } from 'react';
import { FiArrowLeft, FiCheck, FiCircle, FiBookOpen, FiCode, FiAward, FiX, FiStar } from 'react-icons/fi';
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
  const setCurrentLesson = useLearnStore((s) => s.setCurrentLesson);
  const navigateToConceptLesson = useLearnStore((s) => s.navigateToConceptLesson);
  const setLearnTab = useLearnStore((s) => s.setLearnTab);
  const navigateToExampleDetail = useWorkspaceStore((s) => s.navigateToExampleDetail);

  const selectedConceptId = useLearnStore((s) => s.selectedConceptId);
  const [celebrationVisible, setCelebrationVisible] = useState(false);

  // Clear store on unmount
  useEffect(() => {
    return () => { navigateToConceptLesson(null); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { completed, total, percent } = getTrackProgress(track.id);
  const isTrackComplete = progress.completedTracks.includes(track.id);

  // Only show celebration when transitioning false → true (not on mount when already complete)
  const prevCompleteRef = useRef(isTrackComplete);
  useEffect(() => {
    if (isTrackComplete && !prevCompleteRef.current) {
      setCelebrationVisible(true);
    }
    prevCompleteRef.current = isTrackComplete;
  }, [isTrackComplete]);

  const goToConceptLesson = (lessonId: string) => {
    const lesson = track.lessons.find((l) => l.id === lessonId);
    document.title = lesson ? `${lesson.title} — Learn — Flafka` : `Learn — Flafka`;
    window.history.pushState(null, '', `/learn/tracks/${encodeURIComponent(track.id)}/${encodeURIComponent(lessonId)}`);
    navigateToConceptLesson(lessonId);
  };

  const goToTrackRoot = () => {
    document.title = `${track.title} — Learn — Flafka`;
    window.history.pushState(null, '', `/learn/tracks/${encodeURIComponent(track.id)}`);
    navigateToConceptLesson(null);
  };

  const handleLessonStart = (lesson: TrackLesson) => {
    if (lesson.type === 'concept') {
      goToConceptLesson(lesson.id);
    } else if (lesson.exampleId) {
      // Store lesson context so ExampleDetailPage can show track navigation buttons
      setCurrentLesson(lesson.id);
      document.title = `${lesson.title} — Learn — Flafka`;
      window.history.pushState(null, '', `/learn/examples/${encodeURIComponent(lesson.exampleId)}`);
      setLearnTab('examples');
      navigateToExampleDetail(lesson.exampleId);
    }
  };

  // If viewing a concept lesson
  if (selectedConceptId) {
    const lessonIndex = track.lessons.findIndex((l) => l.id === selectedConceptId);
    const lesson = lessonIndex >= 0 ? track.lessons[lessonIndex] : undefined;
    const nextLesson = lessonIndex >= 0 ? track.lessons[lessonIndex + 1] : undefined;

    const handleCompleteAndNext = nextLesson
      ? () => {
          if (lesson) markLessonComplete(lesson.id);
          if (nextLesson.type === 'concept') {
            goToConceptLesson(nextLesson.id);
          } else if (nextLesson.exampleId) {
            navigateToConceptLesson(null);
            setCurrentLesson(nextLesson.id);
            window.history.pushState(null, '', `/learn/examples/${encodeURIComponent(nextLesson.exampleId)}`);
            setLearnTab('examples');
            navigateToExampleDetail(nextLesson.exampleId);
          } else {
            goToTrackRoot();
          }
        }
      : undefined;

    if (lesson?.conceptContent) {
      return (
        <ConceptLessonView
          lesson={lesson}
          onBack={() => goToTrackRoot()}
          onComplete={() => {
            markLessonComplete(lesson.id);
            goToTrackRoot();
          }}
          onCompleteAndNext={handleCompleteAndNext}
        />
      );
    }
    // Concept without content yet — show placeholder
    if (lesson) {
      const lessonComplete = progress.completedLessons.includes(lesson.id);
      return (
        <div className="track-detail">
          <button className="track-detail__back" onClick={() => goToTrackRoot()}>
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
                    goToTrackRoot();
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

      {/* Celebration modal */}
      {celebrationVisible && (
        <div className="track-celebration-overlay" onClick={() => setCelebrationVisible(false)}>
          <div
            className="track-celebration-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="celebration-heading"
          >
            <button
              className="track-celebration-modal__close"
              onClick={() => setCelebrationVisible(false)}
              aria-label="Close"
            >
              <FiX size={18} />
            </button>

            <div className="track-celebration-modal__icon">🏆</div>

            <h2 id="celebration-heading" className="track-celebration-modal__heading">
              Track Complete!
            </h2>
            <p className="track-celebration-modal__track-name">{track.title}</p>

            <div className="track-celebration-modal__stats">
              <div className="track-celebration-modal__stat">
                <FiCheck size={16} />
                <span>{total} lessons completed</span>
              </div>
              {track.estimatedMinutes && (
                <div className="track-celebration-modal__stat">
                  <FiStar size={16} />
                  <span>~{track.estimatedMinutes} min of learning</span>
                </div>
              )}
              <div className="track-celebration-modal__stat">
                <FiAward size={16} />
                <span>{track.skillLevel} level mastered</span>
              </div>
            </div>

            <p className="track-celebration-modal__message">
              Great work! You now understand {track.title.toLowerCase()}. Keep going — the next track is waiting.
            </p>

            <div className="track-celebration-modal__actions">
              <button
                className="track-celebration-modal__btn track-celebration-modal__btn--primary"
                onClick={() => { setCelebrationVisible(false); onBack(); }}
              >
                Back to Tracks
              </button>
              <button
                className="track-celebration-modal__btn track-celebration-modal__btn--secondary"
                onClick={() => setCelebrationVisible(false)}
              >
                Stay Here
              </button>
            </div>
          </div>
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
