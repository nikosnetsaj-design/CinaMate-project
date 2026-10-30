/**
 * Consegna un file generato qui, senza server: un `Blob`, un collegamento
 * temporaneo, un clic.
 *
 * Stava scritto per intero dentro il pannello dei backup; adesso che i file
 * sono quattro — il backup, il CSV, il calendario, la copia di sicurezza — è
 * una funzione sola. L'indirizzo temporaneo si revoca al giro successivo e non
 * subito: Safari su iOS, revocato nello stesso tick del clic, a volte scarica
 * un file vuoto.
 */
export function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
