package com.tourist.chatbot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResetAuthResponse {

    private String resetToken;

    private String email;

    private String username;

    private int expiresInMinutes;

    private String notice;
}
