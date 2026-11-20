// Hand-copied until packages/shared/src/trackEvents.ts in the minit-root monorepo
// becomes the shared source; minit-sdk cannot import across repositories.
export const KEY_PATTERN = /^[A-Za-z0-9_.-]+$/;
export const KEY_MAX_LENGTH = 64;
export const RESERVED_KEY_PREFIX = "minit.";
export const MAX_PROPS = 20;
export const PROP_KEY_MAX_LENGTH = 40;
export const STRING_VALUE_MAX_LENGTH = 256;
export const MAX_PAYLOAD_BYTES = 2048;
export const RATE_BURST = 5;
export const RATE_REFILL_PER_SECOND = 5;
export const MAX_EVENTS_PER_LOAD = 100;
