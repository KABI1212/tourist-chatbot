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
public class PlaceSearchResult {
    private String id;
    private String name;
    private String displayName;
    private String city;
    private String state;
    private String country;
    private String countryCode;
    private Double latitude;
    private Double longitude;
    private String category;
    private String description;
    private String imageUrl;
    private boolean isGlobal;
}
