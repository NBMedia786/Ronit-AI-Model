# Supabase Database Setup Guide

This guide will help you set up Supabase as the database for your Ronit AI Voice Coach application.

## Prerequisites

1. Supabase instance hosted on your VPS server
2. Supabase URL and Service Role Key

## Step 1: Install Dependencies

```bash
pip install -r requirements.txt
```

This will install the `supabase` Python client library.

## Step 2: Create Database Table

1. Log into your Supabase dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of `supabase_migration.sql`
4. Run the SQL script to create the `users` table

The migration script will create:
- `users` table with all necessary columns
- Indexes for performance
- Row Level Security (RLS) policies
- Auto-update trigger for `updated_at` timestamp
- Statistics view for analytics

## Step 3: Configure Environment Variables

Add these variables to your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-service-role-key-here
# OR use SUPABASE_SERVICE_ROLE_KEY (both work)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Important Notes:**
- Use the **Service Role Key** (not the anon key) for backend operations
- The Service Role Key bypasses Row Level Security (RLS)
- Keep this key secure and never expose it to the frontend

## Step 4: Verify Connection

When you start your Flask application, check the logs for:
- `✅ Supabase client initialized successfully` - Connection successful
- `⚠️ Supabase credentials not configured` - Missing credentials, will use JSON fallback
- `❌ Failed to initialize Supabase client` - Connection error

## Step 5: Data Migration (Optional)

If you have existing data in `data/users.json`, you can migrate it:

1. The application will automatically use Supabase when configured
2. New users will be stored in Supabase
3. Existing JSON data will be used as fallback if Supabase is unavailable

## Database Schema

### Users Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `email` | TEXT | User email (unique, indexed) |
| `password_hash` | TEXT | Hashed password (for authentication) |
| `talktime` | INTEGER | Available talk time in seconds |
| `created_at` | TIMESTAMPTZ | Account creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp (auto-updated) |
| `last_login` | TIMESTAMPTZ | Last login timestamp |
| `sessions` | JSONB | Array of session records |
| `total_sessions` | INTEGER | Total number of sessions |
| `welcome_bonus_given` | BOOLEAN | Whether welcome bonus was given |
| `welcome_bonus_date` | TIMESTAMPTZ | When welcome bonus was given |

## Features

- **Automatic Fallback**: If Supabase is unavailable, the app falls back to JSON file storage
- **Upsert Operations**: Users are automatically created or updated
- **Email Uniqueness**: Email is enforced as unique at the database level
- **Auto-timestamps**: `created_at` and `updated_at` are automatically managed
- **Session Storage**: Sessions are stored as JSONB array for flexibility

## Troubleshooting

### Connection Issues

1. Verify your Supabase URL is correct
2. Check that your Service Role Key is valid
3. Ensure your VPS can reach your Supabase instance
4. Check firewall rules if Supabase is self-hosted

### Data Not Appearing

1. Check Supabase logs in the dashboard
2. Verify RLS policies allow your service role
3. Check application logs for Supabase errors
4. Ensure the `users` table exists and has correct schema

### Performance

- Indexes are created on `email`, `created_at`, and `last_login`
- Use the statistics view for analytics queries
- Consider adding more indexes based on your query patterns

## Security Notes

- Never commit your `.env` file with Supabase credentials
- Use environment variables or secure secret management
- The Service Role Key has full database access - keep it secure
- Consider using connection pooling for production
