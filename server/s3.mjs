// Just enough S3 (GetObject / PutObject on one key) with SigV4, so the
// container needs no AWS SDK. Works with Lightsail bucket access keys.
import { createHash, createHmac } from 'node:crypto'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const hmac = (key, value) => createHmac('sha256', key).update(value).digest()

export function signRequest({ method, host, path, region, accessKeyId, secretAccessKey, body = '', headers = {}, now = new Date() }) {
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const date = amzDate.slice(0, 8)
  const payloadHash = sha256(body)
  const all = { ...Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value).trim()])), host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate }
  const names = Object.keys(all).sort()
  const canonical = [method, path.split('/').map((part) => encodeURIComponent(part)).join('/'), '', ...names.map((name) => `${name}:${all[name]}`), '', names.join(';'), payloadHash].join('\n')
  const scope = `${date}/${region}/s3/aws4_request`
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n')
  const key = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, date), region), 's3'), 'aws4_request')
  const signature = createHmac('sha256', key).update(toSign).digest('hex')
  const { host: _host, ...rest } = all
  return { ...rest, Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}` }
}

export function s3Object({ bucket, key, region, accessKeyId, secretAccessKey }) {
  const host = `${bucket}.s3.${region}.amazonaws.com`
  const path = `/${key}`
  const call = async (method, body, headers = {}) => fetch(`https://${host}${path}`, { method, body: body || undefined, headers: signRequest({ method, host, path, region, accessKeyId, secretAccessKey, body, headers }), signal: AbortSignal.timeout(8000) })
  return {
    async get() {
      const response = await call('GET')
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`S3 GET ${response.status}`)
      return response.text()
    },
    async put(text) {
      const response = await call('PUT', text, { 'content-type': 'application/json' })
      if (!response.ok) throw new Error(`S3 PUT ${response.status}`)
    },
  }
}
