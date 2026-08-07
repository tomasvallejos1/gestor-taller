const Spinner = ({ label = 'Cargando...', size = 'md', centered = false }) => {
  const sizeClass = size === 'sm' ? 'ui-spinner--sm' : size === 'lg' ? 'ui-spinner--lg' : '';

  return (
    <div className={centered ? 'ui-spinner-wrap ui-spinner-wrap--centered' : 'ui-spinner-wrap'} role="status" aria-live="polite">
      <span className={`ui-spinner ${sizeClass}`} aria-hidden="true" />
      <span className="ui-spinner-label">{label}</span>
    </div>
  );
};

export default Spinner;
