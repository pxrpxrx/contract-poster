// КонтрактСВО — плакатно-героический. Интерактив.

// ===== Интеграция с CRM ===========================================
// Поддерживаемые режимы (CRM.mode):
//   'json'     — JSON на вебхук (Make / n8n / Zapier / собственный API)
//   'bitrix'   — прямая запись лида в Bitrix24 (crm.lead.add)
//   'telegram' — сообщение в Telegram через ваш бэкенд-прокси
// Если endpoint не задан — форма работает в демо-режиме (локальный успех).
const CRM = {
  mode: 'bitrix',
  // Прямая запись лида в Bitrix24 через вебхук (crm.lead.add)
  endpoint: 'https://b24-fbicjs.bitrix24.ru/rest/1/71l4iqta2fi6xkzp/crm.lead.add.json',
  source: 'contract-svo-site', // идентификатор источника заявки
  title: 'Заявка с сайта КонтрактСВО',
  // Кастомное поле для специальности. Создайте в Б24
  // (Настройки → CRM → Лид → Пользовательские поля) и впишите код,
  // напр. 'UF_CRM_123456'. Пока пусто — специальность дублируется в COMMENTS.
  bitrix: { ufSpecialty: '' },
  // Telegram: нужен прокси (токен нельзя хранить в браузере)
  telegram: { proxy: '', chatId: '' }
};

const SPEC_LABELS = {
  uav: 'Оператор БПЛА', reb: 'Специалист РЭБ', it: 'IT-Связист',
  assault: 'Стрелок-штурмовик', sniper: 'Снайпер', artillery: 'Артиллерист',
  mechanic: 'Механик-водитель', doctor: 'Врач-Фельдшер', driver: 'Водитель', cook: 'Повар'
};

function getUtm() {
  const p = new URLSearchParams(location.search);
  const out = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']
    .forEach(k => { if (p.has(k)) out[k] = p.get(k); });
  return out;
}

function normalizePhone(v) {
  let d = (v || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  if (d.length === 10) d = '7' + d;
  if (d && d[0] !== '7') d = '7' + d;
  return d ? '+' + d : '';
}

function splitName(full) {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

function buildLead(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  return {
    name: (data.name || '').trim(),
    phone: (data.phone || '').trim(),
    email: (data.email || '').trim(),
    city: (data.city || '').trim(),
    specialty: data.specialty || '',
    specialtyLabel: SPEC_LABELS[data.specialty] || data.specialty || '—',
    consent: data.consent === 'on' || data.consent === true,
    source: CRM.source,
    page: location.href,
    sentAt: new Date().toISOString(),
    utm: getUtm()
  };
}

function toBitrix(lead) {
  const { first, last } = splitName(lead.name);
  const phone = normalizePhone(lead.phone);
  const utm = lead.utm || {};
  const comments = [
    'Специальность: ' + lead.specialtyLabel,
    'Город: ' + lead.city,
    'Источник: ' + lead.source,
    'Страница: ' + lead.page,
    'UTM: ' + Object.keys(utm).map(k => k + '=' + utm[k]).join(', ')
  ].join('\n');

  const fields = {
    TITLE: CRM.title + ': ' + (lead.name || '—') + ', ' + lead.specialtyLabel,
    NAME: first,
    LAST_NAME: last,
    PHONE: phone ? [{ VALUE: phone, VALUE_TYPE: 'WORK' }] : [],
    COMMENTS: comments
  };

  if (lead.email) fields.EMAIL = [{ VALUE: lead.email, VALUE_TYPE: 'WORK' }];
  if (lead.city) fields.ADDRESS_CITY = lead.city;
  if (CRM.bitrix.ufSpecialty) fields[CRM.bitrix.ufSpecialty] = lead.specialtyLabel;
  if (utm.utm_source)   fields.UTM_SOURCE   = utm.utm_source;
  if (utm.utm_medium)   fields.UTM_MEDIUM   = utm.utm_medium;
  if (utm.utm_campaign) fields.UTM_CAMPAIGN = utm.utm_campaign;
  if (utm.utm_term)     fields.UTM_TERM     = utm.utm_term;
  if (utm.utm_content)  fields.UTM_CONTENT  = utm.utm_content;

  return { fields };
}

async function submitToCRM(lead) {
  if (CRM.mode === 'bitrix' && CRM.endpoint) {
    const res = await fetch(CRM.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toBitrix(lead))
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || (body && body.error)) {
      throw new Error('bitrix ' + res.status + (body && body.error ? ' ' + body.error : ''));
    }
    return res;
  }
  if (CRM.mode === 'telegram' && CRM.telegram.proxy) {
    const text =
      '🔔 ' + CRM.title + '\n👤 ' + lead.name +
      '\n📞 ' + lead.phone + '\n🏙 ' + lead.city +
      '\n💼 ' + lead.specialtyLabel + '\n🔗 ' + lead.page;
    const res = await fetch(CRM.telegram.proxy, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CRM.telegram.chatId, text })
    });
    if (!res.ok) throw new Error('telegram ' + res.status);
    return res;
  }
  // default: JSON вебхук
  const res = await fetch(CRM.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(lead)
  });
  if (!res.ok) throw new Error('crm ' + res.status);
  return res;
}

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Mobile nav ---------- */
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (navToggle) {
    navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => navLinks.classList.remove('open')));
  }

  /* ---------- Modal ---------- */
  const modal = document.getElementById('applyModal');
  const modalClose = document.getElementById('modalClose');
  const specSelect = document.getElementById('fSpec');

  function openModal(specialty) {
    if (specialty && specSelect) specSelect.value = specialty;
    if (modal.classList.contains('sent')) modal.classList.remove('sent');
    if (form) form.style.display = '';
    if (formSuccess) formSuccess.classList.remove('show');
    if (formError) formError.classList.remove('show');
    if (formSubmit) { formSubmit.disabled = false; formSubmit.textContent = 'Отправить заявку'; }
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.apply-trigger').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const spec = btn.getAttribute('data-specialty');
      openModal(spec || '');
    });
  });
  if (modalClose) modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  /* ---------- Form submit (CRM) ---------- */
  const form = document.getElementById('modalForm');
  const formError = document.getElementById('formError');
  const formSuccess = document.getElementById('formSuccess');
  const formSubmit = document.getElementById('fSubmit');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      formError.classList.remove('show');
      formSuccess.classList.remove('show');
      if (!form.checkValidity()) { form.reportValidity(); return; }

      const lead = buildLead(form);
      const configured =
        (CRM.mode === 'json' && CRM.endpoint) ||
        (CRM.mode === 'bitrix' && CRM.endpoint) ||
        (CRM.mode === 'telegram' && CRM.telegram.proxy);

      if (!configured) {                         // демо-режим (CRM не настроена)
        modal.classList.add('sent');
        form.style.display = 'none';
        formSuccess.classList.add('show');
        form.reset();
        setTimeout(closeModal, 2500);
        return;
      }

      const original = formSubmit ? formSubmit.textContent : '';
      if (formSubmit) { formSubmit.disabled = true; formSubmit.textContent = 'Отправка…'; }
      try {
        await submitToCRM(lead);
        modal.classList.add('sent');
        form.style.display = 'none';
        formSuccess.classList.add('show');
        form.reset();
        setTimeout(closeModal, 2500);
      } catch (err) {
        console.error('CRM submit failed:', err);
        formError.classList.add('show');
      } finally {
        if (formSubmit) { formSubmit.disabled = false; formSubmit.textContent = original; }
      }
    });
  }

  /* ---------- FAQ tabs ---------- */
  const faqTabs = document.querySelectorAll('.faq-tab');
  const faqPanels = document.querySelectorAll('.faq-panel');
  faqTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      faqTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      faqPanels.forEach(p => p.classList.toggle('active', p.id === target));
    });
  });

  /* ---------- Path tabs (stages / documents) ---------- */
  const pathTabs = document.querySelectorAll('#pathTabs .tab-btn');
  const pathPanels = document.querySelectorAll('#pathPanels .tab-panel');
  pathTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      pathTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      pathPanels.forEach(p => p.classList.toggle('active', p.getAttribute('data-panel') === target));
    });
  });

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
      const expanded = q.getAttribute('aria-expanded') === 'true';
      q.setAttribute('aria-expanded', String(!expanded));
      const answer = q.nextElementSibling;
      answer.style.maxHeight = expanded ? '0' : answer.scrollHeight + 'px';
    });
  });

  /* ---------- Vacancy filter ---------- */
  const filterRow = document.getElementById('filterRow');
  const cards = document.querySelectorAll('#vacanciesCarousel .vac-card');
  if (filterRow) {
    filterRow.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterRow.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const f = btn.getAttribute('data-filter');
        cards.forEach(c => {
          c.style.display = (f === 'all' || c.getAttribute('data-cat') === f) ? '' : 'none';
        });
        const carousel = document.getElementById('vacanciesCarousel');
        if (carousel) carousel.scrollLeft = 0;
      });
    });
  }

  /* ---------- Carousel ---------- */
  const carousel = document.getElementById('vacanciesCarousel');
  const prev = document.getElementById('carouselPrev');
  const next = document.getElementById('carouselNext');
  if (carousel && prev && next) {
    const step = () => Math.min(carousel.clientWidth * 0.8, 320);
    prev.addEventListener('click', () => carousel.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => carousel.scrollBy({ left: step(), behavior: 'smooth' }));
  }

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('visible'); obs.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(el => obs.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('visible'));
  }

  /* ---------- Cookie banner ---------- */
  const cookie = document.getElementById('cookieBanner');
  const KEY = 'contract_svo_cookie';
  if (cookie) {
    if (localStorage.getItem(KEY)) {
      cookie.style.display = 'none';
    }
    const accept = () => { localStorage.setItem(KEY, '1'); cookie.style.display = 'none'; };
    document.getElementById('cookieAccept').addEventListener('click', accept);
    document.getElementById('cookieRead').addEventListener('click', () => {
      window.location.href = 'cookie-policy.html';
    });
  }

});
