const assert = require('node:assert/strict');
const core = require('../core.js');
const cues = core.parseSrt('\uFEFF1\r\n00:00:01,250 --> 00:00:03,500\r\n<i>Hello.</i>\r\nSecond line.\r\n\r\n2\r\n00:01:00,000 --> 00:01:02,000\r\nAfter seeking.');
assert.equal(core.cueText(cues, 1250), 'Hello.\nSecond line.');
assert.equal(core.cueText(cues, 3500), '');
assert.equal(core.cueText(cues, 61000), 'After seeking.');
assert.equal(core.cueText(cues, 2000), 'Hello.\nSecond line.');
assert.equal(core.englishTrack([
    { Type: 'Subtitle', Index: 1, Language: 'eng', Codec: 'pgssub' },
    { Type: 'Subtitle', Index: 2, Language: 'eng', Codec: 'subrip', IsExternal: true }
]).Index, 2);
console.log('PASS: multiline SRT, formatting, cue end, forward/backward seek, English sidecar preference.');

// The original first-English choice selected a forced track over full dialogue.
const forced = { Type: 'Subtitle', Index: 1, Language: 'eng', Codec: 'subrip', IsForced: true };
const full = { Type: 'Subtitle', Index: 2, Language: 'eng', Codec: 'subrip' };
const sdh = { Type: 'Subtitle', Index: 3, Language: 'eng', Codec: 'subrip', Title: 'English SDH' };
assert.equal(core.englishTrack([forced, sdh, full]).Index, 2);
assert.equal(core.englishTrack([forced, sdh]).Index, 3);
assert.equal(core.englishTrack([forced]).Index, 1);
console.log('PASS: full dialogue, SDH and forced-only English priority.');
