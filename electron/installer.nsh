!macro customHeader
  !define APP_DIR_NAME "ObsiForge"
!macroend

Function .onVerifyInstDir
  # Check if the user selected a root drive (e.g. "D:\", "C:\", "D:", "E:\")
  # Root drives have a length of 3 or less and cannot be installed to directly.
  # Automatically append "\ObsiForge" so the installer generates a dedicated subfolder!
  Push $0
  Push $1

  StrLen $0 "$INSTDIR"
  ${If} $0 <= 3
    StrCpy $1 "$INSTDIR" 1 -1
    ${If} $1 == "\"
      StrCpy $INSTDIR "$INSTDIR${APP_DIR_NAME}"
    ${Else}
      StrCpy $INSTDIR "$INSTDIR\${APP_DIR_NAME}"
    ${EndIf}
  ${EndIf}

  Pop $1
  Pop $0
FunctionEnd

!macro customInstall
  # Ensure the target installation folder exists
  CreateDirectory "$INSTDIR"
!macroend
