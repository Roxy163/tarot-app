import { describe, expect, it } from 'vitest';
import { getFriendlyCloudSyncError, isFirebaseOfflineError, isFirebasePermissionError } from './firebaseErrors';

describe('firebase error helpers', () => {
  it('maps Firestore offline errors to a friendly local-preserved message', () => {
    const error = Object.assign(
      new Error('Failed to get document because the client is offline.'),
      { code: 'unavailable' },
    );

    expect(isFirebaseOfflineError(error)).toBe(true);
    expect(getFriendlyCloudSyncError(error)).toBe('当前网络暂时连不上云端；本机数据已保留，联网后点「重新同步」。');
  });

  it('maps permission errors without exposing raw Firebase English copy', () => {
    const error = Object.assign(
      new Error('Missing or insufficient permissions.'),
      { code: 'permission-denied' },
    );

    expect(isFirebasePermissionError(error)).toBe(true);
    expect(getFriendlyCloudSyncError(error)).toBe('云端权限验证失败，请退出后重新登录再试。');
  });
});
