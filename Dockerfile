FROM node:20-alpine AS admin-build

WORKDIR /app/backend/admin

COPY backend/admin/package.json ./
RUN npm install

COPY backend/admin/ ./
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app/backend

ENV NODE_ENV=production

COPY backend/package.json backend/package-lock.json ./
RUN npm install --omit=dev

COPY backend/ ./
COPY --from=admin-build /app/backend/admin/dist ./admin/dist

EXPOSE 3000

CMD ["npm", "start"]
