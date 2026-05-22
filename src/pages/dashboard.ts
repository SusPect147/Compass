// @ts-nocheck
import { drawStaticMapPreview } from '../utils/canvas-drawer.js';
import { supabase } from '../core/supabase-client.js';

let allMaps = [];
let filteredMaps = [];
let displayedCount = 0;
const mapsPerPage = 16;
let currentUserId = null;

injectPremiumCardStyles();

async function loadMyMaps() {
    try {
        const grid = document.getElementById('mapsGrid');
        if (grid) grid.innerHTML = `<div style="padding:2rem; text-align:center; opacity:0.7;">${window.cp_translate ? window.cp_translate('Accessing your vault...') : 'Accessing your vault...'}</div>`;

        const { data: { session } } = await supabase.auth.getSession();
        
        let dbMaps = [];
        let likedMapIds = new Set();

        if (session && session.user) {
            currentUserId = session.user.id;
            const { data, error } = await supabase
                .from('maps')
                .select('*, map_likes(count)')
                .eq('user_id', currentUserId)
                .order('created_at', { ascending: false });

            if (!error && data) {
                dbMaps = data;
                const { data: myLikes } = await supabase
                    .from('map_likes')
                    .select('map_id')
                    .eq('user_id', currentUserId);
                likedMapIds = new Set((myLikes || []).map(l => l.map_id));
            }
        }

        let localMaps = [];
        let modifiedLocalMaps = false;
        try {
            const localStr = localStorage.getItem('compass_local_maps');
            if (localStr) {
                localMaps = JSON.parse(localStr);
                if (!Array.isArray(localMaps)) localMaps = [];
                
                localMaps.forEach(m => {
                    if (!m.id) {
                        m.id = 'local_' + Math.random().toString(36).substring(2, 9);
                        modifiedLocalMaps = true;
                    }
                });
                if (modifiedLocalMaps) {
                    localStorage.setItem('compass_local_maps', JSON.stringify(localMaps));
                }
            }
        } catch(e) {}

        const mappedLocalMaps = localMaps.map(m => ({
            ...m,
            isLocalOnly: true,
            likesCount: 0,
            isLikedByUser: false
        }));

        allMaps = [...mappedLocalMaps, ...dbMaps.map(m => ({
            ...m,
            likesCount: m.map_likes?.[0]?.count || 0,
            isLikedByUser: likedMapIds.has(m.id)
        }))];

        if (allMaps.length === 0 && (!session || !session.user)) {
             showEmptyState(window.cp_translate ? window.cp_translate('Please sign in via Discord to view your private maps.') : 'Please sign in via Discord to view your private maps.', '🔒');
             return;
        }

        applyFilters();

    } catch (err) {
        console.error('Error loading your maps:', err);
        showEmptyState(window.cp_translate ? window.cp_translate('Connection lost.') : 'Connection lost.', '📡');
    }
}

function showEmptyState(msg = window.cp_translate('You have not saved any maps yet.'), icon = '🗺️') {
    const container = document.getElementById('mapsGrid');
    if (!container) return;
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 5rem 1rem; opacity:0.6;">
            <div style="font-size: 2.5rem; margin-bottom: 1.2rem; opacity:0.6;">${icon}</div>
            <p style="font-size:1.1rem; margin-bottom:0.5rem; font-weight: 600;">${msg}</p>
            <p style="font-size:0.85rem;">${window.cp_translate('Start building in the Map Maker to fill your gallery.')}</p>
        </div>`;
}

function applyFilters() {
    const searchTerm = document.getElementById('mapSearch')?.value.toLowerCase() || '';
    const gamemodeFilter = document.getElementById('gamemodeFilter')?.value || '';
    const environmentFilter = document.getElementById('environmentFilter')?.value || '';
    const sizeFilter = document.getElementById('sizeFilter')?.value || '';

    filteredMaps = allMaps.filter(map => {
        if (searchTerm && !(map.name || '').toLowerCase().includes(searchTerm)) return false;
        if (gamemodeFilter && map.gamemode !== gamemodeFilter) return false;
        if (environmentFilter && map.environment !== environmentFilter) return false;
        if (sizeFilter && map.size !== sizeFilter) return false;
        return true;
    });

    displayedCount = 0;
    const grid = document.getElementById('mapsGrid');
    if (grid) grid.innerHTML = '';

    if (filteredMaps.length === 0) {
        showEmptyState(allMaps.length > 0 ? window.cp_translate('No matches found in your storage.') : undefined);
    } else {
        displayNextBatch();
    }
}

function displayNextBatch() {
    const container = document.getElementById('mapsGrid');
    if (!container) return;

    const batch = filteredMaps.slice(displayedCount, displayedCount + mapsPerPage);
    const renderedCards = []; // Collect {mapId, card} for batch suggestion loading

    batch.forEach(map => {
        if (map.thumbnail_url) {
            // Instant render from Supabase Storage
            const card = createOwnerCard(map, map.thumbnail_url);
            container.appendChild(card);
            renderedCards.push({ mapId: map.id, card });
        } else {
            // Legacy visual render for maps that haven't been re-saved yet
            drawStaticMapPreview(map.map_data, map.size, map.gamemode, map.environment)
                .then(png => {
                    const card = createOwnerCard(map, png);
                    container.appendChild(card);
                    renderedCards.push({ mapId: map.id, card });
                })
                .catch(() => {
                    const card = createOwnerCard(map, 'Resources/Additional/Icons/compass.png');
                    container.appendChild(card);
                    renderedCards.push({ mapId: map.id, card });
                });
        }
    });

    displayedCount += batch.length;
    updateLoadMore();

    // Batch-load all suggestion counts in ONE query instead of N+1
    loadBatchSuggestions(renderedCards);
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

function createOwnerCard(map, image) {
    const card = document.createElement('div');
    card.className = 'premium-card';
    
    // Читаем флаг публичности. Если колонки не было или null, по умолчанию true
    const isPublic = map.is_public ?? true;

    const safeName = escapeHTML(map.name || 'Untitled');
    
    const imageWrapperClick = map.isLocalOnly ? 
        `onclick="alert('${window.cp_translate ? window.cp_translate('Please sign in to sync this map before viewing it.') : 'Пожалуйста, войдите в аккаунт, чтобы синхронизировать эту карту перед просмотром.'}')"` : 
        `onclick="window.location.href = './view.html?id=${encodeURIComponent(map.id)}'"`;

    card.innerHTML = `
        <div class="card-image-wrapper" ${imageWrapperClick}>
            <img src="${image}" alt="Map" loading="lazy">
            <div class="card-overlay"><span>${window.cp_translate ? window.cp_translate('Edit Details') : 'Edit Details'}</span></div>
        </div>
        <div class="card-content">
            <div class="card-meta">
                <h3 class="card-title">${safeName} ${map.isLocalOnly ? `<span style="color:#ff4c4c; font-size:0.7em; margin-left: 5px;">(Local)</span>` : ''}</h3>
                <div class="card-stats">
                     <button class="likes-btn ${map.isLikedByUser ? 'liked' : ''}" data-id="${map.id}">
                        <svg class="heart-icon small" viewBox="0 0 24 24" fill="${map.isLikedByUser ? '#ff3e5c' : 'none'}" stroke="currentColor">
                           <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"></path>
                        </svg>
                        <span class="like-count">${map.likesCount}</span>
                     </button>
                </div>
            </div>
            
            <div class="owner-controls" style="display: flex; gap: 8px; flex-shrink:0; align-items: center;">
                 <button class="collab-btn" data-id="${map.id}" title="${window.cp_translate ? window.cp_translate('Generate Suggestion Link') : 'Generate Suggestion Link'}" style="
                     background: var(--accent-glow, rgba(139, 92, 246, 0.08));
                     border: 1px solid var(--border-color, rgba(139, 92, 246, 0.25));
                     color: var(--primary-color, #c4b5fd);
                     width: 32px;
                     height: 32px;
                     border-radius: 12px;
                     cursor: pointer;
                     display: flex;
                     align-items: center;
                     justify-content: center;
                     transition: all 0.25s var(--ease-premium, cubic-bezier(0.16, 1, 0.3, 1));
                     font-size: 0.9rem;
                 ">
                      👥
                 </button>
                 <button class="visibility-btn ${isPublic ? 'pub' : 'priv'}" data-id="${map.id}" data-public="${isPublic}">
                     ${isPublic ? (window.cp_translate ? window.cp_translate('🌍 Public') : '🌍 Public') : (window.cp_translate ? window.cp_translate('🔒 Private') : '🔒 Private')}
                 </button>
                 <button class="delete-card-btn" title="Delete Map Permanently">
                     <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                 </button>
            </div>
        </div>
    `;

    if (map.isLocalOnly) {
        card.style.border = '2px solid rgba(255, 76, 76, 0.6)';
        card.style.boxShadow = '0 0 15px rgba(255, 76, 76, 0.15)';
    }

    // Вешаем логику переключения видимости
    const toggleBtn = card.querySelector('.visibility-btn');
    toggleBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleMapVisibility(map.id, toggleBtn);
    });

    // Вешаем логику лайка карты
    const likeBtn = card.querySelector('.likes-btn');
    likeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleMapLike(map.id, likeBtn);
    });

    // Вешаем логику удаления карты
    const deleteBtn = card.querySelector('.delete-card-btn');
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await triggerMapDeletion(map.id, card);
    });

    // Вешаем логику совместной работы
    const collabBtn = card.querySelector('.collab-btn');
    collabBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await openCollabModal(map);
    });

    return card;
}

// Batch-load suggestion counts in ONE Supabase query to avoid N+1 problem
async function loadBatchSuggestions(renderedCards) {
    if (!renderedCards || renderedCards.length === 0) return;
    try {
        // Filter out local-only maps (they can't have suggestions)
        const dbCards = renderedCards.filter(rc => !String(rc.mapId).startsWith('local_'));
        if (dbCards.length === 0) return;

        const mapIds = dbCards.map(rc => rc.mapId);
        const { data, error } = await supabase
            .from('map_suggestions')
            .select('map_id')
            .in('map_id', mapIds);
        
        if (error || !data) return;

        // Count suggestions per map_id
        const countsMap = {};
        data.forEach(row => {
            countsMap[row.map_id] = (countsMap[row.map_id] || 0) + 1;
        });

        // Apply badges to cards that have suggestions
        dbCards.forEach(({ mapId, card }) => {
            const count = countsMap[mapId];
            if (count && count > 0) {
                const metaDiv = card.querySelector('.card-meta');
                if (metaDiv) {
                    const badge = document.createElement('div');
                    badge.className = 'suggestion-badge';
                    badge.style.cssText = `
                        display: inline-block;
                        margin-top: 6px;
                        font-size: 0.75rem;
                        background: rgba(139, 92, 246, 0.15);
                        border: 1px solid rgba(139, 92, 246, 0.35);
                        color: #c4b5fd;
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-weight: 600;
                    `;
                    badge.textContent = `👥 ${window.cp_translate('Suggestions')}: ${count}`;
                    metaDiv.appendChild(badge);
                }
            }
        });
    } catch(e) {}
}

async function openCollabModal(map) {
    let modal = document.getElementById('collabModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'collabModal';
        modal.style.opacity = '0';
        document.body.appendChild(modal);
    }
    
    requestAnimationFrame(() => {
        if (modal) modal.style.opacity = '1';
    });

    modal.innerHTML = `
        <div class="collab-modal-card">
            <button class="collab-modal-close">&times;</button>
            <h3 style="display:flex; align-items:center; gap:10px;">
                👥 ${window.cp_translate('Generate Suggestion Link')}
            </h3>
            <p>
                ${window.cp_translate('Generate a secure, unique suggestion link. Anyone with this link can edit a copy of your map and submit their suggestions to you.')}
            </p>
            <div id="collabModalBody" style="display:flex; flex-direction:column; gap:1rem;">
                <div style="text-align:center; padding: 2rem 0; opacity:0.7;">
                    ⏳ ${window.cp_translate('Checking status...')}
                </div>
            </div>
        </div>
    `;

    const cardEl = modal.querySelector('.collab-modal-card') as HTMLElement;
    requestAnimationFrame(() => {
        if (cardEl) cardEl.style.transform = 'scale(1)';
    });

    const closeBtn = modal.querySelector('.collab-modal-close') as HTMLElement;
    const closeModal = () => {
        if (modal) {
            modal.style.opacity = '0';
            if (cardEl) cardEl.style.transform = 'scale(0.9)';
            setTimeout(() => modal?.remove(), 300);
        }
    };
    closeBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    const bodyContainer = modal.querySelector('#collabModalBody') as HTMLElement;

    try {
        const { data: existing, error } = await supabase
            .from('map_collab_links')
            .select('*')
            .eq('map_id', map.id)
            .maybeSingle();

        if (error) throw error;

        const renderCollabState = (link) => {
            if (!link) {
                bodyContainer.innerHTML = `
                    <button id="generateCollabLinkBtn" class="collab-action-btn">
                        ⚡ ${window.cp_translate('Generate Suggestion Link')}
                    </button>
                `;
                const genBtn = bodyContainer.querySelector('#generateCollabLinkBtn') as HTMLButtonElement;
                genBtn.onclick = async () => {
                    genBtn.disabled = true;
                    genBtn.textContent = '...';
                    try {
                        const { data: newLink, error: insErr } = await supabase
                            .from('map_collab_links')
                            .insert([{ map_id: map.id, owner_id: currentUserId, is_active: true }])
                            .select('*')
                            .single();
                        
                        if (insErr) throw insErr;
                        renderCollabState(newLink);
                    } catch (err) {
                        console.error(err);
                        alert(window.cp_translate('Failed to generate collab link:') + ' ' + err.message);
                        genBtn.disabled = false;
                        genBtn.textContent = window.cp_translate('Generate Suggestion Link');
                    }
                };
            } else {
                const collabUrl = `${window.location.origin}${window.location.pathname.replace('dashboard.html', 'editor.html')}?collab=${link.id}`;
                bodyContainer.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:0.5rem;">
                        <label>${window.cp_translate('COLLABORATION LINK')}</label>
                        <div style="display:flex; gap:8px;">
                            <input type="text" readonly value="${collabUrl}">
                            <button id="copyCollabLinkBtn">
                                ${window.cp_translate('Copy')}
                            </button>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border-color, rgba(255,255,255,0.06));">
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <span style="font-weight:700; color:var(--text-primary); font-size:0.85rem;">
                                ${link.is_active ? `🟢 ${window.cp_translate('Active')}` : `🔴 ${window.cp_translate('Revoked')}`}
                            </span>
                            <span style="color:var(--text-secondary); opacity:0.6; font-size:0.7rem;">
                                ${link.is_active ? window.cp_translate('Your friend can use this link to edit.') : window.cp_translate('Access blocked until restored.')}
                            </span>
                        </div>
                        <button id="toggleCollabActiveBtn" style="
                            background: ${link.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'};
                            border: 1px solid ${link.is_active ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'};
                            color: ${link.is_active ? '#f87171' : '#34d399'};
                            padding: 0.5rem 1rem;
                            border-radius: var(--radius-md, 10px);
                            font-size: 0.8rem;
                            font-weight: 700;
                            cursor: pointer;
                            transition: all var(--transition, 0.25s);
                        ">
                            ${link.is_active ? window.cp_translate('Revoke Access') : window.cp_translate('Restore Access')}
                        </button>
                    </div>
                `;

                const copyBtn = bodyContainer.querySelector('#copyCollabLinkBtn') as HTMLButtonElement;
                copyBtn.onclick = async () => {
                    try {
                        await navigator.clipboard.writeText(collabUrl);
                        copyBtn.textContent = window.cp_translate('Copied!');
                        copyBtn.style.color = '#34d399';
                        setTimeout(() => {
                            copyBtn.textContent = window.cp_translate('Copy');
                            copyBtn.style.color = '';
                        }, 2000);
                    } catch (e) {
                        alert(window.cp_translate('Link:') + ' ' + collabUrl);
                    }
                };

                const toggleBtn = bodyContainer.querySelector('#toggleCollabActiveBtn') as HTMLButtonElement;
                toggleBtn.onclick = async () => {
                    toggleBtn.disabled = true;
                    try {
                        const { error: updErr } = await supabase
                            .from('map_collab_links')
                            .update({ is_active: !link.is_active })
                            .eq('id', link.id);
                        
                        if (updErr) throw updErr;
                        link.is_active = !link.is_active;
                        renderCollabState(link);
                    } catch (err) {
                        console.error(err);
                        alert(window.cp_translate('Failed to toggle status:') + ' ' + err.message);
                        toggleBtn.disabled = false;
                    }
                };
            }
        };

        renderCollabState(existing);

    } catch (err) {
        console.error(err);
        bodyContainer.innerHTML = `
            <div style="color:#f87171; text-align:center; padding: 1rem 0; font-size:0.85rem;">
                ❌ ${window.cp_translate('Error loading collab info:')} ${err.message}
            </div>
        `;
    }
}

async function triggerMapDeletion(mapId, card) {
    const confirmMsg = window.cp_translate ? window.cp_translate("🗑️ Are you absolutely sure you want to delete this map forever?\n\nThis action CANNOT be undone.") : "🗑️ Are you absolutely sure you want to delete this map forever?\n\nThis action CANNOT be undone.";
    if (!confirm(confirmMsg)) return;

    try {
        if (mapId.toString().startsWith('local_')) {
            let localMaps = [];
            try {
                localMaps = JSON.parse(localStorage.getItem('compass_local_maps') || '[]');
            } catch(e) {}
            localMaps = localMaps.filter(m => m.id !== mapId);
            localStorage.setItem('compass_local_maps', JSON.stringify(localMaps));
        } else {
            const { error } = await supabase
                .from('maps')
                .delete()
                .eq('id', mapId)
                .eq('user_id', currentUserId); // BUG-11 fix: scope deletion to owner only

            if (error) throw error;
        }

        // Animate & Remove from grid
        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        card.style.transform = 'scale(0.8)';
        card.style.opacity = '0';

        setTimeout(() => {
            card.remove();
            // Update local storage caches to avoid flickering
            allMaps = allMaps.filter(m => m.id !== mapId);
            filteredMaps = filteredMaps.filter(m => m.id !== mapId);
            
            // If container is now empty, trigger empty state reload
            const grid = document.getElementById('mapsGrid');
            if (grid && grid.children.length === 0) {
                applyFilters();
            }
        }, 300);

    } catch (err) {
        console.error("Map deletion error:", err);
        alert((window.cp_translate ? window.cp_translate("Delete operation failed:") : "Delete operation failed:") + " " + (err.message || "Unknown error."));
    }
}


async function toggleMapVisibility(mapId, button) {
    const isCurrentlyPublic = button.getAttribute('data-public') === 'true';
    const nextState = !isCurrentlyPublic;
    
    // Заглушка ожидания
    button.textContent = '...';
    button.disabled = true;

    try {
        const { error } = await supabase
            .from('maps')
            .update({ is_public: nextState })
            .eq('id', mapId);

        if (error) throw error;

        // Обновляем визуальное состояние кнопки
        button.setAttribute('data-public', String(nextState));
        button.className = `visibility-btn ${nextState ? 'pub' : 'priv'}`;
        button.textContent = nextState ? window.cp_translate('🌍 Public') : window.cp_translate('🔒 Private');
        
        // Обновляем локальные данные, чтобы не слетало при рефильтрации
        const idx = allMaps.findIndex(m => m.id === mapId);
        if (idx !== -1) allMaps[idx].is_public = nextState;

    } catch (e) {
        console.error("Failed to flip privacy:", e);
        button.textContent = isCurrentlyPublic ? window.cp_translate('🌍 Public') : window.cp_translate('🔒 Private');
        alert(window.cp_translate("Server could not save privacy update. Try again."));
    } finally {
        button.disabled = false;
    }
}

async function toggleMapLike(mapId, button) {
    if (!currentUserId) {
        alert(window.cp_translate("⚠️ Please log in to like maps!"));
        return;
    }

    const isLiked = button.classList.contains('liked');
    const countSpan = button.querySelector('.like-count');
    const svg = button.querySelector('svg');
    let currentCount = parseInt(countSpan.textContent) || 0;

    button.disabled = true;

    try {
        if (isLiked) {
            // Unlike
            const { error } = await supabase
                .from('map_likes')
                .delete()
                .eq('user_id', currentUserId)
                .eq('map_id', mapId);
            
            if (error) throw error;

            button.classList.remove('liked');
            svg.setAttribute('fill', 'none');
            countSpan.textContent = Math.max(0, currentCount - 1);
        } else {
            // Like
            const { error } = await supabase
                .from('map_likes')
                .insert([{ user_id: currentUserId, map_id: mapId }]);
            
            if (error) {
                if (error.code === '23505') return; // Игнорируем если уже лайкнуто
                throw error;
            }

            button.classList.add('liked');
            svg.setAttribute('fill', '#ff3e5c');
            countSpan.textContent = currentCount + 1;
        }

        // Обновляем локальный кэш, чтобы не пропадало при перерисовке
        const idx = allMaps.findIndex(m => m.id === mapId);
        if (idx !== -1) {
            allMaps[idx].isLikedByUser = !isLiked;
            allMaps[idx].likesCount = parseInt(countSpan.textContent);
        }

    } catch (err) {
        console.error('Error toggling like:', err);
    } finally {
        button.disabled = false;
    }
}

function updateLoadMore() {
    const container = document.getElementById('loadMoreContainer');
    if (!container) return;
    container.innerHTML = '';

    if (displayedCount < filteredMaps.length) {
        const btn = document.createElement('button');
        btn.className = 'load-more-btn';
        btn.textContent = window.cp_translate('Load More');
        btn.onclick = displayNextBatch;
        container.appendChild(btn);
    }
}

function injectPremiumCardStyles() {
    const styleId = 'premium-owner-cards-css';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .premium-card {
            background: rgba(20, 20, 28, 0.45);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 16px;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
            display: flex;
            flex-direction: column;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        
        .premium-card:hover {
            transform: translateY(-4px);
            border-color: rgba(255,255,255,0.15);
            background: rgba(25, 25, 35, 0.6);
            box-shadow: 0 16px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05);
        }

        .card-image-wrapper {
            position: relative;
            aspect-ratio: 1 / 1.1;
            background: radial-gradient(circle at center, #161625 0%, #000000 100%);
            cursor: pointer;
            overflow: hidden;
        }
        
        .card-image-wrapper img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            transition: opacity 0.3s ease;
        }
        .premium-card:hover .card-image-wrapper img { opacity: 0.85; }

        .card-overlay {
            position: absolute; inset: 0; background: rgba(0,0,0,0.4);
            display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.3s; backdrop-filter: blur(3px);
        }
        .card-overlay span {
            background: #fff; color: #000; padding: 0.5rem 1.2rem;
            border-radius: 20px; font-weight: 700; font-size: 0.8rem;
        }
        .card-image-wrapper:hover .card-overlay { opacity: 1; }

        .card-content {
            padding: 1.2rem;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
        }

        .card-meta { flex: 1; overflow: hidden; }
        
        .card-title {
            font-size: 1rem; font-weight: 700; color: #fff;
            margin-bottom: 0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        
        .card-stats { display: flex; align-items: center; gap: 10px; }
        
        .likes-btn {
            font-size: 0.8rem; color: rgba(255,255,255,0.6); font-weight: 600;
            display: flex; align-items: center; gap: 6px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 0.4rem 0.7rem;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .likes-btn:hover {
            background: rgba(255, 62, 92, 0.1);
            border-color: rgba(255, 62, 92, 0.25);
            color: #ff4c6a;
        }
        .likes-btn.liked {
            background: rgba(255, 62, 92, 0.15);
            border-color: rgba(255, 62, 92, 0.3);
            color: #ff4c6a;
        }
        .likes-btn.liked .heart-icon.small {
            fill: #ff3e5c;
            color: #ff3e5c;
        }
        .heart-icon.small { width: 14px; height: 14px; transition: fill 0.2s ease; }

        /* VISIBILITY SWITCHER */
        .owner-controls { flex-shrink: 0; }
        
        .visibility-btn {
            padding: 0.5rem 0.8rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.25s;
            border: 1px solid transparent;
        }
        
        .visibility-btn.pub {
            background: rgba(50, 255, 100, 0.08);
            border-color: rgba(50, 255, 100, 0.15);
            color: #50ff85;
        }
        .visibility-btn.pub:hover {
            background: rgba(50, 255, 100, 0.15);
            border-color: rgba(50, 255, 100, 0.4);
        }

        .visibility-btn.priv {
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.08);
            color: rgba(255,255,255,0.6);
        }
        .visibility-btn.priv:hover {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255,255,255,0.2);
            color: #fff;
        }
        
        .visibility-btn:disabled { opacity: 0.5; cursor: wait; }

        /* QUICK DELETE BUTTON */
        .delete-card-btn {
            background: rgba(255, 107, 107, 0.06);
            border: 1px solid rgba(255, 107, 107, 0.15);
            color: rgba(255, 107, 107, 0.7);
            width: 32px;
            height: 32px;
            border-radius: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        .delete-card-btn:hover {
            background: rgba(255, 107, 107, 0.15);
            border-color: rgba(255, 107, 107, 0.4);
            color: #ff4c4c;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(255, 107, 107, 0.15);
        }

        .collab-btn:hover {
            background: rgba(139, 92, 246, 0.18);
            border-color: rgba(139, 92, 246, 0.5);
            color: #d8b4fe;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
        }

        .delete-card-btn:active {
            transform: translateY(0);
        }

        .delete-card-btn svg {
            width: 15px;
            height: 15px;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
}

async function openGlobalCollabModal() {
    if (!currentUserId) {
        alert(window.cp_translate('Please sign in to create a collab map.'));
        return;
    }

    let modal = document.getElementById('globalCollabModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'globalCollabModal';
        document.body.appendChild(modal);
    }
    
    requestAnimationFrame(() => {
        if (modal) modal.style.opacity = '1';
    });

    modal.innerHTML = `
        <div class="collab-modal-card">
            <button class="collab-modal-close">&times;</button>
            <h3>
                🌍 ${window.cp_translate('Create Map Online')}
            </h3>
            <p>
                ${window.cp_translate('Choose your map settings. A new blank map will be created, and you will get a link to invite your friend!')}
            </p>
            <div id="globalCollabModalBody" style="display:flex; flex-direction:column; gap:1rem;">
                <div>
                    <label>GAMEMODE</label>
                    <select id="gcGamemode">
                        <option value="Showdown">Showdown</option>
                        <option value="Gem_Grab">Gem Grab</option>
                        <option value="Brawl_Ball">Brawl Ball</option>
                        <option value="Bounty">Bounty</option>
                        <option value="Heist">Heist</option>
                    </select>
                </div>
                <div>
                    <label>ENVIRONMENT</label>
                    <select id="gcEnvironment">
                        <option value="Desert">Desert</option>
                        <option value="Grassy_Field">Grassy Field</option>
                        <option value="Mine">Mine</option>
                        <option value="Retropolis">Retropolis</option>
                        <option value="Snowtel">Snowtel</option>
                    </select>
                </div>
                <div>
                    <label>SIZE</label>
                    <select id="gcSize">
                        <option value="regular">Regular</option>
                        <option value="showdown">Showdown</option>
                    </select>
                </div>
                
                <button id="gcCreateBtn">
                    ✨ ${window.cp_translate('Create & Get Link')}
                </button>
            </div>
        </div>
    `;

    const cardEl = modal.querySelector('.collab-modal-card') as HTMLElement;
    requestAnimationFrame(() => {
        if (cardEl) cardEl.style.transform = 'scale(1)';
    });

    const closeBtn = modal.querySelector('.collab-modal-close') as HTMLElement;
    const closeModal = () => {
        if (modal) {
            modal.style.opacity = '0';
            if (cardEl) cardEl.style.transform = 'scale(0.9)';
            setTimeout(() => modal?.remove(), 300);
        }
    };
    closeBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    const createBtn = modal.querySelector('#gcCreateBtn') as HTMLButtonElement;
    createBtn.onclick = async () => {
        createBtn.disabled = true;
        createBtn.textContent = '...';
        
        const gamemode = (document.getElementById('gcGamemode') as HTMLSelectElement).value;
        const environment = (document.getElementById('gcEnvironment') as HTMLSelectElement).value;
        const size = (document.getElementById('gcSize') as HTMLSelectElement).value;
        
        try {
            const { data: userObj } = await supabase.auth.getUser();
            const { data: newMap, error: mapErr } = await supabase.from('maps').insert([{
                user_id: userObj.user.id,
                name: 'Online Collab Map',
                gamemode: gamemode,
                environment: environment,
                size: size,
                map_data: [],
                is_public: false
            }]).select('*').single();
            
            if (mapErr) throw mapErr;
            
            const { data: newLink, error: insErr } = await supabase
                .from('map_collab_links')
                .insert([{ map_id: newMap.id, owner_id: currentUserId, is_active: true, mode: 'realtime' }])
                .select('*')
                .single();
            
            if (insErr) throw insErr;
            
            const collabUrl = `${window.location.origin}${window.location.pathname.replace('dashboard.html', 'editor.html')}?collab=${newLink.id}`;
            const bodyContainer = document.getElementById('globalCollabModalBody');
            if (bodyContainer) {
                bodyContainer.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:0.5rem;">
                        <label>${window.cp_translate('COLLABORATION LINK')}</label>
                        <div style="display:flex; gap:8px;">
                            <input type="text" readonly value="${collabUrl}">
                            <button id="copyCollabLinkBtn">
                                ${window.cp_translate('Copy')}
                            </button>
                        </div>
                    </div>
                    <div style="margin-top:1.5rem; text-align:center;">
                        <a href="${collabUrl}" class="collab-link-a">${window.cp_translate('Join Editor Now ->')}</a>
                    </div>
                `;
                
                const copyBtn = bodyContainer.querySelector('#copyCollabLinkBtn') as HTMLButtonElement;
                copyBtn.onclick = async () => {
                    try {
                        await navigator.clipboard.writeText(collabUrl);
                        copyBtn.textContent = window.cp_translate('Copied!');
                        copyBtn.style.color = '#34d399';
                        setTimeout(() => {
                            copyBtn.textContent = window.cp_translate('Copy');
                            copyBtn.style.color = '';
                        }, 2000);
                    } catch (e) {
                        alert(collabUrl);
                    }
                };
            }
            
            loadMyMaps();

        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
            createBtn.disabled = false;
            createBtn.textContent = window.cp_translate('Create & Get Link');
        }
    };
}

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('mapSearch')?.addEventListener('input', applyFilters);
    ['gamemodeFilter', 'environmentFilter', 'sizeFilter'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', applyFilters);
    });

    document.getElementById('globalCollabBtn')?.addEventListener('click', () => {
        openGlobalCollabModal();
    });

    loadMyMaps();
});
