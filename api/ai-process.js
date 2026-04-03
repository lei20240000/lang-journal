// api/ai-process.js - 新加坡节点最终稳定版
export default async function handler(req, res) {
  // 解决中文乱码 + 跨域
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    // 1. 读取Vercel环境变量（通义千问密钥）
    const ALI_DASHSCOPE_KEY = process.env.ALI_DASHSCOPE_KEY;
    if (!ALI_DASHSCOPE_KEY) throw new Error('通义千问密钥未配置');

    // 2. 获取用户输入
    const { text } = req.body;
    if (!text || text.trim() === '') return res.status(400).json({ success: false, message: '请输入有效内容' });

    // 3. 新加坡节点Base URL（你截图里的官方地址，100%可用）
    const API_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
    const API_URL = `${API_BASE_URL}/chat/completions`;

    // 4. 调用通义千问（新加坡节点支持的标准模型qwen3.5-flash）
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ALI_DASHSCOPE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen3.5-flash', // ✅ 新加坡节点官方支持的正确模型名
        messages: [
          {
            role: 'system',
            content: `你是专业的多语种语言学习助手，严格按照JSON格式返回结果，不要任何额外内容：
{
  "polished_text": "优化后的完整文本（语法修正、表达更地道）",
  "extracted_words": ["单词1", "单词2", "单词3", "单词4", "单词5"]
}
要求：
1. 支持中文、英语、斯瓦希里语、豪萨语等所有语种
2. 提取5-10个核心学习词汇，仅返回单词本身
3. 仅返回JSON，不要任何解释、说明、markdown格式`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    // 5. 处理API响应
    if (!response.ok) {
      const errorData = await response.json();
      console.error('通义千问API错误:', errorData);
      throw new Error(`调用失败: ${errorData.error?.message || response.statusText}`);
    }

    const aiResult = await response.json();
    const aiContent = aiResult.choices[0].message.content;

    // 6. 解析AI返回的JSON（兼容AI可能的格式问题）
    let parsedResult;
    try {
      // 提取纯JSON部分
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI返回格式错误');
      parsedResult = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('JSON解析失败，AI返回内容:', aiContent);
      throw new Error('AI返回格式错误，请重试');
    }

    // 7. 返回成功结果
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
