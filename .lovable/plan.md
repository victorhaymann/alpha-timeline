

# Plan: Add Admin Access for The New Face Team

## Summary
Give Charles (charles@thenewface.io) and Romain (romain@thenewface.io) full admin editing access to ALL projects, matching Victor's capabilities. This requires adding an "admin" role to the system and updating RLS policies.

## Current Situation
- **Victor** - Owns all 5 projects, has `pm` role - full edit access
- **Charles** - Has `pm` role but owns no projects - cannot edit Victor's projects
- **Romain** - Does not exist in the system yet (needs to register first)

The problem: Current RLS policies only allow the **project owner** to edit. The `pm` role alone doesn't grant edit access to other users' projects.

## Solution Overview

We'll create a new **admin** role that grants full access to all projects, independent of ownership.

## Implementation Steps

### Step 1: Add 'admin' to the user_role enum
Modify the existing `user_role` enum to include an 'admin' role:
- Current values: `pm`, `client`
- New values: `pm`, `client`, `admin`

### Step 2: Create a helper function to check admin status
Create a `is_admin()` security definer function that checks if the current user has the admin role. This prevents infinite recursion in RLS policies.

```text
+-------------------+
|   is_admin()      |
|-------------------|
| Returns true if   |
| user has 'admin'  |
| role              |
+-------------------+
```

### Step 3: Update RLS policies for key tables
Modify policies to allow admins full access:

| Table | Current Policy | Updated Policy |
|-------|---------------|----------------|
| `projects` | `owner_id = auth.uid()` | `owner_id = auth.uid() OR is_admin()` |
| `phases` | owner check | owner check OR is_admin() |
| `tasks` | owner check | owner check OR is_admin() |
| `task_segments` | owner check | owner check OR is_admin() |
| `dependencies` | owner check | owner check OR is_admin() |
| `meeting_notes` | owner check | owner check OR is_admin() |
| `invites` | owner check | owner check OR is_admin() |
| `project_shares` | owner check | owner check OR is_admin() |
| `rights_agreements` | owner check | owner check OR is_admin() |
| `rights_usage_selections` | owner check | owner check OR is_admin() |
| `client_documents` | owner check | owner check OR is_admin() |
| `quotations` | owner check | owner check OR is_admin() |
| `invoices` | owner check | owner check OR is_admin() |
| `project_resource_links` | owner check | owner check OR is_admin() |
| `project_steps` | owner check | owner check OR is_admin() |
| `clients` | created_by check | created_by check OR is_admin() |

### Step 4: Grant admin role to Victor and Charles
Insert admin role for:
- Victor (`806735de-369f-448c-8afb-5957506048fd`)
- Charles (`d3ca7493-9387-4d90-8a76-f4d268762e64`)

### Step 5: Handle Romain
Romain (romain@thenewface.io) **is not registered yet**. Options:
1. Romain needs to sign up first, then we can add the admin role
2. OR we create a trigger that automatically assigns admin role when this email signs up

I recommend option 2 - creating an automatic trigger so Romain gets admin access immediately upon registration.

---

## Technical Details

### Database Migration SQL

The migration will:
1. Add 'admin' to the `user_role` enum
2. Create `is_admin()` function
3. Drop and recreate affected RLS policies
4. Assign admin role to existing users
5. Create trigger for auto-assigning admin to Romain

### Security Considerations
- The `is_admin()` function uses `SECURITY DEFINER` to prevent RLS recursion
- Admin role is separate from `pm` role (users can have both)
- The admin check is done at the database level, not application level

### Files to Update
- **Database**: One migration file with all changes
- **Types**: `src/types/database.ts` - add 'admin' to `UserRole` type
- **Auth hook**: `src/hooks/useAuth.tsx` - no changes needed (already fetches role)

## What Happens After Implementation

1. **Victor** - Continues as before (owner + admin)
2. **Charles** - Can immediately view and edit ALL projects
3. **Romain** - When they sign up with romain@thenewface.io, they'll automatically get admin access

## Rollback Plan
If needed, the admin role can be removed by:
1. Deleting admin entries from `user_roles`
2. Dropping the updated policies
3. Restoring original policies
4. Dropping `is_admin()` function

