# Security, privacy, and saves

FOG OF SEA runs entirely in the browser. It requires no account and sends no
game decisions, writing, or save contents to an application server.

## Before play

You choose either session-only play or browser saving. The game does not write
a save before that choice.

- **Session-only play** keeps the current game in memory. Closing the page ends
  the session unless you download a TXT save.
- **Browser saving** stores named slots in this browser profile. Browser storage
  is not encrypted and may be readable by another person using that profile.
- **TXT export** creates a readable portable record on your device. Import is
  validated before it can replace the current session.

Written analysis is excluded from browser saves unless you explicitly include
it for that slot. Portable TXT exports include the writing needed to preserve
your own record.

During command, the readable TXT record follows the same as-known boundary as
the intelligence panel. It includes recorded staff judgments, modeled
inflictions, and absolute facts with their occurrence and discovery turns. It
does not reveal concealed opposing actions, events beyond the active decision
turn, hidden matrix values, or raw internal notes. The complete restorable command payload is
encoded whenever a command matrix exists. Encoding is not encryption.

## Network and input boundaries

The production build uses self-hosted code, fonts, and artwork. Its content
security policy blocks third-party scripts, frames, and application network
connections. A static hosting provider can still receive ordinary request
metadata while serving the files.

Imported files, save names, and other text are bounded and validated. Current
version-4 saves also validate typed opposing actions, inflictions, observation
domains, and post-first-turn staff judgments before canonical replay. Invalid,
stripped, or altered state is rejected without partially replacing the open
game.
