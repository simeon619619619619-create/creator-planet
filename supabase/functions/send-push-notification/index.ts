// ============================================================================
// SEND PUSH NOTIFICATION EDGE FUNCTION
// Triggered by Database Webhook on notifications INSERT
// Verifies webhook secret, checks preferences, sends RFC 8291 Web Push
// ============================================================================
// Deploy: npx supabase functions deploy send-push-notification --no-verify-jwt
// Or via MCP deploy_edge_function (inline, verify_jwt=false)
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// --- Utility ---

function b64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Uint8Array.from(atob(b64 + pad), c => c.charCodeAt(0));
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}

// --- VAPID JWT (ES256) ---

async function createVapidAuth(
  endpoint: string,
  subject: string,
  publicKeyB64: string,
  privateKeyB64: string
): Promise<string> {
  const { protocol, host } = new URL(endpoint);
  const audience = `${protocol}//${host}`;

  const pubBytes = b64UrlDecode(publicKeyB64);
  const x = b64UrlEncode(pubBytes.slice(1, 33));
  const y = b64UrlEncode(pubBytes.slice(33, 65));

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d: privateKeyB64 },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const enc = new TextEncoder();
  const header = b64UrlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64UrlEncode(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  })));

  const unsigned = `${header}.${payload}`;
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(unsigned)
  );

  return `vapid t=${unsigned}.${b64UrlEncode(sig)}, k=${publicKeyB64}`;
}

// --- Web Push Encryption (RFC 8291, aes128gcm) ---

async function encryptPayload(
  payloadText: string,
  subscriberP256dh: string,
  subscriberAuth: string
): Promise<{ body: Uint8Array; contentEncoding: string }> {
  const enc = new TextEncoder();
  const uaPublicBytes = b64UrlDecode(subscriberP256dh);
  const authSecret = b64UrlDecode(subscriberAuth);

  // Import subscriber public key for ECDH
  const uaPublicKey = await crypto.subtle.importKey(
    'raw', uaPublicBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, []
  );

  // Generate ephemeral ECDH key pair
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, ['deriveBits']
  );
  const asPublicBytes = new Uint8Array(
    await crypto.subtle.exportKey('raw', ephemeral.publicKey)
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: uaPublicKey },
      ephemeral.privateKey, 256
    )
  );

  // HKDF: IKM from shared secret + auth
  const ikmInfo = concatBytes(enc.encode('WebPush: info\0'), uaPublicBytes, asPublicBytes);
  const ikmKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: ikmInfo },
      ikmKey, 256
    )
  );

  // Random salt for content encryption
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prkKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);

  // CEK (16 bytes)
  const cekBytes = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: aes128gcm\0') },
      prkKey, 128
    )
  );

  // Nonce (12 bytes)
  const nonceBytes = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: nonce\0') },
      prkKey, 96
    )
  );

  // Pad payload: content + delimiter(0x02)
  const payloadBytes = enc.encode(payloadText);
  const padded = new Uint8Array(payloadBytes.length + 1);
  padded.set(payloadBytes);
  padded[payloadBytes.length] = 0x02;

  // AES-128-GCM encrypt
  const cek = await crypto.subtle.importKey('raw', cekBytes, 'AES-GCM', false, ['encrypt']);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonceBytes }, cek, padded)
  );

  // Build aes128gcm content coding: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);

  const body = concatBytes(
    salt, rs,
    new Uint8Array([asPublicBytes.length]),
    asPublicBytes,
    encrypted
  );

  return { body, contentEncoding: 'aes128gcm' };
}

// --- Main ---

const TYPE_TO_PREF: Record<string, string> = {
  dm_message: 'dm_messages',
  event_created: 'event_created',
  event_reminder: 'event_reminder',
  course_new_lesson: 'course_new_lesson',
  course_enrollment: 'course_enrollment',
  community_new_post: 'community_new_post',
  community_comment_reply: 'community_comment_reply',
};

function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 });

  // --- Auth: verify webhook secret ---
  const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  const requestSecret = req.headers.get('x-webhook-secret');
  if (!webhookSecret || requestSecret !== webhookSecret) {
    return jsonResp({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await req.json();
    const record = body.record || body;
    const { id: notificationId, recipient_profile_id, type, title, body: notifBody, url } = record;

    if (!notificationId || !recipient_profile_id) {
      return jsonResp({ error: 'Missing notification data' }, 400);
    }

    const supabase = createServiceClient();

    // --- Idempotency: skip if already pushed ---
    const { data: existing } = await supabase
      .from('notifications')
      .select('is_pushed')
      .eq('id', notificationId)
      .single();
    if (existing?.is_pushed) {
      return jsonResp({ skipped: true, reason: 'already_pushed' });
    }

    // --- Check preferences ---
    const prefColumn = TYPE_TO_PREF[type];
    if (prefColumn) {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select(`push_enabled, ${prefColumn}`)
        .eq('profile_id', recipient_profile_id)
        .single();
      if (prefs && (!prefs.push_enabled || !prefs[prefColumn])) {
        return jsonResp({ skipped: true, reason: 'disabled_by_preference' });
      }
    }

    // --- Get subscriptions ---
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('profile_id', recipient_profile_id);

    if (subError || !subscriptions?.length) {
      return jsonResp({ skipped: true, reason: 'no_subscriptions' });
    }

    // --- VAPID keys ---
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@founderclub.bg';
    if (!vapidPublicKey || !vapidPrivateKey) {
      return jsonResp({ error: 'Push configuration missing' }, 500);
    }

    const pushPayload = JSON.stringify({
      title: title || 'Founders Club',
      body: notifBody || 'You have a new notification',
      url: url || '/',
      type: type || 'default',
    });

    let sentCount = 0;
    const expiredSubscriptions: string[] = [];

    for (const sub of subscriptions) {
      try {
        // VAPID auth header
        const authorization = await createVapidAuth(
          sub.endpoint, vapidSubject, vapidPublicKey, vapidPrivateKey
        );

        // RFC 8291 encrypted payload
        const { body: encryptedBody, contentEncoding } = await encryptPayload(
          pushPayload, sub.p256dh, sub.auth
        );

        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Authorization': authorization,
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': contentEncoding,
            'TTL': '86400',
          },
          body: encryptedBody,
        });

        if (response.status === 201 || response.status === 200) {
          sentCount++;
          await supabase.from('push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', sub.id);
        } else if (response.status === 410 || response.status === 404) {
          expiredSubscriptions.push(sub.id);
        } else {
          const text = await response.text().catch(() => '');
          console.error(`Push ${response.status} for ${sub.endpoint}: ${text}`);
        }
      } catch (err) {
        console.error(`Push error for subscription ${sub.id}:`, err);
      }
    }

    if (expiredSubscriptions.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expiredSubscriptions);
    }

    if (sentCount > 0) {
      await supabase.from('notifications').update({ is_pushed: true }).eq('id', notificationId);
    }

    return jsonResp({ success: true, sent: sentCount, expired: expiredSubscriptions.length, total: subscriptions.length });
  } catch (err) {
    console.error('Send push notification error:', err);
    return jsonResp({ error: 'Failed to send push notification' }, 500);
  }
});
