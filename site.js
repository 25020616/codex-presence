'use strict';
(() => {
  const body = document.body;
  const sidebar = document.querySelector('#sidebar');
  const toggle = document.querySelector('.sidebar-toggle');
  const backdrop = document.querySelector('.sidebar-backdrop');
  const workspace = document.querySelector('.workspace');
  const mobile = matchMedia('(max-width: 760px)');
  const toast = document.querySelector('.toast');
  let toastTimer;
  let desktopCollapsed = false;
  function syncSidebar(returnFocus = false) {
    const open = body.dataset.sidebarOpen === 'true';
    const expanded = mobile.matches ? open : !desktopCollapsed;
    toggle.setAttribute('aria-expanded', String(expanded));
    const label = mobile.matches ? (open ? 'Đóng điều hướng' : 'Mở điều hướng') : (expanded ? 'Thu gọn thanh bên' : 'Mở rộng thanh bên');
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    sidebar.inert = mobile.matches && !open;
    workspace.inert = mobile.matches && open;
    backdrop.hidden = !(mobile.matches && open);
    if (returnFocus) toggle.focus();
  }
  function closeSidebar(returnFocus = true) {
    body.dataset.sidebarOpen = 'false';
    syncSidebar(returnFocus);
  }
  toggle.addEventListener('click', () => {
    if (mobile.matches) {
      body.dataset.sidebarOpen = String(body.dataset.sidebarOpen !== 'true');
      syncSidebar();
      if (body.dataset.sidebarOpen === 'true') sidebar.querySelector('a').focus();
    } else {
      desktopCollapsed = !desktopCollapsed;
      body.dataset.collapsed = String(desktopCollapsed);
      syncSidebar();
    }
  });
  backdrop.addEventListener('click', () => closeSidebar());
  sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    if (mobile.matches) closeSidebar(false);
  }));
  document.addEventListener('keydown', event => {
    if (!mobile.matches || body.dataset.sidebarOpen !== 'true') return;
    if (event.key === 'Escape') {
      event.preventDefault(); closeSidebar();
    } else if (event.key === 'Tab') {
      const items = [...sidebar.querySelectorAll('a,button')];
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  });
  mobile.addEventListener('change', () => {
    const focusWasInSidebar = sidebar.contains(document.activeElement);
    body.dataset.sidebarOpen = 'false';
    syncSidebar(mobile.matches && focusWasInSidebar);
  });
  syncSidebar();
  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
  }
  document.querySelectorAll('[data-copy]').forEach(button => {
    const originalIcon = button.innerHTML;
    let resetTimer;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        clearTimeout(resetTimer);
        button.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
        showToast(`Đã sao chép ${button.dataset.copyLabel}`);
        resetTimer = setTimeout(() => { button.innerHTML = originalIcon; }, 2200);
      } catch {
        showToast(`Chưa thể sao chép. Bạn có thể chọn ${button.dataset.copyLabel} trên trang để sao chép trực tiếp.`);
      }
    });
  });
  const year = document.querySelector('#year');
  if (year) year.textContent = new Date().getFullYear();
  if (body.dataset.page === 'overview') {
    const updateNav = () => {
      const key = ['#about', '#contact'].includes(location.hash) ? location.hash.slice(1) : 'overview';
      sidebar.querySelectorAll('[data-nav]').forEach(link => {
        if (link.dataset.nav === key) link.setAttribute('aria-current', key === 'overview' ? 'page' : 'location');
        else link.removeAttribute('aria-current');
      });
    };
    updateNav(); addEventListener('hashchange', updateNav);
  }
})();
