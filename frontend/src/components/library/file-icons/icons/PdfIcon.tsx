import React from 'react';

interface PdfIconProps {
  className?: string;
  title?: string;
}

/**
 * PdfIcon - Red file icon for PDF documents
 * Used for: .pdf
 * Colors: #D84D4F (primary), #F78E8F (secondary)
 */
export const PdfIcon: React.FC<PdfIconProps> = ({ 
  className = 'h-4 w-4',
  title = 'PDF'
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
        fill="#D84D4F"
      />
      <path
        d="M20.667 6.66647C20.667 8.38469 22.0599 9.77759 23.7781 9.77759H28.4448L20.667 1.99981V6.66647Z"
        fill="#F78E8F"
      />
      <path
        opacity="0.9"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.2558 11.6406H16.6253C16.6253 14.5907 19.1654 17.754 22.3311 18.8096L21.7897 21.1069C18.0743 20.5761 14.2345 22.1613 10.7667 24.474L9.36865 22.5629C10.6553 21.5334 11.8898 19.787 12.8045 17.7457C13.7167 15.7126 14.2558 13.509 14.2558 11.6406ZM14.2124 19.0594C14.7355 17.8898 15.1998 16.6772 15.5916 15.4489C16.5268 16.8776 17.651 18.1732 18.9337 19.3003C17.0099 19.6451 15.1273 20.2113 13.3015 20.9322C13.6247 20.317 13.9284 19.6921 14.2124 19.0594Z"
        fill="white"
      />
    </svg>
  );
};
