import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// Reset DOM after each test
afterEach(() => {
  cleanup()
})

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Reset localStorage before each test
beforeEach(() => {
  localStorage.clear()
})

// Stub import.meta.env with test-safe values
vi.stubEnv('VITE_FLINK_API_KEY', 'test-key')
vi.stubEnv('VITE_FLINK_API_SECRET', 'test-secret')
vi.stubEnv('VITE_ORG_ID', 'test-org')
vi.stubEnv('VITE_ENVIRONMENT_ID', 'test-env')
vi.stubEnv('VITE_COMPUTE_POOL_ID', 'test-pool')
vi.stubEnv('VITE_FLINK_CATALOG', 'test_catalog')
vi.stubEnv('VITE_FLINK_DATABASE', 'test_db')
vi.stubEnv('VITE_CLOUD_REGION', 'us-east-1')
vi.stubEnv('VITE_CLOUD_PROVIDER', 'aws')
