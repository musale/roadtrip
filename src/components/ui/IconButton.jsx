/**
 * IconButton - Icon-only button component with circular shape
 * Optimized for toolbar and quick actions with proper touch targets
 */

import React, { memo } from 'react';

const IconButton = memo(({ 
  children,
  icon,
  variant = 'secondary', // 'primary' | 'secondary' | 'danger' | 'ghost'
  size = 'md', // 'sm' | 'md' | 'lg'
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
  ariaLabel,
  tooltip,
  ...rest
}) => {
  // Base styles - always applied
  const baseStyles = `
    font-display font-semibold
    transition-all duration-fast ease-nv
    disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2
    active:scale-95
    inline-flex items-center justify-center
    rounded-full
    relative
  `;

  // Size variants with proper touch targets (44px minimum)
  const sizeStyles = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-11 h-11 text-base',
    lg: 'w-12 h-12 text-lg'
  };

  // Variant styles
  const variantStyles = {
    primary: `
      text-black bg-brand
      hover:-translate-y-[1px] focus-visible:-translate-y-[1px]
      active:translate-y-0
    `,
    secondary: `
      text-white border border-gray-600 bg-gray-800/40
      hover:border-brand hover:text-brand hover:bg-gray-700/40
      focus-visible:border-brand focus-visible:text-brand
    `,
    danger: `
      text-white bg-red-500
      hover:bg-red-600 hover:opacity-90
      focus-visible:bg-red-600
    `,
    ghost: `
      text-white bg-transparent
      hover:bg-white/10
      focus-visible:bg-white/20
    `
  };

  // Add neon shadow to primary variant
  const primaryShadow = variant === 'primary' 
    ? 'shadow-[0_0_0_1px_rgba(0,245,212,0.35),0_0_22px_rgba(0,245,212,0.16)_inset]'
    : variant === 'secondary'
    ? 'shadow-nv1'
    : '';

  // Loading spinner
  const spinner = loading ? (
    <svg 
      className="animate-spin h-4 w-4 absolute" 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="4"
      />
      <path 
        className="opacity-75" 
        fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  ) : null;

  // Combine all styles
  const combinedStyles = `
    ${baseStyles}
    ${sizeStyles[size]}
    ${variantStyles[variant]}
    ${primaryShadow}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <button
      type={type}
      className={combinedStyles}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel || tooltip}
      title={tooltip}
      aria-busy={loading}
      {...rest}
    >
      {loading ? spinner : (icon || children)}
    </button>
  );
});

IconButton.displayName = 'IconButton';

export default IconButton;