// Instalooter iOS Client Script - Step 1
// Requires Scriptable app

// Get URL from share sheet
let url = args.urls[0] != null ? args.urls[0] : args.plainTexts[0];

if (!url) {
    Script.complete();
    Script.setShortcutOutput("Error: Invalid URL");
} else {
    Script.complete();
}
