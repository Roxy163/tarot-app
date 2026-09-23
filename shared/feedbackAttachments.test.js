import { describe, expect, it } from 'vitest';
import { normalizeFeedbackAttachments, validateFeedbackAttachment, FEEDBACK_ATTACHMENT_MAX_BYTES } from './feedbackAttachments.js';
import { PNG_CONTENT } from '../src/test/feedbackFixtures';

describe('反馈附件规则', () => {
  it.each([
    ['png', 'image/png', PNG_CONTENT],
    ['jpg', 'image/jpeg', btoa('\xff\xd8\xfftest')],
    ['gif', 'image/gif', btoa('GIF89atest')],
    ['webp', 'image/webp', btoa('RIFF\x04\x00\x00\x00WEBP')],
    ['pdf', 'application/pdf', btoa('%PDF-1.4\n%%EOF')],
    ['txt', 'text/plain', btoa('steps\n1. open app')],
  ])('保留合法的 %s 附件', (extension, contentType, content) => {
    expect(validateFeedbackAttachment({ filename: `test.${extension}`, contentType, content })).toMatchObject({ contentType, content, size: atob(content).length });
  });

  it('手机未提供 MIME 时补齐，并保留中文文本内容', () => {
    const content = btoa(String.fromCharCode(...new TextEncoder().encode('复现步骤：打开设置')));
    expect(validateFeedbackAttachment({ filename: '说明.TXT', contentType: '', content })).toMatchObject({ filename: '说明.txt', contentType: 'text/plain', content });
  });

  it.each([
    { filename: 'test.svg', contentType: 'image/svg+xml', content: btoa('<svg/>') },
    { filename: 'test.html', contentType: 'text/plain', content: btoa('<script/>') },
    { filename: 'test.pdf', contentType: 'application/pdf', content: btoa('MZ executable') },
    { filename: 'test.txt', contentType: 'text/plain', content: btoa('\0binary') },
    { filename: 'test.txt', contentType: 'text/plain', content: 'dGV4dB==' },
  ])('拒绝未允许类型、伪装内容或损坏编码：$filename', attachment => {
    expect(() => validateFeedbackAttachment(attachment)).toThrow();
  });

  it('支持恰好 3MB 的文件，超过上限时即使谎报大小也拒绝', () => {
    const content = btoa('a'.repeat(FEEDBACK_ATTACHMENT_MAX_BYTES));
    expect(validateFeedbackAttachment({ filename: 'test.txt', contentType: 'text/plain', content, size: 1 }).size).toBe(FEEDBACK_ATTACHMENT_MAX_BYTES);
    expect(() => validateFeedbackAttachment({ filename: 'test.txt', contentType: 'text/plain', content: btoa('a'.repeat(FEEDBACK_ATTACHMENT_MAX_BYTES + 1)), size: 1 })).toThrow('单个附件不能超过 3MB');
  });

  it('清理文件名并保留长文件名的扩展名', () => {
    const attachment = validateFeedbackAttachment({ filename: `${'说明'.repeat(60)}.PDF`, contentType: 'application/pdf', content: btoa('%PDF-1.4') });
    expect(attachment.filename.length).toBeLessThanOrEqual(90);
    expect(attachment.filename).toMatch(/\.pdf$/);
  });

  it('拒绝非列表附件数据', () => {
    expect(() => normalizeFeedbackAttachments({ filename: 'test.txt' })).toThrow('附件格式不正确');
  });
});
