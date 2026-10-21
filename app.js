/* ==========================================================================
   ROMO PUBLICIDAD · Motor de la landing
   JavaScript vanilla, sin dependencias. Módulos:
   01 Utilidades · 02 Preloader · 03 Motor de scroll · 04 Revelados y textos
   05 Header/Menú · 06 Hero · 07 Secciones con scroll · 08 Interacciones
   ========================================================================== */
(() => {
    'use strict';

    /* ───────── 01 · UTILIDADES ───────── */
    const WA_NUMBER = '525510122744';
    const waUrl = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const mapRange = (v, a, b, c, d) => lerp(c, d, clamp((v - a) / (b - a)));
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const root = document.documentElement;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const mqDesktop = matchMedia('(min-width: 1024px)');
    const mqTablet = matchMedia('(min-width: 768px)');

    const S = { y: window.scrollY, vw: window.innerWidth, vh: window.innerHeight, v: 0 };

    // Enlaces de WhatsApp: el texto prellenado vive en data-wa
    $$('[data-wa]').forEach((a) => { a.href = waUrl(a.dataset.wa); });
    const yearEl = $('#year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    if (!location.hash && 'scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
        window.scrollTo(0, 0);
    }

    /* ───────── 02 · PRELOADER ───────── */
    function runPreloader() {
        const pl = $('#preloader');
        const finish = () => { root.classList.remove('is-loading'); root.classList.add('is-ready'); window.dispatchEvent(new Event('romo:ready')); };
        if (!pl) { finish(); return; }

        const arc = $('#plArc'), bar = $('#plBar'), num = $('#plNum'), txt = $('#plText');
        const phases = [[0, 'Calentando la prensa'], [28, 'Cargando diseños'], [58, 'Mezclando colores'], [84, 'Sublimando'], [100, '¡Listo!']];
        const MIN = reduce ? 350 : 2600;
        const critical = ['img/web/cintas-fila.webp', 'img/web/playera-sport.webp', 'img/web/gorras.webp', 'img/web/taza-nutriologo.webp'];
        const total = critical.length + 1;
        let loaded = 0, shown = 0, finished = false;
        const tick = () => { loaded++; };

        critical.forEach((src) => { const im = new Image(); im.onload = im.onerror = tick; im.src = src; });
        (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(tick, tick);
        setTimeout(() => { loaded = total; }, 6500); // red lenta: nunca bloquear la página

        const t0 = performance.now();
        root.classList.add('is-loading');

        const done = () => {
            if (finished) return;
            finished = true;
            pl.classList.add('is-done');
            setTimeout(() => pl.classList.add('is-open'), 420);
            setTimeout(finish, 780);
            setTimeout(() => pl.classList.add('is-gone'), 1900);
        };

        const frame = (now) => {
            const t = clamp((now - t0) / MIN);
            const target = Math.min(easeOut(t), loaded / total) * 100;
            shown = Math.abs(target - shown) < .25 ? target : lerp(shown, target, .12);
            const p = Math.round(shown);
            arc.style.strokeDashoffset = String(100 - shown);
            bar.style.transform = `scaleX(${shown / 100})`;
            num.textContent = String(p);
            for (let i = phases.length - 1; i >= 0; i--) { if (p >= phases[i][0]) { txt.textContent = phases[i][1]; break; } }
            if (shown >= 99.6 && t >= 1) done(); else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }

    /* ───────── 03 · MOTOR DE SCROLL ─────────
       Un solo bucle rAF. Cada "scrub" recibe un progreso 0-1 suavizado
       (inercia) para lograr ese movimiento lento y fluido al hacer scroll. */
    const scrubs = [];
    const marquees = [];

    function addScrub(el, fn, { mode = 'pass', ease = .1 } = {}) {
        if (!el) return;
        scrubs.push({ el, fn, mode, ease, cur: null, applied: -1 });
    }

    function measureMarquees() {
        marquees.forEach((m) => { m.half = m.track.scrollWidth / 2; });
    }

    let lastT = performance.now();
    let prevY = S.y;
    const loopHooks = [];

    function loop(now) {
        const dt = Math.min(64, now - lastT);
        lastT = now;
        const k = dt / 16.667;

        const y = window.scrollY;
        S.v = lerp(S.v, y - prevY, .12);
        prevY = y;
        S.y = y;

        // Fase de lectura (evita layout thrashing)
        const rects = new Array(scrubs.length);
        for (let i = 0; i < scrubs.length; i++) rects[i] = scrubs[i].el.getBoundingClientRect();

        // Fase de escritura
        for (let i = 0; i < scrubs.length; i++) {
            const s = scrubs[i], r = rects[i];
            let p;
            if (s.mode === 'pin') p = clamp(-r.top / Math.max(1, r.height - S.vh));
            else p = clamp((S.vh - r.top) / (S.vh + r.height));
            if (s.cur === null) s.cur = p;
            else s.cur += (p - s.cur) * (1 - Math.pow(1 - s.ease, k));
            if (Math.abs(s.cur - p) < .0004) s.cur = p;
            if (Math.abs(s.cur - s.applied) > .00025 || s.applied < 0) {
                s.applied = s.cur;
                s.fn(s.cur, r, p);
            }
        }

        // Marquesinas: la velocidad del scroll las acelera
        const boost = Math.min(14, Math.abs(S.v)) * .35;
        for (let i = 0; i < marquees.length; i++) {
            const m = marquees[i];
            if (!m.half) continue;
            m.x += m.dir * (.7 + boost) * k;
            if (m.x <= -m.half) m.x += m.half;
            if (m.x > 0) m.x -= m.half;
            m.track.style.transform = `translate3d(${m.x}px,0,0)`;
        }

        for (let i = 0; i < loopHooks.length; i++) loopHooks[i](now, k);
        requestAnimationFrame(loop);
    }

    /* ───────── 04 · REVELADOS Y TEXTOS ───────── */
    function splitWords(el, cls = 'w') {
        let idx = 0;
        el.setAttribute('aria-label', el.textContent.trim().replace(/\s+/g, ' '));
        const walk = (node) => {
            Array.from(node.childNodes).forEach((n) => {
                if (n.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    n.textContent.split(/(\s+)/).forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const wrap = document.createElement('span');
                        wrap.className = cls;
                        wrap.setAttribute('aria-hidden', 'true');
                        if (cls === 'w') {
                            const inner = document.createElement('i');
                            inner.textContent = part;
                            inner.style.setProperty('--wi', idx++);
                            wrap.appendChild(inner);
                        } else {
                            wrap.textContent = part;
                            idx++;
                        }
                        frag.appendChild(wrap);
                    });
                    n.replaceWith(frag);
                } else if (n.nodeType === 1) walk(n);
            });
        };
        walk(el);
        el.classList.add('is-split');
    }

    function initReveals() {
        $$('[data-split]').forEach((el) => splitWords(el));

        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (!e.isIntersecting) return;
                const el = e.target;
                el.classList.add('is-in');
                io.unobserve(el);
                if (el.hasAttribute('data-reveal')) {
                    // Al terminar, devolvemos el elemento a su CSS normal (hover/magnetismo sin lag)
                    const delay = 1500 + (parseFloat(getComputedStyle(el).getPropertyValue('--i')) || 0) * 90;
                    setTimeout(() => el.removeAttribute('data-reveal'), delay);
                }
            });
        }, { threshold: .14, rootMargin: '0px 0px -6% 0px' });

        $$('[data-reveal], [data-split]').forEach((el) => io.observe(el));
    }

    /* ───────── 05 · HEADER, MENÚ, PROGRESO ───────── */
    function initHeader() {
        const hdr = $('#hdr'), burger = $('#burger'), menu = $('#menu'), bar = $('#progressBar');
        let lastY = 0, acc = 0, menuOpen = false;

        const onScroll = () => {
            const y = S.y;
            hdr.classList.toggle('is-solid', y > 40);
            const dy = y - lastY;
            if (dy !== 0) acc = Math.sign(dy) === Math.sign(acc) ? acc + dy : dy; // distancia acumulada en la misma dirección
            if (!menuOpen) {
                if (y > 500 && acc > 60) hdr.classList.add('is-hidden');
                else if (acc < -24 || y < 240) hdr.classList.remove('is-hidden');
            }
            lastY = y;
            const max = document.documentElement.scrollHeight - S.vh;
            bar.style.transform = `scaleX(${max > 0 ? clamp(y / max) : 0})`;
        };
        loopHooks.push(onScroll);

        const openMenu = () => {
            menuOpen = true;
            menu.hidden = false;
            hdr.classList.remove('is-hidden');
            requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
            burger.setAttribute('aria-expanded', 'true');
            burger.setAttribute('aria-label', 'Cerrar menú');
            root.style.overflow = 'hidden';
        };
        const closeMenu = () => {
            menuOpen = false;
            menu.classList.remove('is-open');
            burger.setAttribute('aria-expanded', 'false');
            burger.setAttribute('aria-label', 'Abrir menú');
            root.style.overflow = '';
            setTimeout(() => { if (!menuOpen) menu.hidden = true; }, 950);
        };
        burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
        $$('a', menu).forEach((a) => a.addEventListener('click', closeMenu));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) { closeMenu(); burger.focus(); } });
        mqDesktop.addEventListener('change', (e) => { if (e.matches && menuOpen) closeMenu(); });

        // Enlace activo según la sección visible
        const links = $$('[data-nav]');
        const map = new Map();
        links.forEach((a) => { const sec = $(a.getAttribute('href')); if (sec) map.set(sec, a); });
        const spy = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (!e.isIntersecting) return;
                links.forEach((l) => l.classList.remove('is-active'));
                const l = map.get(e.target);
                if (l) l.classList.add('is-active');
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        map.forEach((_, sec) => spy.observe(sec));
    }

    /* ───────── 06 · HERO ───────── */

    // Sistema de partículas con red de conexiones (canvas 2D)
    function Particles(canvas, opts = {}) {
        const ctx = canvas.getContext('2d');
        const cfg = Object.assign({ density: 14000, min: 26, max: 90, link: 120, speed: .35, push: 130, mouse: true, colors: ['255,122,217', '200,25,154', '181,140,255', '255,255,255'] }, opts);
        let w = 0, h = 0, dpr = 1, parts = [], raf = 0, running = false, visible = false;
        const ptr = { x: -9999, y: -9999 };

        const build = () => {
            const n = Math.round(clamp((w * h) / cfg.density, cfg.min, cfg.max));
            parts = Array.from({ length: n }, () => {
                const a = Math.random() * Math.PI * 2, sp = (.25 + Math.random() * .75) * cfg.speed;
                return {
                    x: Math.random() * w, y: Math.random() * h,
                    bx: Math.cos(a) * sp, by: Math.sin(a) * sp, vx: 0, vy: 0,
                    r: .8 + Math.random() * 2.2, c: cfg.colors[(Math.random() * cfg.colors.length) | 0],
                    tw: Math.random() * Math.PI * 2
                };
            });
        };
        const resize = () => {
            const r = canvas.getBoundingClientRect();
            if (!r.width || !r.height) return;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = r.width; h = r.height;
            canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            build();
            if (!running) draw(0);
        };
        const draw = (t) => {
            ctx.clearRect(0, 0, w, h);
            const L = cfg.link;
            for (let i = 0; i < parts.length; i++) {
                const p = parts[i];
                if (running) {
                    const dx = p.x - ptr.x, dy = p.y - ptr.y, d2 = dx * dx + dy * dy;
                    if (cfg.mouse && d2 < cfg.push * cfg.push) {
                        const d = Math.sqrt(d2) || 1, f = (1 - d / cfg.push) * .9;
                        p.vx += (dx / d) * f; p.vy += (dy / d) * f;
                    }
                    p.vx *= .93; p.vy *= .93;
                    p.x += p.bx + p.vx; p.y += p.by + p.vy;
                    if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
                    if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
                }
                const a = .45 + Math.sin(t * .0016 + p.tw) * .35;
                ctx.beginPath();
                ctx.fillStyle = `rgba(${p.c},${clamp(a, .1, 1)})`;
                ctx.arc(p.x, p.y, p.r, 0, 6.2832);
                ctx.fill();
                if (p.r > 2) {
                    ctx.beginPath();
                    ctx.fillStyle = `rgba(${p.c},${clamp(a * .16, 0, .2)})`;
                    ctx.arc(p.x, p.y, p.r * 4, 0, 6.2832);
                    ctx.fill();
                }
                for (let j = i + 1; j < parts.length; j++) {
                    const q = parts[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
                    if (d2 < L * L) {
                        ctx.strokeStyle = `rgba(255,150,225,${(1 - Math.sqrt(d2) / L) * .3})`;
                        ctx.lineWidth = .8;
                        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
                    }
                }
            }
        };
        const frame = (t) => { draw(t); raf = requestAnimationFrame(frame); };
        const start = () => { if (running || reduce) return; running = true; raf = requestAnimationFrame(frame); };
        const stop = () => { running = false; cancelAnimationFrame(raf); };

        new ResizeObserver(resize).observe(canvas);
        new IntersectionObserver((e) => { visible = e[0].isIntersecting; visible && !document.hidden ? start() : stop(); }).observe(canvas);
        document.addEventListener('visibilitychange', () => { document.hidden ? stop() : (visible && start()); });
        if (cfg.mouse && finePointer) {
            window.addEventListener('pointermove', (e) => {
                const r = canvas.getBoundingClientRect();
                ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
            }, { passive: true });
        }
        resize();
    }

    function initHero() {
        const hero = $('#inicio');
        if (!hero) return;

        // Palabras que rotan en el titular
        const words = $$('.rot__w');
        if (words.length > 1 && !reduce) {
            let i = 0;
            setInterval(() => {
                if (document.hidden) return;
                const cur = words[i];
                i = (i + 1) % words.length;
                const nxt = words[i];
                cur.classList.remove('is-on'); cur.classList.add('is-off');
                nxt.classList.remove('is-off');
                requestAnimationFrame(() => nxt.classList.add('is-on'));
                setTimeout(() => cur.classList.remove('is-off'), 950);
            }, 2500);
        }

        // Parallax con el puntero (y deriva automática en táctiles)
        const layers = $$('.layer', hero).map((l) => ({ el: l, d: parseFloat(l.dataset.depth) || 20 }));
        let tx = 0, ty = 0, cx = 0, cy = 0, lastMove = -1e5;
        if (finePointer) {
            hero.addEventListener('pointermove', (e) => {
                const r = hero.getBoundingClientRect();
                tx = (e.clientX - r.left) / r.width - .5;
                ty = (e.clientY - r.top) / r.height - .5;
                lastMove = performance.now();
            }, { passive: true });
            hero.addEventListener('pointerleave', () => { lastMove = -1e5; });
        }
        if (!reduce) {
            loopHooks.push((now) => {
                if (S.y > S.vh * 1.2) return;
                if (now - lastMove > 2500) { tx = Math.sin(now / 2600) * .28; ty = Math.cos(now / 3100) * .22; }
                cx = lerp(cx, tx, .06); cy = lerp(cy, ty, .06);
                const sy = clamp(S.y / S.vh);
                layers.forEach((l) => {
                    l.el.style.transform = `translate3d(${(cx * l.d).toFixed(2)}px,${(cy * l.d - sy * l.d * 2.2).toFixed(2)}px,0)`;
                });
            });
        }

        // Al hacer scroll, el hero se aleja suavemente
        const grid = $('.hero__grid', hero);
        let hq = 0, hqApplied = -1;
        if (!reduce) loopHooks.push(() => {
            hq = lerp(hq, clamp(S.y / (S.vh * .85)), .12);
            if (Math.abs(hq - hqApplied) < .001) return;
            hqApplied = hq;
            grid.style.transform = `translate3d(0,${(hq * 70).toFixed(1)}px,0)`;
            grid.style.opacity = String((1 - hq * .9).toFixed(3));
        });

        const canvas = $('#heroCanvas');
        if (canvas) Particles(canvas, {});
        const fin = $('#finaleCanvas');
        if (fin) Particles(fin, { density: 16000, min: 24, max: 60, link: 100, speed: .3 });
    }

    /* ───────── 07 · SECCIONES CON SCROLL ───────── */

    // Marquesinas (cinta infinita impulsada por el scroll)
    function initMarquees() {
        if (reduce) return;
        $$('[data-marquee]').forEach((row) => {
            const track = $('.marquee__track', row);
            const dir = parseFloat(row.dataset.marquee) || -1;
            marquees.push({ track, dir, x: dir > 0 ? -1 : 0, half: 0 });
        });
        measureMarquees();
    }

    // Manifiesto: las palabras se encienden una a una con el scroll
    function initManifesto() {
        const el = $('#manifesto');
        if (!el) return;
        splitWords(el, 'sw');
        el.removeAttribute('aria-label');
        const ws = $$('.sw', el);
        const n = ws.length;
        if (reduce) { ws.forEach((w) => (w.style.opacity = '1')); return; }
        addScrub(el, (p) => {
            const q = mapRange(p, .22, .66, 0, 1) * n;
            for (let i = 0; i < n; i++) ws[i].style.opacity = (.15 + clamp(q - i) * .85).toFixed(3);
        }, { ease: .14 });
    }

    // Imagen que se abre a pantalla completa mientras haces scroll
    function initExpand() {
        const sec = $('[data-expand]');
        if (!sec) return;
        const track = $('.expand__track', sec);
        const stage = $('.expand__stage', sec);
        const bg = $$('.expand__bgtext span', sec);
        const nEl = $('.expand__n', sec), lbl = $('.expand__lbl', sec), hudN = $('.expand__hud-n', sec);
        const steps = ['Diseño', 'Calor', 'Resultado'];
        let idx = -1;

        const setStep = (i) => {
            if (i === idx) return;
            idx = i;
            bg.forEach((b, j) => b.classList.toggle('is-on', j === i));
            nEl.textContent = '0' + (i + 1);
            lbl.textContent = steps[i];
            hudN.textContent = '0' + (i + 1);
        };
        if (reduce) { setStep(2); return; } // diseño estático: ver CSS (prefers-reduced-motion)
        setStep(0);

        addScrub(track, (p) => {
            const mobile = S.vw < 768;
            const e = easeInOut(clamp(p / .5));
            stage.style.setProperty('--ix', lerp(mobile ? 13 : 29, 0, e).toFixed(2) + '%');
            stage.style.setProperty('--it', lerp(mobile ? 36 : 34, 0, e).toFixed(2) + '%');
            stage.style.setProperty('--ib', lerp(mobile ? 12 : 10, 0, e).toFixed(2) + '%');
            stage.style.setProperty('--rr', lerp(mobile ? 22 : 34, 0, e).toFixed(1) + 'px');
            stage.style.setProperty('--is', lerp(1.35, 1, e).toFixed(3));
            stage.style.setProperty('--io', (1 - clamp((p - .04) / .2)).toFixed(3));
            stage.style.setProperty('--so', lerp(.15, 1, clamp((p - .2) / .35)).toFixed(3));
            const co = clamp((p - .56) / .2);
            stage.style.setProperty('--co', co.toFixed(3));
            stage.style.setProperty('--ep', p.toFixed(3));
            sec.classList.toggle('is-cta', co > .6);
            setStep(p < .17 ? 0 : p < .42 ? 1 : 2);
        }, { mode: 'pin', ease: .085 }); // las variables CSS viven en el stage y el frame las hereda
    }

    // Productos: scroll horizontal anclado (escritorio) / swipe nativo (móvil)
    function initProducts() {
        const hs = $('#hs'), track = $('#hsTrack');
        if (!hs || !track) return;
        const bar = $('#hsBar'), num = $('#hsNum'), ghost = $('#ghost');
        const cards = $$('.pcard:not(.pcard--end)', track);
        let dist = 0, lastIdx = -1;
        const pinned = () => mqDesktop.matches && !reduce;

        const layout = () => {
            if (pinned()) {
                dist = Math.max(0, track.scrollWidth - S.vw);
                hs.style.setProperty('--hs-h', (dist + S.vh) + 'px');
            } else {
                hs.style.removeProperty('--hs-h');
                track.style.transform = '';
                if (ghost) ghost.style.setProperty('--gx', '0px');
            }
        };
        layout();
        window.addEventListener('romo:layout', layout);

        // Móvil: las tarjetas se apilan; la cubierta se encoge y se oscurece un poco
        const stack = $$('.pcard', track);
        let stackReset = true;
        if (!reduce) loopHooks.push(() => {
            if (mqDesktop.matches) {
                if (!stackReset) { stack.forEach((c) => { c.style.transform = ''; c.style.filter = ''; }); stackReset = true; }
                return;
            }
            const hr = hs.getBoundingClientRect();
            if (hr.bottom < -200 || hr.top > S.vh + 200) return;
            stackReset = false;
            const rects = stack.map((c) => c.getBoundingClientRect());
            for (let i = 0; i < stack.length - 1; i++) {
                const cur = rects[i], nxt = rects[i + 1];
                const cover = clamp(1 - (nxt.top - cur.top) / cur.height);
                stack[i].style.transform = `scale(${(1 - cover * .055).toFixed(4)})`;
                stack[i].style.filter = `brightness(${(1 - cover * .32).toFixed(3)})`;
            }
        });

        addScrub(hs, (p) => {
            if (!pinned()) return;
            const tx = -p * dist;
            track.style.transform = `translate3d(${tx.toFixed(1)}px,0,0)`;
            if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
            if (ghost) ghost.style.setProperty('--gx', (p * -S.vw * .5).toFixed(1) + 'px');
            const mid = -tx + S.vw * .55;
            let best = 0, bd = 1e9;
            cards.forEach((c, i) => {
                const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
                if (d < bd) { bd = d; best = i; }
            });
            if (best !== lastIdx && num) { lastIdx = best; num.textContent = '0' + (best + 1); }
        }, { mode: 'pin', ease: .09 });
    }

    // Proceso: la línea se llena y cada paso se enciende
    function initProcess() {
        const list = $('#steps');
        if (!list) return;
        const steps = $$('[data-step]', list);
        addScrub(list, (p, r) => {
            const line = clamp((S.vh * .62 - r.top) / (r.height * .9));
            list.style.setProperty('--sp', line.toFixed(3));
            steps.forEach((s) => {
                const sr = s.getBoundingClientRect();
                s.classList.toggle('is-active', sr.top < S.vh * .62);
            });
        }, { ease: .12 });
    }

    // Parallax de elementos decorativos y columnas de la galería
    function initParallax() {
        if (reduce) return;
        $$('[data-parallax]').forEach((el) => {
            const amt = parseFloat(el.dataset.parallax) || 40;
            addScrub(el.parentElement, (p) => { el.style.transform = `translate3d(0,${((p - .5) * amt * 4).toFixed(1)}px,0)`; });
        });
        const gal = $('#gal');
        if (gal) {
            const cols = $$('.gal__col[data-speed]', gal).map((c) => ({ el: c, s: parseFloat(c.dataset.speed) || 20 }));
            addScrub(gal, (p) => {
                if (!mqTablet.matches) { cols.forEach((c) => (c.el.style.transform = '')); return; }
                cols.forEach((c) => { c.el.style.transform = `translate3d(0,${((.5 - p) * c.s * 4).toFixed(1)}px,0)`; });
            }, { ease: .08 });
        }
        const mega = $('#mega');
        if (mega) {
            const span = $('span', mega);
            addScrub(mega, (p) => { span.style.setProperty('--my', ((1 - p) * 26 - 4).toFixed(1) + '%'); });
        }
    }

    /* ───────── 08 · INTERACCIONES ───────── */

    function initCounters() {
        const els = $$('.count');
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (!e.isIntersecting) return;
                io.unobserve(e.target);
                const el = e.target, to = parseFloat(el.dataset.count) || 0;
                if (reduce) { el.textContent = String(to); return; }
                const t0 = performance.now(), dur = 1800;
                const step = (now) => {
                    const t = clamp((now - t0) / dur);
                    el.textContent = String(Math.round(to * easeOut(t)));
                    if (t < 1) requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            });
        }, { threshold: .5 });
        els.forEach((el) => io.observe(el));
    }

    // Chat de WhatsApp animado en bucle (solo mientras es visible)
    function initChat() {
        const chat = $('#chat');
        if (!chat) return;
        const msgs = $$('.msg', chat);
        if (reduce) { msgs.forEach((m) => m.classList.add('is-in')); return; }
        let timers = [], on = false;
        const clear = () => { timers.forEach(clearTimeout); timers = []; };
        const play = () => {
            clear();
            msgs.forEach((m) => m.classList.remove('is-in'));
            msgs.forEach((m, i) => timers.push(setTimeout(() => m.classList.add('is-in'), 700 + i * 1250)));
            timers.push(setTimeout(() => { if (on) play(); }, 700 + msgs.length * 1250 + 3600));
        };
        new IntersectionObserver((e) => {
            on = e[0].isIntersecting;
            if (on) play(); else clear();
        }, { threshold: .35 }).observe(chat);
    }

    // Paneles de ocasiones: el activo se expande (escritorio)
    function initCases() {
        const row = $('#cases');
        if (!row) return;
        const items = $$('.case', row);
        const activate = (el) => { items.forEach((i) => i.classList.toggle('is-active', i === el)); };
        items.forEach((it) => {
            it.addEventListener('pointerenter', () => { if (mqDesktop.matches) activate(it); });
            it.addEventListener('focusin', () => activate(it));
            it.addEventListener('click', (e) => { if (!e.target.closest('a')) activate(it); });
        });
    }

    // FAQ: acordeón accesible
    function initFaq() {
        const items = $$('.acc__item');
        items.forEach((item) => {
            const btn = $('.acc__btn', item);
            btn.addEventListener('click', () => {
                const open = !item.classList.contains('is-open');
                items.forEach((o) => { o.classList.remove('is-open'); $('.acc__btn', o).setAttribute('aria-expanded', 'false'); });
                if (open) { item.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
            });
        });
        // Primera pregunta abierta por defecto
        const first = items[0];
        if (first) { first.classList.add('is-open'); $('.acc__btn', first).setAttribute('aria-expanded', 'true'); }
    }

    // Lightbox con <dialog>: teclado, swipe y clic fuera
    function initLightbox() {
        const dlg = $('#lightbox');
        if (!dlg || typeof dlg.showModal !== 'function') return;
        const img = $('#lbImg'), cap = $('#lbCap');
        const links = $$('[data-lightbox]');
        let cur = 0;

        const show = (i) => {
            cur = (i + links.length) % links.length;
            const a = links[cur];
            img.src = a.getAttribute('href');
            img.alt = $('img', a).alt;
            cap.textContent = a.dataset.caption || '';
        };
        const open = (i) => { show(i); dlg.showModal(); root.style.overflow = 'hidden'; };
        const close = () => { dlg.close(); };
        links.forEach((a, i) => a.addEventListener('click', (e) => { e.preventDefault(); open(i); }));
        $('#lbClose').addEventListener('click', close);
        $('#lbPrev').addEventListener('click', () => show(cur - 1));
        $('#lbNext').addEventListener('click', () => show(cur + 1));
        dlg.addEventListener('close', () => { root.style.overflow = ''; });
        dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
        dlg.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') show(cur - 1);
            if (e.key === 'ArrowRight') show(cur + 1);
        });
        let sx = 0;
        dlg.addEventListener('pointerdown', (e) => { sx = e.clientX; });
        dlg.addEventListener('pointerup', (e) => {
            const dx = e.clientX - sx;
            if (Math.abs(dx) > 60 && e.pointerType !== 'mouse') show(cur + (dx < 0 ? 1 : -1));
        });
    }

    // Formulario → WhatsApp con mensaje armado
    function initForm() {
        const form = $('#form');
        if (!form) return;
        const name = $('#f-name'), prodBox = $('#f-prod'), eName = $('#e-name'), eProd = $('#e-prod');
        const ok = $('#formOk'), okLink = $('#formLink'), btn = $('#submit');

        const setErr = (field, msgEl, msg) => { field.classList.toggle('has-err', !!msg); msgEl.textContent = msg || ''; };
        name.addEventListener('input', () => setErr(name.parentElement, eName, ''));
        $$('input[name="producto"]', form).forEach((c) => c.addEventListener('change', () => setErr(prodBox, eProd, '')));

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const nombre = name.value.trim();
            const prods = $$('input[name="producto"]:checked', form).map((i) => i.value);
            const qty = $('#f-qty').value, date = $('#f-date').value.trim(), msg = $('#f-msg').value.trim();

            setErr(name.parentElement, eName, nombre ? '' : 'Cuéntanos tu nombre para saber con quién hablamos.');
            setErr(prodBox, eProd, prods.length ? '' : 'Elige al menos un producto para cotizar.');
            if (!nombre) { name.focus(); return; }
            if (!prods.length) { $('input[name="producto"]', form).focus(); return; }

            const lines = [`Hola Romo Publicidad, soy ${nombre}.`, `Quiero cotizar: ${prods.join(', ')}.`];
            if (qty) lines.push(`Cantidad aproximada: ${qty}.`);
            if (date) lines.push(`Lo necesito para: ${date}.`);
            if (msg) lines.push(`Mi idea: ${msg}`);
            const url = waUrl(lines.join('\n'));

            okLink.href = url;
            ok.hidden = false;
            btn.querySelector('span').textContent = 'Abriendo WhatsApp…';
            window.open(url, '_blank', 'noopener');
            setTimeout(() => { btn.querySelector('span').textContent = 'Enviar mi idea por WhatsApp'; }, 4000);
        });
    }

    // Botones magnéticos y tarjetas con inclinación 3D (solo puntero fino)
    function initPointerFx() {
        if (!finePointer || reduce) return;

        $$('.magnetic').forEach((el) => {
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                const x = (e.clientX - (r.left + r.width / 2)) * .22;
                const y = (e.clientY - (r.top + r.height / 2)) * .32;
                el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
            });
            el.addEventListener('pointerleave', () => { el.style.transform = ''; });
        });

        $$('[data-tilt]').forEach((el) => {
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
                el.style.transform = `perspective(1000px) rotateY(${(px * 7).toFixed(2)}deg) rotateX(${(-py * 7).toFixed(2)}deg) translateZ(0)`;
            });
            el.addEventListener('pointerleave', () => { el.style.transform = ''; });
        });

        // Cursor personalizado
        const cur = $('#cursor');
        if (!cur) return;
        const ring = $('.cursor__ring', cur), dot = $('.cursor__dot', cur), label = $('span', ring);
        let mx = -100, my = -100, rx = -100, ry = -100;
        window.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; cur.classList.add('is-on'); }, { passive: true });
        document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
        loopHooks.push(() => {
            rx = lerp(rx, mx, .18); ry = lerp(ry, my, .18);
            dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
            ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
        });
        document.addEventListener('pointerover', (e) => {
            const view = e.target.closest('.gi');
            const link = e.target.closest('a, button, .chip-opt, .case, label');
            cur.classList.toggle('is-view', !!view);
            cur.classList.toggle('is-link', !!link && !view);
            if (view) label.textContent = 'Ver';
        });
    }

    // Botón flotante de WhatsApp: el globo aparece solo un momento
    function initWaFloat() {
        const wa = $('#waFloat');
        if (!wa) return;
        const pulse = (ms) => { wa.classList.add('show-tip'); setTimeout(() => wa.classList.remove('show-tip'), ms); };
        window.addEventListener('romo:ready', () => {
            setTimeout(() => pulse(6500), 5500);
            setTimeout(() => pulse(5000), 38000);
        }, { once: true });
    }

    /* ───────── ARRANQUE ───────── */
    function onResize() {
        S.vw = window.innerWidth;
        S.vh = window.innerHeight;
        measureMarquees();
        window.dispatchEvent(new Event('romo:layout'));
    }

    function init() {
        initReveals();
        initHeader();
        initHero();
        initMarquees();
        initManifesto();
        initExpand();
        initProducts();
        initProcess();
        initParallax();
        initCounters();
        initChat();
        initCases();
        initFaq();
        initLightbox();
        initForm();
        initPointerFx();
        initWaFloat();

        let rt;
        window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(onResize, 150); });
        window.addEventListener('load', () => { measureMarquees(); window.dispatchEvent(new Event('romo:layout')); });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measureMarquees(); window.dispatchEvent(new Event('romo:layout')); });
        mqDesktop.addEventListener('change', () => window.dispatchEvent(new Event('romo:layout')));

        requestAnimationFrame(loop);
        runPreloader();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
