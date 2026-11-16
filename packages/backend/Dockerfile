# The backend as a standalone image: Node runs the TypeScript sources of packages/backend and the
# workspaces it imports, with their production dependencies. Its build context is the repository
# root: docker build -f packages/backend/Dockerfile .

ARG NODE_IMAGE=node:24.18.0-bookworm-slim

FROM ${NODE_IMAGE} AS install
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
# Yarn resolves the lockfile only with every workspace's manifest present.
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/ui/package.json packages/ui/
COPY packages/lib/package.json packages/lib/
COPY packages/api/package.json packages/api/
COPY packages/backend/package.json packages/backend/
RUN yarn workspaces focus @sig-net/explorer-backend --production
COPY packages/lib/src packages/lib/src
COPY packages/api/src packages/api/src
COPY packages/backend/src packages/backend/src
RUN find packages -name '*.test.ts' -delete \
    && rm -r packages/ui

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=install /app/package.json ./
COPY --from=install /app/node_modules node_modules
COPY --from=install /app/packages packages
USER node
EXPOSE 8080
CMD ["node", "packages/backend/src/main.ts"]
