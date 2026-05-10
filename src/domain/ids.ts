import { randomUUID } from "node:crypto";

export function createPrefixedId(prefix: string): `${string}_${string}` {
  return `${prefix}_${randomUUID()}`;
}
