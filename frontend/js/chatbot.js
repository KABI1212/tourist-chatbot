// @ts-nocheck
/**
 * TouristAI — Chat Controller (Screen 2)
 * Supports live Gemini backend, multi-turn history, guest chatting, deduplication, and rich itinerary cards
 */

let currentChatId = null;
let isProcessing = false;
let lastUserMessage = '';

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chatMessageInput');
    const form = document.getElementById('chatForm') || document.getElementById('chatInputForm');

    if (input) {
        input.addEventListener('input', () => {
            input.style.height = '38px';
            input.style.height = Math.min(input.scrollHeight, 140) + 'px';
        });
    }

    if (form) {
        form.addEventListener('submit', handleChatSubmit);
    }

    // Load recent chats if logged in
    loadRecentChats();

    // Check for query param prompt or pending prompt
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
        }, 350);
    }
});

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
        input.focus();
    }
}

function useSuggestedChip(text) {
    usePrompt(text);
    handleChatSubmit(new Event('submit'));
}

function openPlannerFor(dest, days = 5, travelers = 2) {
    window.location.href = `planner.html?destination=${encodeURIComponent(dest)}&days=${days}&travelers=${travelers}`;
}

async function handleChatSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (isProcessing) return;

    const input = document.getElementById('chatMessageInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    // Atomic lock to prevent duplicate submission
    isProcessing = true;
    lastUserMessage = text;

    // Reset input immediately
    if (input) {
        input.value = '';
        input.style.height = '38px';
    }

    // Append user message with deduplication
    appendUserBubble(text);

    const sendBtn = document.getElementById('sendBtn') || document.getElementById('chatSendBtn');
    if (sendBtn) sendBtn.disabled = true;

    const thinkingEl = appendThinkingIndicator();

    try {
        let sendLang = (typeof I18n !== 'undefined') ? I18n.getCurrentLanguage() : 'auto';
        if (sendLang === 'auto' && typeof I18n !== 'undefined') {
            sendLang = I18n.detectLanguage(text);
        }

        const payload = {
            message: text,
            chatId: currentChatId,
            language: sendLang
        };

        const res = await Api.post('/chat', payload);
        thinkingEl.remove();

        if (res && res.chatId) {
            currentChatId = res.chatId;
        }

        const replyText = res.response || res.message || "I couldn't process that query. Please try another place.";
        const destination = res.destination || null;

        appendAiBubble(replyText, destination);

        // If logged in, refresh history
        if (Auth.isAuthenticated()) {
            loadRecentChats();
        }
    } catch (err) {
        thinkingEl.remove();
        console.error('Chat error:', err);
        const friendlyMsg = getFriendlyError(err);
        appendAiBubble(friendlyMsg);
    } finally {
        isProcessing = false;
        if (sendBtn) sendBtn.disabled = false;
        if (input) input.focus();
    }
}

/** M8: Map network/API errors to friendly user-facing text. Technical details are only in the console. */
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

// Backward compatibility alias
function handleSend(e) {
    return handleChatSubmit(e);
}

function appendUserBubble(text) {
    const box = document.getElementById('messagesBox');
    if (!box) return;

    // Deduplication guard
    const lastMsg = box.lastElementChild;
    if (lastMsg && lastMsg.classList.contains('user')) {
        const lastBubble = lastMsg.querySelector('.msg-bubble');
        if (lastBubble && lastBubble.textContent.trim() === text.trim()) {
            console.warn('Duplicate user prompt prevented:', text);
            return;
        }
    }

    const row = document.createElement('div');
    row.className = 'msg-row user';
    row.innerHTML = `
        <div class="msg-bubble"></div>
        <div class="msg-avatar usr"><i class="fas fa-user"></i></div>
    `;
    const bubble = row.querySelector('.msg-bubble');
    if (bubble) bubble.textContent = text;
    box.appendChild(row);
    scrollToBottom();
}

function appendThinkingIndicator() {
    const box = document.getElementById('messagesBox');
    const row = document.createElement('div');
    row.className = 'msg-row assistant';
    row.id = 'thinkingRow';
    row.innerHTML = `
        <div class="msg-avatar ai"><i class="fas fa-compass"></i></div>
        <div class="thinking-bubble">
            <span>TouristAI is crafting your travel plan</span>
            <div class="dot-flashing"></div>
        </div>
    `;
    box.appendChild(row);
    scrollToBottom();
    return row;
}

function appendAiBubble(markdownText, destination) {
    const box = document.getElementById('messagesBox');
    if (!box) return;

    // Deduplication guard for AI response
    const lastMsg = box.lastElementChild;
    if (lastMsg && lastMsg.classList.contains('assistant') && !lastMsg.id) {
        const lastBubble = lastMsg.querySelector('.msg-bubble');
        if (lastBubble && lastBubble.textContent.trim() === markdownText.trim()) {
            console.warn('Duplicate AI message prevented');
            return;
        }
    }

    const row = document.createElement('div');
    row.className = 'msg-row assistant';

    let contentHtml = formatMarkdown(markdownText);

    // If a destination was detected or itinerary mentioned, add rich destination card with image
    if (destination && destination.name) {
        const destImg = (destination.images && destination.images[0]) || (typeof window.getDestinationImage === 'function' ? window.getDestinationImage(destination.name) : 'assets/dash.jpg');
        contentHtml += `
            <div class="chat-dest-preview-card" style="margin-top:14px; border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden; background:var(--bg-surface);">
                <img src="${escapeHtml(destImg)}" alt="${escapeHtml(destination.name)}" style="width:100%; height:160px; object-fit:cover; display:block;" data-dest="${escapeHtml(destination.name)}" loading="lazy">
                <div style="padding:14px;">
                    <h4 style="margin:0 0 6px 0; color:var(--text-main); font-size:15px; font-weight:700;"><i class="fas fa-location-dot" style="color:var(--accent-gold);"></i> ${escapeHtml(destination.name)}</h4>
                    ${destination.famousFor || destination.description ? `<p style="margin:0 0 12px 0; font-size:13px; color:var(--text-muted); line-height:1.5;">${escapeHtml(destination.famousFor || destination.description)}</p>` : ''}
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-primary btn-sm js-plan-dest" data-dest="${escapeHtml(destination.name)}">
                            <i class="fas fa-calendar-alt"></i> Plan Full Trip to ${escapeHtml(destination.name)}
                        </button>
                        <a href="destinations.html?view=${encodeURIComponent(destination.name)}" class="btn btn-outline btn-sm">
                            <i class="fas fa-eye"></i> View Destination Details
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    row.innerHTML = `
        <div class="msg-avatar ai"><i class="fas fa-compass"></i></div>
        <div class="msg-bubble">
            ${contentHtml}
            <div class="msg-actions-row" style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                <button type="button" class="msg-action-btn tts-speak-btn" onclick="Voice.toggleSpeech(this)" title="Read Aloud"><i class="fas fa-volume-up"></i> Listen</button>
                <button type="button" class="msg-action-btn" onclick="copyAiResponse(this)"><i class="fas fa-copy"></i> Copy</button>
                <button type="button" class="msg-action-btn" onclick="retryAiResponse()"><i class="fas fa-rotate-right"></i> Retry</button>
                <button type="button" class="msg-action-btn" onclick="shareAiResponse()"><i class="fas fa-share-nodes"></i> Share</button>
            </div>
        </div>
    `;

    box.appendChild(row);

    // Attach click listeners to destination planner buttons
    row.querySelectorAll('.js-plan-dest').forEach(btn => {
        btn.addEventListener('click', () => {
            const dest = btn.dataset.dest;
            if (dest) openPlannerFor(dest);
        });
    });

    // Attach image error fallback listener safely
    const cardImg = row.querySelector('.chat-dest-preview-card img');
    if (cardImg) {
        cardImg.addEventListener('error', () => {
            if (typeof window.handleImageError === 'function') {
                window.handleImageError(cardImg, cardImg.dataset.dest);
            }
        });
    }

    scrollToBottom();
}

function copyAiResponse(btn) {
    const bubble = btn.closest('.msg-bubble');
    if (!bubble) return;
    const textToCopy = bubble.innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => { btn.innerHTML = orig; }, 1500);
    }).catch(() => {
        alert('Copied response to clipboard.');
    });
}

function retryAiResponse() {
    if (lastUserMessage && !isProcessing) {
        usePrompt(lastUserMessage);
        handleChatSubmit(new Event('submit'));
    }
}

function shareAiResponse() {
    if (navigator.share) {
        navigator.share({
            title: 'TouristAI Travel Plan',
            text: lastUserMessage ? `AI Itinerary for: ${lastUserMessage}` : 'Check out this bespoke AI travel plan on TouristAI!'
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
            alert('Page link copied to clipboard!');
        });
    }
}

function scrollToBottom() {
    const box = document.getElementById('messagesBox');
    if (box) {
        box.scrollTop = box.scrollHeight;
    }
}

function startNewChat() {
    currentChatId = null;
    const box = document.getElementById('messagesBox');
    if (box) {
        box.innerHTML = `
            <div class="msg-row assistant">
                <div class="msg-avatar ai"><i class="fas fa-compass"></i></div>
                <div class="msg-bubble">
                    <p style="font-weight:600; margin-bottom:6px; color:var(--text-main);">Hello! I'm your TouristAI Travel Concierge. 🌴</p>
                    <p style="color:var(--text-muted);">Where are you looking to travel? Ask me about multi-day itineraries, budgets, transit options, scenic attractions, or packing tips!</p>
                </div>
            </div>
        `;
    }
}

async function loadRecentChats() {
    const listEl = document.getElementById('recentChatsList');
    if (!listEl) return;

    if (!Auth.isAuthenticated()) {
        return;
    }

    try {
        const res = await Api.get('/chat/history');
        const chats = res.chats || res.data?.chats || res;
        if (Array.isArray(chats) && chats.length > 0) {
            listEl.innerHTML = '';
            chats.forEach(c => {
                const item = document.createElement('div');
                item.className = `recent-chat-item ${c.id === currentChatId ? 'active' : ''}`;
                item.dataset.chatId = c.id || '';
                const icon = document.createElement('i');
                icon.className = 'fas fa-message';
                item.appendChild(icon);
                item.appendChild(document.createTextNode(' ' + (c.title || 'Travel Inquiry')));
                item.addEventListener('click', () => {
                    if (item.dataset.chatId) loadChatSession(item.dataset.chatId);
                });
                listEl.appendChild(item);
            });
        }
    } catch (e) {
        console.warn('Could not load chat history:', e);
    }
}

async function loadChatSession(chatId) {
    currentChatId = chatId;
    const box = document.getElementById('messagesBox');
    if (!box) return;

    box.innerHTML = '<div style="padding:20px; color:var(--text-muted); font-size:14px;">Loading conversation…</div>';

    try {
        const res = await Api.get(`/chat/${chatId}`);
        const messages = res.messages || res.data?.messages || [];
        box.innerHTML = '';

        if (messages.length === 0) {
            startNewChat();
            return;
        }

        messages.forEach(m => {
            if (m.role === 'user') {
                appendUserBubble(m.content);
            } else {
                appendAiBubble(m.content);
            }
        });
        loadRecentChats();
    } catch (e) {
        console.error('Failed to load chat:', e);
        startNewChat();
    }
}

function loadSampleChat(type) {
    if (type === 'ooty_budget') {
        usePrompt('Plan a 3-day trip from Chennai to Ooty for two people under ₹8,000, including transportation, hotels, food, sightseeing, and a complete itinerary.');
        handleChatSubmit(new Event('submit'));
    } else if (type === 'kerala') {
        usePrompt('5 Days Kerala Backwaters itinerary for 2 people with houseboat experience and budget breakdown');
        handleChatSubmit(new Event('submit'));
    } else if (type === 'manali') {
        usePrompt('Manali Adventure Budget for 5 days: snow sports, Rohtang Pass, stay and transport from Delhi');
        handleChatSubmit(new Event('submit'));
    } else if (type === 'goa') {
        usePrompt('4 Days Goa Heritage & Beaches itinerary with couple friendly budget stays');
        handleChatSubmit(new Event('submit'));
    }
}

async function clearChatHistory() {
    if (!confirm('Are you sure you want to clear this conversation?')) return;
    if (Auth.isAuthenticated() && currentChatId) {
        try {
            await Api.delete(`/chat/${currentChatId}`);
        } catch (e) {
            console.warn('Could not delete chat session on server:', e);
        }
    }
    startNewChat();
    loadRecentChats();
}

function exportChat() {
    const box = document.getElementById('messagesBox');
    if (!box) return;
    const bubbles = box.querySelectorAll('.msg-bubble');
    let text = "TouristAI Travel Chat Export\n" + new Date().toLocaleString() + "\n====================================\n\n";
    bubbles.forEach(b => {
        text += b.innerText + "\n\n--------------------\n\n";
    });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TouristAI_Chat_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
                'a', 'code', 'pre', 'blockquote', 'hr'
            ],
            ALLOWED_ATTR: ['href', 'title', 'target', 'rel']
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

// Global exposure for inline events
window.handleChatSubmit = handleChatSubmit;
window.handleInputKeydown = handleInputKeydown;
window.useSuggestedChip = useSuggestedChip;
window.copyAiResponse = copyAiResponse;
window.retryAiResponse = retryAiResponse;
window.shareAiResponse = shareAiResponse;
window.startNewChat = startNewChat;
window.clearChatHistory = clearChatHistory;
window.exportChat = exportChat;
window.loadSampleChat = loadSampleChat;
window.loadChatSession = loadChatSession;
window.formatMarkdown = formatMarkdown;

function updatePromptChips() {
    const tray = document.getElementById('chipsTray');
    if (!tray || typeof I18n === 'undefined') return;

    const prompts = [
        I18n.t('chat_prompt_1', '🏔️ Plan a 3-day trip from Chennai to Ooty for 2 people under ₹8,000'),
        I18n.t('chat_prompt_2', '🌴 Best hidden beaches and backwaters in Kerala'),
        I18n.t('chat_prompt_3', '⛷️ 3-Day Manali itinerary for adventure lovers with budget'),
        I18n.t('chat_prompt_4', '🏖️ Best budget beach stay options in Goa for couples'),
        I18n.t('chat_prompt_5', '🚂 How to reach Ooty by train from Chennai or Bangalore?')
    ];

    tray.innerHTML = '';
    prompts.forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'prompt-chip';
        btn.textContent = p;
        btn.addEventListener('click', () => useSuggestedChip(p));
        tray.appendChild(btn);
    });
}

window.addEventListener('languageChanged', () => {
    updatePromptChips();
});

// Update prompts once DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updatePromptChips, 100);
});
