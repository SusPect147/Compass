// @ts-nocheck
import { showSharpnessDownload } from '../core/sharpness-modal.js';

document.addEventListener('DOMContentLoaded', () => {
    const modeSelector = document.getElementById('modeSelector');
    const studioEditor = document.getElementById('studioEditor');
    const backBtn = document.getElementById('backToModesBtn');
    const exportBtn = document.getElementById('exportArtBtn');
    const titleText = document.getElementById('studioTitle');
    const toolbar = document.getElementById('studioToolbar');
    
    const canvas = document.getElementById('artCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    
    let currentMode = '';
    
    // Canvas State
    let elements = []; // { type: 'image'|'text'|'arrow', x, y, ... }
    let selectedElement = null;
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    
    // Base resolution for high-quality export
    const CANVAS_WIDTH = 1920;
    const CANVAS_HEIGHT = 1080;
    
    function resetCanvas() {
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        elements = [];
        selectedElement = null;
        renderCanvas();
    }
    
    // Mode Switching
    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
            currentMode = card.getAttribute('data-mode');
            modeSelector.style.display = 'none';
            studioEditor.style.display = 'flex';
            resetCanvas();
            setupToolbar();
        });
    });
    
    backBtn.addEventListener('click', () => {
        studioEditor.style.display = 'none';
        modeSelector.style.display = 'grid';
    });
    
    function setupToolbar() {
        // Clear old toolbar controls (keep upload button)
        const uploadLabel = toolbar.querySelector('label');
        toolbar.innerHTML = '';
        toolbar.appendChild(uploadLabel);
        
        const uploadInput = document.getElementById('uploadImageInput') as HTMLInputElement;
        
        if (currentMode === 'collage') {
            titleText.textContent = 'Collage Maker';
            
            const addTextBtn = document.createElement('button');
            addTextBtn.className = 'toolbar-btn';
            addTextBtn.textContent = 'Add Text';
            addTextBtn.onclick = () => {
                elements.push({
                    type: 'text',
                    text: 'Your Text Here',
                    x: CANVAS_WIDTH / 2,
                    y: CANVAS_HEIGHT / 2,
                    fontSize: 100,
                    color: '#ffffff',
                    font: 'bold 100px Inter, sans-serif'
                });
                renderCanvas();
            };
            toolbar.appendChild(addTextBtn);
            
            const bgInput = document.createElement('input');
            bgInput.type = 'color';
            bgInput.className = 'toolbar-btn';
            bgInput.value = '#111111';
            bgInput.title = 'Background Color';
            bgInput.onchange = (e) => {
                canvas.style.backgroundColor = (e.target as HTMLInputElement).value;
                // Force a render so it exports with this bg
                renderCanvas();
            };
            toolbar.appendChild(bgInput);
            
            uploadInput.onchange = handleImageUpload;
            
        } else if (currentMode === 'paths') {
            titleText.textContent = 'Strategy Paths';
            
            const drawArrowBtn = document.createElement('button');
            drawArrowBtn.className = 'toolbar-btn active';
            drawArrowBtn.textContent = 'Draw Arrow (Drag)';
            toolbar.appendChild(drawArrowBtn);
            
            const clearBtn = document.createElement('button');
            clearBtn.className = 'toolbar-btn';
            clearBtn.textContent = 'Clear All Arrows';
            clearBtn.onclick = () => {
                elements = elements.filter(e => e.type === 'image'); // keep map
                renderCanvas();
            };
            toolbar.appendChild(clearBtn);
            
            uploadInput.onchange = (e) => {
                // In paths, usually just 1 map
                elements = elements.filter(el => el.type !== 'image');
                handleImageUpload(e);
            };
            
        } else if (currentMode === 'showcase') {
            titleText.textContent = 'Map Showcase';
            
            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.className = 'toolbar-input';
            titleInput.placeholder = 'Map Title...';
            titleInput.oninput = (e) => {
                const existing = elements.find(el => el.isTitle);
                if (existing) {
                    existing.text = (e.target as HTMLInputElement).value;
                    renderCanvas();
                }
            };
            toolbar.appendChild(titleInput);
            
            const descInput = document.createElement('input');
            descInput.type = 'text';
            descInput.className = 'toolbar-input';
            descInput.placeholder = 'Description...';
            descInput.oninput = (e) => {
                const existing = elements.find(el => el.isDesc);
                if (existing) {
                    existing.text = (e.target as HTMLInputElement).value;
                    renderCanvas();
                }
            };
            toolbar.appendChild(descInput);
            
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
            
            uploadInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const img = new Image();
                    img.onload = () => {
                        // Place image on the right side
                        const scale = Math.min((CANVAS_WIDTH / 2 - 100) / img.width, (CANVAS_HEIGHT - 200) / img.height);
                        const w = img.width * scale;
                        const h = img.height * scale;
                        
                        // Remove old image
                        elements = elements.filter(el => el.type !== 'image');
                        elements.push({
                            type: 'image',
                            img: img,
                            x: CANVAS_WIDTH - w - 100,
                            y: (CANVAS_HEIGHT - h) / 2,
                            w: w,
                            h: h
                        });
                        renderCanvas();
                    };
                    img.src = ev.target.result as string;
                };
                reader.readAsDataURL(file);
            };
        }
    }
    
    function handleImageUpload(e: Event) {
        const files = (e.target as HTMLInputElement).files;
        if (!files) return;
        
        for(let i = 0; i < files.length; i++) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    // Center it
                    let scale = 1;
                    if (img.height > CANVAS_HEIGHT - 100) {
                        scale = (CANVAS_HEIGHT - 100) / img.height;
                    }
                    elements.push({
                        type: 'image',
                        img: img,
                        x: (CANVAS_WIDTH - (img.width * scale)) / 2 + (Math.random()*100-50),
                        y: (CANVAS_HEIGHT - (img.height * scale)) / 2 + (Math.random()*100-50),
                        w: img.width * scale,
                        h: img.height * scale
                    });
                    renderCanvas();
                };
                img.src = ev.target.result as string;
            };
            reader.readAsDataURL(files[i]);
        }
    }
    
    // Interaction logic
    let tempArrow = null; // {startX, startY, endX, endY}
    
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        
        if (currentMode === 'paths') {
            isDragging = true;
            tempArrow = { startX: mx, startY: my, endX: mx, endY: my };
            return;
        }
        
        // Find clicked element (top-down)
        selectedElement = null;
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (el.type === 'image') {
                if (mx >= el.x && mx <= el.x + el.w && my >= el.y && my <= el.y + el.h) {
                    selectedElement = el;
                    break;
                }
            } else if (el.type === 'text') {
                ctx.font = el.font;
                const metrics = ctx.measureText(el.text);
                const h = el.fontSize;
                const w = metrics.width;
                // Rough bounding box for text
                if (mx >= el.x && mx <= el.x + w && my >= el.y - h && my <= el.y) {
                    selectedElement = el;
                    break;
                }
            }
        }
        
        if (selectedElement) {
            isDragging = true;
            dragStartX = mx - selectedElement.x;
            dragStartY = my - selectedElement.y;
            
            // Bring to front
            elements = elements.filter(e => e !== selectedElement);
            elements.push(selectedElement);
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
        
        if (currentMode === 'paths' && tempArrow) {
            tempArrow.endX = mx;
            tempArrow.endY = my;
            renderCanvas();
            drawArrow(ctx, tempArrow.startX, tempArrow.startY, tempArrow.endX, tempArrow.endY, '#f43f5e');
            return;
        }
        
        if (selectedElement) {
            selectedElement.x = mx - dragStartX;
            selectedElement.y = my - dragStartY;
            renderCanvas();
        }
    });
    
    canvas.addEventListener('mouseup', () => {
        if (currentMode === 'paths' && tempArrow) {
            // Save arrow
            const dx = tempArrow.endX - tempArrow.startX;
            const dy = tempArrow.endY - tempArrow.startY;
            if (Math.sqrt(dx*dx + dy*dy) > 20) {
                elements.push({
                    type: 'arrow',
                    startX: tempArrow.startX,
                    startY: tempArrow.startY,
                    endX: tempArrow.endX,
                    endY: tempArrow.endY
                });
            }
            tempArrow = null;
            renderCanvas();
        }
        
        isDragging = false;
    });
    
    // Draw an arrow
    function drawArrow(ctx, fromx, fromy, tox, toy, color) {
        const headlen = 30; // length of head in pixels
        const dx = tox - fromx;
        const dy = toy - fromy;
        const angle = Math.atan2(dy, dx);
        
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        
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
        // Background
        let bgColor = '#111';
        if (currentMode === 'collage') {
            const bgInput = document.querySelector('input[type="color"]') as HTMLInputElement;
            if (bgInput) bgColor = bgInput.value;
        } else if (currentMode === 'showcase') {
            bgColor = '#1e1b4b'; // deep purple bg for showcase
        }
        
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (currentMode === 'showcase') {
            // Draw a subtle gradient/glow for showcase
            const grad = ctx.createRadialGradient(CANVAS_WIDTH, CANVAS_HEIGHT/2, 100, CANVAS_WIDTH, CANVAS_HEIGHT/2, 1000);
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
                ctx.shadowBlur = 0; // reset
            } else if (el.type === 'text') {
                ctx.font = el.font;
                ctx.fillStyle = el.color;
                
                // Add soft drop shadow for text readability
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
                ctx.fillText(el.text, el.x, el.y);
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            } else if (el.type === 'arrow') {
                drawArrow(ctx, el.startX, el.startY, el.endX, el.endY, '#f43f5e');
            }
        }
        
        // Draw selection box
        if (selectedElement && currentMode === 'collage') {
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 10]);
            if (selectedElement.type === 'image') {
                ctx.strokeRect(selectedElement.x - 5, selectedElement.y - 5, selectedElement.w + 10, selectedElement.h + 10);
            }
            ctx.setLineDash([]);
        }
    }
    
    // Export with Sharpness
    exportBtn.addEventListener('click', () => {
        // Deselect so box doesn't show in export
        selectedElement = null;
        renderCanvas();
        
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        showSharpnessDownload(dataUrl, `compass_art_${currentMode}`);
    });
});
