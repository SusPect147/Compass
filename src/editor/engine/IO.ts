// @ts-nocheck
import { supabase } from '../../core/supabase-client.js';
export const IOMixin = {
    async loadCollabMap(collabLinkId) {
        try {
            console.log(`[Compass] Loading collab map with link ID: ${collabLinkId}`);
            
            // Resolve session first to prevent race condition before setting up realtime channel
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    this.currentUsername = session.user.user_metadata?.full_name || session.user.user_metadata?.display_name || session.user.user_metadata?.name || 'Anonymous';
                    this.currentUserId = session.user.id;
                } else {
                    this.currentUsername = 'Anonymous';
                }
            } catch (sessErr) {
                console.warn('[Compass] Could not resolve session:', sessErr);
                this.currentUsername = 'Anonymous';
            }

            // ЁЯФз ╨Ш╨б╨Я╨а╨Р╨Т╨Ы╨Х╨Э╨Ш╨Х: ╨╕╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╨╝ maybeSingle ╨▓╨╝╨╡╤Б╤В╨╛ single ╨┤╨╗╤П ╨▒╨╡╨╖╨╛╨┐╨░╤Б╨╜╨╛╨╣ ╨╛╨▒╤А╨░╨▒╨╛╤В╨║╨╕
            const { data: link, error: linkError } = await supabase
                .from('map_collab_links')
                .select('*')
                .eq('id', collabLinkId)
                .maybeSingle();  // тЖР maybeSingle ╨▓╨╡╤А╨╜╤С╤В null ╨▓╨╝╨╡╤Б╤В╨╛ ╨╛╤И╨╕╨▒╨║╨╕, ╨╡╤Б╨╗╨╕ ╨╖╨░╨┐╨╕╤Б╨╕ ╨╜╨╡╤В
            
            // ЁЯФз ╨Ш╨б╨Я╨а╨Р╨Т╨Ы╨Х╨Э╨Ш╨Х: ╨┐╤А╨░╨▓╨╕╨╗╤М╨╜╨░╤П ╨╛╨▒╤А╨░╨▒╨╛╤В╨║╨░ ╨╛╤И╨╕╨▒╨╛╨║ ╨╕ ╨╛╤В╤Б╤Г╤В╤Б╤В╨▓╨╕╤П ╨┤╨░╨╜╨╜╤Л╤Е
            if (linkError) {
                console.error('[Compass] Database error while fetching collab link:', linkError);
                throw new Error(`Database error: ${linkError.message}`);
            }
            
            if (!link) {
                console.error('[Compass] Collaboration link not found in database:', collabLinkId);
                throw new Error('Collaboration link not found. It may have been deleted, expired, or deactivated.');
            }
            
            if (!link.is_active)
                throw new Error('This collaboration link has been revoked by the owner.');
                
            // ╨Я╤А╨╛╨▓╨╡╤А╨║╨░ ╤Б╤А╨╛╨║╨░ ╨┤╨╡╨╣╤Б╤В╨▓╨╕╤П ╤Б╤Б╤Л╨╗╨║╨╕ (╨╡╤Б╨╗╨╕ ╨┐╨╛╨╗╨╡ expires_at ╤Б╤Г╤Й╨╡╤Б╤В╨▓╤Г╨╡╤В)
            if (link.expires_at && new Date(link.expires_at) < new Date()) {
                throw new Error('This collaboration link has expired.');
            }
            
            const { data, error } = await supabase
                .from('maps')
                .select('*')
                .eq('id', link.map_id)
                .single();
            if (error || !data)
                throw error || new Error('Map not found');
            this.collabLinkId = collabLinkId;
            this.collabOriginalMapId = link.map_id;
            this.collabMapOwnerId = data.user_id; // Set this early!
            this.loadedMapId = null; // Save as a new copy suggestion instead of overwriting!

            if (link.mode === 'realtime') {
                this.isRealtimeCollab = true;
                this.setupRealtimeChannel();
                
                // Show a realtime indicator
                setTimeout(() => {
                    const collabBanner = document.getElementById('collabBanner');
                    if (collabBanner) {
                        collabBanner.innerHTML = `ЁЯМР ${window.cp_translate('Live Real-time Collaboration Active')} <button id="collabReadyBtn" class="collab-ready-btn">${window.cp_translate('Ready')}</button>`;
                        collabBanner.className = 'collab-banner-active';
                        collabBanner.style.background = '';
                        collabBanner.style.border = '';
                        collabBanner.style.color = '';
                        
                        const readyBtn = document.getElementById('collabReadyBtn');
                        if (readyBtn) {
                            readyBtn.onclick = () => {
                                if (this.handleReadyClick) this.handleReadyClick();
                            };
                        }
                    }
                }, 100);
            }

            // Populate UI values and lock inputs
            const nameInput = document.getElementById('mapName');
            if (nameInput) {
                nameInput.value = data.name || 'Untitled Map';
                nameInput.disabled = true;
                nameInput.title = window.cp_translate("ЁЯФТ Name is locked in Collaboration mode");
            }
            const sizeSelect = document.getElementById('mapSize');
            if (sizeSelect) {
                sizeSelect.value = data.size || 'regular';
                sizeSelect.disabled = true;
                sizeSelect.title = window.cp_translate("ЁЯФТ Size is locked in Collaboration mode");
            }
            const gamemodeSelect = document.getElementById('gamemode');
            if (gamemodeSelect) {
                gamemodeSelect.value = data.gamemode || 'Gem_Grab';
                gamemodeSelect.disabled = true;
                gamemodeSelect.title = window.cp_translate("ЁЯФТ Gamemode is locked in Collaboration mode");
            }
            const environmentSelect = document.getElementById('environment');
            if (environmentSelect) {
                environmentSelect.value = data.environment || 'Desert';
                environmentSelect.disabled = true;
                environmentSelect.title = window.cp_translate("ЁЯФТ Environment is locked in Collaboration mode");
            }
            const collabBanner = document.getElementById('collabBanner');
            if (collabBanner)
                collabBanner.style.display = 'flex';
            this.gamemode = data.gamemode || 'Gem_Grab';
            this.environment = data.environment || 'Desert';
            await this.setSize(data.size || 'regular', false);
            if (data.map_data && Array.isArray(data.map_data) && data.map_data.length > 0) {
                this.tileGrid = data.map_data;
                this.tileAuthors = data.tile_authors || {};
                this.readyUsers = new Set();
                this.collabMapOwnerId = data.user_id;
                await this.setEnvironment(this.environment);
                // setEnvironment internally calls setGamemode(false) тАФ preserves our loaded grid
            } else {
                // map_data is empty or invalid тАФ render default spawns and objectives
                console.log('[Compass] map_data is empty, applying default layout...');
                this.tileAuthors = {};
                this.readyUsers = new Set();
                this.collabMapOwnerId = data.user_id;
                await this.setEnvironment(this.environment);
                // setEnvironment calls setGamemode(false), so tileGrid is valid тАФ now apply defaults
                this.applyDefaultLayoutIfEmpty();
            }
            this._errorsDirty = true;
            this.draw();
            requestAnimationFrame(() => {
                this.autoScaleViewport();
                this.centerCanvas();
            });
        }
        catch (error) {
            console.error('[Compass] Critical failure loading collab map:', error);
            alert(`${window.cp_translate('тЭМ Collaboration Access Failed:')} ${error.message}`);
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
            if (data.map_data && Array.isArray(data.map_data) && data.map_data.length > 0) {
                this.tileGrid = data.map_data;
                this.tileAuthors = data.tile_authors || {};
                // Pull and parse standard visual assets
                await this.setEnvironment(this.environment);
                // setEnvironment internally calls setGamemode(false) тАФ preserves our loaded grid
            } else {
                // map_data is empty тАФ render default spawns and objectives
                console.log('[Compass] map_data is empty, applying default layout...');
                this.tileAuthors = {};
                await this.setEnvironment(this.environment);
                // setEnvironment calls setGamemode(false), so tileGrid is valid тАФ now apply defaults
                this.applyDefaultLayoutIfEmpty();
            }
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
            alert(`${window.cp_translate('тЭМ Critical Failure: Could not retrieve map from secure database!')} (${error.message})`);
        }
    },
    async saveMap() {
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                try {
                    const mapName = document.getElementById('mapName').value.trim() || 'Untitled Map';
                    const mapSize = document.getElementById('mapSize').value;
                    const gamemode = document.getElementById('gamemode').value;
                    const environment = document.getElementById('environment').value;
                    const isPublic = document.getElementById('isPublicToggle')?.checked ?? false;
                    
                    let finalEnvironment = environment;
                    const galleryToggle = document.getElementById('showThemeInGalleryToggle');
                    const galleryEnabled = galleryToggle?.checked ?? true;
                    if (!galleryEnabled && environment.startsWith('CUSTOM_')) {
                        finalEnvironment = 'Desert';
                    }

                    const localMapPayload = {
                        name: mapName,
                        size: mapSize,
                        gamemode: gamemode,
                        environment: finalEnvironment,
                        map_data: this.tileGrid,
                        tile_authors: this.tileAuthors || {},
                        is_public: isPublic,
                        theme_options: {
                            gallery: galleryEnabled,
                            download: document.getElementById('showThemeInDownloadToggle')?.checked ?? true
                        },
                        saved_at: new Date().toISOString()
                    };

                    let localMaps = [];
                    try {
                        const existing = localStorage.getItem('compass_local_maps');
                        if (existing) localMaps = JSON.parse(existing);
                    } catch(e) {}
                    
                    localMaps.push(localMapPayload);
                    localStorage.setItem('compass_local_maps', JSON.stringify(localMaps));
                    
                    alert(window.cp_translate ? window.cp_translate("Map saved locally! Log in with Discord to sync it to the database.") : "╨Ъ╨░╤А╤В╨░ ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨░ ╨╗╨╛╨║╨░╨╗╤М╨╜╨╛! ╨Т╨╛╨╣╨┤╨╕╤В╨╡ ╤З╨╡╤А╨╡╨╖ Discord, ╤З╤В╨╛╨▒╤Л ╤Б╨╛╤Е╤А╨░╨╜╨╕╤В╤М ╨╡╤С ╨▓ ╨▒╨░╨╖╤Г ╨┤╨░╨╜╨╜╤Л╤Е.");
                } catch(localErr) {
                    console.error('[Compass] Failed to save locally:', localErr);
                    alert("Failed to save map locally.");
                }
                return;
            }
            // COLLAB REDIRECT ROUTING
            if (this.collabLinkId && !this.isRealtimeCollab) {
                console.info(`[Compass] Diverting save logic to Collab Suggestion. Collab Link: ${this.collabLinkId}`);
                const contributor = user.user_metadata.full_name || user.user_metadata.display_name || user.user_metadata.name || 'Anonymous';
                // RPC uses SECURITY DEFINER to bypass the RLS COALESCE bug.
                // Returns JSON {ok: true} or {ok: false, error: '...'}
                const { data: rpcResult, error: sugErr } = await supabase.rpc('submit_map_suggestion', {
                    p_map_id: this.collabOriginalMapId,
                    p_contributor_id: user.id,
                    p_contributor_name: contributor,
                    p_map_data: this.tileGrid,
                });
                if (sugErr) {
                    console.error('[Compass] Suggestion RPC transport error:', JSON.stringify(sugErr));
                    throw sugErr;
                }
                if (rpcResult && rpcResult.ok === false) {
                    console.error('[Compass] Suggestion RPC logic error:', rpcResult.error);
                    throw new Error(rpcResult.error || 'Unknown suggestion error');
                }

                alert(window.cp_translate("ЁЯдЭ Suggestion successfully sent to the map owner!"));
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

            // --- THUMBNAIL GENERATION ---
            let thumbnailUrl = null;
            try {
                // Generate a 1x (standard size) WebP preview, compressed to save space and upload time
                const thumbDataUrl = await this.createMapPNG(1, 'image/webp', 0.8);
                const thumbRes = await fetch(thumbDataUrl);
                const thumbBlob = await thumbRes.blob();
                
                const fileName = `thumb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.webp`;
                
                const { error: uploadError } = await supabase.storage
                    .from('map_thumbnails')
                    .upload(fileName, thumbBlob, { contentType: 'image/webp', cacheControl: '3600', upsert: false });
                    
                if (uploadError) {
                    console.warn('[Compass] Thumbnail upload failed, proceeding without it:', uploadError);
                } else {
                    const { data: publicUrlData } = supabase.storage
                        .from('map_thumbnails')
                        .getPublicUrl(fileName);
                    thumbnailUrl = publicUrlData.publicUrl;
                }
            } catch (thumbErr) {
                console.warn('[Compass] Thumbnail generation failed, proceeding without it:', thumbErr);
            }
            // ------------------------------
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
            if (thumbnailUrl) {
                payload.thumbnail_url = thumbnailUrl;
            }
            let savedMapId = null;
            if (this.loadedMapId) {
                console.info(`[Compass] Attempting database UPDATE on existing Map ID: ${this.loadedMapId}`);
                
                // --- COMPACT OLD VERSION ARCHIVE ---
                try {
                    const { data: oldMap } = await supabase.from('maps').select('map_data').eq('id', this.loadedMapId).single();
                    if (oldMap && oldMap.map_data) {
                        // Delete previous 'old version' to prevent DB overload (do it smartly)
                        await supabase.from('map_suggestions').delete()
                            .eq('map_id', this.loadedMapId)
                            .eq('contributor_id', user.id)
                            .eq('contributor_name', '╤Б╤В╨░╤А╨░╤П ╨▓╨╡╤А╤Б╨╕╤П');
                        
                        // Archive the old map data
                        await supabase.rpc('archive_map_version', {
                            p_map_id: this.loadedMapId,
                            p_owner_id: user.id,
                            p_label: '╤Б╤В╨░╤А╨░╤П ╨▓╨╡╤А╤Б╨╕╤П',
                            p_map_data: oldMap.map_data
                        });
                    }
                } catch(e) {
                    console.warn('[Compass] Failed to archive old version:', e);
                }
                // ------------------------------------

                let { error } = await supabase
                    .from('maps')
                    .update(payload)
                    .eq('id', this.loadedMapId)
                    .eq('user_id', user.id);
                if (error && error.code === '42703') {
                    console.warn('[Compass] tile_authors column is missing in Supabase. Retrying without it.');
                    const fallbackPayload = { ...payload };
                    delete fallbackPayload.tile_authors;
                    const { error: fallbackError } = await supabase
                        .from('maps')
                        .update(fallbackPayload)
                        .eq('id', this.loadedMapId)
                        .eq('user_id', user.id);
                    error = fallbackError;
                }
                if (error)
                    throw error;
                savedMapId = this.loadedMapId;
            }
            else {
                console.info(`[Compass] Attempting database INSERT for new map clone.`);
                // Standardizing to .single() and selecting only 'id' to minimize payload and avoid RLS/PostgREST 400 issues with large columns
                let { data, error } = await supabase
                    .from('maps')
                    .insert(payload)
                    .select('id')
                    .single();
                if (error && error.code === '42703') {
                    console.warn('[Compass] tile_authors column is missing in Supabase. Retrying without it.');
                    const fallbackPayload = { ...payload };
                    delete fallbackPayload.tile_authors;
                    const { data: fallbackData, error: fallbackError } = await supabase
                        .from('maps')
                        .insert(fallbackPayload)
                        .select('id')
                        .single();
                    data = fallbackData;
                    error = fallbackError;
                }
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
    async createMapPNG(scale = 4, format = 'image/png', quality = 1.0) {
        // === HD EXPORT: temporarily scale up tileSize/padding for crisp output ===
        const EXPORT_SCALE = scale; 
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
                        // drawTile reads this.tileSize internally тЖТ renders at 128px/tile
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
            // offsetX/offsetY are absolute pixels tuned for 32px tiles тЖТ scale them proportionally
            if (this.goalImages?.length) {
                for (const goal of this.goalImages) {
                    const img = this.goalImageCache[`${goal.name}${this.environment}`] ||
                        this.goalImageCache[goal.name];
                    if (!img || !img.complete)
                        continue;
                    ctx.drawImage(img, goal.x * tileSize + padding + (goal.offsetX || 0) * EXPORT_SCALE, goal.y * tileSize + padding + (goal.offsetY || 0) * EXPORT_SCALE, (goal.w || 1) * tileSize, (goal.h || 1) * tileSize);
                }
            }
            return canvas.toDataURL(format, quality);
        }
        finally {
            // Always restore original editor tile size тАФ export must never affect the live canvas
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
            
            // Revert bypass immediately since we have the dataUrl
            window.cp_bypassTheme = false;

            const triggerDownload = (url) => {
                try {
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
                    link.download = `${mapName}.png`;
                    link.href = blobUrl;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                } catch(e) {
                    console.error('[Compass] Blob conversion failed, falling back to direct URL', e);
                    const link = document.createElement('a');
                    link.download = `${mapName}.png`;
                    link.href = url;
                    link.click();
                }
            };

            let modal = document.getElementById('sharpnessModal');
            
            // If the modal isn't found in the DOM (e.g. cached HTML), inject it dynamically
            if (!modal) {
                const modalHtml = `
                    <svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
                        <filter id="sharpnessFilter">
                            <feConvolveMatrix id="sharpnessMatrix" order="3 3" preserveAlpha="true" kernelMatrix="0 0 0 0 1 0 0 0 0"/>
                        </filter>
                    </svg>
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
            const matrixEl = document.getElementById('sharpnessMatrix');

            if (!modal || !previewCanvas) {
                console.error('[Compass] Failed to create sharpness modal components');
                triggerDownload(dataUrl);
                return;
            }

            modal.style.display = 'flex';
            slider.value = '0';
            if (display) display.textContent = '0';
            if (matrixEl) matrixEl.setAttribute('kernelMatrix', '0 0 0 0 1 0 0 0 0');
            previewCanvas.style.filter = 'none';
            previewCanvas.style.transform = 'none';

            const img = new Image();
            img.onload = () => {
                previewCanvas.width = img.width;
                previewCanvas.height = img.height;
                const ctx = previewCanvas.getContext('2d');
                if (ctx) {
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(img, 0, 0);
                }
                
                const updatePreview = () => {
                    const intensity = parseInt(slider.value, 10);
                    if (display) display.textContent = intensity.toString();
                    
                    if (intensity === 0) {
                        previewCanvas.style.filter = 'none';
                        return;
                    }
                    
                    const a = intensity / 100;
                    const center = 1 + 4 * a;
                    const edge = -a;
                    
                    const matrix = `0 ${edge} 0 ${edge} ${center} ${edge} 0 ${edge} 0`;
                    if (matrixEl) {
                        matrixEl.setAttribute('kernelMatrix', matrix);
                        previewCanvas.style.filter = 'url(#sharpnessFilter)';
                    }
                };
                
                // Use onchange or oninput, oninput is fine since SVG filter is instant
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
                    previewCanvas.style.filter = 'none';
                    previewCanvas.style.transform = 'none';

                    if (previewContainer) {
                        previewContainer.removeEventListener('wheel', onWheel);
                        previewContainer.removeEventListener('contextmenu', onContextMenu);
                        previewContainer.removeEventListener('mousedown', onMouseDown);
                        previewContainer.style.cursor = 'grab';
                    }
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                };
                
                cancelBtn.onclick = cleanup;
                closeBtn.onclick = cleanup;
                
                downloadBtn.onclick = () => {
                    const intensity = parseInt(slider.value, 10);
                    if (intensity === 0) {
                        triggerDownload(dataUrl);
                    } else {
                        // Apply filter to a temporary canvas to bake it into the exported PNG
                        const exportCanvas = document.createElement('canvas');
                        exportCanvas.width = img.width;
                        exportCanvas.height = img.height;
                        const exCtx = exportCanvas.getContext('2d');
                        if (exCtx) {
                            exCtx.filter = 'url(#sharpnessFilter)';
                            exCtx.drawImage(img, 0, 0);
                            triggerDownload(exportCanvas.toDataURL('image/png'));
                        } else {
                            triggerDownload(dataUrl);
                        }
                    }
                    cleanup();
                };
            };
            img.src = dataUrl;
        }
        finally {
            // Already handled above, just safety
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
                    
                    if (this.currentUserId === this.collabMapOwnerId) {
                        // Owner broadcasts 'owner_join' so guests know to send their current grid
                        console.log('[Compass] Owner joined тАФ broadcasting owner_join event...');
                        this.realtimeChannel.send({
                            type: 'broadcast',
                            event: 'map_update',
                            payload: {
                                type: 'owner_join',
                                user: this.currentUsername || 'Owner',
                                id: this.currentUserId
                            }
                        }).catch(err => console.error('[Compass] owner_join broadcast failed', err));
                    } else {
                        // Guest broadcasts 'join' to sync state from the owner's active session memory
                        console.log('[Compass] Guest joined тАФ broadcasting join event...');
                        this.broadcastMapUpdate({
                            type: 'join',
                            user: this.currentUsername || 'Anonymous',
                            id: this.currentUserId
                        });
                    }
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
            
            if (this.triggerAutoSave) this.triggerAutoSave();
        }
    },

    handleRemoteUpdate(payload) {
        if (!payload) return;
        
        this.isProcessingRemote = true;
        try {
            if (payload.type === 'join') {
                if (this.currentUserId === this.collabMapOwnerId) {
                    console.log(`[Compass] Owner received join event from ${payload.user}. Broadcasting full_sync...`);
                    this.broadcastMapUpdate({
                        type: 'full_sync',
                        tileGrid: this.tileGrid,
                        tileAuthors: this.tileAuthors || {}
                    });
                }
            } else if (payload.type === 'owner_join') {
                // Owner reconnected тАФ guests respond with their current grid
                if (this.currentUserId !== this.collabMapOwnerId) {
                    console.log('[Compass] Received owner_join. Guest sending guest_sync to owner...');
                    this.realtimeChannel.send({
                        type: 'broadcast',
                        event: 'map_update',
                        payload: {
                            type: 'guest_sync',
                            tileGrid: this.tileGrid,
                            tileAuthors: this.tileAuthors || {},
                            user: this.currentUsername || 'Anonymous'
                        }
                    }).catch(err => console.error('[Compass] guest_sync broadcast failed', err));
                }
            } else if (payload.type === 'guest_sync') {
                // Owner receives guest's active grid and adopts it
                if (this.currentUserId === this.collabMapOwnerId) {
                    console.log(`[Compass] Owner received guest_sync from ${payload.user}. Adopting guest grid...`);
                    if (Array.isArray(payload.tileGrid)) {
                        this.tileGrid = payload.tileGrid;
                    }
                    this.tileAuthors = payload.tileAuthors || {};
                    this._errorsDirty = true;
                    this.draw();
                    if (this.triggerAutoSave) this.triggerAutoSave();
                }
            } else if (payload.type === 'full_sync') {
                if (this.currentUserId !== this.collabMapOwnerId) {
                    console.log('[Compass] Guest received full_sync payload. Syncing memory-resident grid...');
                    if (Array.isArray(payload.tileGrid)) {
                        this.tileGrid = payload.tileGrid;
                    }
                    this.tileAuthors = payload.tileAuthors || {};
                    this._errorsDirty = true;
                    this.draw();
                }
            } else if (payload.type === 'place') {
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
            if (this.triggerAutoSave) this.triggerAutoSave();
        } catch (e) {
            console.error("[Compass] Remote update error", e);
        } finally {
            this.isProcessingRemote = false;
        }
    },
    
    triggerAutoSave() {
        // Both owner AND guests auto-save in realtime collab mode.
        // The new RLS policy "Collab partners can update maps" allows guests to write
        // directly to the DB as long as an active collab link exists for the map.
        if (!this.isRealtimeCollab) return;

        if (this.autoSaveTimeout) clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(async () => {
            try {
                const { error } = await supabase
                    .from('maps')
                    .update({ 
                        map_data: this.tileGrid,
                        tile_authors: this.tileAuthors || {}
                    })
                    .eq('id', this.collabOriginalMapId);
                if (error) {
                    if (error.code === '42703') {
                        console.warn('[Compass] tile_authors column is missing in Supabase. Falling back to map_data only.');
                        const { error: fallbackError } = await supabase
                            .from('maps')
                            .update({ 
                                map_data: this.tileGrid
                            })
                            .eq('id', this.collabOriginalMapId);
                        if (fallbackError) throw fallbackError;
                        console.log('[Compass] Auto-saved collab map state (map_data only).');
                        return;
                    }
                    throw error;
                }
                const role = this.currentUserId === this.collabMapOwnerId ? 'Owner' : 'Guest';
                console.log(`[Compass] [${role}] Auto-saved collab map state.`);
            } catch (e) {
                console.error('[Compass] Auto-save failed:', e);
            }
        }, 1500);
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
            
            let { error } = await supabase
                .from('maps')
                .update(payload)
                .eq('id', this.collabOriginalMapId);
                
            if (error && error.code === '42703') {
                console.warn('[Compass] tile_authors column is missing in Supabase. Retrying without it.');
                const fallbackPayload = { ...payload };
                delete fallbackPayload.tile_authors;
                const { error: fallbackError } = await supabase
                    .from('maps')
                    .update(fallbackPayload)
                    .eq('id', this.collabOriginalMapId);
                error = fallbackError;
            }
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
            
            let { error } = await supabase.from('maps').insert([payload]);
            if (error && error.code === '42703') {
                console.warn('[Compass] tile_authors column is missing in Supabase. Retrying without it.');
                const fallbackPayload = { ...payload };
                delete fallbackPayload.tile_authors;
                const { error: fallbackError } = await supabase.from('maps').insert([fallbackPayload]);
                error = fallbackError;
            }
            if (error) throw error;
            
            alert(window.cp_translate('Collaboration finished! A copy of this map was saved to your My Maps.'));
            window.location.href = './dashboard.html';
        } catch (e) {
            console.error(e);
            alert('Failed to save finished collab map to your account: ' + e.message);
        }
    }
};
