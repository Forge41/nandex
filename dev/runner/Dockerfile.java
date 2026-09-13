FROM eclipse-temurin:21-jdk
ARG JUNIT_VERSION=1.11.4
ARG ASSERTJ_VERSION=3.25.1
RUN apt-get update && apt-get install -y --no-install-recommends python3 curl ca-certificates \
    && curl -fsSL -o /opt/junit-console.jar \
       "https://repo1.maven.org/maven2/org/junit/platform/junit-platform-console-standalone/${JUNIT_VERSION}/junit-platform-console-standalone-${JUNIT_VERSION}.jar" \
    # Imported exercises assert with AssertJ, so it has to be on the classpath at both
    # compile and run time -- it is not something a candidate could add themselves.
    && curl -fsSL -o /opt/assertj-core.jar \
       "https://repo1.maven.org/maven2/org/assertj/assertj-core/${ASSERTJ_VERSION}/assertj-core-${ASSERTJ_VERSION}.jar" \
    && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
ENV JUNIT_JAR=/opt/junit-console.jar
ENV EXTRA_JARS=/opt/assertj-core.jar
COPY harness.py /opt/harness.py
COPY entrypoint.sh /opt/entrypoint.sh
RUN chmod 0755 /opt/entrypoint.sh /opt/harness.py
WORKDIR /work
ENTRYPOINT ["/opt/entrypoint.sh"]
