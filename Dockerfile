# The explorer as a standalone image: the production build served by nginx on port 8080, with the
# VITE_MIDNIGHT_* variables of .env.local read from the container's environment at start
# (docker/30-explorer-env.sh writes them to env.js, which the app loads before it runs). The
# image is the same for every configuration.

ARG NODE_IMAGE=node:24.18.0-bookworm-slim
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.28-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
# The Yarn release package.json pins, verified by checksum.
RUN curl --proto '=https' --tlsv1.2 -fsSL --retry 4 \
        https://repo.yarnpkg.com/4.18.0/packages/yarnpkg-cli/bin/yarn.js \
        -o /opt/yarn.cjs \
    && echo 'fb8b1d20be72a0b544a35bcec4c7ed0ff55a9b173c01f191b02ba164b2051db5  /opt/yarn.cjs' | sha256sum -c \
    && printf '#!/bin/sh\nexec node /opt/yarn.cjs "$@"\n' > /usr/local/bin/yarn \
    && chmod +x /usr/local/bin/yarn
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable
COPY . .
# The version the footer shows: the release tag when the publish workflow passes it, otherwise
# vX.X.X, as the build context carries no git history.
ARG EXPLORER_VERSION=vX.X.X
ENV EXPLORER_VERSION=${EXPLORER_VERSION}
RUN yarn build

FROM ${NGINX_IMAGE} AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/30-explorer-env.sh /docker-entrypoint.d/30-explorer-env.sh
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
EXPOSE 8080
