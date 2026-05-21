// @ts-nocheck
/**
 * Landing Page Dynamics (index.html)
 */
(function() {
    const slogans = [
        {
            html: '<span class="accent">The best</span> map&#8209;making<br>tool.',
            desc: 'Precision tile editor with 50+ environments, smart mirroring, real-time error detection, and every game mode supported. Build maps that dominate the competition.'
        },
        {
            html: 'Create, rate,<br><span class="accent">win!</span>',
            desc: 'Design your dream map, share it with the community, and climb to the top. Integrated gallery, one-click export, and powerful editing tools - all in your browser.'
        },
        {
            html: 'Build better<br><span class="accent">Maps.</span>',
            desc: 'Advanced map maker for Brawl Stars with full undo/redo, tile validation, auto-mirroring, and high-res PNG export. Your next map starts here.'
        },
        {
            html: 'Victory is just<br><span class="accent">around the corner.</span>',
            desc: 'Every great victory starts with a great map. Use our professional tools to craft, test, and share maps that make a difference. Coming soon: online map voting & leaderboards.'
        }
    ];

    const pick = slogans[Math.floor(Math.random() * slogans.length)];
    const sloganEl = document.getElementById('heroSlogan');
    const descEl = document.getElementById('heroDesc');
    
    // Global blinking cursor style
    const style = document.createElement('style');
    style.textContent = `
        @keyframes twBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .tw-cursor {
            display: inline-block;
            width: 0.6em;
            height: 1.1em;
            background-color: currentColor;
            vertical-align: middle;
            margin-left: 2px;
            margin-right: calc(-0.6em - 2px);
            animation: twBlink 1s step-end infinite;
            box-shadow: 0 0 6px currentColor;
        }
    `;
    document.head.appendChild(style);

    function applyTypewriter(element, htmlContent, speedMs, callback) {
        if (!element) return;
        element.innerHTML = htmlContent;
        
        const textNodes = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
            if (node.nodeValue.trim().length > 0 || node.nodeValue.includes('\n') || node.nodeValue.includes(' ')) {
                textNodes.push(node);
            }
        }
        
        const chars = [];
        textNodes.forEach(node => {
            const parent = node.parentNode;
            const text = node.nodeValue;
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < text.length; i++) {
                const span = document.createElement('span');
                span.textContent = text[i];
                span.style.fontFamily = 'inherit';
                span.style.fontSize = 'inherit';
                if (text[i].trim() !== '') {
                    span.style.visibility = 'hidden'; // using visibility avoids layout shifts better than opacity sometimes
                    chars.push(span);
                }
                fragment.appendChild(span);
            }
            parent.replaceChild(fragment, node);
        });

        const cursor = document.createElement('span');
        cursor.className = 'tw-cursor';
        // Initially place cursor at the very beginning of the element
        if (element.firstChild) {
            element.insertBefore(cursor, element.firstChild);
        } else {
            element.appendChild(cursor);
        }

        let index = 0;
        function reveal() {
            if (index < chars.length) {
                chars[index].style.visibility = 'visible';
                
                // Move cursor immediately after the newly revealed character
                chars[index].parentNode.insertBefore(cursor, chars[index].nextSibling);
                
                index++;
                // Randomize speed slightly for realistic typing
                const jitter = speedMs + (Math.random() * 20 - 10);
                setTimeout(reveal, jitter);
            } else {
                setTimeout(() => {
                    if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
                    if (callback) callback();
                }, 1000);
            }
        }
        setTimeout(reveal, 200);
    }

    if (sloganEl) {
        applyTypewriter(sloganEl, pick.html, 40, () => {
            if (descEl) {
                applyTypewriter(descEl, pick.desc, 20);
            }
        });
    } else if (descEl) {
        applyTypewriter(descEl, pick.desc, 20);
    }
})();
