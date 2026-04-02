#!/usr/bin/env ts-node
// =============================================================================
// GE ERP — SharePoint Service
// scripts/test-upload.ts
// End-to-end upload test using app-only auth (no user session required).
// Uploads a small test PDF to SharePoint and prints the result.
// =============================================================================

import 'dotenv/config';
import 'isomorphic-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { buildAppOnlyGraphClient } from '../src/config/graph';
import { ensureYearFolder, uploadFile } from '../src/services/sharepointService';
import { config } from '../src/config/env';

async function main() {
  const docId    = 'GE-PuO-0001-2026';
  const testFile = path.resolve(__dirname, '../../../test_vendor_so.pdf');

  // Use a small inline buffer if the file doesn't exist
  const buffer = fs.existsSync(testFile)
    ? fs.readFileSync(testFile)
    : Buffer.from(`Test supporting document for ${docId} — GE ERP`);

  const storedFilename = `${docId}.pdf`;
  const docYear        = 2026;

  console.log(`\n🚀 Testing upload for ${docId}`);
  console.log(`   File     : ${storedFilename} (${buffer.length} bytes)`);
  console.log(`   Drive    : ${config.SHAREPOINT_DRIVE_ID}`);
  console.log(`   Base path: ${config.SHAREPOINT_BASE_PATH}\n`);

  const client = await buildAppOnlyGraphClient();
  console.log('✅ Graph client built (app-only auth)');

  const folderPath = await ensureYearFolder(client, docYear);
  console.log(`✅ Folder ready: ${folderPath}`);

  const result = await uploadFile(client, folderPath, storedFilename, buffer, 'application/pdf');
  console.log('\n✅ Upload successful!');
  console.log(`   SharePoint item ID : ${result.itemId}`);
  console.log(`   Web URL            : ${result.webUrl}`);
  console.log(`   File size          : ${result.fileSize} bytes`);
}

main().catch(err => {
  console.error('\n❌ Test failed:', err.message ?? err);
  process.exit(1);
});
