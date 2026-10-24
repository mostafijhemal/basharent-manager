import { DatabaseState } from '../types/models';

export interface EncryptedBackupEnvelope {
  magic: 'BASHARENT_ENCRYPTED_BACKUP';
  backupFormatVersion: number;
  schemaVersion: number;
  createdAt: string;
  appName: string;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  saltBase64: string;
  ivBase64: string;
  ciphertextBase64: string;
  summary: {
    buildingsCount: number;
    unitsCount: number;
    tenantsCount: number;
    paymentsCount: number;
    expensesCount: number;
    includesDocuments: boolean;
  };
}

const BACKUP_FORMAT_VERSION = 1;
const PBKDF2_ITERATIONS = 120000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesGcmKey(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuf = await globalThis.crypto.subtle.digest(
    'SHA-256',
    enc.encode(input)
  );
  const hashArray = Array.from(new Uint8Array(hashBuf));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPinCode(pin: string): Promise<string> {
  return sha256Hex(`BASHARENT_PIN_SALT_V1::${pin}`);
}

/**
 * Creates an authenticated AES-256-GCM encrypted backup envelope from DatabaseState.
 * Uses a unique 16-byte random salt and 12-byte random nonce (IV) on every export.
 */
export async function createEncryptedBackup(
  state: DatabaseState,
  password: string,
  includeAttachments = true
): Promise<string> {
  if (!password || password.trim().length < 4) {
    throw new Error('Backup password must be at least 4 characters');
  }

  const exportState: DatabaseState = JSON.parse(JSON.stringify(state));
  if (!includeAttachments) {
    exportState.tenants = exportState.tenants.map((t) => ({
      ...t,
      photoDataUrl: undefined,
      nidPhotoDataUrl: undefined,
      agreementDocDataUrl: undefined,
    }));
    exportState.buildings = exportState.buildings.map((b) => ({
      ...b,
      photoDataUrl: undefined,
    }));
    exportState.expenses = exportState.expenses.map((e) => ({
      ...e,
      attachmentDataUrl: undefined,
    }));
  }

  const stateJson = JSON.stringify(exportState);
  const checksum = await sha256Hex(stateJson);
  const innerPayload = JSON.stringify({
    checksum,
    state: exportState,
  });

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesGcmKey(password, salt, PBKDF2_ITERATIONS);

  const enc = new TextEncoder();
  const encryptedBuf = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    enc.encode(innerPayload)
  );

  const envelope: EncryptedBackupEnvelope = {
    magic: 'BASHARENT_ENCRYPTED_BACKUP',
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: state.schemaVersion,
    createdAt: new Date().toISOString(),
    appName: state.settings.appName || 'BashaRent Manager',
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    cipher: 'AES-256-GCM',
    saltBase64: bytesToBase64(salt),
    ivBase64: bytesToBase64(iv),
    ciphertextBase64: bytesToBase64(new Uint8Array(encryptedBuf)),
    summary: {
      buildingsCount: state.buildings.length,
      unitsCount: state.units.length,
      tenantsCount: state.tenants.length,
      paymentsCount: state.payments.length,
      expensesCount: state.expenses.length,
      includesDocuments: includeAttachments,
    },
  };

  return JSON.stringify(envelope, null, 2);
}

/**
 * Inspects a backup file string without decrypting to verify format version and display summary.
 */
export function inspectBackupEnvelope(rawContent: string): EncryptedBackupEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error('Corrupted backup file: invalid JSON structure');
  }

  const env = parsed as Partial<EncryptedBackupEnvelope>;
  if (env.magic !== 'BASHARENT_ENCRYPTED_BACKUP') {
    throw new Error('Invalid backup file: unrecognized format magic header');
  }
  if (
    typeof env.backupFormatVersion !== 'number' ||
    env.backupFormatVersion > BACKUP_FORMAT_VERSION
  ) {
    throw new Error(
      `Incompatible backup format version (${String(env.backupFormatVersion)})`
    );
  }
  if (!env.saltBase64 || !env.ivBase64 || !env.ciphertextBase64) {
    throw new Error('Corrupted backup file: missing cryptographic parameters');
  }

  return env as EncryptedBackupEnvelope;
}

/**
 * Decrypts and verifies an AES-256-GCM encrypted backup file.
 * Throws clear errors on wrong password, tampered ciphertext, or schema mismatch.
 */
export async function decryptAndVerifyBackup(
  rawContent: string,
  password: string
): Promise<{
  envelope: EncryptedBackupEnvelope;
  state: DatabaseState;
}> {
  const envelope = inspectBackupEnvelope(rawContent);
  const salt = base64ToBytes(envelope.saltBase64);
  const iv = base64ToBytes(envelope.ivBase64);
  const ciphertext = base64ToBytes(envelope.ciphertextBase64);

  const key = await deriveAesGcmKey(
    password,
    salt,
    envelope.iterations || PBKDF2_ITERATIONS
  );

  let decryptedBuf: ArrayBuffer;
  try {
    decryptedBuf = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );
  } catch {
    throw new Error(
      'Decryption failed: wrong backup password or tampered backup file'
    );
  }

  const dec = new TextDecoder();
  const innerJson = dec.decode(decryptedBuf);
  let innerParsed: { checksum: string; state: DatabaseState };
  try {
    innerParsed = JSON.parse(innerJson);
  } catch {
    throw new Error('Corrupted decrypted payload');
  }

  const stateJson = JSON.stringify(innerParsed.state);
  const computedChecksum = await sha256Hex(stateJson);
  if (computedChecksum !== innerParsed.checksum) {
    throw new Error('Backup integrity check failed: checksum mismatch');
  }

  if (
    !innerParsed.state ||
    !Array.isArray(innerParsed.state.buildings) ||
    !Array.isArray(innerParsed.state.tenants) ||
    !Array.isArray(innerParsed.state.payments)
  ) {
    throw new Error('Backup state is missing required relational tables');
  }

  return {
    envelope,
    state: innerParsed.state,
  };
}
