/**
 * seed-admin.ts — One-time script to create the super-admin role + admin user
 * and print a ready-to-use JWT token.
 *
 * Usage:
 *   npx ts-node scripts/seed-admin.ts
 *
 * What it does:
 *   1. Connects to MongoDB
 *   2. Creates a "super_admin" role with all permissions for all modules
 *   3. Creates an admin user (email: admin@example.com / password: Admin@1234)
 *   4. Signs and prints a JWT token for that user
 *   5. Disconnects
 *
 * Re-running is safe — skips creation if email already exists.
 */

import 'dotenv/config';
import mongoose         from 'mongoose';
import bcrypt           from 'bcryptjs';
import jwt              from 'jsonwebtoken';
import { Role }         from '../src/frameworks/mongo/model/role.model';
import { User }         from '../src/frameworks/mongo/model/user.model';
import { SALT_ROUNDS, DEFAULT_JWT_EXPIRY } from '../src/utils/constants';
import { IJwtPayload }  from '../src/core/entities/user.entity';

const ADMIN_EMAIL    = 'nikhilmahato104@gmail.com';
const ADMIN_PASSWORD = 'secure pass @1234';
const ADMIN_USERNAME = 'Nikhil Mahato';
const ADMIN_MOBILE   = '+919304260733';

const ALL_MODULES = [
  'urm_management',
  'user_management',
  'role_management',
  'module_management',
  'api_key_management',
  'student_management',
  'marks_management',
];

function buildFullAccess(moduleId: string) {
  return { module_id: moduleId, create: true, edit: true, view: true, delete: true, transfer: true, export: true };
}

async function main() {
  const mongoUri = process.env['MONGO_URI'];
  if (!mongoUri) throw new Error('MONGO_URI is not set in .env');

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // 1. Super admin role
  let role = await Role.findOne({ role_name: 'super_admin' });
  if (!role) {
    role = await Role.create({
      role_name:   'super_admin',
      role_access: ALL_MODULES.map(buildFullAccess),
      is_active:   true,
    });
    console.log('Created role: super_admin');
  } else {
    console.log('Role super_admin already exists — skipping');
  }

  // 2. Admin user
  let user = await User.findOne({ email: ADMIN_EMAIL });
  if (!user) {
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
    user = await User.create({
      username:  ADMIN_USERNAME,
      email:     ADMIN_EMAIL,
      mobile_no: ADMIN_MOBILE,
      password:  hashedPassword,
      role_id:   role._id,
      is_active: true,
    });
    console.log('Created user: admin@example.com');
  } else {
    console.log('Admin user already exists — skipping');
  }

  // 3. Sign JWT
  const payload: IJwtPayload = {
    user_id: (user._id as unknown as mongoose.Types.ObjectId).toString(),
    email:   user.email,
    role_id: user.role_id.toString(),
  };

  const secret  = process.env['JWT_SECRET'] ?? 'change_me';
  const expires = process.env['JWT_EXPIRES_IN'] ?? DEFAULT_JWT_EXPIRY;
  const token   = jwt.sign(payload, secret, { expiresIn: expires } as jwt.SignOptions);

  console.log('\n========================================');
  console.log('ADMIN JWT TOKEN (valid for', expires, ')');
  console.log('========================================');
  console.log(token);
  console.log('========================================\n');
  console.log('Email:    ', ADMIN_EMAIL);
  console.log('Password: ', ADMIN_PASSWORD);
  console.log('\nUse this token in Swagger: Authorize → Bearer <token>');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
