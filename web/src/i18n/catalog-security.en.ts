// The words of the second factor: the security pane and the second step of the login.
export const securityEn = {
  "problem.totp_enabled": "The authenticator app is already on.",
  "problem.totp_code_invalid":
    "The code is wrong or expired. Enter the current code of the app.",
  "problem.password_invalid": "The password is incorrect.",
  "problem.passkey_invalid": "The passkey could not be verified. Try again.",
  "problem.passkey_not_found": "The passkey no longer exists.",
  "problem.second_factor_invalid": "The code or the passkey is not valid.",
  "problem.second_factor_missing":
    "Turn on the authenticator app or add a passkey first.",
  "settings.security.title": "Security",
  "settings.summary.security":
    "Second factor at sign-in: authenticator app, passkeys and recovery codes.",
  "security.on": "On",
  "security.off": "Off",
  "security.done": "Done",
  "security.confirm": "Confirm",
  "security.totp.title": "Authenticator app",
  "security.totp.description":
    "A six-digit code of an authenticator app, asked after the password.",
  "security.totp.enable": "Set up",
  "security.totp.disable": "Turn off",
  "security.totp.dialogTitle": "Set up the authenticator app",
  "security.totp.scan": "Scan the code with the app, or type the key in it.",
  "security.totp.qr": "QR code for the authenticator app",
  "security.totp.secret": "Key",
  "security.totp.code": "Code of the app",
  "security.totp.confirm": "Turn on",
  "security.totp.disableTitle": "Turn off the authenticator app?",
  "security.totp.disableHint":
    "Sign-in stops asking for its code. Enter your password to confirm.",
  "security.passkeys.title": "Passkeys",
  "security.passkeys.description":
    "A device or a password manager confirms the sign-in after the password.",
  "security.passkeys.empty": "No passkey.",
  "security.passkeys.add": "Add passkey",
  "security.passkeys.unavailable":
    "Passkeys need HTTPS or localhost. On this address, use the authenticator app.",
  "security.passkeys.name": "Name",
  "security.passkeys.name.help":
    "Where the passkey is kept, such as the phone or the computer.",
  "security.passkeys.create": "Create passkey",
  "security.passkeys.created": "Added {date}",
  "security.passkeys.lastUsed": "Last used {date}",
  "security.passkeys.remove": "Remove",
  "security.passkeys.removeTitle": "Remove {name}?",
  "security.passkeys.removeHint":
    "The passkey stops working for this account. Enter your password to confirm.",
  "security.passkeys.cancelled": "The browser did not create the passkey.",
  "security.recovery.title": "Recovery codes",
  "security.recovery.description":
    "Each code replaces the second factor once, when the app or the passkey is not at hand.",
  "security.recovery.left": "Codes left: {count}",
  "security.recovery.none": "Recovery codes exist while a second factor is on.",
  "security.recovery.regenerate": "Generate new codes",
  "security.recovery.regenerateTitle": "Generate new recovery codes?",
  "security.recovery.regenerateHint":
    "The current codes stop working. Enter your password to confirm.",
  "security.recovery.dialogHint":
    "Store these codes outside this device. Each one works once, and they are not shown again.",
  "login.secondFactor.title": "Confirm it is you",
  "login.secondFactor.subtitle":
    "This account asks for a second factor after the password.",
  "login.secondFactor.passkey": "Use a passkey",
  "login.secondFactor.totp": "Code of the authenticator app",
  "login.secondFactor.recovery": "Recovery code",
  "login.secondFactor.useRecovery": "Use a recovery code",
  "login.secondFactor.useTotp": "Use the authenticator app",
  "login.secondFactor.submit": "Confirm",
  "login.secondFactor.back": "Back",
  "login.secondFactor.expired":
    "The sign-in expired. Enter the password again.",
  "login.secondFactor.passkeyFailed": "The browser did not return the passkey.",
};
