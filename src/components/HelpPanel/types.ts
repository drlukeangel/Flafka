/**
 * @help-system
 * Type definitions for the Help Panel system
 */

export interface ContentSection {
  type: 'heading' | 'paragraph' | 'code-block' | 'list' | 'list-item';
  text: string;
}

export interface HelpTopic {
  id: string;
  title: string;
  category: 'editor' | 'results' | 'sidebar' | 'keyboard-shortcuts' | 'flink-sql' | 'troubleshooting' | 'tips';
  content: ContentSection[];
  relatedTopicIds: string[];
  keywords: string[];
  sortOrder: number;
}
