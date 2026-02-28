// [@api] [@core]
import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

// We test handleApiError as a pure function.
// Mock the entire axios module so that axios.isAxiosError can be controlled and
// the module-level client creation (which calls btoa / env) is side-effect-free.
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>()
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(() => ({
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      })),
      isAxiosError: vi.fn(),
    },
  }
})

// Import after mocking so the module initialises with the mocked axios.create
import { handleApiError } from '../../api/confluent-client'

const mockedIsAxiosError = vi.mocked(axios.isAxiosError)

// Helper: build a minimal AxiosError-shaped object for a given response body & status
function makeAxiosError(
  status: number | undefined,
  data: Record<string, string | undefined>,
  networkMessage = 'Request failed'
) {
  return {
    isAxiosError: true,
    message: networkMessage,
    response: status !== undefined
      ? { status, data }
      : undefined,
  }
}

describe('[@api] [@core] handleApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // Axios errors – with a response body
  // ---------------------------------------------------------------------------

  describe('Axios errors with a response', () => {
    it('extracts message from response.data.message and returns correct status', () => {
      const error = makeAxiosError(400, { message: 'Bad request syntax' })
      mockedIsAxiosError.mockReturnValue(true)

      const result = handleApiError(error)

      expect(result.status).toBe(400)
      expect(result.message).toBe('Bad request syntax')
    })

    it('extracts detail from response.data.detail into the details field', () => {
      const error = makeAxiosError(422, { message: 'Unprocessable entity', detail: 'Column not found' })
      mockedIsAxiosError.mockReturnValue(true)

      const result = handleApiError(error)

      expect(result.details).toBe('Column not found')
    })

    it('sets details to undefined when response.data.detail is absent', () => {
      const error = makeAxiosError(404, { message: 'Not found' })
      mockedIsAxiosError.mockReturnValue(true)

      const result = handleApiError(error)

      expect(result.details).toBeUndefined()
    })

    it('falls back to axios error.message when response.data.message is absent', () => {
      const error = makeAxiosError(503, {}, 'Service unavailable')
      mockedIsAxiosError.mockReturnValue(true)

      const result = handleApiError(error)

      expect(result.message).toBe('Service unavailable')
      expect(result.status).toBe(503)
    })

    it('prefers response.data.message over the top-level axios message', () => {
      const error = makeAxiosError(409, { message: 'Conflict: duplicate name' }, 'Request failed with status 409')
      mockedIsAxiosError.mockReturnValue(true)

      const result = handleApiError(error)

      expect(result.message).toBe('Conflict: duplicate name')
    })

    it('handles a 401 Unauthorized response correctly', () => {
      const error = makeAxiosError(401, { message: 'Unauthorized', detail: 'Invalid API key' })
      mockedIsAxiosError.mockReturnValue(true)

      const result = handleApiError(error)

      expect(result.status).toBe(401)
      expect(result.message).toBe('Unauthorized')
      expect(result.details).toBe('Invalid API key')
    })

    it('handles a 500 server error with both message and detail', () => {
      const error = makeAxiosError(500, { message: 'Internal server error', detail: 'NullPointerException at line 42' })
      mockedIsAxiosError.mockReturnValue(true)

      const result = handleApiError(error)

      expect(result.status).toBe(500)
      expect(result.message).toBe('Internal server error')
      expect(result.details).toBe('NullPointerException at line 42')
    })
  })

  // ---------------------------------------------------------------------------
  // Axios errors – no response (network / timeout errors)
  // ---------------------------------------------------------------------------

  describe('Axios errors without a response (network errors)', () => {
    it('returns status 500 and uses error.message when response is absent', () => {
      const error = {
        isAxiosError: true,
        message: 'Network Error',
        response: undefined,
      }
      mockedIsAxiosError.mockReturnValue(true)

      const result = handleApiError(error)

      expect(result.status).toBe(500)
      expect(result.message).toBe('Network Error')
    })

    it('returns undefined details when there is no response', () => {
      const error = {
        isAxiosError: true,
        message: 'timeout of 10000ms exceeded',
        response: undefined,
      }
      mockedIsAxiosError.mockReturnValue(true)

      const result = handleApiError(error)

      expect(result.details).toBeUndefined()
    })

    it('returns status 500 when response exists but status is undefined', () => {
      const error = {
        isAxiosError: true,
        message: 'Partial response',
        response: { status: undefined as unknown as number, data: {} },
      }
      mockedIsAxiosError.mockReturnValue(true)

      const result = handleApiError(error)

      expect(result.status).toBe(500)
    })
  })

  // ---------------------------------------------------------------------------
  // Plain Error objects
  // ---------------------------------------------------------------------------

  describe('plain Error objects (non-Axios)', () => {
    it('returns status 500 and the Error message', () => {
      const error = new Error('Something went wrong')
      mockedIsAxiosError.mockReturnValue(false)

      const result = handleApiError(error)

      expect(result.status).toBe(500)
      expect(result.message).toBe('Something went wrong')
    })

    it('returns undefined details for a plain Error', () => {
      const error = new Error('Oops')
      mockedIsAxiosError.mockReturnValue(false)

      const result = handleApiError(error)

      expect(result.details).toBeUndefined()
    })

    it('handles an Error with an empty message', () => {
      const error = new Error('')
      mockedIsAxiosError.mockReturnValue(false)

      const result = handleApiError(error)

      expect(result.status).toBe(500)
      expect(result.message).toBe('')
    })
  })

  // ---------------------------------------------------------------------------
  // Non-Error thrown values (string, number, object, null, undefined)
  // ---------------------------------------------------------------------------

  describe('non-Error thrown values', () => {
    it('returns status 500 and generic message when a string is thrown', () => {
      mockedIsAxiosError.mockReturnValue(false)

      const result = handleApiError('something bad happened')

      expect(result.status).toBe(500)
      expect(result.message).toBe('Unknown error')
    })

    it('returns status 500 and generic message when a number is thrown', () => {
      mockedIsAxiosError.mockReturnValue(false)

      const result = handleApiError(42)

      expect(result.status).toBe(500)
      expect(result.message).toBe('Unknown error')
    })

    it('returns status 500 and generic message when null is thrown', () => {
      mockedIsAxiosError.mockReturnValue(false)

      const result = handleApiError(null)

      expect(result.status).toBe(500)
      expect(result.message).toBe('Unknown error')
    })

    it('returns status 500 and generic message when undefined is thrown', () => {
      mockedIsAxiosError.mockReturnValue(false)

      const result = handleApiError(undefined)

      expect(result.status).toBe(500)
      expect(result.message).toBe('Unknown error')
    })

    it('returns status 500 and generic message when a plain object is thrown', () => {
      mockedIsAxiosError.mockReturnValue(false)

      const result = handleApiError({ code: 'ERR_UNKNOWN' })

      expect(result.status).toBe(500)
      expect(result.message).toBe('Unknown error')
    })
  })
})
