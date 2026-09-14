import 'i18next';
import type common from './resources/de/common';
import type nav from './resources/de/nav';
import type absences from './resources/de/absences';
import type app from './resources/de/app';

// Augments i18next's own CustomTypeOptions (react-i18next reuses this same interface, so this is
// the module that must be augmented). Keyed off the real resource objects, so a typo like
// t('shedule') or an unknown namespace is a compile error, never a silent fallback-to-key.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: { common: typeof common; nav: typeof nav; absences: typeof absences; app: typeof app };
  }
}
