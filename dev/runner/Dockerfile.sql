FROM postgres:17-alpine
RUN apk add --no-cache python3
COPY harness.py /opt/harness.py
COPY entrypoint.sh /opt/entrypoint.sh
RUN chmod 0755 /opt/entrypoint.sh /opt/harness.py
ENV PATH=/usr/local/bin:$PATH
WORKDIR /work
ENTRYPOINT ["/opt/entrypoint.sh"]
