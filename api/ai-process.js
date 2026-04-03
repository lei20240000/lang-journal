// api/ai-process.js
export default async function handler(req, res) {
  // 1. 解决中文乱码，必须加这个响应头
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2. 处理OPTIONS预检请求（跨域必须）
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. 只允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // 4. 读取Vercel环境变量（通义千问密钥）
    const ALI_DASHSCOPE_KEY = process.env.ALI_DASHSCOPE_KEY;
    if (!ALI_DASHSCOPE_KEY) {
      throw new Error('通义千问密钥未配置');
    }

    // 5. 从请求中获取用户输入的日记
    const { text } = req.body;
    if (!text || text.trim() === '') {
      return res.status(400).json({ success: false, message: '请输入有效内容' });
    }

    // 6. 调用通义千问API（正确的请求格式）
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ALI_DASHSCOPE_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-SSE': 'disable'
      },
      body: JSON.stringify({
        model: 'Qwen3.5-Flash-2026-02-23',
        input: {
          messages: [
            {
              role: 'system',
              content: `你是一个专业的语言学习助手。请严格按照以下要求处理用户的英文日记：
1. 优化语法和表达，生成更地道、流畅的英文（Polished Text）
2. 提取5-10个核心学习单词（Extracted Words），只返回单词本身，不要短语
3. 以严格的JSON格式返回，不要任何额外内容，格式如下：
{
  "polished_text": "优化后的完整英文句子",
  "extracted_words": ["单词1", "单词2", "单词3", ...]
}`
            },
            {
              role: 'user',
              content: text
            }
          ]
        },
        parameters: {
          result_format: 'message'
        }
      })
    });

    // 7. 检查API响应
    if (!response.ok) {
      const errorData = await response.json();
      console.error('通义千问API错误:', errorData);
      throw new Error(`AI调用失败: ${errorData.message || response.statusText}`);
    }

    const aiResult = await response.json();
    const aiContent = aiResult.output.choices[0].message.content;

    // 8. 解析AI返回的JSON（处理AI可能的格式问题）
    let parsedResult;
    try {
      // 提取AI返回的JSON部分（防止AI加了多余内容）
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI返回格式错误');
      parsedResult = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('AI返回解析失败:', aiContent);
      throw new Error('AI返回格式错误，请重试');
    }

    // 9. 返回成功结果
    return res.status(200).json({
      success: true,
      polished_text: parsedResult.polished_text,
      extracted_words: parsedResult.extracted_words
    });

  } catch (error) {
    // 10. 统一错误处理，返回清晰的中文提示（不再乱码）
    console.error('AI处理错误:', error);
    return res.status(500).json({
      success: false,
      message: `AI处理失败: ${error.message || '未知错误'}`
    });
  }
}
