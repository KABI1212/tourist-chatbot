package com.tourist.chatbot.service;

import com.tourist.chatbot.dto.ChatRequest;
import com.tourist.chatbot.dto.ChatResponse;
import com.tourist.chatbot.dto.PlaceSearchResult;
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
    private final PlacesProviderService placesProviderService;

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

        // 3. Match destination: check local curated catalog first, then dynamic worldwide provider
        Optional<Destination> matchedDest = destinationMatcher.find(message);
        if (matchedDest.isEmpty()) {
            matchedDest = detectGlobalDestination(message);
        }

        // 4. Ground prompt with factual destination context if recognized
        String promptWithContext = message;
        if (matchedDest.isPresent()) {
            Destination d = matchedDest.get();
            promptWithContext = String.format("""
                    [Factual Destination Context: %s in %s (Coordinates: %.4f, %.4f). Best known for: %s. Current season/weather: %s. Best time: %s]
                    User Query: %s
                    """,
                    d.getName(),
                    d.getCountry() != null ? d.getCountry() : "Worldwide",
                    d.getLatitude() != null ? d.getLatitude() : 0.0,
                    d.getLongitude() != null ? d.getLongitude() : 0.0,
                    d.getFamousFor() != null ? d.getFamousFor() : d.getDescription(),
                    d.getWeather() != null ? d.getWeather() : "Pleasant",
                    d.getBestTime() != null ? d.getBestTime() : "Year-round",
                    message
            );
        }

        // 5. Generate AI response from Google Gemini with full conversation context and requested language
        String aiResponseText = (request.getLanguage() != null && !request.getLanguage().isBlank())
                ? geminiService.generateResponse(conversationHistory, promptWithContext, request.getLanguage())
                : geminiService.generateResponse(conversationHistory, promptWithContext);

        // Fallback match against AI reply if initial lookup found nothing
        if (matchedDest.isEmpty()) {
            matchedDest = destinationMatcher.find(aiResponseText);
        }

        // 6. Persist Assistant Message if authenticated
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

    private Optional<Destination> detectGlobalDestination(String message) {
        if (message == null || message.isBlank() || placesProviderService == null) {
            return Optional.empty();
        }

        // Strip common conversational queries to isolate place name
        String cleaned = message.replaceAll("(?i)\\b(tell me (everything )?about|how to reach|what can i do in|places (to visit )?in|trip to|guide for|plan a trip to|visiting|waterfalls near|temples near|best places in|hotels in|food in)\\b", "").trim();
        cleaned = cleaned.replaceAll("[?!.,\"]", "").trim();

        if (cleaned.length() >= 3 && cleaned.length() <= 60) {
            try {
                List<PlaceSearchResult> results = placesProviderService.autocomplete(cleaned, 1);
                if (!results.isEmpty()) {
                    PlaceSearchResult top = results.get(0);
                    if (cleaned.toLowerCase().contains(top.getName().toLowerCase()) || top.getName().toLowerCase().contains(cleaned.toLowerCase())) {
                        Destination dest = placesProviderService.getGlobalPlaceDetails(top.getName(), top.getLatitude(), top.getLongitude());
                        return Optional.ofNullable(dest);
                    }
                }
            } catch (Exception e) {
                log.debug("Global destination detection skipped for '{}': {}", cleaned, e.getMessage());
            }
        }
        return Optional.empty();
    }

    private Chat createNewChat(String userId, String firstMessage) {
        String title = firstMessage.length() > 30 ? firstMessage.substring(0, 30) + "..." : firstMessage;
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
                .orElseThrow(() -> new com.tourist.chatbot.exception.ResourceNotFoundException("Conversation not found"));

        List<ChatMessage> messages = chatMessageRepository.findByChatId(chat.getId(), Sort.by(Sort.Direction.ASC, "timestamp"));
        Map<String, Object> response = new java.util.HashMap<>();
        response.put("chat", chat);
        response.put("messages", messages);
        return response;
    }

    public void deleteChat(String chatId, String username) {
        User user = userService.getUserByUsername(username);
        Chat chat = chatRepository.findById(chatId)
                .filter(c -> c.getUserId().equals(user.getId()))
                .orElseThrow(() -> new com.tourist.chatbot.exception.ResourceNotFoundException("Conversation not found"));

        chatMessageRepository.deleteByChatId(chat.getId());
        chatRepository.delete(chat);
    }

    public void clearAllChats(String username) {
        User user = userService.getUserByUsername(username);
        List<Chat> chats = chatRepository.findByUserId(user.getId(), Sort.by(Sort.Direction.DESC, "updatedAt"));
        for (Chat c : chats) {
            chatMessageRepository.deleteByChatId(c.getId());
            chatRepository.deleteById(c.getId());
        }
    }

    public void clearUserChatHistory(String username) {
        clearAllChats(username);
    }
}
