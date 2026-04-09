/**
 * Netlify Function: feishu-webhook
 *
 * 接收前端表单数据，中转到飞书机器人 Webhook。
 * 服务端请求不受浏览器 CORS 限制，彻底解决跨域问题。
 */

const FEISHU_WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/37d33c4a-c2bf-44fc-894e-eaac6e54ee02';

// 字段映射（与服务端 index.html 保持一致）
const ATTENDANCE_MAP = { yes: '欣然出席', no: '遗憾缺席' };
const GUEST_MAP = { '1': '1人', '2': '2人', '3': '3人', '4': '4人及以上' };
const MEAL_MAP = { any: '不限定', vegetarian: '素食', allergy: '食物过敏' };
const ARRIVAL_DATE_MAP = { 'two-days-before': '6月18日', eve: '6月19日', day: '6月20日' };
const ARRIVAL_TIME_MAP = { morning: '上午（10:00前）', noon: '中午（10:00–12:00）', afternoon: '下午（12:00–17:00）', evening: '傍晚（17:00后）' };
const DEPARTURE_DATE_MAP = { day: '6月20日', next: '6月21日', later: '6月22日或之后' };
const DEPARTURE_TIME_MAP = { morning: '上午（12:00前）', afternoon: '下午（12:00–18:00）', evening: '傍晚（18:00后）' };

exports.handler = async function (event, context) {
  // 仅允许 POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const {
    name = '未填写',
    phone = '未填写',
    attendance,
    guests = '未知',
    meal = '未知',
    arrivalDate,
    arrivalTime,
    departureDate,
    departureTime,
    flightNumber = '未填写',
    message: blessing = '未填写'
  } = body;

  const attendanceLabel = ATTENDANCE_MAP[attendance] || '未知';
  const guestsLabel = GUEST_MAP[guests] || '未知';
  const mealLabel = MEAL_MAP[meal] || '未知';
  const arrivalDateLabel = ARRIVAL_DATE_MAP[arrivalDate] || '未填写';
  const arrivalTimeLabel = ARRIVAL_TIME_MAP[arrivalTime] || '未填写';
  const departureDateLabel = DEPARTURE_DATE_MAP[departureDate] || '未填写';
  const departureTimeLabel = DEPARTURE_TIME_MAP[departureTime] || '未填写';

  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  // 构建飞书卡片消息
  const cardElements = [
    { tag: 'hr' },
    {
      tag: 'section',
      fields: [
        { is_short: true, text: { tag: 'plain_text', content: `**姓名**\n${name}` } },
        { is_short: true, text: { tag: 'plain_text', content: `**联系电话**\n${phone}` } }
      ]
    },
    {
      tag: 'section',
      fields: [
        { is_short: true, text: { tag: 'plain_text', content: `**是否出席**\n${attendanceLabel}` } },
        { is_short: true, text: { tag: 'plain_text', content: `**出席人数**\n${guestsLabel}` } }
      ]
    },
    { tag: 'hr' },
    {
      tag: 'section',
      fields: [
        { is_short: true, text: { tag: 'plain_text', content: `**到达日期**\n${arrivalDateLabel}` } },
        { is_short: true, text: { tag: 'plain_text', content: `**到达时间**\n${arrivalTimeLabel}` } },
        { is_short: true, text: { tag: 'plain_text', content: `**离开日期**\n${departureDateLabel}` } },
        { is_short: true, text: { tag: 'plain_text', content: `**离开时间**\n${departureTimeLabel}` } }
      ]
    },
    { tag: 'hr' },
    {
      tag: 'section',
      fields: [
        { is_short: true, text: { tag: 'plain_text', content: `**餐饮偏好**\n${mealLabel}` } },
        { is_short: true, text: { tag: 'plain_text', content: `**航班/车次**\n${flightNumber}` } }
      ]
    }
  ];

  // 只有填写了祝福语才加入
  if (blessing !== '未填写') {
    cardElements.push(
      { tag: 'hr' },
      {
        tag: 'section',
        text: { tag: 'plain_text', content: `**祝福语**\n${blessing}` }
      }
    );
  }

  cardElements.push({
    tag: 'note',
    elements: [{ tag: 'plain_text', content: `📅 收到时间：${timestamp}` }]
  });

  const payload = {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: '💐 婚礼宾客回复' },
        subtitle: { tag: 'plain_text', content: `${name} 已填写回复` },
        template: 'pink'
      },
      elements: cardElements
    }
  };

  // 转发到飞书 Webhook（服务端请求不受 CORS 限制）
  try {
    const feishuResponse = await fetch(FEISHU_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!feishuResponse.ok) {
      const errText = await feishuResponse.text();
      console.error('Feishu API error:', errText);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Failed to forward to Feishu', detail: errText })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('Network error forwarding to Feishu:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
