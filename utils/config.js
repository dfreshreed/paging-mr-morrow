import dotenv from 'dotenv';
dotenv.config();

export const config = {
  httpEp: process.env.HTTP_URL,
  wsEp: process.env.WS_URL,
  authEp: process.env.AUTH_URL,
  tenantId: process.env.TENANT_ID,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  grantType: 'client_credentials',
};
