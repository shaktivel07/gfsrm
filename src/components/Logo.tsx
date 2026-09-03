import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
}

export const OFFICIAL_LOGO_URL = 'https://srmgoodfoods.com/wp-content/uploads/2024/06/srm-goodfoods-logo-1-1024x641.png';

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    xs: 'h-7 w-auto max-w-[90px]',
    sm: 'h-10 w-auto max-w-[120px]',
    md: 'h-14 w-auto max-w-[160px]',
    lg: 'h-20 w-auto max-w-[220px]',
    xl: 'h-28 w-auto max-w-[300px]',
  };

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <img
        src={OFFICIAL_LOGO_URL}
        alt="SRM Good Foods"
        className={`${sizeClasses[size]} object-contain drop-shadow-sm select-none`}
        onError={(e) => {
          // Fallback to local downloaded logo if remote network is slow or offline
          if (e.currentTarget.src !== window.location.origin + '/srm-goodfoods-logo.png') {
            e.currentTarget.src = '/srm-goodfoods-logo.png';
          }
        }}
      />
    </div>
  );
};
