package com.flashsale.order_service.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Slf4j
@Component
@Order(1)
public class JwtFilter extends OncePerRequestFilter {

    @Value("${jwt.secret:flash-sale-super-secure-jwt-secret-key-that-is-at-least-256-bits-long-for-hmac-sha256}")
    private String jwtSecret;

    private SecretKey key;

    @PostConstruct
    public void init() {
        this.key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        // Pre-flight CORS requests must always be allowed through
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            response.setStatus(HttpServletResponse.SC_OK);
            filterChain.doFilter(request, response);
            return;
        }

        String path = request.getRequestURI();

        // Protected reservation endpoints require valid JWT
        if (path.startsWith("/orders/place") || path.startsWith("/orders/reserve")) {
            String token = extractToken(request);
            if (!StringUtils.hasText(token)) {
                sendUnauthorized(response, "Authorization header with Bearer token is missing");
                return;
            }

            try {
                Claims claims = Jwts.parser()
                        .verifyWith(key)
                        .build()
                        .parseSignedClaims(token)
                        .getPayload();

                Long userId = Long.parseLong(claims.getSubject());
                request.setAttribute("userId", userId);
            } catch (Exception ex) {
                log.warn("Invalid JWT token for path {}: {}", path, ex.getMessage());
                sendUnauthorized(response, "Invalid or expired JWT token");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String bearer = request.getHeader("Authorization");
        if (StringUtils.hasText(bearer) && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }
        return null;
    }

    private void sendUnauthorized(HttpServletResponse response, String message) throws IOException {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
        response.setHeader("Access-Control-Allow-Headers", "*");
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write(String.format("{\"status\":\"UNAUTHORIZED\",\"message\":\"%s\"}", message));
    }
}
