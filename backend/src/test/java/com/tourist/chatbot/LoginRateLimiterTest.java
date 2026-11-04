package com.tourist.chatbot;

import com.tourist.chatbot.exception.BadRequestException;
import com.tourist.chatbot.security.LoginRateLimiter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class LoginRateLimiterTest {

    private LoginRateLimiter rateLimiter;

    @BeforeEach
    void setUp() {
        rateLimiter = new LoginRateLimiter();
    }

    @Test
    void testAllowedUnderThreshold() {
        assertDoesNotThrow(() -> rateLimiter.checkAllowed("testuser", "192.168.1.1"));
        rateLimiter.recordFailure("testuser", "192.168.1.1");
        assertDoesNotThrow(() -> rateLimiter.checkAllowed("testuser", "192.168.1.1"));
    }

    @Test
    void testBlockedAfterFiveFailures() {
        String user = "attacker";
        String ip = "10.0.0.1";

        for (int i = 0; i < 5; i++) {
            rateLimiter.recordFailure(user, ip);
        }

        assertThrows(BadRequestException.class, () -> rateLimiter.checkAllowed(user, ip));
    }

    @Test
    void testResetOnSuccess() {
        String user = "legitimateUser";
        String ip = "10.0.0.2";

        for (int i = 0; i < 4; i++) {
            rateLimiter.recordFailure(user, ip);
        }

        rateLimiter.recordSuccess(user, ip);

        // After recordSuccess, subsequent failures start from 1 again, not 5
        rateLimiter.recordFailure(user, ip);
        assertDoesNotThrow(() -> rateLimiter.checkAllowed(user, ip));
    }
}
