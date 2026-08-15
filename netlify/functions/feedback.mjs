const FEEDBACK_EMAIL = 'roxy163@outlook.com';
const FORM_ENDPOINT = `https://formsubmit.co/ajax/${FEEDBACK_EMAIL}`;
const MESSAGE_MAX_LENGTH = 1200;
const CONTACT_MAX_LENGTH = 100;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

const jsonResponse = (body, statusCode = 200) => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

const cleanText = (value, maxLength) => (
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
);

const readProviderMessage = async (response) => {
  try {
    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      return [payload?.message, payload?.error, payload?.success]
        .filter(value => typeof value === 'string')
        .join(' ');
    }

    return await response.text();
  } catch {
    return '';
  }
};

const needsRecipientActivation = (message) => (
  /activat|confirm|verif|验证|确认|激活/i.test(message)
);

const normalizePayload = (payload) => {
  const message = cleanText(payload?.反馈内容, MESSAGE_MAX_LENGTH);
  const contact = cleanText(payload?.联系方式, CONTACT_MAX_LENGTH) || '未填写';

  if (payload?._honey) {
    return { error: '提交内容未通过检查。' };
  }

  if (message.length < 5) {
    return { error: '再多写一点点，方便作者理解你的想法。' };
  }

  return {
    data: {
      _subject: cleanText(payload?._subject, 80) || '[塔罗研习阁] 用户反馈',
      _template: 'table',
      _captcha: 'false',
      _honey: '',
      反馈类型: cleanText(payload?.反馈类型, 20) || '其他',
      反馈内容: message,
      联系方式: contact,
      使用端: cleanText(payload?.使用端, 20) || '未知',
      页面: cleanText(payload?.页面, 120) || '/',
      提交时间: cleanText(payload?.提交时间, 40) || new Date().toISOString(),
    },
  };
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse({ message: 'Method Not Allowed' }, 405);
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse({ message: '提交内容格式不正确。' }, 400);
  }

  const normalized = normalizePayload(payload);
  if (normalized.error) {
    return jsonResponse({ message: normalized.error }, 400);
  }

  try {
    const response = await fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Accept: 'application/json',
      },
      body: new URLSearchParams(normalized.data).toString(),
    });

    const providerMessage = await readProviderMessage(response);

    if (needsRecipientActivation(providerMessage)) {
      return jsonResponse({
        deliveryState: 'needs-activation',
        message: '邮箱转发服务需要作者先确认收件地址。',
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
};
