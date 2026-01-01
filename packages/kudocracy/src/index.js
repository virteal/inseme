import termsOfUse from "./legal/terms-of-use.md?raw";
import privacyPolicy from "./legal/privacy-policy.md?raw";

export * from "./governance.js";
export * from "./tasks.js";

export const LEGAL_CONTENT = {
  TERMS_OF_USE: termsOfUse,
  PRIVACY_POLICY: privacyPolicy,
};
