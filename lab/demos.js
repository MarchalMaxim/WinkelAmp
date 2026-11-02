// The "demo" button on a widget's card: a short silent clip of the widget in a small floating panel beside the card.
// One state: which button is showing (current). Hover, keyboard focus or a tap shows it; anything leaving hides it: the mouse
// going away (focused or not), focus going away, a tap elsewhere, Escape, or a scroll. A scroll only moves the panel along while
// the button holds keyboard focus (tabbing to a card off screen is itself a scroll) or the mouse is still on it (if the scroll
// took the button away from under the mouse, the browser sends the leaving a moment later).
// The clips are lab/demos/<id>.mp4 (npm run widget-demos); a widget with no file gets no button, and no video is fetched until
// the button is pointed at (the page only asks which files exist, and not at all in render mode, where the cards go unseen).
// It never touches the lab's audio: the clip is muted, and this file does nothing but add a button to each card and show a panel.
(() => {
  if (new URLSearchParams(location.search).has('render')) return;
  const css = document.createElement('style');
  css.textContent = `
  .tool:has(> .demo-btn) > b { padding-right: 52px; }
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
  let plan = {}, panel = null, video = null, cap = null, current = null, hovered = null;

  function hide() {
    if (current) current.classList.remove('open');
    current = null;
    if (!panel) return;
    panel.hidden = true;
    video.pause(); video.removeAttribute('src'); video.load();   // load nothing until the next time
  }
  // What the clip is: the widget, what it is drawn over if anything (so a clip of Fold is not taken for one of its base), the song.
  function caption(id) {
    const name = (x) => window.TOOLS?.find((t) => t.id === x)?.name ?? x;
    const { song, over } = plan[id] ?? {};
    const title = typeof SONGS === 'object' ? SONGS[song]?.title ?? song : song;
    return `${name(id)}${over ? `, drawn over ${name(over)}` : ''}, on ${title}`;
  }
  // Beside the card: to its right if there is room, else to its left, else under it; kept inside the window.
  function place(btn) {
    const r = btn.closest('.tool').getBoundingClientRect(), pw = panel.offsetWidth, ph = panel.offsetHeight, vw = innerWidth, vh = innerHeight;
    let x = r.right + 8;
    if (x + pw > vw) x = r.left - pw - 8;
    let y = r.top;
    if (x < 8) { x = Math.max(8, Math.min(r.left, vw - pw - 8)); y = r.bottom + 8; if (y + ph > vh) y = Math.max(8, r.top - ph - 8); }
    y = Math.max(8, Math.min(y, vh - ph - 8));
    panel.style.left = `${x}px`; panel.style.top = `${y}px`;
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
    const id = btn.closest('.tool').dataset.id;
    current = btn; btn.classList.add('open');
    cap.textContent = caption(id);
    video.src = `demos/${encodeURIComponent(id)}.mp4`;
    panel.hidden = false;
    place(btn);
    video.play().catch(() => {});
  }
  const leave = (btn) => { if (current === btn) hide(); };
  const keyboardFocused = (btn) => document.activeElement === btn && btn.matches(':focus-visible');

  function addButtons() {
    if (current && !current.isConnected) hide();   // the card was redrawn under it
    for (const card of box.children) {
      const id = card.dataset?.id;
      if (!id || !have.has(id) || card.querySelector(':scope > .demo-btn')) continue;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'demo-btn'; b.textContent = 'demo';
      b.title = 'Watch a few seconds of this widget on a song';
      // Pointer events, so a finger's lift (and the mouse events a browser makes up after it) never count as hover.
      b.addEventListener('pointerenter', (ev) => { if (ev.pointerType !== 'touch') { hovered = b; show(b); } });
      b.addEventListener('pointerleave', (ev) => { if (ev.pointerType !== 'touch') { hovered = null; leave(b); } });
      b.addEventListener('focus', () => { if (keyboardFocused(b)) show(b); });
      b.addEventListener('blur', () => leave(b));
      b.addEventListener('click', (ev) => { ev.stopPropagation(); show(b); });   // a tap, or Enter after Escape; never a toggle
      card.append(b);
    }
  }

  // Which widgets have a clip: the ones lab/demos.json names, whose file really is a video (a missing file may answer with the page).
  fetch('demos.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then(async (p) => {
    plan = p;
    await Promise.all(Object.keys(plan).map((id) => fetch(`demos/${encodeURIComponent(id)}.mp4`, { method: 'HEAD' })
      .then((r) => { if (r.ok && /^video\//.test(r.headers.get('content-type') || '')) have.add(id); }).catch(() => {})));
    if (!have.size) return;
    new MutationObserver(addButtons).observe(box, { childList: true });
    addButtons();
  });
  addEventListener('scroll', () => { if (!current) return; if (hovered === current || keyboardFocused(current)) place(current); else hide(); }, { passive: true });
  addEventListener('pointerdown', (ev) => { if (current && ev.target !== current) hide(); }, { capture: true, passive: true });   // a tap elsewhere
  addEventListener('keydown', (ev) => { if (ev.key === 'Escape') hide(); });
})();
