package com.tourist.chatbot.security;

import com.tourist.chatbot.exception.BadRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory sliding-window rate limiter protecting login endpoints
 * against brute-force attacks and credential stuffing.
 */
@Component
public class LoginRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(LoginRateLimiter.class);

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final Duration LOCKOUT_DURATION = Duration.ofMinutes(15);

    private final Map<String, AttemptTracker> attempts = new ConcurrentHashMap<>();

    private static class AttemptTracker {
        int failedAttempts;
        Instant firstAttemptAt;
        Instant lastAttemptAt;

        AttemptTracker() {
            this.failedAttempts = 1;
            Instant now = Instant.now();
            this.firstAttemptAt = now;
            this.lastAttemptAt = now;
        }
    }

    public void checkAllowed(String identifier, String ipAddress) {
        String key = buildKey(identifier, ipAddress);
        AttemptTracker tracker = attempts.get(key);

        if (tracker != null) {
            Instant now = Instant.now();
            Duration elapsed = Duration.between(tracker.firstAttemptAt, now);

            if (elapsed.compareTo(LOCKOUT_DURATION) < 0) {
                if (tracker.failedAttempts >= MAX_FAILED_ATTEMPTS) {
                    long remainingMinutes = Math.max(1, LOCKOUT_DURATION.minus(elapsed).toMinutes());
                    log.warn("Rate limit triggered for [{}] from IP [{}]. {} attempts recorded.", identifier, ipAddress, tracker.failedAttempts);
                    throw new BadRequestException(
                            String.format("Too many failed login attempts. Account temporarily locked for %d minute(s).", remainingMinutes)
                    );
                }
            } else {
                // Window expired, reset
                attempts.remove(key);
            }
        }
    }

    public void recordFailure(String identifier, String ipAddress) {
        String key = buildKey(identifier, ipAddress);
        attempts.compute(key, (k, existing) -> {
            Instant now = Instant.now();
            if (existing == null || Duration.between(existing.firstAttemptAt, now).compareTo(LOCKOUT_DURATION) >= 0) {
                return new AttemptTracker();
            }
            existing.failedAttempts++;
            existing.lastAttemptAt = now;
            return existing;
        });
    }

    public void recordSuccess(String identifier, String ipAddress) {
        String key = buildKey(identifier, ipAddress);
        attempts.remove(key);
    }

    private String buildKey(String identifier, String ipAddress) {
        String idPart = identifier != null ? identifier.trim().toLowerCase() : "unknown";
        String ipPart = ipAddress != null ? ipAddress.trim() : "unknown_ip";
        return idPart + "|" + ipPart;
    }
}

