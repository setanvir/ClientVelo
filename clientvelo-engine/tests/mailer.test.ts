import { test } from 'node:test';
import assert from 'node:assert';
import { sendEmail, getTransporter } from '../src/mailer.js';

test('mailer', async (t) => {
  await t.test('dryRun returns a mock message ID', async () => {
    const result = await sendEmail('test@test.com', 'Subject', 'Body', true);
    assert.ok(result.messageId?.startsWith('dry-run-'));
    assert.equal(result.response, '250 DRY RUN OK');
  });
});
