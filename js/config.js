/* The Travel Journal — cloud sync settings.

   Paste your Supabase project details here to turn on live sync across
   devices. Leave it as null to keep the journal purely on-device (the app
   works fully offline either way).

   The anon / public key is DESIGNED to be public — it's safe to commit here;
   security comes from the row-level rules set up in Supabase. Never paste the
   service_role (secret) key into this file.

   Once ready, replace the line below with something like:

   window.TLJ_CONFIG = {
     url: "https://YOUR-PROJECT.supabase.co",
     anonKey: "eyJ...your anon public key...",
     members: ["you@example.com", "partner@example.com"],
   };
*/
window.TLJ_CONFIG = null;
