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

/**
 * Enterprise refresh token model supporting rotation, breach detection,
 * session revocation, and active device tracking.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "refresh_tokens")
public class RefreshToken {

    @Id
    private String id;

    @Indexed(unique = true)
    private String token;

    @Indexed
    private String userId;

    private String username;

    private Instant expiresAt;

    @Builder.Default
    private boolean revoked = false;

    private String deviceInfo;

    private String ipAddress;

    private Instant lastUsedAt;

    @CreatedDate
    private Instant createdAt;
}
