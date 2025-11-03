import React from 'react';

interface SpreadsheetIconProps {
  className?: string;
  title?: string;
}

/**
 * SpreadsheetIcon - Green file icon for spreadsheet data
 * Used for: .csv, .xlsx, .xls, .tsv, .ods, .numbers
 * Colors: #408B52 (primary), #84C293 (secondary)
 */
export const SpreadsheetIcon: React.FC<SpreadsheetIconProps> = ({ 
  className = 'h-4 w-4',
  title = 'Spreadsheet'
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
        fill="#408B52"
      />
      <path
        opacity="0.8"
        d="M20.667 6.66647C20.667 8.38469 22.0599 9.77759 23.7781 9.77759H28.4448L20.667 1.99981V6.66647Z"
        fill="#84C293"
      />
      <path
        opacity="0.9"
        d="M11.5778 13.6667H13.7075L16.0002 16.9614L18.4252 13.6667H20.4631L17.0191 18.1654L20.6668 23.0001H18.4966L16.0002 19.4347L13.3715 23.0001H11.3335L14.9812 18.1654L11.5778 13.6667Z"
        fill="white"
        stroke="white"
        strokeWidth="0.35"
      />
    </svg>
  );
};
