const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

/**
 * Utility script to promote a user to 'admin' role.
 * Usage: node makeAdmin.js <email>
 */
const makeAdmin = async () => {
    const email = process.argv[2];
    if (!email) {
        console.error('❌ Please provide an email address: node makeAdmin.js user@example.com');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const user = await User.findOneAndUpdate(
            { email: email.toLowerCase() },
            { role: 'admin' },
            { new: true }
        );

        if (!user) {
            console.error(`❌ User with email "${email}" not found.`);
        } else {
            console.log(`🚀 Success! User "${user.username}" is now an ADMIN.`);
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

makeAdmin();
