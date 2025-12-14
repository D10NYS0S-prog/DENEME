# Imerek `main.js` Analysis (Truncated)

The user provided a large snippet of `main.js` from the Imerek UYAP extension. Due to size limits, I am extracting the visible key information here.

## Google Integration (`UYAP_EXT.GOOGLE`)
- **Calendar API**: `https://www.googleapis.com/calendar/v3/calendars/`
  - Used for `createCalendarEvent`, `updateCalendarEvent`, `getCalendarList`.
- **Drive API**: 
  - List: `https://www.googleapis.com/drive/v3/files`
  - Upload: `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`
  - Delete: `https://www.googleapis.com/drive/v3/files/`
- **Auth**: Uses `access_token()` which manages `localStorage.getItem("_token")`.

## Database Logic (`UYAP_EXT.DB`)
- The extension seems to use a local SQL-like wrapper over IndexedDB (`UYAP_EXT.DB.connection.select`).
- Queries use a JSON structure:
  ```json
  {
    "from": "taraflar",
    "where": [["AND", "taraflar.vekil", "like", "..."]],
    "groupBy": ["adi"]
  }
  ```
- **Tables referenced**:
  - `taraflar`
  - `dosyalar` (fields: `hash`, `dosyaId_tam`, `birimAdi`, `dosyaNo`, `esasNo`, `table_name`)
  - `evraklar`
  - `tebligatlar`
  - `notlar`
  - `durusmalar`
  - `ihaleler`

## System/Portal Messages
- The extension communicates with a backend or local handler via `messageToPortal`.
- **Endpoints/Actions**:
  - `/system/deleteEveryThing` (Reset DB)
  - `/system/showFolder`
  - `/system/moveArsiv`
  - `ask: "google_yetki_ver"`
  - `ask: "showDefaultFolder"`

## UI/Menu (`UYAP_EXT.MENU`)
- Handles "badges" for new files/documents.
- `muvekkilList` logic to fetch clients from `taraflar` table.

## Interesting Functions
- `UYAP_EXT.TOOL.pdfDosyaKapakHesabi`
- `UYAP_EXT.TOOL.dosyaGoruntule`
- `UYAP_EXT.TOOL.fileDownload`

## Missing/Truncated
- The snippet provided ends abruptly.
- **Critical UYAP Endpoints**: I do *not* see explicit `fetch` calls to `*.ajx` endpoints (like `dosya_taraf_bilgileri_brd.ajx`) in this specific text block. They might be wrapped inside `UYAP_EXT.TOOL` functions or `UYAP_EXT.DB` sync functions which are not fully visible or defined elsewhere in the file.
