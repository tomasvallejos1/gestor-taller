import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Campo de formulario.
 *
 * Cuando es de tipo password se le agrega el ojo para revelar lo
 * tipeado. Va aca y no en cada pantalla porque el problema no era solo
 * el login: escribir una clave nueva a ciegas y despues repetirla,
 * tambien a ciegas, en el teclado de un celular, es donde mas se
 * equivoca uno y donde el error recien aparece al mandar el formulario.
 */
const Input = ({
  label,
  error,
  id,
  className = '',
  required = false,
  type = 'text',
  ...props
}) => {
  const [verClave, setVerClave] = useState(false);

  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-') || 'field'}`;
  const esClave = type === 'password';
  const tipoReal = esClave && verClave ? 'text' : type;

  return (
    <div className="ui-field">
      {label ? (
        <label htmlFor={inputId} className="ui-field__label">
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
      ) : null}

      <div className={esClave ? 'ui-field__caja' : undefined}>
        <input
          id={inputId}
          type={tipoReal}
          className={`ui-input ${error ? 'ui-input--error' : ''} ${esClave ? 'ui-input--con-ojo' : ''} ${className}`.trim()}
          aria-invalid={Boolean(error)}
          {...props}
        />

        {esClave && (
          <button
            type="button"
            className="ui-field__ojo"
            onClick={() => setVerClave((v) => !v)}
            aria-label={verClave ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
            aria-pressed={verClave}
            // El estado tambien se dice con palabras: el icono solo no
            // se lo comunica a un lector de pantalla.
            title={verClave ? 'Ocultar' : 'Mostrar'}
          >
            {verClave ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      {error ? <p className="ui-field__error">{error}</p> : null}
    </div>
  );
};

export default Input;
