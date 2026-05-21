// @ts-nocheck
export const InputMixin = {
    initializeEventListeners() {
        // Tool buttons
        if (this.headless) return;
        const handToolBtn = document.getElementById('handToolBtn');
        const eraseBtn = document.getElementById('eraseBtn');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const zoomInBtnBottom = document.getElementById('zoomInBtnBottom');
        const zoomOutBtnBottom = document.getElementById('zoomOutBtnBottom');
        const clearBtn = document.getElementById('clearBtn');
        const saveBtn = document.getElementById('saveBtn');
        const exportBtn = document.getElementById('exportBtn');
        const errorsBtn = document.getElementById('errorsBtn');
        const guidesBtn = document.getElementById('guidesBtn');

        // Mirror checkboxes
        const mirrorVertical   = document.getElementById('mirrorVertical');   // BUG-01 fix
        const mirrorHorizontal = document.getElementById('mirrorHorizontal'); // BUG-01 fix
        const mirrorDiagonal   = document.getElementById('mirrorDiagonal');
        const showThemeInDownloadToggle = document.getElementById('showThemeInDownloadToggle');
        const showThemeInGalleryToggle  = document.getElementById('showThemeInGalleryToggle');
        const isPublicToggle = document.getElementById('isPublicToggle');
        // const hideZoom = document.getElementById('hideZoomBtn'); // Removed

        // Map settings
        const mapSizeSelect = document.getElementById('mapSize');
        const gamemodeSelect = document.getElementById('gamemode');
        const environmentSelect = document.getElementById('environment');

        const selectBtn = document.getElementById('selectBtn');

        // Selection mode radio buttons
        document.querySelectorAll('input[name="selectionMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.selectionMode = e.target.value;
                document.getElementById('selectedAreaToolsDiv').style.display = 'none';
                document.getElementById('lastDivider').style.display = 'none';

                if (this.selectionMode === 'select' && this.isErasing) {
                    this.toggleEraseMode(false);
                }
            });
        });

        const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
        const controlsBar = document.querySelector('.controls-bar');
        if (toggleSettingsBtn && controlsBar) {
            toggleSettingsBtn.addEventListener('click', () => {
                controlsBar.classList.toggle('collapsed');
            });
        }

        if (handToolBtn) {
            handToolBtn.addEventListener('change', (e) => {
                this.togglePanningMode(e.target.checked);
            });
        }

        // BUG-02: null-checks for all tool buttons before binding
        if (eraseBtn)   eraseBtn.addEventListener('change', (e) => this.toggleEraseMode(e.target.checked));

        if (zoomInBtn)       zoomInBtn.addEventListener('click', () => this.zoom(this.zoomStep));
        if (zoomInBtnBottom) zoomInBtnBottom.addEventListener('click', () => this.zoom(this.zoomStep));
        if (zoomOutBtn)      zoomOutBtn.addEventListener('click', () => this.zoom(-this.zoomStep));
        if (zoomOutBtnBottom) zoomOutBtnBottom.addEventListener('click', () => this.zoom(-this.zoomStep));
        if (clearBtn)   clearBtn.addEventListener('click', () => this.clearMap());
        if (saveBtn)    saveBtn.addEventListener('click', () => this.saveMap());
        if (exportBtn)  exportBtn.addEventListener('click', async () => await this.exportMap());
        if (errorsBtn)  errorsBtn.addEventListener('click', () => this.toggleShowErrors());
        if (guidesBtn)  guidesBtn.addEventListener('click', () => this.toggleGuides());

        // Mirror listeners
        if (mirrorVertical) mirrorVertical.addEventListener('change', (e) => this.mirrorVertical = e.target.checked);
        if (mirrorHorizontal) mirrorHorizontal.addEventListener('change', (e) => this.mirrorHorizontal = e.target.checked);
        if (mirrorDiagonal) mirrorDiagonal.addEventListener('change', (e) => this.mirrorDiagonal = e.target.checked);

        // Theme and Export setting listeners
        const handleThemeToggle = async () => {
            const gallery = showThemeInGalleryToggle?.checked ?? true;
            const download = showThemeInDownloadToggle?.checked ?? true;
            // If EITHER is enabled, we show the theme in the editor for feedback
            // Actually, usually users want to see it if they are working on it.
            // But if they turn BOTH off, we should definitely bypass.
            window.cp_bypassTheme = !gallery && !download;
            
            // Force cache purge and reload to show/hide theme in real-time
            this.tileImages = {};
            this.tileImagePaths = {};
            this.goalImageCache = {};
            this.preloadWaterTiles(); // Add water/ice/snow preloading!
            
            const goalPromises = (this.goalImages && this.goalImages.length > 0)
                ? this.goalImages.map(goal => this.preloadGoalImage(goal.name, this.environment))
                : [];
            
            await Promise.all([
                this.loadTileImages(),
                this.loadEnvironmentBackgrounds(),
                ...goalPromises
            ]);
            this.draw();
        };

        if (showThemeInDownloadToggle) {
            showThemeInDownloadToggle.addEventListener('change', handleThemeToggle);
        }
        if (showThemeInGalleryToggle) {
            showThemeInGalleryToggle.addEventListener('change', handleThemeToggle);
        }
        // if (hideZoom) hideZoom.addEventListener('change', () => this.toggleHideZoom()); // Removed

        // Map setting listeners — BUG-02: null-check
        if (mapSizeSelect) {
            mapSizeSelect.addEventListener('change', (e) => {
                this.setSize(e.target.value);
                this.updateSelectOptionDots();
            });
        }


        gamemodeSelect.addEventListener('change', async (e) => {
            await this.setGamemode(e.target.value);
            this.updateSelectOptionDots();
        });
        environmentSelect.addEventListener('change', async (e) => {
            await this.setEnvironment(e.target.value);
            this.updateSelectOptionDots();
        });

        // Undo/Redo buttons — BUG-02: null-checks
        document.getElementById('undoBtn')?.addEventListener('click', () => this.undo());
        document.getElementById('redoBtn')?.addEventListener('click', () => this.redo());

        // Replace button
        document.getElementById('replaceBtn')?.addEventListener('click', () => this.toggleReplaceMode());

        // Rotate button
        document.getElementById('rotateBtn')?.addEventListener('click', () => this.rotateSelectedTiles());

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.code) {
                case 'Digit1':
                case 'Numpad1':
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.mirrorDiagonal = !this.mirrorDiagonal;
                        document.getElementById('mirrorDiagonal').checked = this.mirrorDiagonal;
                        return;
                    }
                    document.getElementById('singleBtn').click();
                    break;

                case 'Digit2':
                case 'Numpad2':
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.mirrorVertical = !this.mirrorVertical;
                        document.getElementById('mirrorVertical').checked = this.mirrorVertical;
                        return;
                    }
                    document.getElementById('lineBtn').click();
                    break;

                case 'Digit3':
                case 'Numpad3':
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.mirrorHorizontal = !this.mirrorHorizontal;
                        document.getElementById('mirrorHorizontal').checked = this.mirrorHorizontal;
                        return;
                    }
                    document.getElementById('rectangleBtn').click();
                    break;

                case 'Digit4':
                case 'Numpad4':
                    document.getElementById('fillBtn').click();
                    break;

                case 'Digit5':
                case 'Numpad5':
                    document.getElementById('selectBtn').click();
                    break;

                case 'KeyE':
                    this.toggleEraseMode();
                    break;

                case 'KeyM':
                    this.toggleMirroring();
                    break;

                case 'KeyN':
                    this.toggleCorrectMirroring();
                    break;

                case 'KeyQ':
                    this.toggleShowErrors();
                    break;

                case 'KeyW':
                    this.toggleGuides();
                    break;

                case 'KeyR':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.rotateSelectedTiles();
                    } else {
                        this.toggleReplaceMode();
                    }
                    break;

                case 'KeyZ':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        return;
                    }
                    // hideZoom.click(); // Removed
                    break;

                case 'KeyY':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.redo();
                    }
                    break;

                case 'Backspace':
                case 'Delete':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.clearMap(true);
                    }
                    break;
            }
        });



        // Canvas event listeners
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        this.canvas.addEventListener('contextmenu', this.handleRightClick.bind(this));
        this.canvas.addEventListener('dragstart', e => {
            e.preventDefault();
        });

        // в”Ђв”Ђ Smooth wheel zoom в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
        // Zoom relative to the container center
        const mapEditor = this.canvas.closest('.map-editor') || this.canvas.parentElement?.parentElement;
        if (mapEditor) {
            mapEditor.addEventListener('wheel', (e) => {
                e.preventDefault();
                const zoomFactor = e.deltaY < 0 ? 1.08 : 0.925;
                const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * zoomFactor));

                if (newZoom === this.zoomLevel) return;
                this.zoomLevel = newZoom;
                this.updateCanvasZoom();
            }, { passive: false });

            // ── Touch Pinch Zoom (Mobile/Tablet) ───────────────────────
            let initialPinchDist = 0;
            let initialZoom = 1;

            mapEditor.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    e.preventDefault(); // Prevent default browser zoom/pinch
                    initialPinchDist = Math.hypot(
                        e.touches[0].pageX - e.touches[1].pageX,
                        e.touches[0].pageY - e.touches[1].pageY
                    );
                    initialZoom = this.zoomLevel;
                }
            }, { passive: false });

            mapEditor.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2) {
                    e.preventDefault(); // Block scrolling & default scaling
                    const dist = Math.hypot(
                        e.touches[0].pageX - e.touches[1].pageX,
                        e.touches[0].pageY - e.touches[1].pageY
                    );
                    if (initialPinchDist > 0) {
                        const factor = dist / initialPinchDist;
                        const targetZoom = initialZoom * factor;
                        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, targetZoom));
                        if (newZoom !== this.zoomLevel) {
                            this.zoomLevel = newZoom;
                            this.updateCanvasZoom();
                        }
                    }
                }
            }, { passive: false });

            mapEditor.addEventListener('touchend', (e) => {
                if (e.touches.length < 2) {
                    initialPinchDist = 0;
                }
            });
        }

        // ── Left/Right Click & Touch Pan ───────────────────────────────
        let isPanning = false;
        let panMoved = false;
        let lastPanX = 0, lastPanY = 0;

        const editorEl = mapEditor;
        if (editorEl) {
            // Mouse Down panning
            editorEl.addEventListener('mousedown', (e) => {
                const isHandPan = this.viewPanActive && e.button === 0;
                const isRightPan = e.button === 2;
                if (!isHandPan && !isRightPan) return;

                isPanning = true;
                panMoved = false;
                lastPanX = e.clientX;
                lastPanY = e.clientY;
                editorEl.style.cursor = 'grabbing';
                e.preventDefault();
            });

            // Touch Start panning
            editorEl.addEventListener('touchstart', (e) => {
                if (!this.viewPanActive || e.touches.length !== 1) return;

                isPanning = true;
                panMoved = false;
                lastPanX = e.touches[0].clientX;
                lastPanY = e.touches[0].clientY;
            }, { passive: true });

            document.addEventListener('mousemove', (e) => {
                if (!isPanning) return;
                const dx = e.clientX - lastPanX;
                const dy = e.clientY - lastPanY;

                if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                    panMoved = true;
                }
                if (panMoved) {
                    editorEl.scrollLeft -= dx;
                    editorEl.scrollTop -= dy;
                    lastPanX = e.clientX;
                    lastPanY = e.clientY;
                }
            });

            // Document Touch Move
            editorEl.addEventListener('touchmove', (e) => {
                if (!isPanning || e.touches.length !== 1) return;
                const dx = e.touches[0].clientX - lastPanX;
                const dy = e.touches[0].clientY - lastPanY;

                if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                    panMoved = true;
                    e.preventDefault(); // Stop system rubber banding
                }
                if (panMoved) {
                    editorEl.scrollLeft -= dx;
                    editorEl.scrollTop -= dy;
                    lastPanX = e.touches[0].clientX;
                    lastPanY = e.touches[0].clientY;
                }
            }, { passive: false });

            // Document Mouse Up
            document.addEventListener('mouseup', (e) => {
                if (!isPanning) return;
                isPanning = false;
                editorEl.style.cursor = this.viewPanActive ? 'grab' : '';
            });

            // Document Touch End
            editorEl.addEventListener('touchend', () => {
                if (isPanning) isPanning = false;
            });

            // Block the browser context menu only when the user actually dragged
            editorEl.addEventListener('contextmenu', (e) => {
                if (panMoved) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    panMoved = false;
                }
            });
        }


        // BUG-16: Removed duplicate document-level mouseup for handleMouseUp.
        // Canvas already has its own mouseup (line 252). The panning mouseup above (line 380)
        // handles the pan stop. Binding handleMouseUp to document caused double-fire on each release.

        // Touch events
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        this.canvas.addEventListener('touchcancel', this.handleTouchCancel.bind(this));

        this.updateSelectOptionDots();
    },

    updateSelectOptionDots() {
        const selectIds = ['mapSize', 'gamemode', 'environment'];
        selectIds.forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            Array.from(select.options).forEach(opt => {
                let text = opt.textContent || '';
                text = text.replace(/^[●•]\s*/, '');
                
                if (opt.value === select.value) {
                    opt.textContent = '● ' + text;
                } else {
                    opt.textContent = text;
                }
            });
        });
    },

    handleRightClick(event) {
        event.preventDefault();

        // Right-click is used for panning вЂ” don't do tile actions during pan
        // We only pick tile if not panning (panning is handled at editor level)
        const coords = this.getTileCoordinates(event);
        if (coords.x < 0 || coords.x >= this.mapWidth || coords.y < 0 || coords.y >= this.mapHeight) return;

        if (this.replaceMode) {
            this.handleReplace(coords.x, coords.y);
            return;
        }

        if (this.tileGrid[this.defaultTileLayer][coords.y][coords.x] < 1) return;

        this.activeToolBrush = { id: this.tileGrid[this.defaultTileLayer][coords.y][coords.x], ...this.tileDefinitions[this.tileGrid[this.defaultTileLayer][coords.y][coords.x]] };
        document.getElementById('tileSelector').querySelectorAll('.tile-btn').forEach(b => b.classList.remove('selected'));
        const btn = document.getElementById('tileSelector').querySelector(`.tile-btn[id="${this.activeToolBrush.id}"]`);
        if (btn) btn.classList.add('selected');
    },

    handleMouseDown(event) {
        if (this.viewPanActive) return; // Exit early, panning overrides drawing
        if (event.button !== 0) return;
        this.mouseDown = true;
        const coords = this.getTileCoordinates(event);

        if (coords.x < 0 || coords.x >= this.mapWidth || coords.y < 0 || coords.y >= this.mapHeight) return;

        if (this.selectionMode === 'select' && this.activeToolBrushs.length > 0 && this.activeToolBrushs.some(t => t.x === coords.x && t.y === coords.y)) {
            // Start select-drag
            this.isSelectDragging = true;
            this.selectDragStart = { ...coords };
            this.selectDragLastPos = { ...coords };
            this.selectDragTiles = this.activeToolBrushs.map(t => ({ ...t })); // deep copy
            // Save state and remove tiles from map using eraseTile (handles 2x2 and mirroring)
            this.saveState();
            for (const t of this.selectDragTiles) {
                this.eraseTile(t.x, t.y, false);
            }
            this.draw();
            // Draw ghost tiles at original positions
            this.drawSelectDragGhost(0, 0);
            return;
        }

        if (this.selectionMode !== 'select' || !this.activeToolBrushs.some(t => t.x === coords.x && t.y === coords.y)) {
            this.activeToolBrushs = [];
        }

        if ((this.gamemode === 'Brawl_Ball' || this.gamemode === 'Hockey') && this.mapSize === this.mapSizes.regular) {
            const { x, y } = coords;
            const atTop = y < 4;
            const atBottom = y >= this.mapHeight - 4;
            const atLeft = x < 7;
            const atRight = x >= this.mapWidth - 7;
            if ((atTop || atBottom) && (atLeft || atRight)) {
                // cancel *all* drawing state
                this.isDrawing = false;
                this.isDragging = false;
                this.mouseDown = false;
                return;
            }
        }

        if (this.replaceMode) {
            this.handleReplace(coords.x, coords.y);
            return;
        }

        // Check if we can place the selected tile on the existing tile
        if (!this.isErasing && this.selectionMode !== 'fill' && this.selectionMode !== 'select') {
            const topmostTile = this.getTopmostTileAt(coords.x, coords.y);

            if (topmostTile) {
                // Check if we can place the selected tile on this existing tile
                if (this.canPlaceTileOn(this.activeToolBrush.id, topmostTile.tileId)) {
                    // Place the tile instead of dragging
                    this.placeTile(coords.x, coords.y, this.activeToolBrush.id, true);
                    return;
                }
            }
        }

        // Check if we're starting to drag an existing tile
        if (!this.isErasing && this.selectionMode !== 'fill' && this.selectionMode !== 'select') {
            const topmostTile = this.findTopmostTileAt(coords.x, coords.y);

            if (topmostTile) {
                this.isDragging = true;
                this.draggedTileId = topmostTile.tileId;
                this.draggedTileLayer = topmostTile.layerIndex;
                this.dragStartX = topmostTile.x;
                this.dragStartY = topmostTile.y;
                this.saveState();

                // Get the tile definition to check if it's a 2x2 tile
                const def = topmostTile.def;
                const is2x2 = def && def.size === 2;

                // Store the negative IDs for size 2 tiles so they move together
                this.draggedNegativeIds = null;
                if (is2x2) {
                    this.draggedNegativeIds = {
                        right: this.tileGrid[topmostTile.layerIndex][topmostTile.y][topmostTile.x + 1],
                        bottom: this.tileGrid[topmostTile.layerIndex][topmostTile.y + 1][topmostTile.x],
                        bottomRight: this.tileGrid[topmostTile.layerIndex][topmostTile.y + 1][topmostTile.x + 1]
                    };
                }

                // Remove tile from original position immediately using parent root coordinates
                this.tileGrid[topmostTile.layerIndex][topmostTile.y][topmostTile.x] = 0;

                // If it's a 2x2 tile, also remove the other three tiles from the root
                if (is2x2) {
                    if (topmostTile.x < this.mapWidth - 1) this.tileGrid[topmostTile.layerIndex][topmostTile.y][topmostTile.x + 1] = 0;
                    if (topmostTile.y < this.mapHeight - 1) this.tileGrid[topmostTile.layerIndex][topmostTile.y + 1][topmostTile.x] = 0;
                    if (topmostTile.x < this.mapWidth - 1 && topmostTile.y < this.mapHeight - 1) this.tileGrid[topmostTile.layerIndex][topmostTile.y + 1][topmostTile.x + 1] = 0;
                }

                // Apply mirroring for removal
                if (this.mirrorVertical) {
                    const mirrorY = this.mapHeight - 1 - topmostTile.y;
                    const mirrorTopmost = this.findTopmostTileAt(topmostTile.x, mirrorY);
                    const mirrorLayer = mirrorTopmost ? mirrorTopmost.layerIndex : topmostTile.layerIndex;
                    this.tileGrid[mirrorLayer][mirrorY][topmostTile.x] = 0;

                    // If it's a 2x2 tile, also remove the other three tiles
                    if (is2x2) {
                        this.tileGrid[mirrorLayer][mirrorY][topmostTile.x + 1] = 0;
                        this.tileGrid[mirrorLayer][mirrorY - 1][topmostTile.x] = 0;
                        this.tileGrid[mirrorLayer][mirrorY - 1][topmostTile.x + 1] = 0;
                    }
                }
                if (this.mirrorHorizontal) {
                    const mirrorX = this.mapWidth - 1 - topmostTile.x;
                    const mirrorTopmost = this.findTopmostTileAt(mirrorX, topmostTile.y);
                    const mirrorLayer = mirrorTopmost ? mirrorTopmost.layerIndex : topmostTile.layerIndex;
                    this.tileGrid[mirrorLayer][topmostTile.y][mirrorX] = 0;

                    // If it's a 2x2 tile, also remove the other three tiles
                    if (is2x2) {
                        this.tileGrid[mirrorLayer][topmostTile.y][mirrorX - 1] = 0;
                        this.tileGrid[mirrorLayer][topmostTile.y + 1][mirrorX] = 0;
                        this.tileGrid[mirrorLayer][topmostTile.y + 1][mirrorX - 1] = 0;
                    }
                }
                if (this.mirrorDiagonal) {
                    const mirrorX = this.mapWidth - 1 - topmostTile.x;
                    const mirrorY = this.mapHeight - 1 - topmostTile.y;
                    const mirrorTopmost = this.findTopmostTileAt(mirrorX, mirrorY);
                    const mirrorLayer = mirrorTopmost ? mirrorTopmost.layerIndex : topmostTile.layerIndex;
                    this.tileGrid[mirrorLayer][mirrorY][mirrorX] = 0;

                    // If it's a 2x2 tile, also remove the other three tiles
                    if (is2x2) {
                        this.tileGrid[mirrorLayer][mirrorY][mirrorX - 1] = 0;
                        this.tileGrid[mirrorLayer][mirrorY - 1][mirrorX] = 0;
                        this.tileGrid[mirrorLayer][mirrorY - 1][mirrorX - 1] = 0;
                    }
                }

                this.canvas.style.cursor = 'crosshair';
                this.draw();
                return;
            }
        }

        // Start selection

        this.isDrawing = true;
        this.selectionStart = coords;
        this.selectionEnd = coords;

        // Initialize hoveredTiles with the starting tile
        if (this.selectionMode === 'line') {
            this.hoveredTiles.clear();
            this.hoveredTiles.add(`${coords.x},${coords.y}`);
        }


        this.draw();
        this.drawSelection();
    },

    handleMouseMove(event) {
        const coords = this.getTileCoordinates(event);
        if (coords.x < 0 || coords.x >= this.mapWidth || coords.y < 0 || coords.y >= this.mapHeight) return;

        if (this.isSelectDragging) {
            const offsetX = coords.x - this.selectDragStart.x;
            const offsetY = coords.y - this.selectDragStart.y;
            this.selectDragOffset = { x: offsetX, y: offsetY };
            this.draw();
            this.drawSelectDragGhost(offsetX, offsetY);
            this.selectDragLastPos = { ...coords };
            return;
        }

        if (this.isDragging) {
            this.draw(); // Redraw the base map

            const draggedTile = this.tileDefinitions[this.draggedTileId];
            if (draggedTile) {
                this.drawTilePreview(this.draggedTileId, coords.x, coords.y, 0.7); // 0.7 alpha for preview

                // Mirroring preview logic
                const size = draggedTile.size || 1;
                const mirrorY = this.mapHeight - 1 - coords.y;
                const mirrorX = this.mapWidth - 1 - coords.x;

                if (this.mirrorVertical) {
                    const adjustedY = size === 2 ? mirrorY - 1 : mirrorY;
                    const mirrorId = this.getMirroredTileId(this.draggedTileId, 'vertical');
                    if (adjustedY >= 0 && adjustedY < this.mapHeight) {
                        this.drawTilePreview(mirrorId, coords.x, adjustedY, 0.7);
                    }
                }
                if (this.mirrorHorizontal) {
                    const adjustedX = size === 2 ? mirrorX - 1 : mirrorX;
                    const mirrorId = this.getMirroredTileId(this.draggedTileId, 'horizontal');
                    if (adjustedX >= 0 && adjustedX < this.mapWidth) {
                        this.drawTilePreview(mirrorId, adjustedX, coords.y, 0.7);
                    }
                }
                if (this.mirrorDiagonal) {
                    const adjustedY = size === 2 ? mirrorY - 1 : mirrorY;
                    const adjustedX = size === 2 ? mirrorX - 1 : mirrorX;
                    const mirrorId = this.getMirroredTileId(this.draggedTileId, 'diagonal');
                    if (adjustedX >= 0 && adjustedX < this.mapWidth && adjustedY >= 0 && adjustedY < this.mapHeight) {
                        this.drawTilePreview(mirrorId, adjustedX, adjustedY, 0.7);
                    }
                }
            }
            return;
        }

        if (this.isDrawing) {
            this.selectionEnd = coords;

            // Add the current tile to hoveredTiles for line selection
            if (this.selectionMode === 'line') {
                this.hoveredTiles.add(`${coords.x},${coords.y}`);
            }

            this.draw();
            this.drawSelection();
        }
    },

    handleMouseUp(event) {
        this.mouseDown = false;
        if (this.isSelectDragging) {
            const offsetX = this.selectDragOffset.x;
            const offsetY = this.selectDragOffset.y;
            // Place tiles using placeTile (handles 2x2 and mirroring). We already saved state at drag-start.
            for (const t of this.selectDragTiles) {
                const newX = t.x + offsetX;
                const newY = t.y + offsetY;
                if (
                    newX >= 0 && newX < this.mapWidth &&
                    newY >= 0 && newY < this.mapHeight
                ) {
                    // Temporarily set draggedTileLayer to preserve original layer
                    const originalLayer = t.layer !== undefined ? t.layer : this.defaultTileLayer;
                    const wasDragging = this.isDragging;
                    const oldDraggedLayer = this.draggedTileLayer;

                    this.isDragging = true;
                    this.draggedTileLayer = originalLayer;

                    // placeTile will call eraseTile internally and handle mirroring
                    this.placeTile(newX, newY, t.id, false);

                    // Restore state
                    this.isDragging = wasDragging;
                    this.draggedTileLayer = oldDraggedLayer;
                }
            }
            this.isSelectDragging = false;
            this.selectDragStart = null;
            this.selectDragOffset = { x: 0, y: 0 };
            this.selectDragTiles = [];
            this.activeToolBrushs = [];
            this.draw();
            return;
        }

        if (!this.isDragging && this.isDrawing) {
            const coords = this.getTileCoordinates(event);
            if (coords.x >= 0 && coords.x < this.mapWidth && coords.y >= 0 && coords.y < this.mapHeight) {
                if (this.selectionMode === 'single') {
                    if (this.isErasing) {
                        this.eraseTile(coords.x, coords.y);
                    } else {
                        this.placeTile(coords.x, coords.y);
                    }
                } else {
                    this.placeTilesInSelection();
                }
            }
        } else if (this.isDragging) {
            const coords = this.getTileCoordinates(event);
            if (coords.x >= 0 && coords.x < this.mapWidth && coords.y >= 0 && coords.y < this.mapHeight) {
                // Delegate to existing placement logic (handles validation, 2x2, mirroring, state)
                this.placeTile(coords.x, coords.y, this.draggedTileId);
                this.draw();
            }
        }

        // Reset all states
        this.isDragging = false;
        this.isDrawing = false;
        this.draggedTileId = null;
        this.dragStartX = null;
        this.dragStartY = null;
        this.selectionStart = null;
        this.selectionEnd = null;
        this.hoveredTiles.clear();
        this.canvas.style.cursor = 'crosshair';
        this.draw();
    },

    handleMouseLeave() {
        this.isDrawing = false;
        if (this.isDragging) {
            this.isDragging = false;
            this.draggedTileId = null;
            this.dragStartX = null;
            this.dragStartY = null;
            this.canvas.style.cursor = 'crosshair';
            this.draw();
        }
    },

    handleTouchStart(e) {
        if (this.viewPanActive) return; // Allow touch event to bubble up to editor panning handlers
        if (e.touches.length > 1) return; // Ignore multi-touch
        e.preventDefault();

        const touch = e.touches[0];
        const simulatedEvent = {
            button: 0,
            clientX: touch.clientX,
            clientY: touch.clientY,
        };

        this.handleMouseDown(simulatedEvent);
    },

    handleTouchMove(e) {
        if (this.viewPanActive) return; // Allow touch to bubble for panning
        if (e.touches.length > 1) return;
        e.preventDefault();

        const touch = e.touches[0];
        const simulatedEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
        };

        this.handleMouseMove(simulatedEvent);
    },

    handleTouchEnd(e) {
        if (this.viewPanActive) return; // Allow touch end bubbling
        e.preventDefault && e.preventDefault();

        // touchend has changedTouches: the touches that just ended
        const touch = e.changedTouches[0];
        if (!touch) {
            this.handleMouseUp(e); // fallback, no coordinates
            return;
        }

        const simulatedEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            // You can add button if your mouse handler expects it
            button: 0,
        };

        this.handleMouseUp(simulatedEvent);
    },

    handleTouchCancel(e) {
        this.handleMouseLeave();
    },

    initializeTileSelector() {
        if (this.headless) return;
        const container = document.getElementById('tileSelector');
        container.innerHTML = '';

        // Define the categories and tiles
        const categories = [
            { name: "Walls", tiles: ['Wall', 'Wall2', 'Unbreakable'] },
            { name: "Water", tiles: ['Water'] },
            { name: "Bushes", tiles: ['Bush'] },
            { name: "Fences & Obstacles", tiles: ['Crate', 'Barrel', 'Cactus', 'Fence', 'Skull', 'Rope Fence', 'BFence'] },
            { name: "Spawns", tiles: ['Blue Spawn', 'Blue Respawn', 'Red Spawn', 'Red Respawn', 'Trio Spawn', 'Yellow Spawn', 'BossSpawn', 'KaijuBoss', 'GenericBoss', 'OniHunt', 'GodzillaSpawn'] },
            { name: "Objectives & Items", tiles: ['Objective', 'Box', 'Box_Loaded', 'Powercube', 'Bumper', 'Bolt', 'TokenBlue', 'GodzillaCity1', 'GodzillaCity2', 'GodzillaCity3', 'GodzillaCity4', 'GodzillaExplosive', 'Escape', 'TokenRed', 'Boss Zone', 'Monster Zone', 'Bot_Zone', 'SubwayRun1', 'SubwayRun2', 'TreasurePad1', 'TreasurePad2', 'Amulet', 'Bomb', 'Track', 'Base Ike Blue', 'Base Ike Red', 'Small Ike Blue', 'Small Ike Red'] },
            { name: "Special", tiles: ['TNT', 'Speed Tile', 'Slow Tile', 'Spikes', 'Heal Pad', 'Smoke', 'IceTile', 'SnowTile', 'Rails', 'RedTrain', 'GreenTrain', 'YellowTrain'] },
            { name: "Jump Pads", tiles: ['Jump R', 'Jump L', 'Jump T', 'Jump B', 'Jump BR', 'Jump TL', 'Jump BL', 'Jump TR'] },
            { name: "Teleporters", tiles: ['Teleporter Blue', 'Teleporter Green', 'Teleporter Red', 'Teleporter Yellow'] }
        ];

        categories.forEach(category => {
            let categoryAdded = false;

            category.tiles.forEach(tileName => {
                const tileEntry = Object.entries(this.tileDefinitions)
                    .find(([_, def]) => def.name === tileName);

                if (!tileEntry) return;
                const [id, def] = tileEntry;

                if (id === '0' || id === '-1') return; // Skip empty and occupied tiles

                if (def.showInGamemode) {
                    const allowed = Array.isArray(def.showInGamemode) ? def.showInGamemode : [def.showInGamemode];
                    if (!allowed.includes(this.gamemode)) return;
                }
                if (def.showInEnvironment) {
                    const allowed = Array.isArray(def.showInEnvironment) ? def.showInEnvironment : [def.showInEnvironment];
                    if (!allowed.includes(this.environment)) return;
                }

                const btn = document.createElement('button');
                btn.className = 'tile-btn';
                btn.title = def.name;
                btn.id = id;

                if (def.img || def.getImg) {
                    const img = document.createElement('img');
                    img.parentEnvironment = this.environment; // Bound context for global theme filtering
                    if (def.img) {
                        img.src = `Resources/${def.img.replace('${env}', this.environment)}`;
                    } else if (def.getImg) {
                        const imgData = def.getImg(this.gamemode, 0, this.mapHeight, this.environment);
                        if (imgData) {
                            const imgPath = imgData.displayImg || imgData.img;
                            img.src = `Resources/${imgPath.replace('${env}', this.environment)}`;
                            img.onerror = () => {
                                if (this.environment !== 'Desert' && imgPath.includes('${env}')) {
                                    img.src = `Resources/${imgPath.replace('${env}', 'Desert')}`;
                                }
                            };
                        } else {
                            // Skip this tile if it's not valid for current gamemode
                            return;
                        }
                    }
                    img.alt = def.name;
                    btn.appendChild(img);
                }

                btn.addEventListener('click', () => {
                    this.activeToolBrush = { id: parseInt(id), ...def };
                    container.querySelectorAll('.tile-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    this.toggleEraseMode(false);
                    this.togglePanningMode(false);
                });

                if (!categoryAdded) {
                    const header = document.createElement('div');
                    header.className = 'tile-category-header';
                    header.textContent = category.name;
                    container.appendChild(header);
                    categoryAdded = true;
                }

                container.appendChild(btn);
            });
        });

        document.getElementById('tileSelector').querySelector(`.tile-btn[id="1"]`).classList.add('selected');
    },

    getTileCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        // Calculate mouse position relative to canvas
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;

        // Subtract padding to get position relative to map
        const mapX = mouseX - this.canvasPadding;
        const mapY = mouseY - this.canvasPadding;

        // Convert to tile coordinates
        const x = Math.floor(mapX / this.tileSize);
        const y = Math.floor(mapY / this.tileSize);

        return { x, y };
    }
};
