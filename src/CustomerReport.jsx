import React, { useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import SketchPreview from './SketchPreview.jsx';

function formatRoomType(roomType) {
  const labels = {
    'living-room': 'Woonkamer',
    living_room: 'Woonkamer',
    woning: 'Woonkamer',
    restaurant: 'Restaurant',
    cafe: 'Cafe',
    office: 'Kantoor',
    kantoor: 'Kantoor',
    meeting: 'Vergaderruimte',
    meeting_room: 'Vergaderruimte',
    other: 'Anders',
  };
  return labels[roomType] ?? roomType ?? '-';
}

function Paragraphs({ text }) {
  return String(text ?? '').split('\n\n').filter(Boolean).map((paragraph) => (
    <p key={paragraph}>{paragraph}</p>
  ));
}

function ReportBarometer({ data }) {
  if (!data?.currentLevel || !data?.newLevel) return null;

  return (
    <div className="acousticBarometer reportBarometer">
      <div className="barometerHeader">
        <div>
          <span>Voor / na comfortmeter</span>
          <h3>{data.newLevel.label}</h3>
        </div>
        <strong>{data.artworkStats?.count ?? 0} kunstwerken</strong>
      </div>

      <div className="barometerScale">
        <div className="barometerLabels">
          <span className="balanced">Stil & gebalanceerd</span>
          <span className="quietComfort">Rustig comfort</span>
          <span className="comfortable">Comfortabel</span>
          <span className="moreBalance">Meer balans gewenst</span>
          <span className="lively">Levendige ruimte</span>
        </div>
        <div className="barometerTrack">
          <span className="barometerFill" style={{ height: `${Math.max(7, data.newLevel.score)}%` }} />
          <span className="barometerDot current" style={{ bottom: `${Math.max(7, data.currentLevel.score)}%` }} />
          <span className="barometerDot after" style={{ bottom: `${Math.max(7, data.newLevel.score)}%` }} />
        </div>
        <div className="barometerMarkers">
          <span className="barometerMarker current" style={{ bottom: `${Math.max(7, data.currentLevel.score)}%` }}>
            <em>Nu</em>
            <strong>{data.currentLevel.label}</strong>
          </span>
          <span className="barometerMarker after" style={{ bottom: `${Math.max(7, data.newLevel.score)}%` }}>
            <em>Met BasKoetiek</em>
            <strong>{data.newLevel.label}</strong>
          </span>
        </div>
      </div>

      {data.adviceText && <p className="barometerLevelText">{data.adviceText}</p>}
    </div>
  );
}

const helpOptions = [
  'Vraag persoonlijk advies aan',
  'Vraag offerte aan',
  'Bekijk kunstwerken',
  'Stel mijn combinatie samen',
  'Download klantadvies',
];

function HelpRequestModal({ open, data, onClose }) {
  const [selectedOptions, setSelectedOptions] = useState([helpOptions[0]]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [hasConsent, setHasConsent] = useState(false);

  const mailtoHref = useMemo(() => {
    const subject = `BasKoestiek aanvraag ${data.adviceCode ?? ''}`.trim();
    const body = [
      'Hallo BasKoestiek,',
      '',
      'Ik wil graag hulp bij mijn akoestische quickscan.',
      '',
      `Adviescode: ${data.adviceCode ?? '-'}`,
      `Ruimte: ${formatRoomType(data.roomType)}`,
      `Naam: ${name || '-'}`,
      `E-mail: ${email || '-'}`,
      `Ik wil graag: ${selectedOptions.join(', ') || '-'}`,
      '',
      `Bericht: ${message || '-'}`,
      '',
      'Met vriendelijke groet,',
      name || '',
    ].join('\n');

    return `mailto:info@baskoestiek.nl?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [data.adviceCode, data.roomType, email, message, name, selectedOptions]);

  if (!open) return null;

  function toggleOption(option) {
    setSelectedOptions((current) => (
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option]
    ));
  }

  return (
    <div className="modalBackdrop helpModalBackdrop" role="presentation">
      <section className="flowModal helpRequestModal" role="dialog" aria-modal="true" aria-labelledby="help-request-title">
        <div className="modalHeader">
          <span>Volgende stap</span>
          <h2 id="help-request-title">Waarmee kunnen we je helpen?</h2>
          <p>Kies wat je graag wilt ontvangen. Dan maken we van je quickscan een praktische vervolgstap.</p>
        </div>

        <div className="choiceBlock">
          <span>Ik wil graag</span>
          <div className="helpChoiceGrid">
            {helpOptions.map((option) => (
              <label key={option} className={selectedOptions.includes(option) ? 'helpChoice active' : 'helpChoice'}>
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(option)}
                  onChange={() => toggleOption(option)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="accountFlowGrid">
          <label className="field">
            <span>Naam</span>
            <div className="fieldInput">
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
            </div>
          </label>
          <label className="field">
            <span>E-mail</span>
            <div className="fieldInput">
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
            </div>
          </label>
        </div>

        <label className="field">
          <span>Vraag of opmerking</span>
          <div className="fieldInput textareaInput">
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows="4" />
          </div>
        </label>

        <label className="consentField">
          <input type="checkbox" checked={hasConsent} onChange={(event) => setHasConsent(event.target.checked)} />
          <span>
            Ik ga akkoord dat mijn ingevulde gegevens, quickscan en gekozen vervolgstap worden gedeeld met BasKoestiek voor persoonlijk advies of een offerte.
          </span>
        </label>

        <div className="modalActions">
          <button className="secondaryButton" type="button" onClick={onClose}>
            Sluiten
          </button>
          <a className={hasConsent && selectedOptions.length > 0 ? 'primaryButton' : 'primaryButton disabled'} href={hasConsent && selectedOptions.length > 0 ? mailtoHref : undefined}>
            <Send size={17} />
            Send mail
          </a>
        </div>
      </section>
    </div>
  );
}

export default function CustomerReport({ data }) {
  const [showHelpModal, setShowHelpModal] = useState(false);

  return (
    <div className="customerReport">
      <div className="customerConclusion">
        <span>Adviescode {data.adviceCode} · {formatRoomType(data.roomType)}</span>
        <h2>{data.customerIntro?.title}</h2>
        <Paragraphs text={data.customerIntro?.text} />
      </div>

      <div className="reportVisualGrid">
        <SketchPreview sketchData={data.sketchPreviewData} />
        <ReportBarometer data={data.barometerData} />
      </div>

      <div className="impressionGrid">
        <article>
          <span>Huidige indruk</span>
          <strong>{data.customerImpression?.current}</strong>
          <p>{data.customerImpression?.currentText}</p>
        </article>
        <article>
          <span>Na toepassing van advies</span>
          <strong>{data.customerImpression?.after}</strong>
          <p>{data.customerImpression?.afterText}</p>
        </article>
      </div>

      <div className="noticeBlock">
        <h3>{data.whatYouNotice?.title}</h3>
        <p>{data.whatYouNotice?.intro}</p>
        <ul>
          {data.whatYouNotice?.bullets?.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>

      <div className="choiceLevelsBlock">
        <h3>Kies jouw niveau van verbetering</h3>
        <div className="choiceLevelsGrid">
          {data.consumerAdviceLevels?.map((level) => (
            <article key={level.title}>
              <h4>{level.title}</h4>
              <p>{level.text}</p>
              <strong>{level.label}</strong>
            </article>
          ))}
        </div>
      </div>

      <div className="productAdviceCard">
        <h3>Onze aanbeveling voor jouw ruimte</h3>
        <p>{data.productIntro}</p>
        <strong>{data.productCombinationText}</strong>
        <div className="productCards">
          {data.consumerProductCards?.map((product) => (
            <article key={product.productId}>
              {product.imageUrl && <img src={product.imageUrl} alt={product.name} loading="lazy" />}
              <span>{product.format}</span>
              <h4>{product.name}</h4>
              {product.articleNumber && <small>Art.nr. {product.articleNumber}</small>}
              <p>{product.description}</p>
              <strong>{product.recommendedCount}</strong>
            </article>
          ))}
        </div>
      </div>

      <div className="reportCta">
        <h3>{data.cta?.title}</h3>
        <p>{data.cta?.text}</p>
      </div>

      <div className="ctaGrid singleCta">
        <button type="button" onClick={() => setShowHelpModal(true)}>
          Help mij verder
        </button>
      </div>

      <HelpRequestModal open={showHelpModal} data={data} onClose={() => setShowHelpModal(false)} />
    </div>
  );
}
