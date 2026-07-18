import { redirect } from 'next/navigation';

// Doc 03: cualquier ruta no declarada (ej. /admin) redirige a la Landing.
export default function RutaNoDeclarada() {
  redirect('/');
}
