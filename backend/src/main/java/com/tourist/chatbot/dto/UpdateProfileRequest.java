package com.tourist.chatbot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProfileRequest {

    private String fullName;
    private String phone;
    private String address;
    private String bio;
    private String avatar;
    private java.util.Map<String, Object> travelPreferences;
}
