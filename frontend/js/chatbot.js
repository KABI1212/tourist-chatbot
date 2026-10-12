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
        usePrompt(decodeURIComponent(initialPrompt));
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
        appendAiBubble(`I encountered an issue connecting to the AI guide (${err.message || 'Server timeout'}). Here is a quick travel tip: You can also use our **Plan Trip** page to design custom itineraries directly!`);
    } finally {
        isProcessing = false;
        if (sendBtn) sendBtn.disabled = false;
        if (input) input.focus();
    }
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
        <div class="msg-bubble">${escapeHtml(text)}</div>
        <div class="msg-avatar usr"><i class="fas fa-user"></i></div>
    `;
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
                <img src="${destImg}" alt="${escapeHtml(destination.name)}" style="width:100%; height:160px; object-fit:cover; display:block;" onerror="window.handleImageError(this, '${escapeHtml(destination.name)}');" loading="lazy">
                <div style="padding:14px;">
                    <h4 style="margin:0 0 6px 0; color:var(--text-main); font-size:15px; font-weight:700;"><i class="fas fa-location-dot" style="color:var(--accent-gold);"></i> ${escapeHtml(destination.name)}</h4>
                    ${destination.famousFor || destination.description ? `<p style="margin:0 0 12px 0; font-size:13px; color:var(--text-muted); line-height:1.5;">${escapeHtml(destination.famousFor || destination.description)}</p>` : ''}
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <button class="btn btn-primary btn-sm" onclick="openPlannerFor('${escapeHtml(destination.name)}')">
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
                <button class="msg-action-btn tts-speak-btn" onclick="Voice.toggleSpeech(this)" title="Read Aloud"><i class="fas fa-volume-up"></i> Listen</button>
                <button class="msg-action-btn" onclick="copyAiResponse(this)"><i class="fas fa-copy"></i> Copy</button>
                <button class="msg-action-btn" onclick="retryAiResponse()"><i class="fas fa-rotate-right"></i> Retry</button>
                <button class="msg-action-btn" onclick="shareAiResponse()"><i class="fas fa-share-nodes"></i> Share</button>
            </div>
        </div>
    `;

    box.appendChild(row);
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
            listEl.innerHTML = chats.map(c => `
                <div class="recent-chat-item ${c.id === currentChatId ? 'active' : ''}" onclick="loadChatSession('${c.id}')">
                    <i class="fas fa-message"></i> ${escapeHtml(c.title || 'Travel Inquiry')}
                </div>
            `).join('');
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
    let out = raw;

    // Headers with theme-aware contrast
    out = out.replace(/^### (.*$)/gim, '<h4 style="margin:12px 0 6px; color:var(--text-main); font-weight:700;">$1</h4>');
    out = out.replace(/^## (.*$)/gim, '<h3 style="margin:14px 0 8px; color:var(--text-main); font-family:var(--font-display); font-size:20px; font-weight:700;">$1</h3>');

    // Bold & Italics
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Bullet lists
    out = out.replace(/^\* (.*$)/gim, '<li style="margin-left:18px; margin-bottom:4px;">$1</li>');
    out = out.replace(/^- (.*$)/gim, '<li style="margin-left:18px; margin-bottom:4px;">$1</li>');

    // Paragraph linebreaks
    out = out.replace(/\n\n/g, '<p style="margin-bottom:8px;"></p>');
    out = out.replace(/\n/g, '<br>');

    return out;
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

function updatePromptChips() {
    const tray = document.getElementById('chipsTray');
    if (!tray || typeof I18n === 'undefined') return;

    const p1 = I18n.t('chat_prompt_1', '🏔️ Plan a 3-day trip from Chennai to Ooty for 2 people under ₹8,000');
    const p2 = I18n.t('chat_prompt_2', '🌴 Best hidden beaches and backwaters in Kerala');
    const p3 = I18n.t('chat_prompt_3', '⛷️ 3-Day Manali itinerary for adventure lovers with budget');
    const p4 = I18n.t('chat_prompt_4', '🏖️ Best budget beach stay options in Goa for couples');
    const p5 = I18n.t('chat_prompt_5', '🚂 How to reach Ooty by train from Chennai or Bangalore?');

    const escapeParam = (s) => s.replace(/'/g, "\\'").replace(/"/g, '&quot;');

    tray.innerHTML = `
        <button class="prompt-chip" onclick="useSuggestedChip('${escapeParam(p1)}')">
            ${escapeHtml(p1)}
        </button>
        <button class="prompt-chip" onclick="useSuggestedChip('${escapeParam(p2)}')">
            ${escapeHtml(p2)}
        </button>
        <button class="prompt-chip" onclick="useSuggestedChip('${escapeParam(p3)}')">
            ${escapeHtml(p3)}
        </button>
        <button class="prompt-chip" onclick="useSuggestedChip('${escapeParam(p4)}')">
            ${escapeHtml(p4)}
        </button>
        <button class="prompt-chip" onclick="useSuggestedChip('${escapeParam(p5)}')">
            ${escapeHtml(p5)}
        </button>
    `;
}

window.addEventListener('languageChanged', () => {
    updatePromptChips();
});

// Update prompts once DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updatePromptChips, 100);
});
