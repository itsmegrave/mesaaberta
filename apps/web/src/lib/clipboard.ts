import { toast } from '#lib/toaster.js';

/**
 * Copies `text` and says so in a toast. A refused clipboard copies nothing and claims nothing.
 * Resolves to whether the copy went through.
 */
export async function copyText(text: string, message: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
    return true;
  } catch {
    return false;
  }
}
