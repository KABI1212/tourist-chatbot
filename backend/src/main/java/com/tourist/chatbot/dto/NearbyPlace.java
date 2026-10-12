package com.tourist.chatbot.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class NearbyPlace {
    private String name;
    private Double distanceKm;
    private Double latitude;
    private Double longitude;
    private String category;
    private String description;
    private String imageUrl;
    private String mapsLink;
}
