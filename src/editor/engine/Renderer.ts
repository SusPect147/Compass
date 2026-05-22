// @ts-nocheck
export const RendererMixin = {
    setCanvas(newCanvas) {
        this.canvas = newCanvas;
        this.ctx = newCanvas.getContext('2d');
        // if you use mapSize & tileSize to size it:
        this.canvas.width = this.mapSize.width * this.tileSize;
        this.canvas.height = this.mapSize.height * this.tileSize;
    },

    drawTile(ctx, tileId, x, y, red = false) {
        const def = this.tileDefinitions[tileId];
        if (!def) return;

        let img;
        // === Water, Ice and Snow tiles ===
        if (tileId === 8 || tileId === 69 || tileId === 70) {
            // Determinar tipo e caminhos de arquivo
            let tileType, basePath, cachePrefix;

            if (tileId === 8) {
                tileType = "Water";
                basePath = `Resources/${this.environment}/Water`;
                cachePrefix = `${this.environment}_water_`;
            }
            else if (tileId === 69) {
                tileType = "IceTile";
                basePath = `Resources/Global/Special_Tiles/IceTile`;
                cachePrefix = `ice_`;
            }
            else if (tileId === 70) {
                tileType = "SnowTile";
                basePath = `Resources/Global/Special_Tiles/SnowTile`;
                cachePrefix = `snow_`;
            }

            // Initialize the 8-bit code array
            const code = new Array(8).fill('0');

            // Check for edge conditions
            const isTopEdge = y === 0;
            const isBottomEdge = y === this.mapHeight - 1;
            const isLeftEdge = x === 0;
            const isRightEdge = x === this.mapWidth - 1;

            // Same type tile function 
            const isSameType = (id) => {
                if (tileId === 8) return id === 8; // Water
                if (tileId === 69) return id === 69; // Ice
                if (tileId === 70) return id === 70; // Snow
                return false;
            };

            // Check direct connections
            const hasTop = !isTopEdge && isSameType(this.tileGrid[this.defaultTileLayer][y - 1][x]);
            const hasBottom = !isBottomEdge && isSameType(this.tileGrid[this.defaultTileLayer][y + 1][x]);
            const hasLeft = !isLeftEdge && isSameType(this.tileGrid[this.defaultTileLayer][y][x - 1]);
            const hasRight = !isRightEdge && isSameType(this.tileGrid[this.defaultTileLayer][y][x + 1]);

            // Set direct connections
            if (hasTop) code[1] = '1';    // Top
            if (hasBottom) code[6] = '1'; // Bottom
            if (hasLeft) code[3] = '1';   // Left
            if (hasRight) code[4] = '1';  // Right

            // Check corners (only if adjacent sides exist)
            if (!isTopEdge && !isLeftEdge &&
                isSameType(this.tileGrid[this.defaultTileLayer][y - 1][x - 1]) && hasTop && hasLeft) {
                code[0] = '1'; // Top-left
            }

            if (!isTopEdge && !isRightEdge &&
                isSameType(this.tileGrid[this.defaultTileLayer][y - 1][x + 1]) && hasTop && hasRight) {
                code[2] = '1'; // Top-right
            }

            if (!isBottomEdge && !isLeftEdge &&
                isSameType(this.tileGrid[this.defaultTileLayer][y + 1][x - 1]) && hasBottom && hasLeft) {
                code[5] = '1'; // Bottom-left
            }

            if (!isBottomEdge && !isRightEdge &&
                isSameType(this.tileGrid[this.defaultTileLayer][y + 1][x + 1]) && hasBottom && hasRight) {
                code[7] = '1'; // Bottom-right
            }

            // Convert code to file name
            const imageName = code.join('') + '.png';
            const cacheKey = `${cachePrefix}${imageName}`;

            // Search on cache
            img = this.tileImages[cacheKey];

            // If don't exist, do
            if (!img) {
                const imagePath = `${basePath}/${imageName}`;
                img = new Image();
                img.src = imagePath;

                // Error treatment + fallback image
                img.onerror = () => {
                    console.error(`Failed to load ${tileType} image: ${imagePath}`);
                    img.src = `${basePath}/00000000.png`;
                };

                // Keep on cache
                this.tileImages[cacheKey] = img;
            }

            // If the image dont load, generate later
            if (!img.complete || img.naturalWidth === 0) {
                img.onload = () => {
                    this.scheduleDraw();
                };
                return;
            }

            // Get dimensions by type
            const dimensions =
                this.environmentTileData[this.environment]?.[tileType] ||
                this.tileData[tileType] ||
                { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, opacity: 1, zIndex: 5 }; // default

            let scaleX, scaleY, offsetX, offsetY, opacity;
            if (Array.isArray(dimensions)) {
                [scaleX, scaleY, offsetX = 0, offsetY = 0, opacity = 1] = dimensions;
            } else {
                ({ scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0, opacity = 1 } = dimensions);
            }
            const tileSize = this.tileSize;

            // Calculate position
            const width = tileSize * scaleX;
            const height = tileSize * scaleY;
            const drawX = x * tileSize + (tileSize * offsetX / 100) + this.canvasPadding;
            const drawY = y * tileSize + (tileSize * offsetY / 100) + this.canvasPadding;

            // Apply opacity and draw
            ctx.globalAlpha = opacity;
            ctx.drawImage(img, drawX, drawY, width, height);
            ctx.globalAlpha = 1.0;

            return;

        } else if (tileId === 7 || tileId === 9) { // Fence or Rope Fence
            const isFence = tileId === 7;
            const imageName = this.fenceLogicHandler.getFenceImageName(x, y, this.tileGrid[this.defaultTileLayer], this.environment, isFence);

            // For rope fence, map the image name to the corresponding Post variation
            const ropeMapping = {
                'T': 'Post_T',
                'R': 'Post_R',
                'TR': 'Post_TR',
                'Fence': 'Post'
            };

            const finalImageName = isFence ? imageName : (ropeMapping[imageName] || 'Post');
            const imagePath = `Resources/${this.environment}/${isFence ? 'Fence' : 'Rope'}/${finalImageName}.png`;

            img = this.tileImages[imagePath];

            if (!img) {
                img = new Image();
                img.onload = () => this.scheduleDraw();
                img.src = imagePath;
                img.onerror = () => {
                    console.error(`Failed to load ${isFence ? 'fence' : 'rope'} image: ${imagePath}`);
                    // Load fallback image
                    img.src = `Resources/${this.environment}/${isFence ? 'Fence' : 'Rope'}/Fence.png`;
                };
                this.tileImages[imagePath] = img;
            }

            if (!img.complete || img.naturalWidth === 0) {
                // Wait for image to load before drawing
                img.onload = () => {
                    this.scheduleDraw(); // Redraw everything when image loads
                };
                return;
            }

        } else if (tileId === 40) {
            const imageName = this.fenceLogicHandler.getFenceImageName(x, y, this.tileGrid[this.defaultTileLayer], 'Brawl_Arena');

            const pathColor = red ? 'Red' : 'Blue';
            const imagePath = `Resources/Global/Arena/Track/${pathColor}/${imageName}.png`;



            img = this.tileImages[imagePath];

            if (!img) {
                img = new Image();
                img.onload = () => this.scheduleDraw();
                img.src = imagePath;
                img.onerror = () => {
                    console.error(`Failed to load track image: ${imagePath}`);
                    // Load fallback image
                    img.src = `Resources/Global/Arena/Track/Blue/Fence.png`;
                };
                this.tileImages[imagePath] = img;
            }

            if (!img.complete || img.naturalWidth === 0) {
                // Wait for image to load before drawing
                img.onload = () => {
                    this.scheduleDraw(); // Redraw everything when image loads
                };
                return;
            }

        } else if (tileId === 45) {
            // Safe fallback to Tropical_Island environment assets if current is unsupported
            const def = this.tileDefinitions[tileId];
            let envToUse = this.environment;
            if (def.showInEnvironment && !def.showInEnvironment.includes(envToUse)) {
                envToUse = 'Tropical_Island';
            }

            const imageName = this.fenceLogicHandler.getFenceImageName(x, y, this.tileGrid[this.defaultTileLayer], envToUse, false, true);

            const imagePath = `Resources/${envToUse}/Fence_5v5/${imageName}.png`;

            img = this.tileImages[imagePath];

            if (!img) {
                img = new Image();
                img.onload = () => this.scheduleDraw();
                img.src = imagePath;
                img.onerror = () => {
                    console.error(`Failed to load border fence image: ${imagePath}`);
                    // Load fallback image
                    img.src = `Resources/${envToUse}/Fence_5v5/BFence.png`;
                };
                this.tileImages[imagePath] = img;
            }

            if (!img.complete || img.naturalWidth === 0) {
                // Wait for image to load before drawing
                img.onload = () => {
                    this.scheduleDraw(); // Redraw everything when image loads
                };
                return;
            }
        } else if (tileId === 68) {
            const imageName = this.fenceLogicHandler.getFenceImageName(x, y, this.tileGrid[1], 'Rails');

            const imagePath = `Resources/Global/Special_Tiles/Rails/${imageName}.png`;

            img = this.tileImages[imagePath];

            if (!img) {
                img = new Image();
                img.onload = () => this.scheduleDraw();
                img.src = imagePath;
                img.onerror = () => {
                    console.error(`Failed to load border fence image: ${imagePath}`);
                    // Load fallback image
                    img.src = `Resources/Global/Special_Tiles/Rails/Fence.png`;
                };
                this.tileImages[imagePath] = img;
            }

            if (!img.complete || img.naturalWidth === 0) {
                // Wait for image to load before drawing
                img.onload = () => {
                    this.scheduleDraw(); // Redraw everything when image loads
                };
                return;
            }
        } else if ([73, 74, 75].some(a => a === tileId)) {
            const imageName = this.fenceLogicHandler.getFenceImageName(x, y, this.tileGrid[1], 'Train');

            const imagePath = `Resources/Global/Special_Tiles/${tileId === 73 ? 'RedTrain' : tileId === 74 ? 'YellowTrain' : 'GreenTrain'}/Train_${imageName}.png`;

            img = this.tileImages[imagePath];

            if (!img) {
                img = new Image();
                img.onload = () => this.scheduleDraw();
                img.src = imagePath;
                img.onerror = () => {
                    console.error(`Failed to load border fence image: ${imagePath}`);
                    // Load fallback image
                    img.src = `Resources/Global/Special_Tiles/${tileId === 73 ? 'RedTrain' : tileId === 74 ? 'YellowTrain' : 'GreenTrain'}/Train_Fence.png`;
                };
                this.tileImages[imagePath] = img;
            }

            if (!img.complete || img.naturalWidth === 0) {
                // Wait for image to load before drawing
                img.onload = () => {
                    this.scheduleDraw(); // Redraw everything when image loads
                };
                return;
            }
        } else {
            // Handle position-dependent tiles like objectives
            const def = this.tileDefinitions[tileId];
            if (def && def.getImg) {
                const imgData = def.getImg(this.gamemode, y, this.mapHeight, this.environment);
                if (imgData && imgData.img) {
                    const imgPath = `Resources/${imgData.img.replace('${env}', this.environment)}`;
                    // Use a unique cache key that includes position for position-dependent tiles
                    const cacheKey = `${tileId}_${imgPath}`;
                    img = this.tileImages[cacheKey];

                        if (!img) {
                            img = new Image();
                            img.onload = () => this.scheduleDraw();
                            img.src = imgPath;
                            img.onerror = () => {
                                console.error(`Failed to load objective image: ${imgPath}`);
                                // Fallback to Desert if current theme fails
                                if (this.environment !== 'Desert' && imgPath.includes(this.environment)) {
                                    const fallbackPath = imgPath.replace(this.environment, 'Desert');
                                    console.info(`Attempting fallback to: ${fallbackPath}`);
                                    img.src = fallbackPath;
                                }
                            };
                            this.tileImages[cacheKey] = img;
                        }
                }
            } else {
                img = this.tileImages[tileId];
            }
        }

        if (!img || !img.complete || img.naturalWidth === 0) return;


        // Get tile dimensions data
        let dimensions;
        if (def.name === 'Objective') {
            const baseData = this.environmentObjectiveData[this.environment]?.[this.gamemode] || this.objectiveData[this.gamemode];

            // Handle position-dependent objectives (upper vs lower)
            if (baseData && typeof baseData === 'object' && !Array.isArray(baseData)) {
                // Position-dependent format: { upper: [...], lower: [...] }
                const isUpper = y < this.mapHeight / 2;
                dimensions = baseData[isUpper ? 'upper' : 'lower'] || baseData.upper || baseData;
            } else {
                // Legacy format: direct array
                dimensions = baseData;
            }
        } else {
            // For fence and rope fence variations, use the specific variation's dimensions
            const isFence = tileId === 7;
            const isRope = tileId === 9;
            const isBorder = tileId === 45;
            const isTrain = [73, 74, 75].includes(tileId);
            if (isFence || isRope || isBorder) {
                let envToUse = this.environment;
                if (isBorder) {
                    const bDef = this.tileDefinitions[45];
                    if (bDef.showInEnvironment && !bDef.showInEnvironment.includes(envToUse)) {
                        envToUse = 'Tropical_Island';
                    }
                }
                const imageName = this.fenceLogicHandler.getFenceImageName(x, y, this.tileGrid[this.defaultTileLayer], envToUse, isFence, isBorder);
                const ropeMapping = {
                    'T': 'Post_T',
                    'R': 'Post_R',
                    'TR': 'Post_TR',
                    'Fence': 'Post'
                };
                const finalImageName = isBorder ? imageName : isFence ? imageName : (ropeMapping[imageName] || 'Post');

                // First check environment-specific data
                dimensions = this.environmentTileData[envToUse]?.[finalImageName] ||
                    // Then check base tile data
                    this.tileData[finalImageName] ||
                    // Fall back to base fence/rope fence in environment data
                    this.environmentTileData[envToUse]?.[isBorder ? 'BFence' : isFence ? 'Fence' : 'Rope Fence'] ||
                    // Finally fall back to base tile data
                    this.tileData[isBorder ? 'BFence' : isFence ? 'Fence' : 'Rope Fence'];
            } else if (isTrain) {
                const imageName = this.fenceLogicHandler.getFenceImageName(x, y, this.tileGrid[1], 'Train');
                dimensions = this.tileData['Train_' + imageName];
            } else {
                dimensions = this.environmentTileData[this.environment]?.[def.name] ||
                    this.tileData[def.name];
            }
        }
        if (!dimensions) return;

        let scaleX, scaleY, offsetX, offsetY, opacity;
        if (Array.isArray(dimensions)) {
            [scaleX, scaleY, offsetX = 0, offsetY = 0, opacity = 1] = dimensions;
        } else {
            ({ scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0, opacity = 1 } = dimensions);
        }
        const tileSize = this.tileSize;

        // Calculate drawing dimensions
        const width = tileSize * scaleX * (def.size || 1);
        const height = tileSize * scaleY * (def.size || 1);

        // Calculate position with offsets and padding
        const drawX = x * tileSize + (tileSize * offsetX / 100) + this.canvasPadding;
        const drawY = y * tileSize + (tileSize * offsetY / 100) + this.canvasPadding;

        // Set opacity
        ctx.globalAlpha = opacity;

        // Draw the tile
        ctx.drawImage(img, drawX, drawY, width, height);

        // Reset opacity
        ctx.globalAlpha = 1;
    },

    showJumpLanding(ctx, tileId, x, y) {
        // Map tileId to jump type
        const jumpTypes = {
            20: 'R', 21: 'L', 22: 'T', 23: 'B',
            24: 'BR', 25: 'TL', 26: 'BL', 27: 'TR'
        };
        const type = jumpTypes[tileId];
        if (!type) return;

        // Get mapEditor context for map size and tile size
        const mapWidth = this.mapWidth || 40;
        const mapHeight = this.mapHeight || 40;
        const tileSize = this.tileSize || 64;
        const padding = this.canvasPadding || 0;

        // Calculate landing position offset
        let dx = 0, dy = 0, dist = 12;
        if (type === 'R') dx = dist;
        if (type === 'L') dx = -dist;
        if (type === 'T') dy = -dist;
        if (type === 'B') dy = dist;
        if (type === 'BR') { dx = 8; dy = 8; }
        if (type === 'TL') { dx = -8; dy = -8; }
        if (type === 'BL') { dx = -8; dy = 8; }
        if (type === 'TR') { dx = 8; dy = -8; }

        // Calculate landing tile position
        let lx = x + dx;
        let ly = y + dy;

        // Clamp to 2 tiles before the edge if out of bounds
        if (lx < 0) lx = 0;
        if (lx > mapWidth - 2) lx = mapWidth - 2;
        if (ly < 0) ly = 0;
        if (ly > mapHeight - 2) ly = mapHeight - 2;

        // Draw the landing image at (lx, ly), size 2x2 tiles
        const imgPath = 'Resources/Global/JumpLanding.png';
        let img = this.tileImages?.[imgPath];
        if (!img) {
            img = new Image();
            img.src = imgPath;
            if (this.tileImages) this.tileImages[imgPath] = img;
            img.onload = () => this.scheduleDraw && this.scheduleDraw();
            img.onerror = () => { console.error('Failed to load JumpLanding image:', imgPath); };
        }
        if (!img.complete || img.naturalWidth === 0) return;

        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.drawImage(
            img,
            lx * tileSize + padding,
            ly * tileSize + padding,
            tileSize * 2,
            tileSize * 2
        );
        ctx.globalAlpha = 1.0;
        ctx.restore();
    },

    draw() {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw the background grid
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                // Check if this tile should have no background in Brawl Ball mode
                let skipBackground = false;
                if ((this.gamemode === 'Brawl_Ball' || this.gamemode === 'Hockey') && this.mapSize === this.mapSizes.regular) {
                    const atTop = y < 4;
                    const atBottom = y >= this.mapHeight - 4;
                    const atLeft = x < 7;
                    const atRight = x >= this.mapWidth - 7;

                    if ((atTop || atBottom) && (atLeft || atRight)) {
                        skipBackground = true;
                    }
                }

                if (!skipBackground) {
                    const isDark = (x + y) % 2 === 0;
                    const bgImg = isDark ? this.bgDark : this.bgLight;

                    if (bgImg.complete) {
                        this.ctx.drawImage(
                            bgImg,
                            x * this.tileSize + this.canvasPadding,
                            y * this.tileSize + this.canvasPadding,
                            this.tileSize,
                            this.tileSize
                        );
                    }
                }
            }
        }

        if (this.gamemode === 'Basket_Brawl' && this.mapSize === this.mapSizes.basket) {
            // Cache basket images if not already loaded
            if (!this.basketMarkingsImage) {
                this.basketMarkingsImage = new Image();
                this.basketMarkingsImage.src = 'Resources/Global/BasketMarkings.png';
            }
            if (!this.basketsImage) {
                this.basketsImage = new Image();
                this.basketsImage.src = 'Resources/Global/Baskets.png';
            }

            // Draw basket markings if loaded
            if (this.basketMarkingsImage.complete) {
                this.ctx.drawImage(
                    this.basketMarkingsImage,
                    this.canvasPadding,
                    this.canvasPadding,
                    this.mapWidth * this.tileSize,
                    this.mapHeight * this.tileSize
                );
            }
        }

        if (this.gamemode === 'Siege' && this.mapSize === this.mapSizes.siege) {
            // Cache basket images if not already loaded
            if (!this.siegeMarkingsImage) {
                this.siegeMarkingsImage = new Image();
                this.siegeMarkingsImage.src = 'Resources/Global/SiegeMarkings.png';
            }

            if (this.siegeMarkingsImage.complete) {
                this.ctx.drawImage(
                    this.siegeMarkingsImage,
                    this.canvasPadding,
                    this.canvasPadding,
                    this.mapWidth * this.tileSize,
                    this.mapHeight * this.tileSize
                );
            }
        }

        if (this.gamemode === 'Spirit_Wars' && this.mapSize === this.mapSizes.regular) {
            // Cache basket images if not already loaded
            if (!this.siegeMarkingsImage) {
                this.siegeMarkingsImage = new Image();
                this.siegeMarkingsImage.src = 'Resources/Global/SpiritWarsMarkings.png';
            }

            if (this.siegeMarkingsImage.complete) {
                this.ctx.drawImage(
                    this.siegeMarkingsImage,
                    this.canvasPadding,
                    this.canvasPadding,
                    this.mapWidth * this.tileSize,
                    this.mapHeight * this.tileSize
                );
            }
        }

        // Group tiles by layer
        const tilesByLayer = new Map();
        for (let layerIndex = 0; layerIndex < this.layerCount; layerIndex++) {
            const layerGrid = this.tileGrid[layerIndex];
            if (!layerGrid) continue;

            for (let y = 0; y < this.mapHeight; y++) {
                for (let x = 0; x < this.mapWidth; x++) {
                    const tileId = layerGrid[y] ? layerGrid[y][x] : 0;
                    if (tileId === 0 || tileId === -1) continue;

                    const def = this.tileDefinitions[tileId];
                    if (!def) continue;

                    const layerKey = typeof def.layer === 'number' ? def.layer : this.defaultTileLayer;

                    if (!tilesByLayer.has(layerKey)) {
                        tilesByLayer.set(layerKey, []);
                    }
                    tilesByLayer.get(layerKey).push({ x, y, tileId, red: false, layerKey });
                }
            }
        }

        function getTileAt(layerKey, x, y) {
            const tiles = tilesByLayer.get(layerKey);
            if (!tiles) return null;

            return tiles.find(tile => tile.x === x && tile.y === y) || null;
        }

        if (this.gamemode === 'Brawl_Arena') {
            const trackLayerIndex = this.tileDefinitions[40]?.layer ?? this.defaultTileLayer;
            const smallIkeLayerIndex = this.tileDefinitions[47]?.layer ?? this.defaultTileLayer;
            const resolveLayerGrid = (index) => this.tileGrid[index] || this.tileGrid[this.defaultTileLayer];
            const trackLayerGrid = resolveLayerGrid(trackLayerIndex);
            const smallIkeLayerGrid = resolveLayerGrid(smallIkeLayerIndex);

            const getTrackConnections = (x, y) => {
                const height = trackLayerGrid.length;
                const width = trackLayerGrid[0].length;

                // Helper function to check if a tile is a fence/rope
                const isSameType = (x, y) => {
                    if (x < 0 || x >= width || y < 0 || y >= height) return false;
                    const id = trackLayerGrid[y] ? trackLayerGrid[y][x] : 0;
                    return id === 40;
                };

                return {
                    top: isSameType(x, y - 1),
                    right: isSameType(x + 1, y),
                    bottom: isSameType(x, y + 1),
                    left: isSameType(x - 1, y)
                };
            };

            for (let y = 0; y < this.mapHeight; y++) {
                for (let x = 0; x < this.mapWidth; x++) {
                    if (smallIkeLayerGrid[y] && smallIkeLayerGrid[y][x] === 47) {
                        const addRedToConnections = (x, y, firstRun = false) => {
                            if (!firstRun) {
                                const tile = getTileAt(trackLayerIndex, x, y);
                                if (!tile) {
                                    return;
                                }
                                if (tile.red) {
                                    return;
                                }

                                tile.red = true;
                            }

                            firstRun = false;
                            const { top, right, bottom, left } = getTrackConnections(x, y);
                            if (top) addRedToConnections(x, y - 1);
                            if (right) addRedToConnections(x + 1, y);
                            if (bottom) addRedToConnections(x, y + 1);
                            if (left) addRedToConnections(x - 1, y);
                        };

                        addRedToConnections(x + 1, y, true);
                        addRedToConnections(x - 1, y, true);
                        addRedToConnections(x, y + 1, true);
                        addRedToConnections(x, y - 1, true);
                    }
                }
            }
        }

        // Draw tiles in layer order
        Array.from(tilesByLayer.keys())
            .sort((a, b) => a - b)
            .forEach(layerKey => {
                const tiles = tilesByLayer.get(layerKey);

                // Group tiles by row (y value)
                const rows = new Map();

                tiles.forEach(tile => {
                    const { y } = tile;
                    if (!rows.has(y)) {
                        rows.set(y, []);
                    }
                    rows.get(y).push(tile);
                });

                // Draw tiles row by row
                Array.from(rows.keys())
                    .sort((a, b) => a - b)
                    .forEach(y => {
                        const rowTiles = rows.get(y);

                        rowTiles.sort((a, b) => a.x - b.x);

                        rowTiles.forEach(({ x, y, tileId }) => {
                            const tile = getTileAt(layerKey, x, y);
                            const red = tile?.red ?? false;

                            this.drawTile(this.ctx, tileId, x, y, red);

                            if (this.showGuides && tileId >= 20 && tileId <= 27) {
                                this.showJumpLanding(this.ctx, tileId, x, y);
                            }
                        });
                    });
            });



        if (this.showErrors) {
            if (this._errorsDirty) {
                this.recalculateErrors();
            }
            this.ctx.fillStyle = 'rgba(240, 78, 78, 0.22)';
            this.ctx.strokeStyle = 'rgba(240, 78, 78, 0.65)';
            this.ctx.lineWidth = 2.0;
            for (const tilePos of this.errorTiles) {
                const [x, y] = tilePos.split(',').map(Number);
                const rx = x * this.tileSize + this.canvasPadding;
                const ry = y * this.tileSize + this.canvasPadding;
                this.ctx.fillRect(rx, ry, this.tileSize, this.tileSize);
                this.ctx.strokeRect(rx + 1, ry + 1, this.tileSize - 2, this.tileSize - 2);
            }
        }

        if (this.gamemode === 'Basket_Brawl' && this.mapSize === this.mapSizes.basket) {
            if (this.basketsImage.complete) {
                this.ctx.drawImage(
                    this.basketsImage,
                    this.canvasPadding,
                    this.canvasPadding,
                    this.mapWidth * this.tileSize,
                    this.mapHeight * this.tileSize
                );
            }
        }

        if (this.goalImages?.length) {
            for (const goal of this.goalImages) {
                const img = this.goalImageCache[`${goal.name}${this.environment}`] ||
                    this.goalImageCache[`${goal.name}`];
                if (!img || !img.complete || img.naturalWidth === 0) continue;

                this.ctx.drawImage(
                    img,
                    goal.x * this.tileSize + this.canvasPadding + (goal.offsetX || 0),
                    goal.y * this.tileSize + this.canvasPadding + (goal.offsetY || 0),
                    (goal.w || 1) * this.tileSize,
                    (goal.h || 1) * this.tileSize
                );
            }
        }



        if (this.selectionMode === 'select' && !this.mouseDown) {
            this.selectionStart = this.activeToolBrushs[0];
            this.selectionEnd = this.activeToolBrushs[this.activeToolBrushs.length - 1];
            this.drawSelection();
        }


        if (this.showGuides || this.isDragging || this.isSelectDragging) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; // semi-transparent white
            this.ctx.lineWidth = 1;

            // Calculate central tile coordinates
            const centerX = (this.mapWidth / 2);
            const centerY = (this.mapHeight / 2);

            // Convert to canvas pixel coordinates
            const centerXCanvas = centerX * this.tileSize + this.canvasPadding;
            const centerYCanvas = centerY * this.tileSize + this.canvasPadding;

            // Vertical center line
            this.ctx.beginPath();
            this.ctx.moveTo(centerXCanvas + 0.5, 0);
            this.ctx.lineTo(centerXCanvas + 0.5, this.canvas.height);
            this.ctx.stroke();

            // Horizontal center line
            this.ctx.beginPath();
            this.ctx.moveTo(0, centerYCanvas + 0.5);
            this.ctx.lineTo(this.canvas.width, centerYCanvas + 0.5);
            this.ctx.stroke();
        }
    },

    scheduleDraw() {
        if (this._drawPending) return;
        this._drawPending = true;
        requestAnimationFrame(() => {
            this._drawPending = false;
            this.draw();
        });
    },

    drawSelection() {
        if (!this.selectionStart || !this.selectionEnd) return;

        // Selection highlight
        const useRed = this.isErasing && this.selectionMode !== 'select';
        this.ctx.save();
        this.ctx.fillStyle = useRed ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 240, 0, 0.7)';
        this.ctx.strokeStyle = useRed ? 'rgba(255, 0, 0, 0.95)' : 'rgba(255, 240, 0, 0.95)';
        this.ctx.lineWidth = 2.5;

        // If still drawing, show full rectangle/area as before
        if (this.isDrawing && (this.selectionMode === 'rectangle' || this.selectionMode === 'select')) {
            const startX = Math.min(this.selectionStart.x, this.selectionEnd.x);
            const startY = Math.min(this.selectionStart.y, this.selectionEnd.y);
            const endX = Math.max(this.selectionStart.x, this.selectionEnd.x);
            const endY = Math.max(this.selectionStart.y, this.selectionEnd.y);
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    const rx = x * this.tileSize + this.canvasPadding;
                    const ry = y * this.tileSize + this.canvasPadding;
                    this.ctx.fillRect(rx, ry, this.tileSize, this.tileSize);
                    this.ctx.strokeRect(rx + 1, ry + 1, this.tileSize - 2, this.tileSize - 2);
                }
            }
        } else if (this.selectionMode === 'select' && this.activeToolBrushs.length > 0) {
            // After selection, only cover actual selected (non-empty) tiles with accurate scaled visuals
            for (const t of this.activeToolBrushs) {
                const def = this.tileDefinitions[t.id];
                let dimensions;

                if (def) {
                    if (def.name === 'Objective') {
                        const baseData = this.environmentObjectiveData[this.environment]?.[this.gamemode] || this.objectiveData[this.gamemode];
                        if (baseData && typeof baseData === 'object' && !Array.isArray(baseData)) {
                            const isUpper = t.y < this.mapHeight / 2;
                            dimensions = baseData[isUpper ? 'upper' : 'lower'] || baseData.upper || baseData;
                        } else {
                            dimensions = baseData;
                        }
                    } else {
                        const isFence = t.id === 7;
                        const isRope = t.id === 9;
                        const isBorder = t.id === 45;
                        const isTrain = [73, 74, 75].includes(t.id);

                        if ((isFence || isRope || isBorder) && this.fenceLogicHandler) {
                            let envToUse = this.environment;
                            if (isBorder) {
                                const bDef = this.tileDefinitions[45];
                                if (bDef.showInEnvironment && !bDef.showInEnvironment.includes(envToUse)) {
                                    envToUse = 'Tropical_Island';
                                }
                            }
                            const imageName = this.fenceLogicHandler.getFenceImageName(t.x, t.y, this.tileGrid[this.defaultTileLayer], envToUse, isFence, isBorder);
                            const ropeMapping = { 'T': 'Post_T', 'R': 'Post_R', 'TR': 'Post_TR', 'Fence': 'Post' };
                            const finalImageName = isBorder ? imageName : isFence ? imageName : (ropeMapping[imageName] || 'Post');
                            dimensions = this.environmentTileData[envToUse]?.[finalImageName] ||
                                this.tileData[finalImageName] ||
                                this.environmentTileData[envToUse]?.[isBorder ? 'BFence' : isFence ? 'Fence' : 'Rope Fence'] ||
                                this.tileData[isBorder ? 'BFence' : isFence ? 'Fence' : 'Rope Fence'];
                        } else if (isTrain && this.fenceLogicHandler) {
                            const imageName = this.fenceLogicHandler.getFenceImageName(t.x, t.y, this.tileGrid[this.defaultTileLayer], 'Train');
                            dimensions = this.tileData['Train_' + imageName];
                        } else {
                            dimensions = this.environmentTileData[this.environment]?.[def.name] ||
                                this.tileData[def.name];
                        }
                    }
                }

                let scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0;
                if (dimensions) {
                    if (Array.isArray(dimensions)) {
                        [scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0] = dimensions;
                    } else {
                        ({ scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0 } = dimensions);
                    }
                }

                const size = def?.size || 1;
                let width = this.tileSize * scaleX * size;
                let height = this.tileSize * scaleY * size;
                let drawX = t.x * this.tileSize + (this.tileSize * offsetX / 100) + this.canvasPadding;
                let drawY = t.y * this.tileSize + (this.tileSize * offsetY / 100) + this.canvasPadding;

                // PHYSICAL BOUNDS RE-CENTERING: Trim oversized transparent scale padding for ground items
                let physicalSize = null;
                if (def?.name === 'Objective') {
                    const physicalSizes = {
                        'Gem_Grab': 1, 'Bounty': 1, 'Brawl_Ball': 1, 'Lone_Star': 1, 'Takedown': 1,
                        'Basket_Brawl': 1, 'Volley_Brawl': 1, 'Hockey': 1, 'Dodgebrawl': 1,
                        'Safe_Blast': 1, 'Hold_The_Trophy': 1, 'Love_Bombing': 1, 'Heist': 1,
                        'Snowtel_Thieves': 2, 'Token_Run': 2, 'Bot_Zone': 1, 'Bot_Drop': 1,
                        'Paint_Brawl': 1, 'Siege': 2, 'Spirit_Wars': 2, 'Hot_Zone': 1
                    };
                    physicalSize = physicalSizes[this.gamemode] || 1;
                } else if (['Blue Spawn', 'Red Spawn', 'Blue Respawn', 'Red Respawn', 'Trio Spawn', 'Yellow Spawn', 'GodzillaSpawn', 'TokenBlue', 'TokenRed', 'TreasurePad1', 'TreasurePad2'].includes(def?.name)) {
                    physicalSize = 1;
                }

                if (physicalSize !== null) {
                    const centerX = drawX + width / 2;
                    const centerY = drawY + height / 2;
                    width = this.tileSize * physicalSize * size;
                    height = this.tileSize * physicalSize * size;
                    drawX = centerX - width / 2;
                    drawY = centerY - height / 2;
                }

                this.ctx.fillRect(drawX, drawY, width, height);
                this.ctx.strokeRect(drawX + 1, drawY + 1, width - 2, height - 2);
            }
        } else if (this.selectionMode === 'rectangle') {
            const startX = Math.min(this.selectionStart.x, this.selectionEnd.x);
            const startY = Math.min(this.selectionStart.y, this.selectionEnd.y);
            const endX = Math.max(this.selectionStart.x, this.selectionEnd.x);
            const endY = Math.max(this.selectionStart.y, this.selectionEnd.y);
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    const rx = x * this.tileSize + this.canvasPadding;
                    const ry = y * this.tileSize + this.canvasPadding;
                    this.ctx.fillRect(rx, ry, this.tileSize, this.tileSize);
                    this.ctx.strokeRect(rx + 1, ry + 1, this.tileSize - 2, this.tileSize - 2);
                }
            }
        } else if (this.selectionMode === 'line') {
            for (const tilePos of this.hoveredTiles) {
                const [x, y] = tilePos.split(',').map(Number);
                const rx = x * this.tileSize + this.canvasPadding;
                const ry = y * this.tileSize + this.canvasPadding;
                this.ctx.fillRect(rx, ry, this.tileSize, this.tileSize);
                this.ctx.strokeRect(rx + 1, ry + 1, this.tileSize - 2, this.tileSize - 2);
            }
        } else if (this.selectionMode === 'single' || this.selectionMode === 'fill') {
            const rx = this.selectionEnd.x * this.tileSize + this.canvasPadding;
            const ry = this.selectionEnd.y * this.tileSize + this.canvasPadding;
            this.ctx.fillRect(rx, ry, this.tileSize, this.tileSize);
            this.ctx.strokeRect(rx + 1, ry + 1, this.tileSize - 2, this.tileSize - 2);
        }

        this.ctx.restore();
    },

    placeTilesInSelection() {
        if (!this.selectionStart || !this.selectionEnd) return;

        // Save state before making changes
        this.saveState();

        if (this.selectionMode === 'single') {
            if (this.isErasing) {
                this.eraseTile(this.selectionEnd.x, this.selectionEnd.y, false);
            } else {
                this.placeTile(this.selectionEnd.x, this.selectionEnd.y, null, false);
            }
        } else if (this.selectionMode === 'line') {
            // Place tiles in all hovered positions
            for (const tilePos of this.hoveredTiles) {
                const [x, y] = tilePos.split(',').map(Number);
                if (this.isErasing) {
                    this.eraseTile(x, y, false);
                } else {
                    this.placeTile(x, y, null, false);
                }
            }
        } else if (this.selectionMode === 'rectangle') {
            const startX = Math.min(this.selectionStart.x, this.selectionEnd.x);
            const startY = Math.min(this.selectionStart.y, this.selectionEnd.y);
            const endX = Math.max(this.selectionStart.x, this.selectionEnd.x);
            const endY = Math.max(this.selectionStart.y, this.selectionEnd.y);

            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    if (this.isErasing) {
                        this.eraseTile(x, y, false);
                    } else {
                        this.placeTile(x, y, null, false);
                    }
                }
            }
        } else if (this.selectionMode === 'fill') {
            // Get the topmost tile at the fill start position
            const startTile = this.getTopmostTileAt(this.selectionEnd.x, this.selectionEnd.y);

            // Support filling empty spaces (treating them as tileId 0 on the default tile layer)
            const tileId = startTile ? startTile.tileId : 0;
            const fillLayer = startTile ? startTile.layerIndex : this.defaultTileLayer;

            // Safeguard: if source and target IDs are identical, do nothing to prevent infinite loops
            const targetPlacementId = this.isErasing ? 0 : this.activeToolBrush.id;
            if (tileId === targetPlacementId) return;

            const getConnectionsOfSameTile = (x, y, tileId, layerIndex) => {
                const height = this.tileGrid[layerIndex] ? this.tileGrid[layerIndex].length : this.mapHeight;
                const width = this.tileGrid[layerIndex] && this.tileGrid[layerIndex][0] ? this.tileGrid[layerIndex][0].length : this.mapWidth;

                const isSameType = (x, y) => {
                    if (x < 0 || x >= width || y < 0 || y >= height) return false;
                    // Check the topmost tile logic
                    const topmost = this.getTopmostTileAt(x, y);
                    const checkId = topmost ? topmost.tileId : 0;
                    const checkLayer = topmost ? topmost.layerIndex : this.defaultTileLayer;
                    return checkId === tileId && checkLayer === layerIndex;
                };

                return {
                    top: isSameType(x, y - 1),
                    right: isSameType(x + 1, y),
                    bottom: isSameType(x, y + 1),
                    left: isSameType(x - 1, y)
                };
            };

            const fill = (x, y) => {
                if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
                    return;
                }

                // Check if current position matches source tile
                const currentTile = this.getTopmostTileAt(x, y);
                const currentId = currentTile ? currentTile.tileId : 0;
                const currentLayer = currentTile ? currentTile.layerIndex : this.defaultTileLayer;

                if (currentId !== tileId || currentLayer !== fillLayer) {
                    return;
                }

                // Place or erase the tile
                if (this.isErasing) {
                    this.eraseTile(x, y, false);
                } else {
                    this.placeTile(x, y, null, false);
                }

                const { top, right, bottom, left } = getConnectionsOfSameTile(x, y, tileId, fillLayer);

                if (top) fill(x, y - 1);
                if (right) fill(x + 1, y);
                if (bottom) fill(x, y + 1);
                if (left) fill(x - 1, y);
            };

            fill(this.selectionEnd.x, this.selectionEnd.y);
        } else if (this.selectionMode === 'select') {
            const startX = Math.min(this.selectionStart.x, this.selectionEnd.x);
            const startY = Math.min(this.selectionStart.y, this.selectionEnd.y);
            const endX = Math.max(this.selectionStart.x, this.selectionEnd.x);
            const endY = Math.max(this.selectionStart.y, this.selectionEnd.y);

            // Check all layers for tiles in the selection area
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    // Find topmost tile at this position across all layers
                    const topmostTile = this.getTopmostTileAt(x, y);
                    if (topmostTile && topmostTile.tileId !== 0 && topmostTile.tileId !== -1 && topmostTile.tileId !== -2 && topmostTile.tileId !== -3 && topmostTile.tileId !== 33) {
                        this.activeToolBrushs.push({
                            x: x,
                            y: y,
                            id: topmostTile.tileId,
                            layer: topmostTile.layerIndex
                        });
                    }
                }
            }
        }


        // Draw after all tiles are placed
        this.draw();
    },

    drawTilePreview(tileId, x, y, alpha = 0.75) {
        const def = this.tileDefinitions[tileId];
        if (!def)
            return;
        let img = this.tileImages[tileId];
        if (!img || !img.complete)
            return;
        // Get tile dimensions from environment-specific or base data
        let dimensions;
        if (def.name === 'Objective') {
            const baseData = this.environmentObjectiveData[this.environment]?.[this.gamemode] || this.objectiveData[this.gamemode];
            // Handle position-dependent objectives
            if (baseData && typeof baseData === 'object' && !Array.isArray(baseData)) {
                const isUpper = y < this.mapHeight / 2;
                dimensions = baseData[isUpper ? 'upper' : 'lower'] || baseData.upper || baseData;
            }
            else {
                dimensions = baseData;
            }
        }
        else {
            const isFence = tileId === 7;
            const isRope = tileId === 9;
            const isBorder = tileId === 45;
            const isTrain = [73, 74, 75].includes(tileId);
            if (isFence || isRope || isBorder) {
                let envToUse = this.environment;
                if (isBorder) {
                    const bDef = this.tileDefinitions[45];
                    if (bDef.showInEnvironment && !bDef.showInEnvironment.includes(envToUse)) {
                        envToUse = 'Tropical_Island';
                    }
                }
                const imageName = this.fenceLogicHandler.getFenceImageName(x, y, this.tileGrid[this.defaultTileLayer], envToUse, isFence, isBorder);
                const ropeMapping = { 'T': 'Post_T', 'R': 'Post_R', 'TR': 'Post_TR', 'Fence': 'Post' };
                const finalImageName = isBorder ? imageName : isFence ? imageName : (ropeMapping[imageName] || 'Post');
                dimensions = this.environmentTileData[envToUse]?.[finalImageName] ||
                    this.tileData[finalImageName] ||
                    this.environmentTileData[envToUse]?.[isBorder ? 'BFence' : isFence ? 'Fence' : 'Rope Fence'] ||
                    this.tileData[isBorder ? 'BFence' : isFence ? 'Fence' : 'Rope Fence'];
            }
            else if (isTrain) {
                const imageName = this.fenceLogicHandler.getFenceImageName(x, y, this.tileGrid[1], 'Train');
                dimensions = this.tileData['Train_' + imageName];
            }
            else {
                dimensions = this.environmentTileData[this.environment]?.[def.name] ||
                    this.tileData[def.name];
            }
        }
        if (!dimensions)
            return;

        // === FIX: Support both array and object formats ===
        let scaleX, scaleY, offsetX, offsetY, opacity;
        if (Array.isArray(dimensions)) {
            // Array format: [scaleX, scaleY, offsetX, offsetY, opacity]
            [scaleX, scaleY, offsetX = 0, offsetY = 0, opacity = 1] = dimensions;
        } else {
            // Object format: { scaleX, scaleY, offsetX, offsetY, opacity }
            ({ scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0, opacity = 1 } = dimensions);
        }

        const size = def.size || 1;
        const tileSize = this.tileSize;
        // Calculate drawing dimensions
        const width = tileSize * scaleX * size;
        const height = tileSize * scaleY * size;
        // Calculate position with offsets and padding
        const drawX = x * tileSize + (tileSize * offsetX / 100) + this.canvasPadding;
        const drawY = y * tileSize + (tileSize * offsetY / 100) + this.canvasPadding;
        // Set opacity and draw the tile
        this.ctx.save();
        this.ctx.globalAlpha = alpha * opacity;
        this.ctx.drawImage(img, drawX, drawY, width, height);
        this.ctx.restore();
    },

    drawSelectDragGhost(offsetX, offsetY) {
        for (const t of this.selectDragTiles) {
            const newX = t.x + offsetX;
            const newY = t.y + offsetY;
            if (
                newX >= 0 && newX < this.mapWidth &&
                newY >= 0 && newY < this.mapHeight
            ) {
                this.drawTilePreview(t.id, newX, newY, 0.5);

                // Mirroring logic
                const size = this.tileDefinitions[t.id]?.size || 1;
                const mirrorY = this.mapHeight - 1 - newY;
                const mirrorX = this.mapWidth - 1 - newX;

                if (this.mirrorVertical) {
                    const adjustedY = size === 2 ? mirrorY - 1 : mirrorY;
                    const mirrorId = this.getMirroredTileId(t.id, 'vertical');
                    if (adjustedY >= 0 && adjustedY < this.mapHeight)
                        this.drawTilePreview(mirrorId, newX, adjustedY, 0.5);
                }
                if (this.mirrorHorizontal) {
                    const adjustedX = size === 2 ? mirrorX - 1 : mirrorX;
                    const mirrorId = this.getMirroredTileId(t.id, 'horizontal');
                    if (adjustedX >= 0 && adjustedX < this.mapWidth)
                        this.drawTilePreview(mirrorId, adjustedX, newY, 0.5);
                }
                if (this.mirrorDiagonal) {
                    const adjustedY = size === 2 ? mirrorY - 1 : mirrorY;
                    const adjustedX = size === 2 ? mirrorX - 1 : mirrorX;
                    const mirrorId = this.getMirroredTileId(t.id, 'diagonal');
                    if (adjustedX >= 0 && adjustedX < this.mapWidth && adjustedY >= 0 && adjustedY < this.mapHeight)
                        this.drawTilePreview(mirrorId, adjustedX, adjustedY, 0.5);
                }
            }
        }
    }
};
