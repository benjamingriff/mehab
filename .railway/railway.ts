import { defineRailway, project, service } from 'railway/iac';

// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = 'rehab-api';

export default defineRailway(() => {
  const rehab_api = service('rehab-api', {
    build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile' },
    env: {
      DATABASE_URL: '${{Postgres.DATABASE_URL}}',
      NODE_ENV: 'production',
      PORT: '3000',
      CORS_ORIGINS: 'http://localhost:8081,http://127.0.0.1:8081',
    },
    start: 'node apps/api/dist/server.js',
    healthcheck: '/health',
    healthcheckTimeout: 60,
    preDeploy: 'node apps/api/dist/migrate.js',
    deploy: { restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 3 },
  });
  return project('mehab', {
    resources: [rehab_api],
  });
});
