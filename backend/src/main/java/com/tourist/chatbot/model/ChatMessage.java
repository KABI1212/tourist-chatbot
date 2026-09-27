package com.tourist.chatbot.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "messages")
public class ChatMessage {

    @Id
    private String id;

    @Indexed
    private String chatId;

    @Indexed
    private String userId;

    private String role; // "user" or "assistant"

    private String content;

    private String source; // "gemini", "destination", "itinerary"

    private Map<String, Object> metadata;

    @CreatedDate
    private Instant timestamp;
}
