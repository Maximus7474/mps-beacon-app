/**
 * The viewer's own phone number. Sliced to 15 characters to mirror the
 * server-side `getViewerPhone` so comparisons against conversation keys line
 * up exactly (both sides derive from `GetEquippedPhoneNumber`).
 */
export const getViewerPhone = (): string | null => {
  try {
    const phone = global.exports['lb-phone'].GetEquippedPhoneNumber() as unknown;

    return typeof phone === 'string' && phone.length > 0 ? phone.slice(0, 15) : null;
  } catch {
    return null;
  }
};
