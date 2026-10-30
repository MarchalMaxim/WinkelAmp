// The casket from round 1 (melt + drips + chord cuts), unchanged; being built into the app now.
(() => {
  const snap = document.createElement('canvas'); snap.width = 1280; snap.height = 720; const sg = snap.getContext('2d');
  let drips = [], scars = [], shake = 0, time = 0;
  function cut(x, vel) {
    const g = x.g; sg.drawImage(x.canvas, 0, 0);
    const ang = x.rnd(-1.2, 1.2) + (Math.random() < 0.5 ? 0 : Math.PI / 2), cx = x.rnd(x.W * 0.25, x.W * 0.75), cy = x.rnd(x.H * 0.25, x.H * 0.75);
    const dx = Math.cos(ang), dy = Math.sin(ang), d = 14 + (vel - 90) * 2.2;
    for (const side of [1, -1]) {
      g.save(); g.beginPath(); const nx = -dy * side, ny = dx * side;
      g.moveTo(cx - dx * 3000, cy - dy * 3000); g.lineTo(cx + dx * 3000, cy + dy * 3000);
      g.lineTo(cx + dx * 3000 + nx * 3000, cy + dy * 3000 + ny * 3000); g.lineTo(cx - dx * 3000 + nx * 3000, cy - dy * 3000 + ny * 3000);
      g.closePath(); g.clip(); g.drawImage(snap, dx * d * side, dy * d * side); g.restore();
    }
    scars.push({ cx, cy, dx, dy, age: 0 }); shake = 14;
  }
  TOOLS.push({
    id: 'casket', name: 'The casket', tag: 'building into the app',
    blurb: 'The picture melts, paint drips from the top, and big chords slash cuts through everything. Mix it with other tools to see what it cuts.',
    reset() { drips = []; scars = []; shake = 0; },
    onChord(ch, x) {
      for (const n of ch.notes) if (Math.random() < 0.5) drips.push({ x: x.rnd(0, x.W), y: -10, w: x.rnd(6, 26) * n.v / 100, v: x.rnd(80, 260), red: Math.random() < 0.7 });
      if (ch.vel >= 92 && ch.notes.length >= 3) cut(x, ch.vel);
    },
    frame(x) {
      const g = x.g; time += x.dt;
      sg.drawImage(x.canvas, 0, 0);
      for (let i = 0; i < x.W; i += 10) {
        const sp = (1 + Math.sin(i * 0.037 + time * 0.7) * 0.5 + Math.sin(i * 0.11) * 0.5) * 2.2 * x.dt * 60;
        g.drawImage(snap, i, 0, 10, x.H, i, sp, 10, x.H);
      }
      if (shake > 0.3) { g.translate(x.rnd(-shake, shake), x.rnd(-shake, shake)); shake *= 0.86; }
      for (const d of drips) {
        d.y += d.v * x.dt; d.v *= 1 + 0.6 * x.dt;
        g.fillStyle = d.red ? 'rgba(120,8,10,0.85)' : 'rgba(150,160,40,0.7)';
        g.fillRect(d.x - d.w / 2, d.y - 40, d.w, 40); g.beginPath(); g.arc(d.x, d.y, d.w / 2, 0, Math.PI * 2); g.fill();
      }
      drips = drips.filter((d) => d.y < x.H + 60);
      for (const s of scars) {
        s.age += x.dt; const al = Math.max(0, 1 - s.age / 0.9);
        g.strokeStyle = `rgba(235,240,170,${al})`; g.lineWidth = 1 + 5 * al;
        g.beginPath(); g.moveTo(s.cx - s.dx * 3000, s.cy - s.dy * 3000); g.lineTo(s.cx + s.dx * 3000, s.cy + s.dy * 3000); g.stroke();
      }
      scars = scars.filter((s) => s.age < 0.9);
    },
  });
})();
