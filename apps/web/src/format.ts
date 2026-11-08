// Sizes as the interface shows them (Tus juegos, Ajustes › Almacenamiento).

/** «12,5 MB»: binary megabytes, one decimal at most, Spanish separators. */
export const megabytes = (bytes: number) =>
  `${(bytes / (1024 * 1024)).toLocaleString("es", { maximumFractionDigits: 1 })} MB`;
