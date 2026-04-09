/**
 * Netlify Function: feishu-webhook
 *
 * 接收前端表单数据，发送飞书群卡片 + 写入 Google Sheets。
 */

// 优先使用环境变量（更安全），否则回退到硬编码值
const FEISHU_WEBHOOK = process.env.FEISHU_WEBHOOK
  || 'https://open.feishu.cn/open-apis/bot/v2/hook/37d33c4a-c2bf-44fc-894e-eaac6e54ee02';

// Google Sheets 配置
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID || '1--jfHdB8kqRDXhnX7aG5X4gu1_pilBdK7mJb5mjEZsk';
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'rsvp-writer@angular-yeti-274922.iam.gserviceaccount.com';
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDcb01+mYW2B7zQ
neyO7i1aRKr4uHkHcl4BMNpV6dS4wUqfGMq8qmgTAM6xd3+prU01G8nBN4w+1Q3v
rrefm9bYX9otXCmily69VeMysqdT3gxgJgYus7rmGd/wN/z3zx/yPWTNgo8OsNVN
WR0A74fGRW94y3ytyCmjxuv1oCkjyKb6v85pvX7+p+v4OFeI30P4aMdoF7ZM9r+l
pKq4Hb+TLtyz1tGxw8E/46v7j7JSOyzJl575aZHb2ee/JvkFEO4xlCytaZFRdssb
QKr+1s6z8By/0Ap3YHg7b1/6ka7HVzQu/z7Eaglh6hyawrmF1UmVxXR4aZqL+r96
fxR/YgqhAgMBAAECggEAAJG8BD/uv7fY5bwGrJ7SWKmVPHOzglCqC/w9kBu8vCZp
pCwK9/5DqwrlPcGWf5BuQt0Zwgk78DyaHtyXZk7feOsUc+oJRH159iy2275o3rdT
1lq6yNuXd7ko4iSu30/2X+iHLl2wM2RDBMJeaA52Tg2HWmtCHOvHqb/dg6KggJJm
mw9TYPX2mlOMn3ifqd2o0Mr2YdCBIKZog6F+9CJc0loLN4ea2KLrUpUbIrNAu087
1ND1HBAYaP8rCj3+i5RjT6x3Ei3lEkQaYX+yTyWeeWkqBebGuzGb0hKm3DbY2LaP
39JvVYjXSTQzUW2UTFp0Vm+M6YAYhxFg2aD2tyR03QKBgQD/bdbcU3NTLFAA9cG7
/szdlSHftG2J04gXeOlL+Bdr+paytmzrslQBgsi+sgSVs+kR3+Spl7pvFl5y4upt
3/dWGYdMVeeUUvAhOWuMdYE2IAlrERbmFxhgwRu1F0KBrbDAFU8f3iaLCbDTBkVd
q1AmE37l7fhJPMOAiEnC9+vKjQKBgQDc7XBphhRhFEmgG2zzSIshQrbyoI0lDl1k
bcGrsY4lI5Mk9n+j1jIso+C971ZGf12dS5QQMtzucu36GdI63hxn+iMxzSkf6vom
5FzIjrylAt1XNUQYsvVB7tXZOTYgh9Oyqy6PoY5CJxYWVkCDqPrURA1PUJNOywJu
M+hp8pflZQKBgQDDMIuNaJPrTiSA50w5vheNiGYPThCazzPjQ/l7nUVAtYitXqxT
XL3HPcrrtpu8TnRfvWk+k/za4Qwh3PdqKUkX2YBDvC2wccSgjwF5n12zH74yvCd0
gteVMFxdAT5IXJOB5YbGgnuPqkMer18Ymk4wGpvRVw1x4eY/9WXwgIYGDQKBgQCJ
FwFpSZz9vJQPONV7hWloIzjZB81t0CMdvYmvG8eDvjaBekAsDy8lSi+cTJaxujkB
8TMYdidoA4MubbVpeAgScUJDlfZN6wZ8+bmlbgUbM9LbWZ8+4FWWKzkhyQGQYBh6
RwTmda6L2Cs5gx4XVNUIwI2tyOcPvqNsdONkUvf0jQKBgQD0to/ejMDL3FBKoo8Z
fWtVj4aAKIMoPuuvpWOpATLg8l1I2BZD/0iTRgWjNLJtxg81QgsOMlCbDhFL02fP
kuWrZVQFfNmnLcymn3OT2UEw2EqbArF6SozO+A1msOKRuhQVNkN2+CVahpPwzQJI
UOnlOiTaqYe68RKzoL51LRzF/A==
-----END PRIVATE KEY-----`;

// 字段映射（与服务端 index.html 保持一致）
const ATTENDANCE_MAP = { yes: '✅ 欣然出席', no: '❌ 遗憾缺席' };
const GUEST_MAP = { '1': '1人', '2': '2人', '3': '3人', '4': '4人及以上' };
const MEAL_MAP = { any: '不限定', vegetarian: '素食', allergy: '食物过敏' };
const ARRIVAL_DATE_MAP = { 'two-days-before': '6月18日', eve: '6月19日', day: '6月20日' };
const ARRIVAL_TIME_MAP = { morning: '上午（10:00前）', noon: '中午（10:00–12:00）', afternoon: '下午（12:00–17:00）', evening: '傍晚（17:00后）' };
const DEPARTURE_DATE_MAP = { day: '6月20日', next: '6月21日', later: '6月22日或之后' };
const DEPARTURE_TIME_MAP = { morning: '上午（12:00前）', afternoon: '下午（12:00–18:00）', evening: '傍晚（18:00后）' };

// Google OAuth2 JWT 生成
function createJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const base64Encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const jwtHeader = base64Encode(header);
  const jwtPayload = base64Encode(payload);
  const signingInput = `${jwtHeader}.${jwtPayload}`;

  // 使用 Node.js crypto 签名
  const crypto = require('crypto');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(GOOGLE_PRIVATE_KEY, 'base64url');

  return `${signingInput}.${signature}`;
}

// 获取 Google API 访问令牌
async function getGoogleAccessToken() {
  const jwt = createJWT();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
async function appendToGoogleSheet(rowData, accessToken) {
  const sheetName = process.env.GOOGLE_SHEET_NAME || '工作表1';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/${encodeURIComponent(sheetName)}!A1:append?valueInputOption=USER_ENTERED`;
      assertion: jwt
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Token error: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// 写入 Google Sheets
async function appendToGoogleSheet(rowData, accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [rowData]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Sheets error: ${JSON.stringify(data)}`);
  }
  return data;
}

exports.handler = async function (event, context) {
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
    attend: attendance,
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

  // 准备 Google Sheets 数据行
  const sheetRow = [
    timestamp,
    name,
    phone,
    attendanceLabel,
    guestsLabel,
    mealLabel,
    arrivalDateLabel,
    arrivalTimeLabel,
    departureDateLabel,
    departureTimeLabel,
    flightNumber,
    blessing
  ];

  // 构建飞书卡片（使用 div 替代 section，减少消息体积）
  const cardElements = [
    // 第一组：宾客信息
    {
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**👤 姓名**\n${name}` }
        },
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**📞 联系电话**\n${phone}` }
        }
      ]
    },
    { tag: 'hr' },
    // 第二组：出席信息
    {
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**🎉 是否出席**\n${attendanceLabel}` }
        },
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**👥 出席人数**\n${guestsLabel}` }
        }
      ]
    },
    { tag: 'hr' },
    // 第三组：到达信息
    {
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**✈️ 到达日期**\n${arrivalDateLabel}` }
        },
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**🕐 到达时间**\n${arrivalTimeLabel}` }
        }
      ]
    },
    // 第四组：离开信息
    {
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**🚗 离开日期**\n${departureDateLabel}` }
        },
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**🕑 离开时间**\n${departureTimeLabel}` }
        }
      ]
    },
    { tag: 'hr' },
    // 第五组：餐饮和航班
    {
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**🍽️ 餐饮偏好**\n${mealLabel}` }
        },
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**🗺️ 航班/车次**\n${flightNumber}` }
        }
      ]
    }
  ];

  // 祝福语单独成块
  if (blessing !== '未填写') {
    cardElements.push(
      { tag: 'hr' },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**💬 祝福语**\n${blessing}`
        }
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

  // 并行执行：发送飞书卡片 + 写入 Google Sheets
  const results = await Promise.allSettled([
    // 飞书 webhook
    fetch(FEISHU_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(async (res) => {
      const text = await res.text();
      if (!res.ok) throw new Error(`Feishu error: ${text}`);
      return { feishu: 'success' };
    }),

    // Google Sheets 写入
    (async () => {
      try {
        const accessToken = await getGoogleAccessToken();
        await appendToGoogleSheet(sheetRow, accessToken);
        return { googleSheets: 'success' };
      } catch (err) {
        console.error('Google Sheets error:', err);
        return { googleSheets: 'failed', error: err.message };
      }
    })()
  ]);

  // 记录结果
  const feishuResult = results[0];
  const sheetsResult = results[1];

  console.log('Feishu result:', feishuResult.status, feishuResult.value || feishuResult.reason);
  console.log('Google Sheets result:', sheetsResult.status, sheetsResult.value || sheetsResult.reason);

  // 只要飞书成功就返回 200
  if (feishuResult.status === 'fulfilled') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        feishu: 'success',
        googleSheets: sheetsResult.status === 'fulfilled' ? 'success' : 'failed'
      })
    };
  }

  return {
    statusCode: 502,
    body: JSON.stringify({ error: 'Feishu API error', detail: String(feishuResult.reason) })
  };
};
