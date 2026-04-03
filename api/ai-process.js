// api/ai-process.js - 最终稳定版（完全匹配你的项目）
export default async function handler(req, res) {
  // 解决中文乱码 + 跨域
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const ALI_DASHSCOPE_KEY = process.env.ALI_DASHSCOPE_KEY;
    if (!ALI_DASHSCOPE_KEY) throw new Error('通义千问密钥未配置');

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: '请输入有效内容' });

    // 新加坡节点官方Base URL（100%适配亚非拉网络）
    const API_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ALI_DASHSCOPE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen3.5-flash', // 新加坡节点官方支持的正确模型
        messages: [
          {
            role: 'system',
            content: `你是专业的多语种语言学习助手，严格按JSON格式返回，无任何额外内容：
{
  "polished_text": "优化后的完整文本（语法修正、表达地道）",
  "extracted_words": ["单词1", "单词2", "单词3", "单词4", "单词5"]
}
要求：支持中文、英语、斯瓦希里语、豪萨语等所有语种，提取1-5个核心词汇，仅返回JSON`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API错误:', errorData);
      throw new Error(`调用失败: ${errorData.error?.message || response.statusText}`);
    }

    const aiResult = await response.json();
    const aiContent = aiResult.choices[0].message.content;

    // 解析AI返回的JSON（兼容格式问题）
    let parsedResult;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI返回格式错误');
      parsedResult = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('解析失败:', aiContent);
      throw new Error('AI返回格式错误，请重试');
    }

    return res.status(200).json({
      success: true,
      polished_text: parsedResult.polished_text,
      extracted_words: parsedResult.extracted_words
    });

  } catch (error) {
    console.error('AI处理错误:', error);
    return res.status(500).json({
      success: false,
      message: `AI处理失败: ${error.message || '未知错误'}`
    });
  }
}
