import { useState, useMemo, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { FiActivity } from 'react-icons/fi';
import { StreamCard } from './StreamCard';
import './StreamsPanel.css';

export function StreamsPanel() {
  const topicList = useWorkspaceStore((s) => s.topicList);
  const loadTopics = useWorkspaceStore((s) => s.loadTopics);
  const streamCards = useWorkspaceStore((s) => s.streamCards);
  const addStreamCard = useWorkspaceStore((s) => s.addStreamCard);
  const removeStreamCard = useWorkspaceStore((s) => s.removeStreamCard);
  const removeStreamCardsByTopic = useWorkspaceStore((s) => s.removeStreamCardsByTopic);

  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Topic list resize
  const TOPIC_ROW_HEIGHT = 26;
  const [topicListHeight, setTopicListHeight] = useState(TOPIC_ROW_HEIGHT * 2);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number>(TOPIC_ROW_HEIGHT * 2);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartHeight.current = topicListHeight;
    const handleMouseMove = (ev: MouseEvent) => {
      if (dragStartY.current === null) return;
      const delta = ev.clientY - dragStartY.current;
      const newHeight = Math.max(TOPIC_ROW_HEIGHT * 2, Math.min(320, dragStartHeight.current + delta));
      setTopicListHeight(newHeight);
    };
    const handleMouseUp = () => {
      dragStartY.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Guard: if topicList is empty when panel opens, refresh
  useEffect(() => {
    if (topicList.length === 0) {
      loadTopics();
    }
  }, []);

  const filteredTopics = useMemo(() => {
    if (!searchTerm) return topicList;
    const term = searchTerm.toLowerCase();
    return topicList.filter((t) => t.topic_name.toLowerCase().includes(term));
  }, [topicList, searchTerm]);

  // Check if any card exists for a topic
  const hasCardForTopic = (topicName: string) =>
    streamCards.some((c) => c.topicName === topicName);

  const handleTopicToggle = (topicName: string) => {
    if (hasCardForTopic(topicName)) {
      removeStreamCardsByTopic(topicName);
    } else {
      addStreamCard(topicName);
    }
  };

  return (
    <div className="stream-panel">
      {/* Topic Selector */}
      <div className="stream-panel-selector">
        <div className="stream-panel-search">
          <FiActivity size={15} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          <span className="stream-panel-search-label">Streams</span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="stream-panel-search-input"
          />
        </div>
        <div
          className="stream-panel-topic-list"
          style={{ height: topicListHeight }}
        >
          {filteredTopics.map((topic) => {
            const isSelected = hasCardForTopic(topic.topic_name);
            const isDisabled = !isSelected && streamCards.length >= 10;
            return (
              <label
                key={topic.topic_name}
                className={`stream-panel-topic-item${isDisabled ? ' stream-panel-topic-item--disabled' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => handleTopicToggle(topic.topic_name)}
                  title={isDisabled ? 'Max 10 streams' : undefined}
                />
                <span className="stream-panel-topic-name">{topic.topic_name}</span>
              </label>
            );
          })}
        </div>
        <div
          className="stream-panel-topic-resize"
          onMouseDown={handleResizeStart}
          title="Drag to resize topic list"
        />
      </div>

      {/* Stream Cards or Empty State */}
      <div className="stream-panel-cards">
        {streamCards.length === 0 ? (
          <div className="stream-panel-empty">
            <FiActivity size={64} style={{ color: 'var(--color-primary)' }} />
            <p style={{ fontWeight: 600, fontSize: 26, color: 'var(--color-text-primary)', margin: '10px 0 4px' }}>Streams</p>
            <p>Select a topic above to start streaming</p>
          </div>
        ) : (
          streamCards.map((card) => (
            <StreamCard
              key={card.id}
              cardId={card.id}
              topicName={card.topicName}
              initialMode={card.initialMode}
              initialDatasetId={card.preselectedDatasetId}
              onRemove={() => removeStreamCard(card.id)}
              onDuplicate={() => addStreamCard(card.topicName)}
            />
          ))
        )}
      </div>
    </div>
  );
}
