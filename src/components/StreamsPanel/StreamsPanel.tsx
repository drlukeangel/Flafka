import { useState, useMemo, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { FiX, FiSearch } from 'react-icons/fi';
import { StreamCard } from './StreamCard';
import './StreamsPanel.css';

export function StreamsPanel() {
  const topicList = useWorkspaceStore((s) => s.topicList);
  const loadTopics = useWorkspaceStore((s) => s.loadTopics);
  const streamCards = useWorkspaceStore((s) => s.streamCards);
  const addStreamCard = useWorkspaceStore((s) => s.addStreamCard);
  const removeStreamCard = useWorkspaceStore((s) => s.removeStreamCard);
  const removeStreamCardsByTopic = useWorkspaceStore((s) => s.removeStreamCardsByTopic);
  const toggleStreamsPanel = useWorkspaceStore((s) => s.toggleStreamsPanel);

  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      <div className="stream-panel-header">
        <h2 className="stream-panel-title">Streams</h2>
        <button
          className="stream-panel-close"
          onClick={toggleStreamsPanel}
          aria-label="Close streams panel"
          title="Close"
        >
          <FiX size={16} />
        </button>
      </div>

      {/* Topic Selector */}
      <div className="stream-panel-selector">
        <div className="stream-panel-search">
          <FiSearch size={14} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="stream-panel-search-input"
          />
        </div>
        <div className="stream-panel-topic-list">
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
      </div>

      {/* Stream Cards or Empty State */}
      <div className="stream-panel-cards">
        {streamCards.length === 0 ? (
          <div className="stream-panel-empty">
            <FiSearch size={32} />
            <p>Select topics above to start monitoring</p>
          </div>
        ) : (
          streamCards.map((card) => (
            <StreamCard
              key={card.id}
              cardId={card.id}
              topicName={card.topicName}
              onRemove={() => removeStreamCard(card.id)}
              onDuplicate={() => addStreamCard(card.topicName)}
            />
          ))
        )}
      </div>
    </div>
  );
}
