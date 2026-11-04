package com.tourist.chatbot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {

    private String token;

    private String refreshToken;

    private Long expiresIn;

    @Builder.Default
    private String type = "Bearer";

    private UserProfileResponse user;
}
