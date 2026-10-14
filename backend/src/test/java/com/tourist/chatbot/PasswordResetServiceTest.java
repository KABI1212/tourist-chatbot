package com.tourist.chatbot;

import com.tourist.chatbot.dto.ResetAuthResponse;
import com.tourist.chatbot.dto.ResetPasswordRequest;
import com.tourist.chatbot.exception.BadRequestException;
import com.tourist.chatbot.exception.ResourceNotFoundException;
import com.tourist.chatbot.model.PasswordResetToken;
import com.tourist.chatbot.model.User;
import com.tourist.chatbot.repository.PasswordResetTokenRepository;
import com.tourist.chatbot.repository.UserRepository;
import com.tourist.chatbot.service.PasswordResetService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class PasswordResetServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordResetTokenRepository resetTokenRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private PasswordResetService passwordResetService;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        sampleUser = User.builder()
                .id("user-123")
                .username("alexandra")
                .email("alexandra@example.com")
                .password("old_encoded_pwd")
                .fullName("Alexandra Smith")
                .build();
    }

    @Test
    void testVerifyAccount_Success() {
        when(userRepository.findByEmail("alexandra@example.com")).thenReturn(Optional.of(sampleUser));
        when(resetTokenRepository.save(any(PasswordResetToken.class))).thenAnswer(i -> i.getArgument(0));

        ResetAuthResponse response = passwordResetService.verifyAccountAndCreateResetAuth("alexandra@example.com");

        assertNotNull(response);
        assertNotNull(response.getResetToken());
        assertEquals("alexandra@example.com", response.getEmail());
        assertEquals(15, response.getExpiresInMinutes());
        verify(resetTokenRepository, times(1)).deleteAllByUserId("user-123");
        verify(resetTokenRepository, times(1)).save(any(PasswordResetToken.class));
    }

    @Test
    void testVerifyAccount_NotFound() {
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());
        when(userRepository.findByUsername("unknown@example.com")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () ->
                passwordResetService.verifyAccountAndCreateResetAuth("unknown@example.com")
        );
        verify(resetTokenRepository, never()).save(any());
    }

    @Test
    void testResetPassword_Success() {
        String tokenStr = "valid-token-uuid";
        PasswordResetToken tokenDoc = PasswordResetToken.builder()
                .token(tokenStr)
                .userId("user-123")
                .email("alexandra@example.com")
                .expiresAt(Instant.now().plus(Duration.ofMinutes(15)))
                .used(false)
                .build();

        when(resetTokenRepository.findByToken(tokenStr)).thenReturn(Optional.of(tokenDoc));
        when(userRepository.findById("user-123")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.encode("newSecret123")).thenReturn("new_bcrypt_hash");

        ResetPasswordRequest request = new ResetPasswordRequest(tokenStr, "newSecret123", "newSecret123");
        passwordResetService.resetPassword(request);

        assertEquals("new_bcrypt_hash", sampleUser.getPassword());
        assertTrue(tokenDoc.isUsed());
        verify(userRepository, times(1)).save(sampleUser);
        verify(resetTokenRepository, times(1)).save(tokenDoc);
    }

    @Test
    void testResetPassword_MismatchedPasswords() {
        ResetPasswordRequest request = new ResetPasswordRequest("token", "newSecret123", "differentPassword");
        assertThrows(BadRequestException.class, () -> passwordResetService.resetPassword(request));
        verify(userRepository, never()).save(any());
    }

    @Test
    void testResetPassword_PasswordTooShort() {
        ResetPasswordRequest request = new ResetPasswordRequest("token", "123", "123");
        assertThrows(BadRequestException.class, () -> passwordResetService.resetPassword(request));
        verify(userRepository, never()).save(any());
    }

    @Test
    void testResetPassword_AlreadyUsedToken() {
        String tokenStr = "already-used-token";
        PasswordResetToken tokenDoc = PasswordResetToken.builder()
                .token(tokenStr)
                .userId("user-123")
                .email("alexandra@example.com")
                .expiresAt(Instant.now().plus(Duration.ofMinutes(15)))
                .used(true)
                .build();

        when(resetTokenRepository.findByToken(tokenStr)).thenReturn(Optional.of(tokenDoc));

        ResetPasswordRequest request = new ResetPasswordRequest(tokenStr, "newSecret123", "newSecret123");
        assertThrows(BadRequestException.class, () -> passwordResetService.resetPassword(request));
        verify(userRepository, never()).save(any());
    }

    @Test
    void testResetPassword_ExpiredToken() {
        String tokenStr = "expired-token";
        PasswordResetToken tokenDoc = PasswordResetToken.builder()
                .token(tokenStr)
                .userId("user-123")
                .email("alexandra@example.com")
                .expiresAt(Instant.now().minus(Duration.ofMinutes(1)))
                .used(false)
                .build();

        when(resetTokenRepository.findByToken(tokenStr)).thenReturn(Optional.of(tokenDoc));

        ResetPasswordRequest request = new ResetPasswordRequest(tokenStr, "newSecret123", "newSecret123");
        assertThrows(BadRequestException.class, () -> passwordResetService.resetPassword(request));
        verify(userRepository, never()).save(any());
    }
}
