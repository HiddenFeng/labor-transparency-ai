FROM node:22-alpine

ARG LTP_IMAGE_REVISION=local
LABEL org.opencontainers.image.title="Worker Manifest Fellowship / Labor Transparency self-host"
LABEL org.opencontainers.image.description="Non-commercial public-interest independent instance runtime"
LABEL org.opencontainers.image.revision="${LTP_IMAGE_REVISION}"

WORKDIR /app
COPY --chown=node:node sites-app/public ./sites-app/public
COPY --chown=node:node sites-app/src ./sites-app/src
COPY --chown=node:node scripts/instance ./scripts/instance
COPY --chown=node:node scripts/federation ./scripts/federation
COPY --chown=node:node LICENSE LICENSE-DATA.md NOTICE README.md NON_COMMERCIAL_POLICY.md PRIVACY.md SECURITY.md INSTANCE_OPERATORS.md TRADEMARK.md BRANDING.md AUTHORS.md ./

RUN mkdir -p /var/lib/ltp && chown node:node /var/lib/ltp
USER node

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    LTP_INSTANCE_DIR=/var/lib/ltp/instance \
    LTP_SELF_HOST_CONTAINER=true \
    LTP_SELF_HOST_SECURE_COOKIE=true

VOLUME ["/var/lib/ltp"]
EXPOSE 8787
HEALTHCHECK --interval=20s --timeout=7s --start-period=10s --retries=3 CMD ["node","scripts/instance/healthcheck.mjs","--url","http://127.0.0.1:8787"]
ENTRYPOINT ["node","scripts/instance/self-host-server.mjs"]
