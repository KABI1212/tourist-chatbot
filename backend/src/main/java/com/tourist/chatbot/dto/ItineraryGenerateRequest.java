package com.tourist.chatbot.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ItineraryGenerateRequest {

    @NotBlank(message = "Destination is required")
    private String destination;

    private String startDate;

    private String endDate;

    private int days;

    private int travelers;

    private String budgetTier; // "Budget", "Moderate", "Premium", "Luxury"

    private Double customBudget;

    private String budgetType; // "per_person", "total"

    private String currency; // "INR", "USD", "EUR", "GBP"

    private String originCity;

    private String transitMode;

    private List<String> interests; // "Sightseeing", "Adventure", "Food and dining", etc.

    private String additionalPreferences;

    private String language; // e.g. "ta", "hi", "en", "fr", "es", "auto"
}
