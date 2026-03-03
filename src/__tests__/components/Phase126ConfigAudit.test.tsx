/**
 * @phase-12.6-config-audit
 * Phase 12.6 F1 — Config Edit Audit Log
 *
 * Covers:
 *   - addConfigAuditEntry stores entries in configAuditLog
 *   - getConfigAuditLogForTopic returns only entries for that topic
 *   - FIFO cap: audit log is trimmed to 200 entries
 *   - Entries are prepended (newest first)
 *   - timestamp is auto-added as ISO 8601 string
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkspaceStore } from '../../store/workspaceStore'

// ---------------------------------------------------------------------------
// Reset store before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  useWorkspaceStore.setState({
    configAuditLog: [],
    snippets: [],
    toasts: [],
  })
})

// ---------------------------------------------------------------------------
// Unit tests: store actions
// ---------------------------------------------------------------------------

describe('[@phase-12.6-config-audit] store — addConfigAuditEntry', () => {
  it('adds an entry with auto-generated ISO timestamp', () => {
    const store = useWorkspaceStore.getState()
    store.addConfigAuditEntry({
      topicName: 'my-topic',
      configKey: 'retention.ms',
      oldValue: '86400000',
      newValue: '172800000',
    })
    const { configAuditLog } = useWorkspaceStore.getState()
    expect(configAuditLog).toHaveLength(1)
    expect(configAuditLog[0]!.topicName).toBe('my-topic')
    expect(configAuditLog[0]!.configKey).toBe('retention.ms')
    expect(configAuditLog[0]!.oldValue).toBe('86400000')
    expect(configAuditLog[0]!.newValue).toBe('172800000')
    // timestamp must be a valid ISO 8601 string
    expect(() => new Date(configAuditLog[0]!.timestamp)).not.toThrow()
    expect(new Date(configAuditLog[0]!.timestamp).toISOString()).toBe(configAuditLog[0]!.timestamp)
  })

  it('prepends entries (newest first)', () => {
    const store = useWorkspaceStore.getState()
    store.addConfigAuditEntry({ topicName: 't', configKey: 'k', oldValue: 'a', newValue: 'b' })
    store.addConfigAuditEntry({ topicName: 't', configKey: 'k', oldValue: 'b', newValue: 'c' })
    const { configAuditLog } = useWorkspaceStore.getState()
    expect(configAuditLog[0]!.newValue).toBe('c')
    expect(configAuditLog[1]!.newValue).toBe('b')
  })

  it('caps audit log at 200 entries (FIFO)', () => {
    const store = useWorkspaceStore.getState()
    for (let i = 0; i < 205; i++) {
      store.addConfigAuditEntry({ topicName: 't', configKey: `k${i}`, oldValue: 'x', newValue: 'y' })
    }
    const { configAuditLog } = useWorkspaceStore.getState()
    expect(configAuditLog.length).toBe(200)
    // The most recent entry should be first
    expect(configAuditLog[0]!.configKey).toBe('k204')
  })
})

describe('[@phase-12.6-config-audit] store — getConfigAuditLogForTopic', () => {
  it('returns only entries matching the given topic', () => {
    const store = useWorkspaceStore.getState()
    store.addConfigAuditEntry({ topicName: 'topic-A', configKey: 'k', oldValue: '1', newValue: '2' })
    store.addConfigAuditEntry({ topicName: 'topic-B', configKey: 'k', oldValue: '3', newValue: '4' })
    store.addConfigAuditEntry({ topicName: 'topic-A', configKey: 'j', oldValue: '5', newValue: '6' })

    const entriesA = useWorkspaceStore.getState().getConfigAuditLogForTopic('topic-A')
    expect(entriesA).toHaveLength(2)
    entriesA.forEach((e) => expect(e.topicName).toBe('topic-A'))
  })

  it('returns empty array when no entries exist for that topic', () => {
    const entries = useWorkspaceStore.getState().getConfigAuditLogForTopic('no-such-topic')
    expect(entries).toEqual([])
  })
})
