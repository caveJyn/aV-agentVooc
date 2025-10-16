import { useEffect, useRef } from 'react';

interface AdSenseUnitProps {
  adSlot: string;
  format?: 'auto' | 'horizontal' | 'vertical' | 'rectangle';
  className?: string;
}

const AdSenseUnit = ({ adSlot, format = 'auto', className = '' }: AdSenseUnitProps) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Detect ad blocker
    const testAd = document.createElement('div');
    testAd.className = 'adsbygoogle';
    document.body.appendChild(testAd);
    setTimeout(() => {
      if (testAd.offsetHeight === 0) {
        console.warn('[AdSenseUnit] Ad blocker detected');
      }
      document.body.removeChild(testAd);
    }, 500);

    // Log ad slot dimensions
    if (adRef.current) {
      const rect = adRef.current.getBoundingClientRect();
      console.log(`[AdSenseUnit] Slot ${adSlot} dimensions:`, {
        width: rect.width,
        height: rect.height,
        display: window.getComputedStyle(adRef.current).display,
        visibility: window.getComputedStyle(adRef.current).visibility,
      });

      try {
        // Push ad to adsbygoogle array
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        console.log(`[AdSenseUnit] Ad pushed successfully for slot: ${adSlot}`);
      } catch (error) {
        console.error('[AdSenseUnit] Error pushing ad:', error);
      }
    }
  }, [adSlot]);

  return (
    <div
      ref={adRef}
      className={`ad-container ${className}`}
      style={{ minWidth: '300px', minHeight: '100px', display: 'block', visibility: 'visible' }}
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: 'auto' }}
        data-ad-client="ca-pub-9622114924468888"
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
};

export default AdSenseUnit;