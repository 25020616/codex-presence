'use strict';
const menu = document.querySelector('.menu-button');
const mobileNav = document.querySelector('#mobile-nav');
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
  mobileNav.hidden = !open;
});
mobileNav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  mobileNav.hidden = true;
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Mở menu');
}));
document.querySelector('#year').textContent = new Date().getFullYear();
document.querySelector('.copy-checksum')?.addEventListener('click', async event => {
  const button = event.currentTarget;
  try {
    await navigator.clipboard.writeText(document.querySelector('.checksum').textContent.trim());
    button.textContent = 'Đã sao chép SHA-256';
    setTimeout(() => { button.textContent = 'Sao chép SHA-256'; }, 2500);
  } catch {
    document.querySelector('.checksum-status').textContent = 'Chưa thể sao chép tự động. Bạn có thể chọn mã ở trên và sao chép trực tiếp.';
  }
});
