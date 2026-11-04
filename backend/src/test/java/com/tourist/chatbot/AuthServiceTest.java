package com.tourist.chatbot;

import com.tourist.chatbot.dto.AuthRequest;
import com.tourist.chatbot.dto.AuthResponse;
import com.tourist.chatbot.dto.RegisterRequest;
import com.tourist.chatbot.exception.BadRequestException;
import com.tourist.chatbot.model.RefreshToken;
import com.tourist.chatbot.model.User;
import com.tourist.chatbot.repository.UserRepository;
import com.tourist.chatbot.security.CustomUserDetails;
import com.tourist.chatbot.security.CustomUserDetailsService;
import com.tourist.chatbot.security.JwtService;
import com.tourist.chatbot.security.LoginRateLimiter;
import com.tourist.chatbot.service.AuthService;
import com.tourist.chatbot.service.RefreshTokenService;
import com.tourist.chatbot.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private CustomUserDetailsService userDetailsService;

    @Mock
    private UserService userService;

    @Mock
    private RefreshTokenService refreshTokenService;

    @Mock
    private LoginRateLimiter loginRateLimiter;

    @InjectMocks
    private AuthService authService;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        sampleUser = User.builder()
                .id("u1")
                .username("traveller")
                .email("traveller@example.com")
                .password("encoded_pass")
                .fullName("Alex Traveller")
                .build();
    }

    @Test
    void testRegisterSuccess() {
        RegisterRequest req = RegisterRequest.builder()
                .username("traveller")
                .email("traveller@example.com")
                .password("password123")
                .fullName("Alex Traveller")
                .build();

        when(userRepository.existsByUsername("traveller")).thenReturn(false);
        when(userRepository.existsByEmail("traveller@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("encoded_pass");
        when(userRepository.save(any(User.class))).thenReturn(sampleUser);
        when(jwtService.generateToken(any())).thenReturn("mock_jwt_token");

        RefreshToken mockRefreshToken = RefreshToken.builder().token("mock_refresh_token").build();
        when(refreshTokenService.createRefreshToken(any(), any())).thenReturn(mockRefreshToken);

        com.tourist.chatbot.dto.UserProfileResponse profileResp = com.tourist.chatbot.dto.UserProfileResponse.builder()
                .id("u1").username("traveller").email("traveller@example.com").build();
        when(userService.mapToProfileResponse(any())).thenReturn(profileResp);

        AuthResponse resp = authService.register(req);

        assertNotNull(resp);
        assertEquals("mock_jwt_token", resp.getToken());
        assertEquals("mock_refresh_token", resp.getRefreshToken());
        assertNotNull(resp.getUser());
        assertEquals("traveller", resp.getUser().getUsername());
        verify(userRepository).save(any(User.class));
    }

    @Test
    void testRegisterDuplicateUsernameThrowsException() {
        RegisterRequest req = RegisterRequest.builder()
                .username("traveller")
                .email("new@example.com")
                .password("password123")
                .build();

        when(userRepository.existsByUsername("traveller")).thenReturn(true);

        assertThrows(BadRequestException.class, () -> authService.register(req));
    }

    @Test
    void testLoginSuccess() {
        AuthRequest req = new AuthRequest("traveller", "password123");

        Authentication mockAuth = mock(Authentication.class);
        when(mockAuth.getPrincipal()).thenReturn(new CustomUserDetails(sampleUser));
        when(authenticationManager.authenticate(any())).thenReturn(mockAuth);

        when(jwtService.generateToken(any())).thenReturn("mock_jwt_token");

        RefreshToken mockRefreshToken = RefreshToken.builder().token("mock_refresh_token").build();
        when(refreshTokenService.createRefreshToken(any(), any())).thenReturn(mockRefreshToken);

        com.tourist.chatbot.dto.UserProfileResponse profileResp = com.tourist.chatbot.dto.UserProfileResponse.builder()
                .id("u1").username("traveller").email("traveller@example.com").build();
        when(userService.mapToProfileResponse(any())).thenReturn(profileResp);

        AuthResponse resp = authService.login(req);

        assertNotNull(resp);
        assertEquals("mock_jwt_token", resp.getToken());
        assertEquals("mock_refresh_token", resp.getRefreshToken());
        verify(loginRateLimiter).checkAllowed(eq("traveller"), any());
        verify(loginRateLimiter).recordSuccess(eq("traveller"), any());
    }

    @Test
    void testLoginBadPasswordThrowsException() {
        AuthRequest req = new AuthRequest("traveller", "wrongpassword");

        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Invalid credentials"));

        assertThrows(BadCredentialsException.class, () -> authService.login(req));
        verify(loginRateLimiter).recordFailure(eq("traveller"), any());
    }
}
