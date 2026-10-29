
CREATE TABLE IF NOT EXISTS enquiries (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    membership VARCHAR(100),
    message TEXT DEFAULT '',
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
