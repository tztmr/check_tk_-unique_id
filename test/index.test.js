const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../index.js');

test('merges sec_uid profile punish info into user_info', () => {
  const helpers = handler.__test__ || {};

  assert.equal(typeof helpers.mergeProfileIntoUserInfo, 'function');

  const apiBody = {
    status_code: 0,
    user_info: {
      sec_uid: 'MS4w-test',
      unique_id: '68695211505',
      nickname: '68695211505'
    }
  };

  const profileBody = {
    status_code: 0,
    user: {
      sec_uid: 'MS4w-test',
      unique_id: '68695211505',
      is_ban: true,
      follower_count: 0,
      punish_remind_info: {
        punish_title: '账号已被封禁'
      }
    }
  };

  const merged = helpers.mergeProfileIntoUserInfo(apiBody, profileBody);

  assert.equal(merged.user_info.sec_uid, 'MS4w-test');
  assert.equal(merged.user_info.is_ban, true);
  assert.equal(merged.user_info.follower_count_str, '0');
  assert.equal(merged.user_info.punish_remind_info.punish_title, '账号已被封禁');
});
