import { ReadingSlotData } from '../types';

/**
 * 邮件发送服务
 * 预留接口，目前使用模板生成邮件内容
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
   * 注意：在浏览器环境下，通常需要通过 EmailJS 或 后端 API 发送
   */
  sendReadingToEmail: async (email: string, content: string) => {
    // 模拟发送过程
    console.log(`正在向 ${email} 发送内容:`, content);
    
    // 这里是集成点：
    // 未来您可以填入 EmailJS 的初始化代码：
    // return emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', { to_email: email, message: content });
    
    return new Promise((resolve) => setTimeout(() => resolve(true), 1500));
  }
};
