package com.tourist.chatbot.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.tourist.chatbot.model.Destination;
import com.tourist.chatbot.model.Trip;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatResponse {

    private boolean success;

    private String chatId;

    private String response; // text response or formatted markdown

    private String source; // "gemini", "destination", "itinerary", "local"

    private Destination destination; // rich destination card if recognized

    private Trip trip; // trip details if generated

    private Map<String, Object> metadata;
}
