// @ts-nocheck
/**
 * Map Maker UI Layout & Interaction Controller (editor.html)
 * Handles:
 * 1. Side panel tool list toggle.
 * 2. Copy to Clipboard sharing logic.
 * 3. Draggable floating settings panels system.
 * 4. Dynamic bottom-edge fold snap stretcher.
 * 5. Top Navigation auto-collapse and persistent state.
 */
(function() {
    // =============================================================
    // 1. SIDE PANEL TOGGLER
    // =============================================================
    const panelToggle = document.getElementById('panelToggle');
    const sidePanel = document.querySelector('.side-panel');

    function togglePanel() {
        if (sidePanel) {
            const isHidden = sidePanel.getAttribute('aria-hidden') === 'true';
            sidePanel.setAttribute('aria-hidden', !isHidden);
            if (panelToggle) {
                panelToggle.setAttribute('aria-label', isHidden ? 'Close tools' : 'Open tools');
            }
        }
    }

    if (panelToggle) panelToggle.addEventListener('click', togglePanel);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidePanel && sidePanel.getAttribute('aria-hidden') === 'false') {
            togglePanel();
        }
    });

    // =============================================================
    // 2. COPY LINK FUNCTIONALITY
    // =============================================================
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const mapLink = document.getElementById('mapLink');
    
    if (copyLinkBtn && mapLink) {
        copyLinkBtn.addEventListener('click', async () => {
            try {
                const linkText = mapLink.textContent || mapLink.href;
                await navigator.clipboard.writeText(linkText);
                triggerCopyFeedback();
            } catch (err) {
                console.error('Failed to copy link:', err);
                // Fallback for legacy environments
                const textArea = document.createElement('textarea');
                textArea.value = mapLink.textContent || mapLink.href;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                triggerCopyFeedback();
            }
        });

        function triggerCopyFeedback() {
            const originalTitle = copyLinkBtn.title;
            copyLinkBtn.title = 'Copied!';
            copyLinkBtn.style.background = 'var(--primary-color)';
            copyLinkBtn.style.color = 'white';
            setTimeout(() => {
                copyLinkBtn.title = originalTitle;
                copyLinkBtn.style.background = '';
                copyLinkBtn.style.color = '';
            }, 2000);
        }
    }

    // =============================================================
    // 3. DRAGGABLE PANEL SYSTEM WITH PERSISTENCE
    // =============================================================
    const panels = document.querySelectorAll('.draggable-panel');
    const resetBtn = document.getElementById('resetPanelsBtn');
    const offsets = new Map();
    let anyDragged = false;

    const savedLayout = JSON.parse(localStorage.getItem('cp_panel_layout') || '{}');

    panels.forEach(panel => {
        const handle = panel.querySelector('.panel-drag-handle');
        if (!handle) return;
        
        const panelId = panel.getAttribute('data-panel');
        let initialOffset = { x: 0, y: 0 };
        
        if (panelId && savedLayout[panelId]) {
            initialOffset = savedLayout[panelId];
            if (initialOffset.x !== 0 || initialOffset.y !== 0) {
                panel.style.transform = `translate(${initialOffset.x}px, ${initialOffset.y}px)`;
                anyDragged = true;
                if (resetBtn) resetBtn.classList.add('visible');
            }
        }

        let isDragging = false;
        let startX, startY, startOffsetX, startOffsetY;

        offsets.set(panel, initialOffset);

        handle.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            e.preventDefault();
            isDragging = true;
            panel.classList.add('is-dragging');

            const off = offsets.get(panel);
            startOffsetX = off.x;
            startOffsetY = off.y;
            startX = e.clientX;
            startY = e.clientY;
            let hasDraggedPanel = false;

            const onMove = ev => {
                if (!isDragging) return;
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDraggedPanel = true;
                const newX = startOffsetX + dx;
                const newY = startOffsetY + dy;
                offsets.set(panel, { x: newX, y: newY });
                panel.style.transform = `translate(${newX}px, ${newY}px)`;

                if (!anyDragged) {
                    anyDragged = true;
                    if (resetBtn) resetBtn.classList.add('visible');
                }
            };

            const onUp = (eUp) => {
                isDragging = false;
                panel.classList.remove('is-dragging');
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                
                if (hasDraggedPanel) {
                    const preventClick = (eClick) => {
                        eClick.stopPropagation();
                        eClick.preventDefault();
                        handle.removeEventListener('click', preventClick, true);
                    };
                    handle.addEventListener('click', preventClick, true);
                    setTimeout(() => handle.removeEventListener('click', preventClick, true), 50);
                }
                
                // Save layout on drop
                if (panelId) {
                    const currentLayout = JSON.parse(localStorage.getItem('cp_panel_layout') || '{}');
                    currentLayout[panelId] = offsets.get(panel);
                    localStorage.setItem('cp_panel_layout', JSON.stringify(currentLayout));
                }
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    });

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            panels.forEach(panel => {
                panel.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
                panel.style.transform = 'translate(0, 0)';
                offsets.set(panel, { x: 0, y: 0 });

                setTimeout(() => {
                    panel.style.transition = '';
                }, 550);
            });
            anyDragged = false;
            resetBtn.classList.remove('visible');
            localStorage.removeItem('cp_panel_layout');
        });
    }

    // =============================================================
    // 4. DESKTOP DYNAMICS & PERSISTENCE
    // =============================================================
    const hideBtn = document.getElementById('hideTopBarBtn');
    const showBtn = document.getElementById('showTopBarBtn');
    const controlsBar = document.querySelector('.controls-bar');
    const toggleBtn = document.getElementById('toggleSettingsBtn');
    const centerPanel = document.querySelector('.center-panel');

    // ─── STRETCHERSnap Snapper ───
    let resizeTimer;
    const updateEditorHeight = () => {
        if (window.innerWidth <= 1024 || !centerPanel) {
            if (centerPanel) centerPanel.style.minHeight = '';
            return;
        }
        const scrollY = window.scrollY;
        const rect = centerPanel.getBoundingClientRect();
        const absoluteTop = rect.top + scrollY;
        
        const targetHeight = Math.max(window.innerHeight - absoluteTop - 16, 550);
        centerPanel.style.minHeight = targetHeight + 'px';
    };

    const debouncedUpdate = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(updateEditorHeight, 100);
    };

    const observer = new MutationObserver(() => {
        setTimeout(updateEditorHeight, 50);
        setTimeout(updateEditorHeight, 350);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    window.addEventListener('resize', debouncedUpdate);
    window.addEventListener('load', updateEditorHeight);
    updateEditorHeight();

    // ─── NAVBAR TOGGLING ───
    if (hideBtn && showBtn) {
        hideBtn.onclick = () => {
            document.body.classList.add('top-bar-hidden');
            localStorage.setItem('cp_topbar_hidden', 'true');
        };
        
        showBtn.onclick = () => {
            document.body.classList.remove('top-bar-hidden');
            localStorage.removeItem('cp_topbar_hidden');
        };
        
        if (localStorage.getItem('cp_topbar_hidden') === 'true') {
            document.body.classList.add('top-bar-hidden');
        }
    }

    // ─── DRAGGABLE SETTINGS COLLAPSE MODULE ───
    if (controlsBar && toggleBtn) {
        let isDragging = false;
        let dragStartX, dragStartY;
        let initialLeft, initialTop;
        let hasDragged = false;
        let storedLeft = null;
        let storedTop = null;

        toggleBtn.addEventListener('click', () => {
            setTimeout(() => {
                if (controlsBar.classList.contains('collapsed')) {
                    if (storedLeft !== null && storedTop !== null) {
                        controlsBar.style.right = 'auto';
                        controlsBar.style.left = storedLeft;
                        controlsBar.style.top = storedTop;
                    }
                } else {
                    controlsBar.style.left = '';
                    controlsBar.style.top = '';
                    controlsBar.style.right = '';
                }
                updateEditorHeight();
                setTimeout(updateEditorHeight, 350);
            }, 20);
        });

        toggleBtn.addEventListener('mousedown', (e) => {
            if (window.innerWidth <= 1024 || !controlsBar.classList.contains('collapsed')) return;
            
            e.preventDefault();
            isDragging = true;
            hasDragged = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;

            const rect = controlsBar.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            const onMouseMove = (ev) => {
                if (!isDragging) return;
                const dx = ev.clientX - dragStartX;
                const dy = ev.clientY - dragStartY;

                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                    hasDragged = true;
                }

                const nextLeft = initialLeft + dx;
                const nextTop = initialTop + dy;

                controlsBar.style.right = 'auto';
                controlsBar.style.left = nextLeft + 'px';
                controlsBar.style.top = nextTop + 'px';
            };

            const onMouseUp = () => {
                isDragging = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                if (hasDragged) {
                    storedLeft = controlsBar.style.left;
                    storedTop = controlsBar.style.top;
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Intercept toggling logic if the click events were a byproduct of drag-end
        toggleBtn.addEventListener('click', (e) => {
            if (hasDragged) {
                e.stopImmediatePropagation();
                e.preventDefault();
                hasDragged = false;
            }
        }, true);
    }

    // =============================================================
    // 5. PANEL OPACITY SLIDER CONTROLLER
    // =============================================================
    const opacitySlider = document.getElementById('panelOpacity');
    if (opacitySlider) {
        // Initialize from current slider value
        document.documentElement.style.setProperty('--panel-opacity', opacitySlider.value);

        opacitySlider.addEventListener('input', (e) => {
            document.documentElement.style.setProperty('--panel-opacity', e.target.value);
            document.body.classList.add('opacity-adjusting');
        });

        const removePreviewClass = () => {
            document.body.classList.remove('opacity-adjusting');
        };

        opacitySlider.addEventListener('change', removePreviewClass);
        opacitySlider.addEventListener('mouseup', removePreviewClass);
        opacitySlider.addEventListener('touchend', removePreviewClass);
    }

    // =============================================================
    // 6. TILES PANEL SIZE PERSISTENCE
    // =============================================================
    const tilesPanel = document.querySelector('.e1-tiles-panel');
    if (tilesPanel) {
        const savedSize = JSON.parse(localStorage.getItem('cp_tiles_size') || 'null');
        if (savedSize && savedSize.width && savedSize.height) {
            tilesPanel.style.width = savedSize.width + 'px';
            tilesPanel.style.height = savedSize.height + 'px';
        }
        
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(entries => {
                for (let entry of entries) {
                    if (entry.target === tilesPanel) {
                        localStorage.setItem('cp_tiles_size', JSON.stringify({
                            width: entry.contentRect.width,
                            height: entry.contentRect.height
                        }));
                    }
                }
            });
            ro.observe(tilesPanel);
        }
    }

    // =============================================================
    // 7. MOBILE INITIALIZATION
    // =============================================================
    localStorage.removeItem('cp_topbar_hidden');
    if (window.innerWidth <= 768) {
        const stToggle = document.getElementById('sortTilesToggle') as HTMLInputElement;
        if (stToggle) {
            stToggle.checked = false;
        }
    }
})();
