'use strict';

(() => {
  const fineMotion = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const decorativeWidth = matchMedia('(min-width: 768px)');
  const spotlightTargets = [
    'a[href]', 'button', 'summary', '[role="button"]',
    '.command-card', '.project-showcase', '.download-panel', '[data-spotlight]'
  ].join(', ');
  const excluded = '.skip, .drawer-shade, :disabled, [aria-disabled="true"]';
  const magneticTargets = '.primary, .round-primary, .icon-button, .rail-button, [data-magnetic]';
  const spotlightCache = new WeakMap();
  const docks = new Map();
  const stickers = new Map();
  const stickerLayers = new Map();
  const visibleStages = new Set();
  const springs = new WeakMap();
  const moving = new Set();
  const offsetSprings = new Set();
  const springDefaults = { rest: 0, unit: 'px', stiffness: 290, damping: 23, precision: .025 };
  const dockSpring = { ...springDefaults, rest: 1, unit: '', precision: .0005 };
  const driftSpring = { ...springDefaults, stiffness: 180, damping: 21 };
  const stickerArt = [
    ['prism', 6, '<svg viewBox="0 0 32 32" fill="none"><path d="M16 2 29 16 16 30 3 16Z" fill="#8ea5ff33" stroke="#adbcff"/><path d="m16 2 4 14-4 14m-13-14h26m-13-14-4 14 4 14" stroke="#adbcff" stroke-width=".8"/><path d="m12 16 4-5 4 5-4 5Z" fill="#dbe4ff"/></svg>'],
    ['code', 10, '&lt;/&gt;'],
    ['terminal', 8, '&gt;_'],
    ['status', 11, '<span class="sticker-dot"></span> Windows x64'],
    ['branch', 5, '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10" cy="7" r="3"/><circle cx="10" cy="25" r="3"/><circle cx="23" cy="10" r="3"/><path d="M10 10v12m13-9c-1 6-6 5-13 7"/></svg>']
  ];

  let pointer;
  let hit;
  let geometryDirty = false;
  let activeControl;
  let activeDock;
  let activeFace;
  let frame = 0;
  let previousTime = 0;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const enabled = () => fineMotion.matches && !document.hidden;

  function schedule() {
    if (!frame) frame = requestAnimationFrame(renderFrame);
  }

  function springTo(element, name, target, config = springDefaults) {
    let properties = springs.get(element);
    let spring = properties?.get(name);
    if (!spring && target === config.rest) return;
    if (!properties) {
      properties = new Map();
      springs.set(element, properties);
    }
    if (!spring) {
      spring = { ...config, element, name, value: config.rest, goal: config.rest, speed: 0, rendered: null };
      properties.set(name, spring);
    }
    if (target === spring.goal || (target !== spring.rest && Math.abs(spring.goal - target) < spring.precision)) return;
    spring.goal = target;
    moving.add(spring);
    offsetSprings.add(spring);
  }

  function writeSpring(spring, rounded) {
    if (spring.rendered === rounded) return;
    spring.rendered = rounded;
    if (rounded === null) spring.element.style.removeProperty(spring.name);
    else spring.element.style.setProperty(spring.name, rounded + spring.unit);
  }

  function advanceSpring(spring, elapsed) {
    const steps = Math.ceil(elapsed * 120);
    const step = elapsed / steps;
    for (let i = 0; i < steps; i++) {
      spring.speed += (spring.stiffness * (spring.goal - spring.value) - spring.damping * spring.speed) * step;
      spring.value += spring.speed * step;
    }
    const settled = Math.abs(spring.goal - spring.value) < spring.precision && Math.abs(spring.speed) < spring.precision * 30;
    if (settled) {
      spring.value = spring.goal;
      spring.speed = 0;
      moving.delete(spring);
    }
    const atRest = settled && spring.goal === spring.rest;
    if (atRest) offsetSprings.delete(spring);
    writeSpring(spring, atRest ? null : Math.round(spring.value * 10000) / 10000);
  }

  for (const dock of document.querySelectorAll('[data-motion-dock]')) {
    const radius = Number(dock.dataset.motionDockRadius) || 100;
    docks.set(dock, { radius, items: Array.from(dock.querySelectorAll('[data-motion-dock-item]')) });
  }

  function mountStickers(stage) {
    const layer = document.createElement('div');
    layer.className = 'spatial-stickers';
    layer.setAttribute('aria-hidden', 'true');
    const stageStickers = [];
    for (const [name, depth, art] of stickerArt) {
      const sticker = document.createElement('span');
      sticker.className = 'spatial-sticker sticker-' + name;
      sticker.innerHTML = '<span class="sticker-float"><span class="sticker-face">' + art + '</span></span>';
      const face = sticker.querySelector('.sticker-face');
      const item = { sticker, depth, pop: null };
      face.addEventListener('click', () => {
        if (!enabled() || !decorativeWidth.matches) return;
        item.pop?.cancel();
        item.pop = face.animate([
          { translate: '0 0', rotate: '0deg', scale: '1' },
          { translate: '0 2px', rotate: '-7deg', scale: '.92', offset: .18 },
          { translate: '0 -5px', rotate: '6deg', scale: '1.13', offset: .56 },
          { translate: '0 1px', rotate: '-2deg', scale: '.98', offset: .82 },
          { translate: '0 0', rotate: '0deg', scale: '1' }
        ], { duration: 240, easing: 'linear' });
        item.pop.onfinish = () => { item.pop = null; };
      });
      stickers.set(face, item);
      stageStickers.push(item);
      layer.append(sticker);
    }
    stage.append(layer);
    stickerLayers.set(stage, { layer, items: stageStickers });
  }

  const stageObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) visibleStages.add(entry.target);
      else visibleStages.delete(entry.target);
    }
    refreshGeometry();
  });

  for (const stage of document.querySelectorAll('[data-sticker-stage]')) {
    mountStickers(stage);
    stageObserver.observe(stage);
  }

  function measureControl(origin) {
    const control = origin?.closest(spotlightTargets);
    if (!control || control.matches(excluded) || control.closest('[inert]')) return null;
    const cached = spotlightCache.get(control);
    const style = cached ? null : getComputedStyle(control);
    // Preserve text wrapping for inline prose links.
    if (style?.display === 'inline') return null;
    const bounds = control.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    return {
      control, bounds, cached, relative: style?.position === 'static',
      width: control.clientWidth, height: control.clientHeight
    };
  }

  function clearControl() {
    if (!activeControl) return;
    activeControl.classList.remove('spatial-active');
    springTo(activeControl, '--magnet-x', 0);
    springTo(activeControl, '--magnet-y', 0);
    activeControl = null;
  }

  function lightControl(measurement) {
    if (measurement?.control !== activeControl) clearControl();
    if (!measurement) return;
    const { control, bounds, cached, relative, width, height } = measurement;
    let overlay = cached;
    if (!overlay) {
      overlay = document.createElement('span');
      overlay.className = 'spatial-spotlight';
      overlay.setAttribute('aria-hidden', 'true');
      const rim = document.createElement('span');
      rim.className = 'spatial-spotlight-rim';
      overlay.append(rim);
      if (relative) control.setAttribute('data-spatial-relative', '');
      control.append(overlay);
      spotlightCache.set(control, overlay);
    }
    const x = clamp((pointer.x - bounds.left) / bounds.width, 0, 1);
    const y = clamp((pointer.y - bounds.top) / bounds.height, 0, 1);
    overlay.style.setProperty('--mouse-x', (x * width).toFixed(2) + 'px');
    overlay.style.setProperty('--mouse-y', (y * height).toFixed(2) + 'px');
    if (activeControl !== control) control.classList.add('spatial-active');
    activeControl = control;
    if (control.matches(magneticTargets)) {
      const strength = pointer.pressed ? 0 : 3.5;
      springTo(control, '--magnet-x', (2 * x - 1) * strength);
      springTo(control, '--magnet-y', (2 * y - 1) * strength);
    }
  }

  function measureDock(origin) {
    const dock = docks.get(origin?.closest('[data-motion-dock]'));
    const goals = dock?.items.map(item => {
      const box = item.getBoundingClientRect();
      if (!box.width || !box.height) return 1;
      const dx = pointer.x - (box.left + box.width / 2);
      const dy = pointer.y - (box.top + box.height / 2);
      const influence = Math.max(0, 1 - Math.hypot(dx, dy) / dock.radius);
      return 1 + .23 * influence * influence * (3 - 2 * influence);
    });
    return { dock, goals };
  }

  function magnifyDock({ dock, goals }) {
    if (activeDock && activeDock !== dock) {
      for (const item of activeDock.items) springTo(item, '--dock-scale', 1, dockSpring);
    }
    dock?.items.forEach((item, index) => springTo(item, '--dock-scale', goals[index], dockSpring));
    activeDock = dock;
  }

  function moveStickers(visibleLayers, face, faceBox) {
    const x = pointer ? clamp(pointer.x * 2 / innerWidth - 1, -1, 1) : 0;
    const y = pointer ? clamp(pointer.y * 2 / innerHeight - 1, -1, 1) : 0;
    for (const { layer, items } of stickerLayers.values()) {
      const visible = visibleLayers.has(layer);
      for (const { sticker, depth } of items) {
        springTo(sticker, '--float-x', visible ? x * depth : 0, driftSpring);
        springTo(sticker, '--float-y', visible ? y * depth * .75 : 0, driftSpring);
      }
    }
    if (activeFace && activeFace !== face) {
      activeFace.classList.remove('sticker-tracked');
      activeFace.style.removeProperty('--sticker-tilt-x');
      activeFace.style.removeProperty('--sticker-tilt-y');
    }
    activeFace = face;
    if (!face || !faceBox?.width || !faceBox?.height) return;
    const localX = clamp(2 * (pointer.x - faceBox.left) / faceBox.width - 1, -1, 1);
    const localY = clamp(2 * (pointer.y - faceBox.top) / faceBox.height - 1, -1, 1);
    face.style.setProperty('--sticker-tilt-x', (-localY * 13).toFixed(2) + 'deg');
    face.style.setProperty('--sticker-tilt-y', (localX * 15).toFixed(2) + 'deg');
    face.classList.add('sticker-tracked');
  }

  function applyPointer() {
    geometryDirty = false;
    // Read every bound before adding an overlay or updating a custom property.
    const origin = pointer && (hit || document.elementFromPoint(pointer.x, pointer.y));
    const control = measureControl(origin);
    const dock = origin ? measureDock(origin) : {};
    const visibleLayers = new Set();
    if (pointer && decorativeWidth.matches) {
      for (const stage of visibleStages) {
        const { layer } = stickerLayers.get(stage);
        if (layer.getClientRects().length) visibleLayers.add(layer);
      }
    }
    const hitFace = origin?.closest('.sticker-face');
    const face = visibleLayers.has(hitFace?.closest('.spatial-stickers')) ? hitFace : null;
    const faceBox = face?.getBoundingClientRect();
    lightControl(control);
    magnifyDock(dock);
    moveStickers(visibleLayers, face, faceBox);
  }

  function renderFrame(time) {
    frame = 0;
    if (!enabled()) return;
    if (geometryDirty) applyPointer();
    const elapsed = previousTime ? clamp((time - previousTime) / 1000, .001, .045) : 1 / 60;
    for (const spring of moving) advanceSpring(spring, elapsed);
    previousTime = moving.size ? time : 0;
    if (moving.size) schedule();
  }

  function refreshGeometry() {
    if (!pointer || !enabled()) return;
    hit = null;
    geometryDirty = true;
    schedule();
  }

  function samplePointer(event) {
    if (!enabled() || event.pointerType !== 'mouse') return;
    pointer = { x: event.clientX, y: event.clientY, pressed: Boolean(event.buttons) };
    hit = event.target instanceof Element ? event.target : null;
    geometryDirty = true;
    schedule();
  }

  function leavePointer(event) {
    if (event.relatedTarget || !pointer) return;
    pointer = null;
    hit = null;
    geometryDirty = true;
    schedule();
  }

  function resetMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    pointer = null;
    hit = null;
    geometryDirty = false;
    clearControl();
    magnifyDock({});
    moveStickers(new Set(), null);
    for (const spring of offsetSprings) {
      spring.value = spring.goal = spring.rest;
      spring.speed = 0;
      writeSpring(spring, null);
    }
    moving.clear();
    offsetSprings.clear();
    for (const item of stickers.values()) {
      item.pop?.cancel();
      item.pop = null;
    }
  }

  for (const event of ['pointermove', 'pointerdown', 'pointerup']) {
    document.addEventListener(event, samplePointer, { passive: true, capture: true });
  }
  document.addEventListener('pointerout', leavePointer, { passive: true });
  document.addEventListener('pointercancel', resetMotion);
  document.addEventListener('scroll', refreshGeometry, { passive: true, capture: true });
  document.addEventListener('click', refreshGeometry);
  document.addEventListener('visibilitychange', resetMotion);
  window.addEventListener('resize', refreshGeometry, { passive: true });
  window.addEventListener('blur', resetMotion);
  window.addEventListener('pagehide', resetMotion);
  fineMotion.addEventListener('change', resetMotion);
  decorativeWidth.addEventListener('change', refreshGeometry);
})();
