

# Forgot Password Flow

## What will be added

A complete "Forgot Password" flow with three parts:

1. **"Forgot password?" link** on the sign-in form that switches to a reset request view
2. **Password reset request** -- the user enters their email and receives a reset link via the built-in authentication email system
3. **Password update page** (`/reset-password`) -- when the user clicks the link in their email, they land on a page where they set a new password

## How it works

1. User clicks "Forgot password?" on the sign-in tab
2. A new view appears asking for their email address
3. The system sends a password reset email with a link pointing to `https://tnfproject.com/reset-password` (or the preview URL)
4. User clicks the link, lands on the reset page, and enters a new password
5. Password is updated and user is redirected to the projects dashboard

## Changes

### 1. Auth page (`src/pages/Auth.tsx`)
- Add a `forgotPassword` state to toggle between sign-in form and forgot-password form
- Add a "Forgot password?" button below the sign-in button
- Forgot password view: email input + "Send Reset Link" button
- Uses `supabase.auth.resetPasswordForEmail()` with redirect URL pointing to `/reset-password`
- Success toast confirms email was sent; error toast on failure

### 2. New Reset Password page (`src/pages/ResetPassword.tsx`)
- Standalone page with the TNF branding (logo, card layout matching Auth page)
- Two password fields: "New Password" and "Confirm Password"
- Validates passwords match and minimum 6 characters
- Calls `supabase.auth.updateUser({ password })` to set the new password
- On success, redirects to `/projects` with a success toast

### 3. Router update (`src/App.tsx`)
- Add `/reset-password` as a public route (accessible without being logged in, since the auth token comes from the URL hash)

### 4. Auth hook (`src/hooks/useAuth.tsx`)
- No changes needed -- `resetPasswordForEmail` and `updateUser` are called directly via the Supabase client, and the auth state listener already handles the session from the reset link

## Technical Details

- `resetPasswordForEmail` sends the email using the built-in authentication email system (no extra API key needed)
- The reset link includes a token in the URL hash that the Supabase client automatically picks up via `onAuthStateChange` with a `PASSWORD_RECOVERY` event
- The redirect URL will use `window.location.origin` to work in both preview and production environments

