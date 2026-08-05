// La finestra desktop non è un'altra applicazione: è la stessa pagina, dentro
// la webview di sistema. Nessuna logica qui — se ce ne fosse, sarebbe una
// funzione che esiste solo per chi scarica il binario, e le due versioni
// comincerebbero a divergere.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("errore nell'avvio di CineMate");
}
