// [@schema-registry-client]
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Track each client instance created by axios.create so we can inspect
// interceptor registrations. vi.hoisted ensures this runs before vi.mock.
const { srCreatedClients } = vi.hoisted(() => {
  const srCreatedClients: Array<{
    interceptors: {
      request: { use: ReturnType<typeof import('vitest').vi.fn> };
      response: { use: ReturnType<typeof import('vitest').vi.fn> };
    };
    defaults: { baseURL?: string; headers?: Record<string, string> };
  }> = []
  return { srCreatedClients }
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
        srCreatedClients.push(client)
        return client
      }),
      isAxiosError: vi.fn(),
    },
  }
})

// Mock environment so btoa() gets deterministic input
vi.mock('../../config/environment', () => ({
  env: {
    schemaRegistryKey: 'test-sr-key',
    schemaRegistrySecret: 'test-sr-secret',
  },
}))

// Import after mocking so the module initialises with our mocked axios.create
import '../../api/schema-registry-client'

// Capture the single client created at module init time
const srClientMock = srCreatedClients[0]

// Snapshot interceptor callbacks before any clearAllMocks can wipe them
const srReqCallbacks = {
  onFulfilled: srClientMock?.interceptors.request.use.mock.calls[0]?.[0],
  onRejected: srClientMock?.interceptors.request.use.mock.calls[0]?.[1],
}
const srResCallbacks = {
  onFulfilled: srClientMock?.interceptors.response.use.mock.calls[0]?.[0],
  onRejected: srClientMock?.interceptors.response.use.mock.calls[0]?.[1],
}

describe('[@schema-registry-client] Schema Registry Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Client creation
  // -------------------------------------------------------------------------

  it('creates exactly one axios client instance', () => {
    expect(srCreatedClients).toHaveLength(1)
  })

  it('client has the correct baseURL', () => {
    expect(srClientMock.defaults.baseURL).toBe('/api/schema-registry')
  })

  it('client has Authorization header with Base64-encoded credentials', () => {
    const expected = `Basic ${btoa('test-sr-key:test-sr-secret')}`
    expect(srClientMock.defaults.headers?.['Authorization']).toBe(expected)
  })

  it('client has Content-Type set to application/vnd.schemaregistry.v1+json', () => {
    expect(srClientMock.defaults.headers?.['Content-Type']).toBe(
      'application/vnd.schemaregistry.v1+json'
    )
  })

  // -------------------------------------------------------------------------
  // Interceptor registration
  // -------------------------------------------------------------------------

  it('registers request and response interceptors', () => {
    expect(srReqCallbacks.onFulfilled).toBeTypeOf('function')
    expect(srReqCallbacks.onRejected).toBeTypeOf('function')
    expect(srResCallbacks.onFulfilled).toBeTypeOf('function')
    expect(srResCallbacks.onRejected).toBeTypeOf('function')
  })

  // -------------------------------------------------------------------------
  // Request interceptor — success handler
  // -------------------------------------------------------------------------

  it('request interceptor success handler logs the request and returns config', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const config = { method: 'get', url: '/subjects' }

    const result = srReqCallbacks.onFulfilled(config)

    expect(result).toBe(config)
    expect(consoleSpy).toHaveBeenCalledWith('[Schema Registry] GET /subjects')
    consoleSpy.mockRestore()
  })

  it('request interceptor success handler uppercases the HTTP method', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const config = { method: 'post', url: '/subjects/my-subject/versions' }

    srReqCallbacks.onFulfilled(config)

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Schema Registry] POST /subjects/my-subject/versions'
    )
    consoleSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Request interceptor — error handler
  // -------------------------------------------------------------------------

  it('request interceptor error handler logs the error and rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('request setup failed')

    await expect(srReqCallbacks.onRejected(error)).rejects.toBe(error)
    expect(consoleSpy).toHaveBeenCalledWith('[Schema Registry Request Error]', error)
    consoleSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Response interceptor — success handler
  // -------------------------------------------------------------------------

  it('response interceptor success handler logs status and data, returns response', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = { status: 200, data: { id: 42 } }

    const result = srResCallbacks.onFulfilled(response)

    expect(result).toBe(response)
    expect(consoleSpy).toHaveBeenCalledWith('[Schema Registry Response] 200', { id: 42 })
    consoleSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Response interceptor — error handler (non-404)
  // -------------------------------------------------------------------------

  it('response interceptor error handler logs and rejects for non-404 errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = {
      response: { status: 500, data: { message: 'Internal server error' } },
      message: 'Request failed with status 500',
    }

    await expect(srResCallbacks.onRejected(error)).rejects.toBe(error)
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Schema Registry Error] 500: Internal server error'
    )
    consoleSpy.mockRestore()
  })

  it('response interceptor error handler falls back to error.message when data.message is absent', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = {
      response: { status: 409, data: {} },
      message: 'Conflict',
    }

    await expect(srResCallbacks.onRejected(error)).rejects.toBe(error)
    expect(consoleSpy).toHaveBeenCalledWith('[Schema Registry Error] 409: Conflict')
    consoleSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Response interceptor — error handler (404 suppressed)
  // -------------------------------------------------------------------------

  it('response interceptor does NOT log for 404 errors (suppressed)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = {
      response: { status: 404, data: { message: 'Subject not found' } },
      message: 'Request failed with status 404',
    }

    await expect(srResCallbacks.onRejected(error)).rejects.toBe(error)
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('404 error is still rejected (not swallowed) even though logging is suppressed', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = { response: { status: 404 }, message: 'Not Found' }

    await expect(srResCallbacks.onRejected(error)).rejects.toBe(error)
    consoleSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Response interceptor — uses data.message when available
  // -------------------------------------------------------------------------

  it('response interceptor prefers response.data.message over error.message', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = {
      response: { status: 422, data: { message: 'Schema evolution not allowed' } },
      message: 'Request failed with status 422',
    }

    await expect(srResCallbacks.onRejected(error)).rejects.toBe(error)
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Schema Registry Error] 422: Schema evolution not allowed'
    )
    consoleSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Response interceptor — handles missing response gracefully
  // -------------------------------------------------------------------------

  it('response interceptor handles missing response (network error) gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = { message: 'Network Error' }

    await expect(srResCallbacks.onRejected(error)).rejects.toBe(error)
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Schema Registry Error] undefined: Network Error'
    )
    consoleSpy.mockRestore()
  })
})
