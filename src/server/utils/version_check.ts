import Config from '@common/config';

export async function VersionCheck() {
  if (Config.VersionCheck !== false) return;

  let repo_version: string = '0.0.0';
  const current_version: string = GetResourceMetadata(GetCurrentResourceName(), 'version', 0);

  try {
    const versionResponse = await fetch('https://api.github.com/repos/Maximus7474/mps-beacon-app/releases/latest');

    if (!versionResponse.ok) {
      throw new Error(`HTTP error! status: ${versionResponse.status}`);
    }

    const responseData = (await versionResponse.json()) as any;
    const upstreamVersion = responseData.tag_name as string;

    repo_version = upstreamVersion.replace(/[a-zA-Z]+/, '');
  } catch (error) {
    console.error(`^1Failed to get latest version:^7`, error);
    repo_version = '0.0.0';
  }

  if (repo_version !== current_version) {
    console.log('^6------------------------------------------------------------------------------^7');
    console.log(`^4^3mps-beacon-app^4 has a new update available (^2${current_version}^4 -> ^2${repo_version}^4):^7`);
    console.log(`^4 -> https://github.com/Maximus7474/mps-beacon-app/releases/latest^7`);
    console.log('^6------------------------------------------------------------------------------^7');
  }
}

VersionCheck();
