// @ts-nocheck
import { supabase } from '../core/supabase-client.js';

// Base configurable tiles preset
const CORE_TILES = [
    // Base Desert Environment Tiles
    { id: 'Wall', label: 'Wall 1', src: './Resources/Desert/Tiles/Wall.png', hitbox: { y: 0.6, h: 0.4 } },
    { id: 'Wall2', label: 'Wall 2', src: './Resources/Desert/Tiles/Wall2.png', hitbox: { y: 0.6, h: 0.4 } },
    { id: 'Bush', label: 'Bush', src: './Resources/Desert/Tiles/Bush.png' },
    { id: 'Cactus', label: 'Cactus', src: './Resources/Desert/Tiles/Cactus.png' },
    { id: 'Crate', label: 'Crate', src: './Resources/Desert/Tiles/Crate.png' },
    { id: 'Barrel', label: 'Barrel', src: './Resources/Desert/Tiles/Barrel.png' },
    { id: 'Skull', label: 'Skull', src: './Resources/Desert/Tiles/Skull.png' },
    
    // Desert Floor Textures
    { id: 'BGDark', label: 'Floor Dark', src: './Resources/Desert/BGDark.png' },
    { id: 'BGLight', label: 'Floor Light', src: './Resources/Desert/BGLight.png' },

    // Gamemode Specific Elements
    { id: 'GM_Brawl_Ball', label: 'Brawl Ball Obstacle', src: './Resources/Desert/Gamemode_Specifics/Brawl_Ball.png' },
    { id: 'GM_Gem_Grab', label: 'Gem Mine Slot', src: './Resources/Desert/Gamemode_Specifics/Gem_Grab.png' },
    { id: 'GM_Heist', label: 'Safe Box', src: './Resources/Desert/Gamemode_Specifics/Heist.png' },
    { id: 'GM_Volley_Brawl', label: 'Volley Net Obstacle', src: './Resources/Desert/Gamemode_Specifics/Volley_Brawl.png' },

    // Fence Variants
    { id: 'Fence', label: 'Fence Base', src: './Resources/Desert/Fence/Fence.png' },
    { id: 'Fence_H', label: 'Fence Horiz.', src: './Resources/Desert/Fence/Horizontal.png' },
    { id: 'Fence_V', label: 'Fence Vert.', src: './Resources/Desert/Fence/Vertical.png' },
    
    // Rope Variants
    { id: 'Post', label: 'Rope Post Base', src: './Resources/Desert/Rope/Post.png' },
    { id: 'Post_R', label: 'Rope Post Right', src: './Resources/Desert/Rope/Post_R.png' },
    { id: 'Post_T', label: 'Rope Post Top', src: './Resources/Desert/Rope/Post_T.png' },
    { id: 'Post_TR', label: 'Rope Post Corner', src: './Resources/Desert/Rope/Post_TR.png' },

    // Common Core Globals
    { id: 'Unbreakable', label: 'Unbreakable', src: './Resources/Global/Unbreakable.png' },
    { id: 'Heal Pad', label: 'Heal Pad', src: './Resources/Global/Special_Tiles/HealPad.png' },
    { id: 'Speed Pad', label: 'Speed Pad', src: './Resources/Global/Special_Tiles/SpeedTile.png' },
    { id: 'Slow Pad', label: 'Slow Pad', src: './Resources/Global/Special_Tiles/SlowTile.png' },
    { id: 'Spikes', label: 'Spikes', src: './Resources/Global/Special_Tiles/Spikes.png' }
];

// Add ALL 47 Dynamic Connecting Water Edge Textures to satisfy 100% coverage
const WATER_FILENAMES = [
    "00000000.png", "00000010.png", "00001000.png", "00001010.png", "00001011.png",
    "00010000.png", "00010010.png", "00010110.png", "00011000.png", "00011010.png",
    "00011011.png", "00011110.png", "00011111.png", "01000000.png", "01000010.png",
    "01001000.png", "01001010.png", "01001011.png", "01010000.png", "01010010.png",
    "01010110.png", "01011000.png", "01011010.png", "01011011.png", "01011110.png",
    "01011111.png", "01101000.png", "01101010.png", "01101011.png", "01111000.png",
    "01111010.png", "01111011.png", "01111110.png", "01111111.png", "11010000.png",
    "11010010.png", "11010110.png", "11011000.png", "11011010.png", "11011011.png",
    "11011110.png", "11011111.png", "11111000.png", "11111010.png", "11111011.png",
    "11111110.png", "11111111.png"
];
WATER_FILENAMES.forEach(fname => {
    const labelId = fname.replace('.png', '');
    CORE_TILES.push({
        id: `Water_${labelId}`,
        label: `Water ${labelId}`,
        src: `./Resources/Desert/Water/${fname}`
    });
});

// Local state
let allPublicPacks = [];
let myPrivatePacks = [];
let currentUserId = null;
let currentUserName = 'Anonymous Builder';
let likedPackIds = new Set(); // Track synced user liked collections
let currentEquippedThemeIds = new Set(); // Tracks MULTIPLE equipped active themes
let currentEquipTargetPack = null; // Stores target pack during verification

// Editor state
let selectedTileKey = null;
let editedTileFiles = {}; // Map of key -> File/Blob object
let cropperInstance = null;
let isAspectRatioLocked = true; 
let gridSize = 32; 
let isGridVisible = true;
let isSnapEnabled = true;
let currentCropMode = 'ghost'; 

async function initCustomTiles() {
    initStudioControls();
    initSlicePanel();
    initEquipControls();
    refreshEquippedBanner();
    await initUserData();
    await loadPacks();
    
    // Listen to global filters
    document.getElementById('packSearch')?.addEventListener('input', renderPacks);
    document.getElementById('packSortFilter')?.addEventListener('change', renderPacks);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCustomTiles);
} else {
    initCustomTiles();
}

/**
 * Setup Confirm/Cancel buttons for Equip Modal and Unequip banner
 */
function initEquipControls() {
    const confirmModal = document.getElementById('equipConfirmModal');
    const cancelBtn = document.getElementById('cancelEquipBtn');
    const confirmBtn = document.getElementById('confirmEquipBtn');
    const closeBtn = document.getElementById('closePreviewBtn');
    const unequipBtn = document.getElementById('unequipThemeBtn');

    const hideModal = () => {
        confirmModal?.classList.remove('active');
        currentEquipTargetPack = null;
    };

    if (cancelBtn) cancelBtn.onclick = hideModal;
    if (closeBtn) closeBtn.onclick = hideModal;

    if (confirmBtn) {
        confirmBtn.onclick = () => {
            if (currentEquipTargetPack) {
                equipTheme(currentEquipTargetPack);
            }
            hideModal();
        };
    }

    if (unequipBtn) {
        unequipBtn.onclick = () => {
            (window as any).unequipTheme();
        };
    }
}

/**
 * Inspect localStorage to determine if themes are active
 */
function refreshEquippedBanner() {
    const banner = document.getElementById('equippedThemeBanner');
    const textNode = document.getElementById('equippedBannerText');
    const clearBtn = document.getElementById('unequipThemeBtn');
    if (!banner || !textNode) return;
    
    let equippedArr = [];
    try {
        const activeJSON = localStorage.getItem('equipped_themes');
        if (activeJSON) {
            equippedArr = JSON.parse(activeJSON);
            if (!Array.isArray(equippedArr)) equippedArr = [];
        }
    } catch (e) {
        console.error("Stored theme parse failed:", e);
        equippedArr = [];
    }

    // Populate set for fast visual lookup on cards
    currentEquippedThemeIds = new Set(equippedArr.map(p => p.id));
    
    if (equippedArr.length > 0) {
        let html = '<span style="margin-right: 8px;">Active Layers:</span>';
        
        equippedArr.forEach((pack, index) => {
            const safeName = escapeHTML(pack.name || 'Theme');
            html += `
                <span class="theme-chip" title="Priority #${index + 1} (Top layer)">
                    ${safeName}
                    <span class="chip-remove" onclick="event.stopPropagation(); window.unequipTheme('${pack.id}')" title="Remove layer">×</span>
                </span>
            `;
        });
        
        textNode.innerHTML = html;
        if(clearBtn) clearBtn.textContent = 'Clear All Layers';
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'none';
    }
}

/**
 * Show modal verification to equip and display a full tile preview catalog
 */
function triggerEquipPrompt(pack) {
    currentEquipTargetPack = pack;
    
    const modal = document.getElementById('equipConfirmModal');
    const nameDisplay = document.getElementById('equipThemeNameDisplay');
    const authorDisplay = document.getElementById('equipThemeAuthorDisplay');
    const gridDisplay = document.getElementById('previewTilesGrid');
    const confirmBtn = document.getElementById('confirmEquipBtn');

    const isAlreadyEquipped = currentEquippedThemeIds.has(pack.id);
    
    if (nameDisplay) nameDisplay.textContent = pack.name || 'Custom Theme';
    if (authorDisplay) authorDisplay.textContent = pack.user_name || 'Unknown';

    if (gridDisplay) {
        gridDisplay.innerHTML = '';
        const data = pack.tile_data || {};
        const keys = Object.keys(data);
        
        if (keys.length === 0) {
            gridDisplay.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:2rem; opacity:0.5;">${(window as any).cp_translate('No customized tiles in this pack.')}</div>`;
        } else {
            keys.forEach(k => {
                const src = data[k];
                const matchingDef = CORE_TILES.find(t => t.id === k);
                const lbl = matchingDef ? (matchingDef.label || k) : k;
                
                const item = document.createElement('div');
                item.className = 'tile-preview-item';
                item.style.cssText = "display:flex; flex-direction:column; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:6px; aspect-ratio:1; justify-content:center;";
                item.innerHTML = `
                    <img src="${src}" style="width:36px; height:36px; object-fit:contain; margin-bottom:4px;" alt="${lbl}">
                    <span style="font-size:0.65rem; opacity:0.6; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;" title="${lbl}">${lbl}</span>
                `;
                gridDisplay.appendChild(item);
            });
        }
    }

    if (confirmBtn) {
        if (isAlreadyEquipped) {
            confirmBtn.textContent = (window as any).cp_translate('Equipped');
            (confirmBtn as HTMLButtonElement).disabled = true;
            confirmBtn.style.opacity = "0.5";
            confirmBtn.style.cursor = "default";
        } else {
            confirmBtn.textContent = (window as any).cp_translate('Equip Theme');
            (confirmBtn as HTMLButtonElement).disabled = false;
            confirmBtn.style.opacity = "";
            confirmBtn.style.cursor = "";
        }
    }
    
    modal?.classList.add('active');
}

/**
 * Add theme to equipped stack in localStorage
 */
function equipTheme(pack) {
    let equippedArr = [];
    try {
        const existing = localStorage.getItem('equipped_themes');
        if (existing) {
            equippedArr = JSON.parse(existing);
            if (!Array.isArray(equippedArr)) equippedArr = [];
        }
    } catch(e) { equippedArr = []; }

    equippedArr = equippedArr.filter(p => p.id !== pack.id);
    
    equippedArr.unshift({
        id: pack.id,
        name: pack.name,
        user_name: pack.user_name,
        tile_data: pack.tile_data
    });
    
    localStorage.setItem('equipped_themes', JSON.stringify(equippedArr));
    refreshEquippedBanner();
    renderPacks();
}

/**
 * Remove a specific theme or purge entire stack if no ID is provided
 */
(window as any).unequipTheme = function(packId = null) {
    if (!packId) {
        localStorage.removeItem('equipped_themes');
    } else {
        let equippedArr = [];
        try {
            const existing = localStorage.getItem('equipped_themes');
            if (existing) {
                equippedArr = JSON.parse(existing);
                if (!Array.isArray(equippedArr)) equippedArr = [];
            }
        } catch(e) { equippedArr = []; }
        
        equippedArr = equippedArr.filter(p => p.id !== packId);
        
        if (equippedArr.length > 0) {
            localStorage.setItem('equipped_themes', JSON.stringify(equippedArr));
        } else {
            localStorage.removeItem('equipped_themes');
        }
    }
    
    refreshEquippedBanner();
    renderPacks();
};

/**
 * Initialise user profile and id
 */
async function initUserData() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
            currentUserId = session.user.id;
            currentUserName = session.user.user_metadata.full_name || session.user.user_metadata.name || 'Anonymous Builder';
        } else {
            const myGrid = document.getElementById('myCreationsGrid');
            if (myGrid) {
                myGrid.innerHTML = `
                    <div class="empty-placeholder">
                        <div class="empty-placeholder-icon">🔒</div>
                        <p>Sign in via Discord to view, create, and manage your own tile packs.</p>
                    </div>
                `;
            }
        }
    } catch (e) {
        console.error('Auth check failed in custom tiles:', e);
    }
}

/**
 * Fetch both user packs and public marketplace packs from Supabase
 */
(window as any).loadPacks = loadPacks;
async function loadPacks() {
    const marketGrid = document.getElementById('marketGrid');
    if (marketGrid) marketGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; opacity:0.7;">Contacting servers...</div>';
    
    try {
        const { data: packs, error } = await supabase
            .from('custom_tile_packs')
            .select('*, tile_pack_likes(count)');
            
        if (error) throw error;
        
        const normalizedPacks = packs.map(p => ({
            ...p,
            likesCount: p.tile_pack_likes?.[0]?.count || 0
        }));
        
        if (currentUserId) {
            const { data: myLikes } = await supabase
                .from('tile_pack_likes')
                .select('pack_id')
                .eq('user_id', currentUserId);
            if (myLikes) {
                likedPackIds = new Set(myLikes.map(l => l.pack_id));
            }
        }
        
        if (currentUserId) {
            myPrivatePacks = normalizedPacks.filter(p => p.user_id === currentUserId);
        } else {
            myPrivatePacks = [];
        }
        
        allPublicPacks = normalizedPacks.filter(p => p.is_public === true);
        renderPacks();
        
    } catch (err) {
        console.error('Database call failed:', err);
        if (marketGrid) marketGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color: #ff4b4b;">Connection failure. Did you run the Supabase SQL script?</div>';
    }
}

/**
 * Filter, sort, and render grid lists
 */
function renderPacks() {
    const searchTerm = (document.getElementById('packSearch') as HTMLInputElement)?.value.toLowerCase() || '';
    const sortRule = (document.getElementById('packSortFilter') as HTMLSelectElement)?.value || 'newest';
    
    const sortFn = (a, b) => {
        if (sortRule === 'likes') {
            if (b.likesCount !== a.likesCount) return b.likesCount - a.likesCount;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    };
    
    const myGrid = document.getElementById('myCreationsGrid');
    if (myGrid && currentUserId) {
        let myFiltered = myPrivatePacks.filter(p => 
            (p.name || '').toLowerCase().includes(searchTerm)
        ).sort(sortFn);
        
        const badge = document.getElementById('myCountBadge');
        if (badge) badge.textContent = myFiltered.length.toString();
        
        if (myFiltered.length === 0) {
            myGrid.innerHTML = `
                <div class="empty-placeholder">
                    <div class="empty-placeholder-icon">✨</div>
                    <p>No packs found. Create your first pack by clicking the "+" button above!</p>
                </div>
            `;
        } else {
            myGrid.innerHTML = '';
            myFiltered.forEach(pack => {
                myGrid.appendChild(createPackCard(pack, true));
            });
        }
    }
    
    const marketGrid = document.getElementById('marketGrid');
    if (marketGrid) {
        let marketFiltered = allPublicPacks.filter(p => 
            (p.name || '').toLowerCase().includes(searchTerm)
        ).sort(sortFn);
        
        const badge = document.getElementById('marketCountBadge');
        if (badge) badge.textContent = marketFiltered.length.toString();
        
        if (marketFiltered.length === 0) {
            marketGrid.innerHTML = `
                <div class="empty-placeholder">
                    <div class="empty-placeholder-icon">🔍</div>
                    <p>Marketplace is empty. Be the first to publish a custom pack!</p>
                </div>
            `;
        } else {
            marketGrid.innerHTML = '';
            marketFiltered.forEach(pack => {
                marketGrid.appendChild(createPackCard(pack, false));
            });
        }
    }
}

/**
 * Construct a HTML card item for a pack
 */
function createPackCard(pack, isOwner = false) {
    const div = document.createElement('div');
    const isEquipped = currentEquippedThemeIds.has(pack.id);
    
    div.className = `tile-pack-card ${isEquipped ? 'active-equipped' : ''}`;
    
    div.onclick = (e) => {
        triggerEquipPrompt(pack);
    };
    
    const keys = Object.keys(pack.tile_data || {});
    let previewIcons = '';
    
    for(let i=0; i<3; i++) {
        const key = keys[i] || null;
        const src = key ? pack.tile_data[key] : CORE_TILES[i].src;
        previewIcons += `<img src="${src}" class="preview-tile-icon" alt="Tile Preview" loading="lazy">`;
    }
    
    const safeName = escapeHTML(pack.name || 'Default Pack');
    const safeAuthor = escapeHTML(pack.user_name || 'Anonymous Builder');
    const isLiked = likedPackIds.has(pack.id);
    
    div.innerHTML = `
        <div class="pack-preview-strip">
            ${previewIcons}
        </div>
        <div class="pack-info">
            <div class="pack-meta-top">
                <h3 class="pack-name">${safeName}</h3>
                <div class="pack-author">by ${safeAuthor}</div>
            </div>
            
            <div class="pack-controls">
                ${isOwner ? `
                    <div style="display: flex; gap: 0.4rem; align-items: center;">
                        <button class="privacy-toggle ${pack.is_public ? 'pub' : 'priv'}" 
                                title="Click to change privacy">
                            ${pack.is_public ? '🌍' : '🔒'}
                        </button>
                        <button class="pack-edit-btn" style="background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); color: #3b82f6; padding: 0.4rem 0.5rem; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-size: 0.75rem;" title="Edit Tile Pack">
                            ✏️
                        </button>
                        <button class="pack-delete-btn" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 0.4rem 0.5rem; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-size: 0.75rem;" title="Delete Tile Pack">
                            🗑️
                        </button>
                    </div>
                ` : `<span></span>`}
                
                <button class="pack-like-btn ${isLiked ? 'liked' : ''}" data-id="${pack.id}">
                    <svg viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <span class="like-counter">${pack.likesCount}</span>
                </button>
            </div>
        </div>
    `;
    
    const likeBtn = div.querySelector('.pack-like-btn') as HTMLButtonElement;
    likeBtn.onclick = (e) => {
        e.stopPropagation(); 
        handleLikeClick(pack.id, likeBtn);
    };
    
    if (isOwner) {
        const privBtn = div.querySelector('.privacy-toggle') as HTMLElement;
        privBtn.onclick = (e) => {
            e.stopPropagation();
            togglePrivacy(pack.id, pack.is_public, privBtn);
        };
        const editBtn = div.querySelector('.pack-edit-btn') as HTMLElement;
        if (editBtn) {
            editBtn.onmouseenter = () => editBtn.style.background = 'rgba(59, 130, 246, 0.3)';
            editBtn.onmouseleave = () => editBtn.style.background = 'rgba(59, 130, 246, 0.15)';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                (window as any).handleEditPack(pack);
            };
        }
        const delBtn = div.querySelector('.pack-delete-btn') as HTMLElement;
        if (delBtn) {
            delBtn.onmouseenter = () => delBtn.style.background = 'rgba(239, 68, 68, 0.3)';
            delBtn.onmouseleave = () => delBtn.style.background = 'rgba(239, 68, 68, 0.15)';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                handleDeletePack(pack.id, pack.name, delBtn);
            };
        }
    }
    
    return div;
}

/**
 * Handle flipping a pack visibility between public and private
 */
async function togglePrivacy(packId, isCurrentlyPublic, button) {
    if (!currentUserId) return;
    
    button.disabled = true;
    button.textContent = '...';
    const nextState = !isCurrentlyPublic;
    
    try {
        const { error } = await supabase
            .from('custom_tile_packs')
            .update({ is_public: nextState })
            .eq('id', packId);
            
        if (error) throw error;
        await (window as any).loadPacks();
        
    } catch (e) {
        console.error("Privacy patch failed:", e);
        alert((window as any).cp_translate("Failed to update privacy settings."));
        button.disabled = false;
    }
}

/**
 * Handler to permanently delete custom tile pack with double alerts
 */
async function handleDeletePack(packId, packName, button) {
    if (!currentUserId) return;

    const confirmMsg = `🚨 Are you absolutely SURE you want to PERMANENTLY delete the tile pack "${packName}"?\nThis actions cannot be undone!`;
    if (!(await window.cpConfirm(confirmMsg, { danger: true }))) return;

    const finalMsg = `⚠️ FINAL WARNING: Click OK to erase this pack and all its customized textures FOREVER.`;
    if (!(await window.cpConfirm(finalMsg, { danger: true }))) return;

    button.disabled = true;
    const orig = button.textContent;
    button.textContent = '...';

    try {
        await supabase.from('tile_pack_likes').delete().eq('pack_id', packId);
        const { error } = await supabase
            .from('custom_tile_packs')
            .delete()
            .eq('id', packId)
            .eq('user_id', currentUserId);

        if (error) throw error;

        try {
            const existing = localStorage.getItem('equipped_themes');
            if (existing) {
                let equippedArr = JSON.parse(existing);
                if (Array.isArray(equippedArr)) {
                    const filtered = equippedArr.filter(p => p.id !== packId);
                    if (filtered.length < equippedArr.length) {
                        if (filtered.length > 0) {
                            localStorage.setItem('equipped_themes', JSON.stringify(filtered));
                        } else {
                            localStorage.removeItem('equipped_themes');
                        }
                        refreshEquippedBanner();
                    }
                }
            }
        } catch(e) { console.warn("LocalStorage clean failed", e); }

        alert(`${(window as any).cp_translate('✅ Tile pack')} "${packName}" ${(window as any).cp_translate('has been successfully deleted!')}`);
        await (window as any).loadPacks();
        
    } catch (err) {
        console.error("Failed to delete pack:", err);
        alert(`${(window as any).cp_translate('❌ Delete operation failed:')} ${err.message}`);
        button.disabled = false;
        button.textContent = orig;
    }
}

/**
 * Click handler for Likes
 */
async function handleLikeClick(packId, button) {
    if (!currentUserId) {
        alert((window as any).cp_translate('Please sign in to like tile packs!'));
        return;
    }
    
    let wasLiked = false;
    
    try {
        const { error } = await supabase
            .from('tile_pack_likes')
            .insert({ user_id: currentUserId, pack_id: packId });
            
        if (error) {
            if (error.code === '23505') {
                const { error: delError } = await supabase
                    .from('tile_pack_likes')
                    .delete()
                    .eq('user_id', currentUserId)
                    .eq('pack_id', packId);
                if (delError) throw delError;
                
                likedPackIds.delete(packId);
                wasLiked = false;
            } else {
                throw error;
            }
        } else {
            likedPackIds.add(packId);
            wasLiked = true;
        }
        
        const { data: cnt } = await supabase
            .from('tile_pack_likes')
            .select('id', { count: 'exact' })
            .eq('pack_id', packId);
            
        const finalCount = cnt ? (cnt.length || 0) : 0;
        
        [...myPrivatePacks, ...allPublicPacks].forEach(p => {
            if (p.id === packId) {
                p.likesCount = finalCount;
            }
        });
        
        const allMatchingBtns = document.querySelectorAll(`.pack-like-btn[data-id="${packId}"]`);
        allMatchingBtns.forEach(btn => {
            btn.classList.toggle('liked', wasLiked);
            const svg = btn.querySelector('svg');
            if(svg) svg.setAttribute('fill', wasLiked ? 'currentColor' : 'none');
            const counter = btn.querySelector('.like-counter');
            if(counter) counter.textContent = finalCount.toString();
        });
        
    } catch (e) {
        console.error("Like failed:", e);
    }
}

/* ==========================================
   EDITOR STUDIO & MODAL HANDLERS
   ========================================== */

let currentEditingPackId = null;
let currentEditingPackData = {};

(window as any).handleEditPack = function(pack) {
    resetStudio();
    currentEditingPackId = pack.id;
    currentEditingPackData = pack.tile_data || {};

    const nameInput = document.getElementById('packNameInput') as HTMLInputElement;
    if (nameInput) nameInput.value = pack.name || '';
    const publicCheck = document.getElementById('packPublicCheck') as HTMLInputElement;
    if (publicCheck) publicCheck.checked = pack.is_public;

    // Recreate variant tile cells ("Water 2" etc.) saved in this pack
    Object.keys(currentEditingPackData).forEach(key => {
        const sepIdx = key.lastIndexOf(VARIANT_SEP);
        if (sepIdx === -1)
            return;
        const baseId = key.substring(0, sepIdx);
        const n = key.substring(sepIdx + VARIANT_SEP.length);
        const baseTile = CORE_TILES.find(t => t.id === baseId);
        const label = baseTile
            ? (baseId.startsWith('Water_') ? `Water ${n} · ${baseId.replace('Water_', '')}` : `${baseTile.label} ${n}`)
            : `${baseId} ${n}`;
        variantTiles.push({
            id: key,
            label,
            src: baseTile ? baseTile.src : currentEditingPackData[key],
            variantOf: baseId
        });
    });
    if (variantTiles.length > 0)
        renderStudioPresets();
    // update grid with existing images
    reapplyCustomizedMarks();

    document.getElementById('studioModal')?.classList.add('active');
};

function initStudioControls() {
    const modal = document.getElementById('studioModal');
    const openBtn = document.getElementById('openStudioBtn');
    const closeBtn = document.getElementById('closeStudioBtn');
    const cancelBtn = document.getElementById('cancelStudioBtn');
    const saveBtn = document.getElementById('savePackBtn') as HTMLButtonElement;
    const fileInput = document.getElementById('tileFileInput') as HTMLInputElement;
    
    const cropModal = document.getElementById('cropModal');
    const closeCropBtn = document.getElementById('closeCropBtn');
    const cancelCropBtn = document.getElementById('cancelCropBtn');
    const applyCropBtn = document.getElementById('applyCropBtn');
    
    const zoomSlider = document.getElementById('zoomSlider') as HTMLInputElement;
    const rotateSlider = document.getElementById('rotateSlider') as HTMLInputElement;
    const fitImageBtn = document.getElementById('fitImageBtn');
    const resetTransformBtn = document.getElementById('resetTransformBtn');

    const croppingSource = document.getElementById('croppingSource') as HTMLImageElement;
    const showGridCheck = document.getElementById('showGridCheck') as HTMLInputElement;
    const snapToGridCheck = document.getElementById('snapToGridCheck') as HTMLInputElement;
    
    const gridSizeWInput = document.getElementById('gridSizeWInput') as HTMLInputElement;
    const gridSizeHInput = document.getElementById('gridSizeHInput') as HTMLInputElement;
    const gridMarginInput = document.getElementById('gridMarginInput') as HTMLInputElement;
    const gridSpacingInput = document.getElementById('gridSpacingInput') as HTMLInputElement;
    const gridOverlay = document.getElementById('slicingGridOverlay');
    const cropModeSelect = document.getElementById('cropModeSelect');

    let isSnapping = false;
    let updatePending = false;
    let offscreenCanvas: HTMLCanvasElement | null = null;
    let isRightDragging = false;
    let isDraggingGrid = false;
    let gridDragDistance = 0;
    let lastX = 0, lastY = 0;

    // Reset all states and styles when closing studio
    const resetStudioStates = () => {
        isSnapping = false;
        updatePending = false;
        isRightDragging = false;
        isDraggingGrid = false;
        gridDragDistance = 0;
        
        // Reset mode and overlay state to prevent stuck "plus" cursor or blocked UI
        currentCropMode = 'ghost';
        if (gridOverlay) {
            gridOverlay.style.pointerEvents = 'none';
            gridOverlay.style.display = 'none';
        }

        // Force a global cursor reset to clear any stuck 'move' or 'plus' cursors
        document.body.style.cursor = 'default';
        document.documentElement.style.cursor = 'default';
        document.body.style.pointerEvents = '';
        document.documentElement.style.pointerEvents = '';
        
        const studioWorkspace = document.getElementById('studioWorkspace');
        if (studioWorkspace) studioWorkspace.style.cursor = 'default';

        const container = document.querySelector('.cropper-container') as HTMLElement;
        if (container)
            container.style.cursor = 'default';
        
        // Ensure gridOverlay is not lost when cropper container is destroyed
        const tlayer = document.getElementById('transformLayer');
        if (gridOverlay && tlayer && gridOverlay.parentElement !== tlayer) {
            tlayer.appendChild(gridOverlay);
        }
    };

    const updateSlicingGrid = () => {
        if (!cropperInstance || !gridOverlay || updatePending) return;
        
        updatePending = true;
        requestAnimationFrame(() => {
            updatePending = false;
            if (!cropperInstance || !gridOverlay) return;

            const cropperContainer = document.querySelector('.cropper-container');
            if (cropperContainer && gridOverlay.parentElement !== cropperContainer) {
                // Remove from previous parent if necessary to prevent multiple copies
                if (gridOverlay.parentElement) {
                    gridOverlay.parentElement.removeChild(gridOverlay);
                }
                cropperContainer.appendChild(gridOverlay);
            }

            const canvasData = cropperInstance.getCanvasData();
            gridOverlay.style.width = canvasData.width + 'px';
            gridOverlay.style.height = canvasData.height + 'px';
            gridOverlay.style.left = canvasData.left + 'px';
            gridOverlay.style.top = canvasData.top + 'px';
            gridOverlay.style.pointerEvents = (currentCropMode === 'smart') ? 'auto' : 'none';
        
            const gw = parseInt(gridSizeWInput?.value || '32');
            const gh = parseInt(gridSizeHInput?.value || '32');
            const gm = parseInt(gridMarginInput?.value || '0');
            const gs = parseInt(gridSpacingInput?.value || '0');
            const scale = canvasData.width / canvasData.naturalWidth;
            
            gridOverlay.style.setProperty('--grid-w', (gw * scale) + 'px');
            gridOverlay.style.setProperty('--grid-h', (gh * scale) + 'px');
            gridOverlay.style.setProperty('--grid-m', (gm * scale) + 'px');
            gridOverlay.style.setProperty('--grid-s', (gs * scale) + 'px');
            gridOverlay.style.display = showGridCheck?.checked ? 'block' : 'none';

            const ghostRef = document.getElementById('ghostReference');
            const ghostImg = document.getElementById('ghostImg') as HTMLImageElement;
            const ghostHitbox = document.getElementById('ghostHitbox');
            const activeTile = CORE_TILES.find(t => t.id === selectedTileKey);

            if (ghostRef && activeTile && cropperInstance) {
                ghostRef.style.display = (currentCropMode === 'ghost') ? 'flex' : 'none';
                if (ghostImg) {
                    const targetW = 128;
                    const targetH = 128;
                    ghostRef.style.width = targetW + 'px';
                    ghostRef.style.height = targetH + 'px';
                }
                if (ghostImg) {
                    ghostImg.dataset.noTheme = 'true';
                    let desertSrc = activeTile.src;
                    if (desertSrc.includes('/Resources/') && !desertSrc.includes('/Desert/') && !desertSrc.includes('/Global/')) {
                        desertSrc = desertSrc.replace(/\/Resources\/[^/]+\//, '/Resources/Desert/');
                    }
                    ghostImg.src = desertSrc;
                }
                if (activeTile.hitbox && ghostHitbox) {
                    ghostHitbox.style.display = 'block';
                    ghostHitbox.style.top = (activeTile.hitbox.y * 100) + '%';
                    ghostHitbox.style.left = '0';
                    ghostHitbox.style.width = '100%';
                    ghostHitbox.style.height = (activeTile.hitbox.h * 100) + '%';
                } else if (ghostHitbox) {
                    ghostHitbox.style.display = 'none';
                }
            }
        });
    };

    // Shared window listeners to avoid leaks and memory issues
    window.addEventListener('mousemove', (e) => {
        if (isRightDragging && cropperInstance) {
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            if (!isNaN(dx) && !isNaN(dy)) {
                cropperInstance.move(dx, dy);
            }
            lastX = e.clientX;
            lastY = e.clientY;
        } else if (isDraggingGrid && cropperInstance && currentCropMode === 'smart') {
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            gridDragDistance += Math.sqrt(dx * dx + dy * dy);
            cropperInstance.move(dx, dy);
            lastX = e.clientX;
            lastY = e.clientY;
        }
    });

    window.addEventListener('mouseup', () => {
        if (isRightDragging || isDraggingGrid) {
            isRightDragging = false;
            isDraggingGrid = false;
            document.body.style.cursor = 'default';
            const container = document.querySelector('.cropper-container') as HTMLElement;
            if (container) container.style.cursor = '';
        }
    });

    const initRightClickPan = () => {
        const container = document.querySelector('.cropper-container') as HTMLElement;
        if (!container || container.dataset.panInit === 'true') return;
        
        container.dataset.panInit = 'true';
        container.oncontextmenu = (e) => e.preventDefault();
        container.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                isRightDragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
                container.style.cursor = 'grabbing';
            }
        }, true);
    };

    // Set up grid clicks only once
    if (gridOverlay && gridOverlay.dataset.gridInit !== 'true') {
        gridOverlay.dataset.gridInit = 'true';
        
        (gridOverlay as HTMLElement).onmousedown = (e) => {
            if (currentCropMode === 'smart') {
                isDraggingGrid = true;
                lastX = e.clientX;
                lastY = e.clientY;
                gridDragDistance = 0;
            }
        };

        (gridOverlay as HTMLElement).onclick = (e) => {
            if (!cropperInstance || isSnapping || gridDragDistance > 5) return;
            
            e.preventDefault();
            e.stopImmediatePropagation();
            
            const rect = gridOverlay.getBoundingClientRect();
            const canvasData = cropperInstance.getCanvasData();
            if (canvasData.width === 0 || canvasData.height === 0) return;

            const scale = canvasData.naturalWidth / canvasData.width;
            const clickX = (e.clientX - rect.left) * scale;
            const clickY = (e.clientY - rect.top) * scale;
            if (isNaN(clickX) || isNaN(clickY)) return;

            const gw = parseInt(gridSizeWInput?.value || '32');
            const gh = parseInt(gridSizeHInput?.value || '32');
            const gm = parseInt(gridMarginInput?.value || '0');
            const gs = parseInt(gridSpacingInput?.value || '0');
            
            const tileX = Math.floor((clickX - gm) / (gw + gs));
            const tileY = Math.floor((clickY - gm) / (gh + gs));
            
            if (tileX >= 0 && tileY >= 0) {
                const snapX = gm + tileX * (gw + gs);
                const snapY = gm + tileY * (gh + gs);
                if (snapX < 0 || snapX >= canvasData.naturalWidth || snapY < 0 || snapY >= canvasData.naturalHeight) return;

                if (currentCropMode === 'smart' && offscreenCanvas) {
                    const bounds = getTrimmedBounds(offscreenCanvas, snapX, snapY, gw, gh);
                    isSnapping = true;
                    if (bounds) {
                        cropperInstance.setData(bounds);
                    } else {
                        cropperInstance.setData({ x: snapX, y: snapY, width: gw, height: gh });
                    }
                    setTimeout(() => { isSnapping = false; }, 50);
                } else if (currentCropMode === 'smart') {
                    isSnapping = true;
                    cropperInstance.setData({ x: snapX, y: snapY, width: gw, height: gh });
                    setTimeout(() => { isSnapping = false; }, 50);
                }
            }
        };
    }

    const getCropperOptions = (initialData: any = null) => {
        return {
            aspectRatio: NaN,
            viewMode: 0,
            background: false,
            zoomable: true,
            movable: true,
            autoCrop: true,
            cropBoxMovable: (currentCropMode === 'manual'),
            cropBoxResizable: (currentCropMode === 'manual'),
            dragMode: (currentCropMode === 'manual') ? 'crop' : 'move',
            guides: false,
            center: false,
            highlight: false,
            responsive: true,
            checkOrientation: true,
            ready() {
                updateSlicingGrid();
                initRightClickPan();
                if (initialData) {
                    cropperInstance.setData(initialData);
                }
                if (currentCropMode === 'ghost') {
                    const canvasData = cropperInstance.getCanvasData();
                    const containerData = cropperInstance.getContainerData();
                    const targetW = 128;
                    const targetH = 128;
                    const centerX = (containerData.width - targetW) / 2;
                    const centerY = (containerData.height - targetH) / 2;
                    cropperInstance.setCropBoxData({
                        left: centerX,
                        top: centerY,
                        width: targetW,
                        height: targetH
                    });
                    cropperInstance.setDragMode('move');
                } else if (currentCropMode === 'manual') {
                    cropperInstance.setDragMode('crop');
                    // Ensure there's a visible crop box if switching from modes that might have hidden it
                    const data = cropperInstance.getData();
                    if (!data || data.width === 0) {
                        const canvasData = cropperInstance.getCanvasData();
                        cropperInstance.setData({
                            x: canvasData.naturalWidth / 4,
                            y: canvasData.naturalHeight / 4,
                            width: canvasData.naturalWidth / 2,
                            height: canvasData.naturalHeight / 2
                        });
                    }
                } else if (currentCropMode === 'smart') {
                    cropperInstance.setDragMode('move');
                }
            },
            zoom(event: any) {
                updateSlicingGrid();
                if (zoomSlider && event.detail.ratio) {
                    zoomSlider.value = event.detail.ratio.toString();
                }
            },
            crop(event: any) {
                if (isSnapping || !cropperInstance) return;
                updateSlicingGrid();
                if (currentCropMode === 'ghost' || currentCropMode === 'smart' || currentCropMode === 'manual' || !snapToGridCheck?.checked) return;
                const gw = parseInt(gridSizeWInput?.value || '32');
                const gh = parseInt(gridSizeHInput?.value || '32');
                const gm = parseInt(gridMarginInput?.value || '0');
                const gs = parseInt(gridSpacingInput?.value || '0');
                const d = event.detail;
                const tileX = Math.round((d.x - gm) / (gw + gs));
                const tileY = Math.round((d.y - gm) / (gh + gs));
                const rx = gm + tileX * (gw + gs);
                const ry = gm + tileY * (gh + gs);
                const rw = Math.round(d.width / gw) * gw;
                const rh = Math.round(d.height / gh) * gh;
                if (Math.abs(d.x - rx) > 0.5 || Math.abs(d.y - ry) > 0.5 || Math.abs(d.width - rw) > 0.5 || Math.abs(d.height - rh) > 0.5) {
                    isSnapping = true;
                    cropperInstance.setData({ x: rx, y: ry, width: rw, height: rh });
                    setTimeout(() => { isSnapping = false; }, 50);
                }
            }
        };
    };
    const switchMode = (mode: string) => {
        if (!cropperInstance) return;
        currentCropMode = mode;
        const ghostRef = document.getElementById('ghostReference');
        if (ghostRef) {
            ghostRef.style.visibility = (currentCropMode === 'ghost') ? 'visible' : 'hidden';
            ghostRef.style.display = (currentCropMode === 'ghost') ? 'flex' : 'none';
        }
        const cropData = cropperInstance.getData();
        cropperInstance.destroy();
        cropperInstance = new Cropper(croppingSource, getCropperOptions(cropData));
    };

    if (cropModeSelect) {
        cropModeSelect.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest('.mode-btn-v2') as HTMLElement;
            if (!btn) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            cropModeSelect.querySelectorAll('.mode-btn-v2').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (btn.dataset.mode) {
                switchMode(btn.dataset.mode);
            }
        });
    }

    if (openBtn) {
        openBtn.onclick = () => {
            if (!currentUserId) {
                alert((window as any).cp_translate("Please sign in via Discord to create custom tile packs!"));
                return;
            }
            resetStudio();
            modal?.classList.add('active');
        };
    }

    const closeModal = () => modal?.classList.remove('active');
    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;
    if (saveBtn) saveBtn.onclick = handleStudioSubmit;

    fileInput.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file || !selectedTileKey) return;
        
        if (file.size > 5 * 1024 * 1024) {
            alert((window as any).cp_translate("Original file size too large! Max limit 5MB for cropping."));
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (evt) => {
            const result = evt.target?.result as string;
            
            // Initialize persistent offscreen canvas for fast pixel processing
            croppingSource.onload = () => {
                offscreenCanvas = document.createElement('canvas');
                offscreenCanvas.width = croppingSource.naturalWidth;
                offscreenCanvas.height = croppingSource.naturalHeight;
                const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
                ctx?.drawImage(croppingSource, 0, 0);
            };
            
            croppingSource.src = result;
            cropModal?.classList.add('active');

            if (cropModeSelect) {
                cropModeSelect.querySelectorAll('.mode-btn-v2').forEach(b => {
                    b.classList.toggle('active', (b as HTMLElement).dataset.mode === currentCropMode);
                });
                const ghostRef = document.getElementById('ghostReference');
                if (ghostRef) {
                    ghostRef.style.visibility = (currentCropMode === 'ghost') ? 'visible' : 'hidden';
                }
            }

            if (cropperInstance) {
                cropperInstance.destroy();
            }
            cropperInstance = new Cropper(croppingSource, getCropperOptions());

            [gridSizeWInput, gridSizeHInput, gridMarginInput, gridSpacingInput].forEach(inp => {
                if (inp) inp.oninput = updateSlicingGrid;
            });
            if (showGridCheck) showGridCheck.onchange = updateSlicingGrid;
        };
        reader.readAsDataURL(file);
    };

    if (zoomSlider) {
        zoomSlider.oninput = () => {
            cropperInstance?.zoomTo(parseFloat(zoomSlider.value));
        };
    }
    if (rotateSlider) {
        rotateSlider.oninput = () => {
            cropperInstance?.rotateTo(parseInt(rotateSlider.value));
        };
    }
    if (resetTransformBtn) {
        resetTransformBtn.onclick = () => {
            cropperInstance?.reset();
            if (zoomSlider) zoomSlider.value = "1";
            if (rotateSlider) rotateSlider.value = "0";
        };
    }
    if (fitImageBtn) {
        fitImageBtn.onclick = () => {
            cropperInstance?.setDragMode('move');
            cropperInstance?.zoomTo(1);
            cropperInstance?.reset();
        };
    }

    const cleanupAndCloseCrop = () => {
        if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
        }
        resetStudioStates();
        const ghostRef = document.getElementById('ghostReference');
        if (ghostRef) ghostRef.style.display = 'none';
        
        const studioLoader = document.getElementById('studioLoader');
        if (studioLoader) studioLoader.classList.remove('active');
        
        cropModal?.classList.remove('active');
        fileInput.value = "";
    };

    if (closeCropBtn) closeCropBtn.onclick = cleanupAndCloseCrop;
    if (cancelCropBtn) cancelCropBtn.onclick = cleanupAndCloseCrop;

    if (applyCropBtn) {
        applyCropBtn.onclick = () => {
            if (!cropperInstance) return;
            const naturalData = cropperInstance.getData();
            const canvas = cropperInstance.getCroppedCanvas({
                imageSmoothingEnabled: naturalData.width > 128,
                imageSmoothingQuality: 'high'
            });
            if (!canvas) {
                alert((window as any).cp_translate("Could not read cropped region."));
                return;
            }
            
            const maxOutputSize = 512;
            let targetW, targetH;
            const aspect = naturalData.width / naturalData.height;
            if (aspect >= 1) {
                targetW = Math.min(naturalData.width, maxOutputSize);
                targetH = targetW / aspect;
            } else {
                targetH = Math.min(naturalData.height, maxOutputSize);
                targetW = targetH * aspect;
            }

            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = targetW;
            finalCanvas.height = targetH;
            const ctx = finalCanvas.getContext('2d');
            if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(canvas, 0, 0, targetW, targetH);
            }

            const dataUrl = finalCanvas.toDataURL('image/png');
            const cell = document.querySelector(`.tile-edit-cell[data-id="${selectedTileKey}"]`);
            if (cell) {
                (cell.querySelector('.tile-cell-img') as HTMLImageElement).src = dataUrl;
                cell.classList.add('customized');
                if (!cell.querySelector('.customized-badge')) {
                    const b = document.createElement('div');
                    b.className = 'customized-badge';
                    cell.appendChild(b);
                }
            }

            finalCanvas.toBlob((blob) => {
                if (blob) editedTileFiles[selectedTileKey] = blob;
                cleanupAndCloseCrop();
            }, 'image/png');
        };
    }
}

function resetStudio() {
    editedTileFiles = {};
    selectedTileKey = null;
    currentEditingPackId = null;
    currentEditingPackData = {};
    // Reset slice panel state
    sliceFragments.forEach(f => URL.revokeObjectURL(f.url));
    sliceFragments = [];
    selectedFragment = null;
    variantTiles = [];
    sliceSourceImg = null;
    const fragGrid = document.getElementById('sliceFragmentsGrid');
    if (fragGrid) fragGrid.innerHTML = '';
    const choiceBox = document.getElementById('sliceChoice');
    if (choiceBox) choiceBox.style.display = 'none';
    const statusEl = document.getElementById('sliceStatus');
    if (statusEl) statusEl.textContent = '';
    document.getElementById('studioTileGrid')?.classList.remove('assign-mode');
    document.getElementById('variantPickerPop')?.remove();
    closeManualCut();
    const nameInput = document.getElementById('packNameInput') as HTMLInputElement;
    const publicCheck = document.getElementById('packPublicCheck') as HTMLInputElement;
    if (nameInput) nameInput.value = '';
    if (publicCheck) publicCheck.checked = false;
    document.getElementById('studioLoader')?.classList.remove('active');
    renderStudioPresets();
}

function renderStudioPresets() {
    const grid = document.getElementById('studioTileGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const buildCell = (tile, isVariant = false) => {
        const cell = document.createElement('div');
        cell.className = 'tile-edit-cell' + (isVariant ? ' variant-cell' : '');
        cell.setAttribute('data-id', tile.id);
        cell.innerHTML = `
            <img src="${tile.src}" class="tile-cell-img" alt="${tile.label}" data-no-theme="true">
            <span class="tile-cell-label">${tile.label}</span>
        `;
        if (isVariant) {
            const rm = document.createElement('button');
            rm.className = 'variant-remove-btn';
            rm.title = window.cp_translate('Remove variant');
            rm.textContent = '✕';
            rm.onclick = (e) => {
                e.stopPropagation();
                variantTiles = variantTiles.filter(v => v.id !== tile.id);
                delete editedTileFiles[tile.id];
                delete currentEditingPackData[tile.id];
                renderStudioPresets();
                reapplyCustomizedMarks();
            };
            cell.appendChild(rm);
        }
        cell.onclick = () => {
            // If a cut fragment is selected on the right — assign it to this tile.
            if (selectedFragment) {
                assignFragmentToTile(tile.id, cell);
                return;
            }
            // Otherwise keep the classic behavior: pick a file and open the cropper.
            selectedTileKey = tile.id;
            document.getElementById('tileFileInput')?.click();
        };
        grid.appendChild(cell);
    };
    CORE_TILES.forEach(tile => buildCell(tile, false));
    variantTiles.forEach(tile => buildCell(tile, true));
}

// Re-apply green "customized" marks after a grid re-render
function reapplyCustomizedMarks() {
    const marked = new Set([...Object.keys(currentEditingPackData), ...Object.keys(editedTileFiles)]);
    marked.forEach(key => {
        const cell = document.querySelector(`.tile-edit-cell[data-id="${key}"]`);
        if (!cell)
            return;
        const img = cell.querySelector('.tile-cell-img');
        if (img) {
            if (editedTileFiles[key] instanceof Blob) {
                img.src = URL.createObjectURL(editedTileFiles[key]);
            }
            else if (currentEditingPackData[key]) {
                img.src = currentEditingPackData[key];
            }
        }
        cell.classList.add('customized');
        if (!cell.querySelector('.customized-badge')) {
            const b = document.createElement('div');
            b.className = 'customized-badge';
            cell.appendChild(b);
        }
    });
}

/* ==========================================
   AUTO-SLICE PANEL (upload → cut → assign)
   ========================================== */
let selectedFragment = null; // { frag, cardEl }
let sliceFragments = []; // [{ blob, url, w, h, assignedTo }]
let variantTiles = []; // [{ id, label, src, variantOf }]
let sliceSourceImg = null;

function tr(key) {
    return typeof window.cp_translate === 'function' ? window.cp_translate(key) : key;
}

function initSlicePanel() {
    const dropzone = document.getElementById('sliceDropzone');
    const sliceInput = document.getElementById('sliceFileInput') as HTMLInputElement;
    const choiceBox = document.getElementById('sliceChoice');
    const previewImg = document.getElementById('slicePreviewImg') as HTMLImageElement;
    const autoBtn = document.getElementById('autoSliceBtn');
    const gridBtn = document.getElementById('gridSliceBtn');
    const manualBtn = document.getElementById('manualSliceBtn');
    const manualDoneBtn = document.getElementById('manualDoneBtn');
    const statusEl = document.getElementById('sliceStatus');
    const addVariantBtn = document.getElementById('addVariantTileBtn');
    if (!dropzone || !sliceInput)
        return;
    // Localize static split-panel labels
    document.querySelectorAll('#studioModal [data-i18n]').forEach(el => {
        el.textContent = tr(el.getAttribute('data-i18n'));
    });
    const loadSliceFile = (file) => {
        if (!file)
            return;
        if (file.type && !/^image\//.test(file.type)) {
            alert(tr('Failed to load image.'));
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            alert(tr('Original file size too large! Max limit 5MB for cropping.'));
            return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            sliceSourceImg = img;
            if (previewImg)
                previewImg.src = url;
            if (choiceBox)
                choiceBox.style.display = 'flex';
            closeManualCut();
            if (statusEl)
                statusEl.textContent = `${img.naturalWidth}×${img.naturalHeight}px — ` + tr('choose how to cut the image');
        };
        img.onerror = () => alert(tr('Failed to load image.'));
        img.src = url;
    };
    // Click or keyboard opens the file picker
    dropzone.addEventListener('click', () => sliceInput.click());
    dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            sliceInput.click();
        }
    });
    // Drag & drop straight onto the dropzone
    ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
    }));
    dropzone.addEventListener('drop', (e) => {
        loadSliceFile(e.dataTransfer?.files?.[0]);
    });
    sliceInput.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        sliceInput.value = '';
        loadSliceFile(file);
    };
    if (autoBtn) {
        autoBtn.onclick = () => {
            if (!sliceSourceImg)
                return;
            closeManualCut();
            if (statusEl)
                statusEl.textContent = tr('Slicing image…');
            // Let the status paint before the heavy loop
            setTimeout(() => {
                try {
                    const rects = autoSliceImage(sliceSourceImg);
                    renderSliceFragments(rects);
                    if (statusEl) {
                        statusEl.textContent = rects.length
                            ? `${tr('Fragments found:')} ${rects.length}. ${tr('Click a fragment, then click a tile on the left to assign it.')}`
                            : tr('No fragments found — make sure the image has a transparent background.');
                    }
                }
                catch (err) {
                    console.error('[Compass] Auto-slice failed:', err);
                    if (statusEl)
                        statusEl.textContent = tr('Failed to slice the image.');
                }
            }, 30);
        };
    }
    if (gridBtn) {
        gridBtn.onclick = () => {
            if (!sliceSourceImg)
                return;
            closeManualCut();
            const cw = Math.max(2, parseInt((document.getElementById('gridCellW') as HTMLInputElement)?.value, 10) || 32);
            const ch = Math.max(2, parseInt((document.getElementById('gridCellH') as HTMLInputElement)?.value, 10) || 32);
            if (statusEl)
                statusEl.textContent = tr('Slicing image…');
            setTimeout(() => {
                try {
                    const pieces = gridSliceImage(sliceSourceImg, cw, ch);
                    renderSliceFragments(pieces);
                    if (statusEl) {
                        statusEl.textContent = pieces.length
                            ? `${tr('Fragments found:')} ${pieces.length}. ${tr('Click a fragment, then click a tile on the left to assign it.')}`
                            : tr('The grid produced no fragments — every cell is fully transparent.');
                    }
                }
                catch (err) {
                    console.error('[Compass] Grid slice failed:', err);
                    if (statusEl)
                        statusEl.textContent = tr('Failed to slice the image.');
                }
            }, 30);
        };
    }
    if (manualBtn) {
        manualBtn.onclick = () => {
            if (!sliceSourceImg) {
                window.cpToast(tr('Upload an image first.'), 'info');
                return;
            }
            openManualCut();
        };
    }
    if (manualDoneBtn) {
        manualDoneBtn.onclick = () => closeManualCut();
    }
    if (addVariantBtn) {
        addVariantBtn.onclick = openVariantPicker;
    }
}

/**
 * Grid slice: cuts the image into fixed-size cells (cellW × cellH),
 * skipping cells that are fully transparent.
 */
function gridSliceImage(img, cellW, cellH) {
    const W = img.naturalWidth, H = img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const pieces = [];
    for (let y = 0; y < H; y += cellH) {
        for (let x = 0; x < W; x += cellW) {
            const w = Math.min(cellW, W - x);
            const h = Math.min(cellH, H - y);
            const cell = ctx.getImageData(x, y, w, h).data;
            let hasContent = false;
            for (let i = 3; i < cell.length; i += 4) {
                if (cell[i] > 10) {
                    hasContent = true;
                    break;
                }
            }
            if (!hasContent)
                continue; // skip fully transparent cells
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            c.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
            pieces.push({ canvas: c, w, h });
            if (pieces.length > 512)
                throw new Error('Too many fragments');
        }
    }
    return pieces;
}

/* ══════════════════════════════════════════════════════════════
   ✂️ MANUAL CUTTING — drag rectangles over the image
   ══════════════════════════════════════════════════════════════ */
let manualCutActive = false;

function openManualCut() {
    const wrap = document.getElementById('manualCutWrap');
    const stage = document.getElementById('manualCutStage');
    const canvas = document.getElementById('manualCutCanvas') as HTMLCanvasElement;
    if (!wrap || !stage || !canvas || !sliceSourceImg)
        return;
    // Clear leftover selection marks from a previous session
    stage.querySelectorAll('.manual-cut-rect-mark').forEach(m => m.remove());
    const W = sliceSourceImg.naturalWidth, H = sliceSourceImg.naturalHeight;
    canvas.width = W;
    canvas.height = H;
    canvas.getContext('2d').drawImage(sliceSourceImg, 0, 0);
    wrap.style.display = 'flex';
    manualCutActive = true;
    const statusEl = document.getElementById('sliceStatus');
    if (statusEl)
        statusEl.textContent = tr('Drag rectangles on the image — each selection becomes a fragment.');
    if (canvas.dataset.cpBound)
        return; // pointer listeners already attached
    canvas.dataset.cpBound = '1';
    const box = document.getElementById('manualSelectBox');
    let startX = 0, startY = 0, dragging = false;
    const imgSize = () => ({ W: canvas.width, H: canvas.height });
    const toImageCoords = (e) => {
        const { W, H } = imgSize();
        const r = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(W, (e.clientX - r.left) * (W / r.width)));
        const y = Math.max(0, Math.min(H, (e.clientY - r.top) * (H / r.height)));
        return { x, y };
    };
    canvas.addEventListener('pointerdown', (e) => {
        if (!manualCutActive)
            return;
        e.preventDefault();
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
        const p = toImageCoords(e);
        startX = p.x;
        startY = p.y;
        dragging = true;
        if (box) {
            box.style.display = 'block';
            box.style.width = '0px';
            box.style.height = '0px';
        }
    });
    canvas.addEventListener('pointermove', (e) => {
        if (!dragging || !box)
            return;
        const { W, H } = imgSize();
        const p = toImageCoords(e);
        const r = canvas.getBoundingClientRect();
        const sx = r.width / W, sy = r.height / H;
        box.style.left = Math.min(startX, p.x) * sx + 'px';
        box.style.top = Math.min(startY, p.y) * sy + 'px';
        box.style.width = Math.abs(p.x - startX) * sx + 'px';
        box.style.height = Math.abs(p.y - startY) * sy + 'px';
    });
    canvas.addEventListener('pointerup', (e) => {
        if (!dragging)
            return;
        dragging = false;
        if (box)
            box.style.display = 'none';
        const { W, H } = imgSize();
        const p = toImageCoords(e);
        const x0 = Math.round(Math.min(startX, p.x));
        const y0 = Math.round(Math.min(startY, p.y));
        const w = Math.round(Math.abs(p.x - startX));
        const h = Math.round(Math.abs(p.y - startY));
        if (w < 3 || h < 3)
            return; // ignore accidental clicks
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
        appendSliceFragments([{ canvas: c, w, h }]);
        // Leave a subtle mark where the fragment was cut from
        const r = canvas.getBoundingClientRect();
        const mark = document.createElement('div');
        mark.className = 'manual-cut-rect-mark';
        mark.style.left = (x0 * r.width / W) + 'px';
        mark.style.top = (y0 * r.height / H) + 'px';
        mark.style.width = (w * r.width / W) + 'px';
        mark.style.height = (h * r.height / H) + 'px';
        stage.appendChild(mark);
        const st = document.getElementById('sliceStatus');
        if (st)
            st.textContent = `${tr('Fragments found:')} ${sliceFragments.length + 1}. ${tr('Click a fragment, then click a tile on the left to assign it.')}`;
    });
}

function closeManualCut() {
    manualCutActive = false;
    const wrap = document.getElementById('manualCutWrap');
    if (wrap)
        wrap.style.display = 'none';
}

/**
 * Cuts an image with a transparent background into fragments.
 * Finds connected components of non-transparent pixels (8-connectivity,
 * with a small gap tolerance so anti-aliased edges stay in one piece),
 * then crops each component's bounding rectangle onto its own canvas.
 */
function autoSliceImage(img) {
    const W = img.naturalWidth, H = img.naturalHeight;
    const MAX_DIM = 4096;
    if (W > MAX_DIM || H > MAX_DIM)
        throw new Error('Image too large');
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, W, H).data;
    const ALPHA_MIN = 10; // pixels with alpha above this are "solid"
    const GAP = 2; // bridge up to 2px transparent gaps (anti-aliasing)
    const solid = (x, y) => data[(y * W + x) * 4 + 3] > ALPHA_MIN;
    const visited = new Uint8Array(W * H);
    const rects = [];
    const stack = [];
    for (let sy = 0; sy < H; sy++) {
        for (let sx = 0; sx < W; sx++) {
            const sIdx = sy * W + sx;
            if (visited[sIdx] || !solid(sx, sy))
                continue;
            // BFS flood fill
            let minX = sx, maxX = sx, minY = sy, maxY = sy, area = 0;
            visited[sIdx] = 1;
            stack.length = 0;
            stack.push(sIdx);
            while (stack.length) {
                const idx = stack.pop();
                const x = idx % W, y = (idx / W) | 0;
                area++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                for (let dy = -1 - GAP; dy <= 1 + GAP; dy++) {
                    for (let dx = -1 - GAP; dx <= 1 + GAP; dx++) {
                        if (!dx && !dy)
                            continue;
                        const nx = x + dx, ny = y + dy;
                        if (nx < 0 || ny < 0 || nx >= W || ny >= H)
                            continue;
                        const nIdx = ny * W + nx;
                        if (visited[nIdx] || !solid(nx, ny))
                            continue;
                        visited[nIdx] = 1;
                        stack.push(nIdx);
                    }
                }
            }
            if (area >= 24) { // ignore stray specks
                rects.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
            }
            if (rects.length > 256)
                throw new Error('Too many fragments — is the background really transparent?');
        }
    }
    // Merge rectangles that overlap each other (nested pieces of one tile)
    let merged = true;
    while (merged) {
        merged = false;
        outer: for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
                const a = rects[i], b = rects[j];
                if (a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h) {
                    const nx = Math.min(a.x, b.x), ny = Math.min(a.y, b.y);
                    a.w = Math.max(a.x + a.w, b.x + b.w) - nx;
                    a.h = Math.max(a.y + a.h, b.y + b.h) - ny;
                    a.x = nx;
                    a.y = ny;
                    rects.splice(j, 1);
                    merged = true;
                    break outer;
                }
            }
        }
    }
    // Sort reading-order: top-to-bottom rows, then left-to-right
    rects.sort((a, b) => (Math.abs(a.y - b.y) > Math.min(a.h, b.h) / 2) ? a.y - b.y : a.x - b.x);
    // Crop each rect to its own canvas
    return rects.map(r => {
        const c = document.createElement('canvas');
        c.width = r.w;
        c.height = r.h;
        c.getContext('2d').drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        return { canvas: c, w: r.w, h: r.h };
    });
}

function renderSliceFragments(pieces) {
    // Cleanup previous fragments, then append the new batch
    sliceFragments.forEach(f => URL.revokeObjectURL(f.url));
    sliceFragments = [];
    selectedFragment = null;
    document.getElementById('studioTileGrid')?.classList.remove('assign-mode');
    const grid = document.getElementById('sliceFragmentsGrid');
    if (grid)
        grid.innerHTML = '';
    appendSliceFragments(pieces);
}

// Appends fragment cards WITHOUT clearing the existing ones (used by manual cutting)
function appendSliceFragments(pieces) {
    const grid = document.getElementById('sliceFragmentsGrid');
    if (!grid)
        return;
    pieces.forEach((piece) => {
        piece.canvas.toBlob((blob) => {
            if (!blob)
                return;
            const url = URL.createObjectURL(blob);
            const frag = { blob, url, w: piece.w, h: piece.h, assignedTo: null, cardEl: null };
            sliceFragments.push(frag);
            const card = document.createElement('div');
            card.className = 'slice-fragment-card';
            card.innerHTML = `<img src="${url}" alt="fragment"><span class="frag-size">${piece.w}×${piece.h}</span>`;
            card.onclick = () => {
                const wasSelected = selectedFragment && selectedFragment.frag === frag;
                grid.querySelectorAll('.slice-fragment-card').forEach(c => c.classList.remove('selected'));
                if (wasSelected) {
                    selectedFragment = null;
                }
                else {
                    card.classList.add('selected');
                    selectedFragment = { frag, cardEl: card };
                }
                document.getElementById('studioTileGrid')?.classList.toggle('assign-mode', !!selectedFragment);
            };
            frag.cardEl = card;
            grid.appendChild(card);
        }, 'image/png');
    });
}

function assignFragmentToTile(tileId, cell) {
    if (!selectedFragment)
        return;
    const { frag, cardEl } = selectedFragment;
    editedTileFiles[tileId] = frag.blob;
    frag.assignedTo = tileId;
    // Update the tile cell preview + customized mark
    const img = cell.querySelector('.tile-cell-img');
    if (img)
        img.src = frag.url;
    cell.classList.add('customized');
    if (!cell.querySelector('.customized-badge')) {
        const b = document.createElement('div');
        b.className = 'customized-badge';
        cell.appendChild(b);
    }
    // Mark the fragment as used and clear the selection
    cardEl.classList.remove('selected');
    cardEl.classList.add('assigned');
    selectedFragment = null;
    document.getElementById('studioTileGrid')?.classList.remove('assign-mode');
}

/* ==========================================
   VARIANT TILES ("Water 2", "Bush 2" …)
   ========================================== */
const VARIANT_SEP = '__v';

// Base entries pickable as variants: every core tile, but the 47 water
// edge textures act as ONE group ("Water") that expands automatically.
function getVariantBases() {
    const bases = CORE_TILES.filter(t => !t.id.startsWith('Water_')).map(t => ({ id: t.id, label: t.label, src: t.src, group: null }));
    bases.push({ id: 'Water', label: 'Water', src: './Resources/Desert/Water/11111111.png', group: WATER_FILENAMES });
    return bases;
}

function nextVariantNumber(baseId) {
    let n = 2;
    const taken = new Set(variantTiles.map(v => v.id));
    const idFor = (num) => baseId + VARIANT_SEP + num;
    while (taken.has(idFor(n)) || (baseId === 'Water' && taken.has(`Water_11111111${VARIANT_SEP}${n}`)))
        n++;
    return n;
}

function addVariantTile(base) {
    const n = nextVariantNumber(base.id);
    if (base.group) {
        // Water: add the whole group — every edge texture gets its own variant cell
        base.group.forEach(fname => {
            const key = fname.replace('.png', '');
            variantTiles.push({
                id: `Water_${key}${VARIANT_SEP}${n}`,
                label: `Water ${n} · ${key}`,
                src: `./Resources/Desert/Water/${fname}`,
                variantOf: `Water_${key}`
            });
        });
    }
    else {
        variantTiles.push({
            id: base.id + VARIANT_SEP + n,
            label: `${base.label} ${n}`,
            src: base.src,
            variantOf: base.id
        });
    }
    renderStudioPresets();
    reapplyCustomizedMarks();
    // Scroll the new cells into view
    const firstNew = document.querySelector('.tile-edit-cell.variant-cell:last-child');
    firstNew?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function openVariantPicker() {
    // Lightweight picker popup anchored inside the studio modal
    document.getElementById('variantPickerPop')?.remove();
    const anchor = document.getElementById('addVariantTileBtn');
    if (!anchor)
        return;
    const pop = document.createElement('div');
    pop.id = 'variantPickerPop';
    pop.style.cssText = `position: absolute; z-index: 50; width: 240px; max-height: 300px; overflow-y: auto;
        background: linear-gradient(145deg, rgba(24,24,36,0.98), rgba(12,12,18,0.97));
        border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 6px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.6);`;
    const rect = anchor.getBoundingClientRect();
    const host = anchor.closest('.modal-container') || document.body;
    const hostRect = host.getBoundingClientRect();
    pop.style.left = Math.max(8, rect.left - hostRect.left - 60) + 'px';
    pop.style.top = (rect.bottom - hostRect.top + 6) + 'px';
    getVariantBases().forEach(base => {
        const item = document.createElement('button');
        item.type = 'button';
        item.style.cssText = `display:flex; align-items:center; gap:8px; width:100%; background:none;
            border:none; color:rgba(255,255,255,0.85); padding:6px 8px; border-radius:8px;
            cursor:pointer; font-size:0.78rem; text-align:left;`;
        item.onmouseenter = () => item.style.background = 'rgba(0,210,255,0.1)';
        item.onmouseleave = () => item.style.background = 'none';
        const groupNote = base.group ? ` (${base.group.length})` : '';
        item.innerHTML = `<img src="${base.src}" data-no-theme="true" style="width:22px;height:22px;object-fit:contain;"><span>${base.label}${groupNote}</span>`;
        item.onclick = () => {
            pop.remove();
            addVariantTile(base);
        };
        pop.appendChild(item);
    });
    host.appendChild(pop);
    // Close when clicking anywhere else
    setTimeout(() => {
        const closer = (e) => {
            if (!pop.contains(e.target)) {
                pop.remove();
                document.removeEventListener('mousedown', closer);
            }
        };
        document.addEventListener('mousedown', closer);
    }, 0);
}

async function handleStudioSubmit() {
    const nameInput = (document.getElementById('packNameInput') as HTMLInputElement).value.trim();
    if (!nameInput) {
        alert((window as any).cp_translate('Please give your Tile Pack a name!'));
        return;
    }
    const modifiedCount = Object.keys(editedTileFiles).length;
    const isUpdate = !!currentEditingPackId;
    
    if (!isUpdate && modifiedCount === 0) {
        alert((window as any).cp_translate('Customize at least one tile before saving!'));
        return;
    }
    const loader = document.getElementById('studioLoader');
    const loaderText = document.getElementById('loaderText');
    const saveBtn = document.getElementById('savePackBtn') as HTMLButtonElement;
    
    if (saveBtn) saveBtn.disabled = true;
    loader?.classList.add('active');
    
    try {
        const publicCheck = document.getElementById('packPublicCheck') as HTMLInputElement;
        const isPublic = publicCheck ? publicCheck.checked : true;
        const timestamp = Date.now();
        const sanitizedName = nameInput.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        if (loaderText) loaderText.textContent = `Preparing uploads (0/${modifiedCount})...`;
        
        const finalTileData = { ...currentEditingPackData };
        let uploadIdx = 0;
        
        for (const [tileId, fileObj] of Object.entries(editedTileFiles)) {
            uploadIdx++;
            if (loaderText) loaderText.textContent = `Uploading ${tileId} (${uploadIdx}/${modifiedCount})...`;
            const fileExt = (fileObj as any).name ? (fileObj as any).name.split('.').pop() : 'png';
            const uploadPath = `forum_attachments/${currentUserId}/${timestamp}_${sanitizedName}/${tileId}.${fileExt}`;
            
            const { error: sError } = await (supabase as any).storage
                .from('custom_tiles')
                .upload(uploadPath, fileObj);
            if (sError) throw sError;
            
            const { data: { publicUrl } } = (supabase as any).storage
                .from('custom_tiles')
                .getPublicUrl(uploadPath);
            (finalTileData as any)[tileId] = publicUrl;
        }
        
        if (loaderText) loaderText.textContent = 'Saving metadata to cloud DB...';
        
        let dbError;
        if (isUpdate) {
            const { error } = await (supabase as any)
                .from('custom_tile_packs')
                .update({
                    name: nameInput,
                    is_public: isPublic,
                    tile_data: finalTileData
                })
                .eq('id', currentEditingPackId);
            dbError = error;
        } else {
            const { error } = await (supabase as any)
                .from('custom_tile_packs')
                .insert({
                    user_id: currentUserId,
                    user_name: currentUserName,
                    name: nameInput,
                    is_public: isPublic,
                    tile_data: finalTileData
                });
            dbError = error;
        }
            
        if (dbError) throw dbError;
        
        loader?.classList.remove('active');
        document.getElementById('studioModal')?.classList.remove('active');
        alert((window as any).cp_translate('Tile Pack safely deployed and published! ✨'));
        await (window as any).loadPacks();
        
    } catch (err) {
        console.error("Publishing failed:", err);
        alert(`${(window as any).cp_translate('Deployment failed. Verify your internet or Supabase SQL script implementation! Details:')} ${err.message || err}`);
    } finally {
        loader?.classList.remove('active');
        if (saveBtn) saveBtn.disabled = false;
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getTrimmedBounds(canvas, startX, startY, width, height) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(startX, startY, width, height);
    const data = imageData.data;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let found = false;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha > 10) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                found = true;
            }
        }
    }
    if (!found) return null;
    return {
        x: startX + minX,
        y: startY + minY,
        width: (maxX - minX) + 1,
        height: (maxY - minY) + 1
    };
}
