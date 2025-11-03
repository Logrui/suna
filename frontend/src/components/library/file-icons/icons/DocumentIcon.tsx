import React from 'react';

interface DocumentIconProps {
  className?: string;
  title?: string;
}

/**
 * DocumentIcon - Blue file icon for text documents
 * Used for: .md, .txt, .doc, .docx, .rtf, .odt, .pages
 * Colors: #4876D3 (primary), #9CC3F4 (secondary)
 */
export const DocumentIcon: React.FC<DocumentIconProps> = ({ 
  className = 'h-4 w-4',
  title = 'Document'
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
        fill="#4876D3"
      />
      <path
        d="M20.6685 6.66647C20.6685 8.38469 22.0613 9.77759 23.7796 9.77759H28.4462L20.6685 1.99981V6.66647Z"
        fill="#9CC3F4"
      />
      <path
        opacity="0.9"
        d="M10.1685 18.2363H21.8351"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
      <path
        opacity="0.9"
        d="M10.1685 14.3472H12.1129"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
      <path
        opacity="0.9"
        d="M15.0293 14.3472H16.9737"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
      <path
        opacity="0.9"
        d="M10.1685 21.8333H21.8351"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
    </svg>
  );
};
