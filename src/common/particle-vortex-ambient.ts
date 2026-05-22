// @ts-nocheck
/**
 * Shared Ambient Particle Float Background
 * Used in: forum.html, custom-tiles.html
 */
(function() {
    const canvas = document.getElementById('vortexCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, frame = 0;
    const particles = [];
    let isPageVisible = true; // Page Visibility tracking
    
    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
        particles.length = 0;
        for (let i = 0; i < 150; i++) {
            particles.push({
                angle: Math.random() * Math.PI * 2,
                radius: 20 + Math.random() * Math.max(W, H) * 0.6,
                z: Math.random(),
                speed: 0.001 + Math.random() * 0.003,
                size: 0.5 + Math.random() * 1.2,
                alpha: 0.1 + Math.random() * 0.3
            });
        }
    }

    function draw() {
        if (!isPageVisible) return; // Stop rendering when tab is hidden
        frame++;
        ctx.clearRect(0, 0, W, H);
        const cx = W * 0.5, cy = H * 0.5;

        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.6);
        g.addColorStop(0, 'rgba(255,255,255,0.03)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        for (const p of particles) {
            p.angle += p.speed;
            const perspective = 0.3 + p.z * 0.7;
            const projX = cx + Math.cos(p.angle) * p.radius * perspective;
            const projY = cy + Math.sin(p.angle) * p.radius * perspective * 0.6;
            
            ctx.beginPath();
            ctx.arc(projX, projY, p.size * perspective, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * perspective})`;
            ctx.fill();
        }
        requestAnimationFrame(draw);
    }
    
    window.addEventListener('resize', resize);

    // Page Visibility API: pause animation when tab is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            isPageVisible = false;
        } else {
            isPageVisible = true;
            requestAnimationFrame(draw); // Resume rendering
        }
    });

    resize();
    draw();
})();

