const SHEET_NAMES = {
  EVENTS: 'events',
  FEEDBACK: 'feedback'
};

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = String(p.action || '').trim();
    if (action === 'event') {
      appendEvent_(p);
      return text_('ok');
    }
    if (action === 'feedback') {
      appendFeedback_(p);
      return text_('ok');
    }
    return text_('unknown action');
  } catch (err) {
    console.error(err);
    return text_('error');
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || '').trim();
  const callback = safeCallback_(p.callback || 'callback');

  if (action === 'stats') {
    const key = String(p.key || '');
    if (!isAdminKeyValid_(key)) {
      return javascript_(`${callback}(${JSON.stringify({ ok: false, error: 'unauthorized' })});`);
    }
    const days = Math.min(Math.max(Number(p.days || 30), 1), 365);
    const result = getStats_(days);
    return javascript_(`${callback}(${JSON.stringify({ ok: true, ...result })});`);
  }

  if (action === 'feedback') {
    const key = String(p.key || '');
    if (!isAdminKeyValid_(key)) {
      return javascript_(`${callback}(${JSON.stringify({ ok: false, error: 'unauthorized' })});`);
    }
    const limit = Math.min(Math.max(Number(p.limit || 100), 1), 500);
    const result = getFeedback_(limit);
    return javascript_(`${callback}(${JSON.stringify({ ok: true, items: result })});`);
  }

  return javascript_(`${callback}(${JSON.stringify({ ok: true, service: 'cleansys-manual-analytics' })});`);
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_NAMES.EVENTS, [
    'timestamp','event_type','visitor_id','session_id','category_id','category','section_id','section','path','feedback_type'
  ]);
  ensureSheet_(ss, SHEET_NAMES.FEEDBACK, [
    'timestamp','visitor_id','session_id','category_id','category','section_id','section','feedback_type','message','path','status'
  ]);
}

function setAdminKey() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('관리자 비밀번호 설정', '통계 화면에서 사용할 비밀번호를 입력하세요.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const value = r.getResponseText().trim();
  if (value.length < 8) {
    ui.alert('8자 이상으로 설정해 주세요.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('ADMIN_KEY', value);
  ui.alert('관리자 비밀번호가 저장되었습니다.');
}

function appendEvent_(p) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureSheet_(ss, SHEET_NAMES.EVENTS, [
    'timestamp','event_type','visitor_id','session_id','category_id','category','section_id','section','path','feedback_type'
  ]);
  sh.appendRow([
    new Date(), clean_(p.event_type, 50), clean_(p.visitor_id, 120), clean_(p.session_id, 120),
    clean_(p.category_id, 50), clean_(p.category, 100), clean_(p.section_id, 50), clean_(p.section, 100),
    clean_(p.path, 300), clean_(p.feedback_type, 100)
  ]);
}

function appendFeedback_(p) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureSheet_(ss, SHEET_NAMES.FEEDBACK, [
    'timestamp','visitor_id','session_id','category_id','category','section_id','section','feedback_type','message','path','status'
  ]);
  sh.appendRow([
    new Date(), clean_(p.visitor_id, 120), clean_(p.session_id, 120), clean_(p.category_id, 50),
    clean_(p.category, 100), clean_(p.section_id, 50), clean_(p.section, 100), clean_(p.feedback_type, 100),
    clean_(p.message, 1500), clean_(p.path, 300), '신규'
  ]);
}

function getStats_(days) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAMES.EVENTS);
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  if (!sh || sh.getLastRow() < 2) {
    return emptyStats_(days, from, now);
  }

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const rows = values.filter(r => r[0] instanceof Date && r[0] >= from);

  const visitors = new Set();
  const sessions = new Set();
  let pageViews = 0;
  let menuViews = 0;
  const menuMap = {};
  const categoryMap = {};
  const dailyMap = {};

  rows.forEach(r => {
    const ts = r[0];
    const eventType = String(r[1] || '');
    const visitorId = String(r[2] || '');
    const sessionId = String(r[3] || '');
    const category = String(r[5] || '');
    const section = String(r[7] || '');

    if (visitorId) visitors.add(visitorId);
    if (sessionId) sessions.add(sessionId);
    if (eventType === 'page_view') pageViews++;
    if (eventType === 'menu_view') {
      menuViews++;
      const menu = `${category || '-'} · ${section || '-'}`;
      menuMap[menu] = (menuMap[menu] || 0) + 1;
      if (category) categoryMap[category] = (categoryMap[category] || 0) + 1;
    }

    const d = Utilities.formatDate(ts, Session.getScriptTimeZone() || 'Asia/Seoul', 'yyyy-MM-dd');
    if (!dailyMap[d]) dailyMap[d] = { date: d, visitors: new Set(), sessions: new Set(), page_views: 0 };
    if (visitorId) dailyMap[d].visitors.add(visitorId);
    if (sessionId) dailyMap[d].sessions.add(sessionId);
    if (eventType === 'page_view') dailyMap[d].page_views++;
  });

  const topMenus = Object.entries(menuMap)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, views]) => ({ name, views }));

  const categories = Object.entries(categoryMap)
    .sort((a,b) => b[1] - a[1])
    .map(([name, views]) => ({ name, views }));

  const daily = Object.values(dailyMap)
    .sort((a,b) => a.date.localeCompare(b.date))
    .map(x => ({ date: x.date, visitors: x.visitors.size, sessions: x.sessions.size, page_views: x.page_views }));

  return {
    days,
    from: Utilities.formatDate(from, Session.getScriptTimeZone() || 'Asia/Seoul', 'yyyy-MM-dd'),
    to: Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Seoul', 'yyyy-MM-dd'),
    unique_visitors: visitors.size,
    sessions: sessions.size,
    page_views: pageViews,
    menu_views: menuViews,
    top_menus: topMenus,
    categories,
    daily
  };
}

function getFeedback_(limit) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAMES.FEEDBACK);
  if (!sh || sh.getLastRow() < 2) return [];

  const lastRow = sh.getLastRow();
  const start = Math.max(2, lastRow - limit + 1);
  const values = sh.getRange(start, 1, lastRow - start + 1, sh.getLastColumn()).getValues().reverse();
  const tz = Session.getScriptTimeZone() || 'Asia/Seoul';

  return values.map(r => ({
    timestamp: r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd HH:mm:ss') : String(r[0] || ''),
    category: String(r[4] || ''),
    section: String(r[6] || ''),
    type: String(r[7] || ''),
    message: String(r[8] || ''),
    status: String(r[10] || '')
  }));
}

function emptyStats_(days, from, now) {
  const tz = Session.getScriptTimeZone() || 'Asia/Seoul';
  return {
    days,
    from: Utilities.formatDate(from, tz, 'yyyy-MM-dd'),
    to: Utilities.formatDate(now, tz, 'yyyy-MM-dd'),
    unique_visitors: 0,
    sessions: 0,
    page_views: 0,
    menu_views: 0,
    top_menus: [],
    categories: [],
    daily: []
  };
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function isAdminKeyValid_(key) {
  const saved = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || '';
  return saved && key && saved === key;
}

function clean_(value, maxLen) {
  const text = String(value == null ? '' : value).replace(/^[-+=@]/, "'");
  return text.slice(0, maxLen);
}

function safeCallback_(name) {
  const s = String(name || 'callback');
  return /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(s) ? s : 'callback';
}

function text_(value) {
  return ContentService.createTextOutput(value).setMimeType(ContentService.MimeType.TEXT);
}

function javascript_(value) {
  return ContentService.createTextOutput(value).setMimeType(ContentService.MimeType.JAVASCRIPT);
}
