import { Resolver } from 'node:dns/promises'

// `hack <website>` shows the site's address. Only a DNS lookup is made; nothing is sent to the site itself.
const resolver = new Resolver({ timeout: 2000, tries: 1 })

// Accepts a bare host or a URL and returns the lowercase host name, or null.
export function hostName(raw) {
  const text = String(raw ?? '').trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^[^@/]*@/, '').split(/[/?#:]/)[0].replace(/\.$/, '')
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$/.test(text) ? text : null
}

// Private, loopback, link-local, CGNAT, multicast and reserved ranges stay hidden.
export function isPublicIpv4(ip) {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a, b] = parts
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b < 128) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)))
}

export async function lookupHost(raw, resolve4 = (host) => resolver.resolve4(host)) {
  const host = hostName(raw)
  if (!host) return null
  const addresses = await resolve4(host).catch(() => [])
  const ip = addresses.find(isPublicIpv4)
  return ip ? { host, ip } : null
}
