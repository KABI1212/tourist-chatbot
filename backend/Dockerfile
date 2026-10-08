# ===================================================================
# Tourist Chatbot Backend - Production Multi-Stage Dockerfile
# Optimized for Render (512MB Free Tier & paid web services)
# ===================================================================

# ── Stage 1: Build JAR with Maven & Eclipse Temurin JDK 17 ──
FROM maven:3.9.6-eclipse-temurin-17-alpine AS build
WORKDIR /app

# Copy pom.xml and source code
COPY pom.xml .
COPY src ./src

# Build executable JAR skipping tests for fast deployment
RUN mvn clean package -DskipTests -B

# ── Stage 2: Lightweight Runtime with Eclipse Temurin JRE 17 ──
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Run as dedicated unprivileged user for security
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy compiled jar from build stage
COPY --from=build /app/target/*.jar app.jar

# Render automatically provides the PORT environment variable (e.g. 10000 or 8080)
ENV PORT=8080
EXPOSE ${PORT}

# Container JVM flags:
# -XX:+UseContainerSupport: Detects container cgroup memory limits
# -XX:MaxRAMPercentage=75.0: Allocates up to ~384MB heap in Render's 512MB container, avoiding OOM kill
# -Dserver.port=${PORT:-8080}: Ensures Spring Boot binds directly to Render's assigned port
ENTRYPOINT ["sh", "-c", "java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Dserver.port=${PORT:-8080} -jar app.jar"]
