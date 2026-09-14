import { redirect } from 'react-router-dom';
import type { LoaderFunction } from 'react-router-dom';
import { DEFAULT_LOCALE, isSupportedLocale } from './locale';

/**
 * Redirects to DEFAULT_LOCALE whenever the `:locale` segment is missing or unsupported, preserving
 * the rest of the intended path (e.g. `#/xx/employees` -> `#/de/employees`, not dropped to
 * `#/de`). `request.url` inside a `createHashRouter` loader already reflects the router's internal
 * (de-hashed) path, so no manual `#` handling is needed here.
 */
export const localeLoader: LoaderFunction = ({ params, request }) => {
  if (params.locale && isSupportedLocale(params.locale)) return null;
  const url = new URL(request.url);
  const rest = url.pathname.replace(/^\/[^/]+/, '');
  return redirect(`/${DEFAULT_LOCALE}${rest}${url.search}`);
};
