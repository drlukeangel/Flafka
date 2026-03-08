/**
 * @learn-center
 * ConceptLessonView — Renders a concept lesson with sections and optional animation.
 * Reuses ExampleDetailPage patterns (hero + collapsible sections).
 */

import { FiArrowLeft, FiCheck, FiChevronRight, FiX } from 'react-icons/fi';
import type { TrackLesson } from '../../types/learn';
import { ConceptAnimation } from './animations/ConceptAnimation';
import '../ExampleDetailView/ExampleDetailPage.css';

interface ConceptLessonViewProps {
  lesson: TrackLesson;
  onBack: () => void;
  onComplete: () => void;
  /** If provided, shows "Complete & Next" button. Undefined = this is the last lesson. */
  onCompleteAndNext?: () => void;
}

export function ConceptLessonView({ lesson, onBack, onComplete, onCompleteAndNext }: ConceptLessonViewProps) {
  const content = lesson.conceptContent;
  if (!content) return null;

  return (
    <div className="concept-lesson" style={{ position: 'relative' }}>
      {/* X close button — top right */}
      <button
        onClick={onBack}
        title="Close"
        aria-label="Close lesson"
        style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          border: 'none', background: 'var(--color-surface-secondary)',
          color: 'var(--color-text-secondary)', cursor: 'pointer',
          padding: 6, borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <FiX size={18} />
      </button>
      <button className="track-detail__back" onClick={onBack}>
        <FiArrowLeft size={16} />
        <span>Back to Track</span>
      </button>

      <div className="concept-lesson__hero">
        <h2 className="concept-lesson__title">{lesson.title}</h2>
        <p className="concept-lesson__subtitle">{lesson.description}</p>
      </div>

      {content.animation && (
        <div className="concept-lesson__animation">
          <ConceptAnimation type={content.animation} />
        </div>
      )}

      <div className="concept-lesson__sections">
        {content.sections.map((section, i) => (
          <div key={i} className="concept-lesson__section">
            <h3 className="concept-lesson__heading">{section.heading}</h3>
            <div className="concept-lesson__body">
              {section.body.split('\n\n').map((paragraph, j) => (
                <p key={j}>{paragraph}</p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="concept-lesson__footer">
        <button
          className="concept-lesson__close-btn"
          onClick={onComplete}
        >
          <FiCheck size={16} />
          <span>Close &amp; Complete</span>
        </button>
        {onCompleteAndNext && (
          <button
            className="concept-lesson__complete-btn"
            onClick={onCompleteAndNext}
          >
            <span>Complete &amp; Next</span>
            <FiChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
