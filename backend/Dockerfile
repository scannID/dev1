FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /workspace
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B package -DskipTests

FROM eclipse-temurin:21-jre-jammy AS runtime

RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system scanny \
    && useradd --system --gid scanny --home-dir /app --shell /usr/sbin/nologin scanny

WORKDIR /app
COPY --from=build --chown=scanny:scanny /workspace/target/*.jar app.jar

USER scanny
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl --fail --silent --show-error http://127.0.0.1:4000/api/health \
    || curl --fail --silent --show-error http://127.0.0.1:4000/health \
    || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
