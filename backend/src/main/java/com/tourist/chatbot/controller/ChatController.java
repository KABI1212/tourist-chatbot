package com.tourist.chatbot.controller;

import com.tourist.chatbot.dto.ApiResponse;
import com.tourist.chatbot.dto.ChatRequest;
import com.tourist.chatbot.dto.ChatResponse;
import com.tourist.chatbot.model.Chat;
import com.tourist.chatbot.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @PostMapping
    public ResponseEntity<ChatResponse> sendMessage(
            @Valid @RequestBody ChatRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        ChatResponse response = chatService.processMessage(request, userDetails.getUsername());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/history")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getChatHistory(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        List<Chat> history = chatService.getUserChatHistory(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(Map.of("chats", history, "total", history.size())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getChatDetails(
            @PathVariable("id") String chatId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        Map<String, Object> details = chatService.getChatDetails(chatId, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(details));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Map<String, String>>> deleteChat(
            @PathVariable("id") String chatId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        chatService.deleteChat(chatId, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Chat deleted successfully", Map.of("chatId", chatId)));
    }

    @PostMapping("/clear")
    public ResponseEntity<ApiResponse<Map<String, String>>> clearAllChats(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        chatService.clearAllChats(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("All chats cleared", Map.of("status", "cleared")));
    }
}
