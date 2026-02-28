import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const cloudRegion = env.VITE_CLOUD_REGION || 'us-east-1'
  const cloudProvider = env.VITE_CLOUD_PROVIDER || 'aws'
  const flinkApiUrl = `https://flink.${cloudRegion}.${cloudProvider}.confluent.cloud`

  return {
    plugins: [react()],
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
        }
      }
    },
  }
})
