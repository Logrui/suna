import React from 'react';

interface DefaultIconProps {
  className?: string;
  title?: string;
}

/**
 * DefaultIcon - Gray file icon for unknown file types
 * Used for: Any extension not matched by other icon types
 * Colors: #BBBBBB (primary), #E6E6E6 (secondary)
 */
export const DefaultIcon: React.FC<DefaultIconProps> = ({ 
  className = 'h-4 w-4',
  title = 'File'
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
        d="M3.55554 26.8889C3.55554 28.6071 4.94843 30 6.66665 30H25.3333C27.0515 30 28.4444 28.6071 28.4444 26.8889V9.77778L20.6667 2H6.66666C4.94844 2 3.55554 3.39289 3.55554 5.11111V26.8889Z"
        fill="#BBBBBB"
      />
      <path
        opacity="0.8"
        d="M20.6667 6.66647C20.6667 8.38469 22.0596 9.77759 23.7778 9.77759H28.4445L20.6667 1.99981V6.66647Z"
        fill="#E6E6E6"
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
