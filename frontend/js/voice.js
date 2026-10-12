// @ts-nocheck
/**
 * TouristAI — Voice Engine (Speech-to-Text & Text-to-Speech)
 * Supports all 26 languages via Web Speech API with native speechCode mappings,
 * mic recording animations, permission handling, markdown cleaning, and audio controls.
 */

const Voice = {
    recognition: null,
    isRecording: false,
    currentUtterance: null,
    activePlayButton: null,

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            return null;
        }

        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = true;
        recog.maxAlternatives = 1;

        recog.onstart = () => {
            this.isRecording = true;
            this.updateMicUI(true, 'Listening… speak now');
        };

        recog.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const input = document.getElementById('chatMessageInput');
            if (input) {
                const text = finalTranscript || interimTranscript;
                input.value = text;
                input.style.height = '38px';
                input.style.height = Math.min(input.scrollHeight, 140) + 'px';
            }
        };

        recog.onerror = (event) => {
            console.warn('Speech recognition error:', event.error);
            this.isRecording = false;
            let errMsg = 'Voice recognition error';
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                errMsg = 'Microphone permission denied. Please allow microphone access.';
            } else if (event.error === 'no-speech') {
                errMsg = 'No speech detected. Please try again.';
            }
            this.updateMicUI(false, errMsg);
            this.showVoiceToast(errMsg, 'warning');
        };

        recog.onend = () => {
            this.isRecording = false;
            this.updateMicUI(false);
            const input = document.getElementById('chatMessageInput');
            if (input && input.value.trim()) {
                input.focus();
            }
        };

        return recog;
    },

    toggleRecognition() {
        if (this.isRecording) {
            this.stopRecognition();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.showVoiceToast('Speech recognition is not supported in this browser. Try Chrome or Edge.', 'warning');
            return;
        }

        if (!this.recognition) {
            this.recognition = this.initSpeechRecognition();
        }

        if (!this.recognition) return;

        // Resolve active language speech code
        let speechCode = 'en-US';
        if (typeof I18n !== 'undefined') {
            const currentLang = I18n.getCurrentLanguage();
            if (currentLang !== 'auto') {
                const meta = I18n.getLanguageMeta(currentLang);
                if (meta && meta.speechCode) speechCode = meta.speechCode;
            } else {
                // If auto, try default browser language or en-US/ta-IN
                speechCode = navigator.language || 'en-US';
            }
        }

        this.recognition.lang = speechCode;

        try {
            this.recognition.start();
        } catch (err) {
            console.warn('Failed to start speech recognition:', err);
            this.stopRecognition();
        }
    },

    stopRecognition() {
        if (this.recognition && this.isRecording) {
            try {
                this.recognition.stop();
            } catch (e) {}
        }
        this.isRecording = false;
        this.updateMicUI(false);
    },

    updateMicUI(recording, tooltipText) {
        const btn = document.getElementById('voiceMicBtn');
        if (!btn) return;

        if (recording) {
            btn.classList.add('recording');
            btn.setAttribute('title', tooltipText || 'Listening… click to cancel');
            btn.innerHTML = '<i class="fas fa-stop"></i>';
        } else {
            btn.classList.remove('recording');
            btn.setAttribute('title', tooltipText || 'Speak your question');
            btn.innerHTML = '<i class="fas fa-microphone"></i>';
        }
    },

    // Text-to-Speech (TTS)
    cleanMarkdownForSpeech(text) {
        if (!text) return '';
        return text
            .replace(/```[\s\S]*?```/g, ' ') // Code blocks
            .replace(/`([^`]+)`/g, '$1') // Inline code
            .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
            .replace(/\*([^*]+)\*/g, '$1') // Italic
            .replace(/#{1,6}\s+/g, '') // Headings
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
            .replace(/[-*•]\s+/g, '') // List bullets
            .replace(/\|[^\n]+\|/g, '') // Table rows
            .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Emojis
            .replace(/₹/g, 'Rupees ')
            .replace(/\$/g, 'Dollars ')
            .replace(/€/g, 'Euros ')
            .replace(/\s{2,}/g, ' ')
            .trim();
    },

    toggleSpeech(btn) {
        if (!('speechSynthesis' in window)) {
            this.showVoiceToast('Text-to-speech is not supported on this browser.', 'warning');
            return;
        }

        // If currently playing on this button, stop or pause
        if (window.speechSynthesis.speaking && this.activePlayButton === btn) {
            this.stopSpeech();
            return;
        }

        // Stop any ongoing speech first
        this.stopSpeech();

        const bubble = btn.closest('.msg-bubble');
        if (!bubble) return;

        // Extract raw assistant text
        const clone = bubble.cloneNode(true);
        // Remove action buttons from clone
        const actions = clone.querySelector('.msg-actions-row');
        if (actions) actions.remove();
        const fullText = this.cleanMarkdownForSpeech(clone.innerText);

        if (!fullText) return;

        // Truncate to first 500 characters or 3 sentences for comfortable listening
        const spokenSnippet = fullText.length > 600 ? fullText.substring(0, 600) + '...' : fullText;

        const utterance = new SpeechSynthesisUtterance(spokenSnippet);

        // Detect language or use active language
        let langCode = 'en-US';
        if (typeof I18n !== 'undefined') {
            const currentLang = I18n.getCurrentLanguage();
            if (currentLang !== 'auto') {
                const meta = I18n.getLanguageMeta(currentLang);
                if (meta && meta.speechCode) langCode = meta.speechCode;
            } else {
                const detected = I18n.detectLanguage(fullText);
                const meta = I18n.getLanguageMeta(detected);
                if (meta && meta.speechCode) langCode = meta.speechCode;
            }
        }

        utterance.lang = langCode;

        // Voice picking
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
            const matchedVoice = voices.find(v => v.lang.toLowerCase() === langCode.toLowerCase() || v.lang.startsWith(langCode.split('-')[0]));
            if (matchedVoice) {
                utterance.voice = matchedVoice;
            }
        }

        utterance.onstart = () => {
            this.activePlayButton = btn;
            btn.classList.add('active');
            btn.innerHTML = '<i class="fas fa-stop"></i> Stop';
        };

        utterance.onend = () => {
            this.stopSpeech();
        };

        utterance.onerror = (e) => {
            console.warn('TTS error:', e);
            this.stopSpeech();
        };

        this.currentUtterance = utterance;
        window.speechSynthesis.speak(utterance);
    },

    stopSpeech() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        if (this.activePlayButton) {
            this.activePlayButton.classList.remove('active');
            this.activePlayButton.innerHTML = '<i class="fas fa-volume-up"></i> Listen';
            this.activePlayButton = null;
        }
        this.currentUtterance = null;
    },

    showVoiceToast(msg, type = 'info') {
        let toast = document.getElementById('voiceStatusToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'voiceStatusToast';
            toast.className = 'voice-status-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.className = `voice-status-toast show ${type}`;
        setTimeout(() => {
            toast.className = 'voice-status-toast';
        }, 3200);
    }
};

// Initialize voice voices list
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        // Pre-warm voices
        window.speechSynthesis.getVoices();
    };
}
