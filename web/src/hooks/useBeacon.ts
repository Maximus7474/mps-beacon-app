import { createContext, useContext } from 'react';
import type { BeaconContextType } from '~/types/beacon';

export const BeaconContext = createContext<BeaconContextType | undefined>(undefined);

export const useBeacon = () => {
  const context = useContext(BeaconContext);
  if (context === undefined) {
    throw new Error('useBeacon must be used within a BeaconProvider');
  }
  return context;
};
