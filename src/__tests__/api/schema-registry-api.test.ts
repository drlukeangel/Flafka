import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listSubjects,
  getSchemaDetail,
  getSchemaVersions,
  registerSchema,
  validateCompatibility,
  getCompatibilityMode,
  getCompatibilityModeWithSource,
  setCompatibilityMode,
  deleteSubject,
  deleteSchemaVersion,
  getSubjectsForSchemaId,
} from '../../api/schema-registry-api'
import { schemaRegistryClient } from '../../api/schema-registry-client'
import { env } from '../../config/environment'

vi.mock('../../api/schema-registry-client', () => ({
  schemaRegistryClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSchemaSubject(overrides: Partial<{
  subject: string
  version: number
  id: number
  schemaType: 'AVRO' | 'PROTOBUF' | 'JSON'
  schema: string
}> = {}) {
  return {
    subject: overrides.subject ?? 'test-subject',
    version: overrides.version ?? 1,
    id: overrides.id ?? 42,
    schemaType: overrides.schemaType ?? 'AVRO',
    schema: overrides.schema ?? '{"type":"record","name":"Test","fields":[]}',
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@schema-registry-api] schema-registry-api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // listSubjects
  // ==========================================================================

  describe('[@schema-registry-api] listSubjects', () => {
    it('returns an array of subject name strings', async () => {
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({
        data: ['subject-a', 'subject-b', 'subject-c'],
      })

      const result = await listSubjects()

      expect(schemaRegistryClient.get).toHaveBeenCalledWith('/subjects')
      expect(result).toEqual(['subject-a', 'subject-b', 'subject-c'])
    })

    it('filters by uniqueId when provided', async () => {
      const testId = 'TEST-123';
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({
        data: [`subject-a-${testId}`, 'subject-b', `subject-c-${testId}`],
      })

      const result = await listSubjects(testId)

      expect(result).toEqual([`subject-a-${testId}`, `subject-c-${testId}`])
    })

    it('returns an empty array when no subjects exist', async () => {
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: [] })

      const result = await listSubjects()

      expect(result).toEqual([])
    })

    it('throws on 401 Unauthorized', async () => {
      const error = new Error('401 Unauthorized')
      vi.mocked(schemaRegistryClient.get).mockRejectedValueOnce(error)

      await expect(listSubjects()).rejects.toThrow('401 Unauthorized')
    })

    it('throws on 500 Server Error', async () => {
      const error = new Error('500 Internal Server Error')
      vi.mocked(schemaRegistryClient.get).mockRejectedValueOnce(error)

      await expect(listSubjects()).rejects.toThrow('500 Internal Server Error')
    })

    it('throws on network failure', async () => {
      const error = new Error('Network Error')
      vi.mocked(schemaRegistryClient.get).mockRejectedValueOnce(error)

      await expect(listSubjects()).rejects.toThrow('Network Error')
    })
  })

  // ==========================================================================
  // getSchemaDetail
  // ==========================================================================

  describe('[@schema-registry-api] getSchemaDetail', () => {
    it('returns the schema detail for the latest version by default', async () => {
      const detail = makeSchemaSubject({ schemaType: 'AVRO' })
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: detail })

      const result = await getSchemaDetail('test-subject')

      expect(schemaRegistryClient.get).toHaveBeenCalledWith(
        `/subjects/${encodeURIComponent('test-subject')}/versions/latest`,
        undefined
      )
      expect(result.subject).toBe('test-subject')
      expect(result.schemaType).toBe('AVRO')
    })

    it('defaults schemaType to AVRO when the API response omits it', async () => {
      const detail = makeSchemaSubject()
      // Simulate the Confluent SR behaviour: AVRO schemas omit the schemaType field
      const { schemaType: _omitted, ...detailWithoutType } = detail
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: detailWithoutType })

      const result = await getSchemaDetail('avro-subject')

      expect(result.schemaType).toBe('AVRO')
    })

    it('preserves schemaType when the API response includes PROTOBUF', async () => {
      const detail = makeSchemaSubject({ schemaType: 'PROTOBUF' })
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: detail })

      const result = await getSchemaDetail('proto-subject')

      expect(result.schemaType).toBe('PROTOBUF')
    })

    it('preserves schemaType when the API response includes JSON', async () => {
      const detail = makeSchemaSubject({ schemaType: 'JSON' })
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: detail })

      const result = await getSchemaDetail('json-subject')

      expect(result.schemaType).toBe('JSON')
    })

    it('fetches a specific numeric version when provided', async () => {
      const detail = makeSchemaSubject({ version: 3 })
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: detail })

      const result = await getSchemaDetail('test-subject', 3)

      expect(schemaRegistryClient.get).toHaveBeenCalledWith(
        `/subjects/${encodeURIComponent('test-subject')}/versions/3`,
        undefined
      )
      expect(result.version).toBe(3)
    })

    it('URL-encodes the subject name in the request path', async () => {
      const detail = makeSchemaSubject({ subject: 'my-topic-value' })
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: detail })

      await getSchemaDetail('my-topic-value')

      const calledUrl = vi.mocked(schemaRegistryClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent('my-topic-value'))
    })

    it('throws on 404 when subject does not exist', async () => {
      const error = new Error('404 Not Found')
      vi.mocked(schemaRegistryClient.get).mockRejectedValueOnce(error)

      await expect(getSchemaDetail('missing-subject')).rejects.toThrow('404 Not Found')
    })

    it('throws on 500 Server Error', async () => {
      const error = new Error('500 Internal Server Error')
      vi.mocked(schemaRegistryClient.get).mockRejectedValueOnce(error)

      await expect(getSchemaDetail('test-subject')).rejects.toThrow('500 Internal Server Error')
    })
  })

  // ==========================================================================
  // getSchemaVersions
  // ==========================================================================

  describe('[@schema-registry-api] getSchemaVersions', () => {
    it('returns an array of version numbers for a subject', async () => {
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: [1, 2, 3] })

      const result = await getSchemaVersions('test-subject')

      expect(schemaRegistryClient.get).toHaveBeenCalledWith(
        `/subjects/${encodeURIComponent('test-subject')}/versions`
      )
      expect(result).toEqual([1, 2, 3])
    })

    it('returns an empty array when the subject has no versions', async () => {
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: [] })

      const result = await getSchemaVersions('empty-subject')

      expect(result).toEqual([])
    })

    it('URL-encodes the subject name', async () => {
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: [1] })

      await getSchemaVersions('topic.name-value')

      const calledUrl = vi.mocked(schemaRegistryClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent('topic.name-value'))
    })

    it('throws on 404 when subject does not exist', async () => {
      const error = new Error('404 Not Found')
      vi.mocked(schemaRegistryClient.get).mockRejectedValueOnce(error)

      await expect(getSchemaVersions('missing')).rejects.toThrow('404 Not Found')
    })

    it('throws on 500 Server Error', async () => {
      const error = new Error('500 Internal Server Error')
      vi.mocked(schemaRegistryClient.get).mockRejectedValueOnce(error)

      await expect(getSchemaVersions('test-subject')).rejects.toThrow('500 Internal Server Error')
    })
  })

  // ==========================================================================
  // registerSchema
  // ==========================================================================

  describe('[@schema-registry-api] registerSchema', () => {
    it('posts schema and returns the assigned id with tagged subject', async () => {
      vi.mocked(schemaRegistryClient.post).mockResolvedValueOnce({ data: { id: 101 } })
      const taggedSubject = `user-value-${env.uniqueId}`

      const schemaStr = '{"type":"record","name":"User","fields":[]}'
      const result = await registerSchema('user-value', schemaStr, 'AVRO')

      expect(schemaRegistryClient.post).toHaveBeenCalledWith(
        `/subjects/${encodeURIComponent(taggedSubject)}/versions`,
        { schema: schemaStr, schemaType: 'AVRO' }
      )
      expect(result).toEqual({ id: 101 })
    })

    it('sends the correct schemaType in the request body with tagged subject', async () => {
      vi.mocked(schemaRegistryClient.post).mockResolvedValueOnce({ data: { id: 202 } })
      const taggedSubject = `msg-value-${env.uniqueId}`

      const schemaStr = 'syntax = "proto3"; message Msg {}'
      await registerSchema('msg-value', schemaStr, 'PROTOBUF')

      const [url, payload] = vi.mocked(schemaRegistryClient.post).mock.calls[0] as [string, { schema: string; schemaType: string }]
      expect(url).toContain(encodeURIComponent(taggedSubject))
      expect(payload.schemaType).toBe('PROTOBUF')
      expect(payload.schema).toBe(schemaStr)
    })

    it('URL-encodes the subject name and tags it', async () => {
      vi.mocked(schemaRegistryClient.post).mockResolvedValueOnce({ data: { id: 1 } })
      const taggedSubject = `my topic/value-${env.uniqueId}`

      await registerSchema('my topic/value', '{}', 'JSON')

      const [calledUrl] = vi.mocked(schemaRegistryClient.post).mock.calls[0] as [string, unknown]
      expect(calledUrl).toContain(encodeURIComponent(taggedSubject))
    })

    it('throws on 409 Conflict (schema already registered)', async () => {
      const error = new Error('409 Conflict')
      vi.mocked(schemaRegistryClient.post).mockRejectedValueOnce(error)

      await expect(registerSchema('test-subject', '{}', 'AVRO')).rejects.toThrow('409 Conflict')
    })

    it('throws on 422 Unprocessable Entity (invalid schema)', async () => {
      const error = new Error('422 Unprocessable Entity')
      vi.mocked(schemaRegistryClient.post).mockRejectedValueOnce(error)

      await expect(registerSchema('test-subject', 'not-valid-avro', 'AVRO')).rejects.toThrow('422 Unprocessable Entity')
    })

    it('throws on 500 Server Error', async () => {
      const error = new Error('500 Internal Server Error')
      vi.mocked(schemaRegistryClient.post).mockRejectedValueOnce(error)

      await expect(registerSchema('test-subject', '{}', 'AVRO')).rejects.toThrow('500 Internal Server Error')
    })
  })

  // ==========================================================================
  // validateCompatibility
  // ==========================================================================

  describe('[@schema-registry-api] validateCompatibility', () => {
    it('returns { is_compatible: true } when schema is compatible', async () => {
      vi.mocked(schemaRegistryClient.post).mockResolvedValueOnce({ data: { is_compatible: true } })

      const result = await validateCompatibility('user-value', '{"type":"record","name":"User","fields":[]}', 'AVRO')

      expect(schemaRegistryClient.post).toHaveBeenCalledWith(
        `/compatibility/subjects/${encodeURIComponent('user-value')}/versions/latest`,
        { schema: '{"type":"record","name":"User","fields":[]}', schemaType: 'AVRO' }
      )
      expect(result).toEqual({ is_compatible: true })
    })

    it('returns { is_compatible: false } when schema is incompatible', async () => {
      vi.mocked(schemaRegistryClient.post).mockResolvedValueOnce({ data: { is_compatible: false } })

      const result = await validateCompatibility('user-value', '{"type":"string"}', 'AVRO')

      expect(result).toEqual({ is_compatible: false })
    })

    it('uses "latest" as the default version when none is specified', async () => {
      vi.mocked(schemaRegistryClient.post).mockResolvedValueOnce({ data: { is_compatible: true } })

      await validateCompatibility('test-subject', '{}', 'JSON')

      const [calledUrl] = vi.mocked(schemaRegistryClient.post).mock.calls[0] as [string, unknown]
      expect(calledUrl).toContain('/versions/latest')
    })

    it('uses the specified numeric version when provided', async () => {
      vi.mocked(schemaRegistryClient.post).mockResolvedValueOnce({ data: { is_compatible: true } })

      await validateCompatibility('test-subject', '{}', 'AVRO', 5)

      const [calledUrl] = vi.mocked(schemaRegistryClient.post).mock.calls[0] as [string, unknown]
      expect(calledUrl).toContain('/versions/5')
    })

    it('URL-encodes the subject name', async () => {
      vi.mocked(schemaRegistryClient.post).mockResolvedValueOnce({ data: { is_compatible: true } })

      await validateCompatibility('my-topic+value', '{}', 'AVRO')

      const [calledUrl] = vi.mocked(schemaRegistryClient.post).mock.calls[0] as [string, unknown]
      expect(calledUrl).toContain(encodeURIComponent('my-topic+value'))
    })

    it('throws on 404 when subject does not exist', async () => {
      const error = new Error('404 Not Found')
      vi.mocked(schemaRegistryClient.post).mockRejectedValueOnce(error)

      await expect(validateCompatibility('missing', '{}', 'AVRO')).rejects.toThrow('404 Not Found')
    })

    it('throws on 500 Server Error', async () => {
      const error = new Error('500 Internal Server Error')
      vi.mocked(schemaRegistryClient.post).mockRejectedValueOnce(error)

      await expect(validateCompatibility('test-subject', '{}', 'AVRO')).rejects.toThrow('500 Internal Server Error')
    })
  })

  // ==========================================================================
  // getCompatibilityMode
  // ==========================================================================

  describe('[@schema-registry-api] getCompatibilityMode', () => {
    it('returns the subject-level compatibility level on success', async () => {
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({
        data: { compatibilityLevel: 'FULL' },
      })

      const result = await getCompatibilityMode('test-subject')

      expect(schemaRegistryClient.get).toHaveBeenCalledWith(
        `/config/${encodeURIComponent('test-subject')}`
      )
      expect(result).toBe('FULL')
    })

    it('falls back to the global /config endpoint on a 404', async () => {
      const notFoundError = { response: { status: 404 } }
      vi.mocked(schemaRegistryClient.get)
        .mockRejectedValueOnce(notFoundError)
        .mockResolvedValueOnce({ data: { compatibilityLevel: 'BACKWARD' } })

      const result = await getCompatibilityMode('unknown-subject')

      expect(schemaRegistryClient.get).toHaveBeenCalledTimes(2)
      const secondCallUrl = vi.mocked(schemaRegistryClient.get).mock.calls[1][0] as string
      expect(secondCallUrl).toBe('/config')
      expect(result).toBe('BACKWARD')
    })

    it('re-throws non-404 errors without falling back', async () => {
      const serverError = { response: { status: 500 }, message: '500 Internal Server Error' }
      vi.mocked(schemaRegistryClient.get).mockRejectedValueOnce(serverError)

      await expect(getCompatibilityMode('test-subject')).rejects.toMatchObject({ response: { status: 500 } })
      // The global config endpoint must NOT have been called
      expect(schemaRegistryClient.get).toHaveBeenCalledTimes(1)
    })

    it('re-throws 401 errors without falling back', async () => {
      const authError = { response: { status: 401 }, message: '401 Unauthorized' }
      vi.mocked(schemaRegistryClient.get).mockRejectedValueOnce(authError)

      await expect(getCompatibilityMode('test-subject')).rejects.toMatchObject({ response: { status: 401 } })
      expect(schemaRegistryClient.get).toHaveBeenCalledTimes(1)
    })

    it('re-throws network errors (no response object) without falling back', async () => {
      const networkError = new Error('Network Error')
      vi.mocked(schemaRegistryClient.get).mockRejectedValueOnce(networkError)

      await expect(getCompatibilityMode('test-subject')).rejects.toThrow('Network Error')
      expect(schemaRegistryClient.get).toHaveBeenCalledTimes(1)
    })

    it('URL-encodes the subject name in the subject-level config URL', async () => {
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({
        data: { compatibilityLevel: 'NONE' },
      })

      await getCompatibilityMode('topic/with/slashes')

      const calledUrl = vi.mocked(schemaRegistryClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent('topic/with/slashes'))
    })

    it('returns all valid CompatibilityLevel values correctly', async () => {
      const levels = ['BACKWARD', 'FORWARD', 'FULL', 'NONE', 'BACKWARD_TRANSITIVE', 'FORWARD_TRANSITIVE', 'FULL_TRANSITIVE'] as const

      for (const level of levels) {
        vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({
          data: { compatibilityLevel: level },
        })

        const result = await getCompatibilityMode('test-subject')
        expect(result).toBe(level)
      }
    })
  })

  // ==========================================================================
  // setCompatibilityMode
  // ==========================================================================

  describe('[@schema-registry-api] setCompatibilityMode', () => {
    it('puts the compatibility level and returns the response', async () => {
      vi.mocked(schemaRegistryClient.put).mockResolvedValueOnce({ data: { compatibility: 'FULL' } })

      const result = await setCompatibilityMode('test-subject', 'FULL')

      expect(schemaRegistryClient.put).toHaveBeenCalledWith(
        `/config/${encodeURIComponent('test-subject')}`,
        { compatibility: 'FULL' }
      )
      expect(result).toEqual({ compatibility: 'FULL' })
    })

    it('sends the correct compatibility value in the request body', async () => {
      vi.mocked(schemaRegistryClient.put).mockResolvedValueOnce({ data: { compatibility: 'BACKWARD' } })

      await setCompatibilityMode('test-subject', 'BACKWARD')

      const [, payload] = vi.mocked(schemaRegistryClient.put).mock.calls[0] as [string, { compatibility: string }]
      expect(payload.compatibility).toBe('BACKWARD')
    })

    it('URL-encodes the subject name', async () => {
      vi.mocked(schemaRegistryClient.put).mockResolvedValueOnce({ data: { compatibility: 'NONE' } })

      await setCompatibilityMode('topic.name-value', 'NONE')

      const [calledUrl] = vi.mocked(schemaRegistryClient.put).mock.calls[0] as [string, unknown]
      expect(calledUrl).toContain(encodeURIComponent('topic.name-value'))
    })

    it('throws on 422 Unprocessable Entity (invalid level)', async () => {
      const error = new Error('422 Unprocessable Entity')
      vi.mocked(schemaRegistryClient.put).mockRejectedValueOnce(error)

      await expect(setCompatibilityMode('test-subject', 'NONE')).rejects.toThrow('422 Unprocessable Entity')
    })

    it('throws on 500 Server Error', async () => {
      const error = new Error('500 Internal Server Error')
      vi.mocked(schemaRegistryClient.put).mockRejectedValueOnce(error)

      await expect(setCompatibilityMode('test-subject', 'FORWARD')).rejects.toThrow('500 Internal Server Error')
    })
  })

  // ==========================================================================
  // deleteSubject
  // ==========================================================================

  describe('[@schema-registry-api] deleteSubject', () => {
    it('deletes the subject and returns the list of deleted version numbers', async () => {
      vi.mocked(schemaRegistryClient.delete).mockResolvedValueOnce({ data: [1, 2, 3] })

      const result = await deleteSubject('test-subject')

      expect(schemaRegistryClient.delete).toHaveBeenCalledWith(
        `/subjects/${encodeURIComponent('test-subject')}`
      )
      expect(result).toEqual([1, 2, 3])
    })

    it('returns an empty array when the subject had no versions', async () => {
      vi.mocked(schemaRegistryClient.delete).mockResolvedValueOnce({ data: [] })

      const result = await deleteSubject('empty-subject')

      expect(result).toEqual([])
    })

    it('URL-encodes the subject name', async () => {
      vi.mocked(schemaRegistryClient.delete).mockResolvedValueOnce({ data: [1] })

      await deleteSubject('my/topic+value')

      const calledUrl = vi.mocked(schemaRegistryClient.delete).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent('my/topic+value'))
    })

    it('throws on 404 when subject does not exist', async () => {
      const error = new Error('404 Not Found')
      vi.mocked(schemaRegistryClient.delete).mockRejectedValueOnce(error)

      await expect(deleteSubject('missing-subject')).rejects.toThrow('404 Not Found')
    })

    it('throws on 500 Server Error', async () => {
      const error = new Error('500 Internal Server Error')
      vi.mocked(schemaRegistryClient.delete).mockRejectedValueOnce(error)

      await expect(deleteSubject('test-subject')).rejects.toThrow('500 Internal Server Error')
    })

    it('throws on network failure', async () => {
      const error = new Error('Network Error')
      vi.mocked(schemaRegistryClient.delete).mockRejectedValueOnce(error)

      await expect(deleteSubject('test-subject')).rejects.toThrow('Network Error')
    })
  })

  // ==========================================================================
  // deleteSchemaVersion
  // ==========================================================================

  describe('[@schema-registry-api] deleteSchemaVersion', () => {
    it('deletes a specific version and returns the deleted version number', async () => {
      vi.mocked(schemaRegistryClient.delete).mockResolvedValueOnce({ data: 2 })

      const result = await deleteSchemaVersion('test-subject', 2)

      expect(schemaRegistryClient.delete).toHaveBeenCalledWith(
        `/subjects/${encodeURIComponent('test-subject')}/versions/2`
      )
      expect(result).toBe(2)
    })

    it('URL-encodes the subject name in the version delete path', async () => {
      vi.mocked(schemaRegistryClient.delete).mockResolvedValueOnce({ data: 1 })

      await deleteSchemaVersion('my topic value', 1)

      const calledUrl = vi.mocked(schemaRegistryClient.delete).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent('my topic value'))
      expect(calledUrl).toContain('/versions/1')
    })

    it('includes the correct version number in the URL', async () => {
      vi.mocked(schemaRegistryClient.delete).mockResolvedValueOnce({ data: 7 })

      await deleteSchemaVersion('test-subject', 7)

      const calledUrl = vi.mocked(schemaRegistryClient.delete).mock.calls[0][0] as string
      expect(calledUrl).toContain('/versions/7')
    })

    it('throws on 404 when subject or version does not exist', async () => {
      const error = new Error('404 Not Found')
      vi.mocked(schemaRegistryClient.delete).mockRejectedValueOnce(error)

      await expect(deleteSchemaVersion('missing-subject', 1)).rejects.toThrow('404 Not Found')
    })

    it('throws on 422 Unprocessable Entity (only version, soft delete not allowed)', async () => {
      const error = new Error('422 Unprocessable Entity')
      vi.mocked(schemaRegistryClient.delete).mockRejectedValueOnce(error)

      await expect(deleteSchemaVersion('test-subject', 1)).rejects.toThrow('422 Unprocessable Entity')
    })

    it('throws on 500 Server Error', async () => {
      const error = new Error('500 Internal Server Error')
      vi.mocked(schemaRegistryClient.delete).mockRejectedValueOnce(error)

      await expect(deleteSchemaVersion('test-subject', 3)).rejects.toThrow('500 Internal Server Error')
    })
  })

  // ==========================================================================
  // getSubjectsForSchemaId
  // ==========================================================================

  describe('[@schema-registry-api] getSubjectsForSchemaId', () => {
    it('calls GET /schemas/ids/{id}/subjects and returns subject names', async () => {
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({
        data: ['orders-value', 'orders-key', 'payments-value'],
      })

      const result = await getSubjectsForSchemaId(100005)

      expect(schemaRegistryClient.get).toHaveBeenCalledWith(
        '/schemas/ids/100005/subjects',
        undefined
      )
      expect(result).toEqual(['orders-value', 'orders-key', 'payments-value'])
    })

    it('returns an empty array when no subjects reference this schema', async () => {
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: [] })

      const result = await getSubjectsForSchemaId(99999)

      expect(result).toEqual([])
    })

    it('passes abort signal when provided', async () => {
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({
        data: ['test-value'],
      })
      const controller = new AbortController()

      await getSubjectsForSchemaId(42, { signal: controller.signal })

      expect(schemaRegistryClient.get).toHaveBeenCalledWith(
        '/schemas/ids/42/subjects',
        { signal: controller.signal }
      )
    })

    it('does not pass signal config when no options provided', async () => {
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: [] })

      await getSubjectsForSchemaId(1)

      expect(schemaRegistryClient.get).toHaveBeenCalledWith(
        '/schemas/ids/1/subjects',
        undefined
      )
    })

    it('throws on 404 when schema id does not exist', async () => {
      const error = new Error('404 Not Found')
      vi.mocked(schemaRegistryClient.get).mockRejectedValueOnce(error)

      await expect(getSubjectsForSchemaId(0)).rejects.toThrow('404 Not Found')
    })

    it('throws on 500 Server Error', async () => {
      const error = new Error('500 Internal Server Error')
      vi.mocked(schemaRegistryClient.get).mockRejectedValueOnce(error)

      await expect(getSubjectsForSchemaId(42)).rejects.toThrow('500 Internal Server Error')
    })
  })

  // ==========================================================================
  // getCompatibilityModeWithSource
  // ==========================================================================

  describe('[@schema-registry-api] getCompatibilityModeWithSource', () => {
    it('returns subject-level compatibility with isGlobal=false', async () => {
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({
        data: { compatibilityLevel: 'FULL' },
      })

      const result = await getCompatibilityModeWithSource('test-subject')

      expect(schemaRegistryClient.get).toHaveBeenCalledWith(
        `/config/${encodeURIComponent('test-subject')}`
      )
      expect(result).toEqual({ level: 'FULL', isGlobal: false })
    })

    it('falls back to global /config on 404 with isGlobal=true', async () => {
      const notFoundError = { response: { status: 404 } }
      vi.mocked(schemaRegistryClient.get)
        .mockRejectedValueOnce(notFoundError)
        .mockResolvedValueOnce({ data: { compatibilityLevel: 'BACKWARD' } })

      const result = await getCompatibilityModeWithSource('unknown-subject')

      expect(schemaRegistryClient.get).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ level: 'BACKWARD', isGlobal: true })
    })

    it('re-throws non-404 errors without falling back', async () => {
      const serverError = { response: { status: 500 }, message: '500 Internal Server Error' }
      vi.mocked(schemaRegistryClient.get).mockRejectedValueOnce(serverError)

      await expect(getCompatibilityModeWithSource('test-subject')).rejects.toMatchObject({ response: { status: 500 } })
      expect(schemaRegistryClient.get).toHaveBeenCalledTimes(1)
    })

    it('re-throws network errors (no response object) without falling back', async () => {
      const networkError = new Error('Network Error')
      vi.mocked(schemaRegistryClient.get).mockRejectedValueOnce(networkError)

      await expect(getCompatibilityModeWithSource('test-subject')).rejects.toThrow('Network Error')
      expect(schemaRegistryClient.get).toHaveBeenCalledTimes(1)
    })
  })

  // ==========================================================================
  // getSchemaDetail — AbortSignal support
  // ==========================================================================

  describe('[@schema-registry-api] getSchemaDetail - signal support', () => {
    it('passes abort signal when provided', async () => {
      const detail = makeSchemaSubject()
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: detail })
      const controller = new AbortController()

      await getSchemaDetail('test-subject', 'latest', { signal: controller.signal })

      expect(schemaRegistryClient.get).toHaveBeenCalledWith(
        expect.stringContaining('test-subject'),
        { signal: controller.signal }
      )
    })

    it('does not pass signal config when options are undefined', async () => {
      const detail = makeSchemaSubject()
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: detail })

      await getSchemaDetail('test-subject', 'latest')

      expect(schemaRegistryClient.get).toHaveBeenCalledWith(
        expect.stringContaining('test-subject'),
        undefined
      )
    })

    it('does not pass signal config when signal is undefined in options', async () => {
      const detail = makeSchemaSubject()
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: detail })

      await getSchemaDetail('test-subject', 'latest', {})

      expect(schemaRegistryClient.get).toHaveBeenCalledWith(
        expect.stringContaining('test-subject'),
        undefined
      )
    })
  })

  // ==========================================================================
  // URL encoding — special character subject names
  // ==========================================================================

  describe('[@schema-registry-api] URL encoding', () => {
    it('encodes subject names containing forward slashes', async () => {
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({
        data: makeSchemaSubject({ subject: 'namespace/topic-value' }),
      })

      await getSchemaDetail('namespace/topic-value')

      const calledUrl = vi.mocked(schemaRegistryClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent('namespace/topic-value'))
      // Raw slash must not appear in the subject portion of the path
      expect(calledUrl).not.toContain('/subjects/namespace/topic-value/versions')
    })

    it('encodes subject names containing spaces', async () => {
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: [1, 2] })

      await getSchemaVersions('my subject name')

      const calledUrl = vi.mocked(schemaRegistryClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent('my subject name'))
    })

    it('encodes subject names containing plus signs', async () => {
      vi.mocked(schemaRegistryClient.post).mockResolvedValueOnce({ data: { id: 99 } })

      await registerSchema('topic+value', '{}', 'AVRO')

      const [calledUrl] = vi.mocked(schemaRegistryClient.post).mock.calls[0] as [string, unknown]
      expect(calledUrl).toContain(encodeURIComponent('topic+value'))
    })

    it('encodes subject names containing dots and dashes', async () => {
      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({ data: { compatibilityLevel: 'NONE' } })

      await getCompatibilityMode('my.topic-name.value')

      const calledUrl = vi.mocked(schemaRegistryClient.get).mock.calls[0][0] as string
      // Dots and dashes are not encoded by encodeURIComponent, but the call should succeed
      expect(calledUrl).toContain('my.topic-name.value')
    })

    it('encodes subject names with percent signs', async () => {
      vi.mocked(schemaRegistryClient.delete).mockResolvedValueOnce({ data: [1] })

      await deleteSubject('topic%20name')

      const calledUrl = vi.mocked(schemaRegistryClient.delete).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent('topic%20name'))
    })

    it('encodes subject names with colons (Kafka-style fully-qualified names)', async () => {
      vi.mocked(schemaRegistryClient.put).mockResolvedValueOnce({ data: { compatibility: 'FULL' } })

      await setCompatibilityMode('lkc-abc123:my-topic-value', 'FULL')

      const [calledUrl] = vi.mocked(schemaRegistryClient.put).mock.calls[0] as [string, unknown]
      expect(calledUrl).toContain(encodeURIComponent('lkc-abc123:my-topic-value'))
    })

    it('encodes subject names containing ampersands in compatibility validation', async () => {
      vi.mocked(schemaRegistryClient.post).mockResolvedValueOnce({ data: { is_compatible: true } })

      await validateCompatibility('topic&name', '{}', 'AVRO')

      const [calledUrl] = vi.mocked(schemaRegistryClient.post).mock.calls[0] as [string, unknown]
      expect(calledUrl).toContain(encodeURIComponent('topic&name'))
    })

    it('encodes subject names when deleting a specific version', async () => {
      vi.mocked(schemaRegistryClient.delete).mockResolvedValueOnce({ data: 1 })

      await deleteSchemaVersion('path/to/subject', 1)

      const calledUrl = vi.mocked(schemaRegistryClient.delete).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent('path/to/subject'))
      expect(calledUrl).toContain('/versions/1')
    })
  })
})
