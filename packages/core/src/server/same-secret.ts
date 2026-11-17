/**
 * Whether a sent secret matches the configured one, in time that depends only on their length, not
 * on where they differ. An empty configured secret never matches, so an unset one shuts the door.
 */
export function sameSecret(sent: string, secret: string) {
  if (!secret || sent.length !== secret.length) return false;
  let difference = 0;
  for (let i = 0; i < sent.length; i++) difference |= sent.charCodeAt(i) ^ secret.charCodeAt(i);
  return difference === 0;
}
