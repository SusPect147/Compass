// @ts-nocheck
import { supabase } from '../../core/supabase-client.js';
export const IOMixin = {
    async loadCollabMap(collabLinkId) {
        try {
            console.log(`[Compass] Loading collab map with link ID: ${collabLinkId}`);
            const { data: link, error: linkError } = await supabase
                .from('map_collab_links')
                .select('*')
                .eq('id', collabLinkId)
                .single();
            if (linkError || !link)
                throw linkError || new Error('Collab link not found');
            if (!link.is_active)
                throw new Error('This collaboration link has been revoked by the owner.');
            const { data, error } = await supabase
                .from('maps')
                .select('*')
                .eq('id', link.map_id)
                .single();
            if (error || !data)
                throw error || new Error('Map not found');
            this.collabLinkId = collabLinkId;
            this.collabOriginalMapId = link.map_id;
            this.loadedMapId = null; // Save as a new copy suggestion instead of overwriting!

            if (link.mode === 'realtime') {
                this.isRealtimeCollab = true;
                this.setupRealtimeChannel();
                
                // Show a realtime indicator
                setTimeout(() => {
                    const collabBanner = document.getElementById('collabBanner');
                    if (collabBanner) {
                        collabBanner.innerHTML = `🌐 ${window.cp_translate('Live Real-time Collaboration Active')} <button id="collabReadyBtn" style="background:#10b981; color:#fff; border:none; padding:4px 12px; border-radius:8px; font-weight:bold; margin-left:10px; cursor:pointer;">Ready</button>`;
                        collabBanner.style.background = 'rgba(16, 185, 129, 0.2)';
                        collabBanner.style.border = '1px solid rgba(16, 185, 129, 0.4)';
                        collabBanner.style.color = '#34d399';
                        
                        document.getElementById('collabReadyBtn').onclick = () => {
                            if(this.handleReadyClick) this.handleReadyClick();
                        };
                    }
                }, 100);
            }

            // Populate UI values and lock inputs
            const nameInput = document.getElementById('mapName');
            if (nameInput) {
                nameInput.value = data.name || 'Untitled Map';
                nameInput.disabled = true;
                nameInput.title = window.cp_translate("🔒 Name is locked in Collaboration mode");
            }
            const sizeSelect = document.getElementById('mapSize');
            if (sizeSelect) {
                sizeSelect.value = data.size || 'regular';
                sizeSelect.disabled = true;
                sizeSelect.title = window.cp_translate("🔒 Size is locked in Collaboration mode");
            }
            const gamemodeSelect = document.getElementById('gamemode');
            if (gamemodeSelect) {
                gamemodeSelect.value = data.gamemode || 'Gem_Grab';
                gamemodeSelect.disabled = true;
                gamemodeSelect.title = window.cp_translate("🔒 Gamemode is locked in Collaboration mode");
            }
            const environmentSelect = document.getElementById('environment');
            if (environmentSelect) {
                environmentSelect.value = data.environment || 'Desert';
                environmentSelect.disabled = true;
                environmentSelect.title = window.cp_translate("🔒 Environment is locked in Collaboration mode");
            }
            const collabBanner = document.getElementById('collabBanner');
            if (collabBanner)
                collabBanner.style.display = 'flex';
            this.gamemode = data.gamemode || 'Gem_Grab';
            this.environment = data.environment || 'Desert';
            await this.setSize(data.size || 'regular', false);
            if (data.map_data && Array.isArray(data.map_data)) {
                this.tileGrid = data.map_data;
            }
            this.tileAuthors = data.tile_authors || {};
            this.readyUsers = new Set();
            this.collabMapOwnerId = data.user_id;
            
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                this.currentUsername = session.user.user_metadata?.full_name || session.user.user_metadata?.display_name || session.user.user_metadata?.name || 'Anonymous';
                this.currentUserId = session.user.id;
            } else {
                this.currentUsername = 'Anonymous';
            }
            await this.setEnvironment(this.environment);
            await this.setGamemode(this.gamemode, false);
            this._errorsDirty = true;
            this.draw();
            requestAnimationFrame(() => {
                this.autoScaleViewport();
                this.centerCanvas();
            });
        }
        catch (error) {
            console.error('[Compass] Critical failure loading collab map:', error);
            alert(`${window.cp_translate('❌ Collaboration Access Failed:')} ${error.message}`);
        }
    },
    async loadMap(mapId) {
        try {
            const { data, error } = await supabase
                .from('maps')
                .select('*')
                .eq('id', mapId)
                .single();
            if (error)
                throw error;
            if (!data)
                throw new Error('Map not found');
            console.log(`[Compass] Successfully loaded map details for ID: ${mapId}`);
            const { data: { user } } = await supabase.auth.getUser();
            const urlParams = new URLSearchParams(window.location.search);
            const isDirectEdit = urlParams.get('edit') === 'true';
            // 1. Configure UI values
            const nameInput = document.getElementById('mapName');
            if (isDirectEdit && user && data.user_id === user.id) {
                console.info(`[Compass] Activating DIRECT EDIT mode on loaded map ID: ${mapId}`);
                this.loadedMapId = mapId;
                if (nameInput)
                    nameInput.value = data.name || 'Untitled Map';
            }
            else {
                this.loadedMapId = null; // Fresh clone!
                if (nameInput) {
                    nameInput.value = `Copy of ${data.name || 'Untitled Map'}`;
                }
            }
            const sizeSelect = document.getElementById('mapSize');
            if (sizeSelect)
                sizeSelect.value = data.size || 'regular';
            const gamemodeSelect = document.getElementById('gamemode');
            if (gamemodeSelect)
                gamemodeSelect.value = data.gamemode || 'Gem_Grab';
            const environmentSelect = document.getElementById('environment');
            if (environmentSelect)
                environmentSelect.value = data.environment || 'Desert';
            const isPublicToggle = document.getElementById('isPublicToggle');
            if (isPublicToggle)
                isPublicToggle.checked = data.is_public ?? true;
            const showThemeInGalleryToggle = document.getElementById('showThemeInGalleryToggle');
            const showThemeInDownloadToggle = document.getElementById('showThemeInDownloadToggle');
            const themeOptions = data.theme_options || { gallery: true, download: true };
            if (showThemeInGalleryToggle)
                showThemeInGalleryToggle.checked = themeOptions.gallery ?? true;
            if (showThemeInDownloadToggle)
                showThemeInDownloadToggle.checked = themeOptions.download ?? true;
            // 2. Configure instance variables and underlying grid
            this.gamemode = data.gamemode || 'Gem_Grab';
            this.environment = data.environment || 'Desert';
            // Resize boundaries gracefully without triggering visual purge alerts
            await this.setSize(data.size || 'regular', false);
            // Load grid content!
            if (data.map_data && Array.isArray(data.map_data)) {
                this.tileGrid = data.map_data;
            }
            this.tileAuthors = data.tile_authors || {};
            // Pull and parse standard visual assets
            await this.setEnvironment(this.environment);
            await this.setGamemode(this.gamemode, false); // pass false to 'apply' so it does not overwrite our loaded tileGrid with default template!
            this._errorsDirty = true;
            this.draw();
            // Center and scale the map mathematically after the layout settling frame to guarantee normal zoom!
            requestAnimationFrame(() => {
                this.autoScaleViewport();
                this.centerCanvas();
            });
        }
        catch (error) {
            console.error('[Compass] Critical failure loading map payload:', error);
            alert(`${window.cp_translate('❌ Critical Failure: Could not retrieve map from secure database!')} (${error.message})`);
        }
    },
    async saveMap() {
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                alert(window.cp_translate("❌ You must be logged in with Discord to save maps! Go to the Home page to log in."));
                return;
            }
            // COLLAB REDIRECT ROUTING
            if (this.collabLinkId && !this.isRealtimeCollab) {
                console.info(`[Compass] Diverting save logic to Collab Suggestion. Collab Link: ${this.collabLinkId}`);
                const contributor = user.user_metadata.full_name || user.user_metadata.display_name || user.user_metadata.name || 'Anonymous';
                const suggestionPayload = {
                    map_id: this.collabOriginalMapId,
                    contributor_id: user.id,
                    contributor_name: contributor,
                    map_data: this.tileGrid,
                    note: ''
                };
                const { error: sugErr } = await supabase
                    .from('map_suggestions')
                    .insert([suggestionPayload]);
                if (sugErr)
                    throw sugErr;
                alert(window.cp_translate("🤝 Suggestion successfully sent to the map owner!"));
                return;
            } else if (this.collabLinkId && this.isRealtimeCollab) {
                // In realtime mode, only owner can actually save the DB.
                // We'll proceed with standard save, but we need to target the original map ID!
                this.loadedMapId = this.collabOriginalMapId;
            }

            const mapName = document.getElementById('mapName').value.trim() || 'Untitled Map';
            const mapSize = document.getElementById('mapSize').value;
            const gamemode = document.getElementById('gamemode').value;
            const environment = document.getElementById('environment').value;
            // Robust author detection matching other site modules
            const author = user.user_metadata.full_name || user.user_metadata.display_name || user.user_metadata.name || 'Anonymous';
            const isPublic = document.getElementById('isPublicToggle')?.checked ?? false;
            let finalEnvironment = environment;
            const galleryToggle = document.getElementById('showThemeInGalleryToggle');
            const galleryEnabled = galleryToggle?.checked ?? true;
            // Logic: If custom theme is disabled for gallery, fall back to Desert automatically
            if (!galleryEnabled && environment.startsWith('CUSTOM_')) {
                finalEnvironment = 'Desert';
            }
            const payload = {
                name: mapName,
                size: mapSize,
                gamemode: gamemode,
                environment: finalEnvironment,
                map_data: this.tileGrid,
                tile_authors: this.tileAuthors || {},
                author_name: author,
                user_id: user.id,
                is_public: isPublic,
                theme_options: {
                    gallery: galleryEnabled,
                    download: document.getElementById('showThemeInDownloadToggle')?.checked ?? true
                }
            };
            let savedMapId = null;
            if (this.loadedMapId) {
                console.info(`[Compass] Attempting database UPDATE on existing Map ID: ${this.loadedMapId}`);
                const { error } = await supabase
                    .from('maps')
                    .update(payload)
                    .eq('id', this.loadedMapId)
                    .eq('user_id', user.id);
                if (error)
                    throw error;
                savedMapId = this.loadedMapId;
            }
            else {
                console.info(`[Compass] Attempting database INSERT for new map clone.`);
                // Standardizing to .single() and selecting only 'id' to minimize payload and avoid RLS/PostgREST 400 issues with large columns
                const { data, error } = await supabase
                    .from('maps')
                    .insert(payload)
                    .select('id')
                    .single();
                if (error)
                    throw error;
                savedMapId = data?.id;
            }
            const mapLinkElement = document.getElementById('mapLink');
            if (mapLinkElement && savedMapId) {
                const currentLoc = window.location.origin + window.location.pathname.replace('editor.html', 'view.html');
                mapLinkElement.innerText = `${currentLoc}?id=${savedMapId}`;
                mapLinkElement.href = `${currentLoc}?id=${savedMapId}`;
            }
            alert(this.loadedMapId ? window.cp_translate('Map updated successfully in secure database!') : window.cp_translate('Map saved successfully to Supabase database!'));
        }
        catch (error) {
            console.error('[Compass] Error saving map:', error);
            let errorMessage = error.message || 'Unknown error';
            let detail = error.details || error.hint || '';
            // Helpful hint for schema mismatch
            if (error.code === '42703' || errorMessage.includes('theme_options')) {
                detail += ' | HINT: Please add the "theme_options" JSONB column to your Supabase "maps" table.';
            }
            alert(`${window.cp_translate('Failed to save map:')} ${errorMessage}${detail ? '\n\nDetails: ' + detail : ''}`);
        }
    },
    async createMapPNG() {
        // === HD EXPORT: temporarily scale up tileSize/padding for crisp output ===
        const EXPORT_SCALE = 4; // 4x → tiles render at 128px instead of 32px
        const originalTileSize = this.tileSize;
        const originalPadding = this.canvasPadding;
        this.tileSize = originalTileSize * EXPORT_SCALE;
        this.canvasPadding = originalPadding * EXPORT_SCALE;
        const tileSize = this.tileSize;
        const padding = this.canvasPadding;
        const canvas = document.createElement('canvas');
        canvas.width = (this.mapWidth * tileSize) + (padding * 2);
        canvas.height = (this.mapHeight * tileSize) + (padding * 2);
        const ctx = canvas.getContext('2d');
        // Enable high-quality image interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        try {
            // Draw background
            for (let y = 0; y < this.mapHeight; y++) {
                for (let x = 0; x < this.mapWidth; x++) {
                    const isDark = (x + y) % 2 === 0;
                    const bgImg = isDark ? this.bgDark : this.bgLight;
                    // Skip Brawl Ball corners in regular size
                    if ((this.gamemode === 'Brawl_Ball' || this.gamemode === 'Hockey') &&
                        this.mapSize === this.mapSizes.regular) {
                        const atTop = y < 4;
                        const atBottom = y >= this.mapHeight - 4;
                        const atLeft = x < 7;
                        const atRight = x >= this.mapWidth - 7;
                        if ((atTop || atBottom) && (atLeft || atRight))
                            continue;
                    }
                    if (bgImg?.complete) {
                        ctx.drawImage(bgImg, x * tileSize + padding, y * tileSize + padding, tileSize, tileSize);
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
                    ctx.drawImage(this.basketMarkingsImage, this.canvasPadding, this.canvasPadding, this.mapWidth * this.tileSize, this.mapHeight * this.tileSize);
                }
            }
            if (this.gamemode === 'Siege' && this.mapSize === this.mapSizes.siege) {
                // Cache siege markings image if not already loaded
                if (!this.siegeMarkingsImage) {
                    this.siegeMarkingsImage = new Image();
                    this.siegeMarkingsImage.src = 'Resources/Global/SiegeMarkings.png';
                }
                // Draw siege markings if loaded
                if (this.siegeMarkingsImage.complete) {
                    ctx.drawImage(this.siegeMarkingsImage, this.canvasPadding, this.canvasPadding, this.mapWidth * this.tileSize, this.mapHeight * this.tileSize);
                }
            }
            if (this.gamemode === 'Spirit_Wars' && this.mapSize === this.mapSizes.regular) {
                // Cache siege markings image if not already loaded
                if (!this.siegeMarkingsImage) {
                    this.siegeMarkingsImage = new Image();
                    this.siegeMarkingsImage.src = 'Resources/Global/SpiritWarsMarkings.png';
                }
                // Draw siege markings if loaded
                if (this.siegeMarkingsImage.complete) {
                    ctx.drawImage(this.siegeMarkingsImage, this.canvasPadding, this.canvasPadding, this.mapWidth * this.tileSize, this.mapHeight * this.tileSize);
                }
            }
            // Group tiles by layer
            const tilesByLayer = new Map();
            for (let layerIndex = 0; layerIndex < this.layerCount; layerIndex++) {
                const layerGrid = this.tileGrid[layerIndex];
                if (!layerGrid)
                    continue;
                for (let y = 0; y < this.mapHeight; y++) {
                    for (let x = 0; x < this.mapWidth; x++) {
                        const tileId = layerGrid[y][x];
                        if (tileId === 0 || tileId === -1)
                            continue;
                        const def = this.tileDefinitions[tileId];
                        if (!def)
                            continue;
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
                if (!tiles)
                    return null;
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
                        if (x < 0 || x >= width || y < 0 || y >= height)
                            return false;
                        const id = trackLayerGrid[y][x];
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
                        if (smallIkeLayerGrid[y][x] === 47) {
                            let firstRun = true;
                            const addRedToConnections = (x, y) => {
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
                                if (top)
                                    addRedToConnections(x, y - 1);
                                if (right)
                                    addRedToConnections(x + 1, y);
                                if (bottom)
                                    addRedToConnections(x, y + 1);
                                if (left)
                                    addRedToConnections(x - 1, y);
                            };
                            addRedToConnections(x, y);
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
                        // drawTile reads this.tileSize internally → renders at 128px/tile
                        this.drawTile(ctx, tileId, x, y, red);
                    });
                });
            });
            if (this.gamemode === 'Basket_Brawl' && this.mapSize === this.mapSizes.basket) {
                if (this.basketsImage.complete) {
                    ctx.drawImage(this.basketsImage, this.canvasPadding, this.canvasPadding, this.mapWidth * this.tileSize, this.mapHeight * this.tileSize);
                }
            }
            // Draw goal images if any
            // offsetX/offsetY are absolute pixels tuned for 32px tiles → scale them proportionally
            if (this.goalImages?.length) {
                for (const goal of this.goalImages) {
                    const img = this.goalImageCache[`${goal.name}${this.environment}`] ||
                        this.goalImageCache[goal.name];
                    if (!img || !img.complete)
                        continue;
                    ctx.drawImage(img, goal.x * tileSize + padding + (goal.offsetX || 0) * EXPORT_SCALE, goal.y * tileSize + padding + (goal.offsetY || 0) * EXPORT_SCALE, (goal.w || 1) * tileSize, (goal.h || 1) * tileSize);
                }
            }
            return canvas.toDataURL('image/png');
        }
        finally {
            // Always restore original editor tile size — export must never affect the live canvas
            this.tileSize = originalTileSize;
            this.canvasPadding = originalPadding;
        }
    },
    async exportMap() {
        const mapName = document.getElementById('mapName').value || 'Untitled Map';
        const includeTheme = document.getElementById('showThemeInDownloadToggle')?.checked ?? true;
        const originalEnv = this.environment;
        let targetEnv = this.environment;
        // Handle disabled theme download
        // If theme is disabled and we have a custom theme environment, fall back to Desert automatically for clean exports
        if (!includeTheme && targetEnv.startsWith('CUSTOM_')) {
            targetEnv = "Desert";
        }
        if (!includeTheme)
            window.cp_bypassTheme = true;
        try {
            if (targetEnv !== originalEnv || !includeTheme) {
                // Purge caches to force the theme interceptor to re-evaluate with the new bypass state
                this.tileImages = {};
                this.tileImagePaths = {};
                this.goalImageCache = {};
                this.environment = targetEnv;
                const goalPromises = (this.goalImages && this.goalImages.length > 0)
                    ? this.goalImages.map(goal => this.preloadGoalImage(goal.name, this.environment))
                    : [];
                await Promise.all([
                    this.loadTileImages(),
                    this.loadEnvironmentBackgrounds(),
                    ...goalPromises
                ]);
                this.preloadWaterTiles(); // Preload water, ice, and snow tiles!
            }
            const dataUrl = await this.createMapPNG();
            if (targetEnv !== originalEnv || !includeTheme) {
                this.tileImages = {};
                this.tileImagePaths = {};
                this.goalImageCache = {};
                this.environment = originalEnv;
                const goalPromises = (this.goalImages && this.goalImages.length > 0)
                    ? this.goalImages.map(goal => this.preloadGoalImage(goal.name, this.environment))
                    : [];
                await Promise.all([
                    this.loadTileImages(),
                    this.loadEnvironmentBackgrounds(),
                    ...goalPromises
                ]);
                this.preloadWaterTiles(); // Preload water, ice, and snow tiles!
            }
            // Use fetch+blob to trigger download without holding a large base64 string in memory
            const blob = await fetch(dataUrl).then(r => r.blob());
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `${mapName}.png`;
            link.href = blobUrl;
            link.click();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        }
        finally {
            window.cp_bypassTheme = false;
        }
    },

    setupRealtimeChannel() {
        if (!this.collabOriginalMapId) return;
        this.realtimeChannel = supabase.channel(`map_collab_${this.collabOriginalMapId}`);
        
        this.realtimeChannel
            .on('broadcast', { event: 'map_update' }, (payload) => {
                this.handleRemoteUpdate(payload.payload);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Compass] Successfully connected to realtime channel!');
                }
            });
    },

    broadcastMapUpdate(payload) {
        if (this.isRealtimeCollab && this.realtimeChannel) {
            this.realtimeChannel.send({
                type: 'broadcast',
                event: 'map_update',
                payload: payload
            }).catch(err => console.error("[Compass] Broadcast failed", err));
        }
    },

    handleRemoteUpdate(payload) {
        if (!payload) return;
        
        this.isProcessingRemote = true;
        try {
            if (payload.type === 'place') {
                if (payload.author) {
                    this.tileAuthors = this.tileAuthors || {};
                    this.tileAuthors[`${payload.y},${payload.x}`] = payload.author;
                }
                this.placeTile(payload.x, payload.y, payload.tileId, false);
            } else if (payload.type === 'erase') {
                if (this.tileAuthors) delete this.tileAuthors[`${payload.y},${payload.x}`];
                this.eraseTile(payload.x, payload.y, false);
            } else if (payload.type === 'clear') {
                this.tileAuthors = {};
                this.resetAllLayers();
                this._errorsDirty = true;
            } else if (payload.type === 'ready') {
                if (!this.readyUsers) this.readyUsers = new Set();
                this.readyUsers.add(payload.id || payload.user);
                
                // If 2 users are ready and I am the owner, trigger save and finish
                if (this.readyUsers.size >= 2 && this.currentUserId === this.collabMapOwnerId) {
                    this.finishCollabAsOwner();
                }
            } else if (payload.type === 'finish_collab') {
                // If I am NOT the owner, save the map to my account
                if (this.currentUserId !== this.collabMapOwnerId) {
                    this.saveFinishedCollabMap(payload.data);
                }
            }
            this.draw();
        } catch (e) {
            console.error("[Compass] Remote update error", e);
        } finally {
            this.isProcessingRemote = false;
        }
    },
    
    handleReadyClick() {
        if (!this.isRealtimeCollab || !this.realtimeChannel) return;
        const btn = document.getElementById('collabReadyBtn');
        if (btn) {
            btn.textContent = 'Ready (Waiting...)';
            btn.disabled = true;
            btn.style.opacity = '0.7';
        }
        
        this.broadcastMapUpdate({ type: 'ready', user: this.currentUsername, id: this.currentUserId });
        // Handle locally
        this.handleRemoteUpdate({ type: 'ready', user: this.currentUsername, id: this.currentUserId });
    },

    async finishCollabAsOwner() {
        try {
            // Compute combined author names
            const allParticipants = new Set();
            if (this.currentUsername) allParticipants.add(this.currentUsername);
            if (this.tileAuthors) {
                Object.values(this.tileAuthors).forEach(name => allParticipants.add(name));
            }
            const combinedAuthorName = Array.from(allParticipants).join(' & ');
            
            // Set the UI map name
            const nameInput = document.getElementById('mapName');
            if (nameInput) {
                nameInput.disabled = false;
                nameInput.value = nameInput.value + ' (Collab)';
            }
            
            const mapName = nameInput ? nameInput.value : 'Untitled Map';
            const sizeStr = document.getElementById('mapSize')?.value || 'regular';
            const payload = {
                name: mapName,
                size: sizeStr,
                gamemode: this.gamemode,
                environment: this.environment,
                map_data: this.tileGrid,
                tile_authors: this.tileAuthors || {},
                author_name: combinedAuthorName,
            };
            
            const { error } = await supabase
                .from('maps')
                .update(payload)
                .eq('id', this.collabOriginalMapId);
                
            if (error) throw error;
            
            this.broadcastMapUpdate({
                type: 'finish_collab',
                data: payload
            });
            
            alert(window.cp_translate('Collaboration finished! Map saved successfully.'));
            window.location.href = './dashboard.html';
        } catch (e) {
            console.error(e);
            alert('Failed to finish collab: ' + e.message);
        }
    },
    
    async saveFinishedCollabMap(mapData) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            const payload = {
                ...mapData,
                user_id: user.id,
                is_public: false // Default private for the guest
            };
            
            const { error } = await supabase.from('maps').insert([payload]);
            if (error) throw error;
            
            alert(window.cp_translate('Collaboration finished! A copy of this map was saved to your My Maps.'));
            window.location.href = './dashboard.html';
        } catch (e) {
            console.error(e);
            alert('Failed to save finished collab map to your account: ' + e.message);
        }
    }
};
