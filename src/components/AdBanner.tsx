/**
 * AdBanner — Google AdSense wrapper
 *
 * - Hidden completely for Pro and Team users (major selling point!)
 * - Renders a labelled ad slot for free / guest users
 * - Falls back gracefully to nothing if AdSense is not loaded
 *
 * Usage:
 *   <AdBanner slot="1234567890" format="horizontal" />
 *   <AdBanner slot="0987654321" format="rectangle" className="my-2" />
 *
 * Setup:
 *   1. Get AdSense approved at https://adsense.google.com
 *   2. Uncomment the AdSense <script> in index.html
 *   3. Replace ca-pub-XXXXXXXXXXXXXXXX with your publisher ID
 *   4. Replace slot IDs with your real ad unit IDs
 */

import { useEffect, useRef } from "react";
import { useAuth } from "../lib/AuthContext";

type AdFormat = "horizontal" | "rectangle" | "vertical" | "auto";

type AdBannerProps = {
  slot: string;
  format?: AdFormat;
  className?: string;
  style?: React.CSSProperties;
};

// Your AdSense publisher ID — replace after approval
const PUBLISHER_ID = "ca-pub-XXXXXXXXXXXXXXXX";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export default function AdBanner({ slot, format = "auto", className = "", style }: AdBannerProps) {
  const { user } = useAuth();
  const adRef = useRef<HTMLModElement>(null);
  const initialized = useRef(false);

  // Pro and Team users never see ads
  const isPro = user?.plan === "pro" || user?.plan === "team";
  if (isPro) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (initialized.current) return;
    try {
      if (typeof window !== "undefined" && window.adsbygoogle) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        initialized.current = true;
      }
    } catch {
      // AdSense not loaded yet — ad simply won't render
    }
  }, []);

  const sizeMap: Record<AdFormat, React.CSSProperties> = {
    horizontal: { display: "block", width: "100%", minHeight: "90px" },
    rectangle:  { display: "inline-block", width: "336px", height: "280px" },
    vertical:   { display: "inline-block", width: "160px", height: "600px" },
    auto:       { display: "block", width: "100%", minHeight: "90px" },
  };

  return (
    <div className={`ad-banner-wrap ${className}`} style={style}>
      <p className="ad-label">Advertisement</p>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={sizeMap[format]}
        data-ad-client={PUBLISHER_ID}
        data-ad-slot={slot}
        data-ad-format={format === "auto" ? "auto" : undefined}
        data-full-width-responsive={format === "auto" ? "true" : undefined}
      />
    </div>
  );
}
