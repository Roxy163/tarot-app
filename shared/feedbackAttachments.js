// 浏览器和接收接口使用同一套附件规则，避免只放开文件选择器。
export const FEEDBACK_ATTACHMENT_MAX_COUNT = 9;
export const FEEDBACK_ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024;
export const FEEDBACK_ATTACHMENT_TOTAL_MAX_BYTES = 24 * 1024 * 1024;

const extensionsByType = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'application/pdf': ['pdf'],
  'text/plain': ['txt'],
};

export const FEEDBACK_ATTACHMENT_ACCEPT = [
  ...Object.keys(extensionsByType),
  ...Object.values(extensionsByType).flat().map(extension => `.${extension}`),
].join(',');

const unsupportedTypeMessage = '附件支持 PNG、JPG、WebP、GIF、PDF 或 TXT。';

export const resolveFeedbackAttachmentType = (filename, contentType) => {
  const extension = String(filename || '').trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const expectedType = Object.keys(extensionsByType).find(type => extensionsByType[type].includes(extension));
  const declaredType = String(contentType || '').trim().toLowerCase();
  // 一些手机文件选择器不提供 MIME，按已允许的扩展名补齐，再校验文件内容。
  if (!expectedType || (declaredType && declaredType !== 'application/octet-stream' && declaredType !== expectedType)) {
    throw new Error(unsupportedTypeMessage);
  }
  return expectedType;
};

const matchesContentType = (binary, contentType) => {
  switch (contentType) {
    case 'image/png': return binary.startsWith('\x89PNG\r\n\x1a\n');
    case 'image/jpeg': return binary.startsWith('\xff\xd8\xff');
    case 'image/gif': return binary.startsWith('GIF87a') || binary.startsWith('GIF89a');
    case 'image/webp': return binary.startsWith('RIFF') && binary.slice(8, 12) === 'WEBP';
    case 'application/pdf': return binary.startsWith('%PDF-');
    case 'text/plain': {
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
        return !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text);
      } catch {
        return false;
      }
    }
    default: return false;
  }
};

export const validateFeedbackAttachment = (attachment) => {
  const contentType = resolveFeedbackAttachmentType(attachment?.filename, attachment?.contentType);
  const content = String(attachment?.content || '').replace(/^data:[^;]+;base64,/, '');
  const declaredSize = Number.isFinite(attachment?.size) ? attachment.size : 0;
  if (declaredSize > FEEDBACK_ATTACHMENT_MAX_BYTES || content.length > Math.ceil(FEEDBACK_ATTACHMENT_MAX_BYTES / 3) * 4) {
    throw new Error('单个附件不能超过 3MB。');
  }
  if (!content || content.length % 4 !== 0 || !/^[a-z0-9+/]*={0,2}$/i.test(content)) {
    throw new Error('附件内容读取失败，请重新选择。');
  }

  let binary;
  try {
    binary = atob(content);
    if (btoa(binary) !== content) throw new Error('Invalid base64');
  } catch {
    throw new Error('附件内容读取失败，请重新选择。');
  }
  const size = Math.max(declaredSize, binary.length);
  if (!matchesContentType(binary, contentType)) {
    throw new Error('附件内容与文件格式不符，请重新选择；TXT 请使用 UTF-8 编码。');
  }

  // 保留真实扩展名，不让长文件名截断后变成其他格式；不在页面内执行或预览附件。
  const filename = String(attachment.filename).trim().replace(/[^\w.\-\u4e00-\u9fa5]/g, '-');
  const dotIndex = filename.lastIndexOf('.');
  const extension = filename.slice(dotIndex).toLowerCase();
  const stem = filename.slice(0, dotIndex).slice(0, 90 - extension.length) || 'attachment';
  return { filename: `${stem}${extension}`, contentType, content, size };
};

export const normalizeFeedbackAttachments = (items = []) => {
  if (!Array.isArray(items)) throw new Error('附件格式不正确，请重新选择。');
  if (items.length > FEEDBACK_ATTACHMENT_MAX_COUNT) {
    throw new Error(`附件最多上传 ${FEEDBACK_ATTACHMENT_MAX_COUNT} 个。`);
  }
  let totalBytes = 0;
  return items.map(item => {
    const attachment = validateFeedbackAttachment(item);
    totalBytes += attachment.size;
    if (totalBytes > FEEDBACK_ATTACHMENT_TOTAL_MAX_BYTES) throw new Error('附件总大小不能超过 24MB。');
    return attachment;
  });
};
