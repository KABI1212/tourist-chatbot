package com.tourist.chatbot.service;

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
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * Enterprise Authentication Service.
 * Implements single-pass authentication without redundant database lookups,
 * brute-force rate limiting, refresh-token rotation, and performance timing instrumentation.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final Pattern PASSWORD_PATTERN = Pattern.compile("^(?=.*[A-Za-z])(?=.*\\d).{8,}$");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final CustomUserDetailsService userDetailsService;
    private final UserService userService;
    private final RefreshTokenService refreshTokenService;
    private final LoginRateLimiter loginRateLimiter;

    @Value("${jwt.expiration:86400000}")
    private long jwtExpirationMs;

    public AuthResponse register(RegisterRequest request) {
        return register(request, null, null);
    }

    public AuthResponse register(RegisterRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        long startTime = System.currentTimeMillis();

        if (request.getPassword() == null || !PASSWORD_PATTERN.matcher(request.getPassword()).matches()) {
            throw new BadRequestException("Password must be at least 8 characters long and contain both letters and numbers");
        }

        String username = request.getUsername().trim();
        String email = request.getEmail().trim().toLowerCase();

        if (userRepository.existsByUsername(username)) {
            throw new BadRequestException("Username already exists");
        }

        if (userRepository.existsByEmail(email)) {
            throw new BadRequestException("Email address already registered");
        }

        User user = User.builder()
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName() != null && !request.getFullName().trim().isEmpty()
                        ? request.getFullName().trim() : username)
                .phone(request.getPhone() != null ? request.getPhone().trim() : "")
                .address(request.getAddress() != null ? request.getAddress().trim() : "")
                .bio(request.getBio() != null ? request.getBio().trim() : "")
                .roles(Set.of("ROLE_USER"))
                .build();

        User savedUser = userRepository.save(user);

        UserDetails userDetails = new CustomUserDetails(savedUser);
        String token = jwtService.generateToken(userDetails);

        String refreshTokenStr = null;
        if (refreshTokenService != null) {
            RefreshToken refreshToken = refreshTokenService.createRefreshToken(savedUser, httpRequest);
            refreshTokenStr = refreshToken.getToken();
            if (httpResponse != null) {
                refreshTokenService.attachRefreshTokenCookie(httpResponse, refreshTokenStr);
            }
        }

        long elapsed = System.currentTimeMillis() - startTime;
        log.info("Auth benchmark: Successful registration for [{}] completed in {}ms", username, elapsed);

        return AuthResponse.builder()
                .token(token)
                .refreshToken(refreshTokenStr)
                .expiresIn(jwtExpirationMs)
                .type("Bearer")
                .user(userService.mapToProfileResponse(savedUser))
                .build();
    }

    public AuthResponse login(AuthRequest request) {
        return login(request, null, null);
    }

    public AuthResponse login(AuthRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        long startTime = System.currentTimeMillis();
        String identifier = request.getUsername() != null ? request.getUsername().trim() : "";
        String clientIp = refreshTokenService != null ? refreshTokenService.extractClientIp(httpRequest) : "unknown";

        // 1. Enforce rate limiting before touching password hashing or database
        loginRateLimiter.checkAllowed(identifier, clientIp);

        try {
            // 2. Perform authentication in a single database round-trip via CustomUserDetailsService
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(identifier, request.getPassword())
            );

            // 3. Clear failed attempts on successful verification
            loginRateLimiter.recordSuccess(identifier, clientIp);

            // 4. Retrieve domain User from CustomUserDetails (zero redundant DB queries)
            User user;
            UserDetails userDetails;
            if (authentication.getPrincipal() instanceof CustomUserDetails cud) {
                user = cud.getUser();
                userDetails = cud;
            } else if (authentication.getPrincipal() instanceof UserDetails ud) {
                userDetails = ud;
                user = userService.getUserByUsername(ud.getUsername());
            } else {
                user = userService.getUserByUsername(identifier);
                userDetails = userDetailsService.loadUserByUsername(user.getUsername());
            }

            // 5. Generate short-lived access token + rotating refresh token
            String accessToken = jwtService.generateToken(userDetails);

            String refreshTokenStr = null;
            if (refreshTokenService != null) {
                RefreshToken refreshToken = refreshTokenService.createRefreshToken(user, httpRequest);
                refreshTokenStr = refreshToken.getToken();
                if (httpResponse != null) {
                    refreshTokenService.attachRefreshTokenCookie(httpResponse, refreshTokenStr);
                }
            }

            long elapsed = System.currentTimeMillis() - startTime;
            log.info("Auth benchmark: Successful login for [{}] completed in {}ms (single DB lookup)", user.getUsername(), elapsed);

            return AuthResponse.builder()
                    .token(accessToken)
                    .refreshToken(refreshTokenStr)
                    .expiresIn(jwtExpirationMs)
                    .type("Bearer")
                    .user(userService.mapToProfileResponse(user))
                    .build();

        } catch (BadCredentialsException e) {
            loginRateLimiter.recordFailure(identifier, clientIp);
            long elapsed = System.currentTimeMillis() - startTime;
            log.warn("Auth failure: Invalid credentials for identifier [{}] from IP [{}] (took {}ms)", identifier, clientIp, elapsed);
            throw new BadCredentialsException("Invalid username or password");
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - startTime;
            log.error("Auth error during login for [{}] after {}ms: {}", identifier, elapsed, e.getMessage());
            throw e;
        }
    }

    public AuthResponse refreshToken(String refreshTokenStr, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        RefreshToken newRefreshToken = refreshTokenService.rotateRefreshToken(refreshTokenStr, httpRequest);
        User user = userService.getUserByUsername(newRefreshToken.getUsername());
        UserDetails userDetails = new CustomUserDetails(user);
        String newAccessToken = jwtService.generateToken(userDetails);

        if (httpResponse != null) {
            refreshTokenService.attachRefreshTokenCookie(httpResponse, newRefreshToken.getToken());
        }

        return AuthResponse.builder()
                .token(newAccessToken)
                .refreshToken(newRefreshToken.getToken())
                .expiresIn(jwtExpirationMs)
                .type("Bearer")
                .user(userService.mapToProfileResponse(user))
                .build();
    }
}
