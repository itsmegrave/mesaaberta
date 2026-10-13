/**
 * Whether the browser can draw this file as a picture. The crop step only opens for one that can:
 * anything else goes on as it is, for the form's schema and the server to refuse with their usual
 * message, so a file that is not really an image never flashes a dialog first.
 */
export async function isDecodable(file: File): Promise<boolean> {
  try {
    (await createImageBitmap(file)).close();
    return true;
  } catch {
    return false;
  }
}
