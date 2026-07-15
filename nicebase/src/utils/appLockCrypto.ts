/**
 * App-lock cryptography helpers.
 *
 * Pure Web Crypto — no external dependencies. Used to derive and verify the
 * app-lock PIN without ever storing the PIN itself. A random per-device salt is
 * combined with the PIN through PBKDF2 (SHA-256, 100k iterations) and only the
 * resulting hash is persisted.
 */

// A single stable encoder instance (creating one per call is wasteful).
const textEncoder = new TextEncoder()

function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const length = Math.floor(hex.length / 2)
  // Back the view with a concrete ArrayBuffer so it satisfies BufferSource.
  const out = new Uint8Array(new ArrayBuffer(length))
  for (let i = 0; i < length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function getCrypto(): Crypto {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (!c) {
    throw new Error('Web Crypto API is not available in this environment')
  }
  return c
}

function getSubtle(): SubtleCrypto {
  const subtle = getCrypto().subtle
  if (!subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is not available in this environment')
  }
  return subtle
}

/**
 * Generate a random 16-byte salt encoded as a lowercase hex string.
 */
export function generateSalt(): string {
  const crypto = getCrypto()
  if (!crypto.getRandomValues) {
    throw new Error('Web Crypto API (crypto.getRandomValues) is not available in this environment')
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

/**
 * Derive a 256-bit hash of `pin` using PBKDF2 (SHA-256, 100000 iterations) with
 * the given hex `salt`. Returns the hash as a lowercase hex string.
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const subtle = getSubtle()

  const keyMaterial = await subtle.importKey(
    'raw',
    textEncoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )

  return bytesToHex(new Uint8Array(derivedBits))
}

/**
 * Length-safe, constant-time string comparison. The running time does not
 * short-circuit on the first differing character, so it does not leak how much
 * of the secret matched.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length)
  // Fold the length difference in so unequal lengths can never compare equal.
  let mismatch = a.length ^ b.length
  for (let i = 0; i < length; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0
    const cb = i < b.length ? b.charCodeAt(i) : 0
    mismatch |= ca ^ cb
  }
  return mismatch === 0
}
