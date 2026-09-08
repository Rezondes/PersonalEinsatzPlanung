/**
 * OAuth client id for the Google sign-in.
 *
 * This is NOT a secret and is meant to be public: any browser app has to ship it to the client, so
 * hiding it would be theatre. The security boundary is the list of authorised JavaScript origins
 * configured in the Google Cloud project, not the secrecy of this string.
 *
 * Empty string = feature switched off. BackupStorage.isConfigured() then reports false and the UI
 * hides the Drive buttons, so the app behaves exactly as it did before this feature existed.
 */
export const GOOGLE_CLIENT_ID = '33983014120-d81o1dia907kf96ogn728oee6ued4ugn.apps.googleusercontent.com';

/** The narrowest Drive scope there is: the app only ever sees files it created itself. Anything
 * broader would drag in Google's expensive security assessment - do not widen this. */
export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** A normal, user-visible folder rather than the hidden app data folder, so backups can be seen,
 * tidied up and downloaded by hand in Drive. */
export const BACKUP_FOLDER_NAME = 'Personaleinsatzplanung';
