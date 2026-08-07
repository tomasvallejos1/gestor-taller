const Alert = ({ children, variant = 'info', className = '' }) => {
  return <div className={`ui-alert ui-alert--${variant} ${className}`.trim()}>{children}</div>;
};

export default Alert;
