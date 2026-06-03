import React, { useMemo, useState } from 'react';
import { customerThemes, defaultCustomerTheme } from '../data/customerThemes.js';

const ADMIN_STORAGE_KEY = 'baskoestiek-admin-customers-v1';

const statusOptions = ['concept', 'review', 'live'];

const editableFields = [
  ['companyName', 'Klantnaam'],
  ['logoUrl', 'Logo URL'],
  ['primaryColor', 'Primaire kleur'],
  ['secondaryColor', 'Secundaire kleur'],
  ['accentColor', 'Accentkleur'],
  ['backgroundColor', 'Achtergrondkleur'],
  ['textColor', 'Tekstkleur'],
  ['buttonColor', 'Buttonkleur'],
  ['buttonTextColor', 'Button tekstkleur'],
  ['fontFamily', 'Lettertype'],
  ['heroImageUrl', 'Hero afbeelding'],
  ['introTitle', 'Intro titel'],
  ['introText', 'Intro tekst'],
  ['startButtonText', 'Startknop tekst'],
  ['reportTitle', 'Rapporttitel'],
  ['callToActionText', 'CTA-tekst'],
  ['leadEmail', 'Lead e-mail'],
  ['productSet', 'Productset'],
];

function buildOrigin() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function readAdminCustomers() {
  try {
    const raw = window.localStorage.getItem(ADMIN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : customerThemes;
  } catch {
    return customerThemes;
  }
}

function writeAdminCustomers(customers) {
  window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(customers));
}

function slugifyClientId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getAdminRoute() {
  if (typeof window === 'undefined') return { mode: 'overview', clientId: '' };
  const segments = window.location.pathname.split('/').filter(Boolean);
  if (segments[0] !== 'admin' || segments[1] !== 'customers') return { mode: 'overview', clientId: '' };
  if (segments[2] === 'new') return { mode: 'new', clientId: '' };
  if (segments[2] && segments[3] === 'edit') return { mode: 'edit', clientId: segments[2] };
  return { mode: 'overview', clientId: '' };
}

function createEmptyCustomer() {
  return {
    ...defaultCustomerTheme,
    clientId: 'nieuwe-klant',
    companyName: 'Nieuwe klant',
    leadEmail: '',
    status: 'concept',
    showInternalReport: false,
  };
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState(readAdminCustomers);
  const [route, setRoute] = useState(getAdminRoute);
  const [draftCustomer, setDraftCustomer] = useState(createEmptyCustomer);
  const [copyMessage, setCopyMessage] = useState('');
  const origin = buildOrigin();

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.clientId === route.clientId) ?? customers[0],
    [customers, route.clientId],
  );

  const activeCustomer = route.mode === 'new' ? draftCustomer : selectedCustomer;
  const isEditing = route.mode === 'new' || route.mode === 'edit';

  function navigate(nextPath) {
    window.history.pushState({}, '', nextPath);
    setRoute(getAdminRoute());
    setCopyMessage('');
  }

  function persistCustomers(nextCustomers) {
    setCustomers(nextCustomers);
    writeAdminCustomers(nextCustomers);
  }

  function updateActive(field, value) {
    const normalizedValue = field === 'clientId' ? slugifyClientId(value) : value;
    if (route.mode === 'new') {
      setDraftCustomer((current) => ({ ...current, [field]: normalizedValue }));
      return;
    }

    persistCustomers(customers.map((customer) => (
      customer.clientId === activeCustomer.clientId ? { ...customer, [field]: normalizedValue } : customer
    )));

    if (field === 'clientId') {
      navigate(`/admin/customers/${normalizedValue}/edit`);
    }
  }

  function saveNewCustomer() {
    const clientId = slugifyClientId(draftCustomer.clientId || draftCustomer.companyName);
    if (!clientId) {
      setCopyMessage('Vul eerst een geldige Client ID in.');
      return;
    }

    const nextCustomer = { ...draftCustomer, clientId };
    const nextCustomers = [
      nextCustomer,
      ...customers.filter((customer) => customer.clientId !== clientId),
    ];
    persistCustomers(nextCustomers);
    setDraftCustomer(createEmptyCustomer());
    navigate(`/admin/customers/${clientId}/edit`);
  }

  async function copyEmbedCode(clientId) {
    const embedLink = `${origin}/embed/${clientId}`;
    const embedCode = `<iframe src="${embedLink}" width="100%" height="900" style="border:0;"></iframe>`;
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopyMessage(`Embed-code voor ${clientId} gekopieerd.`);
    } catch {
      setCopyMessage('Kopiëren lukt niet automatisch. Selecteer de embed-code handmatig.');
    }
  }

  function renderLink(path) {
    return `${origin}${path}`;
  }

  return (
    <main className="adminMain">
      <section className="adminHeader">
        <div>
          <span>BasKoestiek admin</span>
          <h1>BasKoestiek Beheerportal</h1>
          <p>Beheer klantprofielen voor de centrale multi-tenant akoestiektool. De data is nu mock/localStorage en kan later aan een database worden gekoppeld.</p>
        </div>
        <button type="button" className="primaryButton" onClick={() => navigate('/admin/customers/new')}>
          Nieuwe klant aanmaken
        </button>
      </section>

      <section className="adminOverview">
        <div className="adminOverviewHeader">
          <h2>Klantenoverzicht</h2>
          {copyMessage && <p className="storageMessage">{copyMessage}</p>}
        </div>

        <div className="adminCustomerTable">
          <div className="adminCustomerTableHead">
            <span>Klantnaam</span>
            <span>Client ID</span>
            <span>Status</span>
            <span>Preview-link</span>
            <span>Embed-link</span>
            <span>Acties</span>
          </div>
          {customers.map((customer) => (
            <article key={customer.clientId} className="adminCustomerRow">
              <strong>{customer.companyName}</strong>
              <code>{customer.clientId}</code>
              <span className={`statusPill status-${customer.status}`}>{customer.status}</span>
              <a href={`/preview/${customer.clientId}`}>{renderLink(`/preview/${customer.clientId}`)}</a>
              <a href={`/embed/${customer.clientId}`}>{renderLink(`/embed/${customer.clientId}`)}</a>
              <div className="adminRowActions">
                <button type="button" className="secondaryButton" onClick={() => navigate(`/admin/customers/${customer.clientId}/edit`)}>
                  Bewerken
                </button>
                <button type="button" className="secondaryButton" onClick={() => copyEmbedCode(customer.clientId)}>
                  Embed-code kopiëren
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {isEditing && activeCustomer && (
        <section className="adminEditor">
          <div className="adminEditorHeader">
            <div>
              <span>{route.mode === 'new' ? 'Nieuwe klant' : 'Klant bewerken'}</span>
              <h2>{route.mode === 'new' ? 'Nieuwe klant aanmaken' : activeCustomer.companyName}</h2>
            </div>
            <div className="adminEditorActions">
              {route.mode === 'new' ? (
                <button type="button" className="primaryButton" onClick={saveNewCustomer}>
                  Nieuwe klant opslaan
                </button>
              ) : (
                <button type="button" className="secondaryButton" onClick={() => navigate('/admin/customers')}>
                  Terug naar overzicht
                </button>
              )}
            </div>
          </div>

          <div className="adminFormGrid">
            <label>
              Client ID
              <input
                type="text"
                value={activeCustomer.clientId}
                onChange={(event) => updateActive('clientId', event.target.value)}
              />
            </label>
            <label>
              Status
              <select value={activeCustomer.status} onChange={(event) => updateActive('status', event.target.value)}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              Intern rapport tonen
              <select
                value={activeCustomer.showInternalReport ? 'true' : 'false'}
                onChange={(event) => updateActive('showInternalReport', event.target.value === 'true')}
              >
                <option value="false">Nee</option>
                <option value="true">Ja</option>
              </select>
            </label>
            {editableFields.map(([field, label]) => (
              <label key={field} className={field === 'introText' || field === 'callToActionText' ? 'wide' : ''}>
                {label}
                <input
                  type={field.toLowerCase().includes('color') ? 'color' : 'text'}
                  value={activeCustomer[field] ?? ''}
                  onChange={(event) => updateActive(field, event.target.value)}
                />
              </label>
            ))}
          </div>

          <div className="adminLinks">
            <div>
              <span>Preview-link</span>
              <a href={`/preview/${activeCustomer.clientId}`}>{renderLink(`/preview/${activeCustomer.clientId}`)}</a>
            </div>
            <div>
              <span>Embed-link</span>
              <a href={`/embed/${activeCustomer.clientId}`}>{renderLink(`/embed/${activeCustomer.clientId}`)}</a>
            </div>
            <div>
              <span>Embed-code</span>
              <textarea readOnly value={`<iframe src="${renderLink(`/embed/${activeCustomer.clientId}`)}" width="100%" height="900" style="border:0;"></iframe>`} />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
