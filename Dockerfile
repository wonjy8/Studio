FROM node:24-alpine
ARG STUDIO_REVISION=development
ENV STUDIO_REVISION=$STUDIO_REVISION
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data PORT=8080
COPY --chown=node:node package.json index.html ./
COPY --chown=node:node src ./src
COPY --chown=node:node server ./server
COPY --chown=node:node tools ./tools
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "tools/healthcheck.js"]
CMD ["node", "server/index.js"]
