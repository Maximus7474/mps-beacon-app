import { SEED_CHANNELS } from '@common/data/channels';
import type { Company, GetOrCreateChannelResponse } from '@common/types';
import { fetchNui } from '~/utils/fetchNui';
import { devMode } from '~/utils/utils';

/**
 * Dev stub: when the NUI round-trip is unavailable, resolves the company's
 * seeded conversation (compound id `<companyId>:<phone>`) so the dev Message
 * button opens the same thread the backend would have created/found.
 */
export async function requestChannel(
  company: Pick<Company, 'id' | 'name' | 'icon' | 'iconBg' | 'image' | 'phone'>,
): Promise<GetOrCreateChannelResponse> {
  const response = await fetchNui<GetOrCreateChannelResponse>(
    'beaconapp:getorcreatechannel',
    { companyId: company.id },
    devMode
      ? (() => {
          // Prefer the seeded personal conversation for this company; fall back
          // to fabricating one when the seed has no phone for the company.
          const seeded = SEED_CHANNELS.find((c) => c.scope === 'personal' && c.companyId === company.id);
          const phone = company.phone ?? '5550000000';

          return {
            success: true,
            created: !sessionStorage.getItem(`beaconapp:channel:${company.id}`),
            channel: {
              id: seeded ? seeded.id : `${company.id}:${phone}`,
              scope: 'personal',
              companyId: company.id,
              companyName: company.name,
              companyIcon: company.icon,
              companyIconBg: company.iconBg,
              companyImage: company.image,
              phoneNumber: company.phone,
              lastMessagePreview: seeded ? seeded.lastMessagePreview : 'No messages yet',
              lastMessageAt: seeded ? seeded.lastMessageAt : Date.now(),
              unreadCount: seeded ? seeded.unreadCount : 0,
            },
          };
        })()
      : undefined,
  );

  if (response.success) {
    // Dev-only bookkeeping so `created` flips on the second request.
    sessionStorage.setItem(`beaconapp:channel:${company.id}`, '1');
  }

  return response;
}
