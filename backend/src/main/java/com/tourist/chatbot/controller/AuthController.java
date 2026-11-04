package com.tourist.chatbot.controller;

import com.tourist.chatbot.dto.ApiResponse;
import com.tourist.chatbot.dto.AuthRequest;
import com.tourist.chatbot.dto.AuthResponse;
import com.tourist.chatbot.dto.RegisterRequest;
import com.tourist.chatbot.dto.ResetAuthResponse;
import com.tourist.chatbot.dto.ResetPasswordRequest;
import com.tourist.chatbot.dto.UserProfileResponse;
import com.tourist.chatbot.dto.VerifyResetEmailRequest;
import com.tourist.chatbot.model.User;
import com.tourist.chatbot.service.AuthService;
import com.tourist.chatbot.service.PasswordResetService;
import com.tourist.chatbot.service.RefreshTokenService;
import com.tourist.chatbot.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserService userService;
    private final PasswordResetService passwordResetService;
    private final RefreshTokenService refreshTokenService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        AuthResponse response = authService.register(request, httpRequest, httpResponse);
        return ResponseEntity.ok(ApiResponse.success("Registration successful", response));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody AuthRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        AuthResponse response = authService.login(request, httpRequest, httpResponse);
        return ResponseEntity.ok(ApiResponse.success("Login successful", response));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(
            @RequestBody(required = false) Map<String, String> body,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        String tokenStr = null;
        if (body != null && body.containsKey("refreshToken") && !body.get("refreshToken").isBlank()) {
            tokenStr = body.get("refreshToken").trim();
        } else {
            tokenStr = refreshTokenService.extractRefreshTokenFromCookies(httpRequest).orElse(null);
        }

        if (tokenStr == null || tokenStr.isBlank()) {
            return ResponseEntity.status(401).body(ApiResponse.error("Refresh token missing or unprovided", 401));
        }

        AuthResponse response = authService.refreshToken(tokenStr, httpRequest, httpResponse);
        return ResponseEntity.ok(ApiResponse.success("Token refreshed successfully", response));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Map<String, String>>> logout(
            @RequestBody(required = false) Map<String, String> body,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        String tokenStr = null;
        if (body != null && body.containsKey("refreshToken")) {
            tokenStr = body.get("refreshToken");
        } else {
            tokenStr = refreshTokenService.extractRefreshTokenFromCookies(httpRequest).orElse(null);
        }

        if (tokenStr != null) {
            refreshTokenService.revokeToken(tokenStr);
        }
        refreshTokenService.clearRefreshTokenCookie(httpResponse);

        return ResponseEntity.ok(ApiResponse.success("Logged out successfully", Map.of("status", "logged_out")));
    }

    @PostMapping("/logout-all")
    public ResponseEntity<ApiResponse<Map<String, String>>> logoutAllDevices(
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletResponse httpResponse
    ) {
        if (userDetails != null) {
            User user = userService.getUserByUsername(userDetails.getUsername());
            refreshTokenService.revokeAllUserTokens(user.getId());
        }
        refreshTokenService.clearRefreshTokenCookie(httpResponse);
        return ResponseEntity.ok(ApiResponse.success("All active sessions revoked successfully", Map.of("status", "all_logged_out")));
    }

    @GetMapping("/sessions")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getActiveSessions(
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest httpRequest
    ) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Unauthenticated", 401));
        }
        User user = userService.getUserByUsername(userDetails.getUsername());
        String currentToken = refreshTokenService.extractRefreshTokenFromCookies(httpRequest).orElse(null);
        List<Map<String, Object>> sessions = refreshTokenService.getUserActiveSessions(user.getId(), currentToken);
        return ResponseEntity.ok(ApiResponse.success(sessions));
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<Map<String, String>>> revokeSession(
            @PathVariable("sessionId") String sessionId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Unauthenticated", 401));
        }
        User user = userService.getUserByUsername(userDetails.getUsername());
        refreshTokenService.revokeSession(sessionId, user.getId());
        return ResponseEntity.ok(ApiResponse.success("Session revoked", Map.of("sessionId", sessionId)));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getCurrentUser(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Unauthenticated", 401));
        }
        UserProfileResponse profile = userService.getProfile(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(profile));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<ResetAuthResponse>> forgotPassword(@Valid @RequestBody VerifyResetEmailRequest request) {
        ResetAuthResponse response = passwordResetService.verifyAccountAndCreateResetAuth(request.getEmail());
        return ResponseEntity.ok(ApiResponse.success("Account verified. You may now securely set a new password.", response));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Map<String, String>>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request);
        return ResponseEntity.ok(ApiResponse.success("Password reset successfully. Please sign in with your new password.", Map.of("status", "success")));
    }
}
