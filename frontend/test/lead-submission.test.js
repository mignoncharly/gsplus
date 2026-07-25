import assert from 'node:assert/strict';
import test from 'node:test';

import { createLeadSubmissionController, resetFormAfterSuccess } from '../src/lib/lead-submission.js';

test('captures the form before an async boundary and safely resets it after success', async () => {
  let resetCount = 0;
  const formElement = { reset: () => { resetCount += 1; } };
  const event = { currentTarget: formElement };
  const controller = createLeadSubmissionController(() => 'submission-1');
  const submission = controller.start(event.currentTarget);

  event.currentTarget = null;
  await Promise.resolve();

  assert.equal(resetFormAfterSuccess(submission.formElement, true), true);
  assert.equal(resetCount, 1);
});

test('blocks rapid repeats and reuses the key for a retry after failure', () => {
  const keys = ['submission-1', 'submission-2'];
  const controller = createLeadSubmissionController(() => keys.shift());
  const formElement = { reset() {} };

  assert.equal(controller.start(formElement).submissionKey, 'submission-1');
  assert.equal(controller.start(formElement), null);

  controller.fail();
  assert.equal(controller.start(formElement).submissionKey, 'submission-1');

  controller.next();
  assert.equal(controller.start(formElement).submissionKey, 'submission-2');
});

test('does not reset an admin form after a failed action', () => {
  let resetCount = 0;
  const formElement = { reset: () => { resetCount += 1; } };

  assert.equal(resetFormAfterSuccess(formElement, false), false);
  assert.equal(resetCount, 0);
  assert.equal(resetFormAfterSuccess(formElement, true), true);
  assert.equal(resetCount, 1);
});
