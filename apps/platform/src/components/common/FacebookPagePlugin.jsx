import React, { useEffect, useRef } from "react";
import { getConfig } from "../../common/config/instanceConfig.client.js";

export default function FacebookPagePlugin({ className = "" }) {
  const pageUrl = getConfig("facebook_page_url");
  const containerRef = useRef(null);

  useEffect(() => {
    // Re-parse XFBML when component mounts to render the plugin
    if (window.FB) {
      window.FB.XFBML.parse(containerRef.current);
    }
  }, [pageUrl]);

  if (!pageUrl) {
    return null;
  }

  return (
    <div ref={containerRef} className={`facebook-page-plugin-container ${className}`}>
      <div
        className="fb-page"
        data-href={pageUrl}
        data-tabs="timeline,events"
        data-width=""
        data-height=""
        data-small-header="false"
        data-adapt-container-width="true"
        data-hide-cover="false"
        data-show-facepile="true"
      >
        <blockquote cite={pageUrl} className="fb-xfbml-parse-ignore">
          <a href={pageUrl}>Facebook Page</a>
        </blockquote>
      </div>
    </div>
  );
}
