'use client';

import { useEffect } from 'react';
import { checkLicense } from '@/utils/licenseCheck';

export default function LicenseGuard() {
  useEffect(() => {
    checkLicense();
  }, []);

  return (
    <div className="w-full text-center text-gray-400 text-xs mt-4">
      This project is protected. Please contact Taliyo Technologies for a valid license key.
    </div>
  );
}
