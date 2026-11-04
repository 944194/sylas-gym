
CREATE TABLE IF NOT EXISTS enquiries (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    membership VARCHAR(100),
    message TEXT DEFAULT '',
    fitness_goal VARCHAR(100),
    enquiry_text TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'contacted', 'converted', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



CREATE TABLE IF NOT EXISTS trainers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    specialization VARCHAR(150) NOT NULL,
    experience_years INTEGER NOT NULL DEFAULT 0
        CHECK (experience_years >= 0 AND experience_years <= 80),
    qualifications VARCHAR(250) NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL,
    image_public_id VARCHAR(255) NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trainers_published_order_idx
    ON trainers (is_published, display_order, id);



-- CLIENT ACCOUNTS
CREATE TABLE IF NOT EXISTS clients (
    id BIGSERIAL PRIMARY KEY,

    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    password_hash TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'approved',
                'rejected',
                'suspended'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate email addresses (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS clients_email_unique_idx
    ON clients (LOWER(email));

-- CLIENT MEMBERSHIPS
CREATE TABLE IF NOT EXISTS client_memberships (
    id BIGSERIAL PRIMARY KEY,

    client_id BIGINT NOT NULL
        REFERENCES clients(id) ON DELETE CASCADE,

    membership_plan_id BIGINT NOT NULL
        REFERENCES membership_plans(id) ON DELETE RESTRICT,

    plan_name VARCHAR(100) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    duration_months INTEGER NOT NULL,

    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (
            status IN ('active', 'expired', 'cancelled')
        ),

    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            payment_status IN (
                'pending',
                'paid',
                'failed',
                'refunded'
            )
        ),

    amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (price >= 0),
    CHECK (amount_paid >= 0),
    CHECK (duration_months > 0),
    CHECK (expiry_date >= start_date)
);

CREATE INDEX IF NOT EXISTS client_memberships_client_idx
    ON client_memberships(client_id);

CREATE INDEX IF NOT EXISTS client_memberships_plan_idx
    ON client_memberships(membership_plan_id);


-- 1. Create a sequence starting from 100001
CREATE SEQUENCE IF NOT EXISTS gym_member_id_seq
START WITH 100001
INCREMENT BY 1;


BEGIN;

-- Public website registrations
CREATE TABLE IF NOT EXISTS registered_users (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    password_hash TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate email addresses (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS
registered_users_email_unique_idx
ON registered_users (LOWER(email));

-- Enquiries submitted by registered website users
CREATE TABLE IF NOT EXISTS registered_user_enquiries (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES registered_users(id) ON DELETE CASCADE,
    membership_plan_id BIGINT
        REFERENCES membership_plans(id) ON DELETE SET NULL,
    plan_name VARCHAR(100),
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'contacted', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
registered_user_enquiries_user_idx
ON registered_user_enquiries(user_id);

COMMIT;


-- 2. Add the Member ID column to clients
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS member_id BIGINT;


-- 3. Ensure every assigned Member ID is unique
CREATE UNIQUE INDEX IF NOT EXISTS clients_member_id_unique_idx
ON clients (member_id)
WHERE member_id IS NOT NULL;


-- 4. Ensure assigned Member IDs are positive
ALTER TABLE clients
ADD CONSTRAINT clients_member_id_positive_check
CHECK (member_id IS NULL OR member_id >= 100001);

-- Separate enquiry fields: membership selection, fitness goal and free-text query.
ALTER TABLE enquiries
    ADD COLUMN IF NOT EXISTS fitness_goal VARCHAR(100),
    ADD COLUMN IF NOT EXISTS enquiry_text TEXT NOT NULL DEFAULT '';
