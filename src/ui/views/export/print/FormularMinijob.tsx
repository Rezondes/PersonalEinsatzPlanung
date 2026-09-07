import { Fragment } from 'react';
import { WOCHENTAGE, datumFuerWochentag } from '@domain/shared/Kalenderwoche';
import type { Kalenderwoche, Wochentag } from '@domain/shared/Kalenderwoche';
import type { Filiale } from '@domain/filiale/Filiale';
import { vollerName } from '@domain/mitarbeiter/Mitarbeiter';
import type { DruckZeileMinijob } from '@application/export/druckDatenAufbereitung';

interface FormularMinijobProps {
  filiale: Filiale;
  kalenderwoche: Kalenderwoche;
  zeilen: DruckZeileMinijob[];
  tagessummen: Record<Wochentag, number>;
}

/** The paper form always has 9 pre-printed employee columns of equal width, regardless of how
 * many of them are actually filled. */
const SPALTEN_PRO_BLATT = 9;

function formatDatumKurz(datum: Date): string {
  return `${String(datum.getDate()).padStart(2, '0')}.${String(datum.getMonth() + 1).padStart(2, '0')}.`;
}

export function FormularMinijob({ filiale, kalenderwoche, zeilen, tagessummen }: FormularMinijobProps) {
  const plaetze = Array.from({ length: SPALTEN_PRO_BLATT }, (_, i) => zeilen[i] ?? null);

  return (
    <div className="druck-seite">
      <div className="druck-kopf">
        <div className="druck-kopf-meta" />
        <p className="druck-titel">
          Personaleinsatzplanung (PEP): geringfügig Beschäftigte (Aufbewahrungsfrist: 2 Jahre)
        </p>
        {filiale.logoBase64 ? (
          <img src={filiale.logoBase64} className="druck-kopf-logo" alt={`Logo ${filiale.name}`} />
        ) : (
          <div className="druck-kopf-logo" />
        )}
      </div>

      <table className="druck-tabelle">
        <colgroup>
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          {plaetze.map((_, i) => (
            <Fragment key={i}>
              <col style={{ width: `${86 / (SPALTEN_PRO_BLATT * 2)}%` }} />
              <col style={{ width: `${86 / (SPALTEN_PRO_BLATT * 2)}%` }} />
            </Fragment>
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="spalte-label" colSpan={2}>
              Woche: {kalenderwoche.woche} / {kalenderwoche.jahr}
            </th>
            <th colSpan={SPALTEN_PRO_BLATT * 2} className="mitarbeiter-kopf spalte-filiale">
              Filiale: {filiale.filialnummer} {filiale.name}
            </th>
          </tr>
          <tr>
            <th className="spalte-label" colSpan={2}>
              Name
            </th>
            {plaetze.map((z, i) => (
              <th key={i} colSpan={2} className="mitarbeiter-kopf">
                {z ? vollerName(z.mitarbeiter) : ''}
              </th>
            ))}
          </tr>
          <tr>
            <th className="spalte-label" colSpan={2}>
              Tätigkeit
            </th>
            {plaetze.map((z, i) => (
              <th key={i} colSpan={2}>
                {z?.mitarbeiter.taetigkeit ?? ''}
              </th>
            ))}
          </tr>
          <tr>
            <th className="spalte-label" colSpan={2}>
              Min. Std.
            </th>
            {plaetze.map((z, i) => (
              <th key={i} colSpan={2}>
                {z ? z.minStunden.toLocaleString('de-DE') : ''}
              </th>
            ))}
          </tr>
          <tr>
            <th className="spalte-label" colSpan={2}>
              Max. Std.
            </th>
            {plaetze.map((z, i) => (
              <th key={i} colSpan={2}>
                {z ? z.maxStunden.toLocaleString('de-DE') : ''}
              </th>
            ))}
          </tr>
          <tr>
            <th className="spalte-label">Soll-Std.</th>
            <th className="spalte-label">Ist-Std.</th>
            {plaetze.map((_, i) => (
              <Fragment key={i}>
                <th>Zeit</th>
                <th>Std.</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {WOCHENTAGE.map((tag) => (
            <Fragment key={tag}>
              <tr>
                <td className="spalte-label">{formatDatumKurz(datumFuerWochentag(kalenderwoche, tag))}</td>
                <td className="spalte-label">{tagessummen[tag] > 0 ? tagessummen[tag].toLocaleString('de-DE') : ''}</td>
                {plaetze.map((_, i) => (
                  <Fragment key={i}>
                    <td />
                    <td />
                  </Fragment>
                ))}
              </tr>
              <tr>
                <td className="spalte-label" colSpan={2}>
                  {tag}
                </td>
                {plaetze.map((z, i) => (
                  <Fragment key={i}>
                    <td>{z?.tage[tag].zeitText ?? ''}</td>
                    <td>{z?.tage[tag].stdText ?? ''}</td>
                  </Fragment>
                ))}
              </tr>
              <tr className="zeile-pause">
                <td className="spalte-label" colSpan={2}>
                  Pause
                </td>
                {plaetze.map((z, i) => (
                  <Fragment key={i}>
                    <td>{z?.tage[tag].pausen[0].zeitText ?? ''}</td>
                    <td>{z?.tage[tag].pausen[0].stdText ?? ''}</td>
                  </Fragment>
                ))}
              </tr>
              <tr className="zeile-pause">
                <td className="spalte-label" colSpan={2}>
                  Pause
                </td>
                {plaetze.map((z, i) => (
                  <Fragment key={i}>
                    <td>{z?.tage[tag].pausen[1].zeitText ?? ''}</td>
                    <td>{z?.tage[tag].pausen[1].stdText ?? ''}</td>
                  </Fragment>
                ))}
              </tr>
            </Fragment>
          ))}
          <tr>
            <td className="spalte-label" colSpan={2}>
              <strong>Gesamtstunden</strong>
            </td>
            {plaetze.map((z, i) => (
              <td key={i} colSpan={2}>
                <strong>{z?.gesamtstundenWoche ?? ''}</strong>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <div className="druck-unterschriften">
        <div className="feld">Unterschrift ML</div>
        <div className="feld">Unterschrift VL</div>
      </div>
    </div>
  );
}
