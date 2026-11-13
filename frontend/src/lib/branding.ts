export const DEFAULT_BRAND_NAME = "Akota Poultry";

export const DEFAULT_BRAND_ASSETS = {
  businessLogo: "/akota-logo.png",
  businessLogoDark: "/akota-logo-dark.png",
  sidebarMark: "/akota-mark.png",
  sidebarMarkDark: "/akota-mark-dark.png",
  loginLogo: "/akota-logo.png",
  loginLogoDark: "/akota-logo-dark.png",
  favicon: "/favicon-32x32.png",
  appIcon: "/apple-touch-icon.png",
} as const;

export interface BrandAssetInput {
  business_logo?: string | null;
  login_logo_url?: string | null;
  favicon_url?: string | null;
  app_icon_url?: string | null;
}

/**
 * Resolves branding asset URLs: uses configured remote URLs when provided,
 * and falls back cleanly to optimized built-in Akota Poultry light/dark assets
 * when remote branding is cleared or disabled by the Owner.
 */
export function resolveBrandingAssets(settings: BrandAssetInput) {
  const remoteBusinessLogo = settings.business_logo?.trim() || "";
  const remoteLoginLogo = settings.login_logo_url?.trim() || "";
  const remoteFavicon = settings.favicon_url?.trim() || "";
  const remoteAppIcon = settings.app_icon_url?.trim() || "";
  const remoteLoginOrFallback = remoteLoginLogo || remoteBusinessLogo || remoteAppIcon;

  return {
    businessLogo: remoteBusinessLogo || DEFAULT_BRAND_ASSETS.businessLogo,
    businessLogoDark: remoteBusinessLogo || DEFAULT_BRAND_ASSETS.businessLogoDark,
    sidebarMark: remoteBusinessLogo || DEFAULT_BRAND_ASSETS.sidebarMark,
    sidebarMarkDark: remoteBusinessLogo || DEFAULT_BRAND_ASSETS.sidebarMarkDark,
    loginLogo: remoteLoginOrFallback || DEFAULT_BRAND_ASSETS.loginLogo,
    loginLogoDark: remoteLoginOrFallback || DEFAULT_BRAND_ASSETS.loginLogoDark,
    favicon: remoteFavicon || DEFAULT_BRAND_ASSETS.favicon,
    appIcon: remoteAppIcon || DEFAULT_BRAND_ASSETS.appIcon,
    isRemoteBusinessLogo: Boolean(remoteBusinessLogo),
    isRemoteLoginLogo: Boolean(remoteLoginOrFallback),
    isRemoteFavicon: Boolean(remoteFavicon),
    isRemoteAppIcon: Boolean(remoteAppIcon),
    hasAnyRemoteAsset: Boolean(
      remoteBusinessLogo || remoteLoginLogo || remoteFavicon || remoteAppIcon
    ),
  };
}
