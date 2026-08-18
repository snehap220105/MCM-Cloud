import express from 'express';
import cors from 'cors';
import organizationSettingsRouter from './routes/organizationSettings.js';
import subscriptionRouter from './routes/subscription.js';
import purchasesRouter from './routes/purchases.js';
import authorizedOrganizationsRouter from './routes/authorizedOrganizations.js';
import auditLogRouter from './routes/auditLog.js';

export const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/account-settings/organization-settings', organizationSettingsRouter);
app.use('/api/account-settings/subscription', subscriptionRouter);
app.use('/api/account-settings/purchases', purchasesRouter);
app.use('/api/account-settings/authorized-organizations', authorizedOrganizationsRouter);
app.use('/api/account-settings/audit-log', auditLogRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Central error handler — every route below forwards errors via next(err).
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status ?? 500;
  res.status(status).json({ error: err.message ?? 'Internal server error' });
});
