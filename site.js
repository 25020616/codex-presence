'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const body = document.body;
  const mobile = matchMedia('(max-width: 760px)');
  const sidebar = $('#sidebar');
  const surface = $('.app-surface');
  const rail = $('.rail');
  const toggle = $('.sidebar-toggle');
  const shade = $('.drawer-shade');
  const searchDialog = $('.search-dialog');
  const imageDialog = $('.image-dialog');
  const searchInput = $('#search-input');
  const resultBox = $('.search-results');
  const toast = $('.toast');
  const siteRoot = new URL('./', location.href).href;
  const projectUrl = 'https://codexpresence.giahuydevtrai.online/';
  const repo = 'https://github.com/25020616/codex-presence';
  let collapsed = false;
  const themeKey = 'giahuy.theme.v3';
  document.documentElement.dataset.theme = 'dark';
  try {
    collapsed = sessionStorage.getItem('giahuy.sidebarCollapsed') === 'true';
    if (sessionStorage.getItem(themeKey) === 'light') document.documentElement.dataset.theme = 'light';
  } catch { /* The workspace still works when browser storage is unavailable. */ }
  let toastTimer;
  let popoverTrigger;
  let searchTrigger;
  let resultIndex = 0;
  let results = [];
  const languageKey = 'codex-presence.language';
  const languageSelect = $('#presence-language');
  const localized = $$('[data-vi]').map(element => ({
    element, english: element.textContent, vietnamese: element.dataset.vi
  }));
  const localizedAttributes = ['aria-label', 'title', 'alt', 'placeholder', 'content'].flatMap(attribute =>
    $$('[data-vi-' + attribute + ']').map(element => ({
      element, attribute, english: element.getAttribute(attribute), vietnamese: element.getAttribute('data-vi-' + attribute)
    }))
  );
  let language = readLanguage();
  const t = (english, vietnamese) => language === 'vi' ? vietnamese : english;

  function readLanguage() {
    const requested = new URLSearchParams(location.search).get('lang');
    if (requested === 'vi' || requested === 'en') return requested;
    try {
      if (localStorage.getItem(languageKey) === 'vi') return 'vi';
    } catch {
      // Query links and the selector still work when storage is disabled.
    }
    return 'en';
  }

  function applyLanguage() {
    document.documentElement.lang = language;
    languageSelect.value = language;
    for (const item of localized) item.element.textContent = t(item.english, item.vietnamese);
    for (const item of localizedAttributes) item.element.setAttribute(item.attribute, t(item.english, item.vietnamese));
    try { localStorage.setItem(languageKey, language); } catch {}
  }

  function refreshLanguage() {
    applyLanguage();
    syncSidebar();
    updateThemeControl();
    positionTabIndicator();
    if (searchDialog.open) renderResults();
  }

  languageSelect.addEventListener('change', () => {
    language = languageSelect.value;
    const url = new URL(location.href);
    url.searchParams.set('lang', language);
    history.replaceState(history.state, '', url);
    refreshLanguage();
  });
  applyLanguage();

  function message(text) {
    clearTimeout(toastTimer);
    toast.textContent = text;
    toast.classList.add('visible');
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
  }

  function syncSidebar(returnFocus = false) {
    const open = mobile.matches && body.dataset.sidebarOpen === 'true';
    body.dataset.collapsed = String(collapsed);
    try { sessionStorage.setItem('giahuy.sidebarCollapsed', String(collapsed)); } catch {}
    sidebar.inert = mobile.matches ? !open : collapsed;
    surface.inert = open;
    rail.inert = open;
    shade.hidden = !open;
    const expanded = mobile.matches ? open : !collapsed;
    toggle.setAttribute('aria-expanded', String(expanded));
    const closeLabel = t('Close sidebar', 'Đóng thanh bên');
    const collapseLabel = t('Collapse sidebar', 'Thu gọn thanh bên');
    toggle.setAttribute('aria-label', mobile.matches ? (open ? closeLabel : t('Open sidebar', 'Mở thanh bên')) : (expanded ? collapseLabel : t('Expand sidebar', 'Mở rộng thanh bên')));
    $('.sidebar-close').setAttribute('aria-label', mobile.matches ? closeLabel : collapseLabel);
    if (returnFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    if (mobile.matches) body.dataset.sidebarOpen = String(body.dataset.sidebarOpen !== 'true');
    else collapsed = !collapsed;
    syncSidebar();
    if (mobile.matches && body.dataset.sidebarOpen === 'true') $('.sidebar-close').focus();
  });
  function closeSidebar(returnFocus = true) {
    body.dataset.sidebarOpen = 'false';
    if (!mobile.matches) collapsed = true;
    syncSidebar(returnFocus);
  }
  $('.sidebar-close').addEventListener('click', () => closeSidebar());
  shade.addEventListener('click', () => closeSidebar());
  sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    if (mobile.matches) closeSidebar(false);
  }));
  mobile.addEventListener('change', () => {
    const focused = sidebar.contains(document.activeElement);
    body.dataset.sidebarOpen = 'false';
    syncSidebar(mobile.matches && focused);
    positionTabIndicator();
  });
  syncSidebar();

  function closePopovers(focus = false) {
    $$('.popover').forEach(menu => { menu.hidden = true; });
    $$('[data-popover]').forEach(button => button.setAttribute('aria-expanded', 'false'));
    if (focus && popoverTrigger) popoverTrigger.focus();
  }
  $$('[data-popover]').forEach(button => button.addEventListener('click', () => {
    const menu = document.getElementById(button.dataset.popover);
    const open = menu.hidden;
    closePopovers();
    popoverTrigger = button;
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }));
  $$('.popover a').forEach(link => link.addEventListener('click', () => closePopovers()));
  document.addEventListener('click', event => {
    if (!event.target.closest('.popover-anchor')) closePopovers();
  });

  function positionTabIndicator() {
    const tabs = $('.project-tabs');
    if (!tabs) return;
    const active = tabs.querySelector('[aria-selected="true"]');
    const marker = tabs.querySelector('.tab-indicator');
    marker.style.width = active.offsetWidth + 'px';
    marker.style.transform = `translateX(${active.offsetLeft - 4}px)`;
  }
  function currentTab() {
    const key = ['setup', 'download'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
    $$('[data-tab]').forEach(button => {
      const selected = button.dataset.tab === key;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      document.getElementById(button.getAttribute('aria-controls')).hidden = !selected;
    });
    positionTabIndicator();
  }
  $$('[data-tab]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-selected') === 'true') return;
      const url = new URL(location.href);
      url.hash = button.dataset.tab === 'overview' ? '' : button.dataset.tab;
      history.pushState({}, '', url);
      currentTab();
    });
    button.addEventListener('keydown', event => {
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const tabs = $$('[data-tab]');
      let index = tabs.indexOf(button);
      if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else index = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[index].click(); tabs[index].focus();
    });
  });
  addEventListener('hashchange', currentTab);
  addEventListener('popstate', () => {
    currentTab();
    const next = readLanguage();
    if (next !== language) {
      language = next;
      refreshLanguage();
    }
  });
  addEventListener('resize', positionTabIndicator);
  currentTab();
  $('.rail [data-view-link="projects"]').setAttribute('aria-current', 'location');

  async function copy(text, label, button) {
    try {
      await navigator.clipboard.writeText(text);
      message(t(`Copied ${label}`, `Đã sao chép ${label}`));
      if (button) {
        const icon = button.querySelector('.icon');
        if (icon && !button.dataset.copyBusy) {
          const before = icon.innerHTML;
          button.dataset.copyBusy = 'true';
          icon.innerHTML = '<path d="m5 12 4 4L19 6"/>';
          setTimeout(() => { icon.innerHTML = before; delete button.dataset.copyBusy; }, 2200);
        }
      }
    } catch {
      message(t(`Copy unavailable. Select ${label} to copy it manually.`, `Chưa thể sao chép. Hãy chọn ${label} trên trang để sao chép trực tiếp.`));
    }
  }
  $$('[data-copy]').forEach(button => button.addEventListener('click', () => copy(button.dataset.copy, button.dataset.copyLabel, button)));
  $('[data-share]').addEventListener('click', event => copy(location.href, t('page link', 'link trang'), event.currentTarget));
  function updateThemeControl() {
    const light = document.documentElement.dataset.theme === 'light';
    const label = light ? t('Switch to dark theme', 'Chuyển giao diện tối') : t('Switch to light theme', 'Chuyển giao diện sáng');
    $('.theme-toggle').setAttribute('aria-label', label);
    $('.theme-toggle').closest('.tip-wrap').querySelector('.tooltip').textContent = label;
  }
  updateThemeControl();
  $('.theme-toggle').addEventListener('click', () => {
    const light = document.documentElement.dataset.theme !== 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    try { sessionStorage.setItem(themeKey, light ? 'light' : 'dark'); } catch {}
    updateThemeControl();
  });

  function searchItems() {
    const product = new URL(language === 'vi' ? 'vi.html' : './?lang=en', projectUrl);
    function onProduct(hash = '') {
      const url = new URL(product);
      url.hash = hash;
      return url.href;
    }
    return [
      {title:'Codex Presence',description:t('Windows app · Codex desktop × Discord','Ứng dụng Windows · Codex desktop × Discord'),href:onProduct(),type:t('Project','Dự án'),keywords:'project app ung dung rich presence'},
      {title:t('Download Codex Presence for Windows','Tải Codex Presence cho Windows'),description:t('Portable ZIP · Build Nov 20, 2026','ZIP portable · Build 20/11/2026'),href:onProduct('download'),type:t('Download','Bản tải'),keywords:'download exe zip tai xuong'},
      {title:t('Setup guide','Hướng dẫn cài đặt'),description:t('Download, extract and connect to Discord','Tải, giải nén và kết nối với Discord'),href:onProduct('setup'),type:t('Guide','Hướng dẫn'),keywords:'setup install guide help huong dan cai dat su dung'},
      {title:t('Source on GitHub','Mã nguồn trên GitHub'),description:'25020616 / codex-presence',href:repo,type:'GitHub',keywords:'source code git repo csharp ma nguon'},
      {title:t('About Gia Huy','Về Gia Huy'),description:t('Meet the developer behind this workspace','Một chút về người làm ra workspace này'),href:siteRoot+'#about',type:t('About','Giới thiệu'),keywords:'nguyen gia huy developer about'},
      {title:t('Contact Gia Huy','Liên hệ Gia Huy'),description:'giahuydeeptry2007@gmail.com',href:siteRoot+'#contact',type:t('Contact','Liên hệ'),keywords:'contact email mail lien he ket noi'}
    ];
  }
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  function selectResult(index) {
    const links = [...resultBox.querySelectorAll('a')];
    if (!links.length) return;
    resultIndex = (index + links.length) % links.length;
    links.forEach((link, i) => { link.dataset.active = String(i === resultIndex); });
    $('#search-feedback').textContent = t(`${links.length} results. Selected: ${results[resultIndex].title}.`, `${links.length} kết quả. Đang chọn: ${results[resultIndex].title}.`);
    links[resultIndex].scrollIntoView({block:'nearest',behavior:'instant'});
  }
  function renderResults() {
    const terms = normalize(searchInput.value).trim().split(/\s+/).filter(Boolean);
    results = searchItems().filter(item => terms.every(term => normalize(item.title+' '+item.description+' '+item.keywords).includes(term)));
    resultBox.replaceChildren();
    results.forEach((item, index) => {
      const link = document.createElement('a');
      link.className = 'search-result'; link.href = item.href;
      const icon = document.createElement('span');
      icon.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 7 5 5-5 5m8 0h6"/></svg>';
      const text = document.createElement('span'); text.className = 'search-result-copy';
      const title = document.createElement('strong'); title.textContent = item.title;
      const desc = document.createElement('span'); desc.textContent = item.description;
      text.append(title, desc);
      const tag = document.createElement('span'); tag.className = 'result-tag'; tag.textContent = item.type;
      link.append(icon, text, tag);
      link.addEventListener('pointerenter', () => selectResult(index));
      link.addEventListener('click', () => searchDialog.close());
      resultBox.append(link);
    });
    if (!results.length) {
      const empty = document.createElement('p'); empty.className = 'search-empty';
      empty.textContent = t('No matches. Try “Codex,” “download,” or “contact.”', 'Chưa tìm thấy nội dung. Thử “Codex”, “tải” hoặc “liên hệ”.');
      resultBox.append(empty);
      $('#search-feedback').textContent = t('No search results.', 'Không có kết quả tìm kiếm.');
    }
    resultIndex = 0; selectResult(0);
  }
  function openSearch(trigger) {
    if (searchDialog.open) return;
    closePopovers();
    if (mobile.matches && body.dataset.sidebarOpen === 'true') closeSidebar(false);
    searchTrigger = trigger;
    searchInput.value = '';
    renderResults(); searchDialog.showModal(); searchInput.focus();
  }
  $$('[data-open-search]').forEach(button => button.addEventListener('click', () => openSearch(button)));
  searchInput.addEventListener('input', renderResults);
  searchInput.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); selectResult(resultIndex + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter') {
      event.preventDefault(); resultBox.querySelectorAll('a')[resultIndex]?.click();
    }
  });
  searchDialog.addEventListener('close', () => {
    if (searchTrigger?.isConnected && !searchTrigger.closest('[inert]') && searchTrigger.getClientRects().length) searchTrigger.focus({preventScroll:true});
    else if (mobile.matches) toggle.focus({preventScroll:true});
  });
  function backdropClose(dialog, event) {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  }
  searchDialog.addEventListener('click', event => backdropClose(searchDialog, event));
  $('.zoom-trigger')?.addEventListener('click', () => imageDialog.showModal());
  $('.close-image').addEventListener('click', () => imageDialog.close());
  imageDialog.addEventListener('click', event => backdropClose(imageDialog, event));

  // Animate navigation without relying on browser-specific document transitions.
  let navigating = false;
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || link.target === '_blank') return;
    const next = new URL(link.href);
    if (next.origin !== location.origin || next.pathname === location.pathname) return;
    event.preventDefault();
    if (navigating) return;
    navigating = true;
    body.classList.add('is-leaving');
    const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 110;
    setTimeout(() => location.assign(next.href), delay);
  });
  addEventListener('pageshow', () => {
    navigating = false;
    body.classList.remove('is-leaving');
  });

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault(); openSearch(document.activeElement); return;
    }
    if (event.key === 'Escape' && popoverTrigger?.getAttribute('aria-expanded') === 'true') {
      event.preventDefault(); closePopovers(true); return;
    }
    if (event.key === 'Escape' && mobile.matches && body.dataset.sidebarOpen === 'true') {
      event.preventDefault(); closeSidebar(); return;
    }
    if (event.key === 'Tab' && mobile.matches && body.dataset.sidebarOpen === 'true') {
      const items = [...sidebar.querySelectorAll('a,button')];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  $('#year').textContent = new Date().getFullYear();
})();
