
require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcrypt");
const pool = require("./db");


async function sendOwnerSms(message) {
  if (process.env.FAST2SMS_ENABLED !== "true") {
    console.log("SMS dry run: owner notification was not sent.");
    return;
  }

  const apiKey = process.env.FAST2SMS_API_KEY?.trim();
  const ownerPhone = process.env.OWNER_PHONE?.trim();

  if (!apiKey || !/^[6-9]\d{9}$/.test(ownerPhone || "")) {
    console.error("SMS configuration is incomplete.");
    return;
  }

  try {
    const response = await fetch(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          route: "q",
          message,
          numbers: ownerPhone,
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.return !== true) {
      // Avoid logging API keys, phone numbers, or full provider responses.
      console.error("Fast2SMS did not accept the notification.");
      return;
    }

    console.log("Fast2SMS accepted the owner notification.");
  } catch (error) {
    console.error("Fast2SMS request failed:", error.message);
  }
}


const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing from the server .env file.");
}

app.use(helmet());

const allowedOrigins = (
  process.env.FRONTEND_ORIGIN || "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header, such as server-side tools.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "20kb" }));

// Store login sessions in PostgreSQL
const sessionConfig = {
  store: new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true,
  }),
  name: "sylas.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 4,
  },
};

// Set this only when your deployment uses a trusted reverse proxy.
if (isProduction && process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

app.use(session(sessionConfig));

// Rate-limit login attempts

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many failed login attempts. Please try again later.",
  },
});


const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // Maximum 10 requests per IP in this window
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many enquiries submitted. Please try again later.",
  },
});



// Check whether the backend is running
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Sylas Gym backend is running!",
  });
});

// Require an authenticated owner session
function requireOwner(req, res, next) {
  if (!req.session.ownerId) {
    return res.status(401).json({
      success: false,
      message: "Please log in to access this resource.",
    });
  }

  next();
}


function requireCsrf(req, res, next) {
  const providedToken = req.get("X-CSRF-Token");
  const expectedToken = req.session?.csrfToken;

  if (
    typeof providedToken !== "string" ||
    typeof expectedToken !== "string"
  ) {
    return res.status(403).json({
      success: false,
      message: "CSRF validation failed. Refresh the dashboard and try again.",
    });
  }

  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);

  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    return res.status(403).json({
      success: false,
      message: "CSRF validation failed. Refresh the dashboard and try again.",
    });
  }

  next();
}


// Owner login
app.post("/api/owner/login", loginLimiter, async (req, res, next) => {
  const { username, password } = req.body || {};

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    username.length > 100 ||
    password.length > 72
  ) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid username and password.",
    });
  }

  try {
    const result = await pool.query(
      "SELECT id, username, password_hash FROM owners WHERE username = $1",
      [username.trim()]
    );

    const owner = result.rows[0];

    // Use a dummy hash for unknown usernames to reduce timing differences.
    const dummyHash =
      "$2b$12$zlPqO/mBB2LwL0yBkUW0QuAxL26vG3GslsxV83526uZ5CBZv3oq4S";

    const passwordMatches = await bcrypt.compare(
      password,
      owner?.password_hash || dummyHash
    );

    if (!owner || !passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    // Prevent session fixation after successful login.
    req.session.regenerate((error) => {
      if (error) return next(error);

      req.session.ownerId = owner.id;
      req.session.ownerUsername = owner.username;
      req.session.csrfToken = crypto.randomBytes(32).toString("hex");

      req.session.save((saveError) => {
        if (saveError) return next(saveError);

        res.json({
          success: true,
          message: "Login successful.",
          owner: {
            id: owner.id,
            username: owner.username,
          },
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

// Check whether the owner is logged in
app.get("/api/owner/me", requireOwner, (req, res) => {
  res.json({
    success: true,
    owner: {
      id: req.session.ownerId,
      username: req.session.ownerUsername,
    },
    csrfToken: req.session.csrfToken,
  });
});

// Owner logout
app.post("/api/owner/logout", requireOwner,requireCsrf, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);

    res.clearCookie("sylas.sid", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
    });

    res.json({
      success: true,
      message: "Logged out successfully.",
    });
  });
});

// Public membership enquiry submission
app.post("/api/enquiries", enquiryLimiter, async (req, res, next) => {
  const { name, phone, membership, message } = req.body || {};

  if (
    typeof name !== "string" ||
    typeof phone !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 100 ||
    !/^[0-9+\s()-]{7,20}$/.test(phone.trim()) ||
    (membership !== undefined &&
      (typeof membership !== "string" || membership.length > 100)) ||
    (message !== undefined &&
      (typeof message !== "string" || message.length > 1000))
  ) {
    return res.status(400).json({
      success: false,
      message: "Please provide valid enquiry details.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO enquiries (name, phone, membership, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, phone, membership, status, created_at`,
      [
        name.trim(),
        phone.trim(),
        membership?.trim() || null,
        message?.trim() || "",
      ]
    );

    
const savedEnquiry = result.rows[0];

const ownerMessage =
  `Sylas Gym: New membership enquiry from ${savedEnquiry.name}. ` +
  `Phone: ${savedEnquiry.phone}. ` +
  `Goal: ${savedEnquiry.membership || "Not specified"}.`;

void sendOwnerSms(ownerMessage);


    res.status(201).json({
      success: true,
      message: "Your membership enquiry was saved successfully.",
      enquiry: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// Only logged-in owners can view enquiries

app.get("/api/enquiries", requireOwner, async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim().slice(0, 100);
    const requestedStatus = String(req.query.status || "all");
    const allowedStatuses = [
      "all",
      "new",
      "contacted",
      "converted",
      "closed",
    ];

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = 25;
    const offset = (page - 1) * limit;

    if (!allowedStatuses.includes(requestedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status filter.",
      });
    }

    if (!Number.isSafeInteger(page) || offset > 2147483647) {
      return res.status(400).json({
        success: false,
        message: "Invalid page number.",
      });
    }

    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(name ILIKE $${params.length} OR phone ILIKE $${params.length})`
      );
    }

    if (requestedStatus !== "all") {
      params.push(requestedStatus);
      conditions.push(`status = $${params.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM enquiries ${whereClause}`,
      params
    );

    const total = countResult.rows[0].total;
    const totalPages = Math.ceil(total / limit);

    // Return an empty page if a filter change leaves the requested page out of range.
    if (total > 0 && page > totalPages) {
      return res.json({
        success: true,
        enquiries: [],
        pagination: { page, limit, total, totalPages },
      });
    }

    const dataParams = [...params, limit, offset];

    const enquiryResult = await pool.query(
      `SELECT id, name, phone, membership, message, status, created_at
       FROM enquiries
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${dataParams.length - 1}
       OFFSET $${dataParams.length}`,
      dataParams
    );

    // Counts across all enquiries, independent of the current filter/page.
    const statsResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'new')::int AS new,
        COUNT(*) FILTER (WHERE status = 'contacted')::int AS contacted,
        COUNT(*) FILTER (WHERE status = 'converted')::int AS converted,
        COUNT(*) FILTER (WHERE status = 'closed')::int AS closed
      FROM enquiries
    `);

    return res.json({
      success: true,
      enquiries: enquiryResult.rows,
      pagination: { page, limit, total, totalPages },
      stats: statsResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
});



app.patch("/api/enquiries/:id/status", requireOwner, requireCsrf, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    const allowedStatuses = [
      "new",
      "contacted",
      "converted",
      "closed",
    ];

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry ID.",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry status.",
      });
    }

    const result = await pool.query(
      `UPDATE enquiries
       SET status = $1
       WHERE id = $2
       RETURNING id, name, phone, membership, status, created_at`,
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found.",
      });
    }

    return res.json({
      success: true,
      message: "Enquiry status updated successfully.",
      enquiry: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});


// Central error handler
app.use((error, req, res, next) => {
  console.error("API error:", error.message);

  if (res.headersSent) return next(error);

  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
});

app.listen(PORT, () => {
  console.log(`Sylas Gym backend running at http://localhost:${PORT}`);
});
