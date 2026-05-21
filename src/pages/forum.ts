// @ts-nocheck
import { supabase } from '../core/supabase-client.js';

// ⚙ CONFIG
const FORUM_COOLDOWN_MS = 15000; // 15 seconds cooldown
const ADMIN_UUID = 'cc1e4139-e600-45e8-88f0-922e0fb69998'; // Secure admin ID

// STATE
let currentSession = null;
let currentUserId = null;
let isAdmin = false;
let isSubmitting = false;
let cooldownInterval = null;
let allMessages = [];
let currentSort = 'newest';

// Selected media state
let selectedPhotos = [];
let selectedVideos = [];

// DOM ELEMENTS
const forumInput = document.getElementById('forumInput');
const anonCheck = document.getElementById('anonCheck');
const submitMsgBtn = document.getElementById('submitMsgBtn');
const messagesFeed = document.getElementById('messagesFeed');
const cooldownDisplay = document.getElementById('cooldownDisplay');

// Attachment DOM elements
const attachPhotoBtn = document.getElementById('attachPhotoBtn');
const photoFileInput = document.getElementById('photoFileInput');
const attachVideoBtn = document.getElementById('attachVideoBtn');
const videoFileInput = document.getElementById('videoFileInput');
const attachmentsPreview = document.getElementById('attachmentsPreview');

async function initForum() {
    // 1. Get user session & check admin state
    try {
        const { data: { session } } = await supabase.auth.getSession();
        currentSession = session;
        currentUserId = session?.user?.id || null;
        
        if (currentUserId === ADMIN_UUID) {
            isAdmin = true;
        }
    } catch (err) {
        console.error("Failed to check session", err);
    }

    // 2. Initial feed load
    await loadMessages();

    // 3. Setup Event Listeners
    submitMsgBtn.addEventListener('click', handleSendMessage);
    
    // Bind Sorting Tabs
    const forumSortControls = document.getElementById('forumSortControls');
    if (forumSortControls) {
        const tabs = forumSortControls.querySelectorAll('.sort-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentSort = tab.getAttribute('data-sort');
                sortAndRenderMessages();
            });
        });
    }

    // Bind File Attachments UI triggers
    if (attachPhotoBtn && photoFileInput) {
        attachPhotoBtn.addEventListener('click', () => {
            if (!currentUserId) {
                alert(window.cp_translate("Please sign in via Discord to attach media!"));
                return;
            }
            photoFileInput.click();
        });
        photoFileInput.addEventListener('change', handlePhotoSelection);
    }

    if (attachVideoBtn && videoFileInput) {
        attachVideoBtn.addEventListener('click', () => {
            if (!currentUserId) {
                alert(window.cp_translate("Please sign in via Discord to attach media!"));
                return;
            }
            videoFileInput.click();
        });
        videoFileInput.addEventListener('change', handleVideoSelection);
    }

    // Initial cooldown check
    checkCooldown();

    // Subscribe to real-time updates to keep feed live (messages + votes)
    supabase
        .channel('forum_realtime_events')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_messages' }, () => {
            loadMessages(); 
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_message_votes' }, () => {
            loadMessages(); // Refresh UI when votes are cast
        })
        .subscribe();
}

// Media Selection Handlers
function handlePhotoSelection(e) {
    const files = Array.from(e.target.files || []);
    
    for (const file of files) {
        if (selectedPhotos.length >= 5) {
            alert(window.cp_translate("Max 5 photos allowed."));
            break;
        }
        // Validate size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert(`${file.name}: ${window.cp_translate("Original file size too large! Max limit 5MB for cropping.").replace("for cropping", "")}`);
            continue;
        }
        selectedPhotos.push(file);
    }
    
    photoFileInput.value = '';
    renderAttachmentPreviews();
}

function handleVideoSelection(e) {
    const files = Array.from(e.target.files || []);
    
    for (const file of files) {
        if (selectedVideos.length >= 2) {
            alert(window.cp_translate("Max 2 videos allowed."));
            break;
        }
        // Validate size (max 15MB)
        if (file.size > 15 * 1024 * 1024) {
            alert(`${file.name}: ${window.cp_translate("Original file size too large! Max limit 5MB for cropping.").replace("5MB", "15MB").replace("for cropping", "")}`);
            continue;
        }
        selectedVideos.push(file);
    }
    
    videoFileInput.value = '';
    renderAttachmentPreviews();
}

// Render attachment previews in composer
function renderAttachmentPreviews() {
    if (!attachmentsPreview) return;
    
    // BUG-13 fix: revoke old blob URLs before creating new ones to prevent memory leaks
    // Collect and revoke all existing blob URLs from previous render
    attachmentsPreview.querySelectorAll('img[data-blob-url]').forEach(img => {
        URL.revokeObjectURL(img.getAttribute('data-blob-url'));
    });

    attachmentsPreview.innerHTML = '';
    
    if (selectedPhotos.length === 0 && selectedVideos.length === 0) {
        attachmentsPreview.style.display = 'none';
        if (attachPhotoBtn) attachPhotoBtn.innerHTML = `<span>📸</span> ${window.cp_translate('Attach Photo (max 5)')}`;
        if (attachVideoBtn) attachVideoBtn.innerHTML = `<span>🎥</span> ${window.cp_translate('Attach Video (max 2)')}`;
        return;
    }
    
    attachmentsPreview.style.display = 'grid';

    // Photos
    selectedPhotos.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        
        const img = document.createElement('img');
        const blobUrl = URL.createObjectURL(file);
        img.src = blobUrl;
        img.setAttribute('data-blob-url', blobUrl); // BUG-13: track for revocation
        item.appendChild(img);

        const remBtn = document.createElement('button');
        remBtn.type = 'button';
        remBtn.className = 'remove-btn';
        remBtn.innerHTML = '&times;';
        remBtn.addEventListener('click', () => {
            selectedPhotos.splice(index, 1);
            renderAttachmentPreviews();
        });
        item.appendChild(remBtn);
        attachmentsPreview.appendChild(item);
    });

    // Videos
    selectedVideos.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        
        const icon = document.createElement('span');
        icon.className = 'video-icon';
        icon.innerHTML = '🎬';
        item.appendChild(icon);

        const label = document.createElement('span');
        label.style.cssText = 'position:absolute; bottom:4px; font-size:0.6rem; color:rgba(255,255,255,0.7); max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
        label.innerText = file.name;
        item.appendChild(label);

        const remBtn = document.createElement('button');
        remBtn.type = 'button';
        remBtn.className = 'remove-btn';
        remBtn.innerHTML = '&times;';
        remBtn.addEventListener('click', () => {
            selectedVideos.splice(index, 1);
            renderAttachmentPreviews();
        });
        item.appendChild(remBtn);
        attachmentsPreview.appendChild(item);
    });

    // Update buttons
    if (attachPhotoBtn) attachPhotoBtn.innerHTML = `<span>📸</span> ${window.cp_translate('Attach Photo')} (${selectedPhotos.length}/5)`;
    if (attachVideoBtn) attachVideoBtn.innerHTML = `<span>🎥</span> ${window.cp_translate('Attach Video')} (${selectedVideos.length}/2)`;
}

// Check for active cooldown in localStorage
function checkCooldown() {
    const lastPostStr = localStorage.getItem('hammer_forum_last_post');
    if (!lastPostStr) return false;

    const lastPost = parseInt(lastPostStr, 10);
    const elapsed = Date.now() - lastPost;

    if (elapsed < FORUM_COOLDOWN_MS) {
        startCooldownTimer(FORUM_COOLDOWN_MS - elapsed);
        return true;
    }
    return false;
}

// Timer UI logic
function startCooldownTimer(msRemaining) {
    clearInterval(cooldownInterval);
    submitMsgBtn.disabled = true;
    cooldownDisplay.style.display = 'block';
    
    let remainingSec = Math.ceil(msRemaining / 1000);
    
    const updateUI = () => {
        cooldownDisplay.innerText = `${window.cp_translate('Cooldown:')} ${remainingSec}s`;
        if (remainingSec <= 0) {
            clearInterval(cooldownInterval);
            cooldownDisplay.style.display = 'none';
            submitMsgBtn.disabled = false;
        }
        remainingSec--;
    };

    updateUI();
    cooldownInterval = setInterval(updateUI, 1000);
}

// Helper to escape HTML and prevent XSS
function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

// Load & Render all messages with votes
async function loadMessages() {
    try {
        const { data, error } = await supabase
            .from('forum_messages')
            .select('*, forum_message_votes(*)');

        if (error) throw error;
        allMessages = data || [];
        sortAndRenderMessages();
    } catch (err) {
        console.error("Failed to fetch forum messages:", err);
        messagesFeed.innerHTML = `<div class="empty-feed" style="color:#ff6b6b">${window.cp_translate('Failed to load messages. Please try again later.')}</div>`;
    }
}

function sortAndRenderMessages() {
    const sorted = [...allMessages];

    if (currentSort === 'newest') {
        // Sort newest first (created_at DESC)
        sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (currentSort === 'likes') {
        // Sort by likes DESC, secondary by created_at DESC
        sorted.sort((a, b) => {
            const aLikes = (a.forum_message_votes || []).filter(v => v.vote_type === 'like').length;
            const bLikes = (b.forum_message_votes || []).filter(v => v.vote_type === 'like').length;

            if (bLikes !== aLikes) {
                return bLikes - aLikes;
            }
            return new Date(b.created_at) - new Date(a.created_at);
        });
    }

    renderMessages(sorted);
}

function renderMessages(messages) {
    if (!messages || messages.length === 0) {
        messagesFeed.innerHTML = `<div class="empty-feed">${window.cp_translate('The community wall is silent. Be the first to break the silence!')}</div>`;
        return;
    }

    messagesFeed.innerHTML = ''; // Clear container

    messages.forEach(msg => {
        const isMsgAdmin = msg.user_id === ADMIN_UUID || msg.author_name === 'hammer147' || msg.author_name?.includes('hammer147');
        const postDate = new Date(msg.created_at).toLocaleString();

        // Compute voting counts
        const votes = msg.forum_message_votes || [];
        const likeCount = votes.filter(v => v.vote_type === 'like').length;
        const dislikeCount = votes.filter(v => v.vote_type === 'dislike').length;

        // Check if current logged user has already voted
        const userVote = votes.find(v => v.user_id === currentUserId);
        const isLiked = userVote?.vote_type === 'like';
        const isDisliked = userVote?.vote_type === 'dislike';

        // 1. Status Badges Logic
        const statusVal = msg.status || 'unresolved';
        const isResolved = statusVal === 'resolved';
        const statusText = window.cp_translate(isResolved ? 'Resolved' : 'Unresolved');
        
        let statusBadgeHTML = '';
        if (isAdmin) {
            statusBadgeHTML = `
                <button class="status-badge ${statusVal} admin-toggle" data-id="${msg.id}" data-status="${statusVal}" title="${window.cp_translate('Toggle Status')}">
                    ${statusText} 🔄
                </button>
            `;
        } else {
            statusBadgeHTML = `
                <span class="status-badge ${statusVal}">
                    ${statusText}
                </span>
            `;
        }

        // 2. Photos Grid Layout
        let photosGridHTML = '';
        if (msg.photos && msg.photos.length > 0) {
            photosGridHTML = `
                <div class="message-photos-grid count-${msg.photos.length}">
                    ${msg.photos.map(url => `
                        <div class="photo-thumbnail">
                            <img src="${url}" class="forum-zoomable-img" alt="Attachment Image" data-url="${url}">
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // 3. Videos List Layout
        let videosListHTML = '';
        if (msg.videos && msg.videos.length > 0) {
            videosListHTML = `
                <div class="message-videos-list">
                    ${msg.videos.map(url => `
                        <div class="video-container">
                            <video src="${url}" controls preload="metadata"></video>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // 4. Admin Reply Layout
        let adminReplyHTML = '';
        if (msg.admin_reply) {
            adminReplyHTML = `
                <div class="admin-reply-box" id="adminReplyBox-${msg.id}">
                    <div class="reply-header">
                        <span class="admin-name">👑 ${window.cp_translate('Response from Hammer147')}</span>
                        ${isAdmin ? `<button class="edit-reply-btn" data-id="${msg.id}" data-current="${escapeHTML(msg.admin_reply)}">${window.cp_translate('Edit Reply')}</button>` : ''}
                    </div>
                    <div class="reply-content">${escapeHTML(msg.admin_reply)}</div>
                </div>
            `;
        } else if (isAdmin) {
            adminReplyHTML = `
                <div class="admin-reply-box empty-admin-reply" id="adminReplyBox-${msg.id}">
                    <button class="add-reply-btn" data-id="${msg.id}" data-current="">💬 ${window.cp_translate('Add Reply')}</button>
                </div>
            `;
        }

        const msgEl = document.createElement('div');
        msgEl.className = 'message-item';
        
        // Avatar rendering logic
        const defaultAvatar = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
        const avatarUrl = msg.author_avatar_url || defaultAvatar;

        msgEl.innerHTML = `
            <div class="message-meta" style="display: flex; align-items: flex-start; gap: 12px;">
                <img src="${avatarUrl}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid ${isMsgAdmin ? '#a78bfa' : 'rgba(255,255,255,0.1)'};">
                <div style="flex: 1;">
                    <div class="message-author-info" style="margin-bottom: 2px;">
                        <div>
                            <span class="message-author ${isMsgAdmin ? 'admin' : ''}">${escapeHTML(msg.author_name || window.cp_translate('Anonymous'))}</span>
                            ${statusBadgeHTML}
                        </div>
                    </div>
                    <span class="message-time" style="font-size: 0.75rem; color: rgba(255,255,255,0.4);">${postDate}</span>
                </div>
                <div class="message-actions">
                    <button class="delete-msg-btn" data-id="${msg.id}" title="${window.cp_translate('Delete Message')}" style="display: ${isAdmin ? 'block' : 'none'};">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
            <div class="message-content" style="margin-top: 10px;">${escapeHTML(msg.content)}</div>
            
            ${photosGridHTML}
            ${videosListHTML}
            ${adminReplyHTML}
            
            <!-- Message Footer with Votes -->
            <div class="message-footer">
                <div class="voting-group">
                    <button class="vote-btn like ${isLiked ? 'active' : ''}" data-msgid="${msg.id}" data-type="like">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                        <span class="count">${likeCount}</span>
                    </button>
                    <button class="vote-btn dislike ${isDisliked ? 'active' : ''}" data-msgid="${msg.id}" data-type="dislike">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>
                        <span class="count">${dislikeCount}</span>
                    </button>
                </div>
            </div>
        `;

        // 5. Admin Status Toggle Binding
        if (isAdmin) {
            const toggleBtn = msgEl.querySelector('.status-badge.admin-toggle');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', async () => {
                    const mId = toggleBtn.getAttribute('data-id');
                    const curStatus = toggleBtn.getAttribute('data-status');
                    const nextStatus = curStatus === 'resolved' ? 'unresolved' : 'resolved';
                    await handleToggleBugStatus(mId, nextStatus);
                });
            }

            const commentBtns = msgEl.querySelectorAll('.add-reply-btn, .edit-reply-btn');
            commentBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const mId = btn.getAttribute('data-id');
                    const curText = btn.getAttribute('data-current') || '';
                    const box = document.getElementById(`adminReplyBox-${mId}`);
                    if (box) {
                        showAdminReplyEditor(mId, curText, box);
                    }
                });
            });
        }

        // 6. Lightbox Zoom Binding
        const zoomImages = msgEl.querySelectorAll('.forum-zoomable-img');
        zoomImages.forEach(img => {
            img.addEventListener('click', () => {
                const url = img.getAttribute('data-url');
                openLightbox(url);
            });
        });

        // Delete action binding
        const delBtn = msgEl.querySelector('.delete-msg-btn');
        if (delBtn) {
            delBtn.addEventListener('click', () => handleDeleteMessage(msg.id));
        }

        // Vote triggers binding
        const voteBtns = msgEl.querySelectorAll('.vote-btn');
        voteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mId = btn.getAttribute('data-msgid');
                const type = btn.getAttribute('data-type');
                handleVoteMessage(mId, type);
            });
        });

        messagesFeed.appendChild(msgEl);
    });
}

// Admin toggle bug status
async function handleToggleBugStatus(messageId, nextStatus) {
    try {
        const { error } = await supabase
            .from('forum_messages')
            .update({ status: nextStatus })
            .eq('id', messageId);
            
        if (error) throw error;
        await loadMessages();
    } catch (err) {
        console.error("Status toggle error:", err);
        alert(window.cp_translate("Failed to update privacy settings.") + " " + err.message);
    }
}

// Show Admin Inline Reply Editor
function showAdminReplyEditor(messageId, currentText, container) {
    container.innerHTML = `
        <div class="reply-editor-wrapper">
            <textarea class="admin-reply-textarea" placeholder="${window.cp_translate('Write admin reply...')}">${currentText}</textarea>
            <div class="editor-buttons">
                <button class="save-reply-btn">${window.cp_translate('Save Reply')}</button>
                <button class="cancel-reply-btn">${window.cp_translate('Cancel')}</button>
            </div>
        </div>
    `;
    
    container.querySelector('.cancel-reply-btn').addEventListener('click', () => {
        loadMessages(); // Redraw whole feed to dismiss editor
    });
    
    container.querySelector('.save-reply-btn').addEventListener('click', async () => {
        const text = container.querySelector('.admin-reply-textarea').value.trim();
        await handleSaveAdminReply(messageId, text);
    });
}

// Save Admin Comment
async function handleSaveAdminReply(messageId, text) {
    try {
        const { error } = await supabase
            .from('forum_messages')
            .update({ admin_reply: text || null })
            .eq('id', messageId);
            
        if (error) throw error;
        await loadMessages();
    } catch (err) {
        console.error("Save reply error:", err);
        alert(window.cp_translate("Failed to send message:") + " " + err.message);
    }
}

// Lightbox Open Handler
function openLightbox(url) {
    let overlay = document.getElementById('lightboxOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'lightboxOverlay';
        overlay.className = 'lightbox-overlay';
        overlay.innerHTML = `
            <div class="lightbox-close">&times;</div>
            <img class="lightbox-img" src="" alt="Zoomed Bug Image">
        `;
        document.body.appendChild(overlay);
        
        overlay.querySelector('.lightbox-close').addEventListener('click', () => {
            overlay.classList.remove('active');
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    }
    const img = overlay.querySelector('.lightbox-img');
    img.src = url;
    overlay.classList.add('active');
}

// Voting action handler (Robust, dynamic & 409-proof!)
async function handleVoteMessage(messageId, voteType) {
    if (!currentUserId) {
        alert(window.cp_translate("⚠️ Please sign in via Discord to vote on messages!"));
        return;
    }

    try {
        // Fetch absolute live state from backend to bypass stale closures and avoid 409 duplicate keys!
        const { data: existing, error: fetchErr } = await supabase
            .from('forum_message_votes')
            .select('*')
            .eq('message_id', messageId)
            .eq('user_id', currentUserId)
            .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (existing) {
            if (existing.vote_type === voteType) {
                // Double click -> Remove vote
                const { error } = await supabase
                    .from('forum_message_votes')
                    .delete()
                    .eq('id', existing.id);
                
                if (error) throw error;
            } else {
                // Opposite type click -> Swap type
                const { error } = await supabase
                    .from('forum_message_votes')
                    .update({ vote_type: voteType })
                    .eq('id', existing.id);

                if (error) throw error;
            }
        } else {
            // New vote insert
            const { error } = await supabase
                .from('forum_message_votes')
                .insert([{
                    message_id: messageId,
                    user_id: currentUserId,
                    vote_type: voteType
                }]);

            if (error) throw error;
        }
        
        // Visual update is handled in real-time OR can be forced immediately!
        await loadMessages();

    } catch (err) {
        console.error("Vote error:", err);
        alert(window.cp_translate("Failed to cast vote:") + " " + err.message);
    }
}

// Handle Send Message action
async function handleSendMessage() {
    if (isSubmitting) return;

    const content = forumInput.value.trim();
    if (!content) {
        alert(window.cp_translate("Cannot send an empty message."));
        return;
    }

    if (content.length > 2500) {
        alert(window.cp_translate("Message too long! Max 2500 characters allowed."));
        return;
    }

    if (checkCooldown()) return;

    isSubmitting = true;
    submitMsgBtn.disabled = true;
    const originalBtnHTML = submitMsgBtn.innerHTML;
    submitMsgBtn.innerHTML = `<span>⏳</span> ${window.cp_translate('⏳ Sending...')}`;

    try {
        const isAnon = anonCheck.checked;
        let authorName = window.cp_translate('Anonymous');
        let authorAvatarUrl = null;
        let userId = null;

        if (!isAnon && currentSession && currentSession.user) {
            const meta = currentSession.user.user_metadata;
            authorName = meta.global_name || meta.full_name || 'Authenticated User';
            authorAvatarUrl = meta.avatar_url || meta.picture || null;
            userId = currentSession.user.id;
        }

        // Upload media attachments first if any are selected
        const uploadedPhotos = [];
        const uploadedVideos = [];

        if (selectedPhotos.length > 0 || selectedVideos.length > 0) {
            // BUG-12 fix: never upload files for anonymous users — block before any storage call
            if (!userId) {
                alert(window.cp_translate("Please sign in via Discord to attach media!"));
                throw new Error("Unauthenticated upload blocked.");
            }

            submitMsgBtn.innerHTML = `<span>⏳</span> ${window.cp_translate('⏳ Sending...')} (${window.cp_translate('Uploading attachments')}...)`;
            
            // Upload photos to custom_tiles bucket under /forum_attachments
            for (let i = 0; i < selectedPhotos.length; i++) {
                const file = selectedPhotos[i];
                const timestamp = Date.now();
                const fileExt = file.name.split('.').pop() || 'png';
                const uploadPath = `forum_attachments/${userId}/${timestamp}_photo_${i}.${fileExt}`;
                
                const { error: sError } = await supabase.storage
                    .from('custom_tiles')
                    .upload(uploadPath, file, { upsert: true });
                
                if (sError) throw sError;
                
                const { data: { publicUrl } } = supabase.storage
                    .from('custom_tiles')
                    .getPublicUrl(uploadPath);
                
                uploadedPhotos.push(publicUrl);
            }

            // Upload videos to custom_tiles bucket under /forum_attachments
            for (let i = 0; i < selectedVideos.length; i++) {
                const file = selectedVideos[i];
                const timestamp = Date.now();
                const fileExt = file.name.split('.').pop() || 'mp4';
                const uploadPath = `forum_attachments/${userId}/${timestamp}_video_${i}.${fileExt}`;
                
                const { error: sError } = await supabase.storage
                    .from('custom_tiles')
                    .upload(uploadPath, file, { upsert: true });
                
                if (sError) throw sError;
                
                const { data: { publicUrl } } = supabase.storage
                    .from('custom_tiles')
                    .getPublicUrl(uploadPath);
                
                uploadedVideos.push(publicUrl);
            }
        }

        const { error } = await supabase
            .from('forum_messages')
            .insert([{
                content: content,
                author_name: authorName,
                author_avatar_url: authorAvatarUrl,
                user_id: userId,
                photos: uploadedPhotos,
                videos: uploadedVideos,
                status: 'unresolved'
            }]);

        if (error) throw error;

        // Clear input and attachments state
        forumInput.value = '';
        selectedPhotos = [];
        selectedVideos = [];
        renderAttachmentPreviews();

        localStorage.setItem('hammer_forum_last_post', Date.now().toString());
        startCooldownTimer(FORUM_COOLDOWN_MS);

        // Force absolute INSTANT rendering on UI!
        await loadMessages();

    } catch (err) {
        console.error("Failed to send message:", err);
        alert(window.cp_translate("Failed to send message:") + " " + (err.message || "Server error."));
    } finally {
        isSubmitting = false;
        submitMsgBtn.disabled = false; // BUG-14 fix: always re-enable button, even after error
        submitMsgBtn.innerHTML = originalBtnHTML;
    }
}

// Admin delete action
async function handleDeleteMessage(msgId) {
    if (!isAdmin) return;
    
    const confirmDel = confirm(window.cp_translate("Are you absolutely sure you want to delete this message?"));
    if (!confirmDel) return;

    try {
        const { error } = await supabase
            .from('forum_messages')
            .delete()
            .eq('id', msgId);

        if (error) throw error;
    } catch (err) {
        console.error("Failed to delete message:", err);
        alert(window.cp_translate("Failed to delete:") + " " + (err.message || "Database restrictions."));
    }
}

// Start the page
window.addEventListener('DOMContentLoaded', initForum);
