FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
RUN apt-get update \
	&& apt-get install -y --no-install-recommends fortune-mod fortunes-min cowsay \
	&& rm -rf /var/lib/apt/lists/*
# Debian installs fortune and cowsay under /usr/games
ENV PATH="/usr/games:${PATH}" \
	NODE_ENV=production \
	PORT=8080
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY ABOUT.md ./
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
USER node
CMD ["node", "server/index.mjs"]
