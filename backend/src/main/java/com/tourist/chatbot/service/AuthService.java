package com.tourist.chatbot.service;

import com.tourist.chatbot.dto.AuthRequest;
import com.tourist.chatbot.dto.AuthResponse;
import com.tourist.chatbot.dto.RegisterRequest;
import com.tourist.chatbot.exception.BadRequestException;
import com.tourist.chatbot.model.User;
import com.tourist.chatbot.repository.UserRepository;
import com.tourist.chatbot.security.CustomUserDetailsService;
import com.tourist.chatbot.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final CustomUserDetailsService userDetailsService;
    private final UserService userService;

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername().trim())) {
            throw new BadRequestException("Username already exists");
        }

        if (userRepository.existsByEmail(request.getEmail().trim())) {
            throw new BadRequestException("Email address already registered");
        }

        User user = User.builder()
                .username(request.getUsername().trim())
                .email(request.getEmail().trim().toLowerCase())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName() != null && !request.getFullName().trim().isEmpty()
                        ? request.getFullName().trim() : request.getUsername().trim())
                .phone(request.getPhone() != null ? request.getPhone().trim() : "")
                .address(request.getAddress() != null ? request.getAddress().trim() : "")
                .bio(request.getBio() != null ? request.getBio().trim() : "")
                .roles(Set.of("ROLE_USER"))
                .build();

        User savedUser = userRepository.save(user);

        UserDetails userDetails = userDetailsService.loadUserByUsername(savedUser.getUsername());
        String token = jwtService.generateToken(userDetails);

        return AuthResponse.builder()
                .token(token)
                .type("Bearer")
                .user(userService.mapToProfileResponse(savedUser))
                .build();
    }

    public AuthResponse login(AuthRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );

        User user = userService.getUserByUsername(request.getUsername());
        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
        String token = jwtService.generateToken(userDetails);

        return AuthResponse.builder()
                .token(token)
                .type("Bearer")
                .user(userService.mapToProfileResponse(user))
                .build();
    }
}
