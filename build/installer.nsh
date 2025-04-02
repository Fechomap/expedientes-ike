; build/installer.nsh
; Versión minimalista sin referencias a variables problemáticas

!macro customInit
  ; Macro vacía para evitar errores
!macroend

!macro customInstall
  ; Crear acceso directo en el escritorio
  CreateShortCut "$DESKTOP\IKE Expedientes Automation.lnk" "$INSTDIR\IKE Expedientes Automation.exe"
!macroend

!macro customUnInstall
  ; Eliminar acceso directo
  Delete "$DESKTOP\IKE Expedientes Automation.lnk"
!macroend