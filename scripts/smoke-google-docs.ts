import { createHash } from 'node:crypto';

import { getServerEnv } from '../packages/server/src/config/env';
import { GoogleDocsClient } from '../packages/server/src/adapters/advisor-adapters';

const DOC_ID = '1jQCF3lhyjAKbyEnK1fwDIalW05l8W5TJTZnaKZ9Tktw';

const env = getServerEnv();
const client = new GoogleDocsClient(env);

console.log(`Fetching Google Doc: ${DOC_ID}`);
console.log(
  `Using service account: ${env.GOOGLE_DOCS_SERVICE_ACCOUNT_JSON ? '✓ present' : '✗ missing'}\n`
);

try {
  const doc = await client.fetchDocument(DOC_ID);
  const hash = createHash('sha256').update(doc.text.trim()).digest('hex');

  console.log(`Text length : ${doc.text.length} chars`);
  console.log(`Revision   : ${doc.revision}`);
  console.log(`SHA-256    : ${hash}`);
  console.log(`\nFirst 500 chars:\n${'─'.repeat(60)}`);
  console.log(doc.text.slice(0, 500));
  console.log('─'.repeat(60));
} catch (error) {
  if (
    error != null &&
    typeof error === 'object' &&
    'statusCode' in error &&
    'message' in error
  ) {
    console.error(
      `HttpException [${(error as { statusCode: number }).statusCode}]: ${(error as { message: string }).message}`
    );
  } else {
    console.error('Unexpected error:', error);
  }
  process.exit(1);
}
