import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const cloudRegion = env.VITE_CLOUD_REGION || 'us-east-1'
  const cloudProvider = env.VITE_CLOUD_PROVIDER || 'aws'
  const flinkApiUrl = `https://flink.${cloudRegion}.${cloudProvider}.confluent.cloud`

  return {
    plugins: [react()],
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, 'src') },
        { find: '@monaco-editor/react', replacement: path.resolve(__dirname, 'src/test/mocks/monaco.tsx') },
        { find: /^monaco-editor$/, replacement: path.resolve(__dirname, 'src/test/mocks/monaco-editor.ts') },
      ],
    },
    server: {
      port: 5173,
      open: true,
      proxy: {
        '/api/flink': {
          target: flinkApiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/flink/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              // Forward authorization header
              if (req.headers.authorization) {
                proxyReq.setHeader('Authorization', req.headers.authorization)
              }
            })
          }
        },
        '/api/fcpm': {
          target: 'https://api.confluent.cloud',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/fcpm/, '/fcpm'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              // Forward authorization header
              if (req.headers.authorization) {
                proxyReq.setHeader('Authorization', req.headers.authorization)
              }
            })
          }
        },
        '/api/schema-registry': {
          target: env.VITE_SCHEMA_REGISTRY_URL || 'https://psrc-placeholder.us-east-1.aws.confluent.cloud',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/schema-registry/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              if (req.headers.authorization) {
                proxyReq.setHeader('Authorization', req.headers.authorization)
              }
            })
          }
        },
        '/api/kafka': {
          target: env.VITE_KAFKA_REST_ENDPOINT || 'https://pkc-placeholder.us-east-1.aws.confluent.cloud',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/kafka/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              if (req.headers.authorization) {
                proxyReq.setHeader('Authorization', req.headers.authorization)
              }
            })
          }
        }
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      alias: {
        'monaco-editor': path.resolve(__dirname, 'src/test/mocks/monaco-editor.ts'),
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        exclude: ['node_modules/', 'src/test/'],
      },
    },
  }
})
