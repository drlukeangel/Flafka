// [@kafka-rest-client]
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Track each client instance created by axios.create so we can inspect
// interceptor registrations. vi.hoisted ensures this runs before vi.mock.
const { kafkaCreatedClients } = vi.hoisted(() => {
  const kafkaCreatedClients: Array<{
    interceptors: {
      request: { use: ReturnType<typeof import('vitest').vi.fn> };
      response: { use: ReturnType<typeof import('vitest').vi.fn> };
    };
    defaults: { baseURL?: string; headers?: Record<string, string> };
  }> = []
  return { kafkaCreatedClients }
})

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>()
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn((config?: { baseURL?: string; headers?: Record<string, string> }) => {
        const client = {
          interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
          },
          defaults: {
            baseURL: config?.baseURL,
            headers: config?.headers ?? {},
          },
        }
        kafkaCreatedClients.push(client)
        return client
      }),
      isAxiosError: vi.fn(),
    },
  }
})

// Mock environment so btoa() gets deterministic input
vi.mock('../../config/environment', () => ({
  env: {
    kafkaApiKey: 'test-kafka-key',
    kafkaApiSecret: 'test-kafka-secret',
  },
}))

// Import after mocking so the module initialises with our mocked axios.create
import '../../api/kafka-rest-client'

// Capture the single client created at module init time
const kafkaClientMock = kafkaCreatedClients[0]

// Snapshot interceptor callbacks before any clearAllMocks can wipe them
const kafkaReqCallbacks = {
  onFulfilled: kafkaClientMock?.interceptors.request.use.mock.calls[0]?.[0],
  onRejected: kafkaClientMock?.interceptors.request.use.mock.calls[0]?.[1],
}
const kafkaResCallbacks = {
  onFulfilled: kafkaClientMock?.interceptors.response.use.mock.calls[0]?.[0],
  onRejected: kafkaClientMock?.interceptors.response.use.mock.calls[0]?.[1],
}

describe('[@kafka-rest-client] Kafka REST Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Client creation
  // -------------------------------------------------------------------------

  it('creates exactly one axios client instance', () => {
    expect(kafkaCreatedClients).toHaveLength(1)
  })

  it('client has the correct baseURL', () => {
    expect(kafkaClientMock.defaults.baseURL).toBe('/api/kafka')
  })

  it('does NOT set Authorization header at client-creation time (injected per-request instead)', () => {
    // CRIT-1 fix: auth is now injected by the request interceptor so credentials
    // are evaluated on every call, not burned in at module-load time.
    expect(kafkaClientMock.defaults.headers?.['Authorization']).toBeUndefined()
  })

  it('request interceptor injects Authorization header with Base64-encoded credentials', () => {
    const expected = `Basic ${btoa('test-kafka-key:test-kafka-secret')}`
    const config: Record<string, unknown> = { method: 'get', url: '/test', headers: {} as Record<string, string> }
    const result = kafkaReqCallbacks.onFulfilled(config)
    expect((result as { headers: Record<string, string> }).headers?.['Authorization']).toBe(expected)
  })

  it('client has Content-Type set to application/json', () => {
    expect(kafkaClientMock.defaults.headers?.['Content-Type']).toBe('application/json')
  })

  // -------------------------------------------------------------------------
  // Interceptor registration
  // -------------------------------------------------------------------------

  it('registers request and response interceptors', () => {
    expect(kafkaReqCallbacks.onFulfilled).toBeTypeOf('function')
    expect(kafkaReqCallbacks.onRejected).toBeTypeOf('function')
    expect(kafkaResCallbacks.onFulfilled).toBeTypeOf('function')
    expect(kafkaResCallbacks.onRejected).toBeTypeOf('function')
  })

  // -------------------------------------------------------------------------
  // Request interceptor — success handler
  // -------------------------------------------------------------------------

  it('request interceptor success handler logs the request with [Kafka REST] prefix and returns config', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    // CRIT-1 fix: interceptor now also injects the Authorization header; pass headers object
    const config: Record<string, unknown> = { method: 'get', url: '/v3/clusters/lkc-123/topics', headers: {} as Record<string, string> }

    const result = kafkaReqCallbacks.onFulfilled(config)

    expect(result).toBe(config)
    // LOW-1: logging is guarded by import.meta.env.DEV (true in tests)
    expect(consoleSpy).toHaveBeenCalledWith('[Kafka REST] GET /v3/clusters/lkc-123/topics')
    consoleSpy.mockRestore()
  })

  it('request interceptor success handler uppercases the HTTP method', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const config: Record<string, unknown> = { method: 'post', url: '/v3/clusters/lkc-123/topics', headers: {} as Record<string, string> }

    kafkaReqCallbacks.onFulfilled(config)

    expect(consoleSpy).toHaveBeenCalledWith('[Kafka REST] POST /v3/clusters/lkc-123/topics')
    consoleSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Request interceptor — error handler
  // -------------------------------------------------------------------------

  it('request interceptor error handler logs the error and rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('request setup failed')

    await expect(kafkaReqCallbacks.onRejected(error)).rejects.toBe(error)
    expect(consoleSpy).toHaveBeenCalledWith('[Kafka REST Request Error]', error)
    consoleSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Response interceptor — success handler
  // -------------------------------------------------------------------------

  it('response interceptor success handler logs status and returns response', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    // LOW-1 fix: response data no longer logged to avoid leaking sensitive topic names
    const response = { status: 200, data: { kind: 'KafkaTopicList', data: [] } }

    const result = kafkaResCallbacks.onFulfilled(response)

    expect(result).toBe(response)
    expect(consoleSpy).toHaveBeenCalledWith('[Kafka REST Response] 200')
    consoleSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Response interceptor — error handler
  // -------------------------------------------------------------------------

  it('response interceptor error handler logs and rejects for non-network errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = {
      response: { status: 500, data: { message: 'Internal server error' } },
      message: 'Request failed with status 500',
    }

    await expect(kafkaResCallbacks.onRejected(error)).rejects.toBe(error)
    expect(consoleSpy).toHaveBeenCalledWith('[Kafka REST Error] 500: Internal server error')
    consoleSpy.mockRestore()
  })

  it('response interceptor error handler falls back to error.message when data.message is absent', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = {
      response: { status: 409, data: {} },
      message: 'Conflict',
    }

    await expect(kafkaResCallbacks.onRejected(error)).rejects.toBe(error)
    expect(consoleSpy).toHaveBeenCalledWith('[Kafka REST Error] 409: Conflict')
    consoleSpy.mockRestore()
  })

  it('response interceptor prefers response.data.message over error.message', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = {
      response: { status: 422, data: { message: 'Topic name is invalid' } },
      message: 'Request failed with status 422',
    }

    await expect(kafkaResCallbacks.onRejected(error)).rejects.toBe(error)
    expect(consoleSpy).toHaveBeenCalledWith('[Kafka REST Error] 422: Topic name is invalid')
    consoleSpy.mockRestore()
  })

  it('response interceptor error handler still rejects after logging', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = {
      response: { status: 403, data: { message: 'Forbidden' } },
      message: 'Request failed with status 403',
    }

    await expect(kafkaResCallbacks.onRejected(error)).rejects.toBe(error)
    consoleSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Response interceptor — handles missing response gracefully (network error)
  // -------------------------------------------------------------------------

  it('response interceptor handles missing response (network error) gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = { message: 'Network Error' }

    await expect(kafkaResCallbacks.onRejected(error)).rejects.toBe(error)
    expect(consoleSpy).toHaveBeenCalledWith('[Kafka REST Error] undefined: Network Error')
    consoleSpy.mockRestore()
  })
})
