/**
 * Deterministic room ID generator.
 *
 * Sorts the two user IDs lexicographically and joins them with
 * an underscore so that (A, B) and (B, A) always produce the
 * same room identifier.
 */
export function getRoomId(a: string, b: string): string {
  if (a === b) {
    throw new Error("getRoomId: user_a and user_b must be different UUIDs.");
  }
  return [a, b].sort().join("_");
}
