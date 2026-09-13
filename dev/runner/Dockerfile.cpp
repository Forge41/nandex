FROM gcc:14
RUN apt-get update && apt-get install -y --no-install-recommends python3 cmake libgtest-dev \
    && cmake -S /usr/src/googletest -B /tmp/gtest-build \
    && cmake --build /tmp/gtest-build --target install -j 4 \
    && rm -rf /tmp/gtest-build /var/lib/apt/lists/*
COPY harness.py /opt/harness.py
COPY entrypoint.sh /opt/entrypoint.sh
RUN chmod 0755 /opt/entrypoint.sh /opt/harness.py
WORKDIR /work
ENTRYPOINT ["/opt/entrypoint.sh"]
