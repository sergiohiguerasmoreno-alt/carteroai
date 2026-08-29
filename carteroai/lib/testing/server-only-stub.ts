// Stub para el paquete 'server-only' bajo Vitest.
//
// El paquete real lanza una excepción a propósito cuando se resuelve con la
// condición de exports por defecto (ver su package.json), reservando el
// export vacío para la condición "react-server" que activa el compilador de
// Next.js. Vitest no activa esa condición, así que sin este alias cualquier
// módulo con `import 'server-only'` rompería al cargarse en los tests aunque
// el propio test nunca ejecute código realmente exclusivo de servidor.
//
// Esto no cambia ningún comportamiento en producción: el build de Next.js
// sigue resolviendo 'server-only' normalmente y sigue impidiendo que estos
// módulos se cuelen en un bundle de cliente.
export {};
