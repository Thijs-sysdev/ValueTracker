; =============================================================================
; ValueTracker — Custom NSIS Installer Script
; build/installer.nsh
;
; Adds an optional AI-model download step after the main installation.
; The model (~1.8 GB) is downloaded to:
;   %APPDATA%\valuetracker\models\
; which is the same path that electron/llm.js expects at runtime.
;
; This hook runs inside the `customInstall` macro, which electron-builder
; injects AFTER extracting the app files and BEFORE showing the Finish page.
; =============================================================================

!macro customInstall
  ; ── Create the models directory ──────────────────────────────────────────────
  CreateDirectory "$APPDATA\valuetracker\models"

  ; ── Set the download destination ────────────────────────────────────────────
  StrCpy $0 "$APPDATA\valuetracker\models\qwen2.5-3b-instruct-q4_k_m.gguf"

  ; ── Check if the model already exists ───────────────────────────────────────
  IfFileExists "$0" skip_ai_download 0

  ; ── Check if this is a silent install (background update) ───────────────────
  IfSilent skip_ai_download 0

  ; ── Ask the user if they want to download the AI model ───────────────────────
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Wilt u de AI-assistent installeren?$\r$\n$\r$\nDe AI-assistent stelt u in staat om vragen te stellen \
over prijsinformatie in de zoekbalk van ValueTracker.$\r$\n$\r$\n\
Vereist: ~1.8 GB vrije schijfruimte en een eenmalige internetverbinding.$\r$\n\
Daarna werkt de AI-assistent volledig offline.$\r$\n$\r$\n\
Kies 'Ja' om de AI nu te installeren, of 'Nee' om dit over te slaan." \
    /SD IDNO IDNO skip_ai_download

  ; ── Show status in the detail view ──────────────────────────────────────────
  DetailPrint "AI-model downloaden (Qwen2.5-3B, ~1.8 GB)..."
  DetailPrint "Dit kan enkele minuten duren afhankelijk van uw internetverbinding."

  ; ── Download with progress bar ───────────────────────────────────────────────
  ; inetc::get is included in electron-builder's bundled NSIS binaries.
  ; /CAPTION sets the title of the download popup.
  ; /POPUP shows a small download progress dialog (native Windows look).
  inetc::get \
    /CAPTION "ValueTracker — AI-Assistent Installeren" \
    /POPUP "Qwen2.5 AI-model downloaden..." \
    "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf" \
    "$0" \
    /END

  ; ── Check if the download succeeded ─────────────────────────────────────────
  Pop $1 ; inetc returns the status string into the stack
  ${If} $1 != "OK"
    DetailPrint "AI-download mislukt: $1"
    MessageBox MB_OK|MB_ICONEXCLAMATION \
      "De AI-download is mislukt (fout: $1).$\r$\n$\r$\n\
U kunt de AI-assistent later activeren via de instellingen van ValueTracker.$\r$\n\
De applicatie werkt volledig zonder de AI-assistent."
  ${Else}
    DetailPrint "AI-model succesvol geïnstalleerd."
    MessageBox MB_OK|MB_ICONINFORMATION \
      "De AI-assistent is succesvol geïnstalleerd!$\r$\n\
ValueTracker start automatisch met AI-ondersteuning."
  ${EndIf}

  skip_ai_download:
!macroend

!macro customUnInstall
  ; ── Optionally remove the AI model on uninstall ──────────────────────────────
  ; We do NOT auto-delete — the model is large and the user may reinstall.
  ; The model lives in AppData (not Program Files) so Windows won't auto-clean it.
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Wilt u ook het AI-model verwijderen?$\r$\n$\r$\n\
Het AI-model (~1.8 GB) bevindt zich in:$\r$\n\
$APPDATA\valuetracker\models\$\r$\n$\r$\n\
Kies 'Ja' om het model ook te verwijderen, of 'Nee' om het te bewaren \
(handig als u ValueTracker later opnieuw installeert)." \
    IDNO skip_ai_remove

  RMDir /r "$APPDATA\valuetracker\models"
  DetailPrint "AI-model verwijderd."

  skip_ai_remove:
!macroend
