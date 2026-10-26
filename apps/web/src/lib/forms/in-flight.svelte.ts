/**
 * How many actionForm submits are on their way, across the page. The layout's top bar reads it, so
 * an action started from a menu item or a hidden button (no busy button in sight) is not silent.
 */
class InFlight {
  count = $state(0);

  start(): () => void {
    this.count++;
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.count--;
    };
  }
}

export const inFlight = new InFlight();
