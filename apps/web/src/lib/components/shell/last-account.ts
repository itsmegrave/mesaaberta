/**
 * Remembers the last full account the layout sent, so a navigation whose profile read failed
 * (`unavailable`) still shows that person's menu, picture and counts instead of a bare one.
 * Only for the same person: a different identity, or signing out, drops what was kept.
 */
export function keepFullAccount<A extends object>() {
  let kept: { identity: string; account: A } | null = null;
  return (account: A | null, identity: string): A | null => {
    if (!account) {
      kept = null;
      return null;
    }
    // The bare account sent while the api is down is the only one marked `unavailable`.
    if (!('unavailable' in account && account.unavailable)) {
      kept = { identity, account };
      return account;
    }
    return kept?.identity === identity ? kept.account : account;
  };
}
