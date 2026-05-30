import React from 'react';
import SketchPreview from './SketchPreview.jsx';

function InternalSection({ title, rows }) {
  return (
    <div className="internalSection">
      <h3>{title}</h3>
      <div className="internalRows">
        {rows.map((row) => (
          <div key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value ?? '-'}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function format(value, digits = 1) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-';
}

function formatPercent(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(0)}%` : '-';
}

function getCombinationText(combination) {
  return combination?.items
    ?.filter((item) => item.count > 0)
    .map((item) => `${item.count}x ${item.name}`)
    .join(' + ') || 'Geen combinatie nodig';
}

export default function InternalReport({ data }) {
  const realisticAdvice = data.productRecommendation.realisticAdvice;
  const exactProductRows = data.productRecommendation.exactCounts.flatMap((item) => ([
    { label: `${item.name} nodig`, value: `${item.countNeeded} st.` },
    { label: `${item.name} absorptie`, value: `${format(item.totalSabins)} sabins` },
  ]));
  const logicalCombinationText = getCombinationText(data.productRecommendation.logicalCombination);
  const basisText = getCombinationText(realisticAdvice.tiers.basis);
  const recommendedText = getCombinationText(realisticAdvice.tiers.recommended);
  const maximumText = getCombinationText(realisticAdvice.tiers.maximum);

  return (
    <div className="internalReport">
      <div className="internalIntro">
        <h2>{data.intro?.title ?? 'Intern technisch rapport'}</h2>
        {String(data.intro?.text ?? '').split('\n\n').filter(Boolean).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <p className="adminNotice">
        Interne ontwikkel-tab. Later achter login/admin-beveiliging plaatsen voordat de tool publiek wordt gebruikt.
      </p>
      {data.warning && <p className="adminNotice">{data.warning}</p>}
      {data.measurementRecommendation?.measurementNeeded && (
        <p className="adminNotice">{data.measurementRecommendation.text}</p>
      )}

      <InternalSection
        title="Leadgegevens"
        rows={[
          { label: 'Adviescode', value: data.adviceCode },
          { label: 'Datum/tijd', value: new Date(data.generatedAt).toLocaleString('nl-NL') },
          { label: 'Naam', value: data.leadData.name },
          { label: 'Bedrijf', value: data.leadData.company },
          { label: 'E-mail', value: data.leadData.email },
          { label: 'Telefoon', value: data.leadData.phone },
          { label: 'Project', value: data.leadData.projectName },
          { label: 'Plaats', value: data.leadData.city },
          { label: 'Type ruimte', value: data.leadData.roomType },
          { label: 'Opmerkingen klant', value: data.leadData.customerNotes },
        ]}
      />

      <InternalSection
        title="Ruimtegegevens"
        rows={[
          { label: 'Lengte', value: `${format(data.roomData.length)} m` },
          { label: 'Breedte', value: `${format(data.roomData.width)} m` },
          { label: 'Hoogte', value: `${format(data.roomData.height)} m` },
          { label: 'Volume', value: `${format(data.roomData.volumeM3, 0)} m³` },
          { label: 'Vloeroppervlak', value: `${format(data.roomData.floorAreaM2)} m²` },
          { label: 'Vloerkeuze', value: data.roomData.floorLabel || data.roomData.floorType || '-' },
          { label: 'Vloerbijdrage', value: `${format(data.roomData.floorAbsorptionEstimate)} m²` },
          { label: 'Plafondoppervlak', value: `${format(data.roomData.ceilingAreaM2)} m²` },
          { label: 'Wandoppervlak', value: `${format(data.roomData.wallAreaM2)} m²` },
        ]}
      />

      <InternalSection
        title="Sketchbook-data"
        rows={[
          { label: 'Ramen', value: data.sketchbookData.windows },
          { label: 'Deuren', value: data.sketchbookData.doors },
          { label: 'Gordijnen', value: data.sketchbookData.curtains },
          { label: 'Tafels', value: data.sketchbookData.tables },
          { label: 'Stoelen', value: data.sketchbookData.chairs },
          { label: 'Banken', value: data.sketchbookData.sofas },
          { label: 'Vloerkleden', value: data.sketchbookData.rugs },
          { label: 'Planten', value: data.sketchbookData.plants },
          { label: 'Akoestische objecten', value: data.sketchbookData.acousticObjects },
        ]}
      />

      <SketchPreview sketchData={data.sketchbookData.sketchData} title="Schets klant" />

      <InternalSection
        title="Akoestische berekening"
        rows={[
          { label: 'Huidige nagalmtijd', value: `${format(data.acousticCalculation.currentReverbTime, 2)} sec` },
          { label: 'Doel-nagalmtijd', value: `${format(data.acousticCalculation.targetReverbTime, 2)} sec` },
          { label: 'Geselecteerde NRC', value: format(data.acousticCalculation.selectedNRC, 2) },
          { label: 'Bestaande absorptie-inschatting', value: `${format(data.acousticCalculation.existingAbsorptionEstimate)} m²` },
          { label: 'Benodigde extra absorptie', value: `${format(data.acousticCalculation.requiredExtraAbsorption)} sabins` },
          { label: 'Benodigde m² absorptiemateriaal', value: `${format(data.acousticCalculation.requiredFeltM2)} m²` },
          { label: 'Benodigde sabins', value: `${format(data.acousticCalculation.requiredSabins)} sabins` },
          { label: 'Formule', value: data.acousticCalculation.formula },
        ]}
      />

      <InternalSection
        title="Adviesgegevens"
        rows={[
          { label: 'Aanbevolen oplossingsrichting', value: data.adviceData.recommendedDirection },
          { label: 'Oplossingstype', value: data.adviceData.solutionType },
          { label: 'Beschikbare wandruimte', value: `${format(data.adviceData.availableWallAreaM2)} m²` },
          { label: 'Onvoldoende wandruimte', value: data.adviceData.insufficientWallArea ? 'Ja' : 'Nee' },
          { label: 'Indicatieve productmatch', value: data.adviceData.productMatch },
          { label: 'Plaatsingssuggestie', value: data.adviceData.placementSuggestion },
          { label: 'Offerte-input', value: data.adviceData.quoteInput },
          { label: 'Opvolging', value: data.adviceData.followUpNotes },
        ]}
      />

      <InternalSection
        title="BasKoestiek productmatch"
        rows={[
          { label: 'Sabins nodig', value: `${format(data.productRecommendation.requiredSabins)} sabins` },
          ...exactProductRows,
          { label: 'Theoretische logische combinatie', value: logicalCombinationText },
          { label: 'Theoretisch aantal kunstwerken', value: `${data.productRecommendation.logicalCombination.totalCount} st.` },
          { label: 'Maximaal realistisch aantal', value: `${realisticAdvice.maxRealisticCount} st.` },
          { label: 'Bruikbare wandruimte kunstwerken', value: `${format(realisticAdvice.usableArtworkWallAreaM2)} m²` },
          { label: 'Basisadvies', value: basisText },
          { label: 'Aanbevolen advies', value: recommendedText },
          { label: 'Maximaal realistisch', value: maximumText },
          { label: 'Geleverde sabins maximaal', value: `${format(realisticAdvice.realisticDeliveredSabins)} sabins` },
          { label: 'Resterend tekort', value: `${format(realisticAdvice.remainingSabins)} sabins` },
          { label: 'Percentage opgelost', value: formatPercent(realisticAdvice.solvedPercent) },
          { label: 'Status', value: realisticAdvice.status },
          { label: 'Intern advies', value: realisticAdvice.internalAdvice },
          { label: 'Aanvullend nodig', value: realisticAdvice.additionalMeasuresNeeded ? realisticAdvice.additionalMeasures.join(', ') : 'Nee' },
        ]}
      />

      <details className="jsonPreview">
        <summary>Volledige sketchData JSON</summary>
        <pre>{JSON.stringify(data.sketchbookData.sketchData, null, 2)}</pre>
      </details>
    </div>
  );
}
