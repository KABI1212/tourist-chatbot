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
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "trips")
public class Trip {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String title;

    private String origin;

    private String destination;

    private int days;

    private int people;

    private String hotelTier; // "budget", "mid", "luxury"

    private Double estimatedBudget;

    private String currency; // "USD", "INR", "EUR", etc.

    private Map<String, Object> budgetBreakdown; // fuel, lodging, food, tickets, buffer

    private String itinerary; // text markdown or rich timeline

    private List<String> travelTips;

    @CreatedDate
    private Instant createdAt;
}
