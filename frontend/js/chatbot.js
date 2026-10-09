// @ts-nocheck
/**
 * TouristAI — Chat Controller (Screen 2)
 * Supports live Gemini backend, multi-turn history, guest chatting, and rich itinerary cards
 */

let currentChatId = null;
let isProcessing = false;

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chatMessageInput');
    const form = document.getElementById('chatInputForm');

    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
            }
        });

        input.addEventListener('input', () => {
            input.style.height = '44px';
            input.style.height = Math.min(input.scrollHeight, 140) + 'px';
        });
    }

    // Load recent chats if logged in
    loadRecentChats();

    // Check for pending prompt from other pages
    const pending = localStorage.getItem('pending_chat_prompt');
    if (pending) {
        localStorage.removeItem('pending_chat_prompt');
        usePrompt(pending);
        setTimeout(() => {
            handleSend(new Event('submit'));
        }, 300);
    }
});

function usePrompt(text) {
    const input = document.getElementById('chatMessageInput');
    if (input) {
        input.value = text;
        input.style.height = '44px';
        input.focus();
    }
}

function openPlannerFor(dest, days = 5, travelers = 2) {
    window.location.href = `planner.html?destination=${encodeURIComponent(dest)}&days=${days}&travelers=${travelers}`;
}

async function handleSend(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (isProcessing) return;

    const input = document.getElementById('chatMessageInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    // Append user message
    appendUserBubble(text);
    input.value = '';
    input.style.height = '44px';

    isProcessing = true;
    const sendBtn = document.getElementById('chatSendBtn');
    if (sendBtn) sendBtn.disabled = true;

    const thinkingEl = appendThinkingIndicator();

    try {
        const payload = {
            message: text,
            chatId: currentChatId
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

function appendUserBubble(text) {
    const box = document.getElementById('messagesBox');
    if (!box) return;

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
        <div class="msg-avatar ai"><i class="fas fa-tree"></i></div>
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

    const row = document.createElement('div');
    row.className = 'msg-row assistant';

    let contentHtml = formatMarkdown(markdownText);

    // If a destination was detected or itinerary mentioned, add rich action
    if (destination && destination.name) {
        contentHtml += `
            <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border); display:flex; gap:10px; flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" onclick="openPlannerFor('${escapeHtml(destination.name)}')">
                    <i class="fas fa-calendar-alt"></i> Plan Full Trip to ${escapeHtml(destination.name)}
                </button>
                <a href="destinations.html?view=${encodeURIComponent(destination.name)}" class="btn btn-outline btn-sm">
                    <i class="fas fa-eye"></i> View Destination Details
                </a>
            </div>
        `;
    }

    row.innerHTML = `
        <div class="msg-avatar ai"><i class="fas fa-tree"></i></div>
        <div class="msg-bubble">${contentHtml}</div>
    `;

    box.appendChild(row);
    scrollToBottom();
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
                <div class="msg-avatar ai"><i class="fas fa-tree"></i></div>
                <div class="msg-bubble">
                    <p style="font-weight:600; margin-bottom:6px;">Hello! I'm your TouristAI Travel Assistant. 🌴</p>
                    <p>Where are you looking to travel? Ask me about multi-day itineraries, budgets, scenic attractions, hotels, or packing tips!</p>
                </div>
            </div>
        `;
    }
}

async function loadRecentChats() {
    const listEl = document.getElementById('recentChatsList');
    if (!listEl) return;

    if (!Auth.isAuthenticated()) {
        // Keep default sample items for guests
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
    if (type === 'kerala') {
        const box = document.getElementById('messagesBox');
        box.innerHTML = `
            <div class="msg-row user">
                <div class="msg-bubble">Plan a 5 days trip to Kerala for 2 people</div>
                <div class="msg-avatar usr"><i class="fas fa-user"></i></div>
            </div>
            <div class="msg-row assistant">
                <div class="msg-avatar ai"><i class="fas fa-tree"></i></div>
                <div class="msg-bubble">
                    <p style="margin-bottom:10px; font-weight:600;">Here's a 5 days Kerala trip plan for 2 people:</p>
                    <div class="itinerary-chat-preview">
                        <ul class="itinerary-day-list">
                            <li class="itinerary-day-item"><span>🏝️</span><div><strong>Day 1:</strong> Arrive in Kochi - Local Sightseeing</div></li>
                            <li class="itinerary-day-item"><span>🍃</span><div><strong>Day 2:</strong> Munnar - Tea Gardens, Waterfalls</div></li>
                            <li class="itinerary-day-item"><span>🐘</span><div><strong>Day 3:</strong> Thekkady - Wildlife, Boating</div></li>
                            <li class="itinerary-day-item"><span>⛵</span><div><strong>Day 4:</strong> Alleppey - Houseboat Experience</div></li>
                            <li class="itinerary-day-item"><span>✈️</span><div><strong>Day 5:</strong> Departure from Kochi</div></li>
                        </ul>
                        <div class="budget-estimate-badge">Estimated Budget: ₹20,000 - ₹30,000 for 2 people</div>
                        <div>
                            <button class="btn-view-itinerary" onclick="openPlannerFor('Kerala', 5, 2)">
                                <i class="fas fa-calendar-alt"></i> View Detailed Itinerary
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'ooty') {
        usePrompt('Tell me about top attractions, weather and toy train in Ooty');
        handleSend();
    } else if (type === 'goa') {
        usePrompt('Best beaches and 4-day itinerary for Goa');
        handleSend();
    } else if (type === 'manali') {
        usePrompt('Budget breakdown for 5 days in Manali for 2 people');
        handleSend();
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

    // Headers
    out = out.replace(/^### (.*$)/gim, '<h4 style="margin:12px 0 6px; color:#fff;">$1</h4>');
    out = out.replace(/^## (.*$)/gim, '<h3 style="margin:14px 0 8px; color:#fff;">$1</h3>');

    // Bold & Italics
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Bullet lists
    out = out.replace(/^\* (.*$)/gim, '<li style="margin-left:18px;">$1</li>');
    out = out.replace(/^- (.*$)/gim, '<li style="margin-left:18px;">$1</li>');

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
