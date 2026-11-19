'use client';

const STORAGE_KEY = 'rollcall_device_fingerprint';

/**
 * Computes or retrieves a stable, non-PII device fingerprint stored in localStorage.
 * Runs strictly on the browser without importing Node's crypto module.
 */
export async function getOrCreateDeviceHash(): Promise<string> {
  if (typeof window === 'undefined') {
    return 'server_environment';
  }

  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 16) {
      return existing;
    }

    // Collect non-PII browser environment attributes
    const parts = [
      navigator.userAgent || '',
      navigator.language || '',
      screen.width || 0,
      screen.height || 0,
      screen.colorDepth || 0,
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      // Add high-entropy random entropy to make it device-unique even for identical models
      Math.random().toString(36).substring(2),
      Date.now().toString(36),
    ];

    const rawString = parts.join('|');

    // Use Web Crypto API available in all modern browsers
    if (window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(rawString);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      const deviceHash = `dev_${hashHex.substring(0, 32)}`;
      localStorage.setItem(STORAGE_KEY, deviceHash);
      return deviceHash;
    }

    // Fallback if crypto.subtle is unavailable
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
      const char = rawString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const fallbackHash = `dev_${Math.abs(hash).toString(16)}${Date.now().toString(16)}`.substring(0, 32);
    localStorage.setItem(STORAGE_KEY, fallbackHash);
    return fallbackHash;
  } catch (err) {
    console.error('Error generating device hash:', err);
    // Ephemeral fallback
    return `dev_ephemeral_${Math.random().toString(36).substring(2, 18)}`;
  }
}
