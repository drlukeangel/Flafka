// [@ksql-api] — ksqlDB Axios client configuration tests

import { describe, it, expect, vi } from 'vitest'

const { createdClients } = vi.hoisted(() => {
  const createdClients: Array<{
    defaults: { baseURL: string; headers: Record<string, string> };
    interceptors: {
      request: { use: ReturnType<typeof import('vitest').vi.fn> };
      response: { use: ReturnType<typeof import('vitest').vi.fn> };
    };
  }> = []
  return { createdClients }
})

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>()
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn((config: any) => {
        const client = {
          defaults: {
            baseURL: config?.baseURL || '',
            headers: config?.headers || {},
          },
          interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
          },
        }
        createdClients.push(client)
        return client
      }),
      isAxiosError: vi.fn(),
    },
  }
})

// Import after mock — triggers module-level client creation
import '../../api/ksql-client'

describe('[@ksql-api] ksql-client', () => {
  // The ksql-client module creates one Axios instance with /api/ksql base
  const ksqlClientMock = createdClients.find(c => c.defaults.baseURL === '/api/ksql')

  it('creates an Axios instance with /api/ksql base URL', () => {
    expect(ksqlClientMock).toBeDefined()
    expect(ksqlClientMock!.defaults.baseURL).toBe('/api/ksql')
  })

  it('sets Content-Type to application/vnd.ksql.v1+json', () => {
    expect(ksqlClientMock!.defaults.headers['Content-Type']).toBe('application/vnd.ksql.v1+json')
  })

  it('sets Basic Auth header', () => {
    const authHeader = ksqlClientMock!.defaults.headers['Authorization']
    expect(authHeader).toBeDefined()
    expect(authHeader).toMatch(/^Basic /)
  })
})
