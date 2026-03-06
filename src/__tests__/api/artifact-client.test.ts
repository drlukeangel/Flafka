// [@artifact-client] [@api]
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Track each client instance created by axios.create
const { createdClients } = vi.hoisted(() => {
  const createdClients: Array<{
    interceptors: {
      request: { use: ReturnType<typeof import('vitest').vi.fn> };
      response: { use: ReturnType<typeof import('vitest').vi.fn> };
    };
    request: ReturnType<typeof import('vitest').vi.fn>;
  }> = []
  return { createdClients }
})

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>()
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(() => {
        const client = {
          interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
          },
          request: vi.fn(),
        }
        createdClients.push(client)
        return client
      }),
    },
  }
})

// Import after mocking so the module initialises with the mocked axios.create
import { artifactClient } from '../../api/artifact-client'

// The artifact-client module creates 1 client
const clientMock = createdClients[0]

// Snapshot interceptor callbacks at module init time
// Request interceptor: [0] = auth injector
const reqOnFulfilled = clientMock?.interceptors.request.use.mock.calls[0]?.[0]
const reqOnRejected = clientMock?.interceptors.request.use.mock.calls[0]?.[1]

// Response interceptors:
//   [0] = retryOn5xx (onFulfilled=undefined, onRejected=retryHandler)
//   [1] = logging/error interceptor (onFulfilled=successLogger, onRejected=errorLogger)
const retryOnRejected = clientMock?.interceptors.response.use.mock.calls[0]?.[1]
const resOnFulfilled = clientMock?.interceptors.response.use.mock.calls[1]?.[0]
const resOnRejected = clientMock?.interceptors.response.use.mock.calls[1]?.[1]

describe('[@artifact-client] [@api] artifact-client module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // Client creation
  // ---------------------------------------------------------------------------

  describe('client creation', () => {
    it('creates exactly one axios client instance', () => {
      expect(createdClients).toHaveLength(1)
    })

    it('exports the artifactClient instance', () => {
      expect(artifactClient).toBeDefined()
    })

    it('registers request and response interceptors with callbacks', () => {
      // Callbacks were captured at module init time (before clearAllMocks)
      expect(reqOnFulfilled).toBeTypeOf('function')
      expect(reqOnRejected).toBeTypeOf('function')
      expect(retryOnRejected).toBeTypeOf('function')
      expect(resOnFulfilled).toBeTypeOf('function')
      expect(resOnRejected).toBeTypeOf('function')
    })
  })

  // ---------------------------------------------------------------------------
  // Request interceptor — auth injection
  // ---------------------------------------------------------------------------

  describe('request interceptor (auth injection)', () => {
    it('injects Basic auth header and returns config', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const config = { method: 'get', url: '/test', headers: {} as Record<string, string> }

      const result = reqOnFulfilled(config)

      expect(result).toBe(config)
      expect(config.headers['Authorization']).toMatch(/^Basic /)
      consoleSpy.mockRestore()
    })

    it('logs the request method and URL in DEV mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const config = { method: 'post', url: '/upload', headers: {} as Record<string, string> }

      reqOnFulfilled(config)

      expect(consoleSpy).toHaveBeenCalledWith('[Artifact API] POST /upload')
      consoleSpy.mockRestore()
    })

    it('handles undefined method gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const config = { url: '/test', headers: {} as Record<string, string> }

      const result = reqOnFulfilled(config)

      expect(result).toBe(config)
      consoleSpy.mockRestore()
    })

    it('error handler logs and rejects', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('request interceptor error')

      await expect(reqOnRejected(error)).rejects.toBe(error)
      expect(consoleSpy).toHaveBeenCalledWith('[Artifact API Request Error]', error)
      consoleSpy.mockRestore()
    })
  })

  // ---------------------------------------------------------------------------
  // Response interceptor — logging
  // ---------------------------------------------------------------------------

  describe('response interceptor (logging)', () => {
    it('success handler logs status and returns response', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const response = { status: 200, data: { ok: true } }

      const result = resOnFulfilled(response)

      expect(result).toBe(response)
      expect(consoleSpy).toHaveBeenCalledWith('[Artifact API Response] 200')
      consoleSpy.mockRestore()
    })

    it('error handler extracts message from response.data.message', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = {
        response: { status: 400, data: { message: 'Bad request' } },
        message: 'Request failed',
      }

      await expect(resOnRejected(error)).rejects.toBe(error)
      expect(consoleSpy).toHaveBeenCalledWith('[Artifact API Error] 400: Bad request')
      consoleSpy.mockRestore()
    })

    it('error handler falls back to error.message when data.message is absent', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = {
        response: { status: 500, data: {} },
        message: 'Internal Server Error',
      }

      await expect(resOnRejected(error)).rejects.toBe(error)
      expect(consoleSpy).toHaveBeenCalledWith('[Artifact API Error] 500: Internal Server Error')
      consoleSpy.mockRestore()
    })

    it('error handler handles missing response gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = { message: 'Network Error' }

      await expect(resOnRejected(error)).rejects.toBe(error)
      expect(consoleSpy).toHaveBeenCalledWith('[Artifact API Error] undefined: Network Error')
      consoleSpy.mockRestore()
    })
  })

  // ---------------------------------------------------------------------------
  // Retry interceptor (retryOn5xx)
  // ---------------------------------------------------------------------------

  describe('retryOn5xx interceptor', () => {
    it('rejects immediately for non-5xx errors (e.g. 400)', async () => {
      const error = {
        response: { status: 400 },
        config: { url: '/test' },
        message: 'Bad request',
      }

      await expect(retryOnRejected(error)).rejects.toBe(error)
    })

    it('rejects immediately for 501 (not in 502-504 range)', async () => {
      const error = {
        response: { status: 501 },
        config: { url: '/test' },
        message: 'Not Implemented',
      }

      await expect(retryOnRejected(error)).rejects.toBe(error)
    })

    it('rejects immediately for 505 (not in 502-504 range)', async () => {
      const error = {
        response: { status: 505 },
        config: { url: '/test' },
        message: 'Version not supported',
      }

      await expect(retryOnRejected(error)).rejects.toBe(error)
    })

    it('rejects immediately when config is missing', async () => {
      const error = {
        response: { status: 502 },
        config: undefined,
        message: 'Bad Gateway',
      }

      await expect(retryOnRejected(error)).rejects.toBe(error)
    })

    it('rejects immediately when response status is missing', async () => {
      const error = {
        response: undefined,
        config: { url: '/test' },
        message: 'Network Error',
      }

      await expect(retryOnRejected(error)).rejects.toBe(error)
    })

    it('retries on 502 and calls client.request with the config', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const config = { url: '/test', __retryCount: undefined as number | undefined }
      const error = {
        response: { status: 502 },
        config,
        message: 'Bad Gateway',
      }

      clientMock.request.mockResolvedValueOnce({ status: 200, data: 'ok' })

      const result = await retryOnRejected(error)

      expect(clientMock.request).toHaveBeenCalledWith(config)
      expect(result).toEqual({ status: 200, data: 'ok' })
      consoleSpy.mockRestore()
    })

    it('retries on 503', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const config = { url: '/test' }
      const error = {
        response: { status: 503 },
        config,
        message: 'Service Unavailable',
      }

      clientMock.request.mockResolvedValueOnce({ status: 200 })

      await retryOnRejected(error)

      expect(clientMock.request).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('retries on 504', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const config = { url: '/test' }
      const error = {
        response: { status: 504 },
        config,
        message: 'Gateway Timeout',
      }

      clientMock.request.mockResolvedValueOnce({ status: 200 })

      await retryOnRejected(error)

      expect(clientMock.request).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('rejects after max retries (2)', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const config = { url: '/test', __retryCount: 2 }
      const error = {
        response: { status: 502 },
        config,
        message: 'Bad Gateway',
      }

      await expect(retryOnRejected(error)).rejects.toBe(error)
      expect(clientMock.request).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('increments __retryCount on each retry', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const config = { url: '/test' } as Record<string, unknown>
      const error = {
        response: { status: 502 },
        config,
        message: 'Bad Gateway',
      }

      clientMock.request.mockResolvedValueOnce({ status: 200 })

      await retryOnRejected(error)

      expect(config.__retryCount).toBe(1)
      consoleSpy.mockRestore()
    })
  })
})
