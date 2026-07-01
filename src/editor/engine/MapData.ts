// @ts-nocheck
export const MapDataMixin = {
    createEmptyLayerGrid(width = this.mapWidth, height = this.mapHeight) {
        return Array.from({ length: height }, () => Array(width).fill(0));
    },
    createEmptyLayeredMap(width = this.mapWidth, height = this.mapHeight) {
        return Array.from({ length: this.layerCount }, () => this.createEmptyLayerGrid(width, height));
    },
    resetAllLayers(width = this.mapWidth, height = this.mapHeight) {
        this.tileGrid = this.createEmptyLayeredMap(width, height);
        this.tileAuthors = {};
    },
    cloneLayeredMap(data = this.tileGrid) {
        return data.map(layer => {
            if (Array.isArray(layer)) {
                return layer.map(row => Array.isArray(row) ? [...row] : row);
            }
            return typeof layer === 'object' && layer !== null ? { ...layer } : layer;
        });
    },
    canPlaceTileOn(placingTileId, targetTileId) {
        const placingDef = this.tileDefinitions[placingTileId];
        if (!placingDef)
            return false;
        // If target is empty (0), check if placing tile can be placed on empty tiles
        if (targetTileId === 0) {
            // If placing tile has placeableOn property (and it's not -100), it cannot be placed on empty tiles
            if (placingDef.placeableOn && !placingDef.placeableOn.includes(-100)) {
                return false;
            }
            // Otherwise, can be placed on empty tiles
            return true;
        }
        const targetDef = this.tileDefinitions[targetTileId];
        if (!targetDef)
            return false;
        // If placing tile has placeableOn property
        if (placingDef.placeableOn) {
            // -100 means placeable on all tiles (including empty, but we already handled empty above)
            if (placingDef.placeableOn.includes(-100))
                return true;
            // Check if target tile ID is in the list
            return placingDef.placeableOn.includes(targetTileId);
        }
        // If target tile has placeableOnThis property
        if (targetDef.placeableOnThis) {
            // -100 means all tiles can be placed on it
            if (targetDef.placeableOnThis.includes(-100))
                return true;
            // Check if placing tile ID is in the list
            return targetDef.placeableOnThis.includes(placingTileId);
        }
        // Default: cannot place on existing tiles
        return false;
    },
    findTopmostTileAt(origX, origY) {
        for (let layerIndex = this.layerCount - 1; layerIndex >= 0; layerIndex--) {
            const layerGrid = this.tileGrid[layerIndex];
            if (!layerGrid)
                continue;
            let rawTileId = layerGrid[origY][origX];
            let realX = origX;
            let realY = origY;
            // 1. Step back logic parent resolution for native 2x2 components
            if (rawTileId === -1) {
                realX = origX - 1;
            }
            else if (rawTileId === -2) {
                realY = origY - 1;
            }
            else if (rawTileId === -3) {
                realX = origX - 1;
                realY = origY - 1;
            }
            if (realX >= 0 && realY >= 0 && realX < this.mapWidth && realY < this.mapHeight) {
                let resolvedId = layerGrid[realY][realX];
                if (resolvedId > 0) {
                    const def = this.tileDefinitions[resolvedId];
                    if (def)
                        return { layerIndex, tileId: resolvedId, def, x: realX, y: realY };
                }
            }
            // 2. Dynamic visual heuristic for large 1x1 dynamic objectives (e.g. Safe, Ike)
            // We scan a window around (origX, origY) to find Objectives and check their exact visual bounding box.
            const scanRadius = 5;
            const startScanX = Math.max(0, origX - scanRadius);
            const endScanX = Math.min(this.mapWidth - 1, origX + scanRadius);
            const startScanY = Math.max(0, origY - scanRadius);
            const endScanY = Math.min(this.mapHeight - 1, origY + scanRadius);
            for (let ny = startScanY; ny <= endScanY; ny++) {
                for (let nx = startScanX; nx <= endScanX; nx++) {
                    if (layerGrid[ny][nx] === 14) {
                        let dims = this.environmentObjectiveData[this.environment]?.[this.gamemode] || this.objectiveData[this.gamemode];
                        // Resolve Siege / Spirit Wars multi-state objective dimensions
                        if (dims && !Array.isArray(dims)) {
                            dims = (ny > this.mapHeight / 2) ? (dims.lower || dims.upper) : (dims.upper || dims.lower);
                        }
                        if (dims) {
                            const scaleX = dims[0];
                            const scaleY = dims[1];
                            const offsetX = dims[2] || 0;
                            const offsetY = dims[3] || 0;
                            const size = this.tileDefinitions[14]?.size || 1;
                            const physicalSizes = {
                                'Snowtel_Thieves': 2, 'Token_Run': 2, 'Siege': 2, 'Spirit_Wars': 2
                            };
                            const physicalSizeVal = physicalSizes[this.gamemode];
                            if (!physicalSizeVal)
                                continue; // Exclude 1x1 objectives from dynamic heuristic; they rely strictly on 1x1 Step 1 logic
                            const finalPhysicalSize = physicalSizeVal * size;
                            const visualCenterX = nx + (offsetX / 100) + (scaleX * size) / 2;
                            const visualCenterY = ny + (offsetY / 100) + (scaleY * size) / 2;
                            // Compute exact integer grid bounds for the physical size
                            const startX = Math.floor(visualCenterX - finalPhysicalSize / 2 + 0.5);
                            const endX = startX + finalPhysicalSize - 1;
                            const startY = Math.floor(visualCenterY - finalPhysicalSize / 2 + 0.5);
                            const endY = startY + finalPhysicalSize - 1;
                            // Check if click is inside the physical grid bounds
                            if (origX >= startX && origX <= endX &&
                                origY >= startY && origY <= endY) {
                                return { layerIndex, tileId: 14, def: this.tileDefinitions[14], x: nx, y: ny };
                            }
                        }
                    }
                }
            }
        }
        return null;
    },
    getTopmostTileAt(x, y) {
        // Use the robust findTopmostTileAt which resolves native 2x2 assets and dynamic visual footprints
        const found = this.findTopmostTileAt(x, y);
        if (found) {
            return { layerIndex: found.layerIndex, tileId: found.tileId, def: found.def };
        }
        return null;
    },
    placeTile(x, y, tileId = null, saveState = true) {
        if (this.viewPanActive)
            return; // Critical blocker: block all tile placements while panning
        this._errorsDirty = true;
        let id = tileId ?? this.activeToolBrush.id;
        const def = this.tileDefinitions[id];
        if (!def)
            return;
        const atTop = y < 4;
        const atBottom = y >= this.mapHeight - 4;
        const atLeft = x < 7;
        const atRight = x >= this.mapWidth - 7;
        if ((this.gamemode === 'Brawl_Ball' || this.gamemode === 'Hockey')
            && this.mapSize === this.mapSizes.regular
            && (atTop || atBottom) && (atLeft || atRight)) {
            this.isDrawing = false;
            return;
        }
        // Check if we're placing on an existing tile or empty tile
        let topmostTile = this.getTopmostTileAt(x, y);
        let targetTileId = topmostTile ? topmostTile.tileId : 0;

        // Auto-adopt color for Payload rails
        if (id === 77 || id === 79) {
            const adjacentRails = [];
            if (y > 0 && this.tileGrid[1] && this.tileGrid[1][y-1]) adjacentRails.push(this.tileGrid[1][y-1][x]);
            if (y < this.mapHeight - 1 && this.tileGrid[1] && this.tileGrid[1][y+1]) adjacentRails.push(this.tileGrid[1][y+1][x]);
            if (x > 0 && this.tileGrid[1] && this.tileGrid[1][y]) adjacentRails.push(this.tileGrid[1][y][x-1]);
            if (x < this.mapWidth - 1 && this.tileGrid[1] && this.tileGrid[1][y]) adjacentRails.push(this.tileGrid[1][y][x+1]);
            
            if (id === 77 && adjacentRails.includes(79)) {
                id = 79;
            } else if (id === 79 && adjacentRails.includes(77)) {
                id = 77;
            }
        }

        // Overwrite mode logic
        if (this.overwriteMode && targetTileId !== 0 && targetTileId !== id) {
            // Check if placeable on empty first, so we don't accidentally erase something we can't replace
            if (this.canPlaceTileOn(id, 0)) {
                this.eraseTile(x, y, false);
                topmostTile = this.getTopmostTileAt(x, y);
                targetTileId = topmostTile ? topmostTile.tileId : 0;
            }
        }

        const canPlace = this.canPlaceTileOn(id, targetTileId);
        if (!canPlace) {
            // Cannot place this tile here
            return;
        }

        // PAYLOAD TRAIN SPECIFIC RESTRICTION:
        // Must be placed on an empty cell adjacent to an End piece of the track,
        // and only ONE train per rail path!
        if (id === 78 || id === 80) {
            const railId = id === 78 ? 77 : 79;
            let validDx = 0, validDy = 0;
            
            const checkEnd = (ex: number, ey: number, dx: number, dy: number) => {
                if (ex < 0 || ey < 0 || ex >= this.mapWidth || ey >= this.mapHeight) return false;
                if (!this.tileGrid[1] || !this.tileGrid[1][ey] || this.tileGrid[1][ey][ex] !== railId) return false;
                
                let conns = 0;
                if (ey > 0 && this.tileGrid[1][ey-1][ex] === railId) conns++;
                if (ey < this.mapHeight - 1 && this.tileGrid[1][ey+1][ex] === railId) conns++;
                if (ex > 0 && this.tileGrid[1][ey][ex-1] === railId) conns++;
                if (ex < this.mapWidth - 1 && this.tileGrid[1][ey][ex+1] === railId) conns++;
                
                if (conns !== 1) return false;
                
                if (dx === 1 && ex < this.mapWidth - 1 && this.tileGrid[1][ey][ex+1] === railId) return true;
                if (dx === -1 && ex > 0 && this.tileGrid[1][ey][ex-1] === railId) return true;
                if (dy === 1 && ey < this.mapHeight - 1 && this.tileGrid[1][ey+1][ex] === railId) return true;
                if (dy === -1 && ey > 0 && this.tileGrid[1][ey-1][ex] === railId) return true;
                return false;
            };

            if (checkEnd(x+1, y, 1, 0)) { validDx = 1; validDy = 0; }
            else if (checkEnd(x-1, y, -1, 0)) { validDx = -1; validDy = 0; }
            else if (checkEnd(x, y+1, 0, 1)) { validDx = 0; validDy = 1; }
            else if (checkEnd(x, y-1, 0, -1)) { validDx = 0; validDy = -1; }
            
            if (validDx === 0 && validDy === 0) {
                return; // Invalid placement
            }
            
            // Trace the track to ensure no other train is placed on it
            const trackRails = new Set<string>();
            const queue = [[x + validDx, y + validDy]];
            trackRails.add(`${x+validDx},${y+validDy}`);
            
            while (queue.length > 0) {
                const [cx, cy] = queue.shift()!;
                const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
                for (let [ddx, ddy] of dirs) {
                    const nx = cx + ddx;
                    const ny = cy + ddy;
                    if (nx < 0 || ny < 0 || nx >= this.mapWidth || ny >= this.mapHeight) continue;
                    if (!trackRails.has(`${nx},${ny}`) && this.tileGrid[1] && this.tileGrid[1][ny] && this.tileGrid[1][ny][nx] === railId) {
                        trackRails.add(`${nx},${ny}`);
                        queue.push([nx, ny]);
                    }
                }
            }
            
            let hasOtherTrain = false;
            for (let ty = 0; ty < this.mapHeight; ty++) {
                for (let tx = 0; tx < this.mapWidth; tx++) {
                    if (tx === x && ty === y) continue;
                    let isTrain = false;
                    for (let l = 1; l <= 2; l++) {
                        if (this.tileGrid[l] && this.tileGrid[l][ty] && (this.tileGrid[l][ty][tx] === 78 || this.tileGrid[l][ty][tx] === 80)) {
                            isTrain = true;
                            break;
                        }
                    }
                    if (isTrain) {
                        let tDx = 0, tDy = 0;
                        if (checkEnd(tx+1, ty, 1, 0)) { tDx = 1; tDy = 0; }
                        else if (checkEnd(tx-1, ty, -1, 0)) { tDx = -1; tDy = 0; }
                        else if (checkEnd(tx, ty+1, 0, 1)) { tDx = 0; tDy = 1; }
                        else if (checkEnd(tx, ty-1, 0, -1)) { tDx = 0; tDy = -1; }
                        
                        if (trackRails.has(`${tx},${ty}`) || ((tDx !== 0 || tDy !== 0) && trackRails.has(`${tx+tDx},${ty+tDy}`))) {
                            hasOtherTrain = true;
                            break;
                        }
                    }
                }
                if (hasOtherTrain) break;
            }
            
            if (hasOtherTrain) {
                return; // Another train exists on this track
            }
        }
        const isPlacingOnExisting = topmostTile !== null;
        // Determine which layer to place on
        // If dragging, use the dragged tile's original layer
        // Otherwise, use the tile's defined layer or default
        const targetLayer = this.isDragging && this.draggedTileLayer !== undefined
            ? this.draggedTileLayer
            : (typeof def.layer === 'number' ? def.layer : this.defaultTileLayer);
        // If placing on an existing tile, don't erase it - place on top
        // Otherwise, erase the existing tile first
        if (!isPlacingOnExisting) {
            this.eraseTile(x, y, false);
            // Check if we can place this tile (for 2x2 tiles)
            if (def.size === 2) {
                if (x >= this.mapWidth - 1 || y >= this.mapHeight - 1)
                    return;
                for (let dy = 0; dy < 2; dy++) {
                    for (let dx = 0; dx < 2; dx++) {
                        this.eraseTile(x + dx, y + dy, false);
                    }
                }
            }
        }
        else {
            // When placing on existing tile, check 2x2 bounds
            if (def.size === 2) {
                if (x >= this.mapWidth - 1 || y >= this.mapHeight - 1)
                    return;
            }
        }
        // Handle special cases for objectives
        if (def.getImg) {
            const gm = this.gamemode === 'custom' ? 'Gem_Grab' : this.gamemode;
            const imgData = def.getImg(gm, y, this.mapHeight, this.environment);
            if (!imgData)
                return; // Invalid for current gamemode
        }
        // Only show Bolt in Siege mode
        if (this.gamemode !== 'custom') {
            if (def.showInGamemode && !def.showInGamemode.includes(this.gamemode))
                return;
        }
        // Save state before making changes if requested
        if (saveState) {
            this.saveState();
        }
        // Place the tile on the correct layer
        this.tileGrid[targetLayer][y][x] = id;
        if (this.currentUsername && !this.isProcessingRemote) {
            if (!this.tileAuthors) this.tileAuthors = {};
            this.tileAuthors[`${y},${x}`] = this.currentUsername;
        }
        // For 2x2 tiles, mark the other tiles as occupied
        if (def.size === 2) {
            this.tileGrid[targetLayer][y][x + 1] = -1;
            this.tileGrid[targetLayer][y + 1][x] = -2;
            this.tileGrid[targetLayer][y + 1][x + 1] = -3;
        }
        // Handle mirroring
        if (this.mirrorVertical || this.mirrorHorizontal || this.mirrorDiagonal) {
            // Calculate mirror positions first
            const mirrorY = this.mapHeight - 1 - y;
            const mirrorX = this.mapWidth - 1 - x;
            // For 2x2 tiles, we need to adjust the mirror position
            const size = def.size || 1;
            // Get mirrored tile ID (for jump pads)
            const mirrorV = this.getMirroredTileId(id, 'vertical');
            const mirrorH = this.getMirroredTileId(id, 'horizontal');
            const mirrorD = this.getMirroredTileId(id, 'diagonal');
            // Helper function to place a tile and its occupied spaces
            const placeMirroredTile = (ty, tx, mid) => {
                if (ty < 0 || ty >= this.mapHeight || tx < 0 || tx >= this.mapWidth)
                    return;
                if (size === 2) {
                    if (tx >= this.mapWidth - 1 || ty >= this.mapHeight - 1)
                        return;
                    // Check if any tiles are occupied
                    for (let dy = 0; dy < 2; dy++) {
                        for (let dx = 0; dx < 2; dx++) {
                            if (this.tileGrid[targetLayer][ty + dy][tx + dx] !== 0)
                                return;
                        }
                    }
                    // BUG-05 fix: correct sub-cell IDs so findTopmostTileAt resolves them properly
                    this.tileGrid[targetLayer][ty][tx] = mid;
                    this.tileGrid[targetLayer][ty][tx + 1] = -1;
                    this.tileGrid[targetLayer][ty + 1][tx] = -2;
                    this.tileGrid[targetLayer][ty + 1][tx + 1] = -3;
                }
                else {
                    this.tileGrid[targetLayer][ty][tx] = mid;
                }
            };
            // Apply vertical mirroring - for 2x2 tiles, adjust by 1 tile back in rows
            if (this.mirrorVertical) {
                const adjustedY = size === 2 ? mirrorY - 1 : mirrorY;
                placeMirroredTile(adjustedY, x, mirrorV);
            }
            // Apply horizontal mirroring - for 2x2 tiles, adjust by 1 tile back in columns
            if (this.mirrorHorizontal) {
                const adjustedX = size === 2 ? mirrorX - 1 : mirrorX;
                placeMirroredTile(y, adjustedX, mirrorH);
            }
            // Apply diagonal mirroring - for 2x2 tiles, adjust by 1 tile back in both rows and columns
            if (this.mirrorDiagonal) {
                const adjustedY = size === 2 ? mirrorY - 1 : mirrorY;
                const adjustedX = size === 2 ? mirrorX - 1 : mirrorX;
                placeMirroredTile(adjustedY, adjustedX, mirrorD);
            }
        }
        if (saveState) {
            this.draw();
        }
        if (typeof this.broadcastMapUpdate === 'function' && !this.isProcessingRemote) {
            this.broadcastMapUpdate({ type: 'place', x, y, tileId: id, author: this.currentUsername });
        }
    },
    getMirroredTileId(tileId, direction) {
        const def = this.tileDefinitions[tileId];
        if (!def && !this.smartSymmetry)
            return tileId;
            
        // Handle Payload Rails/Trains color swapping
        if (this.gamemode === 'Payload' && direction === 'diagonal') {
            if (tileId === 77) return 79; // Blue Rail -> Red Rail
            if (tileId === 79) return 77; // Red Rail -> Blue Rail
            if (tileId === 78) return 80; // Blue Train -> Red Train
            if (tileId === 80) return 78; // Red Train -> Blue Train
        }
        
        // Handle jump pad mirroring
        if (def.name.startsWith('Jump')) {
            const mirrorMaps = {
                'Jump R': { vertical: 'R', horizontal: 'L', diagonal: 'L' },
                'Jump L': { vertical: 'L', horizontal: 'R', diagonal: 'R' },
                'Jump T': { vertical: 'B', horizontal: 'T', diagonal: 'B' },
                'Jump B': { vertical: 'T', horizontal: 'B', diagonal: 'T' },
                'Jump TR': { vertical: 'BR', horizontal: 'TL', diagonal: 'BL' },
                'Jump TL': { vertical: 'BL', horizontal: 'TR', diagonal: 'BR' },
                'Jump BR': { vertical: 'TR', horizontal: 'BL', diagonal: 'TL' },
                'Jump BL': { vertical: 'TL', horizontal: 'BR', diagonal: 'TR' }
            };
            const mirroredDirection = mirrorMaps[def.name][direction];
            // Find tile ID by mirrored name
            const mirroredDef = Object.entries(this.tileDefinitions)
                .find(([_, d]) => d.name === `Jump ${mirroredDirection}`);
            return mirroredDef ? parseInt(mirroredDef[0]) : tileId;
        }
        // PAYLOAD SYMMETRY (Blue <-> Red)
        switch (tileId) {
            case 77: return 79;
            case 79: return 77;
            case 78: return 80;
            case 80: return 78;
        }
        // ПРИНУДИТЕЛЬНАЯ ЗЕРКАЛЬНОСТЬ ДЛЯ СПАВНОВ И БАЗ (чтобы синее не переносилось на красную сторону)
        switch (tileId) {
            case 12: return 13; // Blue Spawn -> Red Spawn
            case 13: return 12; // Red Spawn -> Blue Spawn
            case 34: return 35; // TokenBlue -> TokenRed
            case 35: return 34;
            case 41: return 42; // Blue Respawn -> Red Respawn
            case 42: return 41;
            case 43: return 46; // Base Ike
            case 46: return 43;
            case 44: return 47; // Small Ike
            case 47: return 44;
        }
        if (this.smartSymmetry) {
            // Оставляем пустой или для будущих декоративных переворотов
        }
        return tileId;
    },
    eraseTile(x, y, saveState = true) {
        if (this.viewPanActive)
            return; // Critical blocker: block erase operations while panning
        this._errorsDirty = true;
        if (saveState) {
            this.saveState();
        }
        // Find the topmost placeable tile to erase
        const topmostTile = this.findTopmostTileAt(x, y);
        if (!topmostTile) {
            // No tile found, nothing to erase
            return;
        }
        const { layerIndex, tileId, def, x: rootX, y: rootY } = topmostTile;
        // Erase parent tile and secondary cells if 2x2
        this.tileGrid[layerIndex][rootY][rootX] = 0;
        if (this.tileAuthors && !this.isProcessingRemote) {
            delete this.tileAuthors[`${rootY},${rootX}`];
        }
        if (def && def.size === 2) {
            if (rootX < this.mapWidth - 1)
                this.tileGrid[layerIndex][rootY][rootX + 1] = 0;
            if (rootY < this.mapHeight - 1)
                this.tileGrid[layerIndex][rootY + 1][rootX] = 0;
            if (rootX < this.mapWidth - 1 && rootY < this.mapHeight - 1)
                this.tileGrid[layerIndex][rootY + 1][rootX + 1] = 0;
        }
        // Handle mirroring for regular tiles
        if (this.mirrorVertical || this.mirrorHorizontal || this.mirrorDiagonal) {
            const mirrorY = this.mapHeight - 1 - y;
            const mirrorX = this.mapWidth - 1 - x;
            // Find topmost tile at mirror position
            const mirrorTopmost = this.findTopmostTileAt(mirrorX, mirrorY);
            const mirrorLayer = mirrorTopmost ? mirrorTopmost.layerIndex : layerIndex;
            if (this.mirrorVertical) {
                if (def && def.size === 2) {
                    this.tileGrid[mirrorLayer][mirrorY - 1][x] = 0;
                    this.tileGrid[mirrorLayer][mirrorY - 1][x + 1] = 0;
                    this.tileGrid[mirrorLayer][mirrorY][x + 1] = 0;
                }
                this.tileGrid[mirrorLayer][mirrorY][x] = 0;
            }
            if (this.mirrorHorizontal) {
                if (def && def.size === 2) {
                    this.tileGrid[mirrorLayer][y + 1][mirrorX] = 0;
                    this.tileGrid[mirrorLayer][y][mirrorX - 1] = 0;
                    this.tileGrid[mirrorLayer][y + 1][mirrorX - 1] = 0;
                }
                this.tileGrid[mirrorLayer][y][mirrorX] = 0;
            }
            if (this.mirrorDiagonal) {
                if (def && def.size === 2) {
                    this.tileGrid[mirrorLayer][mirrorY - 1][mirrorX - 1] = 0;
                    this.tileGrid[mirrorLayer][mirrorY - 1][mirrorX] = 0;
                    this.tileGrid[mirrorLayer][mirrorY][mirrorX - 1] = 0;
                }
                this.tileGrid[mirrorLayer][mirrorY][mirrorX] = 0;
            }
        }
        if (saveState) {
            this.draw();
        }
        if (typeof this.broadcastMapUpdate === 'function' && !this.isProcessingRemote) {
            this.broadcastMapUpdate({ type: 'erase', x, y });
        }
    },
    clearMap(confirmed = false) {
        if (confirmed || confirm('Are you sure you want to clear the map?')) {
            // Save state before making changes
            this.saveState();
            this.resetAllLayers();
            this._errorsDirty = true;
            this.draw();
            if (typeof this.broadcastMapUpdate === 'function' && !this.isProcessingRemote) {
                this.broadcastMapUpdate({ type: 'clear' });
            }
        }
    },
    placeDefaultSpawns() {
        const { mapWidth, mapHeight } = this;
        const midX = Math.floor(mapWidth / 2);
        const topY = 0;
        const bottomY = mapHeight - 1;
        if (this.mapSize === this.mapSizes.regular) {
            if (this.gamemode === 'Duels') {
                this.placeTile(midX, topY, 13, false); // Red
                this.placeTile(midX, bottomY, 12, false); // Blue
            }
            else if (this.gamemode === 'Brawl_Ball' || this.gamemode === 'Hockey' || this.gamemode === 'Paint_Brawl') {
                // Primary Spawns at Row 8
                this.placeTile(midX, 8, 13, false); // Red
                this.placeTile(midX, bottomY - 8, 12, false); // Blue
                this.placeTile(midX - 2, 8, 13, false); // Red
                this.placeTile(midX - 2, bottomY - 8, 12, false); // Blue
                this.placeTile(midX + 2, 8, 13, false); // Red
                this.placeTile(midX + 2, bottomY - 8, 12, false); // Blue
                // Secondary Respawn anchors at boundaries (uses highest layer)
                this.placeTile(midX, 0, 42, false); // Red Respawn
                this.placeTile(midX, bottomY, 41, false); // Blue Respawn
                this.placeTile(midX - 2, 0, 42, false); // Red Respawn
                this.placeTile(midX - 2, bottomY, 41, false); // Blue Respawn
                this.placeTile(midX + 2, 0, 42, false); // Red Respawn
                this.placeTile(midX + 2, bottomY, 41, false); // Blue Respawn
            }
            else {
                // Conventional layouts (Gem Grab, Bounty, Heist, Siege, etc.)
                [midX - 2, midX, midX + 2].forEach(x => {
                    this.placeTile(x, topY, 13, false);
                    this.placeTile(x, bottomY, 12, false);
                });
            }
        }
        else if (this.mapSize === this.mapSizes.basket) {
            this.placeTile(mapWidth - 2, 6, 13, false); // Red
            this.placeTile(1, 6, 12, false); // Blue
            this.placeTile(mapWidth - 2, 8, 13, false); // Red
            this.placeTile(1, 8, 12, false); // Blue
            this.placeTile(mapWidth - 2, 10, 13, false); // Red
            this.placeTile(1, 10, 12, false); // Blue
        }
    },
    applyDefaultLayoutIfEmpty() {
        console.trace('applyDefaultLayoutIfEmpty triggered');
        const { mapWidth, mapHeight } = this;
        this.resetAllLayers(mapWidth, mapHeight);
        // Dynamically place correct spawning profiles
        this.placeDefaultSpawns();
        // Showdown-specific structure generation
        if (this.mapSize === this.mapSizes.showdown && (this.gamemode === 'Brawl_Ball' || this.gamemode === 'Hockey')) {
            const centerX = Math.floor(mapWidth / 2);
            const centerY = Math.floor(mapHeight / 2);
            // Construct unbreakable walls on side channels
            for (let y = centerY - 8; y <= centerY + 7; y++) {
                this.tileGrid[this.defaultTileLayer][y][9] = 11;
                this.tileGrid[this.defaultTileLayer][y][mapWidth - 10] = 11;
            }
            // Construct lateral unbreakable barrier bars
            for (let x = 9; x <= 13; x++) {
                this.tileGrid[this.defaultTileLayer][centerY + 7][x] = 11;
                this.tileGrid[this.defaultTileLayer][centerY + 7][mapWidth - x - 1] = 11;
                this.tileGrid[this.defaultTileLayer][centerY - 8][x] = 11;
                this.tileGrid[this.defaultTileLayer][centerY - 8][mapWidth - x - 1] = 11;
            }
            // Lay down default water zones from lateral boundaries
            for (let y = 0; y < mapHeight; y++) {
                for (let x = 0; x <= 8; x++)
                    this.tileGrid[this.defaultTileLayer][y][x] = 8;
                for (let x = mapWidth - 9; x < mapWidth; x++)
                    this.tileGrid[this.defaultTileLayer][y][x] = 8;
            }
        }
        this.draw();
    },
    promptCustomMapSize() {
        return new Promise((resolve) => {
            if (this.headless) { resolve(null); return; }

            let modal = document.getElementById('customMapSizeModal');
            if (!modal) {
                const html = `
                    <div class="modal-overlay" id="customMapSizeModal" style="z-index: 9999; display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); align-items: center; justify-content: center;">
                        <div class="modal-container" style="background: #1e1e24; border-radius: 12px; width: 90%; max-width: 380px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                            <header style="display:flex; justify-content:space-between; align-items:center; padding: 1rem 1.5rem; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <h2 style="margin:0; font-size:1.1rem; font-weight:600; color:#fff;">Custom Map Size</h2>
                                <button id="closeCustomSizeBtn" style="background:none; border:none; color:#fff; font-size:1.5rem; cursor:pointer; line-height:1;">&times;</button>
                            </header>
                            <div style="display:flex; flex-direction:column; gap:1rem; padding:1.5rem;">
                                <p style="font-size:0.82rem; color:rgba(255,255,255,0.6); margin:0;">Enter the map size in tiles. Values are clamped between 5 and 100.</p>
                                <div style="display:flex; flex-direction:column; gap:0.35rem;">
                                    <label style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:rgba(255,255,255,0.4);">Width (tiles)</label>
                                    <input type="number" id="customMapWidthInput" min="5" max="100" value="21" style="width:100%; box-sizing:border-box; padding:0.6rem 0.75rem; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; font-size:0.9rem;">
                                </div>
                                <div style="display:flex; flex-direction:column; gap:0.35rem;">
                                    <label style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:rgba(255,255,255,0.4);">Height (tiles)</label>
                                    <input type="number" id="customMapHeightInput" min="5" max="100" value="33" style="width:100%; box-sizing:border-box; padding:0.6rem 0.75rem; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; font-size:0.9rem;">
                                </div>
                            </div>
                            <footer style="display:flex; gap:1rem; padding:1.2rem; background:rgba(0,0,0,0.1); border-top:1px solid rgba(255,255,255,0.05);">
                                <button id="cancelCustomSizeBtn" style="flex:1; padding:0.75rem; background:rgba(255,255,255,0.1); border:none; border-radius:6px; color:#fff; cursor:pointer;">Cancel</button>
                                <button id="applyCustomSizeBtn" style="flex:1; padding:0.75rem; background:#8b5cf6; border:none; border-radius:6px; color:#fff; cursor:pointer; font-weight:600;">Apply</button>
                            </footer>
                        </div>
                    </div>`;
                const div = document.createElement('div');
                div.innerHTML = html;
                document.body.appendChild(div);
                modal = document.getElementById('customMapSizeModal');
            }

            const widthInput = document.getElementById('customMapWidthInput');
            const heightInput = document.getElementById('customMapHeightInput');
            const applyBtn = document.getElementById('applyCustomSizeBtn');
            const cancelBtn = document.getElementById('cancelCustomSizeBtn');
            const closeBtn = document.getElementById('closeCustomSizeBtn');

            if (!modal || !widthInput || !heightInput || !applyBtn || !cancelBtn || !closeBtn) {
                resolve(null);
                return;
            }

            // Pre-fill with the existing custom size (if any), else the current map size
            const existing = this.mapSizes.custom;
            widthInput.value  = String((existing && existing.width)  || this.mapWidth  || 21);
            heightInput.value = String((existing && existing.height) || this.mapHeight || 33);

            modal.style.display = 'flex';

            const cleanup = (result) => {
                modal.style.display = 'none';
                applyBtn.onclick = null;
                cancelBtn.onclick = null;
                closeBtn.onclick = null;
                resolve(result);
            };

            applyBtn.onclick = () => {
                const w = Math.max(5, Math.min(100, parseInt(widthInput.value, 10) || 21));
                const h = Math.max(5, Math.min(100, parseInt(heightInput.value, 10) || 33));
                cleanup({ width: w, height: h });
            };
            cancelBtn.onclick = () => cleanup(null);
            closeBtn.onclick = () => cleanup(null);
        });
    },

    async setSize(size, changing = true) {
        const newSize = this.mapSizes[size];
        if (!newSize)
            return;
        if (!changing || this.undoStack.length === 0 || confirm('Changing map size will clear the current map. Continue?')) {
            this.mapSize = newSize;
            this.mapWidth = newSize.width;
            this.mapHeight = newSize.height;
            this.resetAllLayers();
            const sizeSelect = document.getElementById('mapSize');
            if (sizeSelect) {
                sizeSelect.value = size;
            }
            // вЂ”вЂ”вЂ” Showdown в†” other: adjust Objective tile + data sizes вЂ”вЂ”вЂ”
            // BUG-03 fix: renamed inner fn to avoid shadowing the outer `size` parameter
            const isShowdownSize = (s) => s === this.mapSizes.showdown;
            const isShowdownNow = isShowdownSize(newSize);
            if (!isShowdownNow) {
                this.minZoom = 0.2;
                this.delta = 1.75;
                this.zoomLevel = 0.575;
                this.tileDefinitions[14].size = 1;
                this.objectiveData.Gem_Grab[0] = 2; // width
                this.objectiveData.Gem_Grab[1] = 2; // height
                this.objectiveData.Gem_Grab[2] = -50;
                this.objectiveData.Gem_Grab[3] = -50;
                this.objectiveData.Brawl_Ball[0] = 1.3;
                this.objectiveData.Brawl_Ball[1] = 1.495;
                this.objectiveData.Brawl_Ball[2] = -15;
                this.objectiveData.Brawl_Ball[3] = -20;
                this.objectiveData.Basket_Brawl[0] = 1.3;
                this.objectiveData.Basket_Brawl[1] = 1.495;
                this.objectiveData.Basket_Brawl[2] = -15;
                this.objectiveData.Basket_Brawl[3] = -20;
                this.objectiveData.Volley_Brawl[0] = 1.3;
                this.objectiveData.Volley_Brawl[1] = 1.495;
                this.objectiveData.Volley_Brawl[2] = -15;
                this.objectiveData.Volley_Brawl[3] = -20;
                this.objectiveData.Hot_Zone[0] = 7;
                this.objectiveData.Hot_Zone[1] = 7;
                this.objectiveData.Hot_Zone[2] = -300;
                this.objectiveData.Hot_Zone[3] = -300;
                this.objectiveData.Bounty[0] = 1.15;
                this.objectiveData.Bounty[1] = 2.0585;
                this.objectiveData.Bounty[2] = -10;
                this.objectiveData.Bounty[3] = -50;
                this.objectiveData.Heist[0] = 2;
                this.objectiveData.Heist[1] = 2.21;
                this.objectiveData.Heist[2] = -50;
                this.objectiveData.Heist[3] = -115;
                this.objectiveData.Snowtel_Thieves[0] = 4;
                this.objectiveData.Snowtel_Thieves[1] = 4;
                this.objectiveData.Snowtel_Thieves[2] = -150;
                this.objectiveData.Snowtel_Thieves[3] = -150;
                this.objectiveData.Hockey[0] = 1.5;
                this.objectiveData.Hockey[1] = 1.695;
                this.objectiveData.Hockey[2] = -10;
                this.objectiveData.Hockey[3] = -15;
                this.objectiveData.Lone_Star[0] = 1.15;
                this.objectiveData.Lone_Star[1] = 2.0585;
                this.objectiveData.Lone_Star[2] = -10;
                this.objectiveData.Lone_Star[3] = -50;
            }
            else {
                this.minZoom = 0.15;
                this.delta = 0.5;
                this.zoomLevel = 0.3;
                this.tileDefinitions[14].size = 2;
                // restore original width/height
                this.objectiveData.Gem_Grab[0] = 1;
                this.objectiveData.Gem_Grab[1] = 1;
                this.objectiveData.Gem_Grab[2] = 0;
                this.objectiveData.Gem_Grab[3] = 0;
                this.objectiveData.Brawl_Ball[0] = 0.65;
                this.objectiveData.Brawl_Ball[1] = 0.7475;
                this.objectiveData.Brawl_Ball[2] = 30;
                this.objectiveData.Brawl_Ball[3] = 30;
                this.objectiveData.Basket_Brawl[0] = 0.65;
                this.objectiveData.Basket_Brawl[1] = 0.7475;
                this.objectiveData.Basket_Brawl[2] = 30;
                this.objectiveData.Basket_Brawl[3] = 30;
                this.objectiveData.Volley_Brawl[0] = 0.65;
                this.objectiveData.Volley_Brawl[1] = 0.7475;
                this.objectiveData.Volley_Brawl[2] = 30;
                this.objectiveData.Volley_Brawl[3] = 30;
                this.objectiveData.Hot_Zone[0] = 3.5;
                this.objectiveData.Hot_Zone[1] = 3.5;
                this.objectiveData.Hot_Zone[2] = -250;
                this.objectiveData.Hot_Zone[3] = -250;
                this.objectiveData.Bounty[0] = 0.575;
                this.objectiveData.Bounty[1] = 1.02925;
                this.objectiveData.Bounty[2] = 41.5;
                this.objectiveData.Bounty[3] = 35;
                this.objectiveData.Heist[0] = 1;
                this.objectiveData.Heist[1] = 1.105;
                this.objectiveData.Heist[2] = 0;
                this.objectiveData.Heist[3] = -20;
                this.objectiveData.Snowtel_Thieves[0] = 2;
                this.objectiveData.Snowtel_Thieves[1] = 2;
                this.objectiveData.Snowtel_Thieves[2] = -100;
                this.objectiveData.Snowtel_Thieves[3] = -100;
                this.objectiveData.Hockey[0] = 0.85;
                this.objectiveData.Hockey[1] = 0.9475;
                this.objectiveData.Hockey[2] = 15;
                this.objectiveData.Hockey[3] = 19;
                this.objectiveData.Lone_Star[0] = 0.575;
                this.objectiveData.Lone_Star[1] = 1.02925;
                this.objectiveData.Lone_Star[2] = 41.5;
                this.objectiveData.Lone_Star[3] = 35;
            }
            // вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”вЂ”
            this.updateCanvasSize();
            this.autoScaleViewport();
            await this.setGamemode(this.gamemode);
        }
        else {
            // BUG-04 fix: `e` is not a parameter of setSize() — restore dropdown value safely
            const sizeSelect = document.getElementById('mapSize');
            if (sizeSelect) {
                const currentSizeKey = Object.entries(this.mapSizes)
                    .find(([, v]) => v.width === this.mapWidth && v.height === this.mapHeight)?.[0];
                if (currentSizeKey)
                    sizeSelect.value = currentSizeKey;
            }
        }
        if (typeof this.updateSelectOptionDots === 'function')
            this.updateSelectOptionDots();
    },
    async setEnvironment(environment) {
        const envSelect = document.getElementById('environment');
        if (envSelect) {
            envSelect.value = environment;
        }
        // 0. Dynamic Theme Hydration: Preload unowned custom skins from database prior to rendering
        if (typeof environment === 'string' && environment.startsWith('CUSTOM_')) {
            const packId = environment.replace('CUSTOM_', '');
            if (typeof window.ensureThemeLoaded === 'function') {
                await window.ensureThemeLoaded(packId);
            }
        }
        // Detect Custom themes vs standard biomes
        if (typeof environment === 'string' && environment.startsWith('CUSTOM_')) {
            localStorage.setItem('editor_active_skin', environment);
            this.environment = 'Desert'; // Enforce Desert baseline compatibility
        }
        else {
            localStorage.removeItem('editor_active_skin');
            this.environment = environment;
        }
        // Purge loaded images and path caches to force reload and trigger theme interceptors!
        this.tileImages = {};
        this.tileImagePaths = {};
        // Wait for key assets to finish loading to prevent race conditions
        await Promise.all([
            this.loadEnvironmentBackgrounds(),
            this.loadTileImages()
        ]);
        this.preloadWaterTiles();
        // NOTE: preloadGoalImage() is redundant here and triggers 404s. It is handled correctly in setGamemode().
        await this.setGamemode(this.gamemode, false);
        this.initializeTileSelector();
        this.draw();
        if (typeof this.updateSelectOptionDots === 'function')
            this.updateSelectOptionDots();
    },
    async setGamemode(gamemode, apply = true) {
        const gmSelect = document.getElementById('gamemode');
        if (gmSelect) {
            gmSelect.value = gamemode;
        }
        const previousGamemode = this.gamemode;
        this.gamemode = gamemode;
        this.goalImages = [];
        this.toggleMirroring();
        // Multi-layer scan to fully erase tiles that are not valid in the newly selected gamemode
        for (let layer = 0; layer < this.layerCount; layer++) {
            for (let y = 0; y < this.mapHeight; y++) {
                for (let x = 0; x < this.mapWidth; x++) {
                    const tileId = this.tileGrid[layer][y][x];
                    if (tileId <= 0)
                        continue;
                    const def = this.tileDefinitions[tileId];
                    if (!def)
                        continue;
                    let shouldPrune = false;
                    // FORCE PURGE dynamic objective (14) and standard spawn anchors (12, 13, 41, 42) to prevent overlap during mode transition
                    if ((tileId === 14 || tileId === 12 || tileId === 13 || tileId === 41 || tileId === 42) && previousGamemode !== gamemode) {
                        shouldPrune = true;
                    }
                    // Check list restrictions
                    if (this.gamemode !== 'custom') {
                        if (!shouldPrune && def.showInGamemode) {
                            const allowed = Array.isArray(def.showInGamemode) ? def.showInGamemode : [def.showInGamemode];
                            if (!allowed.includes(this.gamemode))
                                shouldPrune = true;
                        }
                        if (!shouldPrune && def.hideInGamemode) {
                            const hidden = Array.isArray(def.hideInGamemode) ? def.hideInGamemode : [def.hideInGamemode];
                            if (hidden.includes(this.gamemode))
                                shouldPrune = true;
                        }
                    }
                    // Check procedural image availability restrictions
                    if (!shouldPrune && def.getImg) {
                        const gm = this.gamemode === 'custom' ? 'Gem_Grab' : this.gamemode;
                        const hasImg = def.getImg(gm, y, this.mapHeight, this.environment);
                        if (!hasImg)
                            shouldPrune = true;
                    }
                    if (shouldPrune) {
                        this.tileGrid[layer][y][x] = 0;
                    }
                }
            }
        }
        const middleX = Math.floor(this.mapWidth / 2);
        const middleY = Math.floor(this.mapHeight / 2);
        const isBrawl = gamemode === 'Brawl_Ball' || gamemode === 'Hockey';
        const wasBrawl = previousGamemode === 'Brawl_Ball' || previousGamemode === 'Hockey';
        // REGULAR MAP - Brawl Ball
        if (this.mapSize === this.mapSizes.regular) {
            const corners = [[0, 0], [0, 14], [29, 0], [29, 14]];
            if (isBrawl) {
                for (const [startX, startY] of corners) {
                    for (let y = 0; y < 4; y++) {
                        for (let x = 0; x < 7; x++) {
                            this.tileGrid[this.defaultTileLayer][startX + y][startY + x] = 33; // Empty2 tile
                        }
                    }
                }
                let red = { name: 'goalRed', x: middleX - 3, y: 0, w: 7, h: 3.5, offsetX: 0, offsetY: -20 };
                let blue = { name: 'goalBlue', x: middleX - 3, y: this.mapHeight - 5, w: 7, h: 3.5, offsetX: 0, offsetY: -10 };
                if (this.environment === 'Stadium' || this.environment === 'Hockey' || this.environment === 'Z_CasinoTheme' || this.environment === 'Coin_Factory') {
                    red.h = 4.5;
                    red.offsetY = -40;
                    blue.h = 4.5;
                    blue.offsetY = 20;
                }
                else if (this.environment === 'Stunt_Show') {
                    red.w = 6;
                    red.h = 2;
                    blue.w = 6;
                    blue.h = 2;
                    red.offsetY = 15;
                    red.offsetX = 15;
                    blue.offsetY = 80;
                    blue.offsetX = 15;
                }
                this.goalImages.push(red, blue);
                await Promise.all(this.goalImages.map(goal => this.preloadGoalImage(goal.name, this.environment)));
                // NOTE: Spawns and Respawns are now correctly initialized inside placeDefaultSpawns().
            }
            else if (wasBrawl) {
                for (const [startX, startY] of corners) {
                    for (let y = 0; y < 4; y++) {
                        for (let x = 0; x < 7; x++) {
                            if (this.tileGrid[this.defaultTileLayer][startX + y][startY + x] === 33) {
                                this.tileGrid[this.defaultTileLayer][startX + y][startY + x] = 0;
                            }
                        }
                    }
                }
            }
        }
        // SHOWDOWN MAP - Brawl Ball
        if (this.mapSize === this.mapSizes.showdown && isBrawl) {
            this.goalImages.push({ name: 'goal5v5Blue', x: 11, y: middleY - 8.18, w: 3, h: 15.69, offsetX: -10, offsetY: -8 }, { name: 'goal5v5Red', x: this.mapWidth - 14, y: middleY - 8.18, w: 3, h: 15.69, offsetX: 10, offsetY: -8 });
            // в†ђ add this:
            await Promise.all(this.goalImages.map(g => this.preloadGoalImage(g.name, this.environment)));
        }
        if (apply && (this.tileGrid[this.defaultTileLayer].every(row => row.every(tile => tile === 0 || tile === 14 || tile === 13 || tile === 12 || tile === 33))))
            this.applyDefaultLayoutIfEmpty();
        // Unconditionally populate standard default objectives for the newly selected mode
        if (apply) {
            const midX = Math.floor(this.mapWidth / 2);
            const midY = Math.floor(this.mapHeight / 2);
            const singleCenterModes = ['Gem_Grab', 'Brawl_Ball', 'Bounty', 'Hot_Zone', 'Hold_The_Trophy', 'Basket_Brawl', 'Volley_Brawl', 'Dodgebrawl', 'Hockey', 'Bot_Drop', 'Paint_Brawl', 'Lone_Star'];
            if (this.mapSize !== this.mapSizes.showdown) {
                if (singleCenterModes.includes(this.gamemode)) {
                    this.placeTile(midX, midY, 14, false);
                }
                else if (this.gamemode === 'Heist' || this.gamemode === 'Snowtel_Thieves' || this.gamemode === 'Safe_Blast') {
                    this.placeTile(midX, 4, 14, false);
                    this.placeTile(midX, this.mapHeight - 5, 14, false);
                }
                else if (this.gamemode === 'Token_Run') {
                    this.placeTile(midX, 5, 14, false);
                    this.placeTile(midX, this.mapHeight - 6, 14, false);
                }
                else if (this.gamemode === 'Spirit_Wars') {
                    this.placeTile(midX, 3, 14, false);
                    this.placeTile(midX, this.mapHeight - 4, 14, false);
                }
            }
            else {
                // Showdown center alignment logic (e.g. 5v5 modes)
                if (singleCenterModes.includes(this.gamemode)) {
                    this.placeTile(midX - 1, midY - 1, 14, false);
                }
            }
        }
        // Unconditionally populate standard default spawns for the newly selected mode
        if (apply) {
            this.placeDefaultSpawns();
        }
        this.initializeTileSelector();
        this.loadTileImages();
        this.draw();
        this.toggleMirroring();
        if (typeof this.updateSelectOptionDots === 'function')
            this.updateSelectOptionDots();
    },
    rotateSelectedTiles() {
        if (this.activeToolBrushs.length === 0 || this.isSelectDragging)
            return;
        // Save state before making changes
        this.saveState();
        // Find the bounding rectangle of selected tiles
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const tile of this.activeToolBrushs) {
            minX = Math.min(minX, tile.x);
            minY = Math.min(minY, tile.y);
            maxX = Math.max(maxX, tile.x);
            maxY = Math.max(maxY, tile.y);
        }
        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        // Create a 2D array to store the original tile data
        const originalTiles = Array(height).fill().map(() => Array(width).fill(null));
        // Store original tile data with layer information
        for (const tile of this.activeToolBrushs) {
            const relativeX = tile.x - minX;
            const relativeY = tile.y - minY;
            originalTiles[relativeY][relativeX] = {
                id: tile.id,
                x: tile.x,
                y: tile.y,
                layer: tile.layer !== undefined ? tile.layer : this.defaultTileLayer
            };
        }
        // Clear the original tiles from the map (using their layer)
        for (const tile of this.activeToolBrushs) {
            const layer = tile.layer !== undefined ? tile.layer : this.defaultTileLayer;
            this.tileGrid[layer][tile.y][tile.x] = 0;
            // Also clear negative IDs for size 2 tiles
            const def = this.tileDefinitions[tile.id];
            if (def && def.size === 2) {
                this.tileGrid[layer][tile.y][tile.x + 1] = 0;
                this.tileGrid[layer][tile.y + 1][tile.x] = 0;
                this.tileGrid[layer][tile.y + 1][tile.x + 1] = 0;
            }
        }
        // Clear selected tiles array
        this.activeToolBrushs = [];
        // Rotate the tiles 90 degrees clockwise around the top-left corner (minX, minY)
        // For a 90-degree clockwise rotation: (x, y) -> (y, width - 1 - x)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const originalTile = originalTiles[y][x];
                if (originalTile) {
                    // Calculate new position after 90-degree clockwise rotation
                    const newRelativeX = y;
                    const newRelativeY = width - 1 - x;
                    const newX = minX + newRelativeX;
                    const newY = minY + newRelativeY;
                    // Check if the new position is within map bounds
                    if (newX >= 0 && newX < this.mapWidth && newY >= 0 && newY < this.mapHeight) {
                        // Place the tile at the new position on the correct layer
                        this.tileGrid[originalTile.layer][newY][newX] = originalTile.id;
                        // Handle negative IDs for size 2 tiles
                        const def = this.tileDefinitions[originalTile.id];
                        if (def && def.size === 2) {
                            this.tileGrid[originalTile.layer][newY][newX + 1] = -1;
                            this.tileGrid[originalTile.layer][newY + 1][newX] = -2;
                            this.tileGrid[originalTile.layer][newY + 1][newX + 1] = -3;
                        }
                        // Add to selected tiles array
                        this.activeToolBrushs.push({
                            x: newX,
                            y: newY,
                            id: originalTile.id,
                            layer: originalTile.layer
                        });
                    }
                }
            }
        }
        // Redraw the map
        this.draw();
    },
    setSelectionMode(mode) {
        if (this.mouseDown)
            return;
        this.selectionMode = mode;
        // Update UI to reflect the change
        document.querySelectorAll('input[name="selectionMode"]').forEach(radio => {
            radio.checked = radio.value === mode;
        });
    },
    toggleMirroring() {
        // Get the mirror checkboxes
        const mirrorCheckboxes = [
            document.getElementById('mirrorDiagonal'),
            document.getElementById('mirrorVertical'),
            document.getElementById('mirrorHorizontal')
        ];
        // HEADLESS GUARD: Bypass DOM manipulations if controls are missing from context!
        if (this.headless || mirrorCheckboxes.some(cb => !cb)) {
            return;
        }
        // Store the current states
        const previousStates = mirrorCheckboxes.map(checkbox => checkbox.checked);
        // If any mirroring was active, disable all
        if (previousStates.some(state => state)) {
            // Store the previous states for later restoration
            this.previousMirrorStates = previousStates;
            // Disable all mirroring
            mirrorCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
                checkbox.style.borderColor = '#ff4444'; // Red border for active checkboxes
            });
            // Update the internal state
            this.mirrorDiagonal = false;
            this.mirrorVertical = false;
            this.mirrorHorizontal = false;
        }
        else {
            // If we have previous states stored, restore them
            if (this.previousMirrorStates) {
                mirrorCheckboxes.forEach((checkbox, index) => {
                    checkbox.checked = this.previousMirrorStates[index];
                    checkbox.style.borderColor = ''; // Reset border color
                });
                // Update the internal state
                this.mirrorDiagonal = this.previousMirrorStates[0];
                this.mirrorVertical = this.previousMirrorStates[1];
                this.mirrorHorizontal = this.previousMirrorStates[2];
                // Clear the stored states
                this.previousMirrorStates = null;
            }
            else {
                // If no previous states, just reset the border colors
                mirrorCheckboxes.forEach(checkbox => {
                    checkbox.style.borderColor = '';
                });
            }
        }
        this.draw();
    },
    toggleCorrectMirroring() {
        // Logic simplified as this button was removed from HTML
        this.smartSymmetry = !this.smartSymmetry;
    },
    toggleEraseMode(state = !this.isErasing) {
        this.isErasing = state;
        if (this.isErasing) {
            if (this.viewPanActive) {
                this.togglePanningMode(false);
            }
        }
        const eraseBtn = document.getElementById('eraseBtn');
        if (eraseBtn) {
            eraseBtn.checked = this.isErasing;
            eraseBtn.parentElement.classList.toggle('active', this.isErasing);
            eraseBtn.parentElement.classList.toggle('active-red', this.isErasing);
        }
        // Keep UI synchronized: clear active tile selection in sidebars when erasing, and restore when placing
        const container = document.getElementById('tileSelector');
        if (container) {
            container.querySelectorAll('.tile-btn').forEach(btn => btn.classList.remove('selected'));
            if (!this.isErasing && this.activeToolBrush) {
                const activeBtn = container.querySelector(`.tile-btn[id="${this.activeToolBrush.id}"]`);
                if (activeBtn)
                    activeBtn.classList.add('selected');
            }
        }
        this.draw();
    },
    toggleGuides(state = !this.showGuides) {
        this.showGuides = state;
        const guidesBtn = document.getElementById('guidesBtn');
        guidesBtn.checked = this.showGuides;
        guidesBtn.parentElement.classList.toggle('active', this.showGuides);
        this.draw();
    },
    toggleReplaceMode() {
        this.replaceMode = !this.replaceMode;
        if (this.replaceMode) {
            if (this.viewPanActive) {
                this.togglePanningMode(false);
            }
        }
        // Update UI
        const replaceBtn = document.getElementById('replaceBtn');
        if (replaceBtn) {
            replaceBtn.checked = this.replaceMode;
            replaceBtn.parentElement.classList.toggle('active', this.replaceMode);
        }
    },
    togglePanningMode(forceValue) {
        const handBtn = document.getElementById('handToolBtn');
        this.viewPanActive = (forceValue !== undefined) ? forceValue : !this.viewPanActive;
        if (handBtn) {
            handBtn.checked = this.viewPanActive;
            handBtn.parentElement.classList.toggle('active', this.viewPanActive);
        }
        if (this.viewPanActive) {
            // Exclude other drawing/erase actions
            if (this.isErasing) {
                this.isErasing = false;
                const eraseBtn = document.getElementById('eraseBtn');
                if (eraseBtn) {
                    eraseBtn.checked = false;
                    eraseBtn.parentElement.classList.toggle('active', false);
                }
            }
            if (this.replaceMode) {
                this.replaceMode = false;
                const replaceBtn = document.getElementById('replaceBtn');
                if (replaceBtn) {
                    replaceBtn.checked = false;
                    replaceBtn.parentElement.classList.toggle('active', false);
                }
            }
            // Exclude Area Select mode to avoid conflict
            if (this.selectionMode === 'select') {
                const singleBtn = document.getElementById('singleBtn');
                if (singleBtn)
                    singleBtn.click();
            }
            const editorEl = this.canvas.closest('.map-editor') || this.canvas.parentElement?.parentElement;
            if (editorEl)
                editorEl.style.cursor = 'grab';
        }
        else {
            const editorEl = this.canvas.closest('.map-editor') || this.canvas.parentElement?.parentElement;
            if (editorEl)
                editorEl.style.cursor = '';
        }
    },
    handleReplace(x, y) {
        // Get the topmost tile at the clicked coordinates
        const topmost = this.getTopmostTileAt(x, y);
        // Source tile and layer
        const sourceId = topmost ? topmost.tileId : 0;
        const sourceLayer = topmost ? topmost.layerIndex : this.defaultTileLayer;
        // Get the target tile details
        if (!this.activeToolBrush)
            return;
        const targetId = this.activeToolBrush.id;
        // Save state before making changes
        this.saveState();
        // Replace all instances of the source tile with the target tile on the active layer
        for (let yIndex = 0; yIndex < this.mapHeight; yIndex++) {
            for (let xIndex = 0; xIndex < this.mapWidth; xIndex++) {
                if (this.tileGrid[sourceLayer][yIndex][xIndex] === sourceId) {
                    this.tileGrid[sourceLayer][yIndex][xIndex] = targetId;
                }
            }
        }
        // Draw the updated map
        this.draw();
        // Turn off replace mode
        this.toggleReplaceMode();
    },
    isBlock(tileId) {
        const blockIds = [1, 3, 4, 5, 6, 7, 8, 9, 11]; // IDs for Wall, Wall2, Crate, Barrel, Cactus, Water, Fence, Rope Fence, Unbreakable
        return blockIds.includes(tileId);
    },
    areBlocksConnected(x1, y1, x2, y2) {
        // Check if they're adjacent (including diagonally)
        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        return dx <= 1 && dy <= 1;
    },
    isBlockAt(x, y) {
        if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight)
            return true;
        return this.isBlock(this.tileGrid[this.defaultTileLayer][y][x]);
    }
};
