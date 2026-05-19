import emailjs from 'emailjs-com';
import { ReadingSlotData } from '../types';

// EmailJS 配置 - 请在 https://www.emailjs.com/ 创建账户后填写
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const EMAILJS_USER_ID = 'YOUR_USER_ID';

/**
 * 邮件发送服务
 * 使用 EmailJS 发送占卜报告邮件
 */
export const emailService = {
  /**
   * 格式化占卜报告内容
   */
  generateReadingReport: (
    question: string,
    slots: ReadingSlotData[], 
    interpretation: string,
    userName: string = '研习者'
  ) => {
    const cardLines = slots.map((s, i) => 
      `${i + 1}. 【${s.label}】: ${s.name} (${s.isReversed ? '逆位' : '正位'})`
    ).join('\n');

    return `
🔮 塔罗研习阁 - 占卜手记汇报

尊敬的 ${userName}：

这是您于 ${new Date().toLocaleString()} 进行的占卜记录：

【您的问题】
${question}

【抽牌阵列】
${cardLines}

【深度解读】
${interpretation || '暂无解读记录'}

---
愿森林的宁静指引您的方向。
塔罗研习阁 (Tarot Pavilion)
    `.trim();
  },

  /**
   * 执行发送操作
   * 使用 EmailJS 发送邮件
   */
  sendReadingToEmail: async (email: string, content: string) => {
    // 检查是否已配置 EmailJS
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_USER_ID) {
      throw new Error('邮件服务尚未配置，请在 emailService.ts 中填写 EmailJS 配置');
    }

    try {
      const templateParams = {
        to_email: email,
        message: content,
        subject: '🔮 塔罗研习阁 - 占卜报告',
        from_name: '塔罗研习阁',
      };

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_USER_ID
      );

      console.log('Email sent successfully:', response);
      return response;
    } catch (error: any) {
      console.error('Email send failed:', error);
      
      // 友好的错误提示
      let errorMessage = '发送失败，请稍后重试';
      if (error.status === 401) {
        errorMessage = '邮件服务配置错误，请检查 API 密钥';
      } else if (error.status === 404) {
        errorMessage = '邮件模板或服务未找到';
      } else if (error.text) {
        errorMessage = error.text;
      }
      
      throw new Error(errorMessage);
    }
  },

  /**
   * 检查 EmailJS 是否已配置
   */
  isConfigured: () => {
    return EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_USER_ID && 
           !EMAILJS_SERVICE_ID.includes('YOUR_') && 
           !EMAILJS_TEMPLATE_ID.includes('YOUR_') && 
           !EMAILJS_USER_ID.includes('YOUR_');
  }
};
