import { query } from '../config/db.js';

async function migrate() {
  console.log('🔄 Running Splitwise Pro database migrations...');
  
  try {
    // 1. Add receipt_url to expenses table
    try {
      await query(`ALTER TABLE expenses ADD COLUMN receipt_url VARCHAR(255) DEFAULT NULL`);
      console.log('✅ Added receipt_url column to expenses table.');
    } catch (err) {
      if (err.errno === 1060) {
        console.log('ℹ️ Column receipt_url already exists in expenses table.');
      } else {
        throw err;
      }
    }

    // 2. Add default_split_type to groups table
    try {
      await query(`ALTER TABLE \`groups\` ADD COLUMN default_split_type VARCHAR(20) DEFAULT 'equal'`);
      console.log('✅ Added default_split_type column to groups table.');
    } catch (err) {
      if (err.errno === 1060) {
        console.log('ℹ️ Column default_split_type already exists in groups table.');
      } else {
        throw err;
      }
    }

    // 3. Add default_split_shares to groups table
    try {
      await query(`ALTER TABLE \`groups\` ADD COLUMN default_split_shares TEXT DEFAULT NULL`);
      console.log('✅ Added default_split_shares column to groups table.');
    } catch (err) {
      if (err.errno === 1060) {
        console.log('ℹ️ Column default_split_shares already exists in groups table.');
      } else {
        throw err;
      }
    }

    // 4. Add is_recurring to expenses table
    try {
      await query(`ALTER TABLE expenses ADD COLUMN is_recurring TINYINT DEFAULT 0`);
      console.log('✅ Added is_recurring column to expenses table.');
    } catch (err) {
      if (err.errno === 1060) {
        console.log('ℹ️ Column is_recurring already exists in expenses table.');
      } else {
        throw err;
      }
    }

    // 5. Add recurrence_interval to expenses table
    try {
      await query(`ALTER TABLE expenses ADD COLUMN recurrence_interval VARCHAR(20) DEFAULT NULL`);
      console.log('✅ Added recurrence_interval column to expenses table.');
    } catch (err) {
      if (err.errno === 1060) {
        console.log('ℹ️ Column recurrence_interval already exists in expenses table.');
      } else {
        throw err;
      }
    }

    // 6. Add next_recurrence_date to expenses table
    try {
      await query(`ALTER TABLE expenses ADD COLUMN next_recurrence_date DATE DEFAULT NULL`);
      console.log('✅ Added next_recurrence_date column to expenses table.');
    } catch (err) {
      if (err.errno === 1060) {
        console.log('ℹ️ Column next_recurrence_date already exists in expenses table.');
      } else {
        throw err;
      }
    }

    console.log('🎉 Database migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
