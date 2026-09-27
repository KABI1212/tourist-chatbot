package com.tourist.chatbot.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FavoriteRequest {

    private String destinationId;

    @NotBlank(message = "Destination name is required")
    private String destinationName;

    private String country;

    private String notes;
}
