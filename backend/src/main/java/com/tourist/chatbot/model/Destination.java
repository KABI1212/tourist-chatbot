package com.tourist.chatbot.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "destinations")
public class Destination {

    @Id
    private String id;

    @Indexed(unique = true)
    private String name;

    private String country;

    private String continent;

    private String description;

    private String famousFor;

    private String bestTime;

    private String peakSeason;

    private String offSeason;

    private String weather;

    private String idealDuration;

    private String unescoStatus;

    private String openingTime;

    private String closingTime;

    private String entryFee;

    private Double latitude;

    private Double longitude;

    private String mapsLink;

    private List<String> images;

    private List<String> tags;

    private String officialWebsite;

    private String travelTip;

    private Double rating;

    private Integer reviewCount;

    private List<Map<String, Object>> attractions; // name, rating, reviews, image, description

    private List<Map<String, Object>> hotels;      // name, tier, pricePerNight, rating, image

    private List<Map<String, Object>> localFoods;   // name, type, description, price

    private List<String> travelTipsList;
}
