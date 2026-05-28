import React, { useEffect, useState } from 'react';
import CustomerReport from './CustomerReport.jsx';
import InternalReport from './InternalReport.jsx';
import ReportActions from './ReportActions.jsx';

function AccountSavePrompt() {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showAccountFlow, setShowAccountFlow] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    if (isDismissed || hasTriggered) return undefined;

    function handleScroll() {
      if (window.scrollY > 220) {
        setIsVisible(true);
        setHasTriggered(true);
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasTriggered, isDismissed]);

  if (isDismissed || !isVisible) return null;

  return (
    <div className="modalBackdrop accountModalBackdrop" role="presentation">
      <section className="accountSavePrompt accountSaveModal" role="dialog" aria-modal="true" aria-labelledby="account-save-title">
        <div>
          <span>Handig voor later</span>
          <h3 id="account-save-title">Wil je jouw project bewaren?</h3>
          <p>
            Je hebt nu een eerste indruk van wat BasKoestiek voor jouw ruimte kan betekenen.
            Maak gratis een account aan om je ruimte, advies en gekozen kunstwerken te bewaren.
            Zo kun je later verdergaan, aanpassingen doen of het project eenvoudig met ons bespreken.
          </p>
        </div>

        <div className="accountPromptActions">
          <button type="button" className="primaryButton" onClick={() => setShowAccountFlow(true)}>
            Project bewaren
          </button>
          <button type="button" className="secondaryButton" onClick={() => setIsDismissed(true)}>
            Doorgaan zonder account
          </button>
        </div>

        {showAccountFlow && (
          <div className="accountFlowPanel">
          <div>
            <h4>Maak gratis een account aan</h4>
            <p>Bewaar je project en ontvang later gericht advies over formaat, kleur en plaatsing.</p>
          </div>
          <div className="accountFlowGrid">
            <label className="field">
              <span>Naam</span>
              <div className="fieldInput">
                <input type="text" autoComplete="name" />
              </div>
            </label>
            <label className="field">
              <span>E-mail</span>
              <div className="fieldInput">
                <input type="email" autoComplete="email" />
              </div>
            </label>
          </div>
          <div className="accountPromptActions">
            <button type="button" className="primaryButton">
              Account aanmaken en bewaren
            </button>
            <button type="button" className="secondaryButton" onClick={() => setShowAccountFlow(false)}>
              Later doen
            </button>
          </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function ReportsPanel({ customerReportData, internalReportData }) {
  return (
    <section className="panel reportsPanel">
      <div className="panelHeader">
        <div className="panelTitle">
          <h2>Advies voor jouw ruimte</h2>
        </div>
      </div>

      <CustomerReport data={customerReportData} />
      <AccountSavePrompt />

      {/* TODO: zet dit interne rapport achter login/admin-beveiliging voordat de app publiek wordt gebruikt. */}
      <details className="internalReportDetails">
        <summary>
          <span>Intern rapport voor BasKoetiek</span>
          <small>Alleen bedoeld voor intern gebruik.</small>
        </summary>
        <InternalReport data={internalReportData} />
        <ReportActions activeReport="internal" internalReportData={internalReportData} />
      </details>
    </section>
  );
}
