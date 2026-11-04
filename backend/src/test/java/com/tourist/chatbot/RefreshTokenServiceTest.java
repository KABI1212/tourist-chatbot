package com.tourist.chatbot;

import com.tourist.chatbot.exception.BadRequestException;
import com.tourist.chatbot.model.RefreshToken;
import com.tourist.chatbot.model.User;
import com.tourist.chatbot.repository.RefreshTokenRepository;
import com.tourist.chatbot.service.RefreshTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class RefreshTokenServiceTest {

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @InjectMocks
    private RefreshTokenService refreshTokenService;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(refreshTokenService, "refreshExpirationMs", 604800000L);
        sampleUser = User.builder()
                .id("user-100")
                .username("traveller")
                .email("traveller@example.com")
                .build();
    }

    @Test
    void testCreateRefreshToken() {
        when(refreshTokenRepository.save(any(RefreshToken.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        RefreshToken token = refreshTokenService.createRefreshToken(sampleUser, null);

        assertNotNull(token);
        assertNotNull(token.getToken());
        assertEquals("user-100", token.getUserId());
        assertEquals("traveller", token.getUsername());
        assertFalse(token.isRevoked());
        assertTrue(token.getExpiresAt().isAfter(Instant.now()));
    }

    @Test
    void testRotateRefreshTokenSuccess() {
        RefreshToken oldToken = RefreshToken.builder()
                .id("tok-1")
                .token("valid-old-token")
                .userId("user-100")
                .username("traveller")
                .expiresAt(Instant.now().plus(7, ChronoUnit.DAYS))
                .revoked(false)
                .build();

        when(refreshTokenRepository.findByToken("valid-old-token")).thenReturn(Optional.of(oldToken));
        when(refreshTokenRepository.save(any(RefreshToken.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        RefreshToken newToken = refreshTokenService.rotateRefreshToken("valid-old-token", null);

        assertNotNull(newToken);
        assertNotEquals("valid-old-token", newToken.getToken());
        assertEquals("user-100", newToken.getUserId());
        assertTrue(oldToken.isRevoked()); // Old token was revoked during rotation
    }

    @Test
    void testReplayAttackTriggersBreachDetectionAndRevokesAllSessions() {
        RefreshToken alreadyRevokedToken = RefreshToken.builder()
                .id("tok-revoked")
                .token("compromised-token")
                .userId("user-100")
                .username("traveller")
                .expiresAt(Instant.now().plus(7, ChronoUnit.DAYS))
                .revoked(true) // already revoked!
                .build();

        when(refreshTokenRepository.findByToken("compromised-token")).thenReturn(Optional.of(alreadyRevokedToken));
        when(refreshTokenRepository.findByUserIdAndRevokedFalse("user-100")).thenReturn(List.of(
                RefreshToken.builder().id("tok-active-1").revoked(false).build(),
                RefreshToken.builder().id("tok-active-2").revoked(false).build()
        ));

        assertThrows(BadRequestException.class, () -> refreshTokenService.rotateRefreshToken("compromised-token", null));
        verify(refreshTokenRepository).saveAll(any());
    }
}
