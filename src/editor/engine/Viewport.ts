/**
 * ViewportMixin — управление зумом, панорамированием и центрированием холста.
 *
 * Отвечает за: масштаб (`zoomLevel`), авто-подгонку под контейнер,
 * центрирование карты при открытии, и определение мобильного устройства.
 */
export const ViewportMixin = {
autoScaleViewport() {
        if (this.headless) return;
        const container = this.canvas.closest('.map-editor') || this.canvas.parentElement;
        if (this.isMobileDevice()) {
            // Phones: fit the actual MAP (excluding the transparent canvasPadding
            // border) to the container with a tiny margin, so the initial view
            // fills the container instead of showing a small map. The padding may
            // overflow the container edges — panning/zoom handles that fine.
            const containerWidth = container.clientWidth - 12;
            const containerHeight = container.clientHeight - 12;
            const mapPixelW = this.mapWidth * this.tileSize;
            const mapPixelH = this.mapHeight * this.tileSize;
            const scaleX = containerWidth / mapPixelW;
            const scaleY = containerHeight / mapPixelH;
            const target = Math.min(scaleX, scaleY, this.maxZoom) * 0.92;
            this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, target));
            this.updateCanvasZoom();
            // Always re-center on phones after auto-fit: some callers change the
            // zoom without recentering, which leaves the view shifted sideways
            // (gap on one side, map cut off on the other). Double rAF so layout
            // fully settles before measuring scroll offsets.
            requestAnimationFrame(() => requestAnimationFrame(() => this.centerCanvas()));
            return;
        } else {
            const containerWidth = container.clientWidth - 40;
            const containerHeight = container.clientHeight - 40;

            const scaleX = containerWidth / this.canvas.width;
            const scaleY = containerHeight / this.canvas.height;

            const target = Math.min(scaleX, scaleY, this.maxZoom) * 0.8;
            this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, target));
        }

        this.updateCanvasZoom();
    },

updateCanvasSize() {
        // Set canvas size to map size plus padding
        this.canvas.width = this.mapWidth * this.tileSize + this.canvasPadding * 2;
        this.canvas.height = this.mapHeight * this.tileSize + this.canvasPadding * 2;

        if (this.headless) return;

        // Update the map container — add generous padding so there is always
        // scrollable overflow in both axes, enabling free panning at any zoom.
        const mapContainer = this.canvas.parentElement; // .map-container
        const editor = this.canvas.closest('.map-editor');
        if (mapContainer && editor) {
            const vw = editor.clientWidth  || 800;
            const vh = editor.clientHeight || 600;
            mapContainer.style.display = 'flex';
            mapContainer.style.justifyContent = 'flex-start';
            mapContainer.style.alignItems = 'flex-start';
            const paddingY = Math.max(2000, Math.floor(vh * 1.5));
            const paddingX = Math.max(2000, Math.floor(vw * 1.5));
            mapContainer.style.padding = `${paddingY}px ${paddingX}px`;
        } else if (mapContainer) {
            mapContainer.style.display = 'flex';
            mapContainer.style.justifyContent = 'flex-start';
            mapContainer.style.alignItems = 'flex-start';
            mapContainer.style.padding = '2000px 2000px';
        }
        this._errorsDirty = true;
    },

centerCanvas() {
        const container = this.canvas.parentElement.parentElement; // .map-editor
        const containerRect = container.getBoundingClientRect();

        // Canvas offset includes the .map-container padding
        const canvasCenterX = this.canvas.offsetLeft + this.canvas.offsetWidth / 2;
        const canvasCenterY = this.canvas.offsetTop + this.canvas.offsetHeight / 2;

        container.scrollLeft = canvasCenterX - containerRect.width / 2;
        container.scrollTop = canvasCenterY - containerRect.height / 2;
    },

updateCanvasZoom() {
        const container = this.canvas.parentElement.parentElement;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();

        const anchor = this.canvas.parentElement;
        if (!anchor) return;
        const oldW = anchor.scrollWidth || 1;
        const oldH = anchor.scrollHeight || 1;

        const viewCenterX = container.scrollLeft + containerRect.width / 2;
        const viewCenterY = container.scrollTop + containerRect.height / 2;

        const relX = viewCenterX / oldW;
        const relY = viewCenterY / oldH;

        const newWidth  = this.canvas.width  * this.zoomLevel;
        const newHeight = this.canvas.height * this.zoomLevel;
        this.canvas.style.width  = `${newWidth}px`;
        this.canvas.style.height = `${newHeight}px`;

        const newW = anchor.scrollWidth;
        const newH = anchor.scrollHeight;

        container.scrollLeft = newW * relX - containerRect.width  / 2;
        container.scrollTop  = newH * relY - containerRect.height / 2;
    },

zoom(delta) {
        const oldZoom = this.zoomLevel;
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta * this.delta));

        if (oldZoom !== this.zoomLevel) {
            this.updateCanvasZoom();
        }
    },

applyDeviceZoomSettings() {
        // Keep existing values, but tighten them for mobile if detected.
        if (!this.isMobileDevice()) {
            // Ensure zoomLevel is within bounds for desktop too
            this.zoomLevel = 0.575;
            this.updateCanvasZoom();
            return;
        }

        // Mobile-friendly constraints (only narrow / reduce values so other explicit settings stay valid)
        this.minZoom   = Math.min(this.minZoom, 0.2);  // allow zooming out a bit more on mobile
        this.maxZoom   = Math.min(this.maxZoom, 2);   // limit deep zoom-in on mobile
        this.delta     = Math.min(this.delta, 1);     // smaller per-wheel/pinch delta for smoother changes

        // Phones: fit the whole map inside its container instead of guessing a fixed
        // zoom value, so the map never overflows the container on first load.
        this.autoScaleViewport();
    },

isMobileDevice() {
        // Basic mobile detection: user-agent OR coarse pointer OR small width
        try {
            const ua = navigator?.userAgent || '';
            const smallScreen = typeof window !== 'undefined' && window.innerWidth <= 900;
            const coarsePointer = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
            const uaMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua);
            return uaMobile || coarsePointer || smallScreen;
        } catch (e) {
            return false;
        }
    }
};
