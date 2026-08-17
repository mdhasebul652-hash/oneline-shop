V71 — TikTok Direct Posting + Employee TikTok Section
Base: V70

Added:
- TikTok section in Admin Dashboard.
- TikTok is assignable to employees through Employee Management.
- TikTok OAuth 2.0 Connect/Disconnect flow.
- Server-side access/refresh token storage in SiteSetting.
- TikTok video/photo direct-post request using Content Posting API.
- Product selection adds the site's product URL to the TikTok caption.
- Existing V70 features preserved.

Important:
- TikTok Client Key/Secret must be configured in Admin Settings.
- Register this redirect URI in TikTok Developer Portal:
  https://oneline-shop.onrender.com/auth/tiktok/callback
- TikTok requires the relevant API scopes and approval/audit for public direct posting.
- A native TikTok “Order Now” product button is NOT provided by the basic Content Posting API. A separate TikTok Shop commerce integration/approval is required for native product commerce controls.
