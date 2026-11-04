package com.tourist.chatbot.service;

import com.tourist.chatbot.exception.BadRequestException;
import com.tourist.chatbot.exception.ResourceNotFoundException;
import com.tourist.chatbot.model.RefreshToken;
import com.tourist.chatbot.model.User;
import com.tourist.chatbot.repository.RefreshTokenRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Service managing enterprise refresh-token lifecycle, rotation,
 * HttpOnly cookies, active device sessions, and revocation.
 */
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);
    public static final String REFRESH_TOKEN_COOKIE_NAME = "tourist_refresh_token";

    private final RefreshTokenRepository refreshTokenRepository;

    @Value("${jwt.refresh-expiration:604800000}") // 7 days in milliseconds
    private long refreshExpirationMs;

    public RefreshToken createRefreshToken(User user, HttpServletRequest request) {
        String tokenStr = UUID.randomUUID().toString() + "-" + UUID.randomUUID().toString();
        Instant now = Instant.now();
        Instant expiresAt = now.plusMillis(refreshExpirationMs);

        String ip = extractClientIp(request);
        String device = extractUserAgent(request);

        RefreshToken refreshToken = RefreshToken.builder()
                .token(tokenStr)
                .userId(user.getId())
                .username(user.getUsername())
                .expiresAt(expiresAt)
                .revoked(false)
                .deviceInfo(device)
                .ipAddress(ip)
                .lastUsedAt(now)
                .createdAt(now)
                .build();

        return refreshTokenRepository.save(refreshToken);
    }

    public RefreshToken rotateRefreshToken(String oldTokenStr, HttpServletRequest request) {
        if (oldTokenStr == null || oldTokenStr.trim().isEmpty()) {
            throw new BadRequestException("Refresh token is required");
        }

        RefreshToken oldToken = refreshTokenRepository.findByToken(oldTokenStr.trim())
                .orElseThrow(() -> new BadRequestException("Invalid refresh token"));

        // Breach / replay detection: If a revoked token is re-submitted, someone may have compromised the chain.
        if (oldToken.isRevoked()) {
            log.warn("SECURITY ALERT: Attempt to use already revoked refresh token for user [{}]! Revoking all sessions.", oldToken.getUsername());
            revokeAllUserTokens(oldToken.getUserId());
            throw new BadRequestException("Security alert: Suspicious session activity detected. Please log in again.");
        }

        if (oldToken.getExpiresAt().isBefore(Instant.now())) {
            oldToken.setRevoked(true);
            refreshTokenRepository.save(oldToken);
            throw new BadRequestException("Refresh token has expired. Please sign in again.");
        }

        // Revoke the old token (rotation)
        oldToken.setRevoked(true);
        oldToken.setLastUsedAt(Instant.now());
        refreshTokenRepository.save(oldToken);

        // Issue a new token for the user
        String newTokenStr = UUID.randomUUID().toString() + "-" + UUID.randomUUID().toString();
        Instant now = Instant.now();
        Instant expiresAt = now.plusMillis(refreshExpirationMs);

        RefreshToken newToken = RefreshToken.builder()
                .token(newTokenStr)
                .userId(oldToken.getUserId())
                .username(oldToken.getUsername())
                .expiresAt(expiresAt)
                .revoked(false)
                .deviceInfo(extractUserAgent(request))
                .ipAddress(extractClientIp(request))
                .lastUsedAt(now)
                .createdAt(now)
                .build();

        return refreshTokenRepository.save(newToken);
    }

    public void revokeToken(String tokenStr) {
        if (tokenStr == null || tokenStr.trim().isEmpty()) return;
        refreshTokenRepository.findByToken(tokenStr.trim()).ifPresent(token -> {
            token.setRevoked(true);
            refreshTokenRepository.save(token);
        });
    }

    public void revokeAllUserTokens(String userId) {
        List<RefreshToken> tokens = refreshTokenRepository.findByUserIdAndRevokedFalse(userId);
        for (RefreshToken t : tokens) {
            t.setRevoked(true);
        }
        refreshTokenRepository.saveAll(tokens);
    }

    public List<Map<String, Object>> getUserActiveSessions(String userId, String currentTokenStr) {
        List<RefreshToken> active = refreshTokenRepository.findByUserIdAndRevokedFalse(userId);
        Instant now = Instant.now();

        return active.stream()
                .filter(t -> t.getExpiresAt().isAfter(now))
                .map(t -> {
                    boolean isCurrent = currentTokenStr != null && currentTokenStr.equals(t.getToken());
                    return Map.<String, Object>of(
                            "id", t.getId(),
                            "deviceInfo", t.getDeviceInfo() != null ? t.getDeviceInfo() : "Unknown Browser",
                            "ipAddress", t.getIpAddress() != null ? t.getIpAddress() : "Unknown IP",
                            "lastUsedAt", t.getLastUsedAt() != null ? t.getLastUsedAt() : t.getCreatedAt(),
                            "createdAt", t.getCreatedAt() != null ? t.getCreatedAt() : now,
                            "isCurrent", isCurrent
                    );
                })
                .toList();
    }

    public void revokeSession(String sessionId, String userId) {
        RefreshToken token = refreshTokenRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));

        if (!token.getUserId().equals(userId)) {
            throw new BadRequestException("Unauthorized to terminate this session");
        }

        token.setRevoked(true);
        refreshTokenRepository.save(token);
    }

    public void attachRefreshTokenCookie(HttpServletResponse response, String refreshToken) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_TOKEN_COOKIE_NAME, refreshToken)
                .httpOnly(true)
                .secure(false) // Works over both http dev & https prod
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(Duration.ofMillis(refreshExpirationMs))
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public void clearRefreshTokenCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_TOKEN_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(0)
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public Optional<String> extractRefreshTokenFromCookies(HttpServletRequest request) {
        if (request.getCookies() == null) return Optional.empty();
        for (Cookie c : request.getCookies()) {
            if (REFRESH_TOKEN_COOKIE_NAME.equals(c.getName())) {
                return Optional.ofNullable(c.getValue());
            }
        }
        return Optional.empty();
    }

    public String extractClientIp(HttpServletRequest request) {
        if (request == null) return "unknown";
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isBlank() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip != null ? ip : "unknown";
    }

    private String extractUserAgent(HttpServletRequest request) {
        if (request == null) return "Unknown Device";
        String agent = request.getHeader("User-Agent");
        return (agent != null && !agent.isBlank()) ? agent : "Unknown Device";
    }
}

