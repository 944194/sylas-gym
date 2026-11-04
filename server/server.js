
require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const app = express();

app.set("trust proxy", 1);
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcrypt");
const pool = require("./db");
const cloudinary = require("./cloudinary");



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
      }
    );

    const responseText = await response.text();
    let result;

    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      result = {
        message: "Provider returned a non-JSON response.",
      };
    }

    if (!response.ok || result.return === false) {
      console.error("Fast2SMS rejected notification:", {
        httpStatus: response.status,
        providerStatusCode: result.status_code ?? null,
        message: result.message ?? "No error message supplied.",
      });
      return;
    }

    console.log("Fast2SMS accepted notification:", {
      requestId: result.request_id ?? null,
      message: result.message ?? "Provider accepted the request.",
    });
  } catch (error) {
    console.error("Fast2SMS request failed:", error.message);
  }
}




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
  sameSite: isProduction ? "none" : "lax",
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



const clientRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many registration attempts. Please try again later.",
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

// Require an authenticated client session
function requireClient(req, res, next) {
  if (!req.session.clientId) {
    return res.status(401).json({
      success: false,
      message: "Please log in to access your client dashboard.",
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


// Require an authenticated public website user
function requireRegisteredUser(req, res, next) {
  if (!req.session.registeredUserId) {
    return res.status(401).json({
      success: false,
      message: "Please log in to access your account.",
    });
  }

  next();
}



// Public user registration (mobile-number login; no user-entered password).
app.post(
  "/api/user/register",
  clientRegisterLimiter,
  async (req, res, next) => {
    try {
      const { fullName, email, phone } = req.body || {};
      const normalizedPhone = typeof phone === "string"
        ? phone.replace(/\D/g, "")
        : "";

      if (
        typeof fullName !== "string" ||
        typeof email !== "string" ||
        fullName.trim().length < 2 ||
        fullName.trim().length > 100 ||
        email.trim().length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        !/^\d{10}$/.test(normalizedPhone)
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid name, email address and 10-digit mobile number.",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const existing = await pool.query(
        `SELECT id, email,
                regexp_replace(phone, '[^0-9]', '', 'g') AS normalized_phone
         FROM registered_users
         WHERE LOWER(email) = $1
            OR regexp_replace(phone, '[^0-9]', '', 'g') = $2`,
        [normalizedEmail, normalizedPhone]
      );

      if (existing.rowCount > 0) {
        const samePhone = existing.rows.some(
          (row) => row.normalized_phone === normalizedPhone
        );
        return res.status(409).json({
          success: false,
          message: samePhone
            ? "An account with this mobile number already exists. Please log in."
            : "An account with this email already exists.",
        });
      }

      // Keep the existing NOT NULL password_hash database column compatible.
      // This random hash is never shown to or entered by the user.
      const internalPassword = crypto.randomBytes(32).toString("base64url");
      const passwordHash = await bcrypt.hash(internalPassword, 12);

      const result = await pool.query(
        `INSERT INTO registered_users (
           full_name, email, phone, password_hash
         )
         VALUES ($1, $2, $3, $4)
         RETURNING id, full_name, email, phone, status, created_at`,
        [fullName.trim(), normalizedEmail, normalizedPhone, passwordHash]
      );

      return res.status(201).json({
        success: true,
        message: "Registration successful. You can now log in using your mobile number.",
        user: result.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists.",
        });
      }
      next(error);
    }
  }
);



// Unified mobile login for public website users and gym clients.
// Demo mode only: this flow does not verify ownership of the phone number.
app.post("/api/auth/mobile-login", loginLimiter, async (req, res, next) => {
  try {
    const phone = typeof req.body?.phone === "string"
      ? req.body.phone.replace(/\D/g, "")
      : "";

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit mobile number.",
      });
    }

    const [usersResult, clientsResult] = await Promise.all([
      pool.query(
        `SELECT id, full_name, email, phone, status
         FROM registered_users
         WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1
         ORDER BY id`,
        [phone]
      ),
      pool.query(
        `SELECT id, member_id::text AS member_id, full_name, email, phone, status
         FROM clients
         WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1
         ORDER BY full_name ASC, id ASC`,
        [phone]
      ),
    ]);

    
const activeClientAccounts = clientsResult.rows
  .filter((client) => client.status === "active")
  .map((client) => ({
    type: "client",
    id: client.id,
    memberId: client.member_id,
    fullName: client.full_name,
    email: client.email,
    phone: client.phone,
    label: "Gym Membership",
  }));

const activeUserAccounts = usersResult.rows
  .filter((user) => user.status === "active")
  .map((user) => ({
    type: "user",
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    label: "Website Account",
  }));

// Gym membership accounts take priority.
// If gym client records exist, never show the public user account.
const accounts = clientsResult.rows.length > 0
  ? activeClientAccounts
  : activeUserAccounts;

    if (accounts.length === 0) {
      const hasSuspended = [...usersResult.rows, ...clientsResult.rows].length > 0;
      return res.status(hasSuspended ? 403 : 404).json({
        success: false,
        message: hasSuspended
          ? "The account linked to this mobile number is suspended. Please contact the gym."
          : "No account was found for this mobile number. Please register or contact the gym.",
      });
    }

    // Keep the candidate list in the session until the user chooses an account.
    req.session.regenerate((error) => {
      if (error) return next(error);

      req.session.pendingAuthPhone = phone;
      req.session.pendingAuthAccounts = accounts.map(({ type, id }) => ({ type, id }));
      req.session.csrfToken = crypto.randomBytes(32).toString("hex");

      req.session.save((saveError) => {
        if (saveError) return next(saveError);

        return res.json({
          success: true,
          requiresAccountSelection: true,
          accounts,
          csrfToken: req.session.csrfToken,
          message: accounts.length === 1
            ? "Account found. Continue to open it."
            : "Multiple accounts found. Select the account you want to open.",
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/select-account", async (req, res, next) => {
  try {
    const type = req.body?.type;
    const id = Number(req.body?.id);
    const phone = req.session?.pendingAuthPhone;
    const allowed = req.session?.pendingAuthAccounts;

    if (
      !["user", "client"].includes(type) ||
      !Number.isSafeInteger(id) ||
      !Array.isArray(allowed) ||
      !allowed.some(
  (item) =>
    item.type === type &&
    String(item.id) === String(id)
)||
      typeof phone !== "string"
    ) {
      return res.status(401).json({
        success: false,
        message: "Your login session has expired. Enter your mobile number again.",
      });
    }

    const table = type === "user" ? "registered_users" : "clients";
    const result = await pool.query(
      `SELECT id, full_name, email, phone, status
       ${type === "client" ? ", member_id::text AS member_id" : ""}
       FROM ${table}
       WHERE id = $1
         AND regexp_replace(phone, '[^0-9]', '', 'g') = $2`,
      [id, phone]
    );

    if (result.rowCount === 0 || result.rows[0].status !== "active") {
      return res.status(403).json({
        success: false,
        message: "This account is unavailable or suspended.",
      });
    }

    const account = result.rows[0];

    // Regenerate again after selection and create one clean authenticated session.
    req.session.regenerate((error) => {
      if (error) return next(error);

      req.session.csrfToken = crypto.randomBytes(32).toString("hex");

      if (type === "user") {
        req.session.registeredUserId = account.id;
        req.session.registeredUserName = account.full_name;
      } else {
        req.session.clientId = account.id;
        req.session.clientName = account.full_name;
      }

      req.session.save((saveError) => {
        if (saveError) return next(saveError);

        return res.json({
          success: true,
          accountType: type,
          redirectTo: type === "user" ? "/user/dashboard" : "/client/dashboard",
          account: {
            id: account.id,
            fullName: account.full_name,
            email: account.email,
            phone: account.phone,
            ...(type === "client" ? { memberId: account.member_id } : {}),
          },
          csrfToken: req.session.csrfToken,
          message: "Login successful.",
        });
      });
    });
  } catch (error) {
    next(error);
  }
});


// Public user login by mobile number (no OTP/password in this prototype).
app.post(
  "/api/user/login",
  loginLimiter,
  async (req, res, next) => {
    try {
      const { phone } = req.body || {};
      const normalizedPhone = typeof phone === "string"
        ? phone.replace(/\D/g, "")
        : "";

      if (!/^\d{10}$/.test(normalizedPhone)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid 10-digit mobile number.",
        });
      }

      const result = await pool.query(
        `SELECT id, full_name, email, phone, status
         FROM registered_users
         WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1
         ORDER BY id`,
        [normalizedPhone]
      );

      if (result.rowCount === 0) {
        return res.status(401).json({
          success: false,
          message: "No public account was found for this mobile number. Please register first.",
        });
      }

      if (result.rowCount > 1) {
        return res.status(409).json({
          success: false,
          message: "More than one public account uses this mobile number. Please contact the gym.",
        });
      }

      const user = result.rows[0];

      if (user.status !== "active") {
        return res.status(403).json({
          success: false,
          message: "Your account is suspended.",
        });
      }

      req.session.regenerate((error) => {
        if (error) return next(error);

        req.session.registeredUserId = user.id;
        req.session.registeredUserName = user.full_name;
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");

        req.session.save((saveError) => {
          if (saveError) return next(saveError);
          return res.json({
            success: true,
            message: "Login successful.",
            user: {
              id: user.id,
              fullName: user.full_name,
              email: user.email,
              phone: user.phone,
            },
            csrfToken: req.session.csrfToken,
          });
        });
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get logged-in public user profile
app.get(
  "/api/user/me",
  requireRegisteredUser,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT id, full_name, email, phone, status, created_at
         FROM registered_users
         WHERE id = $1`,
        [req.session.registeredUserId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User account not found.",
        });
      }

      return res.json({
        success: true,
        user: result.rows[0],
        csrfToken: req.session.csrfToken,
      });

    } catch (error) {
      next(error);
    }
  }
);


// Update public user profile
app.patch(
  "/api/user/profile",
  requireRegisteredUser,
  requireCsrf,
  async (req, res, next) => {
    try {
      const { fullName, phone } = req.body || {};

      if (
        typeof fullName !== "string" ||
        typeof phone !== "string" ||
        fullName.trim().length < 2 ||
        fullName.trim().length > 100 ||
        !/^[0-9+\s()-]{7,20}$/.test(phone.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide valid profile details.",
        });
      }

      const result = await pool.query(
        `UPDATE registered_users
         SET full_name = $1,
             phone = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, full_name, email, phone, status, created_at`,
        [
          fullName.trim(),
          phone.trim(),
          req.session.registeredUserId,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User account not found.",
        });
      }

      req.session.registeredUserName = result.rows[0].full_name;

      return res.json({
        success: true,
        message: "Profile updated successfully.",
        user: result.rows[0],
      });

    } catch (error) {
      next(error);
    }
  }
);


// Submit enquiry from a logged-in public user
app.post(
  "/api/user/enquiries",
  requireRegisteredUser,
  requireCsrf,
  enquiryLimiter,
  async (req, res, next) => {
    try {
      const { membershipPlanId, message = "" } = req.body || {};

      if (
        !Number.isSafeInteger(Number(membershipPlanId)) ||
        Number(membershipPlanId) < 1 ||
        typeof message !== "string" ||
        message.length > 1000
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide valid enquiry details.",
        });
      }

      const planResult = await pool.query(
        `SELECT id, name
         FROM membership_plans
         WHERE id = $1 AND is_active = TRUE`,
        [Number(membershipPlanId)]
      );

      if (planResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Selected membership plan is unavailable.",
        });
      }

      const plan = planResult.rows[0];

      const result = await pool.query(
        `INSERT INTO registered_user_enquiries (
           user_id,
           membership_plan_id,
           plan_name,
           message
         )
         VALUES ($1, $2, $3, $4)
         RETURNING id, membership_plan_id, plan_name,
                   message, status, created_at`,
        [
          req.session.registeredUserId,
          plan.id,
          plan.name,
          message.trim(),
        ]
      );

      return res.status(201).json({
        success: true,
        message: "Your membership enquiry was submitted successfully.",
        enquiry: result.rows[0],
      });

    } catch (error) {
      next(error);
    }
  }
);


// Get only the logged-in user's enquiry history
app.get(
  "/api/user/enquiries",
  requireRegisteredUser,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT id, membership_plan_id, plan_name,
                message, status, created_at
         FROM registered_user_enquiries
         WHERE user_id = $1
         ORDER BY created_at DESC, id DESC`,
        [req.session.registeredUserId]
      );

      return res.json({
        success: true,
        enquiries: result.rows,
      });

    } catch (error) {
      next(error);
    }
  }
);


// Public user logout
app.post(
  "/api/user/logout",
  requireRegisteredUser,
  requireCsrf,
  (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);

      res.clearCookie("sylas.sid", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
      });

      return res.json({
        success: true,
        message: "Logged out successfully.",
      });
    });
  }
);


// Public client registration is permanently disabled.
// Only the authenticated gym owner can create client accounts.
app.post("/api/client/register", (req, res) => {
  return res.status(403).json({
    success: false,
    message: "Public registration is disabled. Please contact the gym owner.",
  });
});



// Owner creates a new client account

app.post(
  "/api/owner/clients",
  requireOwner,
  requireCsrf,
  async (req, res, next) => {
    const {
      fullName,
      email,
      phone,
      membershipPlanId,
      amountPaid = 0,
      paymentMethod,
      startDate,
      expiryDate,
    } = req.body || {};

    function isValidDate(value) {
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        return false;
      }

      const date = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }

    // Validate client details.
    if (
      typeof fullName !== "string" ||
      typeof email !== "string" ||
      typeof phone !== "string" ||
      fullName.trim().length < 2 ||
      fullName.trim().length > 100 ||
      email.trim().length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      !/^[0-9+\s()-]{7,20}$/.test(phone.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid client details.",
      });
    }

    // Validate membership and payment details.
    if (
      !Number.isSafeInteger(Number(membershipPlanId)) ||
      Number(membershipPlanId) < 1 ||
      typeof amountPaid !== "number" ||
      !Number.isFinite(amountPaid) ||
      amountPaid < 0 ||
      !["cash", "upi", "other"].includes(paymentMethod) ||
      !isValidDate(startDate) ||
      !isValidDate(expiryDate) ||
      expiryDate < startDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid membership, date and payment details.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Generate a temporary password.
    const temporaryPassword = crypto.randomBytes(12).toString("base64url");

    let passwordHash;

    try {
      passwordHash = await bcrypt.hash(temporaryPassword, 12);
    } catch (error) {
      return next(error);
    }

    const dbClient = await pool.connect();
    let transactionStarted = false;

    try {
      await dbClient.query("BEGIN");
      transactionStarted = true;

      // Check whether the email already exists.
      const existingClient = await dbClient.query(
        "SELECT id FROM clients WHERE LOWER(email) = $1",
        [normalizedEmail]
      );

      if (existingClient.rowCount > 0) {
        await dbClient.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          success: false,
          message: "A client with this email already exists.",
        });
      }

      // Get the selected active membership plan.
      const planResult = await dbClient.query(
        `SELECT id, name, price, duration_months
         FROM membership_plans
         WHERE id = $1 AND is_active = TRUE`,
        [Number(membershipPlanId)]
      );

      if (planResult.rowCount === 0) {
        await dbClient.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "Membership plan not found or inactive.",
        });
      }

      const plan = planResult.rows[0];
      const planPrice = Number(plan.price);

      if (amountPaid > planPrice) {
        await dbClient.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: "Amount paid cannot exceed the plan price.",
        });
      }

      // Calculate membership status using the database date.
      const statusResult = await dbClient.query(
        `SELECT
           CASE
             WHEN $1::date < CURRENT_DATE THEN 'expired'
             ELSE 'active'
           END AS membership_status`,
        [expiryDate]
      );

      const membershipStatus =
        statusResult.rows[0].membership_status;

      const paymentStatus =
        amountPaid >= planPrice ? "paid" : "pending";

      // Create the client account.
      const clientResult = await dbClient.query(
        `INSERT INTO clients (
           full_name,
           email,
           phone,
           password_hash,
           status
         )
         VALUES ($1, $2, $3, $4, 'active')
         RETURNING id, full_name, email, phone, status, created_at`,
        [
          fullName.trim(),
          normalizedEmail,
          phone.trim(),
          passwordHash,
        ]
      );

      const client = clientResult.rows[0];

      // Generate a permanent Member ID.
      const memberResult = await dbClient.query(
        `UPDATE clients
         SET member_id = nextval('gym_member_id_seq')
         WHERE id = $1
         RETURNING member_id::text AS member_id`,
        [client.id]
      );

      if (memberResult.rowCount === 0) {
        throw new Error("Unable to generate the client Member ID.");
      }

      const memberId = memberResult.rows[0].member_id;

      // Assign the membership and save payment details.
      const membershipResult = await dbClient.query(
        `INSERT INTO client_memberships (
           client_id,
           membership_plan_id,
           plan_name,
           price,
           duration_months,
           start_date,
           expiry_date,
           status,
           payment_status,
           amount_paid,
           payment_method
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          client.id,
          plan.id,
          plan.name,
          plan.price,
          plan.duration_months,
          startDate,
          expiryDate,
          membershipStatus,
          paymentStatus,
          amountPaid,
          paymentMethod,
        ]
      );

      // Return the permanent Member ID with the client.
      client.member_id = memberId;

      // Commit both operations together.
      await dbClient.query("COMMIT");
      transactionStarted = false;

      return res.status(201).json({
        success: true,
        message: "Client created and membership assigned successfully.",
        client,
        memberId,
        temporaryPassword,
        membership: membershipResult.rows[0],
      });

    } catch (error) {
      if (transactionStarted) {
        await dbClient.query("ROLLBACK");
      }

      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "A client with this email already exists.",
        });
      }

      next(error);
    } finally {
      dbClient.release();
    }
  }
);




// Gym client login by mobile number.
// A temporary pending session is created so account selection is tied to this login attempt.
app.post(
  "/api/client/login",
  loginLimiter,
  async (req, res, next) => {
    try {
      const { phone } = req.body || {};
      const normalizedPhone = typeof phone === "string"
        ? phone.replace(/\D/g, "")
        : "";

      if (!/^\d{10}$/.test(normalizedPhone)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid 10-digit mobile number.",
        });
      }

      const result = await pool.query(
        `SELECT id, member_id::text AS member_id, full_name, email, phone, status
         FROM clients
         WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1
         ORDER BY full_name ASC, id ASC`,
        [normalizedPhone]
      );

      if (result.rowCount === 0) {
        return res.status(401).json({
          success: false,
          message: "No gym membership account was found for this mobile number.",
        });
      }

      const activeClients = result.rows.filter((client) => client.status === "active");

      if (activeClients.length === 0) {
        return res.status(403).json({
          success: false,
          message: "All accounts linked to this mobile number are suspended. Please contact the gym.",
        });
      }

      req.session.regenerate((error) => {
        if (error) return next(error);

        req.session.pendingClientIds = activeClients.map((client) => client.id);
        req.session.pendingClientPhone = normalizedPhone;
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");

        req.session.save((saveError) => {
          if (saveError) return next(saveError);

          return res.json({
            success: true,
            requiresAccountSelection: activeClients.length > 1,
            message: activeClients.length > 1
              ? "Select the membership account you want to open."
              : "Mobile number found.",
            accounts: activeClients.map((client) => ({
              id: client.id,
              memberId: client.member_id,
              fullName: client.full_name,
              phone: client.phone,
              status: client.status,
            })),
            csrfToken: req.session.csrfToken,
          });
        });
      });
    } catch (error) {
      next(error);
    }
  }
);


// Select one gym membership account from the accounts returned for this mobile login.
app.post(
  "/api/client/select-account",
  async (req, res, next) => {
    try {
      const clientId = Number(req.body?.clientId);
      const allowedIds = req.session?.pendingClientIds;

      if (
        !Array.isArray(allowedIds) ||
        !Number.isSafeInteger(clientId) ||
        !allowedIds.includes(clientId)
      ) {
        return res.status(401).json({
          success: false,
          message: "Your account selection session has expired. Please enter your mobile number again.",
        });
      }

      const result = await pool.query(
        `SELECT id, member_id::text AS member_id, full_name, email, phone, status
         FROM clients
         WHERE id = $1
           AND regexp_replace(phone, '[^0-9]', '', 'g') = $2`,
        [clientId, req.session.pendingClientPhone]
      );

      if (result.rowCount === 0 || result.rows[0].status !== "active") {
        return res.status(403).json({
          success: false,
          message: "This membership account is unavailable or suspended.",
        });
      }

      const client = result.rows[0];
      req.session.clientId = client.id;
      req.session.clientName = client.full_name;
      delete req.session.pendingClientIds;
      delete req.session.pendingClientPhone;

      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        return res.json({
          success: true,
          message: "Client account selected successfully.",
          client: {
            id: client.id,
            memberId: client.member_id,
            fullName: client.full_name,
            email: client.email,
            phone: client.phone,
          },
          csrfToken: req.session.csrfToken,
        });
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get logged-in client profile and membership details for the client dashboard.
app.get("/api/client/me", requireClient, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, member_id::text AS member_id,
              full_name, email, phone, status, created_at
       FROM clients
       WHERE id = $1`,
      [req.session.clientId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Client account not found.",
      });
    }

    const membershipResult = await pool.query(
      `SELECT id, plan_name, price, duration_months,
              start_date, expiry_date, status,
              payment_status, amount_paid, payment_method
       FROM client_memberships
       WHERE client_id = $1
       ORDER BY start_date DESC, id DESC`,
      [req.session.clientId]
    );

    return res.json({
      success: true,
      client: result.rows[0],
      memberships: membershipResult.rows,
      csrfToken: req.session.csrfToken,
    });
  } catch (error) {
    next(error);
  }
});

// Log out the currently authenticated gym client.
app.post(
  "/api/client/logout",
  requireClient,
  requireCsrf,
  (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);

      res.clearCookie("sylas.sid", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
      });

      return res.json({
        success: true,
        message: "Logged out successfully.",
      });
    });
  }
);


// Owner API: list and search registered clients
app.get("/api/owner/clients", requireOwner, async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim().slice(0, 100);

    const result = await pool.query(
      `SELECT
         c.id,
         c.member_id::text AS member_id,
         c.full_name,
         c.email,
         c.phone,
         c.status,
         c.created_at,

         latest.plan_name AS latest_plan_name,
         latest.expiry_date::text AS latest_expiry_date,

         CASE
           WHEN c.status = 'suspended' THEN 'suspended'
           WHEN latest.expiry_date IS NULL THEN 'no_membership'
           WHEN latest.expiry_date < CURRENT_DATE THEN 'inactive'
           ELSE 'active'
         END AS membership_status,

         CASE
           WHEN latest.expiry_date < CURRENT_DATE
           THEN CURRENT_DATE - latest.expiry_date
           ELSE 0
         END AS inactive_days

       FROM clients c

       LEFT JOIN LATERAL (
         SELECT
           mp.name AS plan_name,
           cm.expiry_date
         FROM client_memberships cm
         LEFT JOIN membership_plans mp
           ON mp.id = cm.membership_plan_id
         WHERE cm.client_id = c.id
         ORDER BY cm.start_date DESC, cm.id DESC
         LIMIT 1
       ) latest ON TRUE

       WHERE (
         $1 = ''
         OR c.full_name ILIKE $2
         OR c.email ILIKE $2
         OR c.phone ILIKE $2
         OR c.member_id::text ILIKE $2
       )

       ORDER BY c.created_at DESC, c.id DESC
       LIMIT 100`,
      [search, `%${search}%`]
    );

    return res.json({
      success: true,
      clients: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Owner API: list active membership plans
app.get(
  "/api/owner/membership-plans",
  requireOwner,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT
           id,
           name,
           price,
           duration_months,
           description,
           benefits
         FROM membership_plans
         WHERE is_active = TRUE
         ORDER BY display_order ASC, id ASC`
      );

      return res.json({
        success: true,
        plans: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);



// Get a client's membership details and history
app.get(
  "/api/owner/clients/:clientId/memberships",
  requireOwner,
  async (req, res, next) => {
    try {
      const clientId = Number(req.params.clientId);

      if (!Number.isSafeInteger(clientId) || clientId < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid client ID.",
        });
      }

      const clientResult = await pool.query(
        `SELECT id, member_id::text AS member_id,
                full_name, email, phone, status
         FROM clients
         WHERE id = $1`,
        [clientId]
      );

      if (clientResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Client not found.",
        });
      }

      const membershipResult = await pool.query(
        `SELECT *
         FROM client_memberships
         WHERE client_id = $1
         ORDER BY start_date DESC, id DESC`,
        [clientId]
      );

      return res.json({
        success: true,
        client: clientResult.rows[0],
        memberships: membershipResult.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);


app.post(
  "/api/owner/clients/:clientId/membership",
  requireOwner,
  requireCsrf,
  async (req, res, next) => {
    const clientId = Number(req.params.clientId);

    const {
      membershipPlanId,
      amountPaid = 0,
      paymentMethod,
      startDate,
      expiryDate,
    } = req.body || {};

    // Validate ISO date strings (YYYY-MM-DD).
    function isValidDate(value) {
      if (typeof value !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }

      const date = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }

    if (
      !Number.isSafeInteger(clientId) ||
      clientId < 1 ||
      !Number.isSafeInteger(Number(membershipPlanId)) ||
      Number(membershipPlanId) < 1 ||
      typeof amountPaid !== "number" ||
      !Number.isFinite(amountPaid) ||
      amountPaid < 0 ||
      !["cash", "upi", "other"].includes(paymentMethod) ||
      (startDate !== undefined && !isValidDate(startDate)) ||
      (expiryDate !== undefined && !isValidDate(expiryDate)) ||
      (startDate && expiryDate && expiryDate < startDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid membership, date and payment details.",
      });
    }

    const dbClient = await pool.connect();
    let transactionStarted = false;

    try {
      await dbClient.query("BEGIN");
      transactionStarted = true;

      // Lock the client during membership assignment.
      const clientResult = await dbClient.query(
        `SELECT id, full_name, status, member_id
         FROM clients
         WHERE id = $1
         FOR UPDATE`,
        [clientId]
      );

      if (clientResult.rowCount === 0) {
        await dbClient.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "Client not found.",
        });
      }

      const client = clientResult.rows[0];

      if (client.status !== "active") {
        await dbClient.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          success: false,
          message: "This client account is suspended.",
        });
      }

      // Get the selected active plan.
      const planResult = await dbClient.query(
        `SELECT id, name, price, duration_months
         FROM membership_plans
         WHERE id = $1 AND is_active = TRUE`,
        [Number(membershipPlanId)]
      );

      if (planResult.rowCount === 0) {
        await dbClient.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "Membership plan not found or inactive.",
        });
      }

      const plan = planResult.rows[0];
      const planPrice = Number(plan.price);

      if (amountPaid > planPrice) {
        await dbClient.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: "Amount paid cannot exceed the plan price.",
        });
      }

      // Mark memberships whose expiry dates have passed.
      await dbClient.query(
        `UPDATE client_memberships
         SET status = 'expired',
             updated_at = NOW()
         WHERE client_id = $1
           AND status = 'active'
           AND expiry_date < CURRENT_DATE`,
        [clientId]
      );

      // Automatically schedule after an existing membership,
      // unless the owner supplied a custom start date.
      const startResult = await dbClient.query(
        `SELECT GREATEST(
           CURRENT_DATE,
           COALESCE(MAX(expiry_date) + 1, CURRENT_DATE)
         )::date::text AS start_date
         FROM client_memberships
         WHERE client_id = $1
           AND status = 'active'
           AND expiry_date >= CURRENT_DATE`,
        [clientId]
      );

      const finalStartDate = startDate || startResult.rows[0].start_date;

      // Calculate expiry from plan duration if no custom expiry was supplied.
      const expiryResult = await dbClient.query(
        `SELECT (
           $1::date
           + ($2::int * INTERVAL '1 month')
           - INTERVAL '1 day'
         )::date::text AS expiry_date`,
        [finalStartDate, plan.duration_months]
      );

      const finalExpiryDate = expiryDate || expiryResult.rows[0].expiry_date;

      if (finalExpiryDate < finalStartDate) {
        await dbClient.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: "Expiry date cannot be before the start date.",
        });
      }

      // Prevent overlapping active memberships.
      const overlapResult = await dbClient.query(
        `SELECT id
         FROM client_memberships
         WHERE client_id = $1
           AND status = 'active'
           AND start_date <= $3::date
           AND expiry_date >= $2::date
         LIMIT 1`,
        [clientId, finalStartDate, finalExpiryDate]
      );

      if (overlapResult.rowCount > 0) {
        await dbClient.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          success: false,
          message:
            "These dates overlap with another active membership. Choose different dates.",
        });
      }

      // Generate a permanent Member ID only for the first membership.
      let memberId = client.member_id;

      if (memberId === null) {
        const memberResult = await dbClient.query(
          `UPDATE clients
           SET member_id = nextval('gym_member_id_seq')
           WHERE id = $1 AND member_id IS NULL
           RETURNING member_id::text AS member_id`,
          [clientId]
        );

        if (memberResult.rowCount === 0) {
          throw new Error("Unable to generate the client Member ID.");
        }

        memberId = memberResult.rows[0].member_id;
      } else {
        memberId = String(memberId);
      }

      const paymentStatus =
        amountPaid >= planPrice ? "paid" : "pending";

      const membershipStatus =
        finalExpiryDate < new Date().toISOString().slice(0, 10)
          ? "expired"
          : "active";

      // Save the membership and payment details.
      const membershipResult = await dbClient.query(
        `INSERT INTO client_memberships (
           client_id,
           membership_plan_id,
           plan_name,
           price,
           duration_months,
           start_date,
           expiry_date,
           status,
           payment_status,
           amount_paid,
           payment_method
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          clientId,
          plan.id,
          plan.name,
          plan.price,
          plan.duration_months,
          finalStartDate,
          finalExpiryDate,
          membershipStatus,
          paymentStatus,
          amountPaid,
          paymentMethod,
        ]
      );

      await dbClient.query("COMMIT");
      transactionStarted = false;

      return res.status(201).json({
        success: true,
        message: "Membership assigned successfully.",
        memberId,
        clientName: client.full_name,
        membership: membershipResult.rows[0],
      });
    } catch (error) {
      if (transactionStarted) {
        await dbClient.query("ROLLBACK");
      }

      next(error);
    } finally {
      dbClient.release();
    }
  }
);



// Edit an existing client membership
app.patch(
  "/api/owner/clients/:clientId/membership/:membershipId",
  requireOwner,
  requireCsrf,
  async (req, res, next) => {
    const clientId = Number(req.params.clientId);
    const membershipId = Number(req.params.membershipId);

    const {
      membershipPlanId,
      amountPaid,
      paymentMethod,
      startDate,
      expiryDate,
    } = req.body || {};

    function isValidDate(value) {
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        return false;
      }

      const date = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }

    if (
      !Number.isSafeInteger(clientId) ||
      clientId < 1 ||
      !Number.isSafeInteger(membershipId) ||
      membershipId < 1 ||
      !Number.isSafeInteger(Number(membershipPlanId)) ||
      Number(membershipPlanId) < 1 ||
      typeof amountPaid !== "number" ||
      !Number.isFinite(amountPaid) ||
      amountPaid < 0 ||
      !["cash", "upi", "other"].includes(paymentMethod) ||
      !isValidDate(startDate) ||
      !isValidDate(expiryDate) ||
      expiryDate < startDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid membership, date and payment details.",
      });
    }

    const dbClient = await pool.connect();
    let transactionStarted = false;

    try {
      await dbClient.query("BEGIN");
      transactionStarted = true;

      // Lock the client.
      const clientResult = await dbClient.query(
        `SELECT id, full_name, status
         FROM clients
         WHERE id = $1
         FOR UPDATE`,
        [clientId]
      );

      if (clientResult.rowCount === 0) {
        await dbClient.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "Client not found.",
        });
      }

      if (clientResult.rows[0].status !== "active") {
        await dbClient.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          success: false,
          message: "This client account is suspended.",
        });
      }

      // Lock the membership being edited.
      const existingResult = await dbClient.query(
        `SELECT *
         FROM client_memberships
         WHERE id = $1 AND client_id = $2
         FOR UPDATE`,
        [membershipId, clientId]
      );

      if (existingResult.rowCount === 0) {
        await dbClient.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "Membership record not found.",
        });
      }

      const existingMembership = existingResult.rows[0];

      // Get the selected active plan.
      const planResult = await dbClient.query(
        `SELECT id, name, price, duration_months
         FROM membership_plans
         WHERE id = $1 AND is_active = TRUE`,
        [Number(membershipPlanId)]
      );

      if (planResult.rowCount === 0) {
        await dbClient.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "Membership plan not found or inactive.",
        });
      }

      const plan = planResult.rows[0];
      const planPrice = Number(plan.price);

      if (amountPaid > planPrice) {
        await dbClient.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: "Amount paid cannot exceed the plan price.",
        });
      }

      // Cancelled memberships remain cancelled when edited.
      // Other memberships are active unless their expiry date has passed.
      const remainsCancelled =
        existingMembership.status === "cancelled";

      // Check for overlapping active memberships.
      if (!remainsCancelled) {
        const overlapResult = await dbClient.query(
          `SELECT id
           FROM client_memberships
           WHERE client_id = $1
             AND id <> $2
             AND status = 'active'
             AND start_date <= $4::date
             AND expiry_date >= $3::date
           LIMIT 1`,
          [clientId, membershipId, startDate, expiryDate]
        );

        if (overlapResult.rowCount > 0) {
          await dbClient.query("ROLLBACK");
          transactionStarted = false;

          return res.status(409).json({
            success: false,
            message:
              "These dates overlap with another active membership. Choose different dates.",
          });
        }
      }

      const paymentStatus =
        amountPaid >= planPrice ? "paid" : "pending";

      // Update the existing record, not a new record.
      const updateResult = await dbClient.query(
        `UPDATE client_memberships
         SET membership_plan_id = $1,
             plan_name = $2,
             price = $3,
             duration_months = $4,
             start_date = $5,
             expiry_date = $6,
             status = CASE
               WHEN status = 'cancelled' THEN 'cancelled'
               WHEN $6::date < CURRENT_DATE THEN 'expired'
               ELSE 'active'
             END,
             payment_status = $7,
             amount_paid = $8,
             payment_method = $9,
             updated_at = NOW()
         WHERE id = $10 AND client_id = $11
         RETURNING *`,
        [
          plan.id,
          plan.name,
          plan.price,
          plan.duration_months,
          startDate,
          expiryDate,
          paymentStatus,
          amountPaid,
          paymentMethod,
          membershipId,
          clientId,
        ]
      );

      await dbClient.query("COMMIT");
      transactionStarted = false;

      return res.json({
        success: true,
        message: "Membership updated successfully.",
        clientName: clientResult.rows[0].full_name,
        membership: updateResult.rows[0],
      });

    } catch (error) {
      if (transactionStarted) {
        await dbClient.query("ROLLBACK");
      }

      next(error);
    } finally {
      dbClient.release();
    }
  }
);



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

// Generate a secure signature for trainer photo uploads
app.post(
  "/api/owner/trainers/upload-signature",
  requireOwner,
  requireCsrf,
  (req, res) => {
    try {
      if (
        !process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET
      ) {
        return res.status(500).json({
          success: false,
          message: "Photo upload service is not configured.",
        });
      }

      const timestamp = Math.floor(Date.now() / 1000);

      const paramsToSign = {
        timestamp,
        folder: "sylas-gym/trainers",
      };

      const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        process.env.CLOUDINARY_API_SECRET
      );

      return res.json({
        success: true,
        signature,
        timestamp,
        folder: paramsToSign.folder,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      });
    } catch (error) {
      console.error("Trainer upload signature failed:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to prepare the photo upload.",
      });
    }
  }
);

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


// Public API: list published trainers
app.get("/api/trainers", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        specialization,
        experience_years,
        qualifications,
        bio,
        image_url,
        display_order
      FROM trainers
      WHERE is_published = TRUE
      ORDER BY display_order ASC, id ASC
    `);

    res.json({
      success: true,
      trainers: result.rows,
    });
  } catch (error) {
    next(error);
  }
});


// Owner API: list all trainers, including unpublished profiles
app.get(
  "/api/owner/trainers",
  requireOwner,
  async (req, res, next) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          name,
          specialization,
          experience_years,
          qualifications,
          bio,
          image_url,
          image_public_id,
          is_published,
          display_order,
          created_at,
          updated_at
        FROM trainers
        ORDER BY display_order ASC, id ASC
      `);

      res.json({
        success: true,
        trainers: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);


// Owner API: delete a trainer profile and its Cloudinary image
app.delete(
  "/api/owner/trainers/:id",
  requireOwner,
  requireCsrf,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid trainer ID.",
        });
      }

      const result = await pool.query(
        `DELETE FROM trainers
         WHERE id = $1
         RETURNING id, image_public_id`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Trainer not found.",
        });
      }

      const { image_public_id } = result.rows[0];

      try {
        await cloudinary.uploader.destroy(image_public_id, {
          resource_type: "image",
        });
      } catch (imageError) {
        console.error(
          "Trainer deleted, but Cloudinary image cleanup failed:",
          imageError.message
        );
      }

      return res.json({
        success: true,
        message: "Trainer profile deleted.",
      });
    } catch (error) {
      next(error);
    }
  }
);


// Owner API: update a trainer profile
app.patch(
  "/api/owner/trainers/:id",
  requireOwner,
  requireCsrf,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid trainer ID.",
        });
      }

      const {
        name,
        specialization,
        experience_years,
        qualifications,
        bio,
        image_url,
        image_public_id,
        is_published,
        display_order,
      } = req.body || {};

      if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 100 ||
        typeof specialization !== "string" ||
        specialization.trim().length < 2 ||
        specialization.trim().length > 150 ||
        !Number.isInteger(experience_years) ||
        experience_years < 0 ||
        experience_years > 80 ||
        typeof qualifications !== "string" ||
        qualifications.length > 250 ||
        typeof bio !== "string" ||
        bio.length > 2000 ||
        typeof image_url !== "string" ||
        image_url.length > 2048 ||
        !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(image_url) ||
        typeof image_public_id !== "string" ||
        image_public_id.length > 255 ||
        !image_public_id.startsWith("sylas-gym/trainers/") ||
        typeof is_published !== "boolean" ||
        !Number.isSafeInteger(display_order) ||
        display_order < 0 ||
        display_order > 10000
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide valid trainer details.",
        });
      }

      const result = await pool.query(
        `UPDATE trainers
         SET name = $1,
             specialization = $2,
             experience_years = $3,
             qualifications = $4,
             bio = $5,
             image_url = $6,
             image_public_id = $7,
             is_published = $8,
             display_order = $9,
             updated_at = NOW()
         WHERE id = $10
         RETURNING id, name, specialization, experience_years,
           qualifications, bio, image_url, image_public_id,
           is_published, display_order, created_at, updated_at`,
        [
          name.trim(),
          specialization.trim(),
          experience_years,
          qualifications.trim(),
          bio.trim(),
          image_url,
          image_public_id,
          is_published,
          display_order,
          id,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Trainer not found.",
        });
      }

      return res.json({
        success: true,
        message: "Trainer updated successfully.",
        trainer: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);


// Owner API: create a trainer profile
app.post(
  "/api/owner/trainers",
  requireOwner,
  requireCsrf,
  async (req, res, next) => {
    try {
      const {
        name,
        specialization,
        experience_years,
        qualifications,
        bio,
        image_url,
        image_public_id,
      } = req.body || {};

      if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 100 ||
        typeof specialization !== "string" ||
        specialization.trim().length < 2 ||
        specialization.trim().length > 150 ||
        !Number.isInteger(experience_years) ||
        experience_years < 0 ||
        experience_years > 80 ||
        typeof image_url !== "string" ||
        image_url.length > 2048 ||
        !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(image_url) ||
        typeof image_public_id !== "string" ||
        image_public_id.length > 255 ||
        !image_public_id.startsWith("sylas-gym/trainers/")
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide valid trainer details and a Cloudinary photo.",
        });
      }

      if (
        (qualifications !== undefined &&
          (typeof qualifications !== "string" || qualifications.length > 250)) ||
        (bio !== undefined &&
          (typeof bio !== "string" || bio.length > 2000))
      ) {
        return res.status(400).json({
          success: false,
          message: "Qualifications or bio exceeds the allowed length.",
        });
      }

      const result = await pool.query(
        `INSERT INTO trainers (
          name, specialization, experience_years,
          qualifications, bio, image_url, image_public_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, specialization, experience_years,
          qualifications, bio, image_url, image_public_id,
          is_published, display_order, created_at, updated_at`,
        [
          name.trim(),
          specialization.trim(),
          experience_years,
          qualifications?.trim() || "",
          bio?.trim() || "",
          image_url,
          image_public_id,
        ]
      );

      return res.status(201).json({
        success: true,
        message: "Trainer created successfully.",
        trainer: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);


// ==========================================
// MEMBERSHIP PLAN APIs
// ==========================================

// Public API: Get all active membership plans
app.get("/api/membership-plans", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        price,
        duration_months,
        description,
        benefits,
        display_order
      FROM membership_plans
      WHERE is_active = TRUE
      ORDER BY display_order ASC, id ASC
    `);

    res.json({
      success: true,
      plans: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Owner API: Get all membership plans
app.get(
  "/api/owner/membership-plans",
  requireOwner,
  async (req, res, next) => {
    try {
      const result = await pool.query(`
        SELECT *
        FROM membership_plans
        ORDER BY display_order ASC, id ASC
      `);

      res.json({
        success: true,
        plans: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Owner API: Create a membership plan
app.post(
  "/api/owner/membership-plans",
  requireOwner,
  requireCsrf,
  async (req, res, next) => {
    try {
      const {
        name,
        price,
        duration_months,
        description,
        benefits,
        display_order,
      } = req.body || {};

      if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 100 ||
        typeof price !== "number" ||
        !Number.isFinite(price) ||
        price < 0 ||
        price > 10000000 ||
        !Number.isInteger(duration_months) ||
        duration_months < 1 ||
        duration_months > 60 ||
        typeof description !== "string" ||
        description.length > 1000 ||
        !Array.isArray(benefits) ||
        benefits.length > 30 ||
        benefits.some(
          (item) =>
            typeof item !== "string" ||
            item.trim().length === 0 ||
            item.length > 150
        ) ||
        (display_order !== undefined &&
          (!Number.isSafeInteger(display_order) ||
            display_order < 0 ||
            display_order > 10000))
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide valid membership plan details.",
        });
      }

      const result = await pool.query(
        `INSERT INTO membership_plans (
          name, price, duration_months,
          description, benefits, display_order
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)
        RETURNING *`,
        [
          name.trim(),
          price,
          duration_months,
          description.trim(),
          JSON.stringify(benefits.map((item) => item.trim())),
          display_order ?? 0,
        ]
      );

      res.status(201).json({
        success: true,
        message: "Membership plan created successfully.",
        plan: result.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "A membership plan with this name already exists.",
        });
      }
      next(error);
    }
  }
);

// Owner API: Update a membership plan
app.patch(
  "/api/owner/membership-plans/:id",
  requireOwner,
  requireCsrf,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid membership plan ID.",
        });
      }

      const {
        name,
        price,
        duration_months,
        description,
        benefits,
        is_active,
        display_order,
      } = req.body || {};

      if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 100 ||
        typeof price !== "number" ||
        !Number.isFinite(price) ||
        price < 0 ||
        price > 10000000 ||
        !Number.isInteger(duration_months) ||
        duration_months < 1 ||
        duration_months > 60 ||
        typeof description !== "string" ||
        description.length > 1000 ||
        !Array.isArray(benefits) ||
        benefits.length > 30 ||
        benefits.some(
          (item) =>
            typeof item !== "string" ||
            item.trim().length === 0 ||
            item.length > 150
        ) ||
        typeof is_active !== "boolean" ||
        !Number.isSafeInteger(display_order) ||
        display_order < 0 ||
        display_order > 10000
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide valid membership plan details.",
        });
      }

      const result = await pool.query(
        `UPDATE membership_plans
         SET name = $1,
             price = $2,
             duration_months = $3,
             description = $4,
             benefits = $5::jsonb,
             is_active = $6,
             display_order = $7,
             updated_at = NOW()
         WHERE id = $8
         RETURNING *`,
        [
          name.trim(),
          price,
          duration_months,
          description.trim(),
          JSON.stringify(benefits.map((item) => item.trim())),
          is_active,
          display_order,
          id,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Membership plan not found.",
        });
      }

      res.json({
        success: true,
        message: "Membership plan updated successfully.",
        plan: result.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "A membership plan with this name already exists.",
        });
      }
      if (error.code === "23503") {
        return res.status(409).json({
          success: false,
          message: "This plan is linked to existing client memberships. Deactivate it instead of deleting it.",
        });
      }
      next(error);
    }
  }
);

// Owner API: Delete a membership plan
app.delete(
  "/api/owner/membership-plans/:id",
  requireOwner,
  requireCsrf,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid membership plan ID.",
        });
      }

      const result = await pool.query(
        `DELETE FROM membership_plans
         WHERE id = $1
         RETURNING id`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Membership plan not found.",
        });
      }

      res.json({
        success: true,
        message: "Membership plan deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
);



// Public membership enquiry submission
app.post("/api/enquiries", enquiryLimiter, async (req, res, next) => {
  const { name, phone, plan_id, goal = "", enquiry = "" } = req.body || {};
  const hasPlan = plan_id !== null && plan_id !== undefined && String(plan_id).trim() !== "";
  const parsedPlanId = hasPlan ? Number(plan_id) : null;

  if (
    typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100 ||
    typeof phone !== "string" || !/^[0-9+\s()\-]{7,20}$/.test(phone.trim()) ||
    (hasPlan && (!Number.isSafeInteger(parsedPlanId) || parsedPlanId < 1)) ||
    typeof goal !== "string" || goal.length > 100 ||
    typeof enquiry !== "string" || enquiry.length > 1000
  ) {
    return res.status(400).json({ success: false, message: "Please provide valid enquiry details." });
  }

  try {
    let selectedPlan = null;
    if (hasPlan) {
      const planResult = await pool.query(
        `SELECT id, name, price, duration_months FROM membership_plans WHERE id = $1 AND is_active = TRUE`,
        [parsedPlanId]
      );
      if (planResult.rows.length === 0) {
        return res.status(400).json({ success: false, message: "The selected membership plan is unavailable." });
      }
      selectedPlan = planResult.rows[0];
    }

    const result = await pool.query(
      `INSERT INTO enquiries (name, phone, membership, message, fitness_goal, enquiry_text)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, phone, membership, message, fitness_goal, enquiry_text, status, created_at`,
      [name.trim(), phone.trim(), selectedPlan?.name || null,
       selectedPlan ? `Selected plan price: ₹${Number(selectedPlan.price).toLocaleString("en-IN")}.` : "",
       goal.trim(), enquiry.trim()]
    );

    const savedEnquiry = result.rows[0];
    const ownerMessage = `Sylas Gym: New enquiry from ${savedEnquiry.name}. Phone: ${savedEnquiry.phone}.` +
      (selectedPlan ? ` Plan: ${selectedPlan.name}.` : " No membership selected.") +
      (goal.trim() ? ` Goal: ${goal.trim()}.` : "");
    void sendOwnerSms(ownerMessage);

    return res.status(201).json({ success: true, message: "Your enquiry was saved successfully.", enquiry: savedEnquiry });
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

    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(name ILIKE $${params.length}
          OR phone ILIKE $${params.length}
          OR email ILIKE $${params.length})`
      );
    }

    if (requestedStatus !== "all") {
      params.push(requestedStatus);
      conditions.push(`status = $${params.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const allEnquiries = `
      SELECT
  id,
  name,
  NULL::text AS email,
  phone,
  COALESCE(membership, '—') AS membership,
  membership AS membership_enquiry,
  fitness_goal,
  enquiry_text,
  message,
  status,
  created_at,
  'website'::text AS source
FROM enquiries

      UNION ALL

      SELECT
        -rue.id AS id,
        ru.full_name AS name,
        ru.email AS email,
        ru.phone AS phone,
        COALESCE(rue.plan_name, 'Membership Enquiry') AS membership,
        rue.plan_name AS membership_enquiry,
        NULL::text AS fitness_goal,
        rue.message AS enquiry_text,
        rue.message,
        rue.status,
        rue.created_at,
        'registered_user'::text AS source
      FROM registered_user_enquiries rue
      JOIN registered_users ru
        ON ru.id = rue.user_id
    `;

    const countResult = await pool.query(
      `
      WITH all_enquiries AS (${allEnquiries})
      SELECT COUNT(*)::int AS total
      FROM all_enquiries
      ${whereClause}
      `,
      params
    );

    const total = countResult.rows[0].total;
    const totalPages = Math.ceil(total / limit);

    if (total > 0 && page > totalPages) {
      return res.json({
        success: true,
        enquiries: [],
        pagination: { page, limit, total, totalPages },
      });
    }

    const dataParams = [...params, limit, offset];

    const enquiryResult = await pool.query(
      `
      WITH all_enquiries AS (${allEnquiries})
      SELECT *
      FROM all_enquiries
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT $${dataParams.length - 1}
      OFFSET $${dataParams.length}
      `,
      dataParams
    );

    const statsResult = await pool.query(
      `
      WITH all_enquiries AS (${allEnquiries})
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'new')::int AS new,
        COUNT(*) FILTER (WHERE status = 'contacted')::int AS contacted,
        COUNT(*) FILTER (WHERE status = 'converted')::int AS converted,
        COUNT(*) FILTER (WHERE status = 'closed')::int AS closed
      FROM all_enquiries
      `
    );

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





app.patch(
  "/api/enquiries/:id/status",
  requireOwner,
  requireCsrf,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const { status } = req.body;

      const allowedStatuses = [
        "new",
        "contacted",
        "converted",
        "closed",
      ];

      if (!Number.isSafeInteger(id) || id === 0) {
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

      let result;

      if (id < 0) {
        // Registered website user enquiry
        result = await pool.query(
          `
          UPDATE registered_user_enquiries
          SET status = $1,
              updated_at = NOW()
          WHERE id = $2
          RETURNING id, plan_name, message, status, created_at
          `,
          [status, Math.abs(id)]
        );
      } else {
        // Existing public website enquiry
        result = await pool.query(
          `
          UPDATE enquiries
          SET status = $1
          WHERE id = $2
          RETURNING id, name, phone, membership, status, created_at
          `,
          [status, id]
        );
      }

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
  }
);



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
