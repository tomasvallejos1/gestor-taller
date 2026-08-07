const Card = ({ children, className = '', elevated = true, ...props }) => {
  const elevatedClass = elevated ? 'ui-card--elevated' : '';
  return (
    <div className={`ui-card ${elevatedClass} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

export default Card;
