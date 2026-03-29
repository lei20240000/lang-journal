// api/webhook-lemonsqueezy.js (Vercel Edge)
export const config = { runtime: 'edge' };

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 初始化Supabase服务端客户端（绕过RLS）
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req) {
  try {
    // 1. 验签（基础版，防恶意请求）
    const signature = req.headers.get('x-lemonsqueezy-signature');
    if (!signature) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 2. 解析支付回调
    const body = await req.json();
    const eventType = body.meta.event_type;
    const userId = body.data.attributes.custom_data?.user_id;

    if (!userId) {
      return new Response('No user_id', { status: 400 });
    }

    // 3. 只处理支付成功事件
    if (
      eventType === 'order.created' ||
      eventType === 'subscription.created'
    ) {
      // 判断套餐类型
      const variantName = body.data.attributes.variant_name;
      let membership = 'free';
      let expiry = null;

      if (variantName.includes('7天免费')) {
        membership = 'trial';
        expiry = new Date(Date.now() + 7 * 86400000).toISOString();
      } else if (variantName.includes('季度')) {
        membership = 'quarterly';
        expiry = new Date(Date.now() + 90 * 86400000).toISOString();
      } else if (variantName.includes('年度')) {
        membership = 'yearly';
        expiry = new Date(Date.now() + 365 * 86400000).toISOString();
      } else if (variantName.includes('永久')) {
        membership = 'lifetime';
        expiry = null;
      }

      // 4. 自动更新Supabase用户会员状态
      await supabase.from('users').upsert({
        id: userId,
        membership: membership,
        expiry_at: expiry,
        daily_used: 0,
        last_date: new Date().toISOString().split('T')[0]
      }, { onConflict: 'id' });
    }

    return new Response('OK', { status: 200 });

  } catch (err) {
    console.error(err);
    return new Response('Error', { status: 500 });
  }
}