// api/ai-process.js (Vercel Edge)
export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const body = await req.json();
    if (!body.inputText || !body.userId) {
      return Response.json({ success: false, message: '参数缺失' }, { status: 400 });
    }

    // 调用阿里通义千问
    const aiRes = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.ALI_DASHSCOPE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen-flash",
        messages: [{
          role: "user",
          content: `输入：${body.inputText}\n输出严格JSON，仅4项：{"lang":"","polished":"","keywords":[],"read_aloud":""}`
        }],
        max_tokens: 400,
        temperature: 0.2
      })
    });

    const aiData = await aiRes.json();
    let result;
    // 解决AI返回格式崩溃
    try {
      result = JSON.parse(aiData.choices[0].message.content);
    } catch (e) {
      result = {
        lang: "en",
        polished: body.inputText,
        keywords: [],
        read_aloud: body.inputText
      };
    }

    return Response.json({
      success: true,
      lang: result.lang || "en",
      polished: result.polished || body.inputText,
      keywords: (result.keywords || []).slice(0,3),
      read_aloud: result.read_aloud || result.polished
    });

  } catch (err) {
    return Response.json({ success: false, message: "AI处理失败" }, { status: 500 });
  }
}