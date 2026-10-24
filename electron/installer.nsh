Function .onVerifyInstDir
  # Check if the user selected a root drive (e.g. "D:\", "C:\", "D:", "E:\")
  # Root drives have a length of 3 or less and cannot be installed to directly.
  # Automatically append "\ObsiForge" so the installer generates a dedicated subfolder!
  Push $0
  Push $1

  StrLen $0 "$INSTDIR"
  IntCmp $0 3 is_root is_root not_root

is_root:
  # Check if last character is backslash
  StrCpy $1 "$INSTDIR" 1 -1
  StrCmp $1 "\" has_slash no_slash

has_slash:
  # Strip trailing slash, then append \ObsiForge
  StrCpy $INSTDIR "$INSTDIR" -1
  StrCpy $INSTDIR "$INSTDIR\ObsiForge"
  Goto not_root

no_slash:
  StrCpy $INSTDIR "$INSTDIR\ObsiForge"
  Goto not_root

not_root:
  Pop $1
  Pop $0
FunctionEnd

!macro customInstall
  # Ensure the target installation folder exists
  CreateDirectory "$INSTDIR"
!macroend
