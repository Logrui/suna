import React from 'react';

interface ArchiveIconProps {
  className?: string;
  title?: string;
}

/**
 * ArchiveIcon - Orange file icon for archive/compressed files
 * Used for: .zip, .rar, .7z, .tar, .gz, .bz2, .xz
 * Colors: #DE9000 (primary), #F1BC5E (secondary)
 */
export const ArchiveIcon: React.FC<ArchiveIconProps> = ({ 
  className = 'h-4 w-4',
  title = 'Archive'
}) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {title && <title>{title}</title>}
      <path
        d="M3.55566 26.8889C3.55566 28.6071 4.94856 30 6.66678 30H25.3334C27.0517 30 28.4446 28.6071 28.4446 26.8889V9.77778L20.6668 2H6.66678C4.94856 2 3.55566 3.39289 3.55566 5.11111V26.8889Z"
        fill="#DE9000"
      />
      <path
        opacity="0.8"
        d="M20.6665 6.66672C20.6665 8.38494 22.0594 9.77783 23.7776 9.77783H28.4443L20.6665 2.00005V6.66672Z"
        fill="#F1BC5E"
      />
      <path
        d="M16.0952 14.9524V12.7935H14V10.635H16.0952V8.47619H14V6.31733H16.0952V4.15886H14V2H16.0952V4.15886H18.1905V6.31733H16.0952V8.47619H18.1905V10.635H16.0952V12.7935H18.1905V21.0476H14V14.9524H16.0952ZM17.4286 17.2381H14.7619V20.2857H17.4286V17.2381Z"
        fill="white"
      />
    </svg>
  );
};
