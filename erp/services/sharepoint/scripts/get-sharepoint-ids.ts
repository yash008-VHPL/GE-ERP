#!/usr/bin/env ts-node
// =============================================================================
// GE ERP — SharePoint Service
// scripts/get-sharepoint-ids.ts
//
// One-time helper: prints the SHAREPOINT_SITE_ID and SHAREPOINT_DRIVE_ID values
// you need to put in .env.  Run once during initial setup.
//
// Prerequisites:
//   - .env must have AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
//   - The app registration must have Sites.Read.All (Application) granted
//
// Usage:
//   npx ts-node scripts/get-sharepoint-ids.ts \
//     --hostname your-company.sharepoint.com \
//     --site     GE-ERP \
//     --library  "Shared Documents"
// =============================================================================

import 'dotenv/config';
import 'isomorphic-fetch';
import { buildAppOnlyGraphClient } from '../src/config/graph';

async function main() {
  const args    = process.argv.slice(2);
  const get     = (flag: string) => args[args.indexOf(flag) + 1];
  const hostname = get('--hostname') ?? process.env['SP_HOSTNAME'];
  const siteName = get('--site')     ?? process.env['SP_SITE_NAME'];
  const library  = get('--library')  ?? 'Shared Documents';

  if (!hostname || !siteName) {
    console.error('Usage: ts-node get-sharepoint-ids.ts --hostname <hostname> --site <siteName>');
    process.exit(1);
  }

  const client = await buildAppOnlyGraphClient();

  // 1. Get site ID
  const site = await client
    .api(`/sites/${hostname}:/sites/${siteName}`)
    .select('id,displayName,webUrl')
    .get();

  console.log('\n--- SharePoint Site ---');
  console.log('displayName:       ', site.displayName);
  console.log('webUrl:            ', site.webUrl);
  console.log('SHAREPOINT_SITE_ID:', site.id);

  // 2. List drives and find the matching document library
  const drivesResp = await client
    .api(`/sites/${site.id}/drives`)
    .select('id,name,driveType,webUrl')
    .get();

  console.log('\n--- Available Drives (document libraries) ---');
  for (const drive of drivesResp.value) {
    const match = drive.name === library || library === '';
    console.log(
      `${match ? '→ ' : '  '}${drive.name.padEnd(30)} driveType: ${drive.driveType.padEnd(15)} id: ${drive.id}`
    );
    if (match) {
      console.log('\nSHAREPOINT_DRIVE_ID:', drive.id);
    }
  }

  console.log('\nCopy the values above into your .env file.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
