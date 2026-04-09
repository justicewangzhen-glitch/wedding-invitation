/**
 * Netlify Function: feishu-webhook
 * 宾客提交 → 发飞书群卡片 + 写多维表格
 */

const FEISHU_WEBHOOK = process.env.FEISHU_WEBHOOK || 'https://open.feishu.cn/open-apis/bot/v2/hook/37d33c4a-c2bf-44fc-894e-eaac6e54ee02';
const FEISHU_APP_TOKEN = process.env.FEISHU_APP_TOKEN || 'C6UMboaZYaa0Xpskzq1cuuMynpb';
const FEISHU_TABLE_ID = process.env.FEISHU_TABLE_ID || 'tblxEZ636ez634Gy';
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;

const ATTENDANCE_MAP = { yes: '✅ 欣然出席', no: '❌ 遗憾缺席' };

async function getTenantAccessToken() {
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) return null;
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET })
  });
  const data = await res.json();
  return data.code === 0 ? data.tenant_access_token : null;
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

  const {
    name = '未填写',
    phone = '未填写',
    attendance,
    guests = 1,
    dietary = '不限定',
    arrivalDate,
    arrivalTime = '未填写',
    departureDate,
    departureTime = '未填写',
    transport = '未填写',
    wishes = '未填写'
  } = body;

  const timestamp = Date.now();
  const attendanceLabel = ATTENDANCE_MAP[attendance] || '未知';

  // 构建飞书群卡片
  const cardPayload = {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: '💐 婚礼宾客回复' },
        template: 'pink'
      },
      elements: [
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'plain_text', content: `**宾客姓名**\n${name}` } },
            { is_short: true, text: { tag: 'plain_text', content: `**联系电话**\n${phone}` } }
          ]
        },
        { tag: 'hr' },
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'plain_text', content: `**是否出席**\n${attendanceLabel}` } },
            { is_short: true, text: { tag: 'plain_text', content: `**出席人数**\n${guests}人` } }
          ]
        },
        { tag: 'hr' },
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'plain_text', content: `**餐饮偏好**\n${dietary}` } },
            { is_short: true, text: { tag: 'plain_text', content: `**交通信息**\n${transport}` } }
          ]
        },
        { tag: 'hr' },
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'plain_text', content: `**到达日期**\n${arrivalDate || '未填写'}` } },
            { is_short: true, text: { tag: 'plain_text', content: `**到达时间**\n${arrivalTime}` } }
          ]
        },
        { tag: 'hr' },
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'plain_text', content: `**离开日期**\n${departureDate || '未填写'}` } },
            { is_short: true, text: { tag: 'plain_text', content: `**离开时间**\n${departureTime}` } }
          ]
        },
        { tag: 'hr' },
        {
          tag: 'div',
          text: { tag: 'plain_text', content: `**祝福语**\n${wishes}` }
        },
        {
          tag: 'note',
          elements: [{ tag: 'plain_text', content: `收到时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}` }]
        }
      ]
    }
  };

  // 构建 Bitable 记录（字段名用中文字段名，日期用毫秒时间戳）
  const bitableFields = {
    '姓名': name,
    '电话': phone,
    '是否出席': attendanceLabel,
    '出席人数': Number(guests),
    '餐饮偏好': dietary,
    '到达时间': arrivalTime,
    '离开时间': departureTime,
    '交通信息': transport,
    '祝福语': wishes,
    '收到时间': timestamp
  };
  if (arrivalDate) bitableFields['到达日期'] = timestamp;
  if (departureDate) bitableFields['离开日期'] = timestamp;

  const results = { webhook: false, bitable: false };

  // 发飞书群卡片
  try {
    await fetch(FEISHU_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardPayload)
    });
    results.webhook = true;
  } catch (err) {
    console.error('[Webhook]', err.message);
  }

  // 写多维表格
  const token = await getTenantAccessToken();
  if (token) {
    try {
      await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: bitableFields })
      });
      results.bitable = true;
    } catch (err) {
      console.error('[Bitable]', err.message);
    }
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
