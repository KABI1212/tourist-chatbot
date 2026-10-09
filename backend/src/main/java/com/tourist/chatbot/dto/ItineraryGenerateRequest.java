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

    private String budgetTier; // "Budget", "Moderate", "Luxury"

    private String currency; // "INR", "USD", "EUR"

    private List<String> interests; // "Sightseeing", "Adventure", "Food", "Nature", "Shopping", "Spiritual"
}
