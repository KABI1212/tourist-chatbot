package com.tourist.chatbot.service;

import com.tourist.chatbot.dto.ChatRequest;
import com.tourist.chatbot.dto.ChatResponse;
import com.tourist.chatbot.exception.ResourceNotFoundException;
import com.tourist.chatbot.model.Chat;
import com.tourist.chatbot.model.ChatMessage;
import com.tourist.chatbot.model.Destination;
import com.tourist.chatbot.model.User;
import com.tourist.chatbot.repository.ChatMessageRepository;
import com.tourist.chatbot.repository.ChatRepository;
import com.tourist.chatbot.repository.DestinationRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    private final ChatRepository chatRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final DestinationRepository destinationRepository;
    private final GeminiService geminiService;
    private final UserService userService;

    public ChatResponse processMessage(ChatRequest request, String username) {
        User user = userService.getUserByUsername(username);
        String userId = user.getId();
        String message = request.getMessage().trim();

        // 1. Get or create Chat session
        Chat chat;
        if (request.getChatId() != null && !request.getChatId().trim().isEmpty()) {
            chat = chatRepository.findById(request.getChatId())
                    .filter(c -> c.getUserId().equals(userId))
                    .orElseGet(() -> createNewChat(userId, message));
        } else {
            chat = createNewChat(userId, message);
        }

        // 2. Persist User Message
        ChatMessage userMsg = ChatMessage.builder()
                .chatId(chat.getId())
                .userId(userId)
                .role("user")
                .content(message)
                .source("user")
                .build();
        chatMessageRepository.save(userMsg);

        // Fetch conversation history for full multi-turn context
        List<ChatMessage> conversationHistory = chatMessageRepository.findByChatId(chat.getId(), Sort.by(Sort.Direction.ASC, "timestamp"));

        // 3. Check for matching curated destination in catalog
        Optional<Destination> matchedDest = findDestinationInMessage(message);

        // 4. Generate AI response from Google Gemini with full conversation context
        String aiResponseText = geminiService.generateResponse(conversationHistory, message);

        // 5. Persist Assistant Message
        ChatMessage botMsg = ChatMessage.builder()
                .chatId(chat.getId())
                .userId(userId)
                .role("assistant")
                .content(aiResponseText)
                .source(matchedDest.isPresent() ? "destination" : "gemini")
                .metadata(matchedDest.isPresent() ? Map.of("destinationName", matchedDest.get().getName()) : null)
                .build();
        chatMessageRepository.save(botMsg);

        return ChatResponse.builder()
                .success(true)
                .chatId(chat.getId())
                .response(aiResponseText)
                .source(matchedDest.isPresent() ? "destination" : "gemini")
                .destination(matchedDest.orElse(null))
                .build();
    }

    private Chat createNewChat(String userId, String firstMessage) {
        String title = firstMessage.length() > 40 ? firstMessage.substring(0, 40) + "…" : firstMessage;
        Chat chat = Chat.builder()
                .userId(userId)
                .title(title)
                .build();
        return chatRepository.save(chat);
    }

    private Optional<Destination> findDestinationInMessage(String message) {
        String lower = message.toLowerCase().trim();
        List<Destination> all = destinationRepository.findAll();
        for (Destination d : all) {
            if (d.getName() == null || d.getName().isBlank()) continue;
            String destLower = d.getName().toLowerCase();

            // Ignore if the word is an origin point: e.g. "from kerala"
            if (lower.contains("from " + destLower) || lower.startsWith("from " + destLower)) {
                continue;
            }

            // Check if the destination is explicitly mentioned as a word
            if (lower.matches(".*\\b" + java.util.regex.Pattern.quote(destLower) + "\\b.*")) {
                return Optional.of(d);
            }
        }
        return Optional.empty();
    }

    public List<Chat> getUserChatHistory(String username) {
        User user = userService.getUserByUsername(username);
        return chatRepository.findByUserId(user.getId(), Sort.by(Sort.Direction.DESC, "updatedAt"));
    }

    public Map<String, Object> getChatDetails(String chatId, String username) {
        User user = userService.getUserByUsername(username);
        Chat chat = chatRepository.findById(chatId)
                .filter(c -> c.getUserId().equals(user.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        List<ChatMessage> messages = chatMessageRepository.findByChatId(chatId, Sort.by(Sort.Direction.ASC, "timestamp"));

        Map<String, Object> response = new HashMap<>();
        response.put("chat", chat);
        response.put("messages", messages);
        return response;
    }

    public void deleteChat(String chatId, String username) {
        User user = userService.getUserByUsername(username);
        Chat chat = chatRepository.findById(chatId)
                .filter(c -> c.getUserId().equals(user.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        chatMessageRepository.deleteByChatId(chat.getId());
        chatRepository.delete(chat);
    }

    public void clearAllChats(String username) {
        User user = userService.getUserByUsername(username);
        chatMessageRepository.deleteByUserId(user.getId());
        chatRepository.deleteByUserId(user.getId());
    }
}
