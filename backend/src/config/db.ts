import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const useMockDb = process.env.USE_MOCK_DB === 'true';
const dbStorePath = path.join(__dirname, '../../db_store.json');

// Interface for Mock DB store
interface UserSchema {
  id: number;
  email: string;
  password_hash: string;
  resume_text: string;
  created_at: string;
}

interface JobSchema {
  id: number;
  user_id: number;
  company: string;
  role: string;
  location: string;
  salary: string;
  experience: string;
  skills: string[];
  description: string;
  apply_link: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface DbStore {
  users: UserSchema[];
  jobs: JobSchema[];
  userCounter: number;
  jobCounter: number;
}

// Helper to load/save JSON Mock DB
const loadMockDb = (): DbStore => {
  if (!fs.existsSync(dbStorePath)) {
    const initialDb: DbStore = { users: [], jobs: [], userCounter: 1, jobCounter: 1 };
    fs.writeFileSync(dbStorePath, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }
  try {
    const content = fs.readFileSync(dbStorePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading mock db file, resetting database', err);
    return { users: [], jobs: [], userCounter: 1, jobCounter: 1 };
  }
};

const saveMockDb = (data: DbStore) => {
  fs.writeFileSync(dbStorePath, JSON.stringify(data, null, 2), 'utf-8');
};

let pool: pg.Pool | null = null;

if (!useMockDb) {
  console.log('Connecting to PostgreSQL using connection string...');
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') || process.env.DATABASE_URL?.includes('supabase') || !process.env.DATABASE_URL?.includes('localhost')
      ? { rejectUnauthorized: false }
      : false
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
  });

  // Automatically initialize database schema
  const initDb = async () => {
    try {
      const schemaPath = path.join(process.cwd(), 'src/database/schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await pool!.query(schemaSql);
        console.log('PostgreSQL database schema initialized successfully.');
      } else {
        console.warn('PostgreSQL schema.sql not found at path:', schemaPath);
      }
    } catch (err) {
      console.error('Error initializing PostgreSQL schema:', err);
    }
  };
  initDb();
} else {
  console.log('Database initialized in Mock JSON mode. Path:', dbStorePath);
}

// Unified query wrapper
export const query = async (text: string, params?: any[]): Promise<any> => {
  if (pool) {
    try {
      return await pool.query(text, params);
    } catch (error) {
      console.error('PostgreSQL query error. Falling back to local logging:', error);
      throw error;
    }
  }

  // --- Mock DB Implementation ---
  const db = loadMockDb();
  const lowerText = text.toLowerCase();

  // 1. User Register: INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email
  if (lowerText.includes('insert into users') && lowerText.includes('password_hash')) {
    const email = params?.[0];
    const passwordHash = params?.[1];

    if (db.users.some(u => u.email === email)) {
      throw new Error('duplicate key value violates unique constraint "users_email_key"');
    }

    const newUser: UserSchema = {
      id: db.userCounter++,
      email,
      password_hash: passwordHash,
      resume_text: '',
      created_at: new Date().toISOString()
    };

    db.users.push(newUser);
    saveMockDb(db);

    return {
      rows: [{ id: newUser.id, email: newUser.email }]
    };
  }

  // 2. User Find by Email: SELECT id, email, password_hash, resume_text FROM users WHERE email = $1
  if (lowerText.includes('select') && lowerText.includes('from users') && lowerText.includes('email =')) {
    const email = params?.[0];
    const user = db.users.find(u => u.email === email);
    return {
      rows: user ? [user] : []
    };
  }

  // 3. User Find by ID: SELECT resume_text FROM users WHERE id = $1
  if (lowerText.includes('select resume_text') && lowerText.includes('from users') && lowerText.includes('id =')) {
    const id = params?.[0];
    const user = db.users.find(u => u.id === Number(id));
    return {
      rows: user ? [{ resume_text: user.resume_text }] : []
    };
  }

  // 4. Update Resume: UPDATE users SET resume_text = $1 WHERE id = $2 RETURNING id, resume_text
  if (lowerText.includes('update users') && lowerText.includes('set resume_text =')) {
    const resumeText = params?.[0];
    const id = params?.[1];
    const userIndex = db.users.findIndex(u => u.id === Number(id));

    if (userIndex !== -1) {
      db.users[userIndex].resume_text = resumeText;
      saveMockDb(db);
      return {
        rows: [{ id: db.users[userIndex].id, resume_text: db.users[userIndex].resume_text }]
      };
    }
    return { rows: [] };
  }

  // 5. Add Job: INSERT INTO jobs (user_id, company, role, location, salary, experience, skills, description, apply_link, status, notes) VALUES ... RETURNING *
  if (lowerText.includes('insert into jobs')) {
    const [userId, company, role, location, salary, experience, skills, description, applyLink, status, notes] = params || [];
    const newJob: JobSchema = {
      id: db.jobCounter++,
      user_id: Number(userId),
      company,
      role,
      location,
      salary,
      experience,
      skills: Array.isArray(skills) ? skills : [],
      description,
      apply_link: applyLink,
      status: status || 'Wishlist',
      notes: notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.jobs.push(newJob);
    saveMockDb(db);

    return {
      rows: [newJob]
    };
  }

  // 6. Get Jobs: SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC
  if (lowerText.includes('select * from jobs') && lowerText.includes('user_id =')) {
    const userId = params?.[0];
    const userJobs = db.jobs
      .filter(j => j.user_id === Number(userId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return {
      rows: userJobs
    };
  }

  // 7. Update Job Status: UPDATE jobs SET status = $1, updated_at = ... WHERE id = $2 AND user_id = $3 RETURNING *
  if (lowerText.includes('update jobs') && lowerText.includes('set status =')) {
    const status = params?.[0];
    const id = params?.[1];
    const userId = params?.[2];

    const jobIndex = db.jobs.findIndex(j => j.id === Number(id) && j.user_id === Number(userId));
    if (jobIndex !== -1) {
      db.jobs[jobIndex].status = status;
      db.jobs[jobIndex].updated_at = new Date().toISOString();
      saveMockDb(db);
      return {
        rows: [db.jobs[jobIndex]]
      };
    }
    return { rows: [] };
  }

  // 8. Delete Job: DELETE FROM jobs WHERE id = $1 AND user_id = $2 RETURNING *
  if (lowerText.includes('delete from jobs')) {
    const id = params?.[0];
    const userId = params?.[1];

    const jobIndex = db.jobs.findIndex(j => j.id === Number(id) && j.user_id === Number(userId));
    if (jobIndex !== -1) {
      const deletedJob = db.jobs.splice(jobIndex, 1)[0];
      saveMockDb(db);
      return {
        rows: [deletedJob]
      };
    }
    return { rows: [] };
  }

  throw new Error(`Mock DB query pattern not implemented: ${text}`);
};

export const closePool = async () => {
  if (pool) {
    await pool.end();
  }
};
