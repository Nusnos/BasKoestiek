import React, { useMemo, useState } from 'react';
import { customerThemes } from '../data/customerThemes.js';

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
  ['callToActionText', 'CTA-tekst'],
  ['leadEmail', 'Lead e-mail'],
];

function buildOrigin() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState(customerThemes);
  const [selectedClientId, setSelectedClientId] = useState(customers[0]?.clientId ?? '');
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.clientId === selectedClientId) ?? customers[0],
    [customers, selectedClientId],
  );
  const origin = buildOrigin();

  function updateSelected(field, value) {
    setCustomers((items) => items.map((customer) => (
      customer.clientId === selectedCustomer.clientId ? { ...customer, [field]: value } : customer
    )));
  }

  if (!selectedCustomer) return null;

  const previewLink = `${origin}/preview/${selectedCustomer.clientId}`;
  const appLink = `${origin}/app/${selectedCustomer.clientId}`;
  const embedLink = `${origin}/embed/${selectedCustomer.clientId}`;
  const embedCode = `<iframe src="${embedLink}" width="100%" height="900" style="border:0;"></iframe>`;

  return (
    <main className="adminMain">
      <section className="adminHeader">
        <div>
          <span>BasKoestiek admin</span>
          <h1>Klantprofielen</h1>
          <p>Mock-data voor de white-label structuur. Later kan deze pagina op een database en login worden aangesloten.</p>
        </div>
      </section>

      <section className="adminLayout">
        <aside className="adminCustomerList">
          {customers.map((customer) => (
            <button
              key={customer.clientId}
              type="button"
              className={customer.clientId === selectedCustomer.clientId ? 'active' : ''}
              onClick={() => setSelectedClientId(customer.clientId)}
            >
              <strong>{customer.companyName}</strong>
              <span>{customer.clientId} · {customer.status}</span>
            </button>
          ))}
        </aside>

        <div className="adminEditor">
          <div className="adminEditorHeader">
            <div>
              <span>clientId</span>
              <h2>{selectedCustomer.clientId}</h2>
            </div>
            <label>
              Status
              <select value={selectedCustomer.status} onChange={(event) => updateSelected('status', event.target.value)}>
                <option value="concept">concept</option>
                <option value="review">review</option>
                <option value="live">live</option>
              </select>
            </label>
          </div>

          <div className="adminFormGrid">
            {editableFields.map(([field, label]) => (
              <label key={field} className={field === 'introText' || field === 'callToActionText' ? 'wide' : ''}>
                {label}
                <input
                  type={field.toLowerCase().includes('color') ? 'color' : 'text'}
                  value={selectedCustomer[field] ?? ''}
                  onChange={(event) => updateSelected(field, event.target.value)}
                />
              </label>
            ))}
          </div>

          <div className="adminLinks">
            <div>
              <span>Preview-link</span>
              <a href={previewLink}>{previewLink}</a>
            </div>
            <div>
              <span>Live app-link</span>
              <a href={appLink}>{appLink}</a>
            </div>
            <div>
              <span>Embed-code</span>
              <textarea readOnly value={embedCode} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
