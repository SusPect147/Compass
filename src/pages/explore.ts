// @ts-nocheck
import { drawStaticMapPreview } from '../utils/canvas-drawer.js';
import { supabase } from '../core/supabase-client.js';

let allMaps = [];
let filteredMaps = [];
let displayedCount = 0;
const mapsPerPage = 16;
let currentUserId = null;
let likedMapIds = new Set(); // Храним ID карт, которые лайкнул ТЕКУЩИЙ пользователь

// Подтягиваем кастомные стили для ВАУ-карточек
injectPremiumCardStyles();

async function initializeGallery() {
    try {
        const loadingMsg = document.getElementById('mapsGrid');
        if (loadingMsg) loadingMsg.innerHTML = `<div style="padding: 2rem; text-align:center; opacity:0.7;">${window.cp_translate('Connecting to database...')}</div>`;

        // 1. Получаем текущего пользователя для учета лайков
        const { data: { session } } = await supabase.auth.getSession();
        currentUserId = session?.user?.id || null;

        // 2. Если пользователь вошел, получаем список карт, которые он УЖЕ лайкнул
        if (currentUserId) {
            const { data: myLikes } = await supabase
                .from('map_likes')
                .select('map_id')
                .eq('user_id', currentUserId);
            
            if (myLikes) {
                myLikes.forEach(l => likedMapIds.add(l.map_id));
            }
        }

        // 3. Загружаем карты (фильтруем по is_public=true на стороне сервера для экономии)
        // Так же вытягиваем количество лайков через агрегат
        const { data, error } = await supabase
            .from('maps')
            .select('*, map_likes(count)')
            .eq('is_public', true) // ЗАЩИТА: В галерею попадают ТОЛЬКО публичные
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Форматируем данные, чтобы likes был числом
        allMaps = data.map(m => ({
            ...m,
            likesCount: m.map_likes?.[0]?.count || 0
        })) || [];

        applyFilters();
        
    } catch (err) {
        console.error('Error loading gallery:', err);
        showEmptyState(window.cp_translate('Error connecting to secure database.'));
    }
}

function showEmptyState(msg = window.cp_translate('No public maps found.')) {
    const container = document.getElementById('mapsGrid');
    if (!container) return;
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 5rem 1rem; opacity:0.6;">
            <div style="font-size: 2rem; margin-bottom: 1rem;">🏜️</div>
            <p style="font-size:1rem;">${msg}</p>
        </div>`;
}

function applyFilters() {
    const searchTerm = document.getElementById('mapSearch')?.value.toLowerCase() || '';
    const gamemodeFilter = document.getElementById('gamemodeFilter')?.value || '';
    const environmentFilter = document.getElementById('environmentFilter')?.value || '';
    const sizeFilter = document.getElementById('sizeFilter')?.value || '';
    const sortFilter = document.getElementById('sortFilter')?.value || '';

    filteredMaps = allMaps.filter(map => {
        if (searchTerm && !(map.name || 'unnamed').toLowerCase().includes(searchTerm)) return false;
        if (gamemodeFilter && map.gamemode !== gamemodeFilter) return false;
        if (environmentFilter && map.environment !== environmentFilter) return false;
        if (sizeFilter && map.size !== sizeFilter) return false;
        return true;
    });

    // Configure dynamic client-side sorting
    if (sortFilter === 'most_votes') {
        // Sort descending by likes count
        filteredMaps.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    } else {
        // Default chronological sorting (newest first)
        filteredMaps.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    displayedCount = 0;
    const container = document.getElementById('mapsGrid');
    if (container) container.innerHTML = '';

    if (filteredMaps.length === 0) {
        showEmptyState(window.cp_translate('No matching maps found.'));
    } else {
        displayNextBatch();
    }
}

async function displayNextBatch() {
    const container = document.getElementById('mapsGrid');
    if (!container) return;

    const batch = filteredMaps.slice(displayedCount, displayedCount + mapsPerPage);
    displayedCount += batch.length;

    const queue = [];

    // 1. RENDER ALL CARDS INSTANTLY
    batch.forEach(map => {
        // Use the pre-rendered thumbnail if available, otherwise use a transparent spacer
        const initialImage = map.thumbnail_url || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        const card = createPremiumCard(map, initialImage);
        container.appendChild(card);
        
        const img = card.querySelector('.card-image-wrapper img');
        if (img) {
            if (map.thumbnail_url) {
                // If thumbnail exists, let the browser load it natively
                img.style.opacity = '0';
                img.onload = () => img.style.opacity = '1';
            } else {
                img.style.opacity = '0'; // Keep completely invisible until render completes
                queue.push({ map, img });
            }
        }
    });

    updateLoadMoreButton();

    // 2. PROCESS LEGACY MAP RENDERINGS SEQUENTIALLY: Prevents DOM/Canvas thread race conditions
    for (const task of queue) {
        try {
            const pngDataUrl = await drawStaticMapPreview(
                task.map.map_data, 
                task.map.size, 
                task.map.gamemode, 
                task.map.environment,
                task.map.theme_options
            );
            task.img.src = pngDataUrl;
            task.img.style.opacity = '1';
        } catch (error) {
            console.warn("[Compass] Skipping dynamic card visual render:", error);
            task.img.style.opacity = '1';
        }
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

function createPremiumCard(map, image) {
    const isLiked = likedMapIds.has(map.id);
    
    const card = document.createElement('div');
    card.classList.add('premium-card');
    
    const safeName = escapeHTML(map.name || 'Untitled');
    const safeAuthor = escapeHTML(map.author_name || 'Anon');

    card.innerHTML = `
        <div class="card-image-wrapper" onclick="window.location.href = './view.html?id=${encodeURIComponent(map.id)}'">
            <img src="${image}" alt="Map" loading="lazy">
            <div class="card-overlay"><span>${window.cp_translate('View Map')}</span></div>
        </div>
        <div class="card-content">
            <div class="card-meta">
                <h3 class="card-title">${safeName}</h3>
                <p class="card-author">${window.cp_translate('by')} ${safeAuthor}</p>
            </div>
            <div class="card-actions">
                <button class="like-btn ${isLiked ? 'liked' : ''}" data-id="${map.id}">
                    <svg class="heart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"></path>
                    </svg>
                    <span class="like-count">${map.likesCount}</span>
                </button>
            </div>
        </div>
    `;

    // Слушатель для кнопки лайка
    const likeBtn = card.querySelector('.like-btn');
    likeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLike(map.id, likeBtn);
    });

    return card;
}

async function toggleLike(mapId, buttonElement) {
    if (!currentUserId) {
        alert(window.cp_translate("⚠️ Please Sign in with Discord to like maps!"));
        return;
    }

    const countSpan = buttonElement.querySelector('.like-count');
    let currentCount = parseInt(countSpan.textContent);
    const isCurrentlyLiked = buttonElement.classList.contains('liked');

    try {
        if (isCurrentlyLiked) {
            // Убираем лайк (Удаляем строку из map_likes)
            const { error } = await supabase
                .from('map_likes')
                .delete()
                .eq('user_id', currentUserId)
                .eq('map_id', mapId);
            
            if (error) throw error;

            buttonElement.classList.remove('liked');
            likedMapIds.delete(mapId);
            countSpan.textContent = Math.max(0, currentCount - 1);
        } else {
            // Ставим лайк (Добавляем строку)
            const { error } = await supabase
                .from('map_likes')
                .insert([{ user_id: currentUserId, map_id: mapId }]);
            
            if (error) {
                // Если уже лайкнуто (заглушка базы), просто игнорируем ошибку
                if (error.code === '23505') return; 
                throw error;
            }

            buttonElement.classList.add('liked');
            likedMapIds.add(mapId);
            countSpan.textContent = currentCount + 1;
            
            // Маленькая анимация
            buttonElement.style.transform = 'scale(1.2)';
            setTimeout(() => buttonElement.style.transform = '', 150);
        }
    } catch (error) {
        console.error("Error toggling like:", error);
    }
}

function updateLoadMoreButton() {
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    if (!loadMoreContainer) return;
    loadMoreContainer.innerHTML = '';

    if (displayedCount < filteredMaps.length) {
        const btn = document.createElement('button');
        btn.textContent = window.cp_translate('Load More');
        btn.classList.add('load-more-btn');
        btn.onclick = displayNextBatch;
        loadMoreContainer.appendChild(btn);
    }
}

function injectPremiumCardStyles() {
    const styleId = 'premium-cards-css';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .premium-card {
            background: rgba(25, 25, 35, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 16px;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
            backdrop-filter: blur(10px);
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
        }
        
        .premium-card:hover {
            transform: translateY(-6px);
            border-color: rgba(255, 255, 255, 0.12);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 255, 255, 0.02);
            background: rgba(30, 30, 45, 0.55);
        }

        .card-image-wrapper {
            position: relative;
            width: 100%;
            aspect-ratio: 1 / 1.2;
            background: radial-gradient(circle at center, #161625 0%, #050508 100%);
            cursor: pointer;
            overflow: hidden;
        }
        
        .card-image-wrapper img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            transition: opacity 0.3s ease;
        }
        
        .premium-card:hover .card-image-wrapper img {
            opacity: 0.85;
        }

        .card-overlay {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s;
            backdrop-filter: blur(2px);
        }
        
        .card-overlay span {
            background: rgba(255,255,255,0.9);
            color: #000;
            padding: 0.5rem 1.2rem;
            border-radius: 20px;
            font-weight: 600;
            font-size: 0.8rem;
            transform: translateY(10px);
            transition: transform 0.3s;
        }
        
        .card-image-wrapper:hover .card-overlay { opacity: 1; }
        .card-image-wrapper:hover .card-overlay span { transform: translateY(0); }

        .card-content {
            padding: 1.1rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
        }

        .card-meta {
            flex: 1;
            min-width: 0;
        }

        .card-title {
            font-size: 0.95rem;
            font-weight: 700;
            color: #fff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 0.2rem;
        }

        .card-author {
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.4);
            font-weight: 500;
        }

        .card-actions {
            flex-shrink: 0;
        }

        /* PREMIUM LIKE BUTTON */
        .like-btn {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.08);
            padding: 0.4rem 0.7rem;
            border-radius: 10px;
            color: rgba(255,255,255,0.6);
            display: flex;
            align-items: center;
            gap: 0.4rem;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        .like-btn:hover {
            background: rgba(255, 50, 80, 0.1);
            border-color: rgba(255, 50, 80, 0.3);
            color: #ff3250;
        }

        .heart-icon {
            width: 16px;
            height: 16px;
            stroke-width: 2;
            transition: fill 0.2s, transform 0.2s;
        }

        .like-count {
            font-size: 0.85rem;
            font-weight: 600;
        }

        .like-btn.liked {
            background: rgba(255, 50, 80, 0.15);
            border-color: rgba(255, 50, 80, 0.4);
            color: #ff3e5c;
        }

        .like-btn.liked .heart-icon {
            fill: #ff3e5c;
            stroke: #ff3e5c;
            animation: pulse 0.3s ease;
        }

        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.3); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded', () => {
    const filters = ['gamemodeFilter', 'environmentFilter', 'sizeFilter', 'sortFilter'];
    filters.forEach(id => document.getElementById(id)?.addEventListener('change', applyFilters));
    document.getElementById('mapSearch')?.addEventListener('input', applyFilters);

    initializeGallery();
});
