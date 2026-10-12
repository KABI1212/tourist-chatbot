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
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
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
    private final GeminiService geminiService;
    private final UserService userService;
    private final DestinationMatcher destinationMatcher;

    public ChatResponse processMessage(ChatRequest request, String username) {
        User user = (username != null && !username.isBlank()) ? userService.getUserByUsername(username) : null;
        String userId = user != null ? user.getId() : null;
        String message = request.getMessage().trim();

        // 1. Get or create Chat session if authenticated
        Chat chat = null;
        List<ChatMessage> conversationHistory = new ArrayList<>();
        if (userId != null) {
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
            conversationHistory = chatMessageRepository.findByChatId(chat.getId(), Sort.by(Sort.Direction.ASC, "timestamp"));
        }

        // 3. Generate AI response from Google Gemini with full conversation context and requested language
        String aiResponseText = (request.getLanguage() != null && !request.getLanguage().isBlank())
                ? geminiService.generateResponse(conversationHistory, message, request.getLanguage())
                : geminiService.generateResponse(conversationHistory, message);

        // 4. Match catalog destination: check user message first, then the AI reply
        Optional<Destination> matchedDest = destinationMatcher.find(message)
                .or(() -> destinationMatcher.find(aiResponseText));


        // 5. Persist Assistant Message if authenticated
        if (chat != null && userId != null) {
            ChatMessage botMsg = ChatMessage.builder()
                    .chatId(chat.getId())
                    .userId(userId)
                    .role("assistant")
                    .content(aiResponseText)
                    .source(matchedDest.isPresent() ? "destination" : "gemini")
                    .metadata(matchedDest.isPresent() ? Map.of("destinationName", matchedDest.get().getName()) : null)
                    .build();
            chatMessageRepository.save(botMsg);
        }

        return ChatResponse.builder()
                .success(true)
                .chatId(chat != null ? chat.getId() : (request.getChatId() != null ? request.getChatId() : "guest-chat"))
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
