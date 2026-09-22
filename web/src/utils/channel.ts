import type { Company, GetOrCreateChannelResponse } from '@common/types';
import { fetchNui } from '~/utils/fetchNui';
import { devMode } from '~/utils/utils';

/**
 * ToDo (server): implement the `beaconapp:getorcreatechannel` server callback
 * (see src/server/index.ts) so this resolves a real channel id:
 *   1. Look up the viewer's personal channel for `companyId` in the DB.
 *   2. If missing, create it (channel row + company-scope mirror row the
 *      employees see), reusing the company branding snapshot pattern from
 *      the channels list.
 *   3. Return { success: true, channel, created } — `created` lets the UI
 *      show a "started a conversation" hint if we ever want one.
 *   4. Return { success: false, message } when the company is unreachable
 *      (closed/no phone) so the UI can surface it without navigating.
 *
 * Dev stub: fabricates a deterministic channel from the SEED branding when
 * the NUI round-trip is unavailable, so the whole flow is testable in the
 * browser before the server work exists.
 */
export async function requestChannel(
  company: Pick<Company, 'id' | 'name' | 'icon' | 'iconBg' | 'image' | 'phone'>,
): Promise<GetOrCreateChannelResponse> {
  const response = await fetchNui<GetOrCreateChannelResponse>(
    'beaconapp:getorcreatechannel',
    { companyId: company.id },
    devMode
      ? {
          success: true,
          created: !sessionStorage.getItem(`beaconapp:channel:${company.id}`),
          channel: {
            id: `dev-${company.id}`,
            scope: 'personal',
            companyId: company.id,
            companyName: company.name,
            companyIcon: company.icon,
            companyIconBg: company.iconBg,
            companyImage: company.image,
            phoneNumber: company.phone,
            lastMessagePreview: 'No messages yet',
            lastMessageAt: Date.now(),
            unreadCount: 0,
          },
        }
      : undefined,
  );

  if (response.success) {
    // Dev-only bookkeeping so `created` flips on the second request.
    sessionStorage.setItem(`beaconapp:channel:${company.id}`, '1');
  }

  return response;
}
