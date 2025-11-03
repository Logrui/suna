import React from 'react';

interface CodeIconProps {
  className?: string;
  title?: string;
}

/**
 * CodeIcon - Light blue file icon for code and data files
 * Used for: .js, .ts, .tsx, .jsx, .py, .json, .yaml, .html, .css, .sql, etc.
 * Colors: #418CD6 (primary), #7CBDFF (secondary)
 */
export const CodeIcon: React.FC<CodeIconProps> = ({ 
  className = 'h-4 w-4',
  title = 'Code'
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
        fill="#418CD6"
      />
      <path
        opacity="0.8"
        d="M20.6665 6.66672C20.6665 8.38494 22.0594 9.77783 23.7776 9.77783H28.4443L20.6665 2.00005V6.66672Z"
        fill="#7CBDFF"
      />
      <path
        opacity="0.9"
        d="M9.74316 18.3379L12.2827 20.8775L11.4541 21.706L8.91455 19.1665L9.74316 18.3379ZM20.2568 18.3379L19.4282 19.1665L16.8887 21.706L16.0601 20.8775L18.5996 18.3379L16.0601 15.7984L16.8887 14.9698L19.4282 17.5093L21.9678 14.9698L22.7964 15.7984L20.2568 18.3379Z"
        fill="#7CBDFF"
      />
    </svg>
  );
};
