/**
 * @phase-12.6-snippets
 * Phase 12.6 F6 — Query Templates / Saved SQL Snippets Library (Store Tests)
 *
 * Covers:
 *   - addSnippet stores snippet with auto-generated ID and timestamps
 *   - addSnippet returns { success: true } on success
 *   - addSnippet returns { success: false, error } when limit reached (100)
 *   - Snippets are sorted alphabetically after add
 *   - deleteSnippet removes a snippet by ID
 *   - renameSnippet updates the name and updatedAt; keeps sql and id
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkspaceStore } from '../../store/workspaceStore'

// ---------------------------------------------------------------------------
// Reset store before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  useWorkspaceStore.setState({
    snippets: [],
    toasts: [],
    configAuditLog: [],
  })
})

// ---------------------------------------------------------------------------
// Store unit tests
// ---------------------------------------------------------------------------

describe('[@phase-12.6-snippets] store — addSnippet', () => {
  it('adds a snippet and returns { success: true }', () => {
    const result = useWorkspaceStore.getState().addSnippet('My Query', 'SELECT 1')
    expect(result.success).toBe(true)
    const { snippets } = useWorkspaceStore.getState()
    expect(snippets).toHaveLength(1)
    expect(snippets[0]!.name).toBe('My Query')
    expect(snippets[0]!.sql).toBe('SELECT 1')
  })

  it('assigns a unique string ID to each snippet', () => {
    useWorkspaceStore.getState().addSnippet('A', 'SELECT 1')
    useWorkspaceStore.getState().addSnippet('B', 'SELECT 2')
    const { snippets } = useWorkspaceStore.getState()
    expect(snippets[0]!.id).toBeTruthy()
    expect(snippets[1]!.id).toBeTruthy()
    expect(snippets[0]!.id).not.toBe(snippets[1]!.id)
  })

  it('assigns valid ISO 8601 createdAt and updatedAt', () => {
    useWorkspaceStore.getState().addSnippet('A', 'SELECT 1')
    const { snippets } = useWorkspaceStore.getState()
    expect(new Date(snippets[0]!.createdAt).toISOString()).toBe(snippets[0]!.createdAt)
    expect(new Date(snippets[0]!.updatedAt).toISOString()).toBe(snippets[0]!.updatedAt)
  })

  it('sorts snippets alphabetically by name after add', () => {
    useWorkspaceStore.getState().addSnippet('Zebra Query', 'SELECT 1')
    useWorkspaceStore.getState().addSnippet('Apple Query', 'SELECT 2')
    useWorkspaceStore.getState().addSnippet('Mango Query', 'SELECT 3')
    const { snippets } = useWorkspaceStore.getState()
    expect(snippets[0]!.name).toBe('Apple Query')
    expect(snippets[1]!.name).toBe('Mango Query')
    expect(snippets[2]!.name).toBe('Zebra Query')
  })

  it('returns { success: false, error } when 100-snippet limit is reached', () => {
    for (let i = 0; i < 100; i++) {
      useWorkspaceStore.getState().addSnippet(`Snippet ${String(i).padStart(3, '0')}`, `SELECT ${i}`)
    }
    const result = useWorkspaceStore.getState().addSnippet('Overflow', 'SELECT 999')
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
    expect(useWorkspaceStore.getState().snippets).toHaveLength(100)
  })
})

describe('[@phase-12.6-snippets] store — deleteSnippet', () => {
  it('removes a snippet by ID', () => {
    useWorkspaceStore.getState().addSnippet('A', 'SELECT 1')
    const id = useWorkspaceStore.getState().snippets[0]!.id
    useWorkspaceStore.getState().deleteSnippet(id)
    expect(useWorkspaceStore.getState().snippets).toHaveLength(0)
  })

  it('does nothing if ID does not exist', () => {
    useWorkspaceStore.getState().addSnippet('A', 'SELECT 1')
    useWorkspaceStore.getState().deleteSnippet('non-existent-id')
    expect(useWorkspaceStore.getState().snippets).toHaveLength(1)
  })
})

describe('[@phase-12.6-snippets] store — renameSnippet', () => {
  it('updates name and updatedAt; preserves sql and id', async () => {
    useWorkspaceStore.getState().addSnippet('Original', 'SELECT 1')
    const original = useWorkspaceStore.getState().snippets[0]!
    await new Promise((r) => setTimeout(r, 2))
    useWorkspaceStore.getState().renameSnippet(original.id, 'Renamed')
    const updated = useWorkspaceStore.getState().snippets.find((s) => s.id === original.id)!
    expect(updated.name).toBe('Renamed')
    expect(updated.sql).toBe('SELECT 1')
    expect(updated.id).toBe(original.id)
    expect(updated.updatedAt).not.toBe(original.updatedAt)
  })
})
