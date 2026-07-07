import test from 'node:test';
import assert from 'node:assert/strict';

import { parseWindowsNetstat } from '../scripts/stopPort.js';

test('parseWindowsNetstat finds listening process ids for a target port', () => {
  const output = `
  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:5000           0.0.0.0:0              LISTENING       1234
  TCP    [::]:5000              [::]:0                 LISTENING       5678
  TCP    127.0.0.1:5173         0.0.0.0:0              LISTENING       9999
  TCP    127.0.0.1:5000         127.0.0.1:12345        ESTABLISHED     1111
  `;

  assert.deepEqual(parseWindowsNetstat(output, 5000), [1234, 5678]);
});
