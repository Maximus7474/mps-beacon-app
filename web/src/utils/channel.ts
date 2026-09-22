import type { Company, GetOrCreateChannelResponse } from '@common/types';
import { fetchNui } from '~/utils/fetchNui';
import { devMode } from '~/utils/utils';

/**
 * Dev stub: fabricates a deterministic channel (`dev-<companyId>`) when the
 * NUI round-trip is unavailable, so the flow stays testable in the browser.
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
