import { triggerServerCallback } from './utils/callbacks';
import type {
  AddAnnouncementPayload,
  AddPostRequest,
  Announcement,
  BasicResponse,
  Company,
  DeleteAnnouncementPayload,
  DeletePostRequest,
  EmployeeCompanyResponse,
  JobData,
  UpdateCompanyStatusRequest,
} from '../common/types';
import './init';

const register = <T>(name: string, handler: (data: any) => Promise<T>, onError: T) => {
  RegisterNuiCallback(name, async (data: any, cb: (result: T) => void) => {
    try {
      cb(await handler(data));
    } catch (err) {
      console.error(`[beaconapp] NUI callback '${name}' failed`, err);
      cb(onError);
    }
  });
};

register<Company[]>('beaconapp:getcompanies', () => triggerServerCallback<Company[]>('beaconapp:getcompanies'), []);
register<Announcement[]>(
  'beaconapp:getannouncements',
  () => triggerServerCallback<Announcement[]>('beaconapp:getannouncements'),
  [],
);
register<BasicResponse>(
  'beaconapp:addannouncement',
  (data: AddAnnouncementPayload) => triggerServerCallback<BasicResponse>('beaconapp:addannouncement', data),
  { success: false, message: 'Unable to post announcement' },
);
register<BasicResponse>(
  'beaconapp:deleteannouncement',
  (data: DeleteAnnouncementPayload) => triggerServerCallback<BasicResponse>('beaconapp:deleteannouncement', data),
  { success: false, message: 'Unable to delete announcement' },
);
register<BasicResponse>(
  'beaconapp:addpost',
  (data: AddPostRequest) => triggerServerCallback<BasicResponse>('beaconapp:addpost', data),
  { success: false, message: 'Unable to add post' },
);
register<BasicResponse>(
  'beaconapp:deletepost',
  (data: DeletePostRequest) => triggerServerCallback<BasicResponse>('beaconapp:deletepost', data),
  { success: false, message: 'Unable to delete post' },
);
register<BasicResponse>(
  'beaconapp:setcompanystatus',
  (data: UpdateCompanyStatusRequest) => triggerServerCallback<BasicResponse>('beaconapp:setcompanystatus', data),
  { success: false, message: 'Unable to update status' },
);

onNet('beaconapp:client:updatecompany', (company: Company) => {
  SendNUIMessage({ action: 'beaconapp:updatecompany', data: company });
});

onNet('beaconapp:client:updateannouncement', (announcement: Announcement) => {
  SendNUIMessage({ action: 'beaconapp:updateannouncement', data: announcement });
});

onNet('beaconapp:client:removeannouncement', (data: { id: string }) => {
  SendNUIMessage({ action: 'beaconapp:removeannouncement', data });
});

// framework integration

const applyEmployeeState = async (jobData: JobData | null) => {
  const group = jobData?.group;
  if (!group) {
    SendNUIMessage({ action: 'beaconapp:setemployeemode', data: { enabled: false } });
    return;
  }

  try {
    const { companyId } = await triggerServerCallback<EmployeeCompanyResponse>('beaconapp:getemployeecompany', {
      group,
    });
    SendNUIMessage({ action: 'beaconapp:setemployeemode', data: { enabled: Boolean(companyId), companyId } });
  } catch (err) {
    console.error('[beaconapp] failed to resolve employee company', err);
    SendNUIMessage({ action: 'beaconapp:setemployeemode', data: { enabled: false } });
  }
};

on('beaconapp:groupupdate', (jobData?: JobData | null) => {
  void applyEmployeeState(jobData ?? null);
});
