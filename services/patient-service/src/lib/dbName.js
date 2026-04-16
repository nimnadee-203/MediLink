const RESERVED_SYSTEM_DBS = new Set(['admin', 'local', 'config']);

export const resolveSafeDbName = (configuredName, fallbackName, warningContext = 'patient-service') => {
  const fallback = String(fallbackName || '').trim() || 'app_db';
  const candidate = String(configuredName || '').trim();

  if (!candidate) {
    return fallback;
  }

  if (RESERVED_SYSTEM_DBS.has(candidate.toLowerCase())) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[${warningContext}] Database name "${candidate}" is reserved by MongoDB. Falling back to "${fallback}".`);
    }
    return fallback;
  }

  return candidate;
};
