import { createHmac, createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY env var is not set')
  return Buffer.from(key, 'hex')
}

export function encrypt(plaintext: string): { enc: string; iv: string } {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    enc: Buffer.concat([enc, tag]).toString('base64'),
    iv: iv.toString('hex'),
  }
}

export function decrypt(enc: string, ivHex: string): string {
  const iv = Buffer.from(ivHex, 'hex')
  const buf = Buffer.from(enc, 'base64')
  const tag = buf.subarray(buf.length - 16)
  const ciphertext = buf.subarray(0, buf.length - 16)
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

export function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string,
  signingSecret: string
): boolean {
  const now = Math.floor(Date.now() / 1000)
  // Reject requests older than 5 minutes (replay protection)
  if (Math.abs(now - parseInt(timestamp)) > 300) return false
  const baseString = `v0:${timestamp}:${body}`
  const expected = 'v0=' + createHmac('sha256', signingSecret).update(baseString).digest('hex')
  // Constant-time comparison to prevent timing attacks
  return signature === expected
}

export function generateId(prefix?: string): string {
  const id = randomBytes(8).toString('hex')
  return prefix ? `${prefix}_${id}` : id
}
