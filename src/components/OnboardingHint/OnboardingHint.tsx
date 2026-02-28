import React from 'react';
import { FiZap, FiDatabase, FiSettings, FiX } from 'react-icons/fi';

interface OnboardingHintProps {
  onDismiss: () => void;
}

export const OnboardingHint: React.FC<OnboardingHintProps> = ({ onDismiss }) => (
  <div className="onboarding-hint">
    <button className="onboarding-hint-close" onClick={onDismiss} aria-label="Dismiss hint">
      <FiX />
    </button>
    <h3 className="onboarding-hint-title">Getting Started</h3>
    <ul className="onboarding-hint-tips">
      <li className="onboarding-hint-tip">
        <FiZap />
        <span>Press <kbd>Ctrl+Enter</kbd> to run your query</span>
      </li>
      <li className="onboarding-hint-tip">
        <FiDatabase />
        <span>Type <code>SHOW TABLES;</code> to explore available tables and topics</span>
      </li>
      <li className="onboarding-hint-tip">
        <FiSettings />
        <span>Set your catalog and database in the toolbar before running queries</span>
      </li>
    </ul>
  </div>
);
