; =============================================================================
; ValueTracker — Custom NSIS Installer Script
; build/installer.nsh
;
; customCheckAppRunning → REPLACES electron-builder's entire _CHECK_APP_RUNNING
;               logic. Kills ValueTracker silently using the full $SYSDIR path,
;               waits 2 seconds, then continues without any dialog. This is the
;               official electron-builder escape-hatch (see allowOnlyOneInstallerInstance.nsh).
;
; customInit    → Early kill in .onInit (belt-and-suspenders), before the
;               installer pages even show.
;
; customInstall → Runs after files are extracted. Adds the optional AI-model
;               download step.
; =============================================================================

; ── Replace electron-builder's process-check entirely ────────────────────────
; When customCheckAppRunning is defined, electron-builder's CHECK_APP_RUNNING
; macro uses IT instead of _CHECK_APP_RUNNING, so no "appCannotBeClosed" dialog
; can ever fire.
!macro customCheckAppRunning
  ; Kill any running ValueTracker instance silently.
  ; $SYSDIR = C:\Windows\System32 — guaranteed to be set at this point.
  ; /F = force  |  /IM = by image name  |  /T = include child processes
  ; nsExec::Exec runs without a visible window. Exit code is ignored.
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM "ValueTracker.exe" /T'
  Pop $0  ; discard return code

  ; Wait 2 s for Windows to fully release file handles before NSIS
  ; proceeds to uninstall old files and extract new ones.
  Sleep 2000
!macroend

; ── Belt-and-suspenders: also kill early in .onInit ──────────────────────────
!macro customInit
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM "ValueTracker.exe" /T'
  Pop $0
  Sleep 1000
!macroend

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
  ; ── During auto-updates (silent uninstall), skip the AI-model question ──────
  ; We only want to ask this during a manual, user-initiated full uninstall.
  IfSilent skip_ai_remove 0

  ; ── Optionally remove the AI model on uninstall ──────────────────────────────
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Wilt u ook het AI-model verwijderen?$\r$\n$\r$\n\
Het AI-model (~1.8 GB) bevindt zich in:$\r$\n\
$APPDATA\valuetracker\models\$\r$\n$\r$\n\
Kies 'Ja' om het model ook te verwijderen, of 'Nee' om het te bewaren \
(handig als u ValueTracker later opnieuw installeert)." \
    /SD IDNO IDNO skip_ai_remove

  RMDir /r "$APPDATA\valuetracker\models"
  DetailPrint "AI-model verwijderd."

  skip_ai_remove:
!macroend
