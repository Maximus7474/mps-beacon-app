let debugEnabled = GetConvarInt('beaconapp:debug', 0) === 1;

AddConvarChangeListener('beaconapp:debug', (_name: string, _reserved: unknown) => {
  debugEnabled = GetConvarInt('beaconapp:debug', 0) === 1;

  if (!IsDuplicityVersion())
    SendNUIMessage({
      action: 'debugupdate',
      data: debugEnabled,
    })

  console.log(`Debug mode ${debugEnabled ? '^2Enabled' : '^1Disabled'}^7`)
});

export function debuglog(...args: any[]) {
  if (!debugEnabled) return;
  console.log(GetGameTimer(), ...args);
}
