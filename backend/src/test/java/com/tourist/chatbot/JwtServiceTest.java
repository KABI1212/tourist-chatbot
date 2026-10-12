package com.tourist.chatbot;

import com.tourist.chatbot.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;

public class JwtServiceTest {

    private JwtService jwtService;
    private static final String VALID_TEST_SECRET = "abcdefghijklmnopqrstuvwxyz1234567890!@#$%^&*()_+";

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secretKey", VALID_TEST_SECRET);
        ReflectionTestUtils.setField(jwtService, "jwtExpirationMs", 3600000L);
        jwtService.validateSecret();
    }

    @Test
    void testValidateSecretWithValidKeyPasses() {
        assertDoesNotThrow(() -> jwtService.validateSecret());
    }

    @Test
    void testValidateSecretNullThrowsIllegalStateException() {
        JwtService service = new JwtService();
        ReflectionTestUtils.setField(service, "secretKey", null);
        IllegalStateException ex = assertThrows(IllegalStateException.class, service::validateSecret);
        assertNotNull(ex.getMessage());
        assertFalse(ex.getMessage().contains("null"));
    }

    @Test
    void testValidateSecretShortKeyThrowsIllegalStateException() {
        JwtService service = new JwtService();
        ReflectionTestUtils.setField(service, "secretKey", "short_secret_under_32_bytes");
        IllegalStateException ex = assertThrows(IllegalStateException.class, service::validateSecret);
        assertNotNull(ex.getMessage());
        // Verify secret itself is never leaked in the exception message
        assertFalse(ex.getMessage().contains("short_secret_under_32_bytes"));
    }

    @Test
    void testGenerateAndValidateTokenSuccess() {
        UserDetails userDetails = new User("traveler", "password", Collections.emptyList());
        String token = jwtService.generateToken(userDetails);

        assertNotNull(token);
        assertEquals("traveler", jwtService.extractUsername(token));
        assertTrue(jwtService.isTokenValid(token, userDetails));
    }

    @Test
    void testTokenInvalidForDifferentUser() {
        UserDetails user1 = new User("user1", "password", Collections.emptyList());
        UserDetails user2 = new User("user2", "password", Collections.emptyList());

        String token = jwtService.generateToken(user1);
        assertFalse(jwtService.isTokenValid(token, user2));
    }
}
