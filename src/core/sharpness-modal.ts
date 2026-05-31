// src/core/sharpness-modal.ts

/**
 * Triggers a download of a dataURL or URL
 */
function triggerDownload(url: string, filename: string) {
    try {
        if (url.startsWith('data:')) {
            // Safe Data URI to Blob conversion without fetch()
            const parts = url.split(',');
            const mime = parts[0].match(/:(.*?);/)[1];
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while(n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], {type: mime});
            const blobUrl = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.download = filename;
            link.href = blobUrl;
            link.click();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
            return;
        }
    } catch(e) {
        console.error('[Compass] Blob conversion failed, falling back to direct URL', e);
    }
    
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
}

/**
 * Shows the sharpness modal and handles downloading
 */
export function showSharpnessDownload(dataUrl: string, mapName: string) {
    let modal = document.getElementById('sharpnessModal');
            
    // If the modal isn't found in the DOM (e.g. cached HTML), inject it dynamically
    if (!modal) {
        const modalHtml = `
            <div class="modal-overlay" id="sharpnessModal" style="z-index: 9999; display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); align-items: center; justify-content: center;">
                <div class="modal-container" style="background: #1e1e24; border-radius: 12px; width: 90%; max-width: 500px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                    <header class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <h2 style="margin: 0; font-size: 1.2rem; font-weight: 600; color: #fff;">Enhance Image Sharpness</h2>
                        <button class="close-modal-btn" id="closeSharpnessBtn" style="background: none; border: none; color: #fff; font-size: 1.5rem; cursor: pointer;">&times;</button>
                    </header>
                    <div class="modal-body" style="display: flex; flex-direction: column; gap: 1rem; padding: 1.5rem; text-align: center;">
                        <p style="font-size: 0.9rem; color: rgba(255,255,255,0.7); margin: 0;">Adjust the slider to increase the sharpness of your downloaded map for better quality.</p>
                        <div id="sharpnessPreviewContainer" style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px; height: 300px; display: flex; justify-content: center; align-items: center; overflow: hidden; position: relative; cursor: grab; user-select: none;">
                            <canvas id="sharpnessPreviewCanvas" style="max-width: 100%; max-height: 100%; object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.5); transform-origin: center; transition: none; pointer-events: none;"></canvas>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem; text-align: left;">
                            <label for="sharpnessSlider" style="font-size: 0.8rem; font-weight: 600; color: #a78bfa;">Sharpness Intensity: <span id="sharpnessValueDisplay">0</span>%</label>
                            <input type="range" id="sharpnessSlider" min="0" max="100" value="0" style="width: 100%; cursor: pointer;">
                        </div>
                    </div>
                    <footer class="modal-footer" style="display: flex; gap: 1rem; padding: 1.2rem; background: rgba(0,0,0,0.1); border-top: 1px solid rgba(255,255,255,0.05);">
                        <button class="cancel-btn" id="cancelSharpnessBtn" style="flex: 1; padding: 0.8rem; background: rgba(255,255,255,0.1); border: none; border-radius: 6px; color: #fff; cursor: pointer;">Cancel</button>
                        <button class="save-pack-btn" id="downloadSharpnessBtn" style="flex: 1; padding: 0.8rem; background: #8b5cf6; border: none; border-radius: 6px; color: #fff; cursor: pointer; font-weight: 600;">Download PNG</button>
                    </footer>
                </div>
            </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        document.body.appendChild(div);
        modal = document.getElementById('sharpnessModal');
    }

    const previewCanvas = document.getElementById('sharpnessPreviewCanvas') as HTMLCanvasElement;
    const slider = document.getElementById('sharpnessSlider') as HTMLInputElement;
    const display = document.getElementById('sharpnessValueDisplay');
    const cancelBtn = document.getElementById('cancelSharpnessBtn') as HTMLButtonElement;
    const downloadBtn = document.getElementById('downloadSharpnessBtn') as HTMLButtonElement;
    const closeBtn = document.getElementById('closeSharpnessBtn') as HTMLButtonElement;

    if (!modal || !previewCanvas) {
        console.error('[Compass] Failed to create sharpness modal components');
        triggerDownload(dataUrl, `${mapName}.png`);
        return;
    }

    modal.style.display = 'flex';
    slider.value = '0';
    if (display) display.textContent = '0';
    previewCanvas.style.transform = 'none';

    // JS convolution function shared by both preview and download
    const convolveSharpness = (imageData: ImageData, sharpnessIntensity: number): ImageData => {
        const src = imageData.data;
        const w = imageData.width;
        const h = imageData.height;
        const output = new ImageData(w, h);
        const dst = output.data;
        const coeff = sharpnessIntensity / 100;
        const centerVal = 1 + 4 * coeff;
        const edgeVal = -coeff;
        // Use stride=1 for preview (correct sharpening at preview resolution)
        const stride = 1;
        for (let y = 0; y < h; y++) {
            const yTop = y >= stride ? y - stride : 0;
            const yBottom = y < h - stride ? y + stride : h - 1;
            const yIdx = y * w;
            const yTopIdx = yTop * w;
            const yBottomIdx = yBottom * w;
            for (let x = 0; x < w; x++) {
                const xLeft = x >= stride ? x - stride : 0;
                const xRight = x < w - stride ? x + stride : w - 1;
                const idxCenter = (yIdx + x) * 4;
                const idxTop = (yTopIdx + x) * 4;
                const idxBottom = (yBottomIdx + x) * 4;
                const idxLeft = (yIdx + xLeft) * 4;
                const idxRight = (yIdx + xRight) * 4;
                const r = src[idxCenter] * centerVal + (src[idxTop] + src[idxBottom] + src[idxLeft] + src[idxRight]) * edgeVal;
                const g = src[idxCenter + 1] * centerVal + (src[idxTop + 1] + src[idxBottom + 1] + src[idxLeft + 1] + src[idxRight + 1]) * edgeVal;
                const b = src[idxCenter + 2] * centerVal + (src[idxTop + 2] + src[idxBottom + 2] + src[idxLeft + 2] + src[idxRight + 2]) * edgeVal;
                dst[idxCenter]     = r < 0 ? 0 : (r > 255 ? 255 : r);
                dst[idxCenter + 1] = g < 0 ? 0 : (g > 255 ? 255 : g);
                dst[idxCenter + 2] = b < 0 ? 0 : (b > 255 ? 255 : b);
                dst[idxCenter + 3] = src[idxCenter + 3]; // preserve alpha
            }
        }
        return output;
    };

    const img = new Image();
    img.onload = () => {
        // Create a small downscaled copy for fast preview convolution (max 600px wide)
        const MAX_PREVIEW = 600;
        const previewScale = img.width > MAX_PREVIEW ? MAX_PREVIEW / img.width : 1;
        const pw = Math.round(img.width * previewScale);
        const ph = Math.round(img.height * previewScale);
        previewCanvas.width = pw;
        previewCanvas.height = ph;
        // willReadFrequently=true speeds up repeated getImageData calls
        const ctx = previewCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
        if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, pw, ph);
        }
        // Snapshot of the downscaled original pixels for fast redraws
        const origCanvas = document.createElement('canvas');
        origCanvas.width = pw;
        origCanvas.height = ph;
        const origCtx = origCanvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D;
        origCtx.drawImage(img, 0, 0, pw, ph);
        const origImageData = origCtx.getImageData(0, 0, pw, ph);

        const updatePreview = () => {
            const intensity = parseInt(slider.value, 10);
            if (display) display.textContent = intensity.toString();
            const ctx2 = previewCanvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D;
            if (!ctx2) return;
            if (intensity === 0) {
                // Restore original pixels directly — no convolution needed
                ctx2.putImageData(origImageData, 0, 0);
                return;
            }
            // Run convolution on the small preview copy — very fast
            try {
                const filtered = convolveSharpness(origImageData, intensity);
                ctx2.putImageData(filtered, 0, 0);
            } catch (e) {
                console.warn('[Compass] Preview convolution failed:', e);
            }
        };
        
        // oninput fires on every slider move for real-time preview
        slider.oninput = updatePreview;

        // Zoom & Pan state variables
        let zoomLevel = 1.0;
        let panX = 0;
        let panY = 0;
        let isPanning = false;
        let startX = 0;
        let startY = 0;

        const previewContainer = document.getElementById('sharpnessPreviewContainer');

        const applyTransform = () => {
            previewCanvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const zoomFactor = 1.15;
            if (e.deltaY < 0) {
                zoomLevel = Math.min(zoomLevel * zoomFactor, 15);
            } else {
                zoomLevel = Math.max(zoomLevel / zoomFactor, 0.25);
            }
            applyTransform();
        };

        const onContextMenu = (e: MouseEvent) => {
            e.preventDefault();
        };

        const onMouseDown = (e: MouseEvent) => {
            // Right mouse button (2)
            if (e.button === 2) {
                e.preventDefault();
                isPanning = true;
                startX = e.clientX;
                startY = e.clientY;
                if (previewContainer) previewContainer.style.cursor = 'grabbing';
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isPanning) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            panX += dx;
            panY += dy;
            startX = e.clientX;
            startY = e.clientY;
            applyTransform();
        };

        const onMouseUp = () => {
            if (isPanning) {
                isPanning = false;
                if (previewContainer) previewContainer.style.cursor = 'grab';
            }
        };

        if (previewContainer) {
            previewContainer.addEventListener('wheel', onWheel, { passive: false });
            previewContainer.addEventListener('contextmenu', onContextMenu);
            previewContainer.addEventListener('mousedown', onMouseDown);
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }
        
        const cleanup = () => {
            if (modal) modal.style.display = 'none';
            cancelBtn.onclick = null;
            closeBtn.onclick = null;
            downloadBtn.onclick = null;
            previewCanvas.style.transform = 'none';

            if (previewContainer) {
                previewContainer.removeEventListener('wheel', onWheel as EventListener);
                previewContainer.removeEventListener('contextmenu', onContextMenu as EventListener);
                previewContainer.removeEventListener('mousedown', onMouseDown as EventListener);
                previewContainer.style.cursor = 'grab';
            }
            window.removeEventListener('mousemove', onMouseMove as EventListener);
            window.removeEventListener('mouseup', onMouseUp as EventListener);
        };
        
        cancelBtn.onclick = cleanup;
        closeBtn.onclick = cleanup;
        
        downloadBtn.onclick = () => {
            const intensity = parseInt(slider.value, 10);
            if (intensity === 0) {
                triggerDownload(dataUrl, `${mapName}.png`);
            } else {
                // Apply JS convolution on a full-res export canvas (same algorithm as preview)
                const exportCanvas = document.createElement('canvas');
                exportCanvas.width = img.width;
                exportCanvas.height = img.height;
                const exCtx = exportCanvas.getContext('2d') as CanvasRenderingContext2D;
                if (exCtx) {
                    exCtx.imageSmoothingEnabled = false;
                    exCtx.drawImage(img, 0, 0);
                    try {
                        const imgData = exCtx.getImageData(0, 0, img.width, img.height);
                        // Use dynamic stride for full-res (scale to image width)
                        const exportStride = Math.max(1, Math.round(img.width / 1920));
                        const src = imgData.data;
                        const w = imgData.width;
                        const h = imgData.height;
                        const output = new ImageData(w, h);
                        const dst = output.data;
                        const coeff = intensity / 100;
                        const centerVal = 1 + 4 * coeff;
                        const edgeVal = -coeff;
                        for (let y = 0; y < h; y++) {
                            const yTop = y >= exportStride ? y - exportStride : 0;
                            const yBottom = y < h - exportStride ? y + exportStride : h - 1;
                            const yIdx = y * w;
                            for (let x = 0; x < w; x++) {
                                const xLeft = x >= exportStride ? x - exportStride : 0;
                                const xRight = x < w - exportStride ? x + exportStride : w - 1;
                                const idxCenter = (yIdx + x) * 4;
                                const idxTop = (yTop * w + x) * 4;
                                const idxBottom = (yBottom * w + x) * 4;
                                const idxLeft = (yIdx + xLeft) * 4;
                                const idxRight = (yIdx + xRight) * 4;
                                const r = src[idxCenter] * centerVal + (src[idxTop] + src[idxBottom] + src[idxLeft] + src[idxRight]) * edgeVal;
                                const g = src[idxCenter+1] * centerVal + (src[idxTop+1] + src[idxBottom+1] + src[idxLeft+1] + src[idxRight+1]) * edgeVal;
                                const b = src[idxCenter+2] * centerVal + (src[idxTop+2] + src[idxBottom+2] + src[idxLeft+2] + src[idxRight+2]) * edgeVal;
                                dst[idxCenter]   = r < 0 ? 0 : (r > 255 ? 255 : r);
                                dst[idxCenter+1] = g < 0 ? 0 : (g > 255 ? 255 : g);
                                dst[idxCenter+2] = b < 0 ? 0 : (b > 255 ? 255 : b);
                                dst[idxCenter+3] = src[idxCenter+3];
                            }
                        }
                        exCtx.putImageData(output, 0, 0);
                        triggerDownload(exportCanvas.toDataURL('image/png'), `${mapName}.png`);
                    } catch (e) {
                        console.error('[Compass] JS convolve failed, falling back to original URL', e);
                        triggerDownload(dataUrl, `${mapName}.png`);
                    }
                } else {
                    triggerDownload(dataUrl, `${mapName}.png`);
                }
            }
            cleanup();
        };
    };
    img.src = dataUrl;
}
