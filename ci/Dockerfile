# The build toolchain resolves native binaries (Rolldown, Oxc, Lightning CSS, Tailwind Oxide and
# the native TypeScript compiler), so this stage stays on glibc. Its size never ships.
FROM node:24-bookworm-slim AS build

WORKDIR /app

# The manifests arrive ahead of the sources so that editing src/ reuses the installed layer.
COPY package.json yarn.lock .yarnrc.yml ./
RUN corepack enable && yarn install --immutable

COPY . .
RUN yarn build

# The Midnight ledger and onchain-runtime modules are most of the output and gzip to under a
# quarter of their size. Their names are content hashed, so compressing once here spares the pod
# that work on every cold request.
RUN find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' \
        -o -name '*.json' -o -name '*.wasm' \) -exec gzip -9 -k {} +


FROM nginxinc/nginx-unprivileged:1.30-alpine

ARG REVISION=unknown

LABEL org.opencontainers.image.source="https://github.com/sig-net/explorer" \
      org.opencontainers.image.title="explorer" \
      org.opencontainers.image.description="Single-page application for exploring sig.network activity, served as static files by nginx" \
      org.opencontainers.image.revision="${REVISION}"

COPY ci/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY ci/nginx/default.conf /etc/nginx/conf.d/default.conf
# A root of its own keeps the base image's welcome and error pages out of the served site.
COPY --from=build /app/dist /srv/explorer

EXPOSE 8080
