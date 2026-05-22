// @ts-nocheck
/**
 * Shared 3D Particle Vortex Background
 * Used in: index.html, dashboard.html, explore.html
 */
(function() {
    const canvas = document.getElementById('vortexCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H;
    let mouseX = 0.5, mouseY = 0.5;
    let frame = 0;
    let viewZoom = 1.0; 
    const MIN_ZOOM = 0.3;
    const MAX_ZOOM = 3.0;

    // Adaptive particle count based on device capability
    function getAdaptiveParticleCount() {
        const cores = navigator.hardwareConcurrency || 2;
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isMobile || cores <= 2) return 200;
        if (cores <= 4) return 400;
        return 500;
    }

    const PARTICLE_COUNT  = getAdaptiveParticleCount();
    const GRID_TILE_COUNT = 40;
    const VORTEX_CX_RATIO = 0.55;
    const VORTEX_CY_RATIO = 0.48;

    const particles  = [];
    const gridTiles  = [];
    let isPageVisible = true; // Page Visibility tracking

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
        initParticles();
        initGridTiles();
    }

    function initParticles() {
        particles.length = 0;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push(createParticle());
        }
    }

    function createParticle() {
        const angle  = Math.random() * Math.PI * 2;
        const radius = 20 + Math.random() * Math.max(W, H) * 0.6;
        const z      = Math.random();
        const speed  = 0.002 + Math.random() * 0.009;
        const sizeRoll = Math.random();
        let baseSize;
        if (sizeRoll < 0.6)      baseSize = 0.2 + Math.random() * 0.5;
        else if (sizeRoll < 0.85) baseSize = 0.5 + Math.random() * 1.0;
        else if (sizeRoll < 0.95) baseSize = 1.0 + Math.random() * 1.2;
        else                      baseSize = 1.5 + Math.random() * 1.5;

        return {
            angle, radius, z, speed, baseRadius: radius, size: baseSize,
            alpha: 0.06 + z * 0.45, drift: Math.random() * Math.PI * 2,
            driftAmp: 5 + Math.random() * 35, driftSpeed: 0.0004 + Math.random() * 0.002,
            trail: [], maxTrail: Math.floor(1 + z * 5)
        };
    }

    function initGridTiles() {
        gridTiles.length = 0;
        for (let i = 0; i < GRID_TILE_COUNT; i++) {
            gridTiles.push(createGridTile());
        }
    }

    function createGridTile() {
        return {
            x: Math.random() * W * 1.4 - W * 0.2, y: H + 50 + Math.random() * H,
            size: 10 + Math.random() * 30, speed: 0.25 + Math.random() * 0.6,
            alpha: 0.015 + Math.random() * 0.04, rotation: -35 + Math.random() * 10,
            rotSpeed: (Math.random() - 0.5) * 0.1, drift: Math.random() * 0.3 + 0.1
        };
    }

    function draw() {
        if (!isPageVisible) return; // Stop rendering when tab is hidden
        frame++;
        const time = frame * 16;
        ctx.clearRect(0, 0, W, H);

        const baseCx = W * VORTEX_CX_RATIO + (mouseX - 0.5) * 80;
        const baseCy = H * VORTEX_CY_RATIO + (mouseY - 0.5) * 50;

        ctx.save();
        ctx.translate(baseCx, baseCy);
        ctx.scale(viewZoom, viewZoom);
        ctx.translate(-baseCx, -baseCy);

        drawEpicenter(baseCx, baseCy, time);
        drawGridTiles(time);
        drawParticles(baseCx, baseCy, time);

        ctx.restore();
        requestAnimationFrame(draw);
    }

    function drawEpicenter(cx, cy, time) {
        const pulse = Math.sin(time * 0.00015) * 0.3 + 0.7;
        const pulse2 = Math.sin(time * 0.0003 + 1) * 0.2 + 0.8;

        const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5);
        g1.addColorStop(0, `rgba(255,255,255,${0.04 * pulse})`);
        g1.addColorStop(0.15, `rgba(230,235,255,${0.025 * pulse})`);
        g1.addColorStop(0.4, `rgba(180,190,230,${0.01 * pulse})`);
        g1.addColorStop(1, 'transparent');
        ctx.fillStyle = g1;
        ctx.fillRect(cx - W, cy - H, W * 2, H * 2);

        const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
        g2.addColorStop(0, `rgba(255,255,255,${0.12 * pulse2})`);
        g2.addColorStop(0.3, `rgba(255,255,255,${0.05 * pulse2})`);
        g2.addColorStop(0.6, `rgba(220,225,255,${0.02 * pulse2})`);
        g2.addColorStop(1, 'transparent');
        ctx.fillStyle = g2;
        ctx.fillRect(cx - 200, cy - 200, 400, 400);

        const g3 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 25);
        g3.addColorStop(0, `rgba(255,255,255,${0.2 * pulse})`);
        g3.addColorStop(0.5, `rgba(255,255,255,${0.05 * pulse})`);
        g3.addColorStop(1, 'transparent');
        ctx.fillStyle = g3;
        ctx.fillRect(cx - 30, cy - 30, 60, 60);
    }

    function drawGridTiles(time) {
        for (const tile of gridTiles) {
            tile.y -= tile.speed; tile.x += tile.drift; tile.rotation += tile.rotSpeed;
            if (tile.y < -80) {
                tile.y = H + 50 + Math.random() * 100; tile.x = Math.random() * W * 1.4 - W * 0.2;
                tile.alpha = 0.015 + Math.random() * 0.04;
            }
            ctx.save();
            ctx.translate(tile.x, tile.y);
            ctx.rotate((tile.rotation * Math.PI) / 180);
            ctx.strokeStyle = `rgba(140, 150, 255, ${tile.alpha})`;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(-tile.size / 2, -tile.size / 2, tile.size, tile.size);
            if (tile.alpha > 0.03) {
                ctx.fillStyle = `rgba(140, 150, 255, ${tile.alpha * 0.3})`;
                ctx.fillRect(-tile.size / 2, -tile.size / 2, tile.size, tile.size);
            }
            ctx.restore();
        }
    }

    function drawParticles(cx, cy, time) {
        for (const p of particles) {
            p.angle += p.speed * (0.7 + p.z * 0.6);
            const breathe = Math.sin(time * p.driftSpeed + p.drift) * p.driftAmp;
            const r = p.baseRadius + breathe;

            p.baseRadius -= p.speed * 0.25;
            if (p.baseRadius < 10) {
                p.baseRadius = 20 + Math.random() * Math.max(W, H) * 0.6;
                p.angle = Math.random() * Math.PI * 2; p.z = Math.random();
                const sizeRoll = Math.random();
                if (sizeRoll < 0.6) p.size = 0.2 + Math.random() * 0.5;
                else if (sizeRoll < 0.85) p.size = 0.5 + Math.random() * 1.0;
                else if (sizeRoll < 0.95) p.size = 1.0 + Math.random() * 1.2;
                else p.size = 1.5 + Math.random() * 1.5;
                p.alpha = 0.06 + p.z * 0.45; p.maxTrail = Math.floor(1 + p.z * 5); p.trail = [];
            }

            const perspective = 0.25 + p.z * 0.75;
            const projX = cx + Math.cos(p.angle) * r * perspective;
            const projY = cy + Math.sin(p.angle) * r * perspective * 0.6;
            const depthScale = 0.25 + p.z * 0.75;
            const drawSize = p.size * depthScale;
            const drawAlpha = p.alpha * depthScale;

            p.trail.unshift({ x: projX, y: projY });
            if (p.trail.length > p.maxTrail) p.trail.pop();

            for (let t = 1; t < p.trail.length; t++) {
                const tp = p.trail[t];
                const ta = drawAlpha * (1 - t / p.trail.length) * 0.4;
                const ts = drawSize * (1 - t / p.trail.length * 0.6);
                ctx.beginPath(); ctx.arc(tp.x, tp.y, ts, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${Math.max(0, ta)})`; ctx.fill();
            }

            ctx.beginPath(); ctx.arc(projX, projY, drawSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${drawAlpha})`; ctx.fill();

            if (p.z > 0.75 && drawSize > 1.2) {
                ctx.beginPath(); ctx.arc(projX, projY, drawSize * 3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${drawAlpha * 0.05})`; ctx.fill();
            }
        }
    }

    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', e => {
        mouseX = e.clientX / window.innerWidth;
        mouseY = e.clientY / window.innerHeight;
    });

    // Page Visibility API: pause animation when tab is hidden to save CPU/GPU
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            isPageVisible = false;
        } else {
            isPageVisible = true;
            requestAnimationFrame(draw); // Resume rendering
        }
    });

    // Scroll wheel zoom - ONLY if explicitly enabled by the HTML element
    if (canvas.dataset.allowZoom === 'true') {
        window.addEventListener('wheel', e => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.08 : 0.93;
            viewZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewZoom * factor));
        }, { passive: false });
    }

    resize();
    draw();
})();
