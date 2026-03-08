/**
 * Standalone page for a popped-out stream card.
 * Opened via window.open() from the ⋮ menu "Pop Out" action.
 * Renders a single StreamCard filling the browser window.
 */

import { useWorkspaceStore } from '../../store/workspaceStore';
import { StreamCard } from './StreamCard';
import './StreamCard.css';
import '../../App.css';

interface StreamCardPopoutProps {
  topicName: string;
}

export function StreamCardPopout({ topicName }: StreamCardPopoutProps) {
  const catalog = useWorkspaceStore((s) => s.catalog);
  const database = useWorkspaceStore((s) => s.database);

  const cardId = `popout-${topicName}`;

  if (!catalog || !database) {
    return (
      <div className="stream-card-popout-page">
        <p>Waiting for workspace connection...</p>
      </div>
    );
  }

  return (
    <div className="stream-card-popout-page">
      <StreamCard
        cardId={cardId}
        topicName={topicName}
        onRemove={() => window.close()}
        onDuplicate={() => {}}
        isPopout
      />
    </div>
  );
}
