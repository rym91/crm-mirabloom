/** @type {import('next').NextConfig} */
module.exports = {
  output: "standalone",
  experimental: {
    // Прод-домен за Caddy (см. docs/08). localhost разрешён по умолчанию — для dev менять не нужно.
    serverActions: { allowedOrigins: ["crm.mirabloom.eu"] },
  },
};