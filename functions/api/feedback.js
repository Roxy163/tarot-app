const FEEDBACK_EMAIL = 'roxy163@outlook.com';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const MESSAGE_MAX_LENGTH = 1200;
const CONTACT_MAX_LENGTH = 100;
const ATTACHMENT_MAX_COUNT = 9;
const ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024;
const ATTACHMENT_TOTAL_MAX_BYTES = 24 * 1024 * 1024;
const ATTACHMENT_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

const rateLimitMap = new Map();

const baseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: baseHeaders,
});

const cleanText = (value, maxLength) => (
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
);

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const getClientIp = (request) => (
  request.headers.get('CF-Connecting-IP')
  || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  || 'unknown'
);

const isRateLimited = (clientIp) => {
  const now = Date.now();

  for (const [ip, record] of rateLimitMap) {
    if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }

  const record = rateLimitMap.get(clientIp);
  if (!record || now - record.startTime > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(clientIp, { startTime: now, count: 1 });
    return false;
  }

  record.count += 1;
  return record.count > RATE_LIMIT_MAX;
};

const readProviderMessage = async (response) => {
  try {
    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      return [payload?.message, payload?.error, payload?.name]
        .filter(value => typeof value === 'string')
        .join(' ');
    }

    return await response.text();
  } catch {
    return '';
  }
};

const needsSenderActivation = (message) => (
  /activat|confirm|verif|验证|确认|激活|domain|sender|from/i.test(message)
);

const cleanFilename = (filename, index) => {
  const cleaned = cleanText(filename, 90).replace(/[^\w.\-\u4e00-\u9fa5]/g, '-');
  return cleaned || `screenshot-${index + 1}.png`;
};

const estimateBase64Bytes = (content) => Math.ceil(String(content || '').length * 3 / 4);

const normalizeAttachments = (payloadAttachments) => {
  if (!Array.isArray(payloadAttachments)) return [];
  if (payloadAttachments.length > ATTACHMENT_MAX_COUNT) {
    return { error: `截图最多上传 ${ATTACHMENT_MAX_COUNT} 张。` };
  }

  let totalBytes = 0;
  const attachments = [];

  for (const [index, attachment] of payloadAttachments.entries()) {
    const contentType = cleanText(attachment?.contentType, 40).toLowerCase();
    const content = cleanText(attachment?.content, ATTACHMENT_MAX_BYTES * 2)
      .replace(/^data:[^;]+;base64,/, '');
    const declaredSize = Number.isFinite(attachment?.size) ? Number(attachment.size) : 0;
    const size = Math.max(declaredSize, estimateBase64Bytes(content));

    if (!content || !/^[a-z0-9+/=]+$/i.test(content)) {
      return { error: '截图内容读取失败，请重新选择。' };
    }

    if (!ATTACHMENT_ALLOWED_TYPES.has(contentType)) {
      return { error: '截图只支持 PNG、JPG、WebP 或 GIF。' };
    }

    if (size > ATTACHMENT_MAX_BYTES) {
      return { error: '单张截图不能超过 3MB。' };
    }

    totalBytes += size;
    if (totalBytes > ATTACHMENT_TOTAL_MAX_BYTES) {
      return { error: '截图总大小不能超过 24MB。' };
    }

    attachments.push({
      filename: cleanFilename(attachment?.filename, index),
      content,
      content_type: contentType,
    });
  }

  return attachments;
};

const normalizePayload = (payload) => {
  const message = cleanText(payload?.反馈内容, MESSAGE_MAX_LENGTH);
  const contact = cleanText(payload?.联系方式, CONTACT_MAX_LENGTH) || '未填写';
  const attachments = normalizeAttachments(payload?.attachments);
  const userContext = normalizeUserContext(payload?.用户识别);

  if (payload?._honey) {
    return { error: '提交内容未通过检查。' };
  }

  if (message.length < 5) {
    return { error: '再多写一点点，方便作者理解你的想法。' };
  }

  if (attachments.error) {
    return { error: attachments.error };
  }

  return {
    data: {
      subject: cleanText(payload?._subject, 80) || '[塔罗研习阁] 用户反馈',
      category: cleanText(payload?.反馈类型, 20) || '其他',
      message,
      contact,
      deviceType: cleanText(payload?.使用端, 20) || '未知',
      submittedAt: cleanText(payload?.提交时间, 40) || new Date().toISOString(),
      userContext,
      attachments,
    },
  };
};

const normalizeUserContext = (value) => {
  const context = value && typeof value === 'object' ? value : {};
  return {
    authState: cleanText(context.登录状态, 20) || '未知',
    publicId: cleanText(context.公开ID, 80),
    uid: cleanText(context.用户ID, 120),
    email: cleanText(context.登录邮箱, 160),
    displayName: cleanText(context.昵称, 80),
    guestId: cleanText(context.游客反馈ID, 40),
  };
};

const getMailConfig = (env = {}) => {
  const apiKey = cleanText(env.RESEND_API_KEY, 240);
  const from = cleanText(env.RESEND_FROM_EMAIL || env.RESEND_FROM, 160);
  const to = cleanText(env.FEEDBACK_TO_EMAIL || env.FEEDBACK_EMAIL, 160) || FEEDBACK_EMAIL;

  if (!apiKey || !from) {
    return {
      error: '邮件服务还没配置完成。请先设置 RESEND_API_KEY 和 RESEND_FROM_EMAIL。',
    };
  }

  return { apiKey, from, to };
};

const createEmailText = (data) => [
  `反馈类型：${data.category}`,
  `反馈内容：${data.message}`,
  `联系方式：${data.contact}`,
  `使用端：${data.deviceType}`,
  `提交时间：${data.submittedAt}`,
  `截图数量：${data.attachments.length}`,
  ...createUserContextRows(data.userContext).map(([label, value]) => `${label}：${value}`),
].join('\n\n');

const createUserContextRows = (userContext = {}) => ([
  ['用户状态', userContext.authState || '未知'],
  userContext.publicId ? ['公开ID', userContext.publicId] : null,
  userContext.uid ? ['用户ID', userContext.uid] : null,
  userContext.email ? ['登录邮箱', userContext.email] : null,
  userContext.displayName ? ['昵称', userContext.displayName] : null,
  userContext.guestId ? ['游客反馈ID', userContext.guestId] : null,
].filter(Boolean));

const createEmailHtml = (data) => {
  const rows = [
    ['反馈类型', data.category],
    ['反馈内容', data.message],
    ['联系方式', data.contact],
    ['使用端', data.deviceType],
    ['提交时间', data.submittedAt],
    ['截图数量', `${data.attachments.length}`],
    ...createUserContextRows(data.userContext),
  ];

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.7;color:#2f332f;">
      <h2 style="margin:0 0 16px;color:#5f9470;">塔罗研习阁用户反馈</h2>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:720px;">
        ${rows.map(([label, value]) => `
          <tr>
            <th align="left" style="width:96px;border:1px solid #dfe8de;background:#f5faf4;color:#5f9470;">${escapeHtml(label)}</th>
            <td style="border:1px solid #dfe8de;white-space:pre-wrap;">${escapeHtml(value)}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: baseHeaders });
}

export async function onRequestPost({ request, env }) {
  if (isRateLimited(getClientIp(request))) {
    return jsonResponse({ message: '反馈发送太频繁了，请稍后再试。' }, 429);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ message: '提交内容格式不正确。' }, 400);
  }

  const normalized = normalizePayload(payload);
  if (normalized.error) {
    return jsonResponse({ message: normalized.error }, 400);
  }

  const mailConfig = getMailConfig(env);
  if (mailConfig.error) {
    return jsonResponse({
      deliveryState: 'needs-configuration',
      message: mailConfig.error,
    });
  }

  const resendPayload = {
    from: mailConfig.from,
    to: [mailConfig.to],
    subject: normalized.data.subject,
    text: createEmailText(normalized.data),
    html: createEmailHtml(normalized.data),
    attachments: normalized.data.attachments,
  };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mailConfig.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    const providerMessage = await readProviderMessage(response);

    if (needsSenderActivation(providerMessage)) {
      return jsonResponse({
        deliveryState: 'needs-activation',
        message: 'Resend 发件地址还需要验证后才能稳定送达。',
        providerMessage,
      });
    }

    if (!response.ok) {
      return jsonResponse({
        message: '暂时没能送出，内容已保存在本机。',
        providerMessage,
      }, 502);
    }

    return jsonResponse({
      deliveryState: 'sent',
      message: 'sent',
      providerMessage,
    });
  } catch {
    return jsonResponse({ message: '暂时没能送出，内容已保存在本机。' }, 502);
  }
}
