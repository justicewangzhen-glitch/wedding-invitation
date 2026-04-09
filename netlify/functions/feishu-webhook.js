/**
 * Netlify Function: feishu-webhook
 * 宾客提交 → 发飞书群卡片 + 写多维表格
 */

const FEISHU_WEBHOOK = process.env.FEISHU_WEBHOOK || 'https://open.feishu.cn/open-apis/bot/v2/hook/37d33c4a-c2bf-44fc-894e-eaac6e54ee02';
const FEISHU_APP_TOKEN = process.env.FEISHU_APP_TOKEN || 'C6UMboaZYaa0Xpskzq1cuuMynpb';
const FEISHU_TABLE_ID = process.env.FEISHU_TABLE_ID || 'tblxEZ636ez634Gy';
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;

// 字段映射（原始值 → 显示值）
const ATTENDANCE_MAP = { yes: '✅ 欣然出席', no: '❌ 遗憾缺席' };
const GUEST_MAP = { '1': '1人', '2': '2人', '3': '3人', '4': '4人及以上' };
const MEAL_MAP = { any: '不限定', vegetarian: '素食', allergy: '食物过敏' };
const ARRIVAL_DATE_MAP = { 'two-days-before': '6月18日', eve: '6月19日', day: '6月20日' };
const ARRIVAL_TIME_MAP = { morning: '上午（10:00前）', noon: '中午（10:00–12:00）', afternoon: '下午（12:00–17:00）', evening: '傍晚（17:00后）' };
const DEPARTURE_DATE_MAP = { day: '6月20日', next: '6月21日', later: '6月22日或之后' };
const DEPARTURE_TIME_MAP = { morning: '上午（12:00前）', afternoon: '下午（12:00–18:00）', evening: '傍晚（18:00后）' };

// 获取飞书 tenant_access_token
async function getTenantAccessToken() {
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) return null;
  
  try {
    const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET })
    });
    const data = await res.json();
    return data.code === 0 ? data.tenant_access_token : null;
  } catch (err) {
    console.error('[Token]', err.message);
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // 前端表单字段名（从 index.html 确认）
  const {
    name = '未填写',
    phone = '未填写',
    attend,
    guests = '1',
    meal = 'any',
    arrivalDate,
    arrivalTime,
    departureDate,
    departureTime,
    flightNumber = '未填写',
    message = '未填写'
  } = body;

  // 转换显示值
  const attendanceLabel = ATTENDANCE_MAP[attend] || '未知';
  const guestsLabel = GUEST_MAP[guests] || guests;
  const mealLabel = MEAL_MAP[meal] || meal;
  const arrivalDateLabel = ARRIVAL_DATE_MAP[arrivalDate] || '未填写';
  const arrivalTimeLabel = ARRIVAL_TIME_MAP[arrivalTime] || '未填写';
  const departureDateLabel = DEPARTURE_DATE_MAP[departureDate] || '未填写';
  const departureTimeLabel = DEPARTURE_TIME_MAP[departureTime] || '未填写';

  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  // ========== 1. 飞书群卡片 ==========
  const cardPayload = {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: '💐 婚礼宾客回复' },
        subtitle: { tag: 'plain_text', content: `${name} 已填写回复` },
        template: 'pink'
      },
      elements: [
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'lark_md', content: `**👤 姓名**\n${name}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**📞 联系电话**\n${phone}` } }
          ]
        },
        { tag: 'hr' },
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'lark_md', content: `**🎉 是否出席**\n${attendanceLabel}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**👥 出席人数**\n${guestsLabel}` } }
          ]
        },
        { tag: 'hr' },
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'lark_md', content: `**✈️ 到达日期**\n${arrivalDateLabel}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**🕐 到达时间**\n${arrivalTimeLabel}` } }
          ]
        },
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'lark_md', content: `**🚗 离开日期**\n${departureDateLabel}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**🕑 离开时间**\n${departureTimeLabel}` } }
          ]
        },
        { tag: 'hr' },
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'lark_md', content: `**🍽️ 餐饮偏好**\n${mealLabel}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**🗺️ 航班/车次**\n${flightNumber}` } }
          ]
        },
        ...(message !== '未填写' ? [
          { tag: 'hr' },
          { tag: 'div', text: { tag: 'lark_md', content: `**💬 祝福语**\n${message}` } }
        ] : []),
        { tag: 'hr' },
        {
          tag: 'note',
          elements: [{ tag: 'plain_text', content: `📅 收到时间：${timestamp}` }]
        }
      ]
    }
  };

  // ========== 2. Bitable 记录（中文字段名） ==========
  const bitableFields = {
    '姓名': name,
    '电话': phone,
    '是否出席': attendanceLabel,
    '出席人数': guestsLabel,
    '餐饮偏好': mealLabel,
    '到达日期': arrivalDateLabel,
    '到达时间': arrivalTimeLabel,
    '离开日期': departureDateLabel,
    '离开时间': departureTimeLabel,
    '交通信息': flightNumber,
    '祝福语': message,
    '收到时间': timestamp
  };

  const results = { webhook: false, bitable: false };

  // 发飞书群卡片
  try {
    const res = await fetch(FEISHU_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardPayload)
    });
    if (res.ok) results.webhook = true;
    else console.error('[Webhook] HTTP', res.status);
  } catch (err) {
    console.error('[Webhook]', err.message);
  }

  // 写多维表格
  const token = await getTenantAccessToken();
  if (token) {
    try {
      const res = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: bitableFields })
      });
      const data = await res.json();
      if (data.code === 0) results.bitable = true;
      else console.error('[Bitable] API error:', data);
    } catch (err) {
      console.error('[Bitable]', err.message);
    }
  } else {
    console.log('[Bitable] No token, skipped');
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: results.webhook,
      webhook: results.webhook ? 'ok' : 'failed',
      bitable: results.bitable ? 'ok' : 'failed'
    })
  };
};
