const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  type = 'button',
  disabled,
  ...props
}) => {
  const variantClass = `ui-btn--${variant}`;
  const sizeClass = `ui-btn--${size}`;

  return (
    <button
      type={type}
      className={`ui-btn ${variantClass} ${sizeClass} ${className}`.trim()}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <span className="ui-btn__loader" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
};

export default Button;
