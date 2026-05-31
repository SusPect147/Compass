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
    
    const canvas = document.getElementById('artCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    const propertiesPanel = document.getElementById('studioProperties');
    
    let currentMode = '';
    
    // Canvas State
    let elements = []; // { type: 'image'|'text'|'arrow'|'glow', x, y, ... }
    let selectedElement = null;
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    
    // Resizing State
    let isResizing = false;
    let resizeHandle = null; // 'nw', 'ne', 'sw', 'se'

    // Pan & Zoom State
    let panX = 0, panY = 0, zoom = 1;
    let isPanning = false;
    let lastPanX = 0, lastPanY = 0;

    // Base resolution
    let CANVAS_WIDTH = 1920;
    let CANVAS_HEIGHT = 1080;
    let canvasBgColor = '#0a0a0f';
    let isTransparentBg = false;

    function getThemeBgColor() {
        return getComputedStyle(document.body).getPropertyValue('--bg-primary').trim() || '#0a0a0f';
    }

    function resetCanvas() {
        CANVAS_WIDTH = 1920;
        CANVAS_HEIGHT = 1080;
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        elements = [];
        selectedElement = null;
        panX = 0;
        panY = 0;
        zoom = 1;
        isTransparentBg = false;
        canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        renderCanvas();
        renderPropertiesPanel();
    }
    
    // Mode Switching
    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
            currentMode = card.getAttribute('data-mode');
            modeSelector.style.display = 'none';
            studioEditor.style.display = 'flex';
            
            if (currentMode === 'collage' || currentMode === 'paths') {
                canvasBgColor = getThemeBgColor();
                isTransparentBg = false;
            } else if (currentMode === 'showcase') {
                canvasBgColor = '#1e1b4b'; // deep purple
                isTransparentBg = false;
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
        } else if (currentMode === 'paths') {
            titleText.textContent = 'Strategy Paths';
            const drawModeBtn = document.createElement('button');
            drawModeBtn.className = 'toolbar-btn active';
            drawModeBtn.innerHTML = '<span>✏️</span> Draw Arrows';
            toolbar.appendChild(drawModeBtn);
            
            const clearBtn = document.createElement('button');
            clearBtn.className = 'toolbar-btn';
            clearBtn.innerHTML = '<span>🗑️</span> Clear Arrows';
            clearBtn.onclick = () => {
                elements = elements.filter(e => e.type === 'image'); // keep map
                selectedElement = null;
                renderCanvas();
                renderPropertiesPanel();
            };
            toolbar.appendChild(clearBtn);
        } else if (currentMode === 'showcase') {
            titleText.textContent = 'Map Showcase';
            // Setup default showcase template
            elements = [
                {
                    type: 'glow',
                    x: CANVAS_WIDTH / 2,
                    y: CANVAS_HEIGHT / 2,
                    radius: 800,
                    color: '#8b5cf6'
                },
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
                        Click on any element in the workspace to edit it. You can drag the corner squares to resize.
                    </div>
                </div>
                ${(currentMode === 'collage' || currentMode === 'showcase' || currentMode === 'paths') ? `
                <div class="prop-group">
                    <label>Background</label>
                    <div style="display: flex; gap: 10px; align-items: center; margin-top: 5px;">
                        <input type="color" class="prop-color-picker" id="canvasBgProp" value="${canvasBgColor}" style="flex: 1;" ${isTransparentBg ? 'disabled' : ''}>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: #fff; cursor: pointer; user-select: none;">
                            <input type="checkbox" id="transparentBgProp" ${isTransparentBg ? 'checked' : ''}>
                            Transparent
                        </label>
                    </div>
                </div>
                ` : ''}
            `;
            const bgInput = document.getElementById('canvasBgProp');
            const transInput = document.getElementById('transparentBgProp');
            if (bgInput) {
                bgInput.onchange = (e) => {
                    canvasBgColor = e.target.value;
                    renderCanvas();
                };
            }
            if (transInput) {
                transInput.onchange = (e) => {
                    isTransparentBg = e.target.checked;
                    if (bgInput) bgInput.disabled = isTransparentBg;
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
                    <label>Text Color</label>
                    <input type="color" class="prop-color-picker" id="textColorProp" value="${selectedElement.color}">
                </div>
                <button class="prop-btn" id="deleteElementBtn" style="margin-top: auto;">Delete Text</button>
            `;
            document.getElementById('textContentProp').oninput = (e) => {
                selectedElement.text = e.target.value;
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
                        Drag the corners to resize the map.
                    </div>
                </div>
                <button class="prop-btn" id="deleteElementBtn" style="margin-top: auto;">Remove Map</button>
            `;
        } else if (selectedElement.type === 'glow') {
            propertiesPanel.innerHTML = `
                <div class="prop-group">
                    <label>Glow Sphere</label>
                    <div style="color: rgba(255,255,255,0.4); font-size: 0.85rem;">
                        Drag to move, use handles to resize.
                    </div>
                </div>
                <div class="prop-group">
                    <label>Glow Color</label>
                    <input type="color" class="prop-color-picker" id="glowColorProp" value="${selectedElement.color}">
                </div>
                <button class="prop-btn" id="deleteElementBtn" style="margin-top: auto;">Delete Glow</button>
            `;
            document.getElementById('glowColorProp').oninput = (e) => {
                selectedElement.color = e.target.value;
                renderCanvas();
            };
        } else if (selectedElement.type === 'arrow') {
            propertiesPanel.innerHTML = `
                <div class="prop-group">
                    <label>Arrow Properties</label>
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
        el.font = `${weight}${Math.round(el.fontSize)}px ${family}`;
    }
    
    function handleMapSelection(dataUrl: string) {
        if (currentMode === 'paths' || currentMode === 'showcase') {
            // Remove previous map
            elements = elements.filter(el => el.type !== 'image');
        }

        const img = new Image();
        img.onload = () => {
            if (currentMode === 'paths') {
                // Resize canvas exactly to map
                CANVAS_WIDTH = img.width;
                CANVAS_HEIGHT = img.height;
                canvas.width = CANVAS_WIDTH;
                canvas.height = CANVAS_HEIGHT;
                panX = 0;
                panY = 0;
                zoom = 1;
                canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
                
                elements.unshift({
                    type: 'image',
                    img: img,
                    x: 0,
                    y: 0,
                    w: img.width,
                    h: img.height,
                    isLocked: true // Prevent moving/resizing the map in paths mode
                });
            } else {
                let scale = 1;
                let targetX = 0;
                let targetY = 0;

                if (currentMode === 'showcase') {
                    // Right side
                    scale = Math.min((CANVAS_WIDTH / 2 - 100) / img.width, (CANVAS_HEIGHT - 200) / img.height);
                    targetX = CANVAS_WIDTH - (img.width * scale) - 100;
                    targetY = (CANVAS_HEIGHT - (img.height * scale)) / 2;
                } else {
                    // Center
                    if (img.height > CANVAS_HEIGHT - 100) {
                        scale = (CANVAS_HEIGHT - 100) / img.height;
                    }
                    targetX = (CANVAS_WIDTH - (img.width * scale)) / 2 + (currentMode === 'collage' ? (Math.random()*100-50) : 0);
                    targetY = (CANVAS_HEIGHT - (img.height * scale)) / 2 + (currentMode === 'collage' ? (Math.random()*100-50) : 0);
                }

                elements.push({
                    type: 'image',
                    img: img,
                    x: targetX,
                    y: targetY,
                    w: img.width * scale,
                    h: img.height * scale,
                    isLocked: false
                });
            }
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
                localMaps = localMaps.map(m => ({...m, isLocalOnly: true}));
            }
        } catch(e) {}

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
            mapPickerGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#888;">No maps found. Save some maps in the editor first!</div>`;
            return;
        }

        for (const map of allUserMaps) {
            const card = document.createElement('div');
            card.className = 'picker-card';
            
            const title = document.createElement('div');
            title.className = 'picker-card-title';
            title.textContent = map.name || 'Untitled';

            const img = document.createElement('img');
            img.style.opacity = '0.5';

            card.appendChild(img);
            card.appendChild(title);
            mapPickerGrid.appendChild(card);

            card.addEventListener('click', async () => {
                mapPickerModal.style.display = 'none';

                if (map.map_data) {
                    try {
                        const dataUrl = await drawStaticMapPreview(map.map_data, map.size, map.gamemode, map.environment, map.theme_options, true);
                        handleMapSelection(dataUrl);
                    } catch (e) {
                        console.error('Failed to render map', e);
                        alert('Could not render map. Please open it in the editor first.');
                    }
                } else if (map.thumbnail_url) {
                    handleMapSelection(map.thumbnail_url);
                } else if (img.src && img.src.startsWith('data:image')) {
                    handleMapSelection(img.src);
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
    
    // Math helpers
    function distToSegment(p, v, w) {
        function sqr(x) { return x * x }
        function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
        const l2 = dist2(v, w);
        if (l2 === 0) return Math.sqrt(dist2(p, v));
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.sqrt(dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) }));
    }

    function getBounds(el) {
        if (el.type === 'image') {
            return { x: el.x, y: el.y, w: el.w, h: el.h };
        } else if (el.type === 'text') {
            ctx.font = el.font;
            const metrics = ctx.measureText(el.text);
            return { x: el.x, y: el.y - el.fontSize, w: metrics.width, h: el.fontSize + el.fontSize * 0.2 };
        } else if (el.type === 'glow') {
            return { x: el.x - el.radius, y: el.y - el.radius, w: el.radius * 2, h: el.radius * 2 };
        }
        return null;
    }

    function getHandles(el) {
        const b = getBounds(el);
        if (!b) return null;
        return {
            nw: { x: b.x, y: b.y },
            ne: { x: b.x + b.w, y: b.y },
            sw: { x: b.x, y: b.y + b.h },
            se: { x: b.x + b.w, y: b.y + b.h }
        };
    }

    let tempArrow = null;
    
    const studioWorkspace = document.getElementById('studioWorkspace');
    
    // Prevent context menu to allow right-click panning
    studioWorkspace.addEventListener('contextmenu', e => e.preventDefault());

    studioWorkspace.addEventListener('wheel', (e) => {
        if (studioEditor.style.display === 'none') return;
        e.preventDefault();
        
        const zoomDelta = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.max(0.1, Math.min(zoom * zoomDelta, 10));
        
        const rect = canvas.getBoundingClientRect();
        // Mouse offset from current center of the canvas element
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);

        // How much the point will move due to scale
        const scaleFactor = newZoom / zoom;
        const shiftX = dx * (scaleFactor - 1);
        const shiftY = dy * (scaleFactor - 1);

        panX -= shiftX;
        panY -= shiftY;
        zoom = newZoom;
        
        canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        renderCanvas(); // Redraw in case handle sizes need to update based on visual scale
    });

    studioWorkspace.addEventListener('mousedown', (e) => {
        if (e.button === 2) { // Right click to pan
            isPanning = true;
            return;
        }

        if (e.target !== canvas) {
            // Clicked outside canvas, deselect element
            if (selectedElement) {
                selectedElement = null;
                renderPropertiesPanel();
                renderCanvas();
            }
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        
        // 1. Check handles of selected element first
        if (selectedElement && !selectedElement.isLocked && selectedElement.type !== 'arrow') {
            const handles = getHandles(selectedElement);
            if (handles) {
                const HANDLE_SIZE = 20 * scaleX; // keep hit area comfortable regardless of zoom
                for (const h in handles) {
                    const hx = handles[h].x;
                    const hy = handles[h].y;
                    if (mx >= hx - HANDLE_SIZE && mx <= hx + HANDLE_SIZE && my >= hy - HANDLE_SIZE && my <= hy + HANDLE_SIZE) {
                        isResizing = true;
                        resizeHandle = h;
                        dragStartX = mx;
                        dragStartY = my;
                        return;
                    }
                }
            }
        }

        // 2. Find clicked element (top-down)
        let newlySelected = null;
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (el.isLocked && currentMode === 'paths') continue; // Don't select locked map in paths

            if (el.type === 'image' || el.type === 'text' || el.type === 'glow') {
                const b = getBounds(el);
                if (b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
                    newlySelected = el;
                    break;
                }
            } else if (el.type === 'arrow') {
                const dist = distToSegment({x: mx, y: my}, {x: el.startX, y: el.startY}, {x: el.endX, y: el.endY});
                if (dist < 8 * scaleX) { // Reduced hitbox size for arrows
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
            if (!selectedElement.isLocked) {
                elements = elements.filter(e => e !== selectedElement);
                elements.push(selectedElement);
            }
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
    
    window.addEventListener('mousemove', (e) => {
        if (isPanning) {
            panX += e.movementX;
            panY += e.movementY;
            canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
            return;
        }

        if (!isDragging && !isResizing && !tempArrow) return; // Optimization

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        
        if (isResizing && selectedElement) {
            const dx = mx - dragStartX;
            const dy = my - dragStartY;
            
            if (selectedElement.type === 'image') {
                let scaleChange = 1;
                // keep aspect ratio based on dx vs width
                if (resizeHandle === 'se' || resizeHandle === 'ne') {
                    scaleChange = (selectedElement.w + dx) / selectedElement.w;
                } else if (resizeHandle === 'nw' || resizeHandle === 'sw') {
                    scaleChange = (selectedElement.w - dx) / selectedElement.w;
                }

                if (scaleChange > 0.1) {
                    const oldW = selectedElement.w;
                    const oldH = selectedElement.h;
                    selectedElement.w *= scaleChange;
                    selectedElement.h *= scaleChange;

                    if (resizeHandle === 'nw') {
                        selectedElement.x += (oldW - selectedElement.w);
                        selectedElement.y += (oldH - selectedElement.h);
                    } else if (resizeHandle === 'ne') {
                        selectedElement.y += (oldH - selectedElement.h);
                    } else if (resizeHandle === 'sw') {
                        selectedElement.x += (oldW - selectedElement.w);
                    }
                }
            } else if (selectedElement.type === 'text') {
                let diff = dx;
                if (resizeHandle === 'nw' || resizeHandle === 'sw') diff = -dx;
                selectedElement.fontSize = Math.max(10, selectedElement.fontSize + diff * 0.2);
                updateFontString(selectedElement);
            } else if (selectedElement.type === 'glow') {
                let diff = dx;
                if (resizeHandle === 'nw' || resizeHandle === 'sw') diff = -dx;
                selectedElement.radius = Math.max(20, selectedElement.radius + diff);
            }

            dragStartX = mx;
            dragStartY = my;
            renderCanvas();
            return;
        }

        if (currentMode === 'paths' && tempArrow && !selectedElement) {
            tempArrow.endX = mx;
            tempArrow.endY = my;
            renderCanvas();
            return;
        }
        
        if (isDragging && selectedElement && !selectedElement.isLocked) {
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
    
    window.addEventListener('mouseup', (e) => {
        if (e.button === 2) {
            isPanning = false;
            return;
        }

        if (currentMode === 'paths' && tempArrow && !selectedElement) {
            const dx = tempArrow.endX - tempArrow.startX;
            const dy = tempArrow.endY - tempArrow.startY;
            if (Math.sqrt(dx*dx + dy*dy) > 20) {
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
        isResizing = false;
        resizeHandle = null;
    });

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

    function hexToRgba(hex, alpha) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        return `rgba(${r},${g},${b},${alpha})`;
    }
    
    function renderCanvas() {
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width ? canvas.width / rect.width : 1;

        if (isTransparentBg) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = canvasBgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        for (const el of elements) {
            if (el.type === 'glow') {
                const grad = ctx.createRadialGradient(el.x, el.y, 10, el.x, el.y, el.radius);
                grad.addColorStop(0, hexToRgba(el.color || '#8b5cf6', 0.6));
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(el.x, el.y, el.radius, 0, Math.PI * 2);
                ctx.fill();
            } else if (el.type === 'image') {
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 30;
                ctx.drawImage(el.img, el.x, el.y, el.w, el.h);
                ctx.shadowBlur = 0;
            } else if (el.type === 'text') {
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
            } else if (el.type === 'arrow') {
                drawArrow(ctx, el.startX, el.startY, el.endX, el.endY, el.color || '#f43f5e');
            }
        }
        
        if (currentMode === 'paths' && tempArrow) {
            drawArrow(ctx, tempArrow.startX, tempArrow.startY, tempArrow.endX, tempArrow.endY, tempArrow.color);
        }
        
        // Draw selection highlight and handles
        if (selectedElement && !selectedElement.isLocked) {
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 4 * scaleX;
            ctx.setLineDash([10 * scaleX, 10 * scaleX]);
            
            const b = getBounds(selectedElement);
            if (b) {
                const pad = 5 * scaleX;
                ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad*2, b.h + pad*2);
                
                // Draw handles
                if (selectedElement.type !== 'arrow') {
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#fff';
                    const hSize = 16 * scaleX;
                    const hHalf = hSize / 2;
                    ctx.fillRect(b.x - pad - hHalf, b.y - pad - hHalf, hSize, hSize);
                    ctx.fillRect(b.x + b.w + pad - hHalf, b.y - pad - hHalf, hSize, hSize);
                    ctx.fillRect(b.x - pad - hHalf, b.y + b.h + pad - hHalf, hSize, hSize);
                    ctx.fillRect(b.x + b.w + pad - hHalf, b.y + b.h + pad - hHalf, hSize, hSize);
                    
                    ctx.strokeRect(b.x - pad - hHalf, b.y - pad - hHalf, hSize, hSize);
                    ctx.strokeRect(b.x + b.w + pad - hHalf, b.y - pad - hHalf, hSize, hSize);
                    ctx.strokeRect(b.x - pad - hHalf, b.y + b.h + pad - hHalf, hSize, hSize);
                    ctx.strokeRect(b.x + b.w + pad - hHalf, b.y + b.h + pad - hHalf, hSize, hSize);
                }
            } else if (selectedElement.type === 'arrow') {
                const minX = Math.min(selectedElement.startX, selectedElement.endX);
                const maxX = Math.max(selectedElement.startX, selectedElement.endX);
                const minY = Math.min(selectedElement.startY, selectedElement.endY);
                const maxY = Math.max(selectedElement.startY, selectedElement.endY);
                const pad = 20 * scaleX;
                ctx.strokeRect(minX - pad, minY - pad, (maxX - minX) + pad*2, (maxY - minY) + pad*2);
                ctx.setLineDash([]);
            }
        }
    }
    
    exportBtn.addEventListener('click', () => {
        selectedElement = null;
        renderCanvas();
        
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        showSharpnessDownload(dataUrl, `compass_art_${currentMode}`);
    });
});
