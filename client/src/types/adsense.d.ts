interface AdsByGoogle {
  push: (config: any) => void;
  loaded?: boolean;
  [key: string]: any; // Allow additional properties for flexibility
}

interface Window {
  adsbygoogle: AdsByGoogle[] | { push: (config: any) => void; [key: string]: any };
}