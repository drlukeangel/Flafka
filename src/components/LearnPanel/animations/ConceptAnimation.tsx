/**
 * @learn-center
 * ConceptAnimation — Router that renders the correct animation for a given concept type.
 */

import type { ConceptAnimationType } from '../../../types/learn';
import { AnimationSpeedProvider } from './AnimationSpeedContext';
import { AnimationControls } from './AnimationControls';
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
import { FilterStreamAnimation } from './FilterStreamAnimation';
import { ArrayUnnestAnimation } from './ArrayUnnestAnimation';
import { UnionMergeAnimation } from './UnionMergeAnimation';
import { FanOutAnimation } from './FanOutAnimation';
import { DedupStreamAnimation } from './DedupStreamAnimation';
import { CdcPipelineAnimation } from './CdcPipelineAnimation';
import { OverWindowAnimation } from './OverWindowAnimation';
import { ChangeDetectionAnimation } from './ChangeDetectionAnimation';
import { PatternMatchAnimation } from './PatternMatchAnimation';
import { TemporalJoinAnimation } from './TemporalJoinAnimation';
import { IntervalJoinAnimation } from './IntervalJoinAnimation';
import { TopNAnimation } from './TopNAnimation';
import { MaterializedViewAnimation } from './MaterializedViewAnimation';
import { PiiMaskAnimation } from './PiiMaskAnimation';
import { DataValidationAnimation } from './DataValidationAnimation';
import { UdfTransformAnimation } from './UdfTransformAnimation';
import { KsqlStreamAnimation } from './KsqlStreamAnimation';
import { SchemaRawAnimation } from './SchemaRawAnimation';
import { DynamicRoutingAnimation } from './DynamicRoutingAnimation';
import { PropertyLookupAnimation } from './PropertyLookupAnimation';
import { TradelineExplodeAnimation } from './TradelineExplodeAnimation';

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
  // Bespoke per-example animations
  'filter-stream': FilterStreamAnimation,
  'array-unnest': ArrayUnnestAnimation,
  'union-merge': UnionMergeAnimation,
  'fan-out': FanOutAnimation,
  'dedup-stream': DedupStreamAnimation,
  'cdc-pipeline': CdcPipelineAnimation,
  'over-window': OverWindowAnimation,
  'change-detection': ChangeDetectionAnimation,
  'pattern-match': PatternMatchAnimation,
  'temporal-join': TemporalJoinAnimation,
  'interval-join': IntervalJoinAnimation,
  'top-n': TopNAnimation,
  'materialized-view': MaterializedViewAnimation,
  'pii-mask': PiiMaskAnimation,
  'data-validation': DataValidationAnimation,
  'udf-transform': UdfTransformAnimation,
  'ksql-stream': KsqlStreamAnimation,
  'schema-raw': SchemaRawAnimation,
  'dynamic-routing': DynamicRoutingAnimation,
  'property-lookup': PropertyLookupAnimation,
  'tradeline-explode': TradelineExplodeAnimation,
};

export function ConceptAnimation({ type }: ConceptAnimationProps) {
  const Component = ANIMATION_MAP[type];
  if (!Component) return null;
  return (
    <AnimationSpeedProvider>
      <Component />
      <AnimationControls />
    </AnimationSpeedProvider>
  );
}
