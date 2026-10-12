// @ts-nocheck
/**
 * TouristAI — Conversational AI Travel Concierge (ChatGPT Experience)
 * Features:
 * - Multi-turn conversational memory (client & server)
 * - Guest & Authenticated chat session persistence
 * - Real-time AbortController ("Stop Generating")
 * - Edit & Resubmit previous user message
 * - Regenerate response
 * - Copy with visual feedback
 * - Smart auto-scroll with manual scroll detection & jump-to-bottom button
 * - Welcome screen with responsive travel prompt starters
 * - Mobile off-canvas drawer navigation
 * - Seamless Markdown & rich travel destination cards rendering
 */

let currentChatId = null;
let currentConversationHistory = []; // Array of { role: 'user'|'assistant', content: string, destination?: object }
let isProcessing = false;
let activeAbortController = null;
let userHasScrolledUp = false;
let pendingModalAction = null;

document.addEventListener('DOMContentLoaded', () => {
    initChatInterface();
    initScrollDetection();
    loadRecentChats();

    // Check for query param prompt or pending prompt from home page
    const urlParams = new URLSearchParams(window.location.search);
    const queryPrompt = urlParams.get('prompt');
    const pendingPrompt = localStorage.getItem('pending_chat_prompt');

    const initialPrompt = queryPrompt || pendingPrompt;
    if (initialPrompt) {
        if (pendingPrompt) localStorage.removeItem('pending_chat_prompt');
        let promptText = initialPrompt;
        try {
            promptText = decodeURIComponent(initialPrompt);
        } catch (e) {
            promptText = initialPrompt;
        }
        usePrompt(promptText);
        setTimeout(() => {
            handleChatSubmit(new Event('submit'));
        }, 300);
    } else {
        updateWelcomeScreenVisibility();
    }
});

function initChatInterface() {
    const input = document.getElementById('chatMessageInput');
    const form = document.getElementById('chatForm');

    if (input) {
        input.addEventListener('input', () => {
            input.style.height = '38px';
            input.style.height = Math.min(input.scrollHeight, 140) + 'px';
        });
    }

    if (form) {
        form.addEventListener('submit', handleChatSubmit);
    }

    updatePromptChips();
}

function initScrollDetection() {
    const box = document.getElementById('messagesBox');
    const scrollBtn = document.getElementById('scrollToBottomBtn');
    if (!box || !scrollBtn) return;

    box.addEventListener('scroll', () => {
        const threshold = 120;
        const isNearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < threshold;
        userHasScrolledUp = !isNearBottom;

        if (userHasScrolledUp && currentConversationHistory.length > 0) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    });
}

function scrollToBottomSmooth() {
    const box = document.getElementById('messagesBox');
    const scrollBtn = document.getElementById('scrollToBottomBtn');
    if (box) {
        box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
        userHasScrolledUp = false;
        if (scrollBtn) scrollBtn.classList.remove('visible');
    }
}

function handleInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleChatSubmit(e);
    }
}

function usePrompt(text) {
    const input = document.getElementById('chatMessageInput');
    if (input) {
        input.value = text;
        input.style.height = '38px';
        input.style.height = Math.min(input.scrollHeight, 140) + 'px';
        input.focus();
    }
}

function useSuggestedChip(text) {
    usePrompt(text);
    handleChatSubmit(new Event('submit'));
}

function updateWelcomeScreenVisibility() {
    const welcome = document.getElementById('welcomeScreen');
    const box = document.getElementById('messagesBox');
    if (!welcome || !box) return;

    if (currentConversationHistory.length === 0) {
        welcome.classList.remove('hidden');
        box.style.display = 'none';
    } else {
        welcome.classList.add('hidden');
        box.style.display = 'flex';
    }
}

/**
 * Handle sending message with Stop Generating support & multi-turn memory
 */
async function handleChatSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    // If already generating, clicking the button triggers "Stop Generating"
    if (isProcessing) {
        stopGenerating();
        return;
    }

    const input = document.getElementById('chatMessageInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    // Reset input immediately
    if (input) {
        input.value = '';
        input.style.height = '38px';
    }

    // Set processing and stop button state
    isProcessing = true;
    setSendButtonState(true);

    // Add user message to history and render
    currentConversationHistory.push({ role: 'user', content: text });
    updateWelcomeScreenVisibility();
    renderConversation();

    if (!userHasScrolledUp) {
        scrollToBottomSmooth();
    }

    const thinkingEl = appendThinkingIndicator();
    activeAbortController = new AbortController();

    try {
        let sendLang = (typeof I18n !== 'undefined') ? I18n.getCurrentLanguage() : 'auto';
        if (sendLang === 'auto' && typeof I18n !== 'undefined') {
            sendLang = I18n.detectLanguage(text);
        }

        // Send last 10 turns of history for context-awareness (Pronouns, budgets, changes)
        const historyPayload = currentConversationHistory.slice(0, -1).slice(-10).map(m => ({
            role: m.role,
            content: m.content
        }));

        const payload = {
            message: text,
            chatId: currentChatId,
            language: sendLang,
            history: historyPayload
        };

        const res = await Api.post('/chat', payload, { signal: activeAbortController.signal });

        if (thinkingEl && thinkingEl.parentNode) {
            thinkingEl.remove();
        }

        if (res && res.chatId) {
            currentChatId = res.chatId;
        }

        const replyText = res.response || res.message || "I couldn't process that query. Please try another place.";
        const destination = res.destination || null;

        // Add assistant response to conversation history
        currentConversationHistory.push({
            role: 'assistant',
            content: replyText,
            destination: destination
        });

        renderConversation();
        persistCurrentSession();

        if (!userHasScrolledUp) {
            scrollToBottomSmooth();
        }
    } catch (err) {
        if (thinkingEl && thinkingEl.parentNode) {
            thinkingEl.remove();
        }

        if (err.name === 'AbortError') {
            // User aborted the response cleanly
            currentConversationHistory.push({
                role: 'assistant',
                content: '_[Response generation stopped by user]_'
            });
            renderConversation();
            persistCurrentSession();
        } else {
            console.error('Chat error:', err);
            const friendlyMsg = getFriendlyError(err);
            currentConversationHistory.push({
                role: 'assistant',
                content: friendlyMsg
            });
            renderConversation();
        }
    } finally {
        isProcessing = false;
        activeAbortController = null;
        setSendButtonState(false);
        if (input) input.focus();
    }
}

function stopGenerating() {
    if (activeAbortController) {
        activeAbortController.abort();
    }
}

function setSendButtonState(generating) {
    const sendBtn = document.getElementById('sendBtn');
    const sendIcon = document.getElementById('sendBtnIcon');
    if (!sendBtn || !sendIcon) return;

    if (generating) {
        sendBtn.classList.add('is-generating');
        sendBtn.title = 'Stop generating';
        sendIcon.className = 'fas fa-stop';
    } else {
        sendBtn.classList.remove('is-generating');
        sendBtn.title = 'Send Message';
        sendIcon.className = 'fas fa-paper-plane';
    }
}

/**
 * Re-renders the entire message stream from currentConversationHistory
 */
function renderConversation() {
    const box = document.getElementById('messagesBox');
    if (!box) return;

    box.innerHTML = '';

    currentConversationHistory.forEach((msg, index) => {
        if (msg.role === 'user') {
            const userRow = createUserMessageElement(msg.content, index);
            box.appendChild(userRow);
        } else {
            const aiRow = createAssistantMessageElement(msg.content, msg.destination, index);
            box.appendChild(aiRow);
        }
    });

    updateWelcomeScreenVisibility();
}

function createUserMessageElement(text, index) {
    const row = document.createElement('div');
    row.className = 'msg-row user';

    const wrap = document.createElement('div');
    wrap.className = 'msg-bubble-wrap';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'user-edit-btn';
    editBtn.title = 'Edit and resubmit message';
    editBtn.innerHTML = '<i class="fas fa-pencil"></i> Edit';
    editBtn.addEventListener('click', () => editUserMessage(index));

    wrap.appendChild(bubble);
    wrap.appendChild(editBtn);

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar usr';
    avatar.innerHTML = '<i class="fas fa-user"></i>';

    row.appendChild(wrap);
    row.appendChild(avatar);

    return row;
}

function createAssistantMessageElement(markdownText, destination, index) {
    const row = document.createElement('div');
    row.className = 'msg-row assistant';

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar ai';
    avatar.innerHTML = '<i class="fas fa-compass"></i>';

    const wrap = document.createElement('div');
    wrap.className = 'msg-bubble-wrap';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    let contentHtml = formatMarkdown(markdownText);

    // If a destination was detected or returned, add interactive destination card
    if (destination && destination.name) {
        const destImg = (destination.images && destination.images[0]) || 
            (typeof window.getDestinationImage === 'function' ? window.getDestinationImage(destination.name) : 'assets/dash.jpg');

        contentHtml += `
            <div class="chat-dest-preview-card">
                <img src="${escapeHtml(destImg)}" alt="${escapeHtml(destination.name)}" data-dest="${escapeHtml(destination.name)}" loading="lazy">
                <div style="padding:14px;">
                    <h4 style="margin:0 0 6px 0; color:var(--text-main); font-size:15px; font-weight:700;">
                        <i class="fas fa-location-dot" style="color:var(--accent-gold);"></i> ${escapeHtml(destination.name)}
                    </h4>
                    ${destination.famousFor || destination.description ? `<p style="margin:0 0 12px 0; font-size:13px; color:var(--text-muted); line-height:1.5;">${escapeHtml(destination.famousFor || destination.description)}</p>` : ''}
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-primary btn-sm js-plan-dest" data-dest="${escapeHtml(destination.name)}">
                            <i class="fas fa-calendar-alt"></i> Plan Full Trip
                        </button>
                        <a href="destinations.html?view=${encodeURIComponent(destination.name)}" class="btn btn-outline btn-sm">
                            <i class="fas fa-eye"></i> View Destination
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    bubble.innerHTML = contentHtml;

    // Action bar beneath bubble
    const actionsRow = document.createElement('div');
    actionsRow.className = 'msg-actions-row';

    actionsRow.innerHTML = `
        <button type="button" class="msg-action-btn" onclick="copyAiResponse(this)"><i class="fas fa-copy"></i> Copy</button>
        <button type="button" class="msg-action-btn" onclick="regenerateResponse(${index})"><i class="fas fa-rotate-right"></i> Regenerate</button>
        <button type="button" class="msg-action-btn tts-speak-btn" onclick="Voice.toggleSpeech(this)" title="Read Aloud"><i class="fas fa-volume-up"></i> Listen</button>
        <button type="button" class="msg-action-btn" onclick="shareAiResponse()"><i class="fas fa-share-nodes"></i> Share</button>
    `;

    bubble.appendChild(actionsRow);
    wrap.appendChild(bubble);

    row.appendChild(avatar);
    row.appendChild(wrap);

    // Event listeners
    row.querySelectorAll('.js-plan-dest').forEach(btn => {
        btn.addEventListener('click', () => {
            const dest = btn.dataset.dest;
            if (dest) openPlannerFor(dest);
        });
    });

    const cardImg = row.querySelector('.chat-dest-preview-card img');
    if (cardImg) {
        cardImg.addEventListener('error', () => {
            if (typeof window.handleImageError === 'function') {
                window.handleImageError(cardImg, cardImg.dataset.dest);
            }
        });
    }

    return row;
}

function appendThinkingIndicator() {
    const box = document.getElementById('messagesBox');
    if (!box) return null;

    const row = document.createElement('div');
    row.className = 'msg-row assistant';
    row.id = 'thinkingRow';
    row.innerHTML = `
        <div class="msg-avatar ai"><i class="fas fa-compass"></i></div>
        <div class="msg-bubble-wrap">
            <div class="thinking-bubble">
                <span>TouristAI is crafting your response</span>
                <div class="dot-flashing"></div>
            </div>
        </div>
    `;
    box.appendChild(row);

    if (!userHasScrolledUp) {
        scrollToBottomSmooth();
    }
    return row;
}

/**
 * Edit a previous user message: forks conversation from that turn
 */
function editUserMessage(index) {
    if (isProcessing) return;
    if (index < 0 || index >= currentConversationHistory.length) return;

    const targetMsg = currentConversationHistory[index];
    if (!targetMsg || targetMsg.role !== 'user') return;

    const input = document.getElementById('chatMessageInput');
    if (input) {
        input.value = targetMsg.content;
        input.style.height = '38px';
        input.style.height = Math.min(input.scrollHeight, 140) + 'px';
        input.focus();
    }

    // Truncate conversation history to before this turn
    currentConversationHistory = currentConversationHistory.slice(0, index);
    renderConversation();
    persistCurrentSession();
}

/**
 * Regenerate response: drops the assistant message and re-runs the previous user query
 */
function regenerateResponse(assistantIndex) {
    if (isProcessing) return;
    if (assistantIndex <= 0 || assistantIndex >= currentConversationHistory.length) return;

    const prevUserMsg = currentConversationHistory[assistantIndex - 1];
    if (!prevUserMsg || prevUserMsg.role !== 'user') return;

    // Remove the current assistant message
    currentConversationHistory.splice(assistantIndex, 1);
    // Remove the user message as well because handleChatSubmit will re-append it
    currentConversationHistory.splice(assistantIndex - 1, 1);

    usePrompt(prevUserMsg.content);
    handleChatSubmit(new Event('submit'));
}

function copyAiResponse(btn) {
    const bubble = btn.closest('.msg-bubble');
    if (!bubble) return;

    // Extract text without action bar text
    const clone = bubble.cloneNode(true);
    const actions = clone.querySelector('.msg-actions-row');
    if (actions) actions.remove();
    const destCard = clone.querySelector('.chat-dest-preview-card');
    if (destCard) destCard.remove();

    const textToCopy = clone.innerText.trim();

    navigator.clipboard.writeText(textToCopy).then(() => {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check" style="color:#10B981;"></i> Copied!';
        setTimeout(() => { btn.innerHTML = orig; }, 1800);
    }).catch(() => {
        alert('Copied response to clipboard.');
    });
}

function shareAiResponse() {
    const lastUser = currentConversationHistory.filter(m => m.role === 'user').pop();
    const title = lastUser ? `TouristAI: ${lastUser.content}` : 'TouristAI Travel Plan';

    if (navigator.share) {
        navigator.share({
            title: title,
            text: 'Explore this custom AI travel guide on TouristAI!',
            url: window.location.href
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
            alert('Link copied to clipboard!');
        });
    }
}

/**
 * Start a fresh conversation
 */
function startNewChat() {
    if (isProcessing) stopGenerating();

    currentChatId = null;
    currentConversationHistory = [];
    userHasScrolledUp = false;

    renderConversation();
    updateWelcomeScreenVisibility();

    // Deselect active chat in sidebar
    document.querySelectorAll('.recent-chat-item').forEach(el => el.classList.remove('active'));

    const input = document.getElementById('chatMessageInput');
    if (input) {
        input.value = '';
        input.style.height = '38px';
        input.focus();
    }

    toggleSidebar(false);
}

/**
 * Persist current session for guest or update sidebar
 */
function persistCurrentSession() {
    if (!currentConversationHistory.length) return;

    if (Auth.isAuthenticated()) {
        loadRecentChats();
    } else {
        // Save to guest chats in localStorage
        if (!currentChatId) {
            currentChatId = 'guest_' + Date.now();
        }

        let guestChats = getGuestChats();
        let existing = guestChats.find(c => c.id === currentChatId);

        const firstUser = currentConversationHistory.find(m => m.role === 'user');
        const title = firstUser ? (firstUser.content.length > 32 ? firstUser.content.slice(0, 32) + '…' : firstUser.content) : 'Travel Plan';

        if (!existing) {
            existing = {
                id: currentChatId,
                title: title,
                messages: currentConversationHistory,
                updatedAt: Date.now()
            };
            guestChats.unshift(existing);
        } else {
            existing.messages = currentConversationHistory;
            existing.updatedAt = Date.now();
        }

        if (guestChats.length > 25) guestChats = guestChats.slice(0, 25);
        localStorage.setItem('tourist_guest_chats', JSON.stringify(guestChats));
        renderRecentChatsList(guestChats, false);
    }
}

function getGuestChats() {
    try {
        return JSON.parse(localStorage.getItem('tourist_guest_chats') || '[]');
    } catch (e) {
        return [];
    }
}

/**
 * Load recent chats from server (if authenticated) or localStorage (if guest)
 */
async function loadRecentChats() {
    const listEl = document.getElementById('recentChatsList');
    if (!listEl) return;

    if (Auth.isAuthenticated()) {
        try {
            const res = await Api.get('/chat/history');
            const chats = res.chats || res.data?.chats || res || [];
            renderRecentChatsList(Array.isArray(chats) ? chats : [], true);
        } catch (e) {
            console.warn('Could not fetch server chat history:', e);
            renderRecentChatsList(getGuestChats(), false);
        }
    } else {
        renderRecentChatsList(getGuestChats(), false);
    }
}

function renderRecentChatsList(chats, isServer) {
    const listEl = document.getElementById('recentChatsList');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (!chats || chats.length === 0) {
        listEl.innerHTML = `
            <div style="padding:12px 10px; font-size:12px; color:var(--text-dim); text-align:center;">
                No saved chats yet. Start a conversation above!
            </div>
        `;
        return;
    }

    chats.forEach(c => {
        const item = document.createElement('div');
        item.className = `recent-chat-item ${c.id === currentChatId ? 'active' : ''}`;
        item.dataset.chatId = c.id;

        const titleGroup = document.createElement('div');
        titleGroup.className = 'recent-chat-title-group';
        titleGroup.innerHTML = `<i class="fas fa-message"></i><span class="recent-chat-title-text">${escapeHtml(c.title || 'Travel Plan')}</span>`;
        titleGroup.addEventListener('click', () => loadChatSession(c.id, isServer));

        const actions = document.createElement('div');
        actions.className = 'recent-chat-actions';

        // Rename Button
        const renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'chat-item-action-btn';
        renameBtn.title = 'Rename Conversation';
        renameBtn.innerHTML = '<i class="fas fa-pen"></i>';
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            promptRenameChat(c.id, c.title || 'Travel Plan', isServer);
        });

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'chat-item-action-btn delete-btn';
        deleteBtn.title = 'Delete Conversation';
        deleteBtn.innerHTML = '<i class="fas fa-trash-can"></i>';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDeleteSingleChat(c.id, c.title || 'Travel Plan', isServer);
        });

        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(titleGroup);
        item.appendChild(actions);
        listEl.appendChild(item);
    });
}

async function loadChatSession(chatId, isServer) {
    currentChatId = chatId;
    toggleSidebar(false);

    if (isServer && Auth.isAuthenticated()) {
        try {
            const res = await Api.get(`/chat/${chatId}`);
            const messages = res.messages || res.data?.messages || [];
            currentConversationHistory = messages.map(m => ({
                role: m.role,
                content: m.content
            }));
            renderConversation();
            loadRecentChats();
            scrollToBottomSmooth();
        } catch (e) {
            console.error('Failed to load chat from server:', e);
            startNewChat();
        }
    } else {
        const guestChats = getGuestChats();
        const chat = guestChats.find(c => c.id === chatId);
        if (chat && chat.messages) {
            currentConversationHistory = chat.messages;
            renderConversation();
            renderRecentChatsList(guestChats, false);
            scrollToBottomSmooth();
        } else {
            startNewChat();
        }
    }
}

async function promptRenameChat(chatId, oldTitle, isServer) {
    const newTitle = prompt('Enter a new title for this conversation:', oldTitle);
    if (!newTitle || !newTitle.trim() || newTitle.trim() === oldTitle) return;

    const trimmed = newTitle.trim();

    if (isServer && Auth.isAuthenticated()) {
        try {
            await Api.put(`/chat/${chatId}/title`, { title: trimmed });
            loadRecentChats();
        } catch (e) {
            console.error('Failed to rename chat on server:', e);
            alert('Could not rename chat on server.');
        }
    } else {
        let guestChats = getGuestChats();
        const target = guestChats.find(c => c.id === chatId);
        if (target) {
            target.title = trimmed;
            localStorage.setItem('tourist_guest_chats', JSON.stringify(guestChats));
            renderRecentChatsList(guestChats, false);
        }
    }
}

function confirmDeleteSingleChat(chatId, title, isServer) {
    showConfirmModal(
        'Delete Conversation',
        `Are you sure you want to delete "${escapeHtml(title)}"?`,
        async () => {
            if (isServer && Auth.isAuthenticated()) {
                try {
                    await Api.delete(`/chat/${chatId}`);
                } catch (e) {
                    console.warn('Failed to delete chat on server:', e);
                }
            } else {
                let guestChats = getGuestChats();
                guestChats = guestChats.filter(c => c.id !== chatId);
                localStorage.setItem('tourist_guest_chats', JSON.stringify(guestChats));
            }

            if (currentChatId === chatId) {
                startNewChat();
            }
            loadRecentChats();
        }
    );
}

function confirmClearHistory() {
    showConfirmModal(
        'Clear All Conversations',
        'Are you sure you want to clear all your past conversation history? This cannot be undone.',
        async () => {
            if (Auth.isAuthenticated()) {
                try {
                    await Api.post('/chat/clear');
                } catch (e) {
                    console.warn('Failed to clear chats on server:', e);
                }
            } else {
                localStorage.removeItem('tourist_guest_chats');
            }
            startNewChat();
            loadRecentChats();
        }
    );
}

function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('modalTitle');
    const msgEl = document.getElementById('modalMessage');
    if (!modal || !titleEl || !msgEl) return;

    titleEl.textContent = title;
    msgEl.textContent = message;
    pendingModalAction = onConfirm;

    modal.classList.add('active');
}

function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.remove('active');
    pendingModalAction = null;
}

function executeModalAction() {
    if (typeof pendingModalAction === 'function') {
        pendingModalAction();
    }
    closeConfirmModal();
}

function toggleSidebar(open) {
    const sidebar = document.getElementById('chatSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !backdrop) return;

    if (open) {
        sidebar.classList.add('open');
        backdrop.classList.add('active');
    } else {
        sidebar.classList.remove('open');
        backdrop.classList.remove('active');
    }
}

function openPlannerFor(dest, days = 5, travelers = 2) {
    window.location.href = `planner.html?destination=${encodeURIComponent(dest)}&days=${days}&travelers=${travelers}`;
}

function exportChat() {
    if (!currentConversationHistory.length) {
        alert('There is no conversation to export yet.');
        return;
    }

    let text = "TouristAI Travel Conversation Export\n";
    text += "Exported on: " + new Date().toLocaleString() + "\n";
    text += "========================================================\n\n";

    currentConversationHistory.forEach(m => {
        const sender = m.role === 'user' ? 'YOU' : 'TOURISTAI CONCIERGE';
        text += `[${sender}]\n${m.content}\n\n--------------------------------------------------------\n\n`;
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TouristAI_Journey_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function getFriendlyError(err) {
    if (!err) return '🌐 Something went wrong. Please try again in a moment.';
    const status = err.status || (err.response && err.response.status);
    if (status === 401 || status === 403) {
        return '🔒 Your session has expired. Please [log in](login.html) again to continue chatting.';
    }
    if (status === 429) {
        return '⏳ The AI guide is receiving a lot of requests right now. Please wait a moment and try again.';
    }
    if (status >= 500) {
        return '🛠️ The server ran into an issue. Please try again in a minute.';
    }
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('timeout') || msg.includes('aborted') || msg.includes('network')) {
        return '📡 Couldn\'t reach the AI guide — please check your connection and try again.';
    }
    return '🌐 Something went wrong. Please try again or use the **Plan Trip** page for offline itineraries.';
}

function formatMarkdown(raw) {
    if (!raw) return '';
    let html = '';
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
        html = marked.parse(String(raw), { breaks: true, gfm: true });
    } else {
        html = escapeHtml(String(raw));
    }

    if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [
                'h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'em',
                'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'a', 'code', 'pre', 'blockquote', 'hr', 'span'
            ],
            ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class', 'style']
        });
    }

    return html;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function updatePromptChips() {
    const tray = document.getElementById('chipsTray');
    if (!tray) return;

    const prompts = [
        '🏔️ Chennai → Ooty under ₹8K',
        '🌴 5 Days Kerala Backwaters',
        '☀️ Manali Weather & Season',
        '🚂 Transit from Madurai to Kodaikanal',
        '🗼 Paris on a Modest Budget',
        '🍛 Chennai la irundhu 3 days trip'
    ];

    tray.innerHTML = '';
    prompts.forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'prompt-chip';
        btn.textContent = p;
        btn.addEventListener('click', () => {
            // Strip leading emoji
            const clean = p.replace(/^[\p{Emoji}\s]+/u, '').trim();
            useSuggestedChip(clean);
        });
        tray.appendChild(btn);
    });
}

// Global window mappings
window.handleChatSubmit = handleChatSubmit;
window.handleInputKeydown = handleInputKeydown;
window.useSuggestedChip = useSuggestedChip;
window.copyAiResponse = copyAiResponse;
window.regenerateResponse = regenerateResponse;
window.editUserMessage = editUserMessage;
window.shareAiResponse = shareAiResponse;
window.startNewChat = startNewChat;
window.confirmClearHistory = confirmClearHistory;
window.closeConfirmModal = closeConfirmModal;
window.executeModalAction = executeModalAction;
window.toggleSidebar = toggleSidebar;
window.exportChat = exportChat;
window.scrollToBottomSmooth = scrollToBottomSmooth;
window.openPlannerFor = openPlannerFor;
