/**
 * @learn-center
 * LearnPanel — Full-page Education Center with Tracks + Examples tabs.
 * Rendered when activeNavItem === 'learn' (replaces old Examples sidebar).
 */

import { useState } from 'react';
import { FiBookOpen, FiGrid, FiCheck, FiLock, FiChevronRight, FiAward } from 'react-icons/fi';
import { useLearnStore } from '../../store/learnStore';
import { learningTracks } from '../../data/learningTracks';
import { ExamplesPanel } from '../ExamplesPanel/ExamplesPanel';
import { TrackDetailPage } from './TrackDetailPage';
import type { LearnTab, LearningTrack } from '../../types/learn';
import './LearnPanel.css';

function ProgressBar({ percent, size = 'md' }: { percent: number; size?: 'sm' | 'md' }) {
  return (
    <div className={`learn-progress-bar learn-progress-bar--${size}`}>
      <div
        className="learn-progress-bar__fill"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

function TrackCard({ track }: { track: LearningTrack }) {
  const navigateToTrackDetail = useLearnStore((s) => s.navigateToTrackDetail);
  const getTrackProgress = useLearnStore((s) => s.getTrackProgress);
  const progress = useLearnStore((s) => s.progress);

  const { completed, total, percent } = getTrackProgress(track.id);
  const isComplete = progress.completedTracks.includes(track.id);

  // Check prerequisites
  const prerequisitesMet = !track.prerequisites || track.prerequisites.length === 0 ||
    track.prerequisites.every((prereq) => progress.completedTracks.includes(prereq));
  const isLocked = !prerequisitesMet;

  const [skipWarning, setSkipWarning] = useState(false);

  const handleClick = () => {
    if (isLocked && !skipWarning) {
      setSkipWarning(true);
      return;
    }
    navigateToTrackDetail(track.id);
  };

  const prerequisiteNames = (track.prerequisites || []).map((id) => {
    const t = learningTracks.find((lt) => lt.id === id);
    return t?.title || id;
  });

  return (
    <button
      className={`track-card${isComplete ? ' track-card--complete' : ''}${isLocked ? ' track-card--locked' : ''}`}
      onClick={handleClick}
      aria-label={`${track.title} - ${track.skillLevel} - ${completed}/${total} lessons complete`}
    >
      <div className="track-card__header">
        <span className="track-card__icon">{track.icon}</span>
        <div className="track-card__title-group">
          <span className="track-card__title">{track.title}</span>
          <span className={`track-card__level track-card__level--${track.skillLevel.toLowerCase()}`}>
            {track.skillLevel}
          </span>
        </div>
        {isComplete && <FiCheck className="track-card__check" size={18} />}
        {isLocked && !skipWarning && <FiLock className="track-card__lock" size={16} />}
        <FiChevronRight className="track-card__arrow" size={16} />
      </div>

      <p className="track-card__description">{track.description}</p>

      <div className="track-card__meta">
        <span>{track.lessons.length} lessons</span>
        {track.estimatedMinutes && <span>~{track.estimatedMinutes} min</span>}
        <span>{completed}/{total} complete</span>
      </div>

      <ProgressBar percent={percent} size="sm" />

      {track.recommendedRoles && track.recommendedRoles.length > 0 && (
        <div className="track-card__roles">
          {track.recommendedRoles.map((role) => (
            <span key={role} className="track-card__role-tag">{role}</span>
          ))}
        </div>
      )}

      {isLocked && !skipWarning && (
        <div className="track-card__prereq">
          Requires: {prerequisiteNames.join(' + ')}
        </div>
      )}

      {skipWarning && (
        <div className="track-card__skip-warning">
          This track builds on {prerequisiteNames.join(' & ')}. Continue anyway?
          <span className="track-card__skip-link" onClick={(e) => { e.stopPropagation(); navigateToTrackDetail(track.id); }}>
            Skip ahead
          </span>
        </div>
      )}
    </button>
  );
}

function BadgeSummary() {
  const progress = useLearnStore((s) => s.progress);
  if (progress.badges.length === 0) return null;

  return (
    <div className="learn-badges">
      <FiAward size={14} />
      <span>{progress.badges.length} badge{progress.badges.length !== 1 ? 's' : ''} earned</span>
    </div>
  );
}

export function LearnPanel() {
  const learnTab = useLearnStore((s) => s.learnTab);
  const setLearnTab = useLearnStore((s) => s.setLearnTab);
  const selectedTrackId = useLearnStore((s) => s.selectedTrackId);
  const navigateToTrackDetail = useLearnStore((s) => s.navigateToTrackDetail);
  // Track detail view
  if (selectedTrackId) {
    const track = learningTracks.find((t) => t.id === selectedTrackId);
    if (track) {
      return (
        <div className="learn-panel" aria-label="Learn panel">
          <TrackDetailPage
            track={track}
            onBack={() => { setLearnTab('tracks'); navigateToTrackDetail(null); }}
          />
        </div>
      );
    }
  }

  const tabs: { id: LearnTab; label: string; icon: React.ReactNode }[] = [
    { id: 'examples', label: 'Examples', icon: <FiGrid size={16} /> },
    { id: 'tracks', label: 'Tracks', icon: <FiBookOpen size={16} /> },
  ];

  return (
    <div className="learn-panel" aria-label="Learn panel">
      {/* Header */}
      <div className="learn-header">
        <div className="learn-header__stats">
          <span className="learn-header__title">Learning Center</span>
          <BadgeSummary />
        </div>
      </div>

      {/* Tab Bar */}
      <div className="learn-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`learn-tab${learnTab === tab.id ? ' learn-tab--active' : ''}`}
            onClick={() => setLearnTab(tab.id)}
            role="tab"
            aria-selected={learnTab === tab.id}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="learn-content">
        {learnTab === 'tracks' && (
          <div className="learn-tracks-grid">
            {learningTracks.map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div>
        )}

        {learnTab === 'examples' && (
          <div className="learn-examples-container">
            <ExamplesPanel />
          </div>
        )}
      </div>
    </div>
  );
}
