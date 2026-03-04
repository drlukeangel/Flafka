import path from 'path'
import https from 'https'
import { URL } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import type { IncomingMessage, ServerResponse } from 'http'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const cloudRegion = env.VITE_CLOUD_REGION || 'us-east-1'
  const cloudProvider = env.VITE_CLOUD_PROVIDER || 'aws'
  const flinkApiUrl = env.VITE_FLINK_API_URL || `https://flink.${cloudRegion}.${cloudProvider}.confluent.cloud`

  return {
    plugins: [
      react(),
      nodePolyfills({ include: ['buffer'] }),
      {
        name: 'artifact-upload-proxy',
        configureServer(server) {
          // CORS fallback proxy for S3 presigned uploads.
          // Parses the multipart form body, extracts __target_url,
          // and streams the remaining fields to the target.
          server.middlewares.use('/api/artifact-upload-proxy', (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== 'POST') {
              res.writeHead(405)
              res.end('Method Not Allowed')
              return
            }

            const chunks: Buffer[] = []
            req.on('data', (chunk: Buffer) => chunks.push(chunk))
            req.on('end', () => {
              const body = Buffer.concat(chunks)
              const contentType = req.headers['content-type'] || ''

              // Extract boundary from content-type
              const boundaryMatch = contentType.match(/boundary=(.+)/)
              if (!boundaryMatch) {
                res.writeHead(400)
                res.end('Missing multipart boundary')
                return
              }

              // Find __target_url field value from the raw body
              const bodyStr = body.toString('latin1')
              const targetMatch = bodyStr.match(
                /name="__target_url"\r\n\r\n([^\r\n]+)/
              )
              if (!targetMatch) {
                res.writeHead(400)
                res.end('Missing __target_url field')
                return
              }

              const targetUrl = targetMatch[1]

              // Remove the __target_url field from the multipart body
              const boundary = boundaryMatch[1]
              const targetFieldRegex = new RegExp(
                `--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r\\nContent-Disposition: form-data; name="__target_url"\\r\\n\\r\\n[^\\r\\n]+\\r\\n`,
                ''
              )
              const cleanedBodyStr = bodyStr.replace(targetFieldRegex, '')
              const cleanedBody = Buffer.from(cleanedBodyStr, 'latin1')

              // Forward to target
              const parsed = new URL(targetUrl)
              const proxyReq = https.request(
                {
                  hostname: parsed.hostname,
                  port: parsed.port || 443,
                  path: parsed.pathname + parsed.search,
                  method: 'POST',
                  headers: {
                    'Content-Type': contentType,
                    'Content-Length': cleanedBody.length,
                  },
                },
                (proxyRes) => {
                  res.writeHead(proxyRes.statusCode || 500, proxyRes.headers)
                  proxyRes.pipe(res)
                },
              )

              proxyReq.on('error', (err) => {
                console.error('[artifact-upload-proxy] Error:', err.message)
                res.writeHead(502)
                res.end(`Proxy error: ${err.message}`)
              })

              proxyReq.write(cleanedBody)
              proxyReq.end()
            })
          })
        },
      },
    ],
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, 'src') },
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
          target: env.VITE_CONFLUENT_API_URL || 'https://api.confluent.cloud',
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
        '/api/artifact': {
          target: env.VITE_CONFLUENT_API_URL || 'https://api.confluent.cloud',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/artifact/, '/artifact'),
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
        },
        '/api/telemetry': {
          target: env.VITE_TELEMETRY_API_URL || 'https://api.telemetry.confluent.cloud',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/telemetry/, ''),
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
