// The "demo" button on a widget's card: hover (or keyboard focus, or a tap) plays a short silent clip of the widget in a small
// floating panel beside the card; leaving stops it and hides the panel. The clips are lab/demos/<id>.mp4 (npm run widget-demos);
// a widget with no file gets no button, and nothing is loaded until the button is pointed at. It never touches the lab's audio:
// the clip is muted, and this file does nothing but add a button to each card and show a panel.
(() => {
  const css = document.createElement('style');
  css.textContent = `
  .tool .demo-btn { position: absolute; top: 7px; right: 8px; padding: 1px 9px; font-size: 11px; line-height: 18px; border-radius: 9px; color: var(--dim); background: #1b171b; }
  .tool .demo-btn:hover, .tool .demo-btn:focus-visible, .tool .demo-btn.open { color: var(--fg); border-color: #5a4b4f; }
  #demo-panel { position: fixed; z-index: 50; width: 320px; padding: 5px; background: #110e11; border: 1px solid #5a4b4f; border-radius: 6px; box-shadow: 0 8px 22px #000c; pointer-events: none; }
  #demo-panel[hidden] { display: none; }
  #demo-panel video { display: block; width: 100%; aspect-ratio: 16 / 9; background: #000; border-radius: 3px; }
  #demo-panel .cap { color: var(--dim); font-size: 11.5px; margin: 4px 2px 0; }`;
  document.head.append(css);

  const box = document.getElementById('tools');
  if (!box) return;
  const have = new Set();   // ids that have a clip
  let panel = null, video = null, cap = null, current = null;

  function hide() {
    if (current) current.classList.remove('open');
    current = null;
    if (!panel) return;
    panel.hidden = true;
    video.pause(); video.removeAttribute('src'); video.load();   // load nothing until the next time
  }
  function show(btn) {
    if (current === btn) return;
    hide();
    if (!panel) {
      panel = document.createElement('div'); panel.id = 'demo-panel'; panel.hidden = true;
      video = document.createElement('video'); video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true; video.preload = 'none'; video.tabIndex = -1;
      cap = document.createElement('div'); cap.className = 'cap';
      panel.append(video, cap); document.body.append(panel);
    }
    const card = btn.closest('.tool'), id = card.dataset.id;
    current = btn; btn.classList.add('open');
    cap.textContent = `${card.querySelector('b')?.firstChild?.textContent ?? id}: a few seconds on a song`;
    // Beside the card: to its right if there is room, else to its left, else under it; kept inside the window.
    const r = card.getBoundingClientRect(), pw = 332, ph = 215, vw = innerWidth, vh = innerHeight;
    let x = r.right + 8;
    if (x + pw > vw) x = r.left - pw - 8;
    let y = r.top;
    if (x < 8) { x = Math.max(8, Math.min(r.left, vw - pw - 8)); y = r.bottom + 8; if (y + ph > vh) y = Math.max(8, r.top - ph - 8); }
    y = Math.max(8, Math.min(y, vh - ph - 8));
    panel.style.left = `${x}px`; panel.style.top = `${y}px`;
    video.src = `demos/${encodeURIComponent(id)}.mp4`;
    panel.hidden = false;
    video.play().catch(() => {});
  }

  function addButtons() {
    if (current && !current.isConnected) hide();   // the card was redrawn under it
    for (const card of box.children) {
      const id = card.dataset?.id;
      if (!id || !have.has(id) || card.querySelector(':scope > .demo-btn')) continue;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'demo-btn'; b.textContent = 'demo';
      b.title = 'Watch a few seconds of this widget on a song';
      b.addEventListener('mouseenter', () => show(b));
      b.addEventListener('mouseleave', () => { if (document.activeElement !== b) hide(); });
      b.addEventListener('focus', () => show(b));
      b.addEventListener('blur', hide);
      b.addEventListener('click', (ev) => { ev.stopPropagation(); current === b ? hide() : show(b); });   // a tap, where there is no hover
      b.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { hide(); b.blur(); } });
      card.append(b);
    }
  }

  // Which widgets have a clip: the ones lab/demos.json names, whose file really is a video (a missing file may answer with the page).
  fetch('demos.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then(async (plan) => {
    await Promise.all(Object.keys(plan).map((id) => fetch(`demos/${encodeURIComponent(id)}.mp4`, { method: 'HEAD' })
      .then((r) => { if (r.ok && /^video\//.test(r.headers.get('content-type') || '')) have.add(id); }).catch(() => {})));
    if (!have.size) return;
    new MutationObserver(addButtons).observe(box, { childList: true });
    addButtons();
  });
  addEventListener('scroll', hide, { passive: true });
})();
