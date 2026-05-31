// @ts-nocheck
import { showSharpnessDownload } from '../core/sharpness-modal.js';
import { drawStaticMapPreview } from '../utils/canvas-drawer.js';
import { supabase } from '../core/supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    const modeSelector = document.getElementById('modeSelector');
    const studioEditor = document.getElementById('studioEditor');
    const backBtn = document.getElementById('backToModesBtn');
    const exportBtn = document.getElementById('exportArtBtn');
    const titleText = document.getElementById('studioTitle');
    const toolbar = document.getElementById('studioToolbar');
    const canvas = document.getElementById('artCanvas');
    const ctx = canvas.getContext('2d');
    const propertiesPanel = document.getElementById('studioProperties');

    let currentMode = '';
    // Canvas State
    let elements = []; // { type: 'image'|'text'|'arrow', x, y, ... }
    let selectedElement = null;
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    
    // Canvas settings
    let canvasBgColor = '#0a0a0f';

    // Base resolution for high-quality export
    const CANVAS_WIDTH = 1920;
    const CANVAS_HEIGHT = 1080;

    function resetCanvas() {
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        elements = [];
        selectedElement = null;
        renderCanvas();
        renderPropertiesPanel();
    }

    // Mode Switching
    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
            currentMode = card.getAttribute('data-mode');
            modeSelector.style.display = 'none';
            studioEditor.style.display = 'flex';
            
            if (currentMode === 'collage') {
                canvasBgColor = '#0a0a0f';
            } else if (currentMode === 'paths') {
                canvasBgColor = '#05050a';
            } else if (currentMode === 'showcase') {
                canvasBgColor = '#1e1b4b'; // deep purple
            }
            
            resetCanvas();
            setupToolbar();
        });
    });

    backBtn.addEventListener('click', () => {
        studioEditor.style.display = 'none';
        modeSelector.style.display = 'grid';
    });

    function setupToolbar() {
        // Clear old toolbar controls (keep select map button)
        const selectBtn = toolbar.querySelector('#selectMapBtn');
        toolbar.innerHTML = '';
        if (selectBtn) {
            toolbar.appendChild(selectBtn);
            selectBtn.onclick = openMapPicker;
        }

        if (currentMode === 'collage') {
            titleText.textContent = 'Collage Maker';
            const addTextBtn = document.createElement('button');
            addTextBtn.className = 'toolbar-btn';
            addTextBtn.innerHTML = '<span>📝</span> Add Text';
            addTextBtn.onclick = () => {
                const textEl = {
                    type: 'text',
                    text: 'Your Text Here',
                    x: CANVAS_WIDTH / 2 - 200,
                    y: CANVAS_HEIGHT / 2,
                    fontSize: 80,
                    color: '#ffffff',
                    font: 'bold 80px Inter, sans-serif'
                };
                elements.push(textEl);
                selectedElement = textEl;
                renderCanvas();
                renderPropertiesPanel();
            };
            toolbar.appendChild(addTextBtn);
        }
        else if (currentMode === 'paths') {
            titleText.textContent = 'Strategy Paths';
            const drawModeBtn = document.createElement('button');
            drawModeBtn.className = 'toolbar-btn active';
            drawModeBtn.innerHTML = '<span>✏️</span> Draw Arrows';
            toolbar.appendChild(drawModeBtn);

            const clearBtn = document.createElement('button');
            clearBtn.className = 'toolbar-btn';
            clearBtn.innerHTML = '<span>🗑️</span> Clear All';
            clearBtn.onclick = () => {
                elements = elements.filter(e => e.type === 'image'); // keep map
                selectedElement = null;
                renderCanvas();
                renderPropertiesPanel();
            };
            toolbar.appendChild(clearBtn);
        }
        else if (currentMode === 'showcase') {
            titleText.textContent = 'Map Showcase';
            // Setup default showcase template
            elements = [
                {
                    type: 'text',
                    text: 'Map Title...',
                    x: 100,
                    y: CANVAS_HEIGHT / 2 - 50,
                    fontSize: 120,
                    color: '#ffffff',
                    font: 'bold 120px sans-serif',
                    isTitle: true
                },
                {
                    type: 'text',
                    text: 'Description...',
                    x: 100,
                    y: CANVAS_HEIGHT / 2 + 50,
                    fontSize: 50,
                    color: '#a78bfa',
                    font: '50px sans-serif',
                    isDesc: true
                }
            ];
            renderCanvas();
            renderPropertiesPanel();
        }
    }

    function renderPropertiesPanel() {
        if (!propertiesPanel) return;

        if (!selectedElement) {
            propertiesPanel.innerHTML = `
                <div class="prop-group">
                    <label>Canvas Properties</label>
                    <div style="color: rgba(255,255,255,0.4); font-size: 0.85rem; margin-bottom: 1rem;">
                        Click on any element in the workspace to edit it.
                    </div>
                </div>
                ${(currentMode === 'collage' || currentMode === 'showcase') ? `
                <div class="prop-group">
                    <label>Background Color</label>
                    <input type="color" class="prop-color-picker" id="canvasBgProp" value="${canvasBgColor}">
                </div>
                ` : ''}
            `;
            const bgInput = document.getElementById('canvasBgProp');
            if (bgInput) {
                bgInput.onchange = (e) => {
                    canvasBgColor = e.target.value;
                    renderCanvas();
                };
            }
            return;
        }

        if (selectedElement.type === 'text') {
            propertiesPanel.innerHTML = `
                <div class="prop-group">
                    <label>Text Content</label>
                    <input type="text" class="prop-input" id="textContentProp" value="${selectedElement.text}">
                </div>
                <div class="prop-group">
                    <label>Font Size</label>
                    <input type="number" class="prop-input" id="textSizeProp" value="${selectedElement.fontSize}" min="10" max="400">
                </div>
                <div class="prop-group">
                    <label>Text Color</label>
                    <input type="color" class="prop-color-picker" id="textColorProp" value="${selectedElement.color}">
                </div>
                <button class="prop-btn" id="deleteElementBtn" style="margin-top: auto;">Delete Text</button>
            `;
            
            document.getElementById('textContentProp').oninput = (e) => {
                selectedElement.text = e.target.value;
                renderCanvas();
            };
            document.getElementById('textSizeProp').oninput = (e) => {
                selectedElement.fontSize = parseInt(e.target.value) || 20;
                updateFontString(selectedElement);
                renderCanvas();
            };
            document.getElementById('textColorProp').oninput = (e) => {
                selectedElement.color = e.target.value;
                renderCanvas();
            };
        } else if (selectedElement.type === 'image') {
            propertiesPanel.innerHTML = `
                <div class="prop-group">
                    <label>Map Properties</label>
                    <div style="color: rgba(255,255,255,0.4); font-size: 0.85rem;">
                        Drag the map to move it around the canvas.
                    </div>
                </div>
                <button class="prop-btn" id="deleteElementBtn" style="margin-top: auto;">Remove Map</button>
            `;
        } else if (selectedElement.type === 'arrow') {
            propertiesPanel.innerHTML = `
                <div class="prop-group">
                    <label>Arrow Properties</label>
                    <div style="color: rgba(255,255,255,0.4); font-size: 0.85rem;">
                        Drag the arrow to move it. Use delete key to remove.
                    </div>
                </div>
                <div class="prop-group">
                    <label>Arrow Color</label>
                    <input type="color" class="prop-color-picker" id="arrowColorProp" value="${selectedElement.color || '#f43f5e'}">
                </div>
                <button class="prop-btn" id="deleteElementBtn" style="margin-top: auto;">Delete Arrow</button>
            `;
            document.getElementById('arrowColorProp').oninput = (e) => {
                selectedElement.color = e.target.value;
                renderCanvas();
            };
        }

        const delBtn = document.getElementById('deleteElementBtn');
        if (delBtn) {
            delBtn.onclick = () => {
                elements = elements.filter(e => e !== selectedElement);
                selectedElement = null;
                renderCanvas();
                renderPropertiesPanel();
            };
        }
    }

    function updateFontString(el) {
        let weight = el.isTitle || el.font.includes('bold') ? 'bold ' : '';
        let family = el.font.includes('Inter') ? 'Inter, sans-serif' : 'sans-serif';
        if (currentMode === 'collage') family = 'Inter, sans-serif';
        el.font = `${weight}${el.fontSize}px ${family}`;
    }

    function handleMapSelection(dataUrl) {
        if (currentMode === 'paths' || currentMode === 'showcase') {
            elements = elements.filter(el => el.type !== 'image');
        }

        const img = new Image();
        img.onload = () => {
            let scale = 1;
            let targetX = 0;
            let targetY = 0;

            if (currentMode === 'showcase') {
                scale = Math.min((CANVAS_WIDTH / 2 - 100) / img.width, (CANVAS_HEIGHT - 200) / img.height);
                targetX = CANVAS_WIDTH - (img.width * scale) - 100;
                targetY = (CANVAS_HEIGHT - (img.height * scale)) / 2;
            }
            else {
                if (img.height > CANVAS_HEIGHT - 100) {
                    scale = (CANVAS_HEIGHT - 100) / img.height;
                }
                targetX = (CANVAS_WIDTH - (img.width * scale)) / 2 + (currentMode === 'collage' ? (Math.random() * 100 - 50) : 0);
                targetY = (CANVAS_HEIGHT - (img.height * scale)) / 2 + (currentMode === 'collage' ? (Math.random() * 100 - 50) : 0);
            }

            elements.push({
                type: 'image',
                img: img,
                x: targetX,
                y: targetY,
                w: img.width * scale,
                h: img.height * scale
            });
            renderCanvas();
        };
        img.src = dataUrl;
    }

    // --- Map Picker Logic ---
    const mapPickerModal = document.getElementById('mapPickerModal');
    const closeMapPickerBtn = document.getElementById('closeMapPickerBtn');
    const mapPickerGrid = document.getElementById('mapPickerGrid');
    const mapPickerLoading = document.getElementById('mapPickerLoading');

    closeMapPickerBtn?.addEventListener('click', () => {
        if (mapPickerModal) mapPickerModal.style.display = 'none';
    });

    async function openMapPicker() {
        if (!mapPickerModal || !mapPickerGrid || !mapPickerLoading) return;
        mapPickerModal.style.display = 'flex';
        mapPickerGrid.innerHTML = '';
        mapPickerLoading.style.display = 'flex';

        let localMaps = [];
        try {
            const localStr = localStorage.getItem('compass_local_maps');
            if (localStr) {
                localMaps = JSON.parse(localStr);
                if (!Array.isArray(localMaps)) localMaps = [];
                localMaps = localMaps.map(m => ({ ...m, isLocalOnly: true }));
            }
        } catch (e) {}

        let onlineMaps = [];
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
            const { data, error } = await supabase
                .from('maps')
                .select('id, name, user_id, gamemode, environment, size, thumbnail_url, map_data, theme_options')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            if (!error && data) {
                onlineMaps = data;
            }
        }

        const allUserMaps = [...localMaps, ...onlineMaps];
        mapPickerLoading.style.display = 'none';

        if (allUserMaps.length === 0) {
            mapPickerGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color: rgba(255,255,255,0.4); padding: 4rem;">No maps found. Save some maps in the editor first!</div>`;
            return;
        }

        for (const map of allUserMaps) {
            const card = document.createElement('div');
            card.className = 'picker-card';
            
            const title = document.createElement('div');
            title.className = 'picker-card-title';
            title.textContent = map.name || 'Untitled Map';

            const img = document.createElement('img');
            img.style.opacity = '0.5';
            
            card.appendChild(img);
            card.appendChild(title);
            mapPickerGrid.appendChild(card);

            card.addEventListener('click', async () => {
                mapPickerModal.style.display = 'none';
                if (img.src && img.src.startsWith('data:image')) {
                    handleMapSelection(img.src);
                    return;
                }

                if (map.map_data) {
                    try {
                        const dataUrl = await drawStaticMapPreview(map.map_data, map.size, map.gamemode, map.environment, map.theme_options);
                        handleMapSelection(dataUrl);
                    } catch (e) {
                        console.error('Failed to render map', e);
                        alert('Could not render map. Please open it in the editor first.');
                    }
                } else if (map.thumbnail_url) {
                    handleMapSelection(map.thumbnail_url);
                }
            });

            if (map.thumbnail_url) {
                img.src = map.thumbnail_url;
                img.style.opacity = '1';
            } else if (map.map_data) {
                drawStaticMapPreview(map.map_data, map.size, map.gamemode, map.environment, map.theme_options)
                    .then(png => {
                        img.src = png;
                        img.style.opacity = '1';
                    })
                    .catch(() => {
                        img.src = 'Resources/Additional/Icons/compass.png';
                        img.style.opacity = '1';
                    });
            } else {
                img.src = 'Resources/Additional/Icons/compass.png';
                img.style.opacity = '1';
            }
        }
    }

    // Math helper for arrow selection
    function distToSegment(p, v, w) {
        function sqr(x) { return x * x }
        function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
        const l2 = dist2(v, w);
        if (l2 === 0) return Math.sqrt(dist2(p, v));
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.sqrt(dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) }));
    }

    // Interaction logic
    let tempArrow = null; 

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;

        // Find clicked element (top-down)
        let newlySelected = null;
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (el.type === 'image') {
                if (mx >= el.x && mx <= el.x + el.w && my >= el.y && my <= el.y + el.h) {
                    newlySelected = el;
                    break;
                }
            }
            else if (el.type === 'text') {
                ctx.font = el.font;
                const metrics = ctx.measureText(el.text);
                const h = el.fontSize;
                const w = metrics.width;
                if (mx >= el.x && mx <= el.x + w && my >= el.y - h && my <= el.y + h*0.2) {
                    newlySelected = el;
                    break;
                }
            }
            else if (el.type === 'arrow') {
                const dist = distToSegment({x: mx, y: my}, {x: el.startX, y: el.startY}, {x: el.endX, y: el.endY});
                if (dist < 20) {
                    newlySelected = el;
                    break;
                }
            }
        }

        selectedElement = newlySelected;
        renderPropertiesPanel();

        if (selectedElement) {
            isDragging = true;
            if (selectedElement.type === 'arrow') {
                dragStartX = mx - selectedElement.startX;
                dragStartY = my - selectedElement.startY;
            } else {
                dragStartX = mx - selectedElement.x;
                dragStartY = my - selectedElement.y;
            }
            
            // Bring to front
            elements = elements.filter(e => e !== selectedElement);
            elements.push(selectedElement);
            renderCanvas();
        } else {
            // Clicked empty space
            if (currentMode === 'paths') {
                isDragging = true;
                tempArrow = { startX: mx, startY: my, endX: mx, endY: my, color: '#f43f5e' };
            }
            renderCanvas();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;

        if (currentMode === 'paths' && tempArrow && !selectedElement) {
            tempArrow.endX = mx;
            tempArrow.endY = my;
            renderCanvas();
            drawArrow(ctx, tempArrow.startX, tempArrow.startY, tempArrow.endX, tempArrow.endY, tempArrow.color);
            return;
        }

        if (selectedElement) {
            if (selectedElement.type === 'arrow') {
                const dx = mx - dragStartX - selectedElement.startX;
                const dy = my - dragStartY - selectedElement.startY;
                selectedElement.startX += dx;
                selectedElement.startY += dy;
                selectedElement.endX += dx;
                selectedElement.endY += dy;
                dragStartX = mx - selectedElement.startX;
                dragStartY = my - selectedElement.startY;
            } else {
                selectedElement.x = mx - dragStartX;
                selectedElement.y = my - dragStartY;
            }
            renderCanvas();
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (currentMode === 'paths' && tempArrow && !selectedElement) {
            const dx = tempArrow.endX - tempArrow.startX;
            const dy = tempArrow.endY - tempArrow.startY;
            if (Math.sqrt(dx * dx + dy * dy) > 20) {
                elements.push({
                    type: 'arrow',
                    startX: tempArrow.startX,
                    startY: tempArrow.startY,
                    endX: tempArrow.endX,
                    endY: tempArrow.endY,
                    color: tempArrow.color
                });
            }
            tempArrow = null;
            renderCanvas();
        }
        isDragging = false;
    });

    // Keyboard support for deleting elements
    document.addEventListener('keydown', (e) => {
        if (studioEditor.style.display !== 'none' && selectedElement) {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
                elements = elements.filter(el => el !== selectedElement);
                selectedElement = null;
                renderCanvas();
                renderPropertiesPanel();
            }
        }
    });

    function drawArrow(ctx, fromx, fromy, tox, toy, color) {
        const headlen = 30;
        const dx = tox - fromx;
        const dy = toy - fromy;
        const angle = Math.atan2(dy, dx);
        
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(fromx, fromy);
        ctx.lineTo(tox, toy);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(tox, toy);
        ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
        ctx.lineTo(tox, toy);
        ctx.fill();
    }

    function renderCanvas() {
        ctx.fillStyle = canvasBgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (currentMode === 'showcase') {
            const grad = ctx.createRadialGradient(CANVAS_WIDTH, CANVAS_HEIGHT / 2, 100, CANVAS_WIDTH, CANVAS_HEIGHT / 2, 1000);
            grad.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        for (const el of elements) {
            if (el.type === 'image') {
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 30;
                ctx.drawImage(el.img, el.x, el.y, el.w, el.h);
                ctx.shadowBlur = 0;
            }
            else if (el.type === 'text') {
                ctx.font = el.font;
                ctx.fillStyle = el.color;
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
                ctx.fillText(el.text, el.x, el.y);
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }
            else if (el.type === 'arrow') {
                drawArrow(ctx, el.startX, el.startY, el.endX, el.endY, el.color || '#f43f5e');
            }
        }

        // Draw selection highlight
        if (selectedElement) {
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 10]);
            
            if (selectedElement.type === 'image') {
                ctx.strokeRect(selectedElement.x - 5, selectedElement.y - 5, selectedElement.w + 10, selectedElement.h + 10);
            } else if (selectedElement.type === 'text') {
                ctx.font = selectedElement.font;
                const metrics = ctx.measureText(selectedElement.text);
                const h = selectedElement.fontSize;
                const w = metrics.width;
                ctx.strokeRect(selectedElement.x - 5, selectedElement.y - h - 5, w + 10, h + 15);
            } else if (selectedElement.type === 'arrow') {
                // Approximate bounding box for arrow
                const minX = Math.min(selectedElement.startX, selectedElement.endX);
                const maxX = Math.max(selectedElement.startX, selectedElement.endX);
                const minY = Math.min(selectedElement.startY, selectedElement.endY);
                const maxY = Math.max(selectedElement.startY, selectedElement.endY);
                ctx.strokeRect(minX - 20, minY - 20, (maxX - minX) + 40, (maxY - minY) + 40);
            }
            ctx.setLineDash([]);
        }
    }

    // Export Logic
    exportBtn.addEventListener('click', () => {
        // Deselect so selection box isn't exported
        selectedElement = null;
        renderCanvas();
        renderPropertiesPanel();

        let dataUrl;
        
        if (currentMode === 'paths') {
            const mapEl = elements.find(el => el.type === 'image');
            if (mapEl) {
                // Crop canvas tightly to the map boundaries
                const offCanvas = document.createElement('canvas');
                offCanvas.width = mapEl.w;
                offCanvas.height = mapEl.h;
                const offCtx = offCanvas.getContext('2d');
                
                // Fill background
                offCtx.fillStyle = canvasBgColor;
                offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
                
                // Draw everything shifted
                for (const el of elements) {
                    if (el.type === 'image') {
                        offCtx.drawImage(el.img, el.x - mapEl.x, el.y - mapEl.y, el.w, el.h);
                    } else if (el.type === 'text') {
                        offCtx.font = el.font;
                        offCtx.fillStyle = el.color;
                        offCtx.shadowColor = 'rgba(0,0,0,0.8)';
                        offCtx.shadowBlur = 15;
                        offCtx.fillText(el.text, el.x - mapEl.x, el.y - mapEl.y);
                        offCtx.shadowBlur = 0;
                    } else if (el.type === 'arrow') {
                        drawArrow(offCtx, el.startX - mapEl.x, el.startY - mapEl.y, el.endX - mapEl.x, el.endY - mapEl.y, el.color || '#f43f5e');
                    }
                }
                dataUrl = offCanvas.toDataURL('image/png', 1.0);
            } else {
                dataUrl = canvas.toDataURL('image/png', 1.0);
            }
        } else {
            dataUrl = canvas.toDataURL('image/png', 1.0);
        }

        showSharpnessDownload(dataUrl, `compass_art_${currentMode}`);
    });
});
