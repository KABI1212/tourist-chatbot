package com.tourist.chatbot;

import com.tourist.chatbot.dto.AuthRequest;
import com.tourist.chatbot.dto.AuthResponse;
import com.tourist.chatbot.dto.RegisterRequest;
import com.tourist.chatbot.exception.BadRequestException;
import com.tourist.chatbot.model.User;
import com.tourist.chatbot.repository.UserRepository;
import com.tourist.chatbot.security.JwtService;
import com.tourist.chatbot.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

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
    private org.springframework.security.authentication.AuthenticationManager authenticationManager;

    @Mock
    private com.tourist.chatbot.security.CustomUserDetailsService userDetailsService;

    @Mock
    private com.tourist.chatbot.service.UserService userService;

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

        org.springframework.security.core.userdetails.UserDetails mockDetails =
                org.springframework.security.core.userdetails.User.withUsername("traveller")
                        .password("encoded_pass").authorities("ROLE_USER").build();
        when(userDetailsService.loadUserByUsername("traveller")).thenReturn(mockDetails);
        when(jwtService.generateToken(any())).thenReturn("mock_jwt_token");

        com.tourist.chatbot.dto.UserProfileResponse profileResp = com.tourist.chatbot.dto.UserProfileResponse.builder()
                .id("u1").username("traveller").email("traveller@example.com").build();
        when(userService.mapToProfileResponse(any())).thenReturn(profileResp);

        AuthResponse resp = authService.register(req);

        assertNotNull(resp);
        assertEquals("mock_jwt_token", resp.getToken());
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

        org.springframework.security.core.userdetails.UserDetails mockDetails =
                org.springframework.security.core.userdetails.User.withUsername("traveller")
                        .password("encoded_pass").authorities("ROLE_USER").build();

        when(userService.getUserByUsername("traveller")).thenReturn(sampleUser);
        when(userDetailsService.loadUserByUsername("traveller")).thenReturn(mockDetails);
        when(jwtService.generateToken(any())).thenReturn("mock_jwt_token");

        com.tourist.chatbot.dto.UserProfileResponse profileResp = com.tourist.chatbot.dto.UserProfileResponse.builder()
                .id("u1").username("traveller").email("traveller@example.com").build();
        when(userService.mapToProfileResponse(any())).thenReturn(profileResp);

        AuthResponse resp = authService.login(req);

        assertNotNull(resp);
        assertEquals("mock_jwt_token", resp.getToken());
    }

    @Test
    void testLoginBadPasswordThrowsException() {
        AuthRequest req = new AuthRequest("traveller", "wrongpassword");

        when(authenticationManager.authenticate(any()))
                .thenThrow(new org.springframework.security.authentication.BadCredentialsException("Invalid credentials"));

        assertThrows(org.springframework.security.authentication.BadCredentialsException.class, () -> authService.login(req));
    }
}
