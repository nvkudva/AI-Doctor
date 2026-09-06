// The protocol registry: binding a complaint to a protocol, and hashing a protocol
// so `protocol_versions` can pin the exact clinical policy a draft was produced under.

import type { Protocol, RedFlag, SlotId } from './types.ts';
import { general } from './general.ts';
import { headache } from './headache.ts';
import { fever } from './fever.ts';
import { cough } from './cough.ts';
import { abdominalPain } from './abdominal-pain.ts';

export * from './types.ts';

/** Deterministic order — the hash of the library depends on it. */
export const PROTOCOLS: readonly Protocol[] = [abdominalPain, cough, fever, headache, general];

export const FALLBACK_PROTOCOL = general;

export function getProtocol(id: string | null | undefined): Protocol {
  return PROTOCOLS.find((p) => p.id === id) ?? FALLBACK_PROTOCOL;
}

/**
 * Binds a presenting complaint to a protocol. Keyword scoring, longest match wins,
 * ties broken by registry order; nothing matched means the conservative fallback.
 * This is deliberately not a model call: the protocol decides which red flags are
 * mandatory, so a model must not be able to pick a protocol with fewer of them.
 */
export function matchProtocol(complaint: string | null | undefined): Protocol {
  const text = (complaint ?? '').toLowerCase();
  if (!text.trim()) return FALLBACK_PROTOCOL;
  let best: { protocol: Protocol; score: number } | null = null;
  for (const protocol of PROTOCOLS) {
    let score = 0;
    for (const keyword of protocol.match) {
      if (text.includes(keyword)) score = Math.max(score, keyword.length);
    }
    if (score > 0 && (!best || score > best.score)) best = { protocol, score };
  }
  return best?.protocol ?? FALLBACK_PROTOCOL;
}

export type Demographics = { sex: string | null; age: number | null };

/** Red flags that apply to this patient. An inapplicable one is never asked. */
export function applicableRedFlags(protocol: Protocol, who: Demographics): RedFlag[] {
  return protocol.redFlags.filter((flag) => {
    const only = flag.only;
    if (!only) return true;
    if (only.sex && (!who.sex || !only.sex.includes(who.sex as 'female'))) return false;
    if (only.minAge != null && (who.age == null || who.age < only.minAge)) return false;
    if (only.maxAge != null && (who.age == null || who.age > only.maxAge)) return false;
    return true;
  });
}

/** Conditional slots this patient qualifies for. */
export function applicableConditionalSlots(protocol: Protocol, who: Demographics): SlotId[] {
  return protocol.conditional.filter((c) => {
    if (c.sex && (!who.sex || !c.sex.includes(who.sex as 'female'))) return false;
    if (c.minAge != null && (who.age == null || who.age < c.minAge)) return false;
    if (c.maxAge != null && (who.age == null || who.age > c.maxAge)) return false;
    return true;
  }).map((c) => c.slot);
}

/** Key order must not decide the hash. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>).sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/**
 * The registered content hash. `register_protocol_version` refuses a differing hash
 * under an unchanged version, so editing a protocol without bumping its version
 * fails the consult that would have used it rather than silently changing policy.
 */
export async function protocolContentHash(protocol: Protocol): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(canonical(protocol))),
  );
  return 'sha256:' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Every red-flag code in the library. Mirrored by `red_flag_scripts` (migration 0011). */
export function allRedFlagCodes(): string[] {
  return [...new Set(PROTOCOLS.flatMap((p) => p.redFlags.map((f) => f.code)))].sort();
}
