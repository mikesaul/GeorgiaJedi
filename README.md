```markdown
General purpose for this project is a simple-ish website to present and manage a personal collection of mostly Star Wars themed memorabilia and autographs.
ALso using this opportunity to explore HTML5 and Bootstrap/Bootstrap-Table development.
Current architecture:
HTML/Javascript/JQuery/Bootstrap UI
  JSON data sources
  Classic ASP added for some basis dynamic features

ChatGPT has been utilized to aid in the overall technical construction and functionalities, as well.

---

Notes: Canonical URL format for image view / back-to-list state restoration
--------------------------------------------------------------------------

A compact canonical URL format is used to preserve and restore the full catalog view state when navigating from a listing to the image view and back.

- Parameter: s
  - A single compact token containing the full table state as base64-encoded JSON.
  - The JSON contains:
    - pageNumber: the current page number (1-based)
    - pageSize: the selected page size
    - sortName: the active sort column name (if any)
    - sortOrder: the active sort order ('asc'/'desc') (if any)
    - searchText: the search text from the table toolbar (if any)
    - filters: an object of custom column filters (keys are the data-column values, values are the typed/selected filter values)
  - Example decoded JSON:
    {
      "pageNumber": 2,
      "pageSize": 25,
      "sortName": "acquired",
      "sortOrder": "desc",
      "searchText": "Skywalker",
      "filters": { "franchise": "Star Wars", "original_cost": ">= 100" }
    }
  - The actual s token looks compact (base64) and is safe to put in URLs. Example:
    imageview.html?image=solo-01&sender=autographs&s=QmFzZTY0VG9rZW4...

- Behavior:
  - Listing pages (autographs.html and collectibles.html) emit image links containing:
    - image (the base image name)
    - sender (the listing page base name, e.g. "autographs" or "collectibles")
    - s (optional compact state token; present when the table state can be serialized)
  - imageview.html:
    - Uses sender and s (if present) to build the "Back to Catalog" link that returns to the listing and restores the exact table state.
    - If s is missing it falls back to linking to sender.html (no page restoration).
    - pg and index query parameters were removed from new links; s is the canonical single-token state.

- Why this approach:
  - Single canonical token keeps URLs short and easy to share/bookmark.
  - Encoding everything in s ensures all filters, search, paging, and sort are preserved.
  - Works across tabs and when opening images in a new window because state is encoded in the image link.

- Backwards compatibility:
  - If you have old links that still include pg or index (legacy), you can keep the listing to accept pg as a fallback if needed. The current implementation prefers s when available; if s is missing it links back to sender.html without page-specific restoration.

- Implementation notes:
  - The token uses UTF-8-safe base64 encoding/decoding helpers so filter values with non-ASCII characters are preserved.
  - The updated sender detection uses the page base name (getItemType()) to determine sender reliably.
  - If you prefer even shorter tokens, consider a URL-safe base64 variant (replace +/ with -_ and strip = padding) to save a few bytes and avoid encodeURIComponent on the parameter.

- Testing:
  1. Open autographs.html or collectibles.html.
  2. Set filters, search, sorting and select a page number.
  3. Click a thumbnail to open imageview.html.
  4. Click "Back to Catalog" — you should return to the listing with the same filters, page, sort and search restored.

```
