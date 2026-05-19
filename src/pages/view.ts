// @ts-nocheck
import { drawStaticMapPreview } from '../utils/canvas-drawer.js';
import { supabase } from '../core/supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mapId = urlParams.get('id');

    if (!mapId) return showError('Map Not Found');

    const mapCanvas = document.getElementById('mapCanvas');
    const mapInfo = document.getElementById('mapInfo');

    document.getElementById('openMapBtn').onclick = () => {
        window.location.href = `./editor.html?id=${mapId}`;
    };

    try {
        // Get current user session for Liking
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id || null;

        // Loading map from Supabase, including likes aggregate
        const { data, error } = await supabase
            .from('maps')
            .select('*, map_likes(count)')
            .eq('id', mapId)
            .single();

        if (error || !data) {
            throw new Error(error?.message || 'Map not found in database');
        }

        // 1. Загружаем общее кол-во лайков
        const totalLikes = data.map_likes?.[0]?.count || 0;
        const likeCountSpan = document.getElementById('pageLikeCount');
        if (likeCountSpan) likeCountSpan.textContent = totalLikes;

        // 2. Проверяем, лайкнул ли этот пользователь уже
        const likeBtn = document.getElementById('pageLikeBtn');
        let isLikedByUser = false;

        if (currentUserId && likeBtn) {
            const { data: hasLiked } = await supabase
                .from('map_likes')
                .select('id')
                .eq('user_id', currentUserId)
                .eq('map_id', mapId)
                .maybeSingle();
            
            if (hasLiked) {
                isLikedByUser = true;
                likeBtn.style.backgroundColor = 'rgba(255, 62, 92, 0.25)';
                likeBtn.querySelector('svg').style.fill = '#ff3e5c';
            }
        }

        // Populate Details
        document.getElementById('mapTitle').textContent = data.name;
        document.getElementById('mapGamemode').textContent = format(data.gamemode);
        const envDisplayEl = document.getElementById('mapEnvironment');
        if (envDisplayEl) {
            if (typeof window.getThemeDisplayText === 'function') {
                envDisplayEl.textContent = await window.getThemeDisplayText(data.environment);
            } else {
                envDisplayEl.textContent = format(data.environment);
            }
        }
        document.getElementById('mapAuthor').textContent = 'By ' + (data.author_name || 'Anonymous');

        const shareBtn = document.getElementById('shareMapBtn');

        // ЗАЩИТА: Если карта приватная, прячем кнопку Поделиться даже от автора
        if (data.is_public === false && shareBtn) {
            shareBtn.style.display = 'none';
        }

        // ACTIVATOR: Show the Edit button if the current logged-in viewer is the author!
        const editBtn = document.getElementById('editMapBtn');
        if (editBtn && currentUserId && currentUserId === data.user_id) {
            editBtn.style.display = 'inline-flex';
            editBtn.onclick = () => {
                window.location.href = `./editor.html?id=${mapId}&edit=true`;
            };
        }

        // ACTIVATOR: Show the Collab button if the current logged-in viewer is the author!
        const collabMapBtn = document.getElementById('collabMapBtn');
        if (collabMapBtn && currentUserId && currentUserId === data.user_id) {
            collabMapBtn.style.display = 'inline-flex';
            collabMapBtn.onclick = async () => {
                await openCollabModalFromView(data, currentUserId);
            };
        }

        async function openCollabModalFromView(map, currentUserId) {
            let modal = document.getElementById('collabModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'collabModal';
                modal.style.cssText = `
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                `;
                document.body.appendChild(modal);
            }
            
            requestAnimationFrame(() => {
                if (modal) modal.style.opacity = '1';
            });

            modal.innerHTML = `
                <div class="collab-modal-card" style="
                    background: rgba(20, 20, 28, 0.95);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    padding: 2rem;
                    width: 90%;
                    max-width: 500px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                    transform: scale(0.9);
                    transition: transform 0.3s ease;
                    position: relative;
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                ">
                    <button class="collab-modal-close" style="
                        position: absolute;
                        top: 16px;
                        right: 16px;
                        background: none;
                        border: none;
                        color: rgba(255,255,255,0.4);
                        font-size: 1.5rem;
                        cursor: pointer;
                        transition: color 0.2s;
                    ">&times;</button>
                    <h3 style="margin-top:0; color:#fff; font-size:1.3rem; font-weight:700; margin-bottom: 0.5rem; display:flex; align-items:center; gap:10px; text-align:left;">
                        👥 ${window.cp_translate('Work on Map with a Friend')}
                    </h3>
                    <p style="color: rgba(255,255,255,0.6); font-size:0.88rem; margin-bottom:1.5rem; text-align:left;">
                        ${window.cp_translate('Generate a secure, unique collaboration link. Anyone with this link can edit a copy of your map and submit their suggestions to you.')}
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
                            <button id="generateCollabLinkBtn" class="collab-action-btn" style="
                                background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
                                color: #fff;
                                border: none;
                                padding: 0.8rem 1.5rem;
                                border-radius: 12px;
                                font-weight: 700;
                                cursor: pointer;
                                transition: all 0.25s;
                                width: 100%;
                            ">
                                ⚡ ${window.cp_translate('Generate Collaboration Link')}
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
                                genBtn.textContent = window.cp_translate('Generate Collaboration Link');
                            }
                        };
                    } else {
                        const collabUrl = `${window.location.origin}${window.location.pathname.replace('view.html', 'editor.html')}?collab=${link.id}`;
                        bodyContainer.innerHTML = `
                            <div style="display:flex; flex-direction:column; gap:0.5rem; text-align:left;">
                                <label style="color:rgba(255,255,255,0.4); font-size:0.75rem; font-weight:700;">${window.cp_translate('COLLABORATION LINK')}</label>
                                <div style="display:flex; gap:8px;">
                                    <input type="text" readonly value="${collabUrl}" style="
                                        flex: 1;
                                        background: rgba(0,0,0,0.3);
                                        border: 1px solid rgba(255,255,255,0.1);
                                        border-radius: 10px;
                                        padding: 0.6rem;
                                        color: #fff;
                                        font-size: 0.8rem;
                                        outline: none;
                                    ">
                                    <button id="copyCollabLinkBtn" style="
                                        background: rgba(255,255,255,0.08);
                                        border: 1px solid rgba(255,255,255,0.1);
                                        border-radius: 10px;
                                        color: #fff;
                                        font-size:0.8rem;
                                        font-weight:700;
                                        padding: 0 1rem;
                                        cursor: pointer;
                                        transition: all 0.2s;
                                    ">
                                        ${window.cp_translate('Copy')}
                                    </button>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:1rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.06); text-align:left;">
                                <div style="display:flex; flex-direction:column;">
                                    <span style="font-weight:700; color:#fff; font-size:0.85rem;">
                                        ${link.is_active ? `🟢 ${window.cp_translate('Active')}` : `🔴 ${window.cp_translate('Revoked')}`}
                                    </span>
                                    <span style="color:rgba(255,255,255,0.4); font-size:0.7rem;">
                                        ${link.is_active ? window.cp_translate('Your friend can use this link to edit.') : window.cp_translate('Access blocked until restored.')}
                                    </span>
                                </div>
                                <button id="toggleCollabActiveBtn" style="
                                    background: ${link.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'};
                                    border: 1px solid ${link.is_active ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'};
                                    color: ${link.is_active ? '#f87171' : '#34d399'};
                                    padding: 0.5rem 1rem;
                                    border-radius: 10px;
                                    font-size: 0.8rem;
                                    font-weight: 700;
                                    cursor: pointer;
                                    transition: all 0.25s;
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
                                    copyBtn.style.color = '#fff';
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
        
        // ACTIVATOR: Show the Delete button if the current logged-in viewer is the author!
        const deleteBtn = document.getElementById('deleteMapBtn');
        if (deleteBtn && currentUserId && currentUserId === data.user_id) {
            deleteBtn.style.display = 'inline-flex';
            deleteBtn.onclick = async () => {
                const confirmMsg = "🚨 Are you SURE you want to PERMANENTLY delete this map? This cannot be undone!";
                if (confirm(confirmMsg)) {
                    // Double confirm warning
                    const finalWarning = "⚠️ FINAL WARNING: Click OK to delete this map FOREVER from the server.";
                    if (confirm(finalWarning)) {
                        try {
                            deleteBtn.disabled = true;
                            // Delete any existing likes on this map first to maintain relational integrity
                            await supabase.from('map_likes').delete().eq('map_id', mapId);

                            // Now delete the map
                            const { error } = await supabase
                                .from('maps')
                                .delete()
                                .eq('id', mapId)
                                .eq('user_id', currentUserId);
                                
                            if (error) throw error;
                            
                            alert(window.cp_translate("✅ Map deleted successfully!"));
                            window.location.href = "./dashboard.html";
                        } catch (deleteErr) {
                            console.error("Delete failed:", deleteErr);
                            alert(window.cp_translate("❌ Failed to delete map:") + " " + deleteErr.message);
                            deleteBtn.disabled = false;
                        }
                    }
                }
            };
        }

        // Generate Image (Larger rendering for quality)
        const pngDataUrl = await drawStaticMapPreview(data.map_data, data.size, data.gamemode, data.environment, data.theme_options);
        
        // Handle rendering
        const mapImg = document.getElementById('mapImage');
        const mapDisplay = document.querySelector('.map-display');
        
        let scale = 1;
        let posX = 0;
        let posY = 0;

        function updateTransform() {
            mapImg.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
        }

        if (mapImg) {
            mapImg.src = pngDataUrl;
            
            // НАЧАЛЬНЫЙ МАСШТАБ: Высота = Высоте контейнера
            mapImg.onload = () => {
                mapImg.style.height = '100%'; 
                mapImg.style.transformOrigin = 'center center';
                updateTransform();
            };
        }

        // === СВОБОДНОЕ ПЕРЕМЕЩЕНИЕ БЕЗ ОГРАНИЧЕНИЙ (ЧЕРЕЗ TRANSFORMS) ===
        if (mapDisplay && mapImg) {
            let isDragging = false;
            let lastX, lastY;

            // Отключаем стандартное меню ПКМ
            mapDisplay.addEventListener('contextmenu', (e) => e.preventDefault());

            mapDisplay.addEventListener('mousedown', (e) => {
                if (e.button !== 2) return; // Только ПКМ
                isDragging = true;
                mapDisplay.style.cursor = 'grabbing';
                
                lastX = e.clientX;
                lastY = e.clientY;
                
                // Отключаем анимацию при перетаскивании для отзывчивости
                mapImg.style.transition = 'none'; 
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                
                const deltaX = e.clientX - lastX;
                const deltaY = e.clientY - lastY;
                
                posX += deltaX;
                posY += deltaY;
                
                lastX = e.clientX;
                lastY = e.clientY;
                
                updateTransform();
            });

            const stopDrag = () => {
                if (!isDragging) return;
                isDragging = false;
                mapDisplay.style.cursor = 'grab';
                // Возвращаем легкую анимацию для зума
                mapImg.style.transition = 'transform 0.1s ease-out';
            };
            document.addEventListener('mouseup', stopDrag);
            // При уходе мыши за окно браузера
            window.addEventListener('blur', stopDrag);

            // === МАСШТАБИРОВАНИЕ КОЛЕСИКОМ ===
            mapDisplay.addEventListener('wheel', (e) => {
                e.preventDefault();
                const zoomIntensity = 0.1;
                if (e.deltaY < 0) {
                    scale += zoomIntensity; // Увеличение
                } else {
                    scale = Math.max(0.2, scale - zoomIntensity); // Уменьшение (не меньше 0.2)
                }
                mapImg.style.transition = 'transform 0.15s ease-out';
                updateTransform();
            }, { passive: false });
        }

        // === ЛОГИКА КНОПКИ ЛАЙКА ===
        if (likeBtn) {
            likeBtn.onclick = async () => {
                if (!currentUserId) {
                    alert(window.cp_translate("⚠️ Please log in with Discord to like maps!"));
                    return;
                }
                likeBtn.disabled = true;
                try {
                    if (isLikedByUser) {
                        await supabase.from('map_likes').delete().eq('user_id', currentUserId).eq('map_id', mapId);
                        likeBtn.style.backgroundColor = 'rgba(255, 62, 92, 0.1)';
                        likeBtn.querySelector('svg').style.fill = 'none';
                        likeCountSpan.textContent = Math.max(0, parseInt(likeCountSpan.textContent) - 1);
                        isLikedByUser = false;
                    } else {
                        await supabase.from('map_likes').insert([{ user_id: currentUserId, map_id: mapId }]);
                        likeBtn.style.backgroundColor = 'rgba(255, 62, 92, 0.25)';
                        likeBtn.querySelector('svg').style.fill = '#ff3e5c';
                        likeCountSpan.textContent = parseInt(likeCountSpan.textContent) + 1;
                        isLikedByUser = true;
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    likeBtn.disabled = false;
                }
            };
        }

        // Share Button
        if (shareBtn) {
            shareBtn.onclick = async () => {
                try {
                    await navigator.clipboard.writeText(window.location.href);
                    const origText = shareBtn.innerHTML;
                    shareBtn.innerHTML = '✅ Copied!';
                    shareBtn.style.color = '#4ade80';
                    setTimeout(() => {
                        shareBtn.innerHTML = origText;
                        shareBtn.style.color = '';
                    }, 2000);
                } catch (e) {
                    alert(window.cp_translate('Link:') + ' ' + window.location.href);
                }
            };
        }

        // Download Button
        const downloadBtn = document.getElementById('downloadMapBtn');
        if (downloadBtn) {
            downloadBtn.onclick = (e) => {
                e.preventDefault();
                const link = document.createElement('a');
                link.download = `${data.name.replace(/\s+/g, '_') || 'map'}.png`;
                link.href = pngDataUrl;
                link.click();
            };
        }

        // ==========================================
        // 🌟 ADMIN & COMMENTS INTEGRATION
        // ==========================================
        const ADMIN_UUID = 'cc1e4139-e600-45e8-88f0-922e0fb69998'; // Secure admin ID
        let isAdmin = false;

        if (session && session.user) {
            if (session.user.id === ADMIN_UUID) {
                isAdmin = true;
            }
        }

        // --- 2. Comments Loading & Rendering ---
        const commentsList = document.getElementById('commentsList');
        const replyToIndicator = document.getElementById('replyToIndicator');
        const replyAuthorName = document.getElementById('replyAuthorName');
        const cancelReplyBtn = document.getElementById('cancelReplyBtn');

        let allComments = [];
        let currentCommentSort = 'newest'; // default to newest
        let replyToId = null;

        async function loadComments() {
            try {
                const { data: comments, error } = await supabase
                    .from('map_comments')
                    .select('*, map_comment_votes(*)')
                    .eq('map_id', mapId);

                if (error) throw error;
                allComments = comments || [];
                sortAndRenderComments();
            } catch (err) {
                console.error("Failed to load comments:", err);
                commentsList.innerHTML = `<p style="color:#ff6b6b; font-size:0.85rem;">Error loading comments.</p>`;
            }
        }

        function sortAndRenderComments() {
            // 1. Split into roots and children
            const roots = [];
            const childrenByParent = {};

            allComments.forEach(c => {
                if (c.parent_id) {
                    if (!childrenByParent[c.parent_id]) {
                        childrenByParent[c.parent_id] = [];
                    }
                    childrenByParent[c.parent_id].push(c);
                } else {
                    roots.push(c);
                }
            });

            // 2. Sort root comments based on active filter
            if (currentCommentSort === 'newest') {
                roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            } else if (currentCommentSort === 'likes') {
                roots.sort((a, b) => {
                    const aLikes = (a.map_comment_votes || []).filter(v => v.vote_type === 'like').length;
                    const bLikes = (b.map_comment_votes || []).filter(v => v.vote_type === 'like').length;
                    if (bLikes !== aLikes) return bLikes - aLikes;
                    return new Date(b.created_at) - new Date(a.created_at);
                });
            }

            // 3. Sort nested children chronologically (oldest reply first)
            Object.keys(childrenByParent).forEach(pId => {
                childrenByParent[pId].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            });

            renderCommentsTree(roots, childrenByParent);
        }

        // Bind sorting tabs
        const commentSortControls = document.getElementById('commentSortControls');
        if (commentSortControls) {
            const tabs = commentSortControls.querySelectorAll('.sort-tab');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    currentCommentSort = tab.getAttribute('data-sort');
                    sortAndRenderComments();
                });
            });
        }

        // Handle reply cancellation
        if (cancelReplyBtn) {
            cancelReplyBtn.onclick = () => {
                replyToId = null;
                replyToIndicator.style.display = 'none';
            };
        }

        function escapeHTML(text) {
            const div = document.createElement('div');
            div.innerText = text;
            return div.innerHTML;
        }

        function createCommentCardDOM(c, isReply = false) {
            const card = document.createElement('div');
            card.className = 'comment-card';
            
            if (isReply) {
                card.style.marginLeft = '2rem';
                card.style.borderLeft = '2px solid rgba(255,255,255,0.08)';
                card.style.paddingLeft = '1rem';
                card.style.background = 'rgba(255, 255, 255, 0.01)';
                card.style.marginTop = '0.2rem';
            }

            const commentDate = new Date(c.created_at).toLocaleString();
            const isCommentAdmin = c.user_id === ADMIN_UUID || c.author_name === 'hammer147' || c.author_name?.includes('hammer147');

            // Compute voting aggregates
            const votes = c.map_comment_votes || [];
            const likeCount = votes.filter(v => v.vote_type === 'like').length;
            const dislikeCount = votes.filter(v => v.vote_type === 'dislike').length;

            const userVote = votes.find(v => v.user_id === currentUserId);
            const isLiked = userVote?.vote_type === 'like';
            const isDisliked = userVote?.vote_type === 'dislike';

            card.innerHTML = `
                <div class="comment-header">
                    <div style="display: flex; flex-direction: column;">
                        <span class="comment-user ${isCommentAdmin ? 'admin' : ''}">${escapeHTML(c.author_name || 'Anonymous')}</span>
                        <span class="comment-date">${commentDate}</span>
                    </div>
                    <button class="delete-comment-btn" style="display: ${isAdmin ? 'block' : 'none'}" title="Delete Comment">Delete</button>
                </div>
                <div class="comment-content">${escapeHTML(c.content)}</div>
                
                <!-- Comment Footer with Voting & Reply -->
                <div class="comment-footer" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                    <div class="comment-voting-group">
                        <button class="comment-vote-btn like ${isLiked ? 'active' : ''}" data-commentid="${c.id}" data-type="like">
                            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                            <span class="count">${likeCount}</span>
                        </button>
                        <button class="comment-vote-btn dislike ${isDisliked ? 'active' : ''}" data-commentid="${c.id}" data-type="dislike">
                            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>
                            <span class="count">${dislikeCount}</span>
                        </button>
                    </div>
                    
                    <!-- Only Root Comments Can Receive Threaded Replies to Avoid Infinite Nesting Depth -->
                    ${!isReply ? `
                    <button class="comment-reply-btn" data-commentid="${c.id}" data-author="${escapeHTML(c.author_name || 'Anonymous')}" style="background:none; border:none; color:rgba(255,255,255,0.45); font-size:0.78rem; font-weight:650; cursor:pointer; display:flex; align-items:center; gap:4px; padding:4px 8px; border-radius:6px; transition:all 0.2s;">
                        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        Reply
                    </button>` : ''}
                </div>
            `;

            // Add hover effect for reply button
            const replyBtn = card.querySelector('.comment-reply-btn');
            if (replyBtn) {
                replyBtn.onmouseover = () => {
                    replyBtn.style.color = 'rgba(255,255,255,0.9)';
                    replyBtn.style.background = 'rgba(255,255,255,0.05)';
                };
                replyBtn.onmouseout = () => {
                    replyBtn.style.color = 'rgba(255,255,255,0.45)';
                    replyBtn.style.background = 'none';
                };
                replyBtn.addEventListener('click', () => {
                    replyToId = c.id;
                    if (replyAuthorName && replyToIndicator) {
                        replyAuthorName.textContent = c.author_name || 'Anonymous';
                        replyToIndicator.style.display = 'flex';
                        
                        // Scroll & Focus input
                        const inputField = document.getElementById('commentInput');
                        if (inputField) {
                            inputField.focus();
                            inputField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }
                });
            }

            // Delete binding
            const delBtn = card.querySelector('.delete-comment-btn');
            if (delBtn) {
                delBtn.addEventListener('click', () => handleDeleteComment(c.id));
            }

            // Vote bindings
            const voteBtns = card.querySelectorAll('.comment-vote-btn');
            voteBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const commId = btn.getAttribute('data-commentid');
                    const type = btn.getAttribute('data-type');
                    handleVoteComment(commId, type);
                });
            });

            return card;
        }

        function renderCommentsTree(roots, childrenByParent) {
            if (!roots || roots.length === 0) {
                commentsList.innerHTML = `<p style="opacity: 0.4; font-style: italic; font-size: 0.85rem; text-align: center; padding: 1.5rem 0;">No comments yet. Be the first to say something!</p>`;
                return;
            }

            commentsList.innerHTML = ''; // Clear

            roots.forEach(root => {
                // 1. Render root card
                const rootCard = createCommentCardDOM(root, false);
                commentsList.appendChild(rootCard);

                // 2. Render any nested replies beneath it
                const replies = childrenByParent[root.id] || [];
                replies.forEach(reply => {
                    const replyCard = createCommentCardDOM(reply, true);
                    commentsList.appendChild(replyCard);
                });
            });
        }

        // Robust Comment Voting Logic (Fixes 409 unique constraint violation!)
        async function handleVoteComment(commentId, voteType) {
            if (!currentUserId) {
                alert(window.cp_translate("⚠️ Please sign in via Discord to vote on comments!"));
                return;
            }

            try {
                // Fetch LIVE true server state dynamically to guarantee 100% race-condition safety!
                const { data: existing, error: fetchError } = await supabase
                    .from('map_comment_votes')
                    .select('*')
                    .eq('comment_id', commentId)
                    .eq('user_id', currentUserId)
                    .maybeSingle();

                if (fetchError) throw fetchError;

                if (existing) {
                    if (existing.vote_type === voteType) {
                        // Double click -> Unvote
                        const { error } = await supabase
                            .from('map_comment_votes')
                            .delete()
                            .eq('id', existing.id);
                        if (error) throw error;
                    } else {
                        // Swap vote type
                        const { error } = await supabase
                            .from('map_comment_votes')
                            .update({ vote_type: voteType })
                            .eq('id', existing.id);
                        if (error) throw error;
                    }
                } else {
                    // First time insert
                    const { error } = await supabase
                        .from('map_comment_votes')
                        .insert([{
                            comment_id: commentId,
                            user_id: currentUserId,
                            vote_type: voteType
                        }]);
                    if (error) throw error;
                }

                // UI updates in real time or via manually triggered refresh
                await loadComments();

            } catch (err) {
                console.error("Comment vote error:", err);
                alert(window.cp_translate("Failed to cast vote:") + " " + err.message);
            }
        }

        async function handleDeleteComment(commentId) {
            if (!isAdmin) return;
            if (!confirm("Delete this comment?")) return;

            try {
                const { error } = await supabase
                    .from('map_comments')
                    .delete()
                    .eq('id', commentId);
                
                if (error) throw error;
                await loadComments();
            } catch (err) {
                console.error(err);
                alert(window.cp_translate("Delete failed:") + " " + err.message);
            }
        }

        // --- 3. Comment Posting Logic ---
        const commentInput = document.getElementById('commentInput');
        const anonCheck = document.getElementById('anonCommentCheck');
        const submitBtn = document.getElementById('submitCommentBtn');
        const cooldownText = document.getElementById('commentCooldownText');
        const COOLDOWN_MS = 10000; // 10s cooldown
        let cooldownInterval = null;

        function checkCommentCooldown() {
            const lastStr = localStorage.getItem('hammer_comment_last');
            if (!lastStr) return false;
            const elapsed = Date.now() - parseInt(lastStr, 10);
            if (elapsed < COOLDOWN_MS) {
                startCooldownTimer(COOLDOWN_MS - elapsed);
                return true;
            }
            return false;
        }

        function startCooldownTimer(ms) {
            clearInterval(cooldownInterval);
            submitBtn.disabled = true;
            cooldownText.style.display = 'inline';
            let rem = Math.ceil(ms / 1000);

            const tick = () => {
                cooldownText.innerText = `Wait ${rem}s`;
                if (rem <= 0) {
                    clearInterval(cooldownInterval);
                    cooldownText.style.display = 'none';
                    submitBtn.disabled = false;
                }
                rem--;
            };
            tick();
            cooldownInterval = setInterval(tick, 1000);
        }

        if (submitBtn) {
            // Initial Check
            checkCommentCooldown();

            submitBtn.onclick = async () => {
                const content = commentInput.value.trim();
                if (!content) return;

                if (content.length > 2500) {
                    alert(window.cp_translate("Comment too long! Max 2500 characters allowed."));
                    return;
                }

                if (checkCommentCooldown()) return;

                submitBtn.disabled = true;
                const oldText = submitBtn.innerText;
                submitBtn.innerText = 'Posting...';

                try {
                    const isAnon = anonCheck.checked;
                    let authName = 'Anonymous';
                    let uId = null;

                    if (!isAnon && session && session.user) {
                        const meta = session.user.user_metadata;
                        authName = meta.global_name || meta.full_name || 'Authenticated User';
                        uId = session.user.id;
                    }

                    const payload = {
                        map_id: mapId,
                        content: content,
                        author_name: authName,
                        user_id: uId
                    };

                    // Append parent ID if user is writing a reply!
                    if (replyToId) {
                        payload.parent_id = replyToId;
                    }

                    const { error } = await supabase
                        .from('map_comments')
                        .insert([payload]);

                    if (error) throw error;

                    // Clear input and state
                    commentInput.value = '';
                    replyToId = null;
                    if (replyToIndicator) replyToIndicator.style.display = 'none';

                    localStorage.setItem('hammer_comment_last', Date.now().toString());
                    startCooldownTimer(COOLDOWN_MS);

                    // Instant visual reload!
                    await loadComments();

                } catch (err) {
                    console.error(err);
                    alert(window.cp_translate("Failed to post comment:") + " " + err.message);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerText = oldText;
                }
            };
        }

        // Trigger initial comments load
        await loadComments();

        // ════════════════════════════════════════════════════════
        // 👥 COLLABORATION SUGGESTIONS SECTION (OWNER ONLY)
        // ════════════════════════════════════════════════════════
        if (currentUserId && currentUserId === data.user_id) {
            const suggestionsSection = document.getElementById('suggestionsSection');
            if (suggestionsSection) {
                suggestionsSection.style.display = 'block';
                await loadSuggestions();
            }
        }

        async function loadSuggestions() {
            try {
                const sList = document.getElementById('suggestionsList');
                const sCount = document.getElementById('suggestionsCount');
                if (!sList) return;

                const { data: suggestions, error: sugErr } = await supabase
                    .from('map_suggestions')
                    .select('*')
                    .eq('map_id', mapId)
                    .order('created_at', { ascending: false });

                if (sugErr) throw sugErr;

                if (sCount) sCount.textContent = (suggestions?.length || 0).toString();

                if (!suggestions || suggestions.length === 0) {
                    sList.innerHTML = `
                        <p style="opacity: 0.4; font-style: italic; font-size: 0.85rem; text-align: center; padding: 1.5rem 0;">
                            ${window.cp_translate('No suggestions yet. Invite a friend using the collab link!')}
                        </p>
                    `;
                    return;
                }

                sList.innerHTML = '';
                suggestions.forEach(s => {
                    const item = document.createElement('div');
                    item.className = 'comment-card suggestion-item';
                    item.style.cssText = `
                        background: rgba(255, 255, 255, 0.02);
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        border-radius: 12px;
                        padding: 1rem;
                        margin-bottom: 0.8rem;
                        display: flex;
                        flex-direction: column;
                        gap: 0.5rem;
                        transition: all 0.2s;
                    `;

                    const dateStr = new Date(s.created_at).toLocaleString();
                    const isPrevious = s.contributor_name.includes('Previous Version') || s.contributor_name.includes('Предыдущая версия');

                    item.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                            <div style="display:flex; flex-direction:column;">
                                <span style="font-weight:700; color:${isPrevious ? '#a78bfa' : '#60a5fa'}; font-size:0.9rem;">
                                    ${isPrevious ? `⬅️ ${window.cp_translate('Previous Version')}` : `👤 ${s.contributor_name}`}
                                </span>
                                <span style="font-size:0.75rem; color:rgba(255,255,255,0.4);">${dateStr}</span>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <button class="collab-action-btn use-btn" style="
                                    background: rgba(96, 165, 250, 0.15);
                                    border: 1px solid rgba(96, 165, 250, 0.3);
                                    color: #93c5fd;
                                    padding: 4px 12px;
                                    border-radius: 8px;
                                    font-size: 0.78rem;
                                    font-weight:700;
                                    cursor:pointer;
                                    transition: all 0.2s;
                                ">
                                    ${window.cp_translate('Use this version')}
                                </button>
                                <button class="collab-action-btn del-btn" style="
                                    background: rgba(239, 68, 68, 0.12);
                                    border: 1px solid rgba(239, 68, 68, 0.25);
                                    color: #f87171;
                                    padding: 4px 12px;
                                    border-radius: 8px;
                                    font-size: 0.78rem;
                                    font-weight:700;
                                    cursor:pointer;
                                    transition: all 0.2s;
                                ">
                                    ${window.cp_translate('Delete')}
                                </button>
                            </div>
                        </div>
                    `;

                    const useBtn = item.querySelector('.use-btn') as HTMLButtonElement;
                    const delBtn = item.querySelector('.del-btn') as HTMLButtonElement;

                    useBtn.onmouseover = () => {
                        useBtn.style.background = 'rgba(96, 165, 250, 0.25)';
                        useBtn.style.borderColor = 'rgba(96, 165, 250, 0.5)';
                        useBtn.style.color = '#fff';
                    };
                    useBtn.onmouseout = () => {
                        useBtn.style.background = 'rgba(96, 165, 250, 0.15)';
                        useBtn.style.borderColor = 'rgba(96, 165, 250, 0.3)';
                        useBtn.style.color = '#93c5fd';
                    };

                    delBtn.onmouseover = () => {
                        delBtn.style.background = 'rgba(239, 68, 68, 0.22)';
                        delBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                        delBtn.style.color = '#fff';
                    };
                    delBtn.onmouseout = () => {
                        delBtn.style.background = 'rgba(239, 68, 68, 0.12)';
                        delBtn.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                        delBtn.style.color = '#f87171';
                    };

                    useBtn.onclick = async () => {
                        const confirmSwap = window.cp_translate("🔄 Are you sure you want to load this version as the primary map? Your current version will be archived below as a backup.");
                        if (!confirm(confirmSwap)) return;

                        useBtn.disabled = true;
                        useBtn.textContent = '...';

                        try {
                            const archivePayload = {
                                map_id: mapId,
                                contributor_id: currentUserId,
                                contributor_name: window.cp_translate('Previous Version'),
                                map_data: data.map_data,
                                note: 'Auto-archived backup'
                            };

                            const { error: archErr } = await supabase
                                .from('map_suggestions')
                                .insert([archivePayload]);

                            if (archErr) throw archErr;

                            const { error: updErr } = await supabase
                                .from('maps')
                                .update({ map_data: s.map_data })
                                .eq('id', mapId);

                            if (updErr) throw updErr;

                            alert(window.cp_translate("✅ Map successfully updated to selected version! Reloading..."));
                            window.location.reload();

                        } catch (err) {
                            console.error(err);
                            alert(window.cp_translate("❌ Failed to swap versions:") + " " + err.message);
                            useBtn.disabled = false;
                            useBtn.textContent = window.cp_translate('Use this version');
                        }
                    };

                    delBtn.onclick = async () => {
                        const confirmDel = window.cp_translate("🗑️ Delete this suggestion permanently?");
                        if (!confirm(confirmDel)) return;

                        delBtn.disabled = true;
                        try {
                            const { error: dErr } = await supabase
                                .from('map_suggestions')
                                .delete()
                                .eq('id', s.id);

                            if (dErr) throw dErr;
                            await loadSuggestions();
                        } catch (err) {
                            console.error(err);
                            alert(window.cp_translate("❌ Failed to delete suggestion:") + " " + err.message);
                            delBtn.disabled = false;
                        }
                    };

                    sList.appendChild(item);
                });

            } catch (err) {
                console.error(err);
            }
        }

        // Set up real-time updates for comments and votes
        supabase
            .channel(`map_comments_realtime_${mapId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'map_comments', filter: `map_id=eq.${mapId}` }, () => {
                loadComments();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'map_comment_votes' }, () => {
                loadComments(); 
            })
            .subscribe();



    } catch (err) {
        console.error('Database load error:', err);
        showError('Oops, it seems you do not have access to this masterpiece 🔒');
    }

    function showError(msg) {
        const titleEl = document.getElementById('mapTitle');
        if (titleEl) {
            titleEl.textContent = msg;
            titleEl.style.fontSize = '1.5rem';
            titleEl.style.color = '#ffa4a4';
            titleEl.style.textAlign = 'center';
            titleEl.style.marginTop = '4rem';
        }
        ['mapInfo', 'mapDetails', 'mapCanvas', 'downloadMapBtn', 'shareMapBtn', 'openMapBtn', 'mapImage', 'pageLikeBtn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    function format(str) {
        return str ? str.replace(/_/g, ' ') : 'Unknown';
    }
});
