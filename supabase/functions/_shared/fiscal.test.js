/**
 * Los CUIT de estos tests se construyen calculando su propio digito
 * verificador, no copiando numeros reales de nadie.
 *
 * Correr:  node --test supabase/functions/_shared/fiscal.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  cuitValido, digitoVerificador, dniValido, formatearCuit, formatearDni,
  revisarDocumento, soloDigitos, documentoSugerido,
} from './fiscal.js';

const armar = (base10) => base10 + digitoVerificador(base10);

describe('digitoVerificador', () => {
  test('calcula el modulo 11', () => {
    assert.equal(digitoVerificador('2012345678'), 6);
    assert.equal(digitoVerificador('3071234567'), 1);
    assert.equal(digitoVerificador('2711111111'), 7);
  });

  test('sin 10 digitos no hay resultado', () => {
    assert.equal(digitoVerificador('123'), null);
    assert.equal(digitoVerificador(''), null);
  });
});

describe('cuitValido', () => {
  test('acepta los que tienen bien el verificador', () => {
    for (const base of ['2012345678', '3071234567', '2711111111', '3050000000']) {
      assert.ok(cuitValido(armar(base)), `${armar(base)} deberia ser valido`);
    }
  });

  test('rechaza si cambia un solo digito', () => {
    const bueno = armar('2012345678');
    const malo = bueno.slice(0, 10) + ((Number(bueno[10]) + 1) % 10);
    assert.equal(cuitValido(malo), false);
  });

  test('rechaza prefijos que no existen', () => {
    assert.equal(cuitValido('99' + '123456781'), false);
    assert.equal(cuitValido('00000000000'), false);
  });

  test('rechaza largos distintos de 11', () => {
    assert.equal(cuitValido('2012345678'), false);
    assert.equal(cuitValido('201234567861'), false);
    assert.equal(cuitValido(''), false);
  });

  test('acepta con guiones o puntos', () => {
    const c = armar('2012345678');
    assert.ok(cuitValido(`${c.slice(0,2)}-${c.slice(2,10)}-${c.slice(10)}`));
    assert.ok(cuitValido(`${c.slice(0,2)}.${c.slice(2,10)}.${c.slice(10)}`));
  });
});

describe('dniValido', () => {
  test('7 u 8 digitos', () => {
    assert.ok(dniValido('1234567'));
    assert.ok(dniValido('12345678'));
    assert.ok(dniValido('12.345.678'));
    assert.equal(dniValido('123456'), false);
    assert.equal(dniValido('123456789'), false);
  });
});

describe('formateo', () => {
  test('cuit con guiones', () => {
    assert.equal(formatearCuit('20123456786'), '20-12345678-6');
  });
  test('dni con puntos', () => {
    assert.equal(formatearDni('12345678'), '12.345.678');
    assert.equal(formatearDni('1234567'), '1.234.567');
  });
  test('deja pasar lo que no puede formatear', () => {
    assert.equal(formatearCuit('123'), '123');
  });
  test('soloDigitos limpia', () => {
    assert.equal(soloDigitos('20-12345678-6'), '20123456786');
    assert.equal(soloDigitos(null), '');
  });
});

describe('revisarDocumento', () => {
  test('sin documento no hay problema: es opcional', () => {
    assert.equal(revisarDocumento({ tipoPersona: 'fisica', tipoDocumento: 'dni', documento: '' }), null);
    assert.equal(revisarDocumento({ documento: null }), null);
  });

  test('una empresa no puede tener DNI ni CUIL', () => {
    assert.match(
      revisarDocumento({ tipoPersona: 'juridica', tipoDocumento: 'dni', documento: '12345678' }),
      /empresa se identifica con CUIT/i,
    );
    assert.match(
      revisarDocumento({ tipoPersona: 'juridica', tipoDocumento: 'cuil', documento: armar('2012345678') }),
      /CUIT/i,
    );
  });

  test('el mensaje dice cual seria el digito correcto', () => {
    const bueno = armar('2012345678');
    const malo = bueno.slice(0, 10) + ((Number(bueno[10]) + 1) % 10);
    const msg = revisarDocumento({ tipoPersona: 'fisica', tipoDocumento: 'cuit', documento: malo });
    assert.match(msg, new RegExp(`terminar en ${bueno[10]}`),
      'no alcanza con decir que esta mal: hay que decir cual es el correcto');
  });

  test('el mensaje del largo dice cuantos digitos hay', () => {
    assert.match(
      revisarDocumento({ tipoPersona: 'fisica', tipoDocumento: 'dni', documento: '123' }),
      /tiene 3/,
    );
    assert.match(
      revisarDocumento({ tipoPersona: 'fisica', tipoDocumento: 'cuit', documento: '123' }),
      /tiene 3/,
    );
  });

  test('un CUIT bien formado no molesta', () => {
    assert.equal(
      revisarDocumento({ tipoPersona: 'juridica', tipoDocumento: 'cuit', documento: armar('3071234567') }),
      null,
    );
  });
});

describe('documentoSugerido', () => {
  test('empresa CUIT, persona DNI', () => {
    assert.equal(documentoSugerido('juridica'), 'cuit');
    assert.equal(documentoSugerido('fisica'), 'dni');
    assert.equal(documentoSugerido(undefined), 'dni');
  });
});
