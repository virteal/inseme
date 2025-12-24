export const PROVIDERS = {
  github: {
    name: "GitHub",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    profileUrl: "https://api.github.com/user",
    clientIdEnv: "GITHUB_CLIENT_ID",
    clientSecretEnv: "GITHUB_CLIENT_SECRET",
    redirectPath: "/oauth/github/callback",
    // Request email explicitly so the provider returns verified email addresses
    scopes: ["read:user", "user:email"],
    mapProfile: (profile) => ({
      providerUserId: profile.id,
      username: profile.login,
      rawAvatarUrl: profile.avatar_url,
    }),
    normalizeAvatarUrl: (raw) => {
      if (!raw) return null;
      // GitHub avatars support size param
      return raw.includes("?") ? `${raw}&s=128` : `${raw}?s=128`;
    },
  },
  google: {
    name: "Google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    redirectPath: "/oauth/google/callback",
    scopes: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    mapProfile: (profile) => ({
      providerUserId: profile.sub,
      username: profile.name,
      rawAvatarUrl: profile.picture,
    }),
    normalizeAvatarUrl: (raw) => raw, // Google avatars are usually fine as is, or we can resize if needed
  },
  facebook: {
    name: "Facebook",
    authorizeUrl: "https://www.facebook.com/v16.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v16.0/oauth/access_token",
    profileUrl: "https://graph.facebook.com/me?fields=id,name,picture{url}",
    clientIdEnv: "FACEBOOK_APP_ID",
    clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
    redirectPath: "/oauth/facebook/callback",
    scopes: ["public_profile", "email"],
    mapProfile: (profile) => ({
      providerUserId: profile.id,
      username: profile.name,
      rawAvatarUrl: profile.picture?.data?.url,
    }),
    normalizeAvatarUrl: (raw) => raw,
  },
};
