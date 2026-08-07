const Input = ({
  label,
  error,
  id,
  className = '',
  required = false,
  ...props
}) => {
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-') || 'field'}`;

  return (
    <div className="ui-field">
      {label ? (
        <label htmlFor={inputId} className="ui-field__label">
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
      ) : null}

      <input
        id={inputId}
        className={`ui-input ${error ? 'ui-input--error' : ''} ${className}`.trim()}
        aria-invalid={Boolean(error)}
        {...props}
      />

      {error ? <p className="ui-field__error">{error}</p> : null}
    </div>
  );
};

export default Input;
