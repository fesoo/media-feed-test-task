import { useEffect, useState } from 'react';

interface NetworkInformationLike extends EventTarget {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlink?: number;
  saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
}

export interface NetworkProfile {
  tier: 'fast' | 'moderate' | 'constrained' | 'unknown';
  effectiveType?: string;
  downlink?: number;
  saveData: boolean;
}

function readConnection(): NetworkInformationLike | undefined {
  const navigatorWithConnection = navigator as NavigatorWithConnection;
  return (
    navigatorWithConnection.connection ??
    navigatorWithConnection.mozConnection ??
    navigatorWithConnection.webkitConnection
  );
}

function createProfile(connection?: NetworkInformationLike): NetworkProfile {
  const effectiveType = connection?.effectiveType;
  const downlink = connection?.downlink;
  const saveData = Boolean(connection?.saveData);

  if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
    return { tier: 'constrained', effectiveType, downlink, saveData };
  }

  if (effectiveType === '3g' || (typeof downlink === 'number' && downlink < 2.5)) {
    return { tier: 'moderate', effectiveType, downlink, saveData };
  }

  if (effectiveType === '4g' || (typeof downlink === 'number' && downlink >= 2.5)) {
    return { tier: 'fast', effectiveType, downlink, saveData };
  }

  return { tier: 'unknown', effectiveType, downlink, saveData };
}

export function useNetworkProfile(): NetworkProfile {
  const [profile, setProfile] = useState(() => createProfile(readConnection()));

  useEffect(() => {
    const connection = readConnection();
    if (!connection) return;

    const handleChange = () => setProfile(createProfile(connection));
    connection.addEventListener('change', handleChange);

    return () => connection.removeEventListener('change', handleChange);
  }, []);

  return profile;
}
