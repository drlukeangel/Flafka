/**
 * @learn-center
 * ConceptAnimation — Router that renders the correct animation for a given concept type.
 */

import type { ConceptAnimationType } from '../../../types/learn';
import { FlinkBasicsAnimation } from './FlinkBasicsAnimation';
import { KafkaBasicsAnimation } from './KafkaBasicsAnimation';
import { ConsumerGroupsAnimation } from './ConsumerGroupsAnimation';
import { ChangelogModesAnimation } from './ChangelogModesAnimation';
import { WatermarkAnimation } from './WatermarkAnimation';
import { JoinAnimation } from './JoinAnimation';
import { StateAnimation } from './StateAnimation';
import { TumbleWindowAnimation } from './TumbleWindowAnimation';
import { HopWindowAnimation } from './HopWindowAnimation';
import { SessionWindowAnimation } from './SessionWindowAnimation';
import { CumulateWindowAnimation } from './CumulateWindowAnimation';
import { StreamsVsTablesAnimation } from './StreamsVsTablesAnimation';
import { ConfluentArchitectureAnimation } from './ConfluentArchitectureAnimation';
import { SchemaGovernanceAnimation } from './SchemaGovernanceAnimation';
import { StartupModesAnimation } from './StartupModesAnimation';

interface ConceptAnimationProps {
  type: ConceptAnimationType;
}

const ANIMATION_MAP: Record<string, React.FC> = {
  'flink-basics': FlinkBasicsAnimation,
  'kafka-basics': KafkaBasicsAnimation,
  'consumer-groups': ConsumerGroupsAnimation,
  'changelog-modes': ChangelogModesAnimation,
  'watermark': WatermarkAnimation,
  'join-match': JoinAnimation,
  'state-accumulate': StateAnimation,
  'tumble-window': TumbleWindowAnimation,
  'hop-window': HopWindowAnimation,
  'session-window': SessionWindowAnimation,
  'cumulate-window': CumulateWindowAnimation,
  'streams-vs-tables': StreamsVsTablesAnimation,
  'confluent-architecture': ConfluentArchitectureAnimation,
  'schema-governance': SchemaGovernanceAnimation,
  'startup-modes': StartupModesAnimation,
};

export function ConceptAnimation({ type }: ConceptAnimationProps) {
  const Component = ANIMATION_MAP[type];
  if (!Component) return null;
  return <Component />;
}
