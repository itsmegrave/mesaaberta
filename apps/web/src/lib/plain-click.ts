/**
 * A link's `onclick` that runs `handler` in place of following the link, but only on a plain
 * click: with Ctrl, ⌘, Shift or Alt held the browser opens it in a new tab or window as usual.
 * Without a handler the link is an ordinary link.
 */
export const plainClick =
  (handler?: () => void) =>
  (event: MouseEvent): void => {
    if (!handler || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    handler();
  };
