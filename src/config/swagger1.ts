// Second Swagger document served at /api-docs1 — add paths/schemas here.
export const swaggerSpec1 = {
  openapi: '3.0.0',
  info: {
    title:   'API Docs 1',
    version: '1.0.0',
  },
  servers: [
    { url: 'https://api.succesly.in/api/v1', description: 'Production server' },
    { url: 'http://localhost:7000/api/v1',   description: 'Development server' },
  ],
  paths: {},
  components: { schemas: {} },
};
