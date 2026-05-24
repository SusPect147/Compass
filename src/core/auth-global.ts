// @ts-nocheck
import { supabase } from './supabase-client.js';
import { initializeGlobalSettings } from './global-settings.js?v=1.0.6';

// ⚙️ Bootstrap Visual Theme and Language engine
initializeGlobalSettings();

// ==========================================================
// 🎨 GLOBAL DYNAMIC THEME LOADER & CACHE
// Enables viewing other users' custom-themed maps instantly!
// ==========================================================
window.globalThemeCache = {}; // { packId: { name, user_name, tile_data } }

window.ensureThemeLoaded = async function (packId, themeOptions = null) {
    if (!packId)
        return null;
    if (window.globalThemeCache[packId])
        return window.globalThemeCache[packId];
    
    // If the map author has explicitly disabled theme visibility in the gallery, we respect it
    if (themeOptions && themeOptions.gallery === false) {
        console.info(`[ThemeLoader] Theme ${packId} is hidden for this map view by the author.`);
        return null;
    }

    try {
        console.info(`[ThemeLoader] Fetching dynamically active map theme: ${packId}`);
        const { data, error } = await supabase
            .from('custom_tile_packs')
            .select('name, user_name, tile_data')
            .eq('id', packId)
            .maybeSingle();
            
        if (error)
            throw error;
            
        if (data && data.tile_data) {
            window.globalThemeCache[packId] = {
                name: data.name || 'Custom Theme',
                user_name: data.user_name || 'Builder',
                tile_data: data.tile_data
            };
            return window.globalThemeCache[packId];
        } else if (themeOptions && themeOptions.gallery === true) {
            // Note: If data is null here, it means RLS blocked it (private theme).
            // To support "private themes visible in gallery", a Supabase RPC (e.g. get_theme_bypass_rls)
            // would be required on the backend to verify map->theme permission.
            console.warn(`[ThemeLoader] Theme ${packId} is private. Ensure it is either public or accessible via RPC.`);
        }
    }
    catch (e) {
        console.warn("[ThemeLoader] Failed fetching remote pack payload:", e);
    }
    return null;
};

window.getThemeDisplayText = async function(environmentId) {
    if (!environmentId) return 'Desert';
    
    if (typeof environmentId === 'string' && environmentId.startsWith('CUSTOM_')) {
        const packId = environmentId.replace('CUSTOM_', '');
        const themeMeta = await window.ensureThemeLoaded(packId);
        if (themeMeta && themeMeta.name) {
            return `${themeMeta.name} | By: ${themeMeta.user_name}`;
        }
        return 'Custom Theme';
    }
    
    return environmentId.replace(/_/g, ' ');
};

// ==========================================================
window.getThemedAsset = function(standardPath, parentEnvironment = null, forceBypass = false) {
    if (!standardPath || typeof standardPath !== 'string') return standardPath;
    
    try {
        const normalized = standardPath.replace(/\\/g, '/');
        
        // 1. ROUTING ENGINE: Extract specific CUSTOM_[packId] signals from URL path!
        let forcedPackId = null;
        let extractionPath = normalized;
        
        if (normalized.includes('/CUSTOM_')) {
            const parts = normalized.split('/');
            const customPart = parts.find(p => p.startsWith('CUSTOM_'));
            if (customPart) {
                forcedPackId = customPart.replace('CUSTOM_', '');
                // Re-route matching to baseline 'Desert' paths
                extractionPath = normalized.replace(customPart, 'Desert');
            }
        }
        
        // If we are forcing a bypass, just return the extraction path (which is the default "Desert" version)
        if (forceBypass) {
            return extractionPath;
        }

        let targetThemes = [];
        
        if (forcedPackId) {
            // Route directly to dynamically fetched Supabase theme payload
            const cachedData = window.globalThemeCache[forcedPackId];
            if (cachedData) {
                targetThemes = [cachedData];
            } else {
                return extractionPath;
            }
        } else {
            const isEditor = window.location.pathname.includes('editor.html');
            const isStudio = window.location.pathname.includes('custom-tiles.html');

            // Critical Isolation: Automatically bypass active themes in the Studio to prevent "infection" during creation
            if (isStudio) return standardPath;

            const editorSkin = isEditor ? localStorage.getItem('editor_active_skin') : null;
            const activeThemesStr = localStorage.getItem('equipped_themes');
            
            let themeStack = [];
            if (activeThemesStr) {
                try {
                    themeStack = JSON.parse(activeThemesStr);
                    if (!Array.isArray(themeStack)) themeStack = [];
                } catch(e) {}
            }
            
            if (editorSkin) {
                if (editorSkin === 'CUSTOM_ALL') {
                    targetThemes = themeStack;
                } else if (editorSkin.startsWith('CUSTOM_')) {
                    const packId = editorSkin.replace('CUSTOM_', '');
                    targetThemes = themeStack.filter(p => p.id === packId);
                    
                    if (targetThemes.length === 0 && window.globalThemeCache[packId]) {
                        targetThemes = [window.globalThemeCache[packId]];
                    }
                } else {
                    return standardPath;
                }
            } else {
                targetThemes = isEditor ? [] : themeStack;
            }
        }
        
        if (targetThemes.length === 0) {
            return forcedPackId ? extractionPath : standardPath;
        }
        
        // 1.5 ENVIRONMENT ISOLATION: Only apply Desert-based custom themes to Desert or Global assets.
        // This prevents a "Jungle" or "Mine" environment from being "infected" by Desert-based custom textures.
        const normalizedExt = extractionPath.replace(/\\/g, '/');
        const isDesertAsset = normalizedExt.includes('/Desert/') || parentEnvironment === 'Desert';
        const isGlobalAsset = normalizedExt.includes('/Global/') || 
                             normalizedExt.includes('/Additional/') ||
                             normalizedExt.includes('/Icons/') ||
                             normalizedExt.endsWith('Unbreakable.png') ||
                             normalizedExt.endsWith('HealPad.png') ||
                             normalizedExt.endsWith('SpeedTile.png') ||
                             normalizedExt.endsWith('SlowTile.png') ||
                             normalizedExt.endsWith('Spikes.png');

        // If we are NOT forcing a pack ID (via CUSTOM_ prefix in path) AND it's not a Desert/Global asset, abort.
        if (!forcedPackId && !isDesertAsset && !isGlobalAsset) {
            return standardPath;
        }

        // 2. MATCHING ENGINE: Parse the extraction path to isolate asset key
        let assetKey = null;
        let isFloorDark = false;
        let isFloorLight = false;
        let isGlobal = null;
        
        if (extractionPath.endsWith('BGDark.png')) {
            isFloorDark = true;
        } else if (extractionPath.endsWith('BGLight.png')) {
            isFloorLight = true;
        } else if (extractionPath.includes('/Tiles/')) {
            assetKey = extractionPath.substring(extractionPath.lastIndexOf('/') + 1).replace('.png', '');
        } else if (extractionPath.includes('/Water/')) {
            const fname = extractionPath.substring(extractionPath.lastIndexOf('/') + 1).replace('.png', '');
            assetKey = `Water_${fname}`;
        } else if (extractionPath.includes('/Fence/') || extractionPath.includes('/Fence_5v5/')) {
            const fname = extractionPath.substring(extractionPath.lastIndexOf('/') + 1).replace('.png', '');
            assetKey = fname;
            if (assetKey === 'Horizontal') assetKey = 'Fence_H';
            if (assetKey === 'Vertical') assetKey = 'Fence_V';
        } else if (extractionPath.includes('/Rope/')) {
            assetKey = extractionPath.substring(extractionPath.lastIndexOf('/') + 1).replace('.png', '');
        } else if (extractionPath.includes('/Gamemode_Specifics/')) {
            assetKey = extractionPath.substring(extractionPath.lastIndexOf('/') + 1).replace('.png', '');
        } else if (extractionPath.includes('/Global/Goals/')) {
            const fname = extractionPath.substring(extractionPath.lastIndexOf('/') + 1).replace('.png', '');
            const gms = ['Heist', 'Gem_Grab', 'Brawl_Ball', 'Volley_Brawl'];
            for (const gm of gms) {
                if (fname.startsWith(gm)) {
                    assetKey = `GM_${gm}`;
                    break;
                }
            }
        } else if (extractionPath.endsWith('Unbreakable.png')) {
            isGlobal = 'Unbreakable';
        } else if (extractionPath.endsWith('HealPad.png')) {
            isGlobal = 'Heal Pad';
        } else if (extractionPath.endsWith('SpeedTile.png')) {
            isGlobal = 'Speed Pad';
        } else if (extractionPath.endsWith('SlowTile.png')) {
            isGlobal = 'Slow Pad';
        } else if (extractionPath.endsWith('Spikes.png')) {
            isGlobal = 'Spikes';
        }
        
        // Reject unsupported assets
        if (!assetKey && !isFloorDark && !isFloorLight && !isGlobal) {
            return forcedPackId ? extractionPath : standardPath;
        }
        
        // 3. RESOLUTION ENGINE: Inject custom assets from high-priority target stack
        for (const theme of targetThemes) {
            if (!theme.tile_data) continue;
            if (isFloorDark && theme.tile_data['BGDark']) return theme.tile_data['BGDark'];
            if (isFloorLight && theme.tile_data['BGLight']) return theme.tile_data['BGLight'];
            if (isGlobal && theme.tile_data[isGlobal]) return theme.tile_data[isGlobal];
            if (assetKey && theme.tile_data[assetKey]) return theme.tile_data[assetKey];
        }
        
        return forcedPackId ? extractionPath : standardPath;
        
    } catch(e) {
        console.warn("[ThemeEngine] Failed resolving layered themed path:", e);
    }
    
    return standardPath;
};

// Global Prototype Hijack — Intercepts BOTH dynamic (new Image()) and static page images automatically!
(function() {
    const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (!originalSrcDescriptor) return;
    
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
        get: function() {
            return originalSrcDescriptor.get.call(this);
        },
        set: function(value) {
            let processedVal = value;
            
            // Only inspect valid asset string strings (skipping external URLs, base64 payloads, blobs)
            if (typeof value === 'string' && value.length > 3 && !value.startsWith('data:') && !value.startsWith('blob:') && !value.startsWith('http')) {
                // Determine if we should bypass the theme
                const shouldBypass = (this.dataset.noTheme === 'true' || window.cp_bypassTheme);
                
                // Even if bypassing, we use getThemedAsset to resolve any virtual "CUSTOM_" paths to "Desert"
                processedVal = window.getThemedAsset(value, this.parentEnvironment, shouldBypass);
            }
            
            // CORS INTEGRATOR: If redirected to a remote Supabase CDN URL, apply crossOrigin = 'anonymous'
            // BEFORE assigning the source to guarantee the Canvas never gets tainted (SecurityError fix)!
            if (typeof processedVal === 'string' && processedVal.startsWith('http')) {
                this.crossOrigin = 'anonymous';
            }
            
            originalSrcDescriptor.set.call(this, processedVal);
        },
        enumerable: true,
        configurable: true
    });
})();
// ==========================================================

// 🛠 Security: Dynamic Hash Generation
function generateFingerprint() {
    try {
        const data = [navigator.userAgent, screen.width, screen.height, new Date().getTimezoneOffset()].join('|');
        let hash = 0;
        for (let i = 0; i < data.length; i++) { hash = ((hash << 5) - hash) + data.charCodeAt(i); hash |= 0; }
        return "FP_" + Math.abs(hash);
    } catch (e) { return "FP_UKN"; }
}

// 🔒 Secure Remote Check Helper
async function getBanReason(targetStr) {
    if (!targetStr) return null;
    try {
        // Securely queries the database via protected RPC closure. 
        // Public cannot view the full table, only ask if ONE specific hash exists.
        const { data, error } = await supabase.rpc('check_ban_status', { check_target: targetStr.toString() });
        if (error || !data || data.length === 0) return null;
        return data[0].reason || "No reason provided.";
    } catch (e) { return null; }
}

// 🛑 Screen Block Execution
function activateBanOverlay(reason) {
    if (!document.getElementById('banOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'banOverlay';
        overlay.innerHTML = `
            <div class="ban-skull">☠️</div>
            <div class="ban-title">${window.cp_translate('Oops, Access Denied')}</div>
            <div style="font-size: 1.2rem; margin-bottom: 1rem;">${window.cp_translate('It seems you are on the blacklist.')}</div>
            <div class="ban-reason-box">
                <strong>${window.cp_translate('Reason from the Great Hammer147:')}</strong><br><br>
                "${reason}"
            </div>
        `;
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('active'), 50);
    }
    document.body.style.overflow = 'hidden';
    document.body.style.pointerEvents = 'none'; 
    localStorage.setItem('cp_system_ban_marker', 'active');
    localStorage.setItem('cp_system_ban_reason', reason);
    throw new Error("ACCES_DENIED_BY_BLACKLIST");
}

/**
 * Global auth navigation handler
 */
async function initGlobalAuth() {
    // 0. PERSISTENT LOCAL STORAGE TRAP (Fastest check)
    const storedBan = localStorage.getItem('cp_system_ban_marker');
    if (storedBan === 'active') {
        activateBanOverlay(localStorage.getItem('cp_system_ban_reason') || "Device ban.");
    }

    // 1. Calculate current device fingerprint
    const currentFingerprint = generateFingerprint();

    let navContainer = document.querySelector('.top-bar-right') || document.getElementById('navLinks');
    if (!navContainer) return;

    // Initialize Responsive Navigation for Mobile
    initMobileNavigation();

    // Initialize session grab concurrently
    const sessionPromise = supabase.auth.getSession();

    // 🛡️ CHECK 1: DEVICE FINGERPRINT (Silent background check)
    getBanReason(currentFingerprint).then(reason => {
        if (reason) activateBanOverlay(reason);
    });

    const { data: { session } } = await sessionPromise;

    // 🛡️ CHECK 2: IDENTITY VERIFICATION
    if (session && session.user) {
        const uId = session.user.id; 
        const discordMeta = session.user.user_metadata;
        const uName = discordMeta ? (discordMeta.full_name || discordMeta.name || discordMeta.custom_claims?.global_name) : null;
        const numericId = discordMeta ? discordMeta.sub : null;

        // Perform checks concurrently
        const checkIds = [uId, uName, numericId].filter(Boolean);
        
        for (const val of checkIds) {
            const reason = await getBanReason(val);
            if (reason) {
                activateBanOverlay(reason);
                break;
            }
        }
    }

    // Стили для блока профиля (если их нет на странице)
    injectProfileStyles();

    if (session && session.user) {
        // === ПОЛЬЗОВАТЕЛЬ ВОШЕЛ ===
        const user = session.user;
        const avatar = user.user_metadata.avatar_url || './Resources/Additional/Icons/compass.png';
        const name = user.user_metadata.full_name || 'User';
        
        // Сохраняем в локал для старого кода
        localStorage.setItem('user', name);

        // 1. Очищаем старые кнопки входа если они есть на странице (например в hero-nav)
        const discordHeroBtn = document.getElementById('discordLoginBtn');
        if (discordHeroBtn) discordHeroBtn.style.display = 'none';

        // 2. Удаляем старую ссылку "Contests soon" если она мешает
        const soonLink = navContainer.querySelector('a[style*="opacity:0.4"]');
        if (soonLink) soonLink.remove();

        function escapeHTML(str) {
            if (!str) return '';
            return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        }

        const safeName = escapeHTML(name);

        // 3. Создаем блок профиля
        const profileBlock = document.createElement('div');
        profileBlock.className = 'global-user-profile';
        profileBlock.innerHTML = `
            <div class="user-info">
                <img src="${avatar}" alt="PFP" class="user-pic">
                <span class="user-name">${safeName}</span>
            </div>
            <a href="#" class="user-logout-btn" title="${window.cp_translate('Log Out')}">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            </a>
        `;

        // Добавляем обработчик выхода
        profileBlock.querySelector('.user-logout-btn').onclick = async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
            localStorage.removeItem('user');
            window.location.reload();
        };

        // Очищаем предыдущие добавленные блоки если скрипт вызвался дважды
        const oldBlock = navContainer.querySelector('.global-user-profile');
        if (oldBlock) oldBlock.remove();

        navContainer.appendChild(profileBlock);

        // --- SYNC LOCAL MAPS ---
        try {
            const localMapsStr = localStorage.getItem('compass_local_maps');
            if (localMapsStr) {
                const localMaps = JSON.parse(localMapsStr);
                if (Array.isArray(localMaps) && localMaps.length > 0) {
                    console.log(`[Compass] Found ${localMaps.length} local maps to sync.`);
                    const syncPromises = localMaps.map(async (localMap) => {
                        const payload = {
                            name: localMap.name,
                            size: localMap.size,
                            gamemode: localMap.gamemode,
                            environment: localMap.environment,
                            map_data: localMap.map_data,
                            tile_authors: localMap.tile_authors,
                            author_name: name,
                            user_id: user.id,
                            is_public: localMap.is_public,
                            theme_options: localMap.theme_options
                        };
                        let { error } = await supabase
                            .from('maps')
                            .insert(payload)
                            .select('id')
                            .single();
                        if (error && error.code === '42703') {
                            const fallbackPayload = { ...payload };
                            delete fallbackPayload.tile_authors;
                            await supabase.from('maps').insert(fallbackPayload).select('id').single();
                        } else if (error) {
                            throw error;
                        }
                    });
                    
                    // Run sync in background
                    Promise.allSettled(syncPromises).then((results) => {
                        const successCount = results.filter(r => r.status === 'fulfilled').length;
                        if (successCount > 0) {
                            alert(window.cp_translate ? window.cp_translate(`Successfully synced ${successCount} local map(s) to your account!`) : `Успешно синхронизировано ${successCount} локальных карт(ы)!`);
                            localStorage.removeItem('compass_local_maps');
                        }
                    });
                }
            }
        } catch (e) {
            console.error('[Compass] Failed to sync local maps:', e);
        }
        // ------------------------

    } else {
        // === ПОЛЬЗОВАТЕЛЬ НЕ ВОШЕЛ ===
        localStorage.removeItem('user');

        // 1. Показываем кнопку в Hero на главной, если она есть
        const discordHeroBtn = document.getElementById('discordLoginBtn');
        if (discordHeroBtn) {
            discordHeroBtn.style.display = 'inline-flex';
            
            // ВАЖНОЕ ИСПРАВЛЕНИЕ: Привязываем клик к кнопке!
            discordHeroBtn.onclick = async (e) => {
                e.preventDefault();
                await supabase.auth.signInWithOAuth({
                    provider: 'discord',
                    options: {
                        redirectTo: window.location.origin + window.location.pathname,
                        scopes: 'identify', // Стандартная опция
                        queryParams: {
                            scope: 'identify' // Принудительный перезапуск параметров URL для Discord
                        }
                    }
                });
            };
        }

        // 2. Добавляем ПУСТУЮ, НЕКЛИКАБЕЛЬНУЮ кнопку "Профиль" (просто текст)
        if (!navContainer.querySelector('.login-menu-btn')) {
            const profileStub = document.createElement('a');
            profileStub.href = "#";
            profileStub.className = "login-menu-btn";
            profileStub.style.opacity = "0.4";
            profileStub.style.cursor = "default";
            profileStub.innerHTML = window.cp_translate("Profile");
            profileStub.onclick = (e) => e.preventDefault(); // Ничего не делает!
            navContainer.appendChild(profileStub);
        }
    }
}

function injectProfileStyles() {
    if (document.getElementById('global-auth-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'global-auth-styles';
    style.textContent = `
        .global-user-profile {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            margin-left: 0.5rem;
        }
        .user-info {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: rgba(255,255,255,0.06);
            padding: 0.3rem 0.8rem 0.3rem 0.3rem;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.08);
            transition: background 0.2s;
        }
        .user-info:hover {
            background: rgba(255,255,255,0.1);
        }
        html[data-theme="crystal"] .user-info,
        html[data-theme="sunset"] .user-info,
        html[data-theme="breeze"] .user-info {
            background: rgba(0,0,0,0.05);
            border-color: rgba(0,0,0,0.08);
        }
        html[data-theme="crystal"] .user-info:hover,
        html[data-theme="sunset"] .user-info:hover,
        html[data-theme="breeze"] .user-info:hover {
            background: rgba(0,0,0,0.08);
        }
        .user-pic {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            object-fit: cover;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .user-name {
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-primary, #fff);
            max-width: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .user-logout-btn {
            background: none;
            border: none;
            color: var(--text-secondary, rgba(255,255,255,0.35));
            padding: 0.4rem !important;
            display: flex;
            align-items: center;
            border-radius: 8px;
            transition: all 0.2s;
            cursor: pointer;
        }
        .user-logout-btn:hover {
            color: #ff5f5f;
            background: rgba(255, 95, 95, 0.08) !important;
        }
        .login-menu-btn {
            text-decoration: none;
            color: var(--text-secondary, rgba(255,255,255,0.35));
            font-size: 0.78rem;
            font-weight: 500;
            padding: 0.45rem 0.9rem;
            border-radius: 8px;
            letter-spacing: 0.02em;
        }
        html[data-theme="crystal"] .user-logout-btn,
        html[data-theme="sunset"] .user-logout-btn,
        html[data-theme="breeze"] .user-logout-btn,
        html[data-theme="crystal"] .login-menu-btn,
        html[data-theme="sunset"] .login-menu-btn,
        html[data-theme="breeze"] .login-menu-btn {
            color: rgba(0, 0, 0, 0.5);
        }
    `;
    document.head.appendChild(style);
}

function initMobileNavigation() {
    if (document.getElementById('mobile-nav-toggle-btn')) return;
    
    const topBar = document.querySelector('.top-bar');
    const navContainer = document.querySelector('.top-bar-right') || document.getElementById('navLinks');
    
    if (!topBar || !navContainer) return;
    
    const toggle = document.createElement('button');
    toggle.id = 'mobile-nav-toggle-btn';
    toggle.className = 'mobile-nav-toggle';
    toggle.setAttribute('aria-label', 'Toggle navigation menu');
    toggle.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;
    
    topBar.appendChild(toggle);
    
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = navContainer.classList.toggle('mobile-active');
        toggle.classList.toggle('active');
        
        if (isActive) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    });

    // Close menu if clicking outside
    document.addEventListener('click', (e) => {
        if (navContainer.classList.contains('mobile-active') && !navContainer.contains(e.target) && !toggle.contains(e.target)) {
            navContainer.classList.remove('mobile-active');
            toggle.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // Close menu on nav link clicks
    navContainer.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navContainer.classList.remove('mobile-active');
            toggle.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
}

// Выполняем при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobalAuth);
} else {
    initGlobalAuth();
}
