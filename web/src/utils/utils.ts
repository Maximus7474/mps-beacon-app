export const devMode = !window?.['invokeNative'];

export const toRelativeMinutes = (timestamp: number): number =>
  Math.max(0, Math.round((Date.now() - timestamp) / 60_000));

export function formatRelativeTime(minutes: number): string {
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getCompanyVanityPhoneNumber({
  name,
  pattern = 'EXT-{NUMBER}',
  maxlength = 15,
}: {
  name: string;
  pattern?: string | null;
  maxlength?: number;
}): string {
  const activePattern = pattern || 'EXT-{NUMBER}';
  const sanitized = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const vanityValue = sanitized.slice(0, maxlength) || 'CALL';

  return activePattern.replace('{NUMBER}', vanityValue);
}
