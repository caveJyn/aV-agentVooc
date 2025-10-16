export interface IAttachment {
    url: string;
    contentType: string;
    title: string;
}

// client/src/types/index.ts
export interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  itemType: string;
  pluginName?: string; // Added for plugin items
  stripePriceId?: string; // Added for base items
  features?: string[];
  isPopular?: boolean;
  trialInfo?: string;
  useCase?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  subscriptionStatus?: string;
  subscriptionEndDate?: Date;
  activePlugins?: string[]; // List of active plugin names
}   