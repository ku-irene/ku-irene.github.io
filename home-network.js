(() => {
  const hero = document.querySelector(".home-hero");
  const canvas = document.getElementById("home-network-canvas");
  if (!hero || !canvas) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let rafId = 0;
  let lastTime = 0;
  let packetTimer = 0;

  const orbits = [];
  const satellites = [];
  const uavs = [];
  const baseStations = [];
  const links = [];
  const packets = [];

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function setup() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = hero.clientWidth;
    height = hero.clientHeight;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildWorld();
  }

  function buildWorld() {
    orbits.length = 0;
    satellites.length = 0;
    uavs.length = 0;
    baseStations.length = 0;
    links.length = 0;
    packets.length = 0;

    const centerX = width * 0.5;
    const centerY = height * 0.33;
    const orbitCount = 4;
    const baseRx = width * 0.27;
    const baseRy = height * 0.11;

    for (let i = 0; i < orbitCount; i += 1) {
      const rx = baseRx + i * width * 0.075;
      const ry = baseRy + i * height * 0.04;
      const tilt = rand(-0.25, 0.25);
      orbits.push({
        cx: centerX,
        cy: centerY,
        rx,
        ry,
        tilt,
      });

      const satCount = i % 2 === 0 ? 4 : 3;
      for (let j = 0; j < satCount; j += 1) {
        satellites.push({
          id: `sat-${i}-${j}`,
          type: "sat",
          orbit: i,
          phase: (Math.PI * 2 * j) / satCount + rand(-0.25, 0.25),
          speed: rand(0.00008, 0.00016) * (i % 2 === 0 ? 1 : -1),
          x: 0,
          y: 0,
        });
      }
    }

    const bsY = height * 0.74;
    const bsMargin = width * 0.12;
    const bsGap = (width - bsMargin * 2) / 4;
    for (let i = 0; i < 5; i += 1) {
      baseStations.push({
        id: `bs-${i}`,
        type: "bs",
        x: bsMargin + bsGap * i + rand(-18, 18),
        y: bsY + rand(-12, 12),
        r: rand(58, 72),
      });
    }

    const uavCount = 4;
    for (let i = 0; i < uavCount; i += 1) {
      const x = rand(width * 0.18, width * 0.82);
      const y = rand(height * 0.47, height * 0.67);
      uavs.push({
        id: `uav-${i}`,
        type: "uav",
        x,
        y,
        vx: rand(-0.06, 0.06),
        vy: rand(-0.045, 0.045),
        targetX: x + rand(-120, 120),
        targetY: y + rand(-80, 80),
      });
    }
  }

  function updateSatellites(dt) {
    for (const sat of satellites) {
      const o = orbits[sat.orbit];
      sat.phase += sat.speed * dt;
      const c = Math.cos(sat.phase);
      const s = Math.sin(sat.phase);
      const x0 = o.rx * c;
      const y0 = o.ry * s;
      const ct = Math.cos(o.tilt);
      const st = Math.sin(o.tilt);
      sat.x = o.cx + x0 * ct - y0 * st;
      sat.y = o.cy + x0 * st + y0 * ct;
    }
  }

  function updateUavs(dt) {
    for (const u of uavs) {
      const dx = u.targetX - u.x;
      const dy = u.targetY - u.y;
      const d = Math.hypot(dx, dy) || 1;
      const accel = 0.00025 * dt;
      u.vx += (dx / d) * accel;
      u.vy += (dy / d) * accel;

      u.vx = clamp(u.vx, -0.085, 0.085);
      u.vy = clamp(u.vy, -0.07, 0.07);

      u.x += u.vx * dt;
      u.y += u.vy * dt;

      if (d < 12 || u.x < width * 0.14 || u.x > width * 0.86 || u.y < height * 0.42 || u.y > height * 0.72) {
        u.targetX = rand(width * 0.18, width * 0.82);
        u.targetY = rand(height * 0.45, height * 0.68);
      }
    }
  }

  function rebuildLinks() {
    links.length = 0;

    // Intra-orbit neighbor links.
    for (const oIdx in orbits) {
      const sats = satellites.filter((s) => s.orbit === Number(oIdx));
      if (sats.length < 2) continue;
      for (let i = 0; i < sats.length; i += 1) {
        const a = sats[i];
        const b = sats[(i + 1) % sats.length];
        links.push({ a, b, kind: "sat-sat", active: true });
      }
    }

    // UAV links: nearest satellite + nearest base station.
    for (const u of uavs) {
      let bestSat = null;
      let bestSatD = Infinity;
      for (const s of satellites) {
        const d = dist(u, s);
        if (d < bestSatD) {
          bestSatD = d;
          bestSat = s;
        }
      }
      if (bestSat && bestSatD < Math.min(width, height) * 0.42) {
        links.push({ a: u, b: bestSat, kind: "uav-sat", active: true });
      }

      let bestBs = null;
      let bestBsD = Infinity;
      for (const bs of baseStations) {
        const d = dist(u, bs);
        if (d < bestBsD) {
          bestBsD = d;
          bestBs = bs;
        }
      }
      if (bestBs && bestBsD < Math.min(width, height) * 0.3) {
        links.push({ a: u, b: bestBs, kind: "uav-bs", active: true });
      }
    }
  }

  function spawnPacket() {
    if (!links.length) return;
    const candidates = links.filter((l) => l.active);
    if (!candidates.length) return;
    const link = candidates[Math.floor(Math.random() * candidates.length)];
    packets.push({
      link,
      t: 0,
      speed: rand(0.006, 0.011),
      trail: [],
      done: false,
    });
  }

  function updatePackets(dt) {
    packetTimer += dt;
    if (packetTimer > 320) {
      spawnPacket();
      if (Math.random() > 0.45) spawnPacket();
      packetTimer = 0;
    }

    for (let i = packets.length - 1; i >= 0; i -= 1) {
      const p = packets[i];
      p.t += p.speed * dt;
      if (p.t >= 1) {
        p.done = true;
      }
      const t = clamp(p.t, 0, 1);
      const { a, b } = p.link;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      p.trail.push({ x, y, life: 1 });
      if (p.trail.length > 10) p.trail.shift();
      for (const tr of p.trail) tr.life *= 0.89;

      if (p.done) {
        packets.splice(i, 1);
      }
    }
  }

  function drawBackgroundGrid() {
    ctx.strokeStyle = "rgba(139, 0, 41, 0.06)";
    ctx.lineWidth = 1;
    const step = 44;
    for (let x = 0; x <= width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function drawOrbits() {
    for (const o of orbits) {
      ctx.save();
      ctx.translate(o.cx, o.cy);
      ctx.rotate(o.tilt);
      ctx.strokeStyle = "rgba(139, 0, 41, 0.18)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(0, 0, o.rx, o.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBaseStation(bs) {
    // Coverage area.
    ctx.strokeStyle = "rgba(139, 0, 41, 0.13)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bs.x, bs.y, bs.r, 0, Math.PI * 2);
    ctx.stroke();

    // Tower icon.
    ctx.strokeStyle = "rgba(139, 0, 41, 0.9)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bs.x, bs.y + 8);
    ctx.lineTo(bs.x, bs.y - 11);
    ctx.moveTo(bs.x - 6, bs.y + 8);
    ctx.lineTo(bs.x, bs.y + 2);
    ctx.lineTo(bs.x + 6, bs.y + 8);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(bs.x, bs.y - 11, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(139, 0, 41, 0.95)";
    ctx.fill();
  }

  function drawSatellite(s) {
    // Body.
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.phase + Math.PI / 2);
    ctx.fillStyle = "rgba(139, 0, 41, 0.95)";
    ctx.fillRect(-3, -3, 6, 6);
    // Panels.
    ctx.fillStyle = "rgba(139, 0, 41, 0.6)";
    ctx.fillRect(-10, -2, 5, 4);
    ctx.fillRect(5, -2, 5, 4);
    ctx.restore();
  }

  function drawUav(u) {
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.rotate(Math.atan2(u.vy, u.vx));
    ctx.strokeStyle = "rgba(139, 0, 41, 0.9)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-5, -3);
    ctx.lineTo(5, 0);
    ctx.lineTo(-5, 3);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawLinks() {
    for (const l of links) {
      const alpha = l.kind === "sat-sat" ? 0.16 : 0.2;
      ctx.strokeStyle = `rgba(139, 0, 41, ${alpha})`;
      ctx.lineWidth = l.kind === "sat-sat" ? 0.9 : 1.1;
      ctx.beginPath();
      ctx.moveTo(l.a.x, l.a.y);
      ctx.lineTo(l.b.x, l.b.y);
      ctx.stroke();
    }
  }

  function drawPackets() {
    for (const p of packets) {
      const { a } = p.link;
      const head = p.trail[p.trail.length - 1];
      if (!head) continue;

      // Beam from source to current head position.
      ctx.strokeStyle = `rgba(139, 0, 41, ${0.25 + (1 - p.t) * 0.5})`;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();

      for (let i = 1; i < p.trail.length; i += 1) {
        const p0 = p.trail[i - 1];
        const p1 = p.trail[i];
        ctx.strokeStyle = `rgba(139, 0, 41, ${0.75 * (i / p.trail.length) * p1.life})`;
        ctx.lineWidth = 1.45;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(139, 0, 41, 1)";
      ctx.beginPath();
      ctx.arc(head.x, head.y, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render() {
    ctx.clearRect(0, 0, width, height);
    drawBackgroundGrid();
    drawOrbits();
    drawLinks();
    for (const bs of baseStations) drawBaseStation(bs);
    for (const s of satellites) drawSatellite(s);
    for (const u of uavs) drawUav(u);
    drawPackets();
  }

  function frame(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min(32, ts - lastTime);
    lastTime = ts;

    updateSatellites(dt);
    updateUavs(dt);
    rebuildLinks();
    updatePackets(dt);
    render();
    rafId = requestAnimationFrame(frame);
  }

  setup();
  window.addEventListener("resize", setup);
  rafId = requestAnimationFrame(frame);

  window.addEventListener("beforeunload", () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", setup);
  });
})();
