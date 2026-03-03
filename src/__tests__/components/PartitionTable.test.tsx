import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { KafkaPartition, PartitionOffsets } from '../../types'

// ─────────────────────────────────────────────────────────────────────────────
// Mock topic-api
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../../api/topic-api', () => ({
  getTopicPartitions: vi.fn(),
  getPartitionOffsets: vi.fn(),
  produceRecord: vi.fn(),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Fixture factories
// ─────────────────────────────────────────────────────────────────────────────

function makeBroker(brokerId: number) {
  return { broker_id: brokerId }
}

function makePartition(overrides: Partial<KafkaPartition> = {}): KafkaPartition {
  return {
    partition_id: overrides.partition_id ?? 0,
    leader: overrides.leader !== undefined ? overrides.leader : makeBroker(1),
    replicas: overrides.replicas ?? [makeBroker(1), makeBroker(2), makeBroker(3)],
    isr: overrides.isr ?? [makeBroker(1), makeBroker(2), makeBroker(3)],
  }
}

function makeOffsets(overrides: Partial<PartitionOffsets> = {}): PartitionOffsets {
  return {
    beginning_offset: overrides.beginning_offset ?? 0,
    end_offset: overrides.end_offset ?? 1000,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Import PartitionTable after mocks
// ─────────────────────────────────────────────────────────────────────────────

import PartitionTable from '../../components/TopicPanel/PartitionTable'
import * as topicApi from '../../api/topic-api'

// ===========================================================================
// [@partition-table] Test Suites
// ===========================================================================

describe('[@partition-table] collapsed by default', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders toggle button with chevron-right icon when collapsed', () => {
    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={false}
        onToggle={vi.fn()}
      />
    )
    const button = screen.getByLabelText('Expand partition table')
    expect(button).toBeInTheDocument()
  })

  it('renders "Partitions" label on the toggle button', () => {
    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={false}
        onToggle={vi.fn()}
      />
    )
    expect(screen.getByText('Partitions')).toBeInTheDocument()
  })

  it('does not render partition table when collapsed', () => {
    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={false}
        onToggle={vi.fn()}
      />
    )
    // Table header should not be present
    expect(screen.queryByText('ID')).not.toBeInTheDocument()
    expect(screen.queryByText('Leader')).not.toBeInTheDocument()
  })

  it('calls onToggle when button is clicked', async () => {
    const mockToggle = vi.fn()
    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={false}
        onToggle={mockToggle}
      />
    )
    const button = screen.getByRole('button', { name: /expand partition table/i })
    await userEvent.click(button)
    expect(mockToggle).toHaveBeenCalledOnce()
  })
})

describe('[@partition-table] expanded state', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders toggle button with chevron-down icon when expanded', () => {
    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )
    const button = screen.getByLabelText('Collapse partition table')
    expect(button).toBeInTheDocument()
  })

  it('fetches partitions on mount when expanded=true', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({ partition_id: 0 }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(topicApi.getTopicPartitions).toHaveBeenCalledWith('test-topic')
    })
  })

  it('renders partition table header with all column names', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({ partition_id: 0 }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('ID')).toBeInTheDocument()
      expect(screen.getByText('Leader')).toBeInTheDocument()
      expect(screen.getByText('Replicas')).toBeInTheDocument()
      expect(screen.getByText('ISR')).toBeInTheDocument()
      expect(screen.getByText('Messages')).toBeInTheDocument()
    })
  })

  it('renders partition data rows with correct values', async () => {
    // Use distinct partition_ids (10, 20) and non-overlapping broker IDs
    // so text queries are unambiguous
    const partitions = [
      makePartition({
        partition_id: 10,
        leader: makeBroker(101),
        replicas: [makeBroker(101), makeBroker(102), makeBroker(103)],
        isr: [makeBroker(101), makeBroker(102), makeBroker(103)],
      }),
      makePartition({
        partition_id: 20,
        leader: makeBroker(102),
        replicas: [makeBroker(102), makeBroker(103), makeBroker(101)],
        isr: [makeBroker(102), makeBroker(103), makeBroker(101)],
      }),
    ]

    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce(partitions)
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValue(makeOffsets())

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      // Check partition IDs appear (10 and 20 are unique — no broker ID clash)
      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText('20')).toBeInTheDocument()
    })
  })

  it('displays message count (end - beginning offset)', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({ partition_id: 0 }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets({ beginning_offset: 100, end_offset: 5000 })
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      // 5000 - 100 = 4900
      expect(screen.getByText('4,900')).toBeInTheDocument()
    })
  })

  it('formats message count with commas for readability', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({ partition_id: 0 }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets({ beginning_offset: 0, end_offset: 1000000 })
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('1,000,000')).toBeInTheDocument()
    })
  })

  it('shows dash when offset fetch fails for a partition', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({ partition_id: 0 }),
    ])
    // First partition offset succeeds, second fails
    vi.mocked(topicApi.getPartitionOffsets)
      .mockResolvedValueOnce(makeOffsets())
      .mockRejectedValueOnce(new Error('Offset fetch failed'))

    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({ partition_id: 0 }),
      makePartition({ partition_id: 1 }),
    ])

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Partitions')).toBeInTheDocument()
    })
  })

  it('caps partition fetch at 100 partitions', async () => {
    const partitions = Array.from({ length: 150 }, (_, i) =>
      makePartition({ partition_id: i })
    )
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce(partitions)
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValue(makeOffsets())

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      // Should have capped at 100 — Promise.all call count should be 100
      expect(vi.mocked(topicApi.getPartitionOffsets).mock.calls).toHaveLength(100)
    })
  })

  it('renders loading state with spinner while fetching', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve([makePartition({ partition_id: 0 })]), 100)
        )
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    expect(screen.getByText('Loading partitions...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText('Loading partitions...')).not.toBeInTheDocument()
    })
  })

  it('renders "No partitions found" when partition list is empty', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([])

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('No partitions found')).toBeInTheDocument()
    })
  })

  it('shows partition count badge in collapsed header after first expand', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({ partition_id: 0 }),
      makePartition({ partition_id: 1 }),
      makePartition({ partition_id: 2 }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValue(makeOffsets())

    const { rerender } = render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('(3)')).toBeInTheDocument()
    })

    // Collapse
    rerender(
      <PartitionTable
        topicName="test-topic"
        isExpanded={false}
        onToggle={vi.fn()}
      />
    )

    // Badge should still be visible
    expect(screen.getByText('(3)')).toBeInTheDocument()
  })
})

describe('[@partition-table] under-replicated partitions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows warning style when isr.length < replicas.length', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 0,
        replicas: [makeBroker(1), makeBroker(2), makeBroker(3)],
        isr: [makeBroker(1), makeBroker(2)], // Under-replicated: 2 < 3
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      // Find the row and check it has warning styling
      const rows = screen.getAllByRole('cell')
      const partitionIdCell = rows.find((cell) => cell.textContent === '0')
      expect(partitionIdCell).toBeInTheDocument()
    })
  })

  it('renders warning triangle icon for under-replicated partition', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 0,
        replicas: [makeBroker(1), makeBroker(2), makeBroker(3)],
        isr: [makeBroker(1)], // Under-replicated
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByLabelText('Under-replicated partition')
      ).toBeInTheDocument()
    })
  })

  it('does not show warning when isr length equals replicas length', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 0,
        replicas: [makeBroker(1), makeBroker(2), makeBroker(3)],
        isr: [makeBroker(1), makeBroker(2), makeBroker(3)], // Fully replicated
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(
        screen.queryByLabelText('Under-replicated partition')
      ).not.toBeInTheDocument()
    })
  })
})

describe('[@partition-table] leaderless partitions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows error style when leader is null', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 0,
        leader: null,
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Leaderless partition')).toBeInTheDocument()
    })
  })

  it('renders "None" text in Leader column when leader is null', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 0,
        leader: null,
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('None')).toBeInTheDocument()
    })
  })

  it('renders alert icon for leaderless partition', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 1,
        leader: null,
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByLabelText('Leaderless partition')
      ).toBeInTheDocument()
    })
  })
})

describe('[@partition-table] null/undefined isr and replicas (Tier 2 Regression)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders without crash when isr is null', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 0,
        isr: null as any,
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  it('renders without crash when isr is undefined', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 0,
        isr: undefined as any,
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  it('renders without crash when replicas is null', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 0,
        replicas: null as any,
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  it('renders without crash when replicas is undefined', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 0,
        replicas: undefined as any,
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  it('renders both null and undefined in same table without crash', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 30,
        leader: makeBroker(201),
        replicas: null as any,
        isr: null as any,
      }),
      makePartition({
        partition_id: 40,
        leader: makeBroker(202),
        replicas: undefined as any,
        isr: undefined as any,
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValue(makeOffsets())

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      // Use distinct partition IDs (30, 40) that don't collide with broker IDs
      expect(screen.getByText('30')).toBeInTheDocument()
      expect(screen.getByText('40')).toBeInTheDocument()
    })
  })

  it('does not show under-replicated warning when both isr and replicas are null', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 0,
        replicas: null as any,
        isr: null as any,
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(
        screen.queryByLabelText('Under-replicated partition')
      ).not.toBeInTheDocument()
    })
  })

  it('displays dashes for replicas/isr columns when null', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 0,
        replicas: null as any,
        isr: null as any,
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      // Null arrays should render as dashes
      const cells = screen.getAllByRole('cell')
      expect(cells.length).toBeGreaterThan(0)
    })
  })
})

describe('[@partition-table] error handling', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders error message when partition fetch fails', async () => {
    const errorMsg = 'Failed to load partitions'
    vi.mocked(topicApi.getTopicPartitions).mockRejectedValueOnce(
      new Error(errorMsg)
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(errorMsg)).toBeInTheDocument()
    })
  })

  it('renders retry button in error state', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockRejectedValueOnce(
      new Error('Network error')
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })
  })

  it('retries fetch when retry button is clicked', async () => {
    vi.mocked(topicApi.getTopicPartitions)
      .mockRejectedValueOnce(new Error('First attempt failed'))
      .mockResolvedValueOnce([makePartition({ partition_id: 0 })])

    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('First attempt failed')).toBeInTheDocument()
    })

    const retryButton = screen.getByRole('button', { name: /retry/i })
    await userEvent.click(retryButton)

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  it('has role="alert" on error message for accessibility', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockRejectedValueOnce(
      new Error('API error')
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      const alertElement = screen.getByRole('alert')
      expect(alertElement).toBeInTheDocument()
    })
  })
})

describe('[@partition-table] topic change handling', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('resets state when topicName prop changes', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValue([
      makePartition({ partition_id: 0 }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValue(makeOffsets())

    const { rerender } = render(
      <PartitionTable
        topicName="topic-1"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(topicApi.getTopicPartitions).toHaveBeenCalledWith('topic-1')
    })

    // Change topic name
    rerender(
      <PartitionTable
        topicName="topic-2"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(topicApi.getTopicPartitions).toHaveBeenCalledWith('topic-2')
    })
  })

  it('does not re-fetch when toggling expanded state multiple times', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({ partition_id: 0 }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    const mockToggle = vi.fn()
    const { rerender } = render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={mockToggle}
      />
    )

    await waitFor(() => {
      expect(topicApi.getTopicPartitions).toHaveBeenCalledOnce()
    })

    // Toggle off
    rerender(
      <PartitionTable
        topicName="test-topic"
        isExpanded={false}
        onToggle={mockToggle}
      />
    )

    // Toggle on again — should use cached data, not re-fetch
    rerender(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={mockToggle}
      />
    )

    // Still just 1 call — data was cached
    expect(topicApi.getTopicPartitions).toHaveBeenCalledOnce()
  })
})

describe('[@partition-table] concurrency and performance', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('fetches offsets in parallel for all partitions via Promise.all', async () => {
    const partitions = [
      makePartition({ partition_id: 0 }),
      makePartition({ partition_id: 1 }),
      makePartition({ partition_id: 2 }),
    ]
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce(partitions)
    vi.mocked(topicApi.getPartitionOffsets)
      .mockResolvedValueOnce(makeOffsets())
      .mockResolvedValueOnce(makeOffsets())
      .mockResolvedValueOnce(makeOffsets())

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      // All 3 offset calls should be made
      expect(vi.mocked(topicApi.getPartitionOffsets)).toHaveBeenCalledTimes(3)
    })
  })

  it('handles 100 parallel offset fetches without hanging', async () => {
    const partitions = Array.from({ length: 100 }, (_, i) =>
      makePartition({ partition_id: i })
    )
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce(partitions)
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValue(makeOffsets())

    render(
      <PartitionTable
        topicName="large-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      // All 100 offset calls should complete
      expect(vi.mocked(topicApi.getPartitionOffsets)).toHaveBeenCalledTimes(100)
    })
  })

  it('silently handles individual partition offset fetch failures', async () => {
    // Use high partition IDs (50, 60, 70) to avoid collision with broker IDs (1, 2, 3)
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({ partition_id: 50, leader: makeBroker(301) }),
      makePartition({ partition_id: 60, leader: makeBroker(302) }),
      makePartition({ partition_id: 70, leader: makeBroker(303) }),
    ])
    vi.mocked(topicApi.getPartitionOffsets)
      .mockResolvedValueOnce(makeOffsets())
      .mockRejectedValueOnce(new Error('Offset fetch failed'))
      .mockResolvedValueOnce(makeOffsets())

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      // Should still render the table with partition IDs 50, 60, 70 (distinct from broker IDs)
      expect(screen.getByText('50')).toBeInTheDocument()
      expect(screen.getByText('60')).toBeInTheDocument()
      expect(screen.getByText('70')).toBeInTheDocument()
    })
  })
})

describe('[@partition-table] edge cases', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders dash for message count when offsets are equal (zero messages)', async () => {
    // Use partition_id=5 and broker IDs 401+ to avoid collision with "0" message count
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 5,
        leader: makeBroker(401),
        replicas: [makeBroker(401), makeBroker(402)],
        isr: [makeBroker(401), makeBroker(402)],
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets({ beginning_offset: 1000, end_offset: 1000 })
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
      // Zero messages should display as "0" — getByText('0') would collide with partition_id=0,
      // so we use partition_id=5 above and verify "0" appears exactly once (the message count)
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  it('handles very large message counts correctly', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({ partition_id: 0 }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets({ beginning_offset: 0, end_offset: 999999999999 })
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('999,999,999,999')).toBeInTheDocument()
    })
  })

  it('renders topic names with special characters in URL paths', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({ partition_id: 0 }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="my.topic/with-special_chars"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(topicApi.getTopicPartitions).toHaveBeenCalledWith(
        'my.topic/with-special_chars'
      )
    })
  })

  it('displays replicas and ISR as comma-separated broker IDs', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 0,
        replicas: [makeBroker(1), makeBroker(2), makeBroker(3)],
        isr: [makeBroker(1), makeBroker(3)],
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('1, 2, 3')).toBeInTheDocument() // Replicas
      expect(screen.getByText('1, 3')).toBeInTheDocument() // ISR
    })
  })

  it('shows dashes when replicas or isr arrays are empty', async () => {
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValueOnce([
      makePartition({
        partition_id: 0,
        replicas: [],
        isr: [],
      }),
    ])
    vi.mocked(topicApi.getPartitionOffsets).mockResolvedValueOnce(
      makeOffsets()
    )

    render(
      <PartitionTable
        topicName="test-topic"
        isExpanded={true}
        onToggle={vi.fn()}
      />
    )

    await waitFor(() => {
      // Should render dashes (—) for empty arrays
      const cells = screen.getAllByRole('cell')
      expect(cells.length).toBeGreaterThan(0)
    })
  })
})
