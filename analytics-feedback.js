(() => {
  'use strict';

  const CONFIG_URL = './analytics-config.json';
  const CATEGORY_LABELS = { dust: '먼지', hcl: 'HCl', gas: '가스', flow: '유량' };
  const SECTION_LABELS = {
    equipment: '장치 및 준비물',
    procedure: '업무 절차',
    input: '기기 입력 매뉴얼',
    density: '배출가스 밀도 측정',
    rep_point: '유속 대표점 산정 방법'
  };

  let endpoint = '';
  let feedbackMounted = false;
  let lastViewKey = '';

  function uid(prefix) {
    if (crypto && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  function getVisitorId() {
    const key = 'cleansys_manual_visitor_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = uid('v');
      localStorage.setItem(key, id);
    }
    return id;
  }

  function getSessionId() {
    const key = 'cleansys_manual_session_id';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = uid('s');
      sessionStorage.setItem(key, id);
    }
    return id;
  }

  async function loadConfig() {
    try {
      const res = await fetch(`${CONFIG_URL}?v=${Date.now()}`, { cache: 'no-store' });
      const cfg = await res.json();
      endpoint = (cfg.endpoint || '').trim();
    } catch (e) {
      console.warn('[총량매뉴얼] 통계 설정을 불러오지 못했습니다.', e);
    }
  }

  function post(payload) {
    if (!endpoint) return;
    const body = new URLSearchParams();
    Object.entries(payload).forEach(([k, v]) => body.append(k, v == null ? '' : String(v)));

    fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString(),
      keepalive: true
    }).catch(() => {});
  }

  function currentMenu() {
    const activeCat = document.querySelector('.cat-btn.active');
    const activeSec = document.querySelector('.sec-btn.active');
    const cat = activeCat?.dataset.cat || window.currentCat || '';
    const sec = activeSec?.dataset.sec || window.currentSec || '';
    return {
      cat,
      sec,
      category: CATEGORY_LABELS[cat] || cat,
      section: SECTION_LABELS[sec] || activeSec?.textContent?.trim() || sec
    };
  }

  function track(eventType, extra = {}) {
    const menu = currentMenu();
    post({
      action: 'event',
      event_type: eventType,
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
      category_id: menu.cat,
      category: menu.category,
      section_id: menu.sec,
      section: menu.section,
      path: location.pathname,
      ...extra
    });
  }

  function trackCurrentMenu(force = false) {
    const m = currentMenu();
    const key = `${m.cat}|${m.sec}`;
    if (!m.cat || !m.sec) return;
    if (!force && key === lastViewKey) return;
    lastViewKey = key;
    track('menu_view');
  }

  function injectStyles() {
    if (document.getElementById('feedback-feature-style')) return;
    const style = document.createElement('style');
    style.id = 'feedback-feature-style';
    style.textContent = `
      .manual-feedback-box{margin-top:24px;padding-top:20px;border-top:1px solid #E5E8EB}
      .manual-feedback-btn{width:100%;border:1px solid #D7E6FC;background:#F5F9FF;color:#3182F6;border-radius:14px;padding:13px 14px;font:700 .9rem 'Pretendard',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px}
      .manual-feedback-btn:active{transform:scale(.99)}
      .manual-feedback-hint{margin-top:8px;text-align:center;color:#8B95A1;font-size:.75rem;line-height:1.45}
      .feedback-modal-backdrop{position:fixed;inset:0;background:rgba(25,31,40,.45);display:flex;align-items:flex-end;justify-content:center;z-index:10000;padding:0}
      .feedback-modal{width:100%;max-width:480px;background:#fff;border-radius:24px 24px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -12px 40px rgba(0,0,0,.14)}
      .feedback-modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
      .feedback-modal-title{font-size:1.05rem;font-weight:800;color:#191F28}
      .feedback-close{border:0;background:#F2F4F6;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:20px;color:#4E5968}
      .feedback-menu-label{font-size:.82rem;color:#6B7684;margin-bottom:16px}
      .feedback-label{display:block;font-size:.82rem;font-weight:700;color:#333D4B;margin:13px 0 7px}
      .feedback-select,.feedback-textarea{width:100%;border:1px solid #D9DDE3;border-radius:12px;background:#fff;padding:12px;font:500 .9rem 'Pretendard',sans-serif;color:#191F28;outline:none}
      .feedback-textarea{min-height:120px;resize:vertical;line-height:1.5}
      .feedback-select:focus,.feedback-textarea:focus{border-color:#3182F6;box-shadow:0 0 0 3px rgba(49,130,246,.10)}
      .feedback-submit{width:100%;border:0;border-radius:14px;background:#3182F6;color:#fff;padding:14px;font:800 .95rem 'Pretendard',sans-serif;margin-top:16px;cursor:pointer}
      .feedback-submit:disabled{opacity:.55;cursor:default}
      .feedback-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#191F28;color:#fff;padding:11px 16px;border-radius:12px;font-size:.85rem;font-weight:700;z-index:11000;box-shadow:0 8px 28px rgba(0,0,0,.18)}
    `;
    document.head.appendChild(style);
  }

  function toast(message) {
    document.querySelector('.feedback-toast')?.remove();
    const el = document.createElement('div');
    el.className = 'feedback-toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }

  function openFeedbackModal() {
    if (!endpoint) { toast('요청사항 기능 준비 중입니다.'); return; }
    const menu = currentMenu();
    const backdrop = document.createElement('div');
    backdrop.className = 'feedback-modal-backdrop';
    backdrop.innerHTML = `
      <div class="feedback-modal" role="dialog" aria-modal="true" aria-label="요청사항 보내기">
        <div class="feedback-modal-head">
          <div class="feedback-modal-title">요청사항 보내기</div>
          <button class="feedback-close" type="button" aria-label="닫기">×</button>
        </div>
        <div class="feedback-menu-label">${menu.category} · ${menu.section}</div>
        <label class="feedback-label" for="feedback-type">요청 유형</label>
        <select id="feedback-type" class="feedback-select">
          <option value="내용 오류">내용이 틀렸어요</option>
          <option value="내용 추가">내용을 추가해 주세요</option>
          <option value="표현 개선">설명이 이해하기 어려워요</option>
          <option value="기능 개선">기능을 개선해 주세요</option>
          <option value="기타">기타</option>
        </select>
        <label class="feedback-label" for="feedback-text">내용</label>
        <textarea id="feedback-text" class="feedback-textarea" maxlength="1500" placeholder="틀린 내용, 추가했으면 하는 내용, 개선 의견을 적어주세요."></textarea>
        <button class="feedback-submit" type="button">보내기</button>
      </div>`;

    const close = () => backdrop.remove();
    backdrop.querySelector('.feedback-close').addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    backdrop.querySelector('.feedback-submit').addEventListener('click', () => {
      const type = backdrop.querySelector('#feedback-type').value;
      const text = backdrop.querySelector('#feedback-text').value.trim();
      if (text.length < 3) {
        toast('요청 내용을 3자 이상 입력해 주세요.');
        return;
      }
      post({
        action: 'feedback',
        visitor_id: getVisitorId(),
        session_id: getSessionId(),
        category_id: menu.cat,
        category: menu.category,
        section_id: menu.sec,
        section: menu.section,
        feedback_type: type,
        message: text,
        path: location.pathname
      });
      track('feedback_submit', { feedback_type: type });
      close();
      toast('의견이 접수되었습니다. 감사합니다.');
    });

    document.body.appendChild(backdrop);
    setTimeout(() => backdrop.querySelector('#feedback-text')?.focus(), 100);
  }

  function mountFeedback() {
    const cardContent = document.getElementById('card-content');
    if (!cardContent) return;
    document.querySelector('.manual-feedback-box')?.remove();

    const box = document.createElement('div');
    box.className = 'manual-feedback-box';
    box.innerHTML = `
      <button class="manual-feedback-btn" type="button">
        <span class="material-icons" style="font-size:19px">rate_review</span>
        내용 수정·추가 요청
      </button>
      <div class="manual-feedback-hint">틀린 내용이나 추가가 필요한 내용을 알려주세요.</div>`;
    box.querySelector('button').addEventListener('click', openFeedbackModal);
    cardContent.appendChild(box);
    feedbackMounted = true;
  }

  function observeContentChanges() {
    const target = document.getElementById('main-card');
    if (!target) return;
    const observer = new MutationObserver(() => {
      clearTimeout(window.__cleansysFeatureTimer);
      window.__cleansysFeatureTimer = setTimeout(() => {
        mountFeedback();
        trackCurrentMenu();
      }, 30);
    });
    observer.observe(target, { childList: true, subtree: true });
  }

  async function init() {
    injectStyles();
    await loadConfig();
    track('page_view');
    mountFeedback();
    trackCurrentMenu(true);
    observeContentChanges();

    document.getElementById('category-nav')?.addEventListener('click', () => setTimeout(trackCurrentMenu, 80), true);
    document.getElementById('section-nav')?.addEventListener('click', () => setTimeout(trackCurrentMenu, 80), true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
