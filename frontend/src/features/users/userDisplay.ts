import type { UserResponse } from "@/types/user";

export const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000001";

// The name to show for a user; username and email are optional in the API
export function getDisplayName(user: UserResponse): string {
  return user.username?.trim() || user.email || "Unnamed user";
}

// Up to two initials: "Jordan Lee" -> "JL", "jordan.lee" -> "JL", "jordan" -> "J"
export function getInitials(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters =
    parts.length === 1 ? parts[0][0] : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

const KNOWN_USER_IDS_BY_NAME: Record<string, string> = {
  "sarah jenkins": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "marcus vance": "f47ac10b-58cc-4372-a567-0e02b2c3d480",
  "elena rostova": "f47ac10b-58cc-4372-a567-0e02b2c3d481",
  "david sterling": "f47ac10b-58cc-4372-a567-0e02b2c3d482",
  "victoria chen": "f47ac10b-58cc-4372-a567-0e02b2c3d483",
};

export function resolveKnownUserId(name?: string | null): string | undefined {
  if (!name) return undefined;
  return KNOWN_USER_IDS_BY_NAME[name.trim().toLowerCase()];
}

export function isSystemUser(input: {
  userId?: string | null;
  name?: string | null;
  isSystem?: boolean;
}): boolean {
  if (input.isSystem) return true;
  if (input.userId === SYSTEM_ACTOR_ID) return true;
  const normalized = (input.name ?? "").trim().toLowerCase();
  return (
    normalized === "system" ||
    normalized === "system bot" ||
    normalized === "system automation" ||
    normalized === "automated engine" ||
    normalized === "system engine" ||
    normalized === "policy engine (ai)" ||
    normalized === "duplicate guard bot" ||
    normalized === "ai extraction"
  );
}

const PORTRAIT_BACKGROUNDS = [
  "#e8f7ed",
  "#dcfce7",
  "#e0f2fe",
  "#fef3c7",
  "#f1f5f9",
  "#ecfdf5",
];

const SKIN_TONES = [
  "#f6d2b8",
  "#ecc1a1",
  "#d99b72",
  "#b87650",
  "#8d5534",
  "#f8decb",
];

const HAIR_COLORS = [
  "#1f2937",
  "#3b2f2f",
  "#6b4423",
  "#926239",
  "#111827",
  "#4a3728",
];

const SHIRT_COLORS = [
  "#16834a",
  "#14532d",
  "#0f766e",
  "#1e3a8a",
  "#334155",
  "#3f6212",
];

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Generates a deterministic illustrated portrait SVG data URL so every persona
 * and live backend actor renders a crisp profile picture without external CDN calls.
 */
export function buildDeterministicFaceSvgDataUrl(
  seedKey: string,
  displayName?: string,
): string {
  const seed = hashSeed((seedKey || displayName || "proppay-user").toLowerCase());
  const bg = PORTRAIT_BACKGROUNDS[seed % PORTRAIT_BACKGROUNDS.length];
  const skin = SKIN_TONES[(seed >> 3) % SKIN_TONES.length];
  const hair = HAIR_COLORS[(seed >> 6) % HAIR_COLORS.length];
  const shirt = SHIRT_COLORS[(seed >> 9) % SHIRT_COLORS.length];
  const hairVariant = (seed >> 12) % 4;

  const hairBack =
    hairVariant === 0
      ? `<path d="M18 40c0-15 10-25 22-25s22 10 22 25v11H18V40z" fill="${hair}"/>`
      : hairVariant === 1
        ? `<circle cx="40" cy="30" r="19" fill="${hair}"/>`
        : hairVariant === 2
          ? `<path d="M21 37c0-13 8-22 19-22s19 9 19 22v6H21v-6z" fill="${hair}"/>`
          : `<path d="M19 39c0-14 9-24 21-24s21 10 21 24c0 6-2 11-5 14H24c-3-3-5-8-5-14z" fill="${hair}"/>`;

  const hairFront =
    hairVariant === 0
      ? `<path d="M25 32c3-7 10-10 17-10 6 0 11 2 14 7-4-2-9-3-15-3-7 0-12 2-16 6z" fill="${hair}"/>`
      : hairVariant === 1
        ? `<path d="M25 30c4-6 11-9 18-8 5 0 9 3 12 6-6-2-12-2-18 0-4 1-8 2-12 2z" fill="${hair}"/>`
        : hairVariant === 2
          ? `<path d="M26 30c3-6 9-9 14-9s11 3 14 9c-4-3-9-4-14-4s-10 1-14 4z" fill="${hair}"/>`
          : `<path d="M26 33c2-7 8-11 15-11 6 0 12 4 13 10-5-4-10-5-16-4-5 1-9 3-12 5z" fill="${hair}"/>`;

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">`,
    `<rect width="80" height="80" rx="40" fill="${bg}"/>`,
    hairBack,
    `<path d="M15 80c2-15 12-23 25-23s23 8 25 23H15z" fill="${shirt}"/>`,
    `<rect x="34" y="48" width="12" height="12" rx="5" fill="${skin}"/>`,
    `<circle cx="40" cy="37" r="15" fill="${skin}"/>`,
    hairFront,
    `<circle cx="34.5" cy="37.5" r="1.7" fill="#1f2937"/>`,
    `<circle cx="45.5" cy="37.5" r="1.7" fill="#1f2937"/>`,
    `<path d="M35.5 44c2.5 2.4 6.5 2.4 9 0" stroke="#7c3f2c" stroke-width="1.8" stroke-linecap="round" fill="none"/>`,
    `</svg>`,
  ].join("");

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
