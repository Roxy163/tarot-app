const getErrorCode = (error: unknown) => (
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : ''
);

const getErrorMessage = (error: unknown) => (
  error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : ''
);

export const isFirebaseOfflineError = (error: unknown) => {
  const code = getErrorCode(error).toLowerCase();
  const message = getErrorMessage(error).toLowerCase();

  return (
    code === 'unavailable'
    || code === 'firestore/unavailable'
    || message.includes('client is offline')
    || message.includes('offline')
    || message.includes('failed to fetch')
    || message.includes('network')
  );
};

export const isFirebasePermissionError = (error: unknown) => {
  const code = getErrorCode(error).toLowerCase();
  const message = getErrorMessage(error).toLowerCase();

  return (
    code === 'permission-denied'
    || code === 'firestore/permission-denied'
    || message.includes('missing or insufficient permissions')
    || message.includes('permission')
  );
};

export const getFriendlyCloudSyncError = (error: unknown) => {
  if (isFirebaseOfflineError(error)) {
    return '当前网络暂时连不上云端；本机数据已保留，联网后点「重新同步」。';
  }

  if (isFirebasePermissionError(error)) {
    return '云端权限验证失败，请退出后重新登录再试。';
  }

  const message = getErrorMessage(error);
  if (message && /[\u4e00-\u9fa5]/.test(message)) return message;

  return '云端暂时不可用，本机数据已保留；请稍后重试。';
};
