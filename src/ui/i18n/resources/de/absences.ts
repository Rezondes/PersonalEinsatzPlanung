/** Seed of the `absences` namespace - one key, proving t()'s {{variable}} interpolation end to
 * end. The rest of this feature's strings are deliberately NOT migrated here - left for whichever
 * later package takes absences+month. That package EXTENDS this file, it does not replace it. */
const absences = {
  holidaysCreated: '{{created}} Feiertage angelegt, {{skipped}} übersprungen (bereits erfasst/überschneidend).',
} as const;

export default absences;
