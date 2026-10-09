package com.tourist.chatbot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ItineraryResponse {

    private boolean success;

    private String title;

    private String destination;

    private int days;

    private int travelers;

    private String budgetTier;

    private String estimatedBudget;

    private String currency;

    private String imageUrl;

    private List<Map<String, Object>> daysPlan;

    private Map<String, Object> budgetBreakdown;

    private List<String> travelTips;

    private String summary;
}
