package com.tourist.chatbot.dto;

import jakarta.validation.constraints.NotBlank;
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
public class TripRequest {

    private String title;

    private String origin;

    @NotBlank(message = "Destination is required")
    private String destination;

    private int days;

    private int people;

    private String hotelTier;

    private Double estimatedBudget;

    private String currency;

    private Map<String, Object> budgetBreakdown;

    private String itinerary;
    private List<String> travelTips;
    private String startDate;
    private String endDate;
    private List<String> interests;
    private String status;
    private String imageUrl;
    private List<Map<String, Object>> daysPlan;
}
