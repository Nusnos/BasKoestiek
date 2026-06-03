import { customerThemes, defaultCustomerTheme } from '../data/customerThemes.js';

const routeModes = new Set(['app', 'embed', 'preview', 'admin']);

function normalizeClientId(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function getCustomerById(clientId) {
  const normalized = normalizeClientId(clientId);
  return customerThemes.find((theme) => theme.clientId === normalized) ?? null;
}

export function getCustomerConfig(pathname = '/') {
  const segments = pathname.split('/').filter(Boolean);
  const routeMode = routeModes.has(segments[0]) ? segments[0] : 'app';
  const isAdmin = routeMode === 'admin';
  const isEmbed = routeMode === 'embed';
  const isPreview = routeMode === 'preview';
  const explicitClientId = ['app', 'embed', 'preview'].includes(routeMode) ? normalizeClientId(segments[1]) : '';
  const clientId = explicitClientId || defaultCustomerTheme.clientId;
  const customerConfig = getCustomerById(clientId);
  const isDefaultClient = clientId === defaultCustomerTheme.clientId;
  const allowsNonLive = isPreview || isAdmin;
  const isAvailable = Boolean(customerConfig)
    && (isDefaultClient || allowsNonLive || customerConfig.status === 'live');

  return {
    routeMode,
    clientId,
    customerConfig: isAvailable ? customerConfig : null,
    fallbackConfig: defaultCustomerTheme,
    isAdmin,
    isEmbed,
    isPreview,
    isAvailable,
    unavailableReason: customerConfig ? 'not-live' : 'missing',
  };
}
