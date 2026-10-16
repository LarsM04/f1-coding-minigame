// =====================================================================
//  CODING-APPS LIJST
//  Hier staat elke app waarin je (volgens ons) aan het coderen bent.
//  Zit je in één van deze apps -> je auto RACET en je verdient coins.
//  Zit je in een andere app (Brave, Discord, Spotify...) -> je staat
//  in de PITS en je verdient niks.
//
//  Hoe voeg je een app toe?
//  1. Open de game en klik op de app die je wilt toevoegen.
//  2. Kijk in het bovenste balkje van de game: daar staat de naam
//     die Windows doorgeeft (bijv. "Code" of "brave").
//  3. Zet die naam hieronder in de lijst (kleine letters, zonder .exe).
// =====================================================================

export const CODING_APPS = [
  // --- Code editors ---
  'code',               // Visual Studio Code
  'code - insiders',    // VS Code Insiders
  'cursor',             // Cursor
  'windsurf',           // Windsurf
  'zed',                // Zed
  'devenv',             // Visual Studio
  'sublime_text',       // Sublime Text
  'notepad++',          // Notepad++
  'atom',               // Atom
  'vim', 'gvim', 'nvim', 'nvim-qt', // Vim / Neovim

  // --- JetBrains IDE's ---
  'idea64', 'idea',     // IntelliJ IDEA
  'pycharm64', 'pycharm', // PyCharm
  'webstorm64', 'webstorm', // WebStorm
  'phpstorm64', 'phpstorm', // PhpStorm
  'rider64', 'rider',   // Rider
  'clion64', 'clion',   // CLion
  'goland64', 'goland', // GoLand
  'rustrover64',        // RustRover
  'datagrip64',         // DataGrip
  'fleet',              // Fleet

  // --- Overige IDE's / game engines ---
  'studio64',           // Android Studio
  'eclipse',            // Eclipse
  'netbeans64',         // NetBeans
  'arduino ide',        // Arduino IDE
  'unity',              // Unity
  'godot',              // Godot
  'robloxstudiobeta',   // Roblox Studio
  'unrealeditor',       // Unreal Engine

  // --- Terminals ---
  'windowsterminal',    // Windows Terminal
  'powershell',         // PowerShell
  'pwsh',               // PowerShell 7
  'cmd',                // Opdrachtprompt
  'wezterm-gui',        // WezTerm
  'alacritty',          // Alacritty
  'mintty',             // Git Bash
  'warp',               // Warp
];

// Apps die we NEGEREN: dan blijft de vorige app gewoon actief.
//  - deze game zelf: als je op de game klikt wordt hij heel even de
//    "actieve app", anders zou je direct in de pits staan.
//  - Windows-onderdelen zoals de taakbalk en het startmenu.
export const IGNORED_APPS = [
  'launcher-win', 'launcher', 'f1-coding-minigame', // deze game
  'shellhost', 'shellexperiencehost', 'startmenuexperiencehost', // taakbalk / meldingen / start
  'searchhost', 'searchapp', 'lockapp',             // zoeken / vergrendelscherm
];

// Maakt een app-naam netjes: kleine letters en zonder ".exe".
export function normalizeAppName(name) {
  return String(name || '').toLowerCase().replace(/\.exe$/, '').trim();
}

// true als de app in de CODING_APPS lijst staat.
export function isCodingApp(name) {
  return CODING_APPS.includes(normalizeAppName(name));
}

// true als we deze app moeten negeren (deze game, taakbalk, ...).
export function isIgnored(name) {
  return IGNORED_APPS.includes(normalizeAppName(name));
}
