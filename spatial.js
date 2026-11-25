'use strict';

(() => {
  const motion = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const spacious = matchMedia('(min-width: 1180px) and (min-height: 650px)');
  const controls = 'a[href], button, summary, .command-card, .project-showcase, .download-panel';
  const magnetic = '.primary, .icon-button, .rail-button, .round-primary';
  const excluded = '.skip, .drawer-shade, :disabled, [aria-disabled="true"]';
  const stickerSpecs = [
    ['prism', 6, '<svg viewBox="0 0 32 32" fill="none"><path d="M16 2 29 16 16 30 3 16Z" fill="#8ea5ff33" stroke="#adbcff"/><path d="m16 2 4 14-4 14m-13-14h26m-13-14-4 14 4 14" stroke="#adbcff" stroke-width=".8"/><path d="m12 16 4-5 4 5-4 5Z" fill="#dbe4ff"/></svg>'],
    ['code', 10, '&lt;/&gt;'],
    ['terminal', 8, '&gt;_'],
    ['status', 11, '<span class="sticker-dot"></span> Windows x64'],
    ['branch', 5, '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10" cy="7" r="3"/><circle cx="10" cy="25" r="3"/><circle cx="23" cy="10" r="3"/><path d="M10 10v12m13-9c-1 6-6 5-13 7"/></svg>']
  ];

  const stickers = [];
  for (const stage of document.querySelectorAll('[data-sticker-stage]')) {
    const layer = document.createElement('div');
    layer.className = 'spatial-stickers';
    layer.setAttribute('aria-hidden', 'true');
    for (const [name, depth, art] of stickerSpecs) {
      const sticker = document.createElement('span');
      sticker.className = `spatial-sticker sticker-${name}`;
      sticker.innerHTML = `<span class="sticker-float"><span class="sticker-face">${art}</span></span>`;
      const face = sticker.querySelector('.sticker-face');
      let pop;
      face.addEventListener('click', () => {
        if (!motion.matches) return;
        pop?.cancel();
        pop = face.animate([
          { transform: 'translateY(-4px) scale(1.06)' },
          { transform: 'translateY(1px) rotate(-10deg) scale(.91)', offset: .22 },
          { transform: 'translateY(-9px) rotate(10deg) scale(1.19)', offset: .58 },
          { transform: 'translateY(-4px) rotate(-2deg) scale(1.06)' }
        ], { duration: 390, easing: 'cubic-bezier(.25,1,.5,1)' });
      });
      stickers.push({ sticker, depth, pop: () => pop?.cancel() });
      layer.append(sticker);
    }
    stage.append(layer);
  }

  let target;
  let bounds;
  let pointer;
  let frame = 0;
  const sheen = document.createElement('span');
  sheen.className = 'spatial-sheen';
  sheen.setAttribute('aria-hidden', 'true');

  function clearTarget() {
    if (!target) return;
    target.removeAttribute('data-spatial-hover');
    for (const variable of ['--magnet-x', '--magnet-y', '--mouse-x', '--mouse-y']) {
      target.style.removeProperty(variable);
    }
    target = undefined;
    bounds = undefined;
  }

  function resolveTarget(element) {
    if (!(element instanceof Element)) return;
    const next = element.closest(controls);
    if (!next || next.matches(excluded)) return;
    // Inline prose links need to retain their original line breaks.
    const style = getComputedStyle(next);
    if (style.display === 'inline') return;
    if (style.position === 'static') next.dataset.spatialRelative = '';
    next.dataset.spatialAnchor = '';
    return next;
  }

  function renderPointer() {
    frame = 0;
    if (!pointer || !motion.matches || document.hidden) return;
    if (target) {
      bounds ??= target.getBoundingClientRect();
      const x = Math.max(0, Math.min(bounds.width, pointer.x - bounds.left));
      const y = Math.max(0, Math.min(bounds.height, pointer.y - bounds.top));
      target.style.setProperty('--mouse-x', `${x}px`);
      target.style.setProperty('--mouse-y', `${y}px`);
      if (target.matches(magnetic)) {
        target.style.setProperty('--magnet-x', `${(x / (bounds.width || 1) - .5) * 6}px`);
        target.style.setProperty('--magnet-y', `${(y / (bounds.height || 1) - .5) * 6}px`);
      }
    }
    if (spacious.matches) {
      const horizontal = Math.max(-1, Math.min(1, pointer.x * 2 / innerWidth - 1));
      const vertical = Math.max(-1, Math.min(1, pointer.y * 2 / innerHeight - 1));
      for (const { sticker, depth } of stickers) {
        sticker.style.setProperty('--float-x', `${horizontal * depth}px`);
        sticker.style.setProperty('--float-y', `${vertical * depth * .75}px`);
      }
    }
  }

  function resetPointer() {
    cancelAnimationFrame(frame);
    frame = 0;
    pointer = undefined;
    clearTarget();
    sheen.remove();
    for (const { sticker, pop } of stickers) {
      sticker.style.removeProperty('--float-x');
      sticker.style.removeProperty('--float-y');
      pop();
    }
  }

  document.addEventListener('pointermove', event => {
    if (!motion.matches || event.pointerType !== 'mouse') return;
    pointer = { x: event.clientX, y: event.clientY };
    const next = event.target instanceof Element ? event.target.closest(controls) : undefined;
    if (next !== target) {
      clearTarget();
      target = resolveTarget(next);
      if (target) {
        target.append(sheen);
        target.dataset.spatialHover = '';
      }
    }
    if (!frame) frame = requestAnimationFrame(renderPointer);
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    if (!event.relatedTarget) resetPointer();
  });
  document.addEventListener('scroll', () => { bounds = undefined; }, { passive: true, capture: true });
  window.addEventListener('resize', () => { bounds = undefined; }, { passive: true });
  window.addEventListener('blur', resetPointer);
  motion.addEventListener('change', resetPointer);
  spacious.addEventListener('change', resetPointer);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetPointer();
  });
})();
