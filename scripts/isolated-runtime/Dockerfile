FROM debian:trixie-slim

# Provisioning is an explicit operator/CI action. The runner never builds or
# pulls an image, installs tools, or starts a Docker daemon.
RUN apt-get update && apt-get install --yes --no-install-recommends \
    lilypond poppler-utils python3 ca-certificates fonts-dejavu-core \
    && mkdir /input /work /opt/opus \
    && chown 65532:65532 /work
COPY worker.py /opt/opus/worker.py
ARG OPUS_POLICY_SHA256
LABEL org.opus.isolated-runtime="1" org.opus.policy-sha256="${OPUS_POLICY_SHA256}"
ENV HOME=/work/home TMPDIR=/work/tmp LANG=C.UTF-8 LC_ALL=C.UTF-8
USER 65532:65532
WORKDIR /work
ENTRYPOINT ["/usr/bin/python3", "-I", "/opt/opus/worker.py"]
